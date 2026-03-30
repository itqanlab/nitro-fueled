/**
 * Analytics DTOs for session-related responses.
 * Contains SessionAnalyticsDto and SessionComparisonRowDto.
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
