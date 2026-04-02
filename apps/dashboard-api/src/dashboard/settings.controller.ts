import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import type {
  ApiKeyEntry,
  LauncherEntry,
  SubscriptionEntry,
  ModelMapping,
} from './settings.service';

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function validateId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new BadRequestException(`Invalid id format: "${id}"`);
  }
}

@ApiTags('settings')
@Controller('api/settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  public constructor(private readonly settingsService: SettingsService) {}

  // ── API Keys ──────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, description: 'Array of API key entries' })
  @Get('api-keys')
  public listApiKeys(): ApiKeyEntry[] {
    return this.settingsService.listApiKeys();
  }

  @ApiOperation({ summary: 'Add a new API key' })
  @ApiResponse({ status: 201, description: 'Created API key entry' })
  @Post('api-keys')
  @HttpCode(HttpStatus.CREATED)
  public createApiKey(
    @Body()
    body: {
      label?: string;
      key: string;
      providerId?: string;
      provider: string;
      detectedModels?: string[];
    },
  ): ApiKeyEntry {
    return this.settingsService.createApiKey(body);
  }

  @ApiOperation({ summary: 'Partially update an API key' })
  @ApiResponse({ status: 200, description: 'Updated API key entry' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @Patch('api-keys/:id')
  public updateApiKey(
    @Param('id') id: string,
    @Body() patch: Partial<Omit<ApiKeyEntry, 'id'>>,
  ): ApiKeyEntry {
    validateId(id);
    const result = this.settingsService.updateApiKey(id, patch);
    if (!result) {
      throw new NotFoundException(`API key "${id}" not found`);
    }
    return result;
  }

  @ApiOperation({ summary: 'Delete an API key' })
  @ApiResponse({ status: 200, description: 'Deletion result' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @Delete('api-keys/:id')
  public deleteApiKey(@Param('id') id: string): { success: boolean } {
    validateId(id);
    const deleted = this.settingsService.deleteApiKey(id);
    if (!deleted) {
      throw new NotFoundException(`API key "${id}" not found`);
    }
    return { success: true };
  }

  @ApiOperation({ summary: 'Set active state for an API key' })
  @ApiResponse({ status: 200, description: 'Updated API key entry' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @Patch('api-keys/:id/active')
  public setApiKeyActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ): ApiKeyEntry {
    validateId(id);
    const result = this.settingsService.setApiKeyActive(id, body.isActive);
    if (!result) {
      throw new NotFoundException(`API key "${id}" not found`);
    }
    return result;
  }

  // ── Launchers ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all launchers' })
  @ApiResponse({ status: 200, description: 'Array of launcher entries' })
  @Get('launchers')
  public listLaunchers(): LauncherEntry[] {
    return this.settingsService.listLaunchers();
  }

  @ApiOperation({ summary: 'Add a new launcher' })
  @ApiResponse({ status: 201, description: 'Created launcher entry' })
  @Post('launchers')
  @HttpCode(HttpStatus.CREATED)
  public createLauncher(
    @Body() body: { name: string; type: 'cli' | 'ide' | 'desktop'; path: string },
  ): LauncherEntry {
    return this.settingsService.createLauncher(body);
  }

  @ApiOperation({ summary: 'Set active state for a launcher' })
  @ApiResponse({ status: 200, description: 'Updated launcher entry' })
  @ApiResponse({ status: 404, description: 'Launcher not found' })
  @ApiParam({ name: 'id', description: 'Launcher ID' })
  @Patch('launchers/:id/active')
  public setLauncherActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ): LauncherEntry {
    validateId(id);
    const result = this.settingsService.setLauncherActive(id, body.isActive);
    if (!result) {
      throw new NotFoundException(`Launcher "${id}" not found`);
    }
    return result;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all subscriptions' })
  @ApiResponse({ status: 200, description: 'Array of subscription entries' })
  @Get('subscriptions')
  public listSubscriptions(): SubscriptionEntry[] {
    return this.settingsService.listSubscriptions();
  }

  @ApiOperation({ summary: 'Connect a subscription' })
  @ApiResponse({ status: 200, description: 'Updated subscription entry' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @Post('subscriptions/:id/connect')
  public connectSubscription(@Param('id') id: string): SubscriptionEntry {
    validateId(id);
    const result = this.settingsService.connectSubscription(id);
    if (!result) {
      throw new NotFoundException(`Subscription "${id}" not found`);
    }
    return result;
  }

  @ApiOperation({ summary: 'Disconnect a subscription' })
  @ApiResponse({ status: 200, description: 'Updated subscription entry' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @Delete('subscriptions/:id/disconnect')
  public disconnectSubscription(@Param('id') id: string): SubscriptionEntry {
    validateId(id);
    const result = this.settingsService.disconnectSubscription(id);
    if (!result) {
      throw new NotFoundException(`Subscription "${id}" not found`);
    }
    return result;
  }

  // ── Model Mapping ─────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all model mappings' })
  @ApiResponse({ status: 200, description: 'Array of model mappings' })
  @Get('mapping')
  public listMappings(): ModelMapping[] {
    return this.settingsService.listMappings();
  }

  @ApiOperation({ summary: 'Replace all model mappings' })
  @ApiResponse({ status: 200, description: 'Updated array of model mappings' })
  @Put('mapping')
  public replaceMappings(@Body() mappings: ModelMapping[]): ModelMapping[] {
    return this.settingsService.replaceMappings(mappings);
  }
}
