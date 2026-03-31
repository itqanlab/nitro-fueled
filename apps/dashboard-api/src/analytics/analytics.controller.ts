import { Controller, Get, Param, Query, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import type {
  ModelPerformanceResponseDto,
  LauncherMetricsResponseDto,
  RoutingRecommendationsResponseDto,
} from './analytics.dto';

@ApiTags('analytics')
@Controller('api/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  public constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('model-performance')
  @ApiOperation({ summary: 'Full model × task_type performance matrix' })
  @ApiQuery({ name: 'taskType', required: false, description: 'Filter by task type (e.g. FEATURE, BUGFIX)' })
  public getModelPerformance(
    @Query('taskType') taskType?: string,
  ): ModelPerformanceResponseDto {
    const result = this.analyticsService.getModelPerformance(taskType ? { taskType } : undefined);
    if (!result) {
      this.logger.warn('getModelPerformance: cortex DB unavailable');
      throw new ServiceUnavailableException('Cortex DB is not available');
    }
    return result;
  }

  @Get('model-performance/:modelId')
  @ApiOperation({ summary: 'Per-model performance breakdown across all task types' })
  @ApiParam({ name: 'modelId', description: 'Model identifier (e.g. claude-sonnet-4-6)', example: 'claude-sonnet-4-6' })
  public getModelPerformanceById(
    @Param('modelId') modelId: string,
  ): ModelPerformanceResponseDto {
    const result = this.analyticsService.getModelPerformanceById(modelId);
    if (!result) {
      this.logger.warn(`getModelPerformanceById(${modelId}): cortex DB unavailable`);
      throw new ServiceUnavailableException('Cortex DB is not available');
    }
    return result;
  }

  @Get('launcher/:launcherId')
  @ApiOperation({ summary: 'Per-launcher worker metrics (cost, tokens, completion rate)' })
  @ApiParam({ name: 'launcherId', description: 'Launcher identifier (e.g. claude-code)', example: 'claude-code' })
  public getLauncherMetrics(
    @Param('launcherId') launcherId: string,
  ): LauncherMetricsResponseDto {
    const result = this.analyticsService.getLauncherMetrics(launcherId);
    if (!result) {
      this.logger.warn(`getLauncherMetrics(${launcherId}): cortex DB unavailable`);
      throw new ServiceUnavailableException('Cortex DB is not available');
    }
    return result;
  }

  @Get('routing-recommendations')
  @ApiOperation({ summary: 'Model routing recommendations per task type, derived from performance data' })
  public getRoutingRecommendations(): RoutingRecommendationsResponseDto {
    const result = this.analyticsService.getRoutingRecommendations();
    if (!result) {
      this.logger.warn('getRoutingRecommendations: cortex DB unavailable');
      throw new ServiceUnavailableException('Cortex DB is not available');
    }
    return result;
  }
}
