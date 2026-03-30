/**
 * Plan data DTOs for API responses.
 * Contains project plan structure with phases, milestones, and current focus.
 */

import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '../enums/task.enums';

/**
 * Task map entry within a plan phase.
 * Represents a task summary in the phase's task list.
 */
export class PlanPhaseTaskMapDto {
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
 * Project plan phase with milestones and task mapping.
 * Represents a major phase in the project plan.
 */
export class PlanPhaseDto {
  @ApiProperty({
    example: 'Phase 1: Foundation',
    description: 'Phase name',
  })
  public readonly name!: string;

  @ApiProperty({
    example: 'active',
    description: 'Phase status (e.g., pending, active, complete)',
  })
  public readonly status!: string;

  @ApiProperty({
    example: 'Build core infrastructure and database layer',
    description: 'Phase description',
  })
  public readonly description!: string;

  @ApiProperty({
    type: [String],
    example: ['Database schema complete', 'Auth system functional'],
    description: 'Phase milestone achievements',
  })
  public readonly milestones!: ReadonlyArray<string>;

  @ApiProperty({
    type: [PlanPhaseTaskMapDto],
    description: 'Tasks belonging to this phase',
  })
  public readonly taskMap!: ReadonlyArray<PlanPhaseTaskMapDto>;
}

/**
 * Current focus area for the supervisor/orchestrator.
 * Indicates what the team is actively working on.
 */
export class CurrentFocusDto {
  @ApiProperty({
    example: 'Phase 2: Features',
    description: 'Currently active phase name',
  })
  public readonly activePhase!: string;

  @ApiProperty({
    example: 'Authentication system',
    description: 'Currently active milestone',
  })
  public readonly activeMilestone!: string;

  @ApiProperty({
    type: [String],
    example: ['TASK_2026_010', 'TASK_2026_011'],
    description: 'Next priority task IDs to work on',
  })
  public readonly nextPriorities!: ReadonlyArray<string>;

  @ApiProperty({
    example: 'Focus on completing authentication before moving to dashboard',
    description: 'Supervisor guidance for current work',
  })
  public readonly supervisorGuidance!: string;

  @ApiProperty({
    example: 'All blockers resolved, proceed with implementation',
    description: 'Additional guidance notes',
  })
  public readonly guidanceNote!: string;
}

/**
 * Architectural decision record in the plan.
 */
export class DecisionDto {
  @ApiProperty({
    example: '2024-01-15',
    description: 'Date the decision was made',
  })
  public readonly date!: string;

  @ApiProperty({
    example: 'Use SQLite for local development',
    description: 'The decision that was made',
  })
  public readonly decision!: string;

  @ApiProperty({
    example: 'Simpler setup, no external dependencies, suitable for single-user desktop app',
    description: 'Rationale behind the decision',
  })
  public readonly rationale!: string;
}

/**
 * Complete project plan data.
 * Contains phases, current focus, and architectural decisions.
 */
export class PlanDataDto {
  @ApiProperty({
    example: 'Building a task orchestration system with AI agents',
    description: 'Project overview and description',
  })
  public readonly overview!: string;

  @ApiProperty({
    type: [PlanPhaseDto],
    description: 'Project phases with milestones and task maps',
  })
  public readonly phases!: ReadonlyArray<PlanPhaseDto>;

  @ApiProperty({
    type: CurrentFocusDto,
    description: 'Current focus area and next priorities',
  })
  public readonly currentFocus!: CurrentFocusDto;

  @ApiProperty({
    type: [DecisionDto],
    description: 'Architectural decisions made during the project',
  })
  public readonly decisions!: ReadonlyArray<DecisionDto>;
}
