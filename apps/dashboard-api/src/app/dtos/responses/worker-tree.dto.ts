/**
 * Worker tree DTOs for API responses.
 * Contains the hierarchical worker tree structure for visualization.
 */

import { ApiProperty } from '@nestjs/swagger';
import { WorkerHealth } from '../enums/worker.enums';

/**
 * A single node in the worker tree hierarchy.
 * Supports recursive children for nested worker relationships.
 */
export class WorkerTreeNodeDto {
  @ApiProperty({
    example: 'WID_abc12345',
    description: 'Unique worker identifier',
  })
  public readonly workerId!: string;

  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID this worker is handling',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 'Build Worker — TASK_2026_001',
    description: 'Human-readable worker label',
  })
  public readonly label!: string;

  @ApiProperty({
    example: 'Build Worker',
    description: 'Worker role description',
  })
  public readonly role!: string;

  @ApiProperty({
    example: 'Build',
    description: 'Worker type (Build or Review)',
  })
  public readonly workerType!: string;

  @ApiProperty({
    example: 'running',
    description: 'Current worker status',
  })
  public readonly status!: string;

  @ApiProperty({
    enum: WorkerHealth,
    enumName: 'WorkerHealth',
    example: WorkerHealth.healthy,
    description: 'Worker health assessment',
  })
  public readonly health!: WorkerHealth;

  @ApiProperty({
    example: 300000,
    description: 'Elapsed time in milliseconds since worker spawned',
  })
  public readonly elapsedMs!: number;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO 8601 timestamp when worker was spawned',
  })
  public readonly spawnTime!: string;

  @ApiProperty({
    example: 0,
    description: 'Number of times this worker has been flagged as stuck',
  })
  public readonly stuckCount!: number;

  @ApiProperty({
    type: () => [WorkerTreeNodeDto],
    description: 'Child workers spawned by this worker',
  })
  public readonly children!: ReadonlyArray<WorkerTreeNodeDto>;
}

/**
 * Worker tree container for a task's complete worker hierarchy.
 */
export class WorkerTreeDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID for this worker tree',
  })
  public readonly taskId!: string;

  @ApiProperty({
    type: [WorkerTreeNodeDto],
    description: 'Root-level workers for this task',
  })
  public readonly roots!: ReadonlyArray<WorkerTreeNodeDto>;
}
