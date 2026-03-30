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
import {
  AutoPilotStatusResponse,
  StartAutoPilotRequest,
  StartAutoPilotResponse,
  StopAutoPilotRequest,
  StopAutoPilotResponse,
} from './auto-pilot.model';

const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\d+$/;
const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;
const MAX_TASK_IDS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@ApiTags('auto-pilot')
@Controller('api/auto-pilot')
export class AutoPilotController {
  public constructor(private readonly autoPilotService: AutoPilotService) {}

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start an auto-pilot session', description: 'Returns a mock auto-pilot session id for the dashboard UI.' })
  @ApiResponse({ status: 200, description: 'Mock auto-pilot session started' })
  public start(@Body() body: unknown): StartAutoPilotResponse {
    return this.autoPilotService.start(this.parseStartBody(body));
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop an auto-pilot session', description: 'Stops a mock auto-pilot session.' })
  @ApiResponse({ status: 200, description: 'Mock auto-pilot session stopped' })
  public stop(@Body() body: unknown): StopAutoPilotResponse {
    const request = this.parseStopBody(body);
    const response = this.autoPilotService.stop(request.sessionId);
    if (!response) {
      throw new NotFoundException('Auto-Pilot session not found');
    }
    return response;
  }

  @Get('status/:sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get auto-pilot session status', description: 'Returns the mock status for an auto-pilot session.' })
  @ApiParam({ name: 'sessionId', description: 'Mock auto-pilot session id' })
  @ApiResponse({ status: 200, description: 'Mock auto-pilot session status' })
  public getStatus(@Param('sessionId') sessionId: string): AutoPilotStatusResponse {
    if (!SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('sessionId must match the expected SESSION format');
    }
    const response = this.autoPilotService.getStatus(sessionId);
    if (!response) {
      throw new NotFoundException('Auto-Pilot session not found');
    }
    return response;
  }

  private parseStartBody(body: unknown): StartAutoPilotRequest {
    if (body === undefined || body === null) {
      return {};
    }
    if (!isRecord(body)) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const taskIds = body['taskIds'];
    const options = body['options'];
    let parsedTaskIds: string[] | undefined;
    let parsedOptions: StartAutoPilotRequest['options'];

    if (taskIds !== undefined) {
      if (!Array.isArray(taskIds)) {
        throw new BadRequestException('taskIds must be an array of task ids');
      }
      if (taskIds.length > MAX_TASK_IDS) {
        throw new BadRequestException(`taskIds must not exceed ${MAX_TASK_IDS} items`);
      }
      parsedTaskIds = [];
      for (const taskId of taskIds) {
        if (typeof taskId !== 'string' || !TASK_ID_RE.test(taskId)) {
          throw new BadRequestException('Each taskId must match TASK_YYYY_NNN');
        }
        parsedTaskIds.push(taskId);
      }
    }

    if (options !== undefined) {
      if (!isRecord(options)) {
        throw new BadRequestException('options must be an object');
      }
      const dryRun = options['dryRun'];
      if (dryRun !== undefined && typeof dryRun !== 'boolean') {
        throw new BadRequestException('options.dryRun must be a boolean');
      }
      if (typeof dryRun === 'boolean') {
        parsedOptions = { dryRun };
      } else {
        parsedOptions = {};
      }
    }

    return {
      ...(parsedTaskIds !== undefined ? { taskIds: parsedTaskIds } : {}),
      ...(parsedOptions !== undefined ? { options: parsedOptions } : {}),
    };
  }

  private parseStopBody(body: unknown): StopAutoPilotRequest {
    if (!isRecord(body)) {
      throw new BadRequestException('Request body must be a JSON object');
    }
    const sessionId = body['sessionId'];
    if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
      throw new BadRequestException('sessionId must match the expected SESSION format');
    }
    return { sessionId };
  }
}
