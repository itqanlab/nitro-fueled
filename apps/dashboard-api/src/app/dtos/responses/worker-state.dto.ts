/**
 * Task and queue state DTOs for orchestrator state responses.
 * Contains completed/failed task, log, queue, retry, and configuration DTOs.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Completed task record in the orchestrator.
 */
export class CompletedTaskDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID that completed',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: '2024-01-15T11:00:00.000Z',
    description: 'ISO 8601 timestamp when task completed',
  })
  public readonly completedAt!: string;
}

/**
 * Failed task record in the orchestrator.
 */
export class FailedTaskDto {
  @ApiProperty({
    example: 'TASK_2026_005',
    description: 'Task ID that failed',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 'Maximum retry count exceeded',
    description: 'Reason for failure',
  })
  public readonly reason!: string;

  @ApiProperty({
    example: 3,
    description: 'Number of retry attempts made',
  })
  public readonly retryCount!: number;
}

/**
 * Log entry in the orchestrator session log.
 */
export class LogEntryDto {
  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO 8601 timestamp of the log entry',
  })
  public readonly timestamp!: string;

  @ApiProperty({
    example: 'Supervisor',
    description: 'Source component that generated the log',
  })
  public readonly source!: string;

  @ApiProperty({
    example: 'Worker spawned for TASK_2026_001',
    description: 'Log event description',
  })
  public readonly event!: string;
}

/**
 * Task queue item waiting to be processed.
 */
export class TaskQueueItemDto {
  @ApiProperty({
    example: 'TASK_2026_010',
    description: 'Task ID in the queue',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 'P1-High',
    description: 'Task priority',
  })
  public readonly priority!: string;

  @ApiProperty({
    example: 'FEATURE',
    description: 'Task type',
  })
  public readonly type!: string;

  @ApiProperty({
    example: 'Build',
    description: 'Worker type needed for this task',
  })
  public readonly workerType!: string;
}

/**
 * Retry tracker entry for failed tasks.
 */
export class RetryTrackerDto {
  @ApiProperty({
    example: 'TASK_2026_005',
    description: 'Task ID being tracked for retries',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 2,
    description: 'Current retry count',
  })
  public readonly retryCount!: number;
}

/**
 * Orchestrator configuration settings.
 */
export class ConfigurationDto {
  @ApiProperty({
    example: 3,
    description: 'Maximum number of concurrent workers',
  })
  public readonly concurrencyLimit!: number;

  @ApiProperty({
    example: '30s',
    description: 'Interval between monitoring cycles',
  })
  public readonly monitoringInterval!: string;

  @ApiProperty({
    example: 3,
    description: 'Maximum retry attempts for failed tasks',
  })
  public readonly retryLimit!: number;
}
