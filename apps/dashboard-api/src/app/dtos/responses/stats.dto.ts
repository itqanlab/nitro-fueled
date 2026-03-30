/**
 * Dashboard statistics DTO for API responses.
 * Contains aggregated task, cost, and token statistics.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Aggregated dashboard statistics across all tasks.
 */
export class DashboardStatsDto {
  @ApiProperty({
    example: 150,
    description: 'Total number of tasks in the registry',
  })
  public readonly totalTasks!: number;

  @ApiProperty({
    example: { COMPLETE: 90, IN_PROGRESS: 5, CREATED: 55 },
    description: 'Task count grouped by status',
  })
  public readonly byStatus!: Record<string, number>;

  @ApiProperty({
    example: { FEATURE: 80, BUGFIX: 30, REFACTORING: 20 },
    description: 'Task count grouped by type',
  })
  public readonly byType!: Record<string, number>;

  @ApiProperty({
    example: { 'claude-sonnet-4': 100, 'claude-haiku-4': 50 },
    description: 'Task count grouped by model',
  })
  public readonly byModel!: Record<string, number>;

  @ApiProperty({
    example: 0.6,
    description: 'Completion rate as a decimal (0.0 to 1.0)',
  })
  public readonly completionRate!: number;

  @ApiProperty({
    example: 3,
    description: 'Number of currently active workers',
  })
  public readonly activeWorkers!: number;

  @ApiProperty({
    example: 125.5,
    description: 'Total cost in USD across all sessions',
  })
  public readonly totalCost!: number;

  @ApiProperty({
    example: 5000000,
    description: 'Total tokens consumed across all sessions',
  })
  public readonly totalTokens!: number;

  @ApiProperty({
    example: { 'claude-sonnet-4': 100.0, 'claude-haiku-4': 25.5 },
    description: 'Cost in USD grouped by model',
  })
  public readonly costByModel!: Record<string, number>;

  @ApiProperty({
    example: { 'claude-sonnet-4': 4000000, 'claude-haiku-4': 1000000 },
    description: 'Token count grouped by model',
  })
  public readonly tokensByModel!: Record<string, number>;
}
