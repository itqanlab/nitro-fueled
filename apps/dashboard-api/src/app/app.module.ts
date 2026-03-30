import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TasksModule } from '../tasks/tasks.module';
import { AutoPilotModule } from '../auto-pilot/auto-pilot.module';

@Module({
  imports: [DashboardModule, TasksModule, AutoPilotModule],
  controllers: [HealthController],
})
export class AppModule {}
