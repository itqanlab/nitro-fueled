import { Module } from '@nestjs/common';
import { AutoPilotController } from './auto-pilot.controller';
import { AutoPilotService } from './auto-pilot.service';
import { SupervisorService } from './supervisor.service';
import { SupervisorDbService } from './supervisor-db.service';
import { WorkerManagerService } from './worker-manager.service';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  controllers: [AutoPilotController],
  providers: [
    AutoPilotService,
    SupervisorService,
    SupervisorDbService,
    WorkerManagerService,
    PromptBuilderService,
  ],
  exports: [AutoPilotService, SupervisorService],
})
export class AutoPilotModule {}
