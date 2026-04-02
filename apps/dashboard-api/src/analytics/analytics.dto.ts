/**
 * DTOs for the analytics endpoints (model performance, launcher metrics, routing recommendations).
 */

import { ApiProperty } from '@nestjs/swagger';

// ============================================================
// Model Performance
// ============================================================

export class ModelPerformanceRowDto {
  @ApiProperty({ example: 'claude-sonnet-4-6', description: 'Model identifier' })
  public readonly model!: string;

  @ApiProperty({ example: 'FEATURE', description: 'Task type for this row', nullable: true })
  public readonly taskType!: string | null;

  @ApiProperty({ example: 42, description: 'Number of phases this model participated in' })
  public readonly phaseCount!: number;

  @ApiProperty({ example: 18, description: 'Number of reviews this model performed as reviewer' })
  public readonly reviewCount!: number;

  @ApiProperty({ example: 14.5, description: 'Average phase duration in minutes', nullable: true })
  public readonly avgDurationMinutes!: number | null;

  @ApiProperty({ example: 1200000, description: 'Total input tokens consumed' })
  public readonly totalInputTokens!: number;

  @ApiProperty({ example: 480000, description: 'Total output tokens generated' })
  public readonly totalOutputTokens!: number;

  @ApiProperty({ example: 8.2, description: 'Average score given by this model when acting as reviewer (0–10)', nullable: true })
  public readonly avgReviewScore!: number | null;
}

export class ModelPerformanceResponseDto {
  @ApiProperty({ type: [ModelPerformanceRowDto], description: 'Performance rows, one per model × task_type combination' })
  public readonly data!: ReadonlyArray<ModelPerformanceRowDto>;

  @ApiProperty({ example: 3, description: 'Total number of rows' })
  public readonly total!: number;
}

// ============================================================
// Launcher Metrics
// ============================================================

export class LauncherMetricsDto {
  @ApiProperty({ example: 'claude-code', description: 'Launcher identifier' })
  public readonly launcher!: string;

  @ApiProperty({ example: 120, description: 'Total workers spawned with this launcher' })
  public readonly totalWorkers!: number;

  @ApiProperty({ example: 105, description: 'Workers that completed successfully' })
  public readonly completedCount!: number;

  @ApiProperty({ example: 8, description: 'Workers that failed or got stuck' })
  public readonly failedCount!: number;

  @ApiProperty({ example: 0.875, description: 'Completion rate (completedCount / totalWorkers)' })
  public readonly completionRate!: number;

  @ApiProperty({ example: 42.5, description: 'Total cost in USD across all workers' })
  public readonly totalCost!: number;

  @ApiProperty({ example: 8400000, description: 'Total input tokens consumed' })
  public readonly totalInputTokens!: number;

  @ApiProperty({ example: 3200000, description: 'Total output tokens generated' })
  public readonly totalOutputTokens!: number;
}

export class LauncherMetricsResponseDto {
  @ApiProperty({ type: [LauncherMetricsDto] })
  public readonly data!: ReadonlyArray<LauncherMetricsDto>;

  @ApiProperty({ example: 2 })
  public readonly total!: number;
}

// ============================================================
// Routing Recommendations
// ============================================================

export class RoutingRecommendationDto {
  @ApiProperty({ example: 'FEATURE', description: 'Task type this recommendation applies to' })
  public readonly taskType!: string;

  @ApiProperty({ example: 'claude-sonnet-4-6', description: 'Recommended model for this task type' })
  public readonly recommendedModel!: string;

  @ApiProperty({ example: 'Highest avg review score (8.5/10) across 12 phases', description: 'Human-readable reason for recommendation' })
  public readonly reason!: string;

  @ApiProperty({ example: 8.5, description: 'Average score received on work built by this model (0–10)', nullable: true })
  public readonly avgBuilderScore!: number | null;

  @ApiProperty({ example: 14.2, description: 'Average phase duration in minutes', nullable: true })
  public readonly avgDurationMinutes!: number | null;

  @ApiProperty({ example: 12, description: 'Number of phases used as evidence' })
  public readonly evidenceCount!: number;
}

export class RoutingRecommendationsResponseDto {
  @ApiProperty({ type: [RoutingRecommendationDto], description: 'One recommendation per task type' })
  public readonly recommendations!: ReadonlyArray<RoutingRecommendationDto>;

  @ApiProperty({ example: 4 })
  public readonly total!: number;
}

// ============================================================
// Skill Usage
// ============================================================

export class SkillUsageItemDto {
  @ApiProperty({ example: 'nitro-orchestration', description: 'Skill name' })
  public readonly skill!: string;

  @ApiProperty({ example: 42, description: 'Number of invocations in the period' })
  public readonly count!: number;

  @ApiProperty({ example: 3500, description: 'Average duration in milliseconds', nullable: true })
  public readonly avgDurationMs!: number | null;

  @ApiProperty({ example: '2026-03-31T14:22:00.000Z', description: 'ISO timestamp of last invocation', nullable: true })
  public readonly lastUsed!: string | null;
}

export class SkillUsageResponseDto {
  @ApiProperty({ type: [SkillUsageItemDto], description: 'Skill usage rows sorted by count descending' })
  public readonly data!: ReadonlyArray<SkillUsageItemDto>;

  @ApiProperty({ example: 8 })
  public readonly total!: number;
}
