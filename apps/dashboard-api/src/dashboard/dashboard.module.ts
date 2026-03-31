import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PipelineService } from './pipeline.service';
import { SessionsService } from './sessions.service';
import { SessionsHistoryService } from './sessions-history.service';
import { AnalyticsService } from './analytics.service';
import { WatcherService } from './watcher.service';
import { DiffService } from './diff.service';
import { WorkerTreeService } from './worker-tree.service';
import { DashboardGateway } from './dashboard.gateway';
import { CortexService } from './cortex.service';
import { WsAuthGuard } from './auth/ws-auth.guard';
import { OrchestrationFlowsService } from './orchestration-flows.service';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { ReportsService } from './reports.service';
import { ProgressCenterService } from './progress-center.service';
import { CommandConsoleController } from './command-console.controller';
import { CommandConsoleService } from './command-console.service';

@Module({
  imports: [OrchestrationModule],
  controllers: [DashboardController, LogsController, CommandConsoleController],
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
    SessionsHistoryService,
    {
      provide: ReportsService,
      useFactory: (cortexService: CortexService) => new ReportsService(cortexService, process.cwd()),
      inject: [CortexService],
    },
    WsAuthGuard,
    OrchestrationFlowsService,
    LogsService,
    ProgressCenterService,
    CommandConsoleService,
  ],
  exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService, CortexService, SessionsHistoryService, ReportsService, OrchestrationFlowsService, LogsService, ProgressCenterService, CommandConsoleService, DashboardGateway],
})
export class DashboardModule {}
