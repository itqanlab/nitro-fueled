import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UsePipes,
  ValidationPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FlowParsingService } from './flow-parsing.service';
import { FlowMetadataService } from './flow-metadata.service';
import { CustomFlowsService } from './custom-flows.service';
import {
  FlowDefinition,
  FlowWithMetadata,
  FlowListQuery,
  FlowListResponse,
  CreateFlowRequest,
  CreateFlowResponse,
  FlowMetrics,
  CreateCustomFlowDto,
  UpdateCustomFlowDto,
  CustomFlowPhaseRecord,
  TaskFlowOverrideRequest,
} from './types';

@Controller('api/dashboard/orchestration')
export class OrchestrationController {
  constructor(
    private readonly flowParsingService: FlowParsingService,
    private readonly flowMetadataService: FlowMetadataService,
    private readonly customFlowsService: CustomFlowsService,
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
   * Clone a flow to create a custom variant (persists to DB)
   */
  @Post('flows/clone')
  @UsePipes(new ValidationPipe({ transform: true }))
  async cloneFlow(@Body() request: CreateFlowRequest): Promise<CreateFlowResponse> {
    try {
      const flows = await this.flowParsingService.parseFlows();
      const sourceFlow = flows.find(flow => flow.id === request.sourceFlowId);

      if (!sourceFlow) {
        throw new HttpException('Source flow not found', HttpStatus.NOT_FOUND);
      }

      if (!request.customName || request.customName.trim() === '') {
        throw new HttpException('Custom flow name is required', HttpStatus.BAD_REQUEST);
      }

      const modifiedPhases = this.applyPhaseModifications(sourceFlow.phases, request.phaseModifications);
      const phases: CustomFlowPhaseRecord[] = modifiedPhases.map((p, i) => ({
        order: p.order ?? i + 1,
        agentName: p.agent?.name ?? '',
        agentTitle: p.agent?.title ?? '',
        optional: p.agent?.optional ?? false,
        estimatedDuration: p.estimatedDuration ?? 0,
        deliverables: p.deliverables ?? [],
      }));

      const created = this.customFlowsService.create({
        name: request.customName.trim(),
        description: request.customDescription,
        sourceFlowId: request.sourceFlowId,
        phases,
      });

      if (!created) {
        throw new HttpException('Failed to persist custom flow', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        flowId: created.id,
        flowName: created.name,
        createdAt: new Date(created.created_at),
        status: 'created',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to clone flow: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── Custom Flow CRUD ──────────────────────────────────────────────────────

  @Post('custom-flows')
  createCustomFlow(@Body() dto: CreateCustomFlowDto) {
    try {
      if (!dto.name?.trim()) {
        throw new HttpException('name is required', HttpStatus.BAD_REQUEST);
      }
      const result = this.customFlowsService.create(dto);
      if (!result) {
        throw new HttpException('Failed to create custom flow', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to create custom flow: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('custom-flows')
  listCustomFlows() {
    try {
      return this.customFlowsService.findAll();
    } catch (error) {
      throw new HttpException(`Failed to list custom flows: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('custom-flows/:id')
  getCustomFlowById(@Param('id') id: string) {
    try {
      const flow = this.customFlowsService.findOne(id);
      if (!flow) {
        throw new HttpException('Custom flow not found', HttpStatus.NOT_FOUND);
      }
      return flow;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to get custom flow: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('custom-flows/:id')
  updateCustomFlow(@Param('id') id: string, @Body() dto: UpdateCustomFlowDto) {
    try {
      const result = this.customFlowsService.update(id, dto);
      if (!result) {
        throw new HttpException('Custom flow not found', HttpStatus.NOT_FOUND);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to update custom flow: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('custom-flows/:id')
  deleteCustomFlow(@Param('id') id: string) {
    try {
      const deleted = this.customFlowsService.delete(id);
      if (!deleted) {
        throw new HttpException('Custom flow not found', HttpStatus.NOT_FOUND);
      }
      return null;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to delete custom flow: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('custom-flows/:id/phases')
  updateCustomFlowPhases(@Param('id') id: string, @Body() body: { phases: CustomFlowPhaseRecord[] }) {
    try {
      const result = this.customFlowsService.updatePhases(id, body.phases ?? []);
      if (!result) {
        throw new HttpException('Custom flow not found', HttpStatus.NOT_FOUND);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to update phases: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── Task flow override endpoints ──────────────────────────────────────────

  @Post('tasks/:taskId/flow-override')
  setFlowOverride(@Param('taskId') taskId: string, @Body() req: TaskFlowOverrideRequest) {
    try {
      if (!req.flowId) {
        throw new HttpException('flowId is required', HttpStatus.BAD_REQUEST);
      }
      const ok = this.customFlowsService.setTaskFlowOverride(taskId, req.flowId);
      if (!ok) {
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
      }
      return { taskId, flowId: req.flowId };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to set flow override: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('tasks/:taskId/flow-override')
  clearFlowOverride(@Param('taskId') taskId: string) {
    try {
      const ok = this.customFlowsService.setTaskFlowOverride(taskId, null);
      if (!ok) {
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
      }
      return { taskId, flowId: null };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(`Failed to clear flow override: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
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