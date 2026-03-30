import {
  Controller,
  Post,
  Body,
  BadRequestException,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TasksService, CreateTaskRequest, CreateTaskResponse } from './tasks.service';

const VALID_TYPES = ['FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION', 'RESEARCH', 'DEVOPS', 'CREATIVE', 'CONTENT'] as const;
const VALID_PRIORITIES = ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'] as const;
const VALID_COMPLEXITIES = ['Simple', 'Medium', 'Complex'] as const;

const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_DEPENDENCY_COUNT = 20;

@ApiTags('tasks')
@Controller('api/tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  public constructor(private readonly tasksService: TasksService) {}

  @Post('create')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create one or more tasks from a natural-language description' })
  @ApiResponse({ status: 201, description: 'Task(s) created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  public create(@Body() body: unknown): CreateTaskResponse {
    const req = this.validateBody(body);
    this.logger.log(`Creating task: "${req.description.slice(0, 60)}..."`);
    return this.tasksService.create(req);
  }

  private validateBody(body: unknown): CreateTaskRequest {
    if (typeof body !== 'object' || body === null) {
      throw new BadRequestException('Request body must be a JSON object');
    }

    const raw = body as Record<string, unknown>;

    if (typeof raw['description'] !== 'string' || raw['description'].trim().length === 0) {
      throw new BadRequestException('description is required and must be a non-empty string');
    }

    const description = raw['description'].trim();

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new BadRequestException(`description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`);
    }

    const req: CreateTaskRequest = { description };

    if (raw['overrides'] !== undefined) {
      if (typeof raw['overrides'] !== 'object' || raw['overrides'] === null) {
        throw new BadRequestException('overrides must be an object');
      }

      const overrides = raw['overrides'] as Record<string, unknown>;
      req.overrides = {};

      if (overrides['type'] !== undefined) {
        if (!(VALID_TYPES as readonly string[]).includes(overrides['type'] as string)) {
          throw new BadRequestException(`type must be one of: ${VALID_TYPES.join(', ')}`);
        }
        req.overrides.type = overrides['type'] as CreateTaskRequest['overrides']['type'];
      }

      if (overrides['priority'] !== undefined) {
        if (!(VALID_PRIORITIES as readonly string[]).includes(overrides['priority'] as string)) {
          throw new BadRequestException(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
        }
        req.overrides.priority = overrides['priority'] as CreateTaskRequest['overrides']['priority'];
      }

      if (overrides['complexity'] !== undefined) {
        if (!(VALID_COMPLEXITIES as readonly string[]).includes(overrides['complexity'] as string)) {
          throw new BadRequestException(`complexity must be one of: ${VALID_COMPLEXITIES.join(', ')}`);
        }
        req.overrides.complexity = overrides['complexity'] as CreateTaskRequest['overrides']['complexity'];
      }

      if (overrides['model'] !== undefined) {
        if (typeof overrides['model'] !== 'string' || overrides['model'].trim().length === 0) {
          throw new BadRequestException('model must be a non-empty string');
        }
        const model = overrides['model'].trim();
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(model)) {
          throw new BadRequestException('model must contain only alphanumeric characters, dots, underscores, or hyphens (max 128 chars)');
        }
        req.overrides.model = model;
      }

      if (overrides['dependencies'] !== undefined) {
        if (!Array.isArray(overrides['dependencies'])) {
          throw new BadRequestException('dependencies must be an array');
        }
        if (overrides['dependencies'].length > MAX_DEPENDENCY_COUNT) {
          throw new BadRequestException(`dependencies must not exceed ${MAX_DEPENDENCY_COUNT} items`);
        }
        const deps = overrides['dependencies'];
        for (const dep of deps) {
          if (typeof dep !== 'string') {
            throw new BadRequestException('each dependency must be a string');
          }
        }
        req.overrides.dependencies = deps as string[];
      }
    }

    return req;
  }
}
