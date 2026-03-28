/**
 * Task dependency graph DTOs for API responses.
 * Contains nodes (tasks) and edges (dependencies) for graph visualization.
 */

import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task.enums';

/**
 * A single node in the task dependency graph.
 */
export class GraphNodeDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Task ID (node identifier)',
  })
  public readonly id!: string;

  @ApiProperty({
    example: 'Add authentication system',
    description: 'Task title',
  })
  public readonly title!: string;

  @ApiProperty({
    enum: TaskStatus,
    enumName: 'TaskStatus',
    example: TaskStatus.COMPLETE,
    description: 'Current task status',
  })
  public readonly status!: TaskStatus;

  @ApiProperty({
    example: 'FEATURE',
    description: 'Task type',
  })
  public readonly type!: string;

  @ApiProperty({
    example: 'P1-High',
    description: 'Task priority',
  })
  public readonly priority!: string;

  @ApiProperty({
    example: true,
    description: 'Whether this task has all dependencies satisfied',
  })
  public readonly isUnblocked!: boolean;
}

/**
 * A directed edge in the task dependency graph.
 * Represents a dependency relationship from one task to another.
 */
export class GraphEdgeDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Source task ID (dependency)',
  })
  public readonly from!: string;

  @ApiProperty({
    example: 'TASK_2026_005',
    description: 'Target task ID (dependent)',
  })
  public readonly to!: string;
}

/**
 * Complete task dependency graph with nodes and edges.
 */
export class GraphDataDto {
  @ApiProperty({
    type: [GraphNodeDto],
    description: 'All task nodes in the graph',
  })
  public readonly nodes!: ReadonlyArray<GraphNodeDto>;

  @ApiProperty({
    type: [GraphEdgeDto],
    description: 'Dependency edges between tasks',
  })
  public readonly edges!: ReadonlyArray<GraphEdgeDto>;
}
