import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller({ version: '1' })
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check', description: 'Returns service health status' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'nitro-fueled-dashboard-api' };
  }
}
