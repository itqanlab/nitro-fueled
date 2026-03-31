import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CommandConsoleService,
  CommandCatalogEntry,
  CommandSuggestion,
  CommandExecuteResult,
} from './command-console.service';
import { ExecuteCommandDto } from './dto/execute-command.dto';
import { GetSuggestionsDto } from './dto/get-suggestions.dto';

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
  @ApiResponse({ status: 200, description: 'Command suggestions' })
  public getSuggestions(@Query() query: GetSuggestionsDto): readonly CommandSuggestion[] {
    return this.commandConsoleService.getSuggestions(query.route, query.taskId);
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a console command', description: 'Execute a supported Nitro command through the controlled adapter layer' })
  @ApiResponse({ status: 200, description: 'Command execution result' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  public async execute(@Body() dto: ExecuteCommandDto): Promise<CommandExecuteResult> {
    this.logger.log(`Console execute: ${dto.command.split(/\s+/, 1)[0]}`);
    return this.commandConsoleService.executeCommand({ command: dto.command, args: dto.args });
  }
}
