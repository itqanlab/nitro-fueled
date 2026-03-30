/**
 * AutoPilotController — REST endpoints for the persistent supervisor.
 *
 * POST /api/auto-pilot/start   — Start a supervisor session
 * POST /api/auto-pilot/stop    — Stop the active session
 * POST /api/auto-pilot/pause   — Pause (workers keep running, no new spawns)
 * POST /api/auto-pilot/resume  — Resume a paused session
 * GET  /api/auto-pilot/status  — Get current session status
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutoPilotService } from './auto-pilot.service';
import type {
  StartAutoPilotRequest,
  StartAutoPilotResponse,
  StopAutoPilotResponse,
  PauseAutoPilotResponse,
  ResumeAutoPilotResponse,
  AutoPilotStatusResponse,
} from './auto-pilot.model';

const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;
const MAX_TASK_IDS = 50;
const VALID_PROVIDERS = new Set(['claude', 'glm', 'opencode', 'codex']);
const VALID_PRIORITIES = new Set(['build-first', 'review-first', 'balanced']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@ApiTags('auto-pilot')
@Controller('api/auto-pilot')
export class AutoPilotController {
  public constructor(private readonly autoPilotService: AutoPilotService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start a persistent supervisor session',
    description: 'Starts the supervisor loop that spawns and monitors workers. Only one session can run at a time.',
  })
  @ApiResponse({ status: 200, description: 'Supervisor session started' })
  @ApiResponse({ status: 400, description: 'Invalid request or supervisor already running' })
  public start(@Body() body: unknown): StartAutoPilotResponse {
    try {
      return this.autoPilotService.start(this.parseStartBody(body));
    } catch (err) {
      throw new BadRequestException(String(err instanceof Error ? err.message : err));
    }
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop the active supervisor session' })
  @ApiResponse({ status: 200, description: 'Supervisor session stopped' })
  public stop(@Body() body: unknown): StopAutoPilotResponse {
    const request = this.parseSessionBody(body);
    const response = this.autoPilotService.stop(request.sessionId);
    if (!response) {
      throw new NotFoundException('No active session matches the given sessionId');
    }
    return response;
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the supervisor (workers keep running, no new spawns)' })
  @ApiResponse({ status: 200, description: 'Supervisor paused' })
  public pause(@Body() body: unknown): PauseAutoPilotResponse {
    const request = this.parseSessionBody(body);
    const response = this.autoPilotService.pause(request.sessionId);
    if (!response) {
      throw new NotFoundException('No active session matches the given sessionId');
    }
    return response;
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused supervisor session' })
  @ApiResponse({ status: 200, description: 'Supervisor resumed' })
  public resume(@Body() body: unknown): ResumeAutoPilotResponse {
    const request = this.parseSessionBody(body);
    const response = this.autoPilotService.resume(request.sessionId);
    if (!response) {
      throw new NotFoundException('No paused session matches the given sessionId');
    }
    return response;
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current supervisor session status' })
  @ApiResponse({ status: 200, description: 'Current supervisor status' })
  public getStatus(): AutoPilotStatusResponse {
    const response = this.autoPilotService.getStatus();
    if (!response) {
      throw new NotFoundException('No active supervisor session');
    }
    return response;
  }

  @Get('status/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get status for a specific session' })
  @ApiParam({ name: 'sessionId', description: 'Supervisor session id' })
  @ApiResponse({ status: 200, description: 'Session status' })
  public getSessionStatus(@Param('sessionId') sessionId: string): AutoPilotStatusResponse {
    if (!SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('sessionId must match SESSION_YYYY-MM-DDTHH-MM-SS format');
    }
    const response = this.autoPilotService.getStatus(sessionId);
    if (!response) {
      throw new NotFoundException('Session not found or not active');
    }
    return response;
  }

  @Get('running')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if the supervisor is running' })
  public isRunning(): { running: boolean } {
    return { running: this.autoPilotService.isRunning() };
  }

  // ============================================================
  // Request parsing
  // ============================================================

  private parseStartBody(body: unknown): StartAutoPilotRequest {
    if (body === undefined || body === null) return {};
    if (!isRecord(body)) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const result: Record<string, unknown> = {};

    // taskIds
    if (body['taskIds'] !== undefined) {
      const taskIds = body['taskIds'];
      if (!Array.isArray(taskIds)) throw new BadRequestException('taskIds must be an array');
      if (taskIds.length > MAX_TASK_IDS) throw new BadRequestException(`taskIds max ${MAX_TASK_IDS}`);
      for (const id of taskIds) {
        if (typeof id !== 'string' || !TASK_ID_RE.test(id)) {
          throw new BadRequestException('Each taskId must match TASK_YYYY_NNN');
        }
      }
      result['taskIds'] = taskIds;
    }

    // concurrency
    if (body['concurrency'] !== undefined) {
      const c = body['concurrency'];
      if (typeof c !== 'number' || c < 1 || c > 10) {
        throw new BadRequestException('concurrency must be 1-10');
      }
      result['concurrency'] = c;
    }

    // limit
    if (body['limit'] !== undefined) {
      const l = body['limit'];
      if (typeof l !== 'number' || l < 1 || l > 100) {
        throw new BadRequestException('limit must be 1-100');
      }
      result['limit'] = l;
    }

    // providers
    for (const key of ['buildProvider', 'reviewProvider'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || !VALID_PROVIDERS.has(body[key] as string)) {
          throw new BadRequestException(`${key} must be one of: ${[...VALID_PROVIDERS].join(', ')}`);
        }
        result[key] = body[key];
      }
    }

    // models
    for (const key of ['buildModel', 'reviewModel'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string') {
          throw new BadRequestException(`${key} must be a string`);
        }
        result[key] = body[key];
      }
    }

    // priority
    if (body['priority'] !== undefined) {
      if (typeof body['priority'] !== 'string' || !VALID_PRIORITIES.has(body['priority'] as string)) {
        throw new BadRequestException(`priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`);
      }
      result['priority'] = body['priority'];
    }

    // retries
    if (body['retries'] !== undefined) {
      const r = body['retries'];
      if (typeof r !== 'number' || r < 0 || r > 5) {
        throw new BadRequestException('retries must be 0-5');
      }
      result['retries'] = r;
    }

    return result as StartAutoPilotRequest;
  }

  private parseSessionBody(body: unknown): { sessionId: string } {
    if (!isRecord(body)) {
      throw new BadRequestException('Request body must be a JSON object');
    }
    const sessionId = body['sessionId'];
    if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('sessionId must match SESSION_YYYY-MM-DDTHH-MM-SS format');
    }
    return { sessionId };
  }
}
