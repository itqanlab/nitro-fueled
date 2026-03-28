import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { SessionsService } from './sessions.service';
import { AnalyticsService } from './analytics.service';

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

/**
 * DashboardController — Internal dev-tool API.
 * Authentication: none required — this server is intended for local use only (127.0.0.1 bind).
 * DO NOT expose on a non-loopback interface without adding authentication.
 */
@Controller('api')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  public constructor(
    private readonly pipelineService: PipelineService,
    private readonly sessionsService: SessionsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // === Health ===

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

  @Get('registry')
  public getRegistry(): ReturnType<PipelineService['getRegistry']> {
    return this.pipelineService.getRegistry();
  }

  // === Plan ===

  @Get('plan')
  public getPlan(): ReturnType<PipelineService['getPlan']> | { error: string } {
    const plan = this.pipelineService.getPlan();
    return plan ?? { error: 'Plan not found' };
  }

  // === Orchestrator State ===

  @Get('state')
  public getState(): ReturnType<PipelineService['getOrchestratorState']> | { error: string } {
    const state = this.pipelineService.getOrchestratorState();
    return state ?? { error: 'Orchestrator state not found' };
  }

  // === Tasks ===

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

  @Get('tasks/:id/reviews')
  public getTaskReviews(@Param('id') id: string): ReturnType<PipelineService['getReviews']> {
    if (!TASK_ID_RE.test(id)) {
      throw new BadRequestException({ error: 'Invalid task ID format' });
    }
    return this.pipelineService.getReviews(id);
  }

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

  @Get('anti-patterns')
  public getAntiPatterns(): ReturnType<PipelineService['getAntiPatterns']> {
    return this.pipelineService.getAntiPatterns();
  }

  @Get('review-lessons')
  public getLessons(): ReturnType<PipelineService['getLessons']> {
    return this.pipelineService.getLessons();
  }

  // === Stats ===

  @Get('stats')
  public getStats(): ReturnType<PipelineService['getStats']> {
    return this.pipelineService.getStats();
  }

  // === Graph ===

  @Get('graph')
  public getGraph(): ReturnType<PipelineService['getGraph']> {
    return this.pipelineService.getGraph();
  }

  // === Workers ===

  @Get('workers/tree')
  public getWorkerTree(): ReturnType<PipelineService['getWorkerTree']> {
    return this.pipelineService.getWorkerTree();
  }

  // === Sessions ===

  @Get('sessions/active')
  public getActiveSessions(): ReturnType<SessionsService['getActiveSessions']> {
    return this.sessionsService.getActiveSessions();
  }

  @Get('sessions/:id')
  public getSession(@Param('id') id: string): ReturnType<SessionsService['getSession']> {
    const data = this.sessionsService.getSession(id);
    if (!data) {
      throw new NotFoundException({ error: 'Session not found' });
    }
    return data;
  }

  @Get('sessions')
  public getSessions(): ReturnType<SessionsService['getSessions']> {
    return this.sessionsService.getSessions();
  }

  // === Analytics ===

  @Get('analytics/cost')
  public async getAnalyticsCost(): Promise<ReturnType<AnalyticsService['getCostData']>> {
    try {
      return await this.analyticsService.getCostData();
    } catch (err) {
      this.logger.error('Analytics cost failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  @Get('analytics/efficiency')
  public async getAnalyticsEfficiency(): Promise<ReturnType<AnalyticsService['getEfficiencyData']>> {
    try {
      return await this.analyticsService.getEfficiencyData();
    } catch (err) {
      this.logger.error('Analytics efficiency failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  @Get('analytics/models')
  public async getAnalyticsModels(): Promise<ReturnType<AnalyticsService['getModelsData']>> {
    try {
      return await this.analyticsService.getModelsData();
    } catch (err) {
      this.logger.error('Analytics models failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }

  @Get('analytics/sessions')
  public async getAnalyticsSessions(): Promise<ReturnType<AnalyticsService['getSessionsData']>> {
    try {
      return await this.analyticsService.getSessionsData();
    } catch (err) {
      this.logger.error('Analytics sessions failed:', err);
      throw new InternalServerErrorException({ error: 'Analytics unavailable' });
    }
  }
}
