/**
 * SupervisorController — REST endpoints for supervisor session control.
 *
 * POST   /api/supervisor/sessions           — Start a new supervisor session
 * GET    /api/supervisor/sessions/:id/status — Get session status
 * POST   /api/supervisor/sessions/:id/pause  — Pause session
 * POST   /api/supervisor/sessions/:id/resume — Resume session
 * POST   /api/supervisor/sessions/:id/stop   — Stop session
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupervisorService } from './supervisor.service';
import type {
  StartSessionConfig,
  SessionStartResult,
  SessionActionResult,
  SessionStatusResult,
} from './supervisor.service';

const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@ApiTags('supervisor')
@Controller('api/supervisor/sessions')
export class SupervisorController {
  private readonly logger = new Logger(SupervisorController.name);

  public constructor(private readonly supervisorService: SupervisorService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new supervisor session' })
  @ApiResponse({ status: 201, description: 'Session started' })
  @ApiResponse({ status: 400, description: 'Invalid config' })
  public startSession(@Body() body: unknown): SessionStartResult {
    const config = this.parseStartBody(body);
    this.logger.log('Starting supervisor session');
    return this.supervisorService.startSession(config);
  }

  @Get(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get session status' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session status' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public getSessionStatus(@Param('id') id: string): SessionStatusResult {
    this.validateSessionId(id);
    const result = this.supervisorService.getSessionStatus(id);
    if (!result) throw new NotFoundException(`Session ${id} not found`);
    return result;
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause session (no new worker spawns)' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session paused' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  public pauseSession(@Param('id') id: string): SessionActionResult {
    this.validateSessionId(id);
    try {
      const result = this.supervisorService.pauseSession(id);
      if (!result) throw new NotFoundException(`Session ${id} not found`);
      return result;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new ConflictException(err instanceof Error ? err.message : String(err));
    }
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused session' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session resumed' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 409, description: 'Invalid state transition' })
  public resumeSession(@Param('id') id: string): SessionActionResult {
    this.validateSessionId(id);
    try {
      const result = this.supervisorService.resumeSession(id);
      if (!result) throw new NotFoundException(`Session ${id} not found`);
      return result;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new ConflictException(err instanceof Error ? err.message : String(err));
    }
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop and destroy a session' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session stopped' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public stopSession(@Param('id') id: string): SessionActionResult {
    this.validateSessionId(id);
    const result = this.supervisorService.stopSession(id);
    if (!result) throw new NotFoundException(`Session ${id} not found`);
    return result;
  }

  private validateSessionId(id: string): void {
    if (!SESSION_ID_RE.test(id)) {
      throw new BadRequestException('Session ID must match SESSION_YYYY-MM-DDTHH-MM-SS format');
    }
  }

  private parseStartBody(body: unknown): StartSessionConfig {
    if (body === undefined || body === null) return {};
    if (!isRecord(body)) throw new BadRequestException('Request body must be a JSON object');
    const result: StartSessionConfig = {};
    if (body['concurrency'] !== undefined) {
      const c = body['concurrency'];
      if (typeof c !== 'number' || c < 1 || c > 10) {
        throw new BadRequestException('concurrency must be 1-10');
      }
      result.concurrency = c;
    }
    if (body['intervalMs'] !== undefined) {
      const i = body['intervalMs'];
      if (typeof i !== 'number' || i < 5000 || i > 300000) {
        throw new BadRequestException('intervalMs must be 5000-300000');
      }
      result.intervalMs = i;
    }
    return result;
  }
}
