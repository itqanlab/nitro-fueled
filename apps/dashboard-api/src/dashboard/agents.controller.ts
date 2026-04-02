import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AgentsService, AgentEntry, CreateAgentDto, UpdateAgentDto } from './agents.service';

const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

function validateId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new BadRequestException(`Invalid id format: "${id}"`);
  }
}

@ApiTags('agents')
@Controller('api/agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  public constructor(private readonly agentsService: AgentsService) {}

  @ApiOperation({ summary: 'List all agents' })
  @ApiResponse({ status: 200, description: 'Array of agent entries' })
  @Get()
  public list(): AgentEntry[] {
    return this.agentsService.list();
  }

  @ApiOperation({ summary: 'Get agent by id' })
  @ApiResponse({ status: 200, description: 'Agent entry' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @Get(':id')
  public getById(@Param('id') id: string): AgentEntry {
    validateId(id);
    const agent = this.agentsService.getById(id);
    if (!agent) throw new NotFoundException(`Agent "${id}" not found`);
    return agent;
  }

  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({ status: 201, description: 'Created agent entry' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  public create(@Body() body: CreateAgentDto): AgentEntry {
    return this.agentsService.create(body);
  }

  @ApiOperation({ summary: 'Replace an agent' })
  @ApiResponse({ status: 200, description: 'Updated agent entry' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @Put(':id')
  public update(@Param('id') id: string, @Body() body: UpdateAgentDto): AgentEntry {
    validateId(id);
    const result = this.agentsService.update(id, body);
    if (!result) throw new NotFoundException(`Agent "${id}" not found`);
    return result;
  }

  @ApiOperation({ summary: 'Delete an agent' })
  @ApiResponse({ status: 200, description: 'Deletion result' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @Delete(':id')
  public delete(@Param('id') id: string): { success: boolean } {
    validateId(id);
    const deleted = this.agentsService.delete(id);
    if (!deleted) throw new NotFoundException(`Agent "${id}" not found`);
    return { success: true };
  }
}
