import { Module } from '@nestjs/common';
import { AutoPilotController } from './auto-pilot.controller';
import { AutoPilotService } from './auto-pilot.service';
import { SessionManagerService } from './session-manager.service';
import { SupervisorDbService } from './supervisor-db.service';
import { WorkerManagerService } from './worker-manager.service';
import { PromptBuilderService } from './prompt-builder.service';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [DashboardModule],
  controllers: [AutoPilotController],
  providers: [
    AutoPilotService,
    SessionManagerService,
    SupervisorDbService,
    WorkerManagerService,
    PromptBuilderService,
  ],
  exports: [AutoPilotService, SessionManagerService],
})
export class AutoPilotModule {}
