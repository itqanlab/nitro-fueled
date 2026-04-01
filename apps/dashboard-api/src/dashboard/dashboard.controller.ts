import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
  ApiBody,
} from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';
import { SessionsService } from './sessions.service';
import { SessionsHistoryService } from './sessions-history.service';
import { AnalyticsService } from './analytics.service';
import { CortexService } from './cortex.service';
import { OrchestrationFlowsService } from './orchestration-flows.service';
import { ReportsService } from './reports.service';
import { ProgressCenterService } from './progress-center.service';
import { McpService, isValidServerName } from './mcp.service';
import type { McpServerEntry, McpInstallRequest, McpToolAccessMatrix } from './mcp.service';
import { resolveProjectRoot } from '../app/resolve-project-root';

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;
const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}[T_]\d{2}-\d{2}-\d{2}$/;

/**
 * DashboardController — Internal dev-tool API.
 * Authentication: none required — this server is intended for local use only (127.0.0.1 bind).
 * DO NOT expose on a non-loopback interface without adding authentication.
 */
@ApiTags('registry')
@Controller('api')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  public constructor(
    private readonly pipelineService: PipelineService,
    private readonly sessionsService: SessionsService,
    private readonly sessionsHistoryService: SessionsHistoryService,
    private readonly analyticsService: AnalyticsService,
    private readonly cortexService: CortexService,
    private readonly orchestrationFlowsService: OrchestrationFlowsService,
    private readonly reportsService: ReportsService,
    private readonly progressCenterService: ProgressCenterService,
    private readonly mcpService: McpService,
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
  @ApiOperation({ summary: 'Get session detail', description: 'Returns full session detail from cortex with tasks, timeline, workers, and log content' })
  @ApiParam({ name: 'id', description: 'Session ID', example: 'SESSION_2026-03-15_10-30-00' })
  @ApiResponse({ status: 200, description: 'Session detail' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('session-history/:id')
  public async getSession(@Param('id') id: string): Promise<Awaited<ReturnType<SessionsHistoryService['getSessionDetail']>>> {
    if (!SESSION_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid session ID format' });
    }
    const result = await this.sessionsHistoryService.getSessionDetail(id);
    if (result === null) {
      if (!this.cortexService.isAvailable()) {
        throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
      }
      throw new NotFoundException({ error: 'Session not found' });
    }
    return result;
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get session history', description: 'Returns all sessions from cortex with summary stats (completed, failed, blocked counts)' })
  @ApiResponse({ status: 200, description: 'Session history list' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('session-history')
  public getSessions() {
    const result = this.sessionsHistoryService.getSessionsList();
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get progress center snapshot', description: 'Returns active session progress, health, ETA, and recent activity feed data' })
  @ApiResponse({ status: 200, description: 'Real-time progress center snapshot' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Get('progress-center')
  public getProgressCenter() {
    const snapshot = this.progressCenterService.getSnapshot();
    if (snapshot === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return snapshot;
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Request session drain', description: 'Sets drain_requested=1 on the session, signaling the supervisor to stop after the current task finishes.' })
  @ApiParam({ name: 'id', description: 'Session ID', example: 'SESSION_2026-03-15_10-30-00' })
  @ApiResponse({ status: 200, description: 'Drain requested' })
  @ApiResponse({ status: 400, description: 'Invalid session ID format' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Patch('sessions/:id/stop')
  @HttpCode(HttpStatus.OK)
  public requestSessionDrain(@Param('id') id: string): { sessionId: string; action: string } {
    if (!SESSION_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid session ID format' });
    }
    if (!this.cortexService.isAvailable()) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    const ok = this.cortexService.requestSessionDrain(id);
    if (!ok) {
      throw new NotFoundException({ error: 'Session not found' });
    }
    return { sessionId: id, action: 'drain_requested' };
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Close stale sessions', description: 'Marks sessions with no heartbeat as stopped. Default TTL is 30 minutes.' })
  @ApiQuery({ name: 'ttl', required: false, description: 'TTL in minutes (default: 30)' })
  @ApiResponse({ status: 200, description: 'Stale sessions closed' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Post('sessions/close-stale')
  @HttpCode(HttpStatus.OK)
  public closeStaleSession(
    @Query('ttl') ttl?: string,
  ): { closed_sessions: number } {
    const ttlMinutes = ttl !== undefined ? Number(ttl) : 30;
    const safeTtl = Number.isFinite(ttlMinutes) && ttlMinutes >= 1 ? Math.min(ttlMinutes, 1440) : 30;
    const result = this.cortexService.closeStaleSession(safeTtl);
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    return result;
  }

  @ApiTags('sessions')
  @ApiOperation({ summary: 'Get session detail with messages', description: 'Returns session data including recent messages' })
  @ApiResponse({ status: 200, description: 'Session detail' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @Get('sessions/:id/detail')
  public getSessionDetail(@Param('id') id: string): { sessionId: string; messages: Array<{ timestamp: string; type: string; content: string }> } | { error: string } {
    if (!SESSION_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid session ID format' });
    }
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

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get model performance analytics', description: 'Returns aggregated model performance (phases + reviews) from the cortex DB' })
  @ApiQuery({ name: 'taskType', required: false, description: 'Filter by task type' })
  @ApiResponse({ status: 200, description: 'Model performance data' })
  @ApiResponse({ status: 503, description: 'Analytics unavailable' })
  @Get('analytics/model-performance')
  public getAnalyticsModelPerformance(
    @Query('taskType') taskType?: string,
  ): { data: object[]; total: number } {
    const rows = this.cortexService.getModelPerformance({ taskType });
    if (rows === null) {
      throw new ServiceUnavailableException({ error: 'Analytics unavailable' });
    }
    const data = rows.map(r => ({
      model: r.model,
      taskType: r.task_type,
      phaseCount: r.phase_count,
      reviewCount: r.review_count,
      avgDurationMinutes: r.avg_duration_minutes,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
      avgReviewScore: r.avg_review_score,
    }));
    return { data, total: data.length };
  }

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get launcher metrics analytics', description: 'Returns aggregated worker stats grouped by launcher' })
  @ApiResponse({ status: 200, description: 'Launcher metrics data' })
  @ApiResponse({ status: 503, description: 'Analytics unavailable' })
  @Get('analytics/launchers')
  public getAnalyticsLaunchers(): { data: object[]; total: number } {
    const rows = this.cortexService.getLauncherMetrics();
    if (rows === null) {
      throw new ServiceUnavailableException({ error: 'Analytics unavailable' });
    }
    const data = rows.map(r => ({
      launcher: r.launcher,
      totalWorkers: r.total_workers,
      completedCount: r.completed_count,
      failedCount: r.failed_count,
      completionRate: r.completion_rate,
      totalCost: r.total_cost,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
    }));
    return { data, total: data.length };
  }

  @ApiTags('analytics')
  @ApiOperation({ summary: 'Get routing recommendations', description: 'Returns per-task-type model routing recommendations based on builder quality scores' })
  @ApiResponse({ status: 200, description: 'Routing recommendations data' })
  @ApiResponse({ status: 503, description: 'Analytics unavailable' })
  @Get('analytics/routing-recommendations')
  public getAnalyticsRoutingRecommendations(): { recommendations: object[]; total: number } {
    const rows = this.cortexService.getRoutingRecommendations();
    if (rows === null) {
      throw new ServiceUnavailableException({ error: 'Analytics unavailable' });
    }
    const recommendations = rows.map(r => ({
      taskType: r.task_type,
      recommendedModel: r.recommended_model,
      reason: r.reason,
      avgBuilderScore: r.avg_builder_score,
      avgDurationMinutes: r.avg_duration_minutes,
      evidenceCount: r.evidence_count,
    }));
    return { recommendations, total: recommendations.length };
  }

  @ApiTags('reports')
  @ApiOperation({ summary: 'Get analytics reports overview', description: 'Returns session, success, cost, model, and quality reports for the selected date range' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Reports overview payload' })
  @ApiResponse({ status: 500, description: 'Reports unavailable' })
  @Get('reports/overview')
  public async getReportsOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ReturnType<ReportsService['getOverview']>> {
    try {
      return await this.reportsService.getOverview(from ?? null, to ?? null);
    } catch (err) {
      this.logger.error('Reports overview failed:', err);
      throw new InternalServerErrorException({ error: 'Reports unavailable' });
    }
  }

  // === Orchestration Flows ===

  @ApiTags('orchestration')
  @ApiOperation({ summary: 'Get orchestration flows', description: 'Returns all built-in orchestration flow definitions' })
  @ApiResponse({ status: 200, description: 'Orchestration flow list' })
  @Get('orchestration/flows')
  public getOrchestrationFlows(): ReturnType<OrchestrationFlowsService['getAllFlows']> {
    return this.orchestrationFlowsService.getAllFlows();
  }

  @ApiTags('orchestration')
  @ApiOperation({ summary: 'Get orchestration flow by ID', description: 'Returns a single orchestration flow definition' })
  @ApiParam({ name: 'id', description: 'Flow ID', example: 'feature' })
  @ApiResponse({ status: 200, description: 'Orchestration flow' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  @Get('orchestration/flows/:id')
  public getOrchestrationFlow(@Param('id') id: string): ReturnType<OrchestrationFlowsService['getFlowById']> {
    const flow = this.orchestrationFlowsService.getFlowById(id);
    if (!flow) {
      throw new NotFoundException({ error: 'Flow not found' });
    }
    return flow;
  }

  @ApiTags('orchestration')
  @ApiOperation({ summary: 'Clone orchestration flow', description: 'Creates a custom flow clone from a built-in flow' })
  @ApiBody({ schema: { properties: { sourceFlowId: { type: 'string' }, customName: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'Flow cloned successfully' })
  @ApiResponse({ status: 404, description: 'Source flow not found' })
  @Post('orchestration/flows/clone')
  @HttpCode(HttpStatus.CREATED)
  public cloneOrchestrationFlow(
    @Body() body: { sourceFlowId: string; customName: string },
  ): { success: boolean; flow: ReturnType<OrchestrationFlowsService['cloneFlow']> } {
    if (!body.sourceFlowId || !body.customName) {
      throw new BadRequestException({ error: 'sourceFlowId and customName are required' });
    }
    const flow = this.orchestrationFlowsService.cloneFlow(body.sourceFlowId, body.customName);
    if (!flow) {
      throw new NotFoundException({ error: 'Source flow not found' });
    }
    return { success: true, flow };
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
  @ApiOperation({ summary: 'Update cortex task fields', description: 'Updates model, preferred_provider, or worker_mode for a task' })
  @ApiParam({ name: 'id', description: 'Task ID', example: 'TASK_2026_001' })
  @ApiBody({ schema: { properties: { model: { type: 'string', nullable: true }, preferred_provider: { type: 'string', nullable: true }, worker_mode: { type: 'string', nullable: true } } } })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 400, description: 'Invalid task ID format or no valid fields' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
  @Patch('cortex/tasks/:id')
  @HttpCode(HttpStatus.OK)
  public patchCortexTask(
    @Param('id') id: string,
    @Body() body: { model?: string | null; preferred_provider?: string | null; worker_mode?: string | null },
  ): { taskId: string; updated: boolean } {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    if (!this.cortexService.isAvailable()) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    const fields: Parameters<CortexService['updateTask']>[1] = {};
    const ALLOWED_WORKER_MODES = new Set(['single', 'split']);
    const ALLOWED_PROVIDERS = new Set(['claude', 'glm', 'opencode', 'codex']);
    if ('model' in body) fields.model = body.model ?? null;
    if ('preferred_provider' in body) {
      if (body.preferred_provider !== null && !ALLOWED_PROVIDERS.has(body.preferred_provider ?? '')) {
        throw new BadRequestException({ error: 'Invalid preferred_provider value' });
      }
      fields.preferred_provider = body.preferred_provider ?? null;
    }
    if ('worker_mode' in body) {
      if (body.worker_mode !== null && !ALLOWED_WORKER_MODES.has(body.worker_mode ?? '')) {
        throw new BadRequestException({ error: 'Invalid worker_mode value' });
      }
      fields.worker_mode = body.worker_mode ?? null;
    }
    if (Object.keys(fields).length === 0) {
      throw new BadRequestException({ error: 'No valid fields to update' });
    }
    const result = this.cortexService.updateTask(id, fields);
    if (result === null) {
      throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
    }
    if (!result) {
      throw new NotFoundException({ error: 'Task not found' });
    }
    return { taskId: id, updated: true };
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
    if (!SESSION_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid session ID format' });
    }
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

  // === MCP Server Management ===

  @ApiTags('mcp')
  @ApiOperation({ summary: 'List MCP servers', description: 'Returns all MCP servers from ~/.claude/mcp_config.json and project .mcp.json' })
  @ApiResponse({ status: 200, description: 'MCP server list' })
  @Get('mcp/servers')
  public getMcpServers(): McpServerEntry[] {
    return this.mcpService.listServers(resolveProjectRoot());
  }

  @ApiTags('mcp')
  @ApiOperation({ summary: 'Install MCP server', description: 'Adds a new MCP server to ~/.claude/mcp_config.json. Provide either package (npm) or path (local).' })
  @ApiBody({ schema: { properties: { name: { type: 'string' }, package: { type: 'string' }, path: { type: 'string' }, args: { type: 'array', items: { type: 'string' } }, env: { type: 'object' } } } })
  @ApiResponse({ status: 201, description: 'Server installed' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @Post('mcp/servers')
  @HttpCode(HttpStatus.CREATED)
  public installMcpServer(@Body() body: McpInstallRequest): McpServerEntry {
    if (!body.name || !isValidServerName(body.name)) {
      throw new BadRequestException({ error: 'name is required and must be alphanumeric (hyphens, underscores, dots allowed, max 64 chars)' });
    }
    if (!body.package && !body.path) {
      throw new BadRequestException({ error: 'Either package (npm package name) or path (local file path) is required' });
    }
    if (body.package && typeof body.package !== 'string') {
      throw new BadRequestException({ error: 'package must be a string' });
    }
    if (body.path && typeof body.path !== 'string') {
      throw new BadRequestException({ error: 'path must be a string' });
    }
    try {
      return this.mcpService.installServer(body);
    } catch (err) {
      this.logger.error('Failed to install MCP server:', err);
      throw new InternalServerErrorException({ error: 'Failed to write MCP config' });
    }
  }

  @ApiTags('mcp')
  @ApiOperation({ summary: 'Remove MCP server', description: 'Removes an MCP server from ~/.claude/mcp_config.json' })
  @ApiParam({ name: 'id', description: 'Server name/ID', example: 'playwright' })
  @ApiResponse({ status: 200, description: 'Server removed' })
  @ApiResponse({ status: 400, description: 'Invalid server ID' })
  @ApiResponse({ status: 404, description: 'Server not found in user config' })
  @Delete('mcp/servers/:id')
  @HttpCode(HttpStatus.OK)
  public removeMcpServer(@Param('id') id: string): { id: string; removed: boolean } {
    if (!isValidServerName(id)) {
      throw new BadRequestException({ error: 'Invalid server ID' });
    }
    const removed = this.mcpService.removeServer(id);
    if (!removed) {
      throw new NotFoundException({ error: 'Server not found in user config (project-level servers are read-only)' });
    }
    return { id, removed: true };
  }

  @ApiTags('mcp')
  @ApiOperation({ summary: 'Restart MCP server', description: 'Signals that an MCP server should restart. Takes effect on the next Claude Code connection.' })
  @ApiParam({ name: 'id', description: 'Server name/ID', example: 'playwright' })
  @ApiResponse({ status: 200, description: 'Restart acknowledged' })
  @ApiResponse({ status: 400, description: 'Invalid server ID' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @Post('mcp/servers/:id/restart')
  @HttpCode(HttpStatus.OK)
  public restartMcpServer(@Param('id') id: string): { id: string; action: string; note: string } {
    if (!isValidServerName(id)) {
      throw new BadRequestException({ error: 'Invalid server ID' });
    }
    const servers = this.mcpService.listServers(resolveProjectRoot());
    const exists = servers.some((s) => s.id === id);
    if (!exists) {
      throw new NotFoundException({ error: 'Server not found' });
    }
    // stdio MCP servers are managed by Claude Code; restart takes effect on next connection
    return { id, action: 'restart_requested', note: 'Restart will take effect on the next Claude Code session' };
  }

  @ApiTags('mcp')
  @ApiOperation({ summary: 'Get MCP tool access matrix', description: 'Returns a matrix of agent × MCP server access for all configured servers' })
  @ApiResponse({ status: 200, description: 'Tool access matrix' })
  @Get('mcp/tool-access')
  public getMcpToolAccess(): McpToolAccessMatrix {
    return this.mcpService.getToolAccess(resolveProjectRoot());
  }

}
