import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PipelineService } from './pipeline.service';
import { SessionsService } from './sessions.service';
import { AnalyticsService } from './analytics.service';
import { WatcherService } from './watcher.service';
import { DiffService } from './diff.service';
import { WorkerTreeService } from './worker-tree.service';
import { DashboardGateway } from './dashboard.gateway';
import { CortexService } from './cortex.service';
import { WsAuthGuard } from './auth/ws-auth.guard';
import { OrchestrationFlowsService } from './orchestration-flows.service';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  controllers: [DashboardController, LogsController],
  providers: [
    DiffService,
    WorkerTreeService,
    PipelineService,
    SessionsService,
    {
      provide: AnalyticsService,
      useFactory: () => new AnalyticsService(process.cwd()),
    },
    WatcherService,
    DashboardGateway,
    CortexService,
    WsAuthGuard,
    OrchestrationFlowsService,
    LogsService,
  ],
  exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService, CortexService, OrchestrationFlowsService, LogsService],
})
export class DashboardModule {}
