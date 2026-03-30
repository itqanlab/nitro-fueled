/**
 * Task record and task definition DTOs for API responses.
 * Converted from dashboard.types.ts interfaces to class-based DTOs with Swagger decorators.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TaskStatus,
  TaskType,
  TaskPriority,
  TaskComplexity,
} from '../enums/task.enums';

/**
 * Task map entry within a plan phase.
 * Represents a task summary in the phase's task list.
 */
export class PlanTaskMapDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Unique task identifier',
  })
  public readonly taskId!: string;

  @ApiProperty({
    example: 'Add authentication system',
    description: 'Task title',
  })
  public readonly title!: string;

  @ApiProperty({
    enum: TaskStatus,
    enumName: 'TaskStatus',
    example: TaskStatus.IN_PROGRESS,
    description: 'Current task status',
  })
  public readonly status!: TaskStatus;

  @ApiProperty({
    enum: TaskPriority,
    enumName: 'TaskPriority',
    example: TaskPriority.P1_HIGH,
    description: 'Task priority level',
  })
  public readonly priority!: TaskPriority;
}

/**
 * Task record from the registry.
 * Contains basic task information for list views and status tracking.
 */
export class TaskRecordDto {
  @ApiProperty({
    example: 'TASK_2026_001',
    description: 'Unique task identifier (format: TASK_YYYY_NNN)',
  })
  public readonly id!: string;

  @ApiProperty({
    enum: TaskStatus,
    enumName: 'TaskStatus',
    example: TaskStatus.IN_PROGRESS,
    description: 'Current task status in the lifecycle',
  })
  public readonly status!: TaskStatus;

  @ApiProperty({
    enum: TaskType,
    enumName: 'TaskType',
    example: TaskType.FEATURE,
    description: 'Task type categorizing the nature of work',
  })
  public readonly type!: TaskType;

  @ApiProperty({
    example: 'Add authentication system with OAuth2 support',
    description: 'Task description explaining the work to be done',
  })
  public readonly description!: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'ISO 8601 timestamp when the task was created',
  })
  public readonly created!: string;

  @ApiPropertyOptional({
    example: 'claude-sonnet-4-20250514',
    description: 'AI model assigned to or used for this task',
  })
  public readonly model?: string;
}

/**
 * Full task definition with all planning details.
 * Contains comprehensive task information from task-description.md files.
 */
export class TaskDefinitionDto {
  @ApiProperty({
    example: 'Add Authentication System',
    description: 'Human-readable task title',
  })
  public readonly title!: string;

  @ApiProperty({
    enum: TaskType,
    enumName: 'TaskType',
    example: TaskType.FEATURE,
    description: 'Task type categorizing the nature of work',
  })
  public readonly type!: TaskType;

  @ApiProperty({
    enum: TaskPriority,
    enumName: 'TaskPriority',
    example: TaskPriority.P1_HIGH,
    description: 'Task priority for scheduling and triage',
  })
  public readonly priority!: TaskPriority;

  @ApiProperty({
    enum: TaskComplexity,
    enumName: 'TaskComplexity',
    example: TaskComplexity.Medium,
    description: 'Estimated task complexity',
  })
  public readonly complexity!: TaskComplexity;

  @ApiProperty({
    example: 'Implement OAuth2 authentication with Google and GitHub providers',
    description: 'Detailed task description',
  })
  public readonly description!: string;

  @ApiProperty({
    type: [String],
    example: ['TASK_2026_050', 'TASK_2026_051'],
    description: 'List of task IDs that must complete before this task can start',
  })
  public readonly dependencies!: ReadonlyArray<string>;

  @ApiProperty({
    type: [String],
    example: ['Users can log in with Google', 'Users can log in with GitHub'],
    description: 'Acceptance criteria that define task completion',
  })
  public readonly acceptanceCriteria!: ReadonlyArray<string>;

  @ApiProperty({
    type: [String],
    example: ['https://oauth.net/2/', 'https://docs.github.com/en/apps'],
    description: 'Reference links and documentation URLs',
  })
  public readonly references!: ReadonlyArray<string>;
}
