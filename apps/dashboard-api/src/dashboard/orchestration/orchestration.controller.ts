import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  Param, 
  UsePipes, 
  ValidationPipe,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { FlowParsingService } from './flow-parsing.service';
import { FlowMetadataService } from './flow-metadata.service';
import { 
  FlowDefinition,
  FlowWithMetadata,
  FlowListQuery,
  FlowListResponse,
  CreateFlowRequest,
  CreateFlowResponse,
  FlowMetrics
} from './types';

@Controller('api/dashboard/orchestration')
export class OrchestrationController {
  constructor(
    private readonly flowParsingService: FlowParsingService,
    private readonly flowMetadataService: FlowMetadataService
  ) {}

  /**
   * Get all orchestration flows
   */
  @Get('flows')
  async getFlows(@Query() query: FlowListQuery): Promise<FlowListResponse> {
    try {
      // Parse base flow definitions
      const flows = await this.flowParsingService.parseFlows();
      
      // Get metadata for flows
      const flowIds = flows.map(flow => flow.id);
      const flowsWithMetadata = await this.flowMetadataService.getFlowsWithMetadata(flowIds);
      
      // Apply filters
      let filteredFlows = flowsWithMetadata;
      
      if (query.type) {
        filteredFlows = filteredFlows.filter(flow => flow.type === query.type);
      }
      
      if (query.isCustom !== undefined) {
        // For now, all flows are built-in (not custom)
        filteredFlows = query.isCustom 
          ? filteredFlows.filter(flow => flow.id.startsWith('custom-'))
          : filteredFlows.filter(flow => !flow.id.startsWith('custom-'));
      }
      
      // Apply sorting
      if (query.sortBy) {
        filteredFlows.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (query.sortBy) {
            case 'name':
              aValue = a.name;
              bValue = b.name;
              break;
            case 'executionCount':
              aValue = a.executionCount;
              bValue = b.executionCount;
              break;
            case 'successRate':
              aValue = a.successRate;
              bValue = b.successRate;
              break;
            case 'lastExecution':
              aValue = a.lastExecution?.getTime() || 0;
              bValue = b.lastExecution?.getTime() || 0;
              break;
            default:
              aValue = a.name;
              bValue = b.name;
          }
          
          if (aValue < bValue) return query.sortOrder === 'asc' ? -1 : 1;
          if (aValue > bValue) return query.sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }
      
      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || filteredFlows.length;
      const paginatedFlows = filteredFlows.slice(offset, offset + limit);
      
      const response: FlowListResponse = {
        flows: paginatedFlows,
        total: filteredFlows.length,
        query
      };
      
      return response;
    } catch (error) {
      throw new HttpException(
        `Failed to get flows: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get a specific flow by ID
   */
  @Get('flows/:id')
  async getFlow(@Param('id') flowId: string): Promise<FlowWithMetadata> {
    try {
      // Get base flow definition
      const flows = await this.flowParsingService.parseFlows();
      const baseFlow = flows.find(flow => flow.id === flowId);
      
      if (!baseFlow) {
        throw new HttpException('Flow not found', HttpStatus.NOT_FOUND);
      }
      
      // Get flow metadata
      const flowWithMetadata = await this.flowMetadataService.getFlowWithMetadata(flowId);
      
      if (!flowWithMetadata) {
        throw new HttpException('Flow metadata not found', HttpStatus.NOT_FOUND);
      }
      
      return flowWithMetadata;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get flow: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get flow metrics
   */
  @Get('metrics')
  async getMetrics(): Promise<FlowMetrics> {
    try {
      return await this.flowMetadataService.getFlowMetrics();
    } catch (error) {
      throw new HttpException(
        `Failed to get metrics: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get popular flows
   */
  @Get('flows/popular')
  async getPopularFlows(@Query('limit') limit?: number): Promise<FlowWithMetadata[]> {
    try {
      return await this.flowMetadataService.getPopularFlows(limit || 10);
    } catch (error) {
      throw new HttpException(
        `Failed to get popular flows: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get flow performance trends
   */
  @Get('flows/:id/trends')
  async getFlowTrends(
    @Param('id') flowId: string,
    @Query('days') days?: number
  ): Promise<any> {
    try {
      return await this.flowMetadataService.getFlowPerformanceTrends(
        flowId, 
        days || 30
      );
    } catch (error) {
      throw new HttpException(
        `Failed to get flow trends: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get flow health summary
   */
  @Get('health')
  async getHealthSummary(): Promise<any> {
    try {
      return await this.flowMetadataService.getFlowHealthSummary();
    } catch (error) {
      throw new HttpException(
        `Failed to get health summary: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Clone a flow to create a custom variant
   */
  @Post('flows/clone')
  @UsePipes(new ValidationPipe({ transform: true }))
  async cloneFlow(@Body() request: CreateFlowRequest): Promise<CreateFlowResponse> {
    try {
      // Validate source flow exists
      const flows = await this.flowParsingService.parseFlows();
      const sourceFlow = flows.find(flow => flow.id === request.sourceFlowId);
      
      if (!sourceFlow) {
        throw new HttpException('Source flow not found', HttpStatus.NOT_FOUND);
      }
      
      // Validate request
      if (!request.customName || request.customName.trim() === '') {
        throw new HttpException('Custom flow name is required', HttpStatus.BAD_REQUEST);
      }
      
      // Generate custom flow ID
      const customFlowId = `custom-${request.customName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      
      // Create custom flow (clone with modifications)
      const customFlow: FlowDefinition = {
        ...sourceFlow,
        id: customFlowId,
        name: request.customName,
        description: request.customDescription || sourceFlow.description,
        phases: this.applyPhaseModifications(sourceFlow.phases, request.phaseModifications)
      };
      
      // TODO: Save custom flow to database when custom flow storage is implemented
      // For now, just return success response
      
      const response: CreateFlowResponse = {
        flowId: customFlowId,
        flowName: customFlow.name,
        createdAt: new Date(),
        status: 'created'
      };
      
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to clone flow: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Apply phase modifications to flow phases
   */
  private applyPhaseModifications(
    phases: any[], 
    modifications?: { [phaseOrder: number]: any }
  ): any[] {
    if (!modifications) {
      return phases;
    }
    
    return phases.map(phase => {
      const modification = modifications[phase.order];
      if (!modification) {
        return phase;
      }
      
      return {
        ...phase,
        ...modification,
        agent: modification.agent ? { ...phase.agent, ...modification.agent } : phase.agent
      };
    });
  }
}