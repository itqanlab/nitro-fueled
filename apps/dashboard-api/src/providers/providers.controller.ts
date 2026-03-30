import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProvidersService, ProviderQuotaItem } from './providers.service';

@ApiTags('providers')
@Controller('api/providers')
export class ProvidersController {
  private readonly logger = new Logger(ProvidersController.name);

  public constructor(private readonly providersService: ProvidersService) {}

  @Get('quota')
  @ApiOperation({ summary: 'Get per-provider subscription quota usage' })
  public async getQuota(): Promise<ProviderQuotaItem[]> {
    try {
      return await this.providersService.getQuota();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to get provider quota: ${message.slice(0, 200)}`);
      return [
        { provider: 'glm', unavailable: true, reason: 'Failed to fetch quota' },
        { provider: 'anthropic', unavailable: true, reason: 'Failed to fetch quota' },
        { provider: 'openai', unavailable: true, reason: 'Failed to fetch quota' },
      ];
    }
  }
}
