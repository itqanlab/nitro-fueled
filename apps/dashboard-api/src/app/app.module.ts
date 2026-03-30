import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DashboardModule } from '../dashboard/dashboard.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [DashboardModule, TasksModule],
  controllers: [HealthController],
})
export class AppModule {}
