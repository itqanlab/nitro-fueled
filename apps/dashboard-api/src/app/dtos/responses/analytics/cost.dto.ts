/**
 * Analytics DTOs for cost-related responses.
 * Contains SessionCostPointDto and AnalyticsCostDataDto.
 */

import { ApiProperty } from '@nestjs/swagger';

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
