import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TasksModule } from '../tasks/tasks.module';
import { AutoPilotModule } from '../auto-pilot/auto-pilot.module';
import { ProvidersModule } from '../providers/providers.module';
import { HttpAuthGuard } from './auth';

@Module({
  imports: [DashboardModule, TasksModule, AutoPilotModule, ProvidersModule],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: HttpAuthGuard,
    },
  ],
})
export class AppModule {}
