import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import { SessionsService } from './sessions.service';
import { AnalyticsService } from './analytics.service';
import { CortexService } from './cortex.service';

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

/**
 * DashboardController — Internal dev-tool API.
 * Authentication: none required — this server is intended for local use only (127.0.0.1 bind).
 * DO NOT expose on a non-loopback interface without adding authentication.
 */
@ApiTags('registry')
@Controller({ path: 'api', version: '1' })
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  public constructor(
    private readonly pipelineService: PipelineService,
    private readonly sessionsService: SessionsService,
    private readonly analyticsService: AnalyticsService,
    private readonly cortexService: CortexService,
  ) {}

  // === Health ===

  @ApiTags('health')
  @ApiOperation({ summary: 'Health check', description: 'Returns API health status' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @Get('health')
  @HttpCode(HttpStatus.OK)
  public getHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'nitro-fueled-dashboard',
      timestamp: new Date().toISOString(),
    };
  }

  // === Registry ===

  @ApiTags('registry')
  @ApiOperation({ summary: 'Get task registry', description: 'Returns all tasks from the registry' })
  @ApiResponse({ status: 200, description: 'Task registry list' })
  @Get('registry')
  public getRegistry(): ReturnType<PipelineService['getRegistry']> {
    return this.pipelineService.getRegistry();
  }

  // === Plan ===

  @ApiTags('plan')
  @ApiOperation({ summary: 'Get project plan', description: 'Returns the project plan with phases and current focus' })
  @ApiResponse({ status: 200, description: 'Project plan data' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Get('plan')
  public getPlan(): ReturnType<PipelineService['getPlan']> | { error: string } {
    const plan = this.pipelineService.getPlan();
    return plan ?? { error: 'Plan not found' };
  }

  // === Orchestrator State ===

  @ApiTags('state')
  @ApiOperation({ summary: 'Get orchestrator state', description: 'Returns the current orchestrator state including active workers' })
  @ApiResponse({ status: 200, description: 'Orchestrator state' })
  @ApiResponse({ status: 404, description: 'State not found' })
  @Get('state')
  public getState(): ReturnType<PipelineService['getOrchestratorState']> | { error: string } {
    const state = this.pipelineService.getOrchestratorState();
    return state ?? { error: 'Orchestrator state not found' };
  }

  // === Tasks ===

  @ApiTags('tasks')
  @ApiOperation({ summary: 'Get full task data', description: 'Returns definition, registry record, reviews, and completion report for a task' })
  @ApiParam({ name: 'id', description: 'Task ID (format: TASK_YYYY_NNN)', example: 'TASK_2026_001' })
  @ApiResponse({ status: 200, description: 'Full task data' })
  @ApiResponse({ status: 400, description: 'Invalid task ID format' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @Get('tasks/:id')
  public getTask(@Param('id') id: string): ReturnType<PipelineService['getFullTask']> | { error: string } {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    const taskData = this.pipelineService.getFullTask(id);
    if (!taskData.definition && !taskData.registryRecord) {
      throw new NotFoundException({ error: 'Task not found' });
    }
    return taskData;
  }

  @ApiTags('tasks')
  @ApiOperation({ summary: 'Get task reviews', description: 'Returns all code reviews for a task' })
  @ApiParam({ name: 'id', description: 'Task ID (format: TASK_YYYY_NNN)', example: 'TASK_2026_001' })
  @ApiResponse({ status: 200, description: 'Task review list' })
  @ApiResponse({ status: 400, description: 'Invalid task ID format' })
  @Get('tasks/:id/reviews')
  public getTaskReviews(@Param('id') id: string): ReturnType<PipelineService['getReviews']> {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    return this.pipelineService.getReviews(id);
  }

  @ApiTags('tasks')
  @ApiOperation({ summary: 'Get task pipeline', description: 'Returns pipeline phase data for a task' })
  @ApiParam({ name: 'id', description: 'Task ID (format: TASK_YYYY_NNN)', example: 'TASK_2026_001' })
  @ApiResponse({ status: 200, description: 'Task pipeline data' })
  @ApiResponse({ status: 400, description: 'Invalid task ID format' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @Get('tasks/:id/pipeline')
  public getTaskPipeline(@Param('id') id: string): ReturnType<PipelineService['getTaskPipeline']> | { error: string } {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    const record = this.pipelineService.getRegistry().find((r) => r.id === id);
    if (!record) {
      throw new NotFoundException({ error: 'Task not found' });
    }
    return this.pipelineService.getTaskPipeline(id);
  }

  // === Anti-Patterns & Lessons ===

  @ApiTags('knowledge')
  @ApiOperation({ summary: 'Get anti-patterns', description: 'Returns anti-pattern rules from the knowledge base' })
  @ApiResponse({ status: 200, description: 'Anti-pattern rule list' })
  @Get('anti-patterns')
  public getAntiPatterns(): ReturnType<PipelineService['getAntiPatterns']> {
    return this.pipelineService.getAntiPatterns();
  }

  @ApiTags('knowledge')
  @ApiOperation({ summary: 'Get review lessons', description: 'Returns accumulated review lessons from the knowledge base' })
  @ApiResponse({ status: 200, description: 'Review lesson list' })
  @Get('review-lessons')
  public getLessons(): ReturnType<PipelineService['getLessons']> {
    return this.pipelineService.getLessons();
  }

  // === Stats ===

  @ApiTags('registry')
  @ApiOperation({ summary: 'Get dashboard stats', description: 'Returns aggregated statistics across all tasks and sessions' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  @Get('stats')
  public getStats(): ReturnType<PipelineService['getStats']> {
    return this.pipelineService.getStats();
  }

  // === Graph ===

  @ApiTags('registry')
  @ApiOperation({ summary: 'Get dependency graph', description: 'Returns task dependency graph as nodes and edges' })
  @ApiResponse({ status: 200, description: 'Task dependency graph' })
  @Get('graph')
  public getGraph(): ReturnType<PipelineService['getGraph']> {
    return this.pipelineService.getGraph();
  }

  // === Workers ===

  @ApiTags('workers')
  @ApiOperation({ summary: 'Get worker tree', description: 'Returns the hierarchical worker tree for all active workers' })
  @ApiResponse({ status: 200, description: 'Worker tree data' })
  @Get('workers/tree')
  public getWorkerTree(): ReturnType<PipelineService['getWorkerTree']> {
    return this.pipelineService.getWorkerTree();
  }

  // === Sessions ===

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get active sessions', description: 'Returns all currently active orchestration sessions' })
  @ApiResponse({ status: 200, description: 'Active session list' })
  @Get('sessions/active')
  public getActiveSessions(): ReturnType<SessionsService['getActiveSessions']> {
    return this.sessionsService.getActiveSessions();
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get active sessions with enhanced data', description: 'Returns active sessions with task title, phase, and activity' })
  @ApiResponse({ status: 200, description: 'Enhanced active session list' })
  @Get('sessions/active/enhanced')
  public getActiveSessionsEnhanced(): ReturnType<SessionsService['getActiveSessionsEnhanced']> {
    return this.sessionsService.getActiveSessionsEnhanced();
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get session by ID', description: 'Returns full session data including orchestrator state and log' })
  @ApiParam({ name: 'id', description: 'Session ID (format: SESSION_YYYY-MM-DD_HH-MM-SS)', example: 'SESSION_2026-03-15_10-30-00' })
  @ApiResponse({ status: 200, description: 'Session data' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @Get('sessions/:id')
  public getSession(@Param('id') id: string): ReturnType<SessionsService['getSession']> {
    const data = this.sessionsService.getSession(id);
    if (!data) {
      throw new NotFoundException({ error: 'Session not found' });
    }
    return data;
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get all sessions', description: 'Returns all sessions (active and archived)' })
  @ApiResponse({ status: 200, description: 'Session list' })
  @Get('sessions')
  public getSessions(): ReturnType<SessionsService['getSessions']> {
    return this.sessionsService.getSessions();
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get session detail with messages', description: 'Returns session data including recent messages' })
  @ApiResponse({ status: 200, description: 'Session detail' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @Get('sessions/:id/detail')
  public getSessionDetail(@Param('id') id: string): { sessionId: string; messages: Array<{ timestamp: string; type: string; content: string }> } | { error: string } {
    const session = this.sessionsService.getSession(id);
    if (!session) {
      throw new NotFoundException({ error: 'Session not found' });
    }
    return {
      sessionId: session.summary.sessionId,
      messages: [
        { timestamp: session.summary.started, type: 'info', content: 'Session started' },
        { timestamp: session.summary.lastUpdated, type: 'status', content: session.summary.loopStatus },
      ],
    };
  }

  // === Analytics ===

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get cost analytics', description: 'Returns cost data per session with cumulative totals' })
  @ApiResponse({ status: 200, description: 'Cost analytics data' })
  @ApiResponse({ status: 500, description: 'Analytics unavailable' })
  @Get('analytics/cost')
  public async getAnalyticsCost(): Promise<ReturnType<AnalyticsService['getCostData']>> {
    try {
      return await this.analyticsService.getCostData();
    } catch (err) {
      this.logger.error('Analytics cost failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get efficiency analytics', description: 'Returns efficiency metrics per session' })
  @ApiResponse({ status: 200, description: 'Efficiency analytics data' })
  @ApiResponse({ status: 500, description: 'Analytics unavailable' })
  @Get('analytics/efficiency')
  public async getAnalyticsEfficiency(): Promise<ReturnType<AnalyticsService['getEfficiencyData']>> {
    try {
      return await this.analyticsService.getEfficiencyData();
    } catch (err) {
      this.logger.error('Analytics efficiency failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get model usage analytics', description: 'Returns cost and token usage broken down by model' })
  @ApiResponse({ status: 200, description: 'Model usage analytics data' })
  @ApiResponse({ status: 500, description: 'Analytics unavailable' })
  @Get('analytics/models')
  public async getAnalyticsModels(): Promise<ReturnType<AnalyticsService['getModelsData']>> {
    try {
      return await this.analyticsService.getModelsData();
    } catch (err) {
      this.logger.error('Analytics models failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get session comparison analytics', description: 'Returns a comparison table of all sessions' })
  @ApiResponse({ status: 200, description: 'Session comparison analytics data' })
  @ApiResponse({ status: 500, description: 'Analytics unavailable' })
  @Get('analytics/sessions')
  public async getAnalyticsSessions(): Promise<ReturnType<AnalyticsService['getSessionsData']>> {
    try {
      return await this.analyticsService.getSessionsData();
    } catch (err) {
      this.logger.error('Analytics sessions failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  // === Cortex Tasks ===

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex tasks', description: 'Returns task list from the cortex SQLite DB' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by task status' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by task type' })
  @ApiResponse({ status: 200, description: 'Cortex task list' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/tasks')
  public getCortexTasks(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ): ReturnType<CortexService['getTasks']> {
    const result = this.cortexService.getTasks({ status, type });
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex task context', description: 'Returns one cortex task with full context by ID' })
  @ApiParam({ name: 'id', description: 'Task ID', example: 'TASK_2026_001' })
  @ApiResponse({ status: 200, description: 'Cortex task context' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/tasks/:id')
  public getCortexTask(@Param('id') id: string): ReturnType<CortexService['getTaskContext']> {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    if (!this.cortexService.isAvailable()) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    const result = this.cortexService.getTaskContext(id);
    if (result === null) {
      throw new NotFoundException({ error: 'Task not found' });
    }
    return result;
  }

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex task trace', description: 'Returns full task trace: workers, phases, reviews, fix_cycles, events' })
  @ApiParam({ name: 'id', description: 'Task ID', example: 'TASK_2026_001' })
  @ApiResponse({ status: 200, description: 'Cortex task trace' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/tasks/:id/trace')
  public getCortexTaskTrace(@Param('id') id: string): ReturnType<CortexService['getTaskTrace']> {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    if (!this.cortexService.isAvailable()) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    const result = this.cortexService.getTaskTrace(id);
    if (result === null) {
      throw new NotFoundException({ error: 'Task not found' });
    }
    return result;
  }

  // === Cortex Sessions ===

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex sessions', description: 'Returns sessions list from the cortex SQLite DB' })
  @ApiResponse({ status: 200, description: 'Cortex session list' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/sessions')
  public getCortexSessions(): ReturnType<CortexService['getSessions']> {
    const result = this.cortexService.getSessions();
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex session summary', description: 'Returns full cortex session summary including workers breakdown and cost' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Cortex session summary' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/sessions/:id')
  public getCortexSession(@Param('id') id: string): ReturnType<CortexService['getSessionSummary']> {
    if (!this.cortexService.isAvailable()) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    const result = this.cortexService.getSessionSummary(id);
    if (result === null) {
      throw new NotFoundException({ error: 'Session not found' });
    }
    return result;
  }

  // === Cortex Workers ===

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex workers', description: 'Returns workers list from the cortex SQLite DB' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by worker status' })
  @ApiResponse({ status: 200, description: 'Cortex worker list' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/workers')
  public getCortexWorkers(
    @Query('sessionId') sessionId?: string,
    @Query('status') status?: string,
  ): ReturnType<CortexService['getWorkers']> {
    const result = this.cortexService.getWorkers({ sessionId, status });
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  // === Cortex Analytics ===

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex model performance', description: 'Returns aggregated model performance stats from phases and reviews' })
  @ApiQuery({ name: 'taskType', required: false, description: 'Filter by task type' })
  @ApiQuery({ name: 'model', required: false, description: 'Filter by model name' })
  @ApiResponse({ status: 200, description: 'Cortex model performance data' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/analytics/model-performance')
  public getCortexModelPerformance(
    @Query('taskType') taskType?: string,
    @Query('model') model?: string,
  ): ReturnType<CortexService['getModelPerformance']> {
    const result = this.cortexService.getModelPerformance({ taskType, model });
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiTags('cortex')
  @ApiOperation({ summary: 'Get cortex phase timing', description: 'Returns aggregated phase timing statistics' })
  @ApiResponse({ status: 200, description: 'Cortex phase timing data' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('cortex/analytics/phase-timing')
  public getCortexPhaseTiming(): ReturnType<CortexService['getPhaseTiming']> {
    const result = this.cortexService.getPhaseTiming();
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

}
