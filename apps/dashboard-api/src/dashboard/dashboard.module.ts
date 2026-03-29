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

/**
 * DashboardModule registers all dashboard-related services, controllers, and gateways.
 * Migrated from dashboard-service to NestJS architecture (TASK_2026_087).
 * WebSocket gateway added (TASK_2026_088).
 */
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
  ],
  exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService, CortexService],
})
export class DashboardModule {}
