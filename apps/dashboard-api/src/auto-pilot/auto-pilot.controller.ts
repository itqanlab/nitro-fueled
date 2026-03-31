/**
 * AutoPilotController — REST endpoints for session-centric supervisor management.
 *
 * POST   /api/sessions            — Create a new supervisor session
 * GET    /api/sessions            — List all sessions
 * GET    /api/sessions/:id        — Get session detail
 * PATCH  /api/sessions/:id/config — Update session config
 * POST   /api/sessions/:id/pause  — Pause session
 * POST   /api/sessions/:id/resume — Resume session
 * POST   /api/sessions/:id/stop   — Stop session
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutoPilotService } from './auto-pilot.service';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  UpdateSessionConfigRequest,
  UpdateSessionConfigResponse,
  SessionActionResponse,
  ListSessionsResponse,
} from './auto-pilot.model';
import type { SessionStatusResponse } from './auto-pilot.types';

const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
const VALID_PROVIDERS = new Set(['claude', 'glm', 'opencode', 'codex']);
const VALID_PRIORITIES = new Set(['build-first', 'review-first', 'balanced']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@ApiTags('sessions')
@Controller('api/sessions')
export class AutoPilotController {
  public constructor(private readonly autoPilotService: AutoPilotService) {}

  // ============================================================
  // Session lifecycle
  // ============================================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new supervisor session',
    description:
      'Creates and starts a new supervisor session with the given config. Multiple sessions can run concurrently.',
  })
  @ApiResponse({ status: 201, description: 'Session created and starting' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  public createSession(@Body() body: unknown): CreateSessionResponse {
    const request = this.parseCreateBody(body);
    try {
      return this.autoPilotService.createSession(request);
    } catch (err) {
      throw new BadRequestException(
        String(err instanceof Error ? err.message : err),
      );
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all active sessions' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  public listSessions(): ListSessionsResponse {
    return this.autoPilotService.listSessions();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get status for a specific session' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session status' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public getSession(@Param('id') id: string): SessionStatusResponse {
    this.validateSessionId(id);
    const response = this.autoPilotService.getSessionStatus(id);
    if (!response) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return response;
  }

  // ============================================================
  // Session config
  // ============================================================

  @Patch(':id/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update session configuration' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session config updated' })
  @ApiResponse({ status: 400, description: 'Invalid session ID or config' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public updateConfig(
    @Param('id') id: string,
    @Body() body: unknown,
  ): UpdateSessionConfigResponse {
    this.validateSessionId(id);
    const request = this.parseUpdateConfigBody(body);
    const response = this.autoPilotService.updateSessionConfig(id, request);
    if (!response) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return response;
  }

  // ============================================================
  // Session actions
  // ============================================================

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause session (workers keep running, no new spawns)' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session paused' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public pauseSession(@Param('id') id: string): SessionActionResponse {
    this.validateSessionId(id);
    try {
      const response = this.autoPilotService.pauseSession(id);
      if (!response) {
        throw new NotFoundException(`Session ${id} not found`);
      }
      return response;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new ConflictException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused session' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session resumed' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public resumeSession(@Param('id') id: string): SessionActionResponse {
    this.validateSessionId(id);
    try {
      const response = this.autoPilotService.resumeSession(id);
      if (!response) {
        throw new NotFoundException(`Session ${id} not found`);
      }
      return response;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new ConflictException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop and destroy a session' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Session stopped' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public stopSession(@Param('id') id: string): SessionActionResponse {
    this.validateSessionId(id);
    const response = this.autoPilotService.stopSession(id);
    if (!response) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return response;
  }

  @Patch(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request graceful drain — active workers finish, no new spawns' })
  @ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
  @ApiResponse({ status: 200, description: 'Drain requested' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  public drainSession(@Param('id') id: string): SessionActionResponse {
    this.validateSessionId(id);
    const response = this.autoPilotService.drainSession(id);
    if (!response) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return response;
  }

  // ============================================================
  // Validation helpers
  // ============================================================

  private validateSessionId(id: string): void {
    if (!SESSION_ID_RE.test(id)) {
      throw new BadRequestException(
        'Session ID must match SESSION_YYYY-MM-DDTHH-MM-SS format',
      );
    }
  }

  private parseCreateBody(body: unknown): CreateSessionRequest {
    if (body === undefined || body === null) return {};
    if (!isRecord(body)) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const result: Record<string, unknown> = {};

    if (body['concurrency'] !== undefined) {
      const c = body['concurrency'];
      if (typeof c !== 'number' || c < 1 || c > 10) {
        throw new BadRequestException('concurrency must be 1-10');
      }
      result['concurrency'] = c;
    }

    if (body['limit'] !== undefined) {
      const l = body['limit'];
      if (typeof l !== 'number' || l < 1 || l > 100) {
        throw new BadRequestException('limit must be 1-100');
      }
      result['limit'] = l;
    }

    for (const key of ['prepProvider', 'implementProvider', 'implementFallbackProvider', 'reviewProvider'] as const) {
      if (body[key] !== undefined) {
        if (
          typeof body[key] !== 'string' ||
          !VALID_PROVIDERS.has(body[key] as string)
        ) {
          throw new BadRequestException(
            `${key} must be one of: ${[...VALID_PROVIDERS].join(', ')}`,
          );
        }
        result[key] = body[key];
      }
    }

    for (const key of ['prepModel', 'implementModel', 'implementFallbackModel', 'reviewModel'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string') {
          throw new BadRequestException(`${key} must be a string`);
        }
        result[key] = body[key];
      }
    }

    if (body['priority'] !== undefined) {
      if (
        typeof body['priority'] !== 'string' ||
        !VALID_PRIORITIES.has(body['priority'] as string)
      ) {
        throw new BadRequestException(
          `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`,
        );
      }
      result['priority'] = body['priority'];
    }

    if (body['retries'] !== undefined) {
      const r = body['retries'];
      if (typeof r !== 'number' || r < 0 || r > 5) {
        throw new BadRequestException('retries must be 0-5');
      }
      result['retries'] = r;
    }

    return result as CreateSessionRequest;
  }

  private parseUpdateConfigBody(body: unknown): UpdateSessionConfigRequest {
    if (body === undefined || body === null) return {};
    if (!isRecord(body)) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const result: Record<string, unknown> = {};

    if (body['concurrency'] !== undefined) {
      const c = body['concurrency'];
      if (typeof c !== 'number' || c < 1 || c > 10) {
        throw new BadRequestException('concurrency must be 1-10');
      }
      result['concurrency'] = c;
    }

    if (body['limit'] !== undefined) {
      const l = body['limit'];
      if (typeof l !== 'number' || l < 1 || l > 100) {
        throw new BadRequestException('limit must be 1-100');
      }
      result['limit'] = l;
    }

    for (const key of ['prepProvider', 'implementProvider', 'implementFallbackProvider', 'reviewProvider'] as const) {
      if (body[key] !== undefined) {
        if (
          typeof body[key] !== 'string' ||
          !VALID_PROVIDERS.has(body[key] as string)
        ) {
          throw new BadRequestException(
            `${key} must be one of: ${[...VALID_PROVIDERS].join(', ')}`,
          );
        }
        result[key] = body[key];
      }
    }

    for (const key of ['prepModel', 'implementModel', 'implementFallbackModel', 'reviewModel'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string') {
          throw new BadRequestException(`${key} must be a string`);
        }
        result[key] = body[key];
      }
    }

    if (body['priority'] !== undefined) {
      if (
        typeof body['priority'] !== 'string' ||
        !VALID_PRIORITIES.has(body['priority'] as string)
      ) {
        throw new BadRequestException(
          `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}`,
        );
      }
      result['priority'] = body['priority'];
    }

    if (body['retries'] !== undefined) {
      const r = body['retries'];
      if (typeof r !== 'number' || r < 0 || r > 5) {
        throw new BadRequestException('retries must be 0-5');
      }
      result['retries'] = r;
    }

    if (body['pollIntervalMs'] !== undefined) {
      const p = body['pollIntervalMs'];
      if (typeof p !== 'number' || p < 5000 || p > 300000) {
        throw new BadRequestException('pollIntervalMs must be 5000-300000');
      }
      result['pollIntervalMs'] = p;
    }

    return result as UpdateSessionConfigRequest;
  }
}
