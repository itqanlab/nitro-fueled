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
import { ReportsService } from './reports.service';
import { ProgressCenterService } from './progress-center.service';

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
    {
      provide: ReportsService,
      useFactory: (cortexService: CortexService) => new ReportsService(cortexService, process.cwd()),
      inject: [CortexService],
    },
    WsAuthGuard,
    OrchestrationFlowsService,
    LogsService,
    ProgressCenterService,
  ],
  exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService, CortexService, ReportsService, OrchestrationFlowsService, LogsService, ProgressCenterService],
})
export class DashboardModule {}
