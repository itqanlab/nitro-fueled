import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [DashboardModule],
  controllers: [HealthController],
})
export class AppModule {}
