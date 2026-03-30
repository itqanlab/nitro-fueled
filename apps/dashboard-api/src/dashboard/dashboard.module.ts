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

@Module({
  controllers: [DashboardController],
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
  ],
  exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService, CortexService],
})
export class DashboardModule {}
