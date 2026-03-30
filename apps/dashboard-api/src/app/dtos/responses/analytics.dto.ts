/**
 * Analytics DTOs for API responses.
 * Contains cost, efficiency, model usage, and session comparison analytics.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Session analytics summary (from session-analytics.md files).
 */
export class SessionAnalyticsDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID for this analytics record',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 'COMPLETE',
    description: 'Session outcome (COMPLETE, IMPLEMENTED, FAILED, STUCK)',
  })
  public readonly outcome!: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'ISO 8601 start time of the session',
  })
  public readonly startTime!: string;

  @ApiProperty({
    example: '2024-01-15T10:45:00.000Z',
    description: 'ISO 8601 end time of the session',
  })
  public readonly endTime!: string;

  @ApiProperty({
    example: '45m',
    description: 'Total session duration',
  })
  public readonly duration!: string;

  @ApiProperty({
    type: [String],
    example: ['PM', 'Architect', 'Dev', 'QA'],
    description: 'Phases completed during this session',
  })
  public readonly phasesCompleted!: ReadonlyArray<string>;

  @ApiProperty({
    example: 12,
    nullable: true,
    description: 'Number of files modified (null if unknown)',
  })
  public readonly filesModified!: number | null;
}

/**
 * Cost data point for a single session.
 */
export class SessionCostPointDto {
  @ApiProperty({
    example: 'SESSION_2026-03-15_10-30-00',
    description: 'Session identifier',
  })
  public readonly sessionId!: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Date of the session (YYYY-MM-DD)',
  })
  public readonly date!: string;

  @ApiProperty({
    example: 8.5,
    description: 'Total cost in USD for this session',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: { 'claude-sonnet-4': 7.0, 'claude-haiku-4': 1.5 },
    description: 'Cost breakdown by model',
  })
  public readonly costByModel!: Record<string, number>;

  @ApiProperty({
    example: 5,
    description: 'Number of tasks processed in this session',
  })
  public readonly taskCount!: number;
}

/**
 * Efficiency metrics for a single session.
 */
export class EfficiencyPointDto {
  @ApiProperty({
    example: 'SESSION_2026-03-15_10-30-00',
    description: 'Session identifier',
  })
  public readonly sessionId!: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Date of the session (YYYY-MM-DD)',
  })
  public readonly date!: string;

  @ApiProperty({
    example: 45.5,
    description: 'Average task duration in minutes',
  })
  public readonly avgDurationMinutes!: number;

  @ApiProperty({
    example: 250000,
    description: 'Average token count per task',
  })
  public readonly avgTokensPerTask!: number;

  @ApiProperty({
    example: 0.1,
    description: 'Retry rate as decimal (0.0 to 1.0)',
  })
  public readonly retryRate!: number;

  @ApiProperty({
    example: 0.05,
    description: 'Failure rate as decimal (0.0 to 1.0)',
  })
  public readonly failureRate!: number;

  @ApiProperty({
    example: 8.2,
    description: 'Average review score (0.0 to 10.0)',
  })
  public readonly avgReviewScore!: number;
}

/**
 * Model usage statistics across all sessions.
 */
export class ModelUsagePointDto {
  @ApiProperty({
    example: 'claude-sonnet-4-20250514',
    description: 'Model identifier',
  })
  public readonly model!: string;

  @ApiProperty({
    example: 100.0,
    description: 'Total cost in USD for this model',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: 85,
    description: 'Number of tasks processed with this model',
  })
  public readonly taskCount!: number;

  @ApiProperty({
    example: 4000000,
    description: 'Total tokens consumed by this model',
  })
  public readonly tokenCount!: number;
}

/**
 * Session comparison row for tabular analytics view.
 */
export class SessionComparisonRowDto {
  @ApiProperty({
    example: 'SESSION_2026-03-15_10-30-00',
    description: 'Session identifier',
  })
  public readonly sessionId!: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Date of the session (YYYY-MM-DD)',
  })
  public readonly date!: string;

  @ApiProperty({
    example: 5,
    description: 'Number of tasks processed',
  })
  public readonly taskCount!: number;

  @ApiProperty({
    example: 240,
    description: 'Total session duration in minutes',
  })
  public readonly durationMinutes!: number;

  @ApiProperty({
    example: 42.5,
    description: 'Total cost in USD for this session',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: 1,
    description: 'Number of task failures in this session',
  })
  public readonly failureCount!: number;

  @ApiProperty({
    example: 8.5,
    description: 'Average review score (0.0 to 10.0)',
  })
  public readonly avgReviewScore!: number;
}

/**
 * Cost analytics data aggregating all session cost points.
 */
export class AnalyticsCostDataDto {
  @ApiProperty({
    type: [SessionCostPointDto],
    description: 'Cost data points for each session',
  })
  public readonly sessions!: ReadonlyArray<SessionCostPointDto>;

  @ApiProperty({
    example: 350.0,
    description: 'Total cumulative cost in USD',
  })
  public readonly cumulativeCost!: number;

  @ApiProperty({
    example: 1200.0,
    description: 'Hypothetical cost if Opus was used for all tasks',
  })
  public readonly hypotheticalOpusCost!: number;
}

/**
 * Efficiency analytics data aggregating all session efficiency points.
 */
export class AnalyticsEfficiencyDataDto {
  @ApiProperty({
    type: [EfficiencyPointDto],
    description: 'Efficiency data points for each session',
  })
  public readonly sessions!: ReadonlyArray<EfficiencyPointDto>;
}

/**
 * Model usage analytics aggregating usage across all models.
 */
export class AnalyticsModelsDataDto {
  @ApiProperty({
    type: [ModelUsagePointDto],
    description: 'Usage breakdown by model',
  })
  public readonly models!: ReadonlyArray<ModelUsagePointDto>;

  @ApiProperty({
    example: 350.0,
    description: 'Total cost in USD across all models',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: 1200.0,
    description: 'Hypothetical cost if Opus was used exclusively',
  })
  public readonly hypotheticalOpusCost!: number;

  @ApiProperty({
    example: 850.0,
    description: 'Actual savings vs hypothetical Opus cost',
  })
  public readonly actualSavings!: number;
}

/**
 * Session comparison analytics data.
 */
export class AnalyticsSessionsDataDto {
  @ApiProperty({
    type: [SessionComparisonRowDto],
    description: 'Comparison rows for each session',
  })
  public readonly sessions!: ReadonlyArray<SessionComparisonRowDto>;
}
