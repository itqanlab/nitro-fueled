import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  CommandConsoleService,
  CommandCatalogEntry,
  CommandSuggestion,
  CommandExecuteRequest,
  CommandExecuteResult,
} from './command-console.service';

@ApiTags('command-console')
@Controller('api/command-console')
export class CommandConsoleController {
  private readonly logger = new Logger(CommandConsoleController.name);

  public constructor(private readonly commandConsoleService: CommandConsoleService) {}

  @Get('catalog')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get command catalog', description: 'Returns all available Nitro commands with descriptions and categories' })
  @ApiResponse({ status: 200, description: 'Command catalog' })
  public getCatalog(): readonly CommandCatalogEntry[] {
    return this.commandConsoleService.getCatalog();
  }

  @Get('suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get route-aware command suggestions', description: 'Returns suggested commands based on the current dashboard route and context' })
  @ApiQuery({ name: 'route', required: false, description: 'Current dashboard route path' })
  @ApiQuery({ name: 'taskId', required: false, description: 'Current task ID context' })
  @ApiResponse({ status: 200, description: 'Command suggestions' })
  public getSuggestions(
    @Query('route') route?: string,
    @Query('taskId') taskId?: string,
  ): readonly CommandSuggestion[] {
    if (taskId && !/^TASK_\d{4}_\d{3}$/.test(taskId)) {
      throw new BadRequestException('Invalid taskId format');
    }
    return this.commandConsoleService.getSuggestions(route, taskId);
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a console command', description: 'Execute a supported Nitro command through the controlled adapter layer' })
  @ApiResponse({ status: 200, description: 'Command execution result' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  public async execute(@Body() body: unknown): Promise<CommandExecuteResult> {
    if (typeof body !== 'object' || body === null) {
      throw new BadRequestException('Request body must be a JSON object');
    }
    const raw = body as Record<string, unknown>;
    if (typeof raw['command'] !== 'string' || raw['command'].trim().length === 0) {
      throw new BadRequestException('command is required and must be a non-empty string');
    }

    const request: CommandExecuteRequest = {
      command: (raw['command'] as string).trim(),
      args: typeof raw['args'] === 'object' && raw['args'] !== null
        ? raw['args'] as Record<string, unknown>
        : undefined,
    };

    this.logger.log(`Console execute: ${request.command}`);
    return this.commandConsoleService.executeCommand(request);
  }
}
