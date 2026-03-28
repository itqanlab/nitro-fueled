import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { PipelineService } from './pipeline.service';
import { SessionsService } from './sessions.service';
import { AnalyticsService } from './analytics.service';
import { WatcherService } from './watcher.service';

/**
 * DashboardModule registers all dashboard-related services and controllers.
 * Migrated from dashboard-service to NestJS architecture (TASK_2026_087).
 */
@Module({
  controllers: [DashboardController],
  providers: [
    PipelineService,
    SessionsService,
    {
      provide: AnalyticsService,
      useFactory: () => new AnalyticsService(process.cwd()),
    },
    WatcherService,
  ],
  exports: [PipelineService, SessionsService, AnalyticsService, WatcherService],
})
export class DashboardModule {}
