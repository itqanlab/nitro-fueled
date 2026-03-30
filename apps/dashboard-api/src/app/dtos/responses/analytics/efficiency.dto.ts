/**
 * Analytics DTOs for efficiency-related responses.
 * Contains EfficiencyPointDto and AnalyticsEfficiencyDataDto.
 */

import { ApiProperty } from '@nestjs/swagger';

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
 * Efficiency analytics data aggregating all session efficiency points.
 */
export class AnalyticsEfficiencyDataDto {
  @ApiProperty({
    type: [EfficiencyPointDto],
    description: 'Efficiency data points for each session',
  })
  public readonly sessions!: ReadonlyArray<EfficiencyPointDto>;
}
