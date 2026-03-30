import { Module } from '@nestjs/common';
import { OrchestrationController } from './orchestration.controller';
import { FlowParsingService } from './flow-parsing.service';
import { FlowMetadataService } from './flow-metadata.service';

/**
 * Orchestration module for dashboard API
 * 
 * Provides endpoints for managing and visualizing orchestration flows
 */
@Module({
  controllers: [OrchestrationController],
  providers: [FlowParsingService, FlowMetadataService],
  exports: [FlowParsingService, FlowMetadataService]
})
export class OrchestrationModule {}