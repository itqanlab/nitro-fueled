import {
  Controller,
  Get,
  Param,
  Query,
  ServiceUnavailableException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LogsService, WorkerLogEntry } from './logs.service';

@ApiTags('logs')
@Controller({ path: 'api', version: '1' })
export class LogsController {
  public constructor(private readonly logsService: LogsService) {}

  @ApiOperation({ summary: 'Get event logs', description: 'Returns cortex events with filtering by session, task, event type, and severity' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'taskId', required: false, description: 'Filter by task ID' })
  @ApiQuery({ name: 'eventType', required: false, description: 'Filter by event type (partial match)' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by severity: error, warning, info' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 100)', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Result offset for pagination', type: Number })
  @ApiResponse({ status: 200, description: 'Filtered event list' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('logs/events')
  public getEvents(
    @Query('sessionId') sessionId?: string,
    @Query('taskId') taskId?: string,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): ReturnType<LogsService['getEvents']> {
    const result = this.logsService.getEvents({
      sessionId,
      taskId,
      eventType,
      severity,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiOperation({ summary: 'Get worker logs', description: 'Returns per-worker log output with phases and events' })
  @ApiParam({ name: 'workerId', description: 'Worker ID' })
  @ApiResponse({ status: 200, description: 'Worker log data' })
  @ApiResponse({ status: 404, description: 'Worker not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('logs/workers/:workerId')
  public getWorkerLogs(@Param('workerId') workerId: string): WorkerLogEntry {
    const result = this.logsService.getWorkerLogs(workerId);
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    if (result === undefined) {
      throw new NotFoundException({ error: `Worker ${workerId} not found` });
    }
    return result;
  }

  @ApiOperation({ summary: 'Get session logs', description: 'Returns aggregated session activity with events, workers, and phases' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Session log summary' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('logs/sessions/:sessionId')
  public getSessionLogs(@Param('sessionId') sessionId: string): ReturnType<LogsService['getSessionLogs']> {
    const result = this.logsService.getSessionLogs(sessionId);
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiOperation({ summary: 'Search logs', description: 'Full-text search across all log entries with time range filtering' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'taskId', required: false, description: 'Filter by task ID' })
  @ApiQuery({ name: 'startTime', required: false, description: 'Start time (ISO 8601)' })
  @ApiQuery({ name: 'endTime', required: false, description: 'End time (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 50)', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Result offset for pagination', type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 400, description: 'Missing search query' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('logs/search')
  public searchLogs(
    @Query('q') q: string,
    @Query('sessionId') sessionId?: string,
    @Query('taskId') taskId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): ReturnType<LogsService['searchLogs']> {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException({ error: 'Search query (q) is required' });
    }
    const result = this.logsService.searchLogs({
      query: q,
      sessionId,
      taskId,
      startTime,
      endTime,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }
}
