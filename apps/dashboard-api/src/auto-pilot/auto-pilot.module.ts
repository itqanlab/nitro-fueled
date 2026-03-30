import { Module } from '@nestjs/common';
import { AutoPilotController } from './auto-pilot.controller';
import { AutoPilotService } from './auto-pilot.service';

@Module({
  controllers: [AutoPilotController],
  providers: [AutoPilotService],
})
export class AutoPilotModule {}
