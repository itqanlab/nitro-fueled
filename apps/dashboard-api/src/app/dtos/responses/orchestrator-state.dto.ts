/**
 * Orchestrator state DTO for API responses.
 * Contains the main OrchestratorStateDto which aggregates all state components.
 */

import { ApiProperty } from '@nestjs/swagger';
import { ActiveWorkerDto } from './active-worker.dto';
import {
  CompletedTaskDto,
  FailedTaskDto,
  LogEntryDto,
  TaskQueueItemDto,
  RetryTrackerDto,
  ConfigurationDto,
} from './worker-state.dto';

/**
 * Complete orchestrator state including workers, tasks, and configuration.
 */
export class OrchestratorStateDto {
  @ApiProperty({
    example: 'running',
    description: 'Current loop status (e.g., running, paused, stopped)',
  })
  public readonly loopStatus!: string;

  @ApiProperty({
    example: '2024-01-15T10:45:00.000Z',
    description: 'ISO 8601 timestamp of last state update',
  })
  public readonly lastUpdated!: string;

  @ApiProperty({
    example: '2024-01-15T10:00:00.000Z',
    description: 'ISO 8601 timestamp when session started',
  })
  public readonly sessionStarted!: string;

  @ApiProperty({
    type: ConfigurationDto,
    description: 'Orchestrator configuration settings',
  })
  public readonly configuration!: ConfigurationDto;

  @ApiProperty({
    type: [ActiveWorkerDto],
    description: 'Currently active workers',
  })
  public readonly activeWorkers!: ReadonlyArray<ActiveWorkerDto>;

  @ApiProperty({
    type: [CompletedTaskDto],
    description: 'Tasks completed in this session',
  })
  public readonly completedTasks!: ReadonlyArray<CompletedTaskDto>;

  @ApiProperty({
    type: [FailedTaskDto],
    description: 'Tasks that failed in this session',
  })
  public readonly failedTasks!: ReadonlyArray<FailedTaskDto>;

  @ApiProperty({
    type: [TaskQueueItemDto],
    description: 'Tasks waiting to be processed',
  })
  public readonly taskQueue!: ReadonlyArray<TaskQueueItemDto>;

  @ApiProperty({
    type: [RetryTrackerDto],
    description: 'Retry tracking for failed tasks',
  })
  public readonly retryTracker!: ReadonlyArray<RetryTrackerDto>;

  @ApiProperty({
    type: [LogEntryDto],
    description: 'Session log entries',
  })
  public readonly sessionLog!: ReadonlyArray<LogEntryDto>;

  @ApiProperty({
    example: 2,
    description: 'Number of compaction cycles performed',
  })
  public readonly compactionCount!: number;
}

// Re-export all worker state DTOs for convenience
export { ActiveWorkerDto } from './active-worker.dto';
export {
  CompletedTaskDto,
  FailedTaskDto,
  LogEntryDto,
  TaskQueueItemDto,
  RetryTrackerDto,
  ConfigurationDto,
} from './worker-state.dto';
