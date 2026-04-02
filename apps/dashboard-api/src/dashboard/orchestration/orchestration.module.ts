import { Module } from '@nestjs/common';
import { OrchestrationController } from './orchestration.controller';
import { FlowParsingService } from './flow-parsing.service';
import { FlowMetadataService } from './flow-metadata.service';
import { CustomFlowsService } from './custom-flows.service';

/**
 * Orchestration module for dashboard API
 *
 * Provides endpoints for managing and visualizing orchestration flows
 */
@Module({
  controllers: [OrchestrationController],
  providers: [FlowParsingService, FlowMetadataService, CustomFlowsService],
  exports: [FlowParsingService, FlowMetadataService, CustomFlowsService],
})
export class OrchestrationModule {}