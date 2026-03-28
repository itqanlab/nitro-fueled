/**
 * Task-related enum DTOs for OpenAPI documentation.
 * Values match dashboard.types.ts exactly.
 * Note: Using regular enums (not const) for Swagger decorator compatibility.
 */

/**
 * Task status values representing the lifecycle of a task.
 */
export enum TaskStatus {
  CREATED = 'CREATED',
  IN_PROGRESS = 'IN_PROGRESS',
  IMPLEMENTED = 'IMPLEMENTED',
  IN_REVIEW = 'IN_REVIEW',
  FIXING = 'FIXING',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
}

/**
 * Task type values categorizing the nature of work.
 */
export enum TaskType {
  FEATURE = 'FEATURE',
  BUGFIX = 'BUGFIX',
  REFACTORING = 'REFACTORING',
  DOCUMENTATION = 'DOCUMENTATION',
  RESEARCH = 'RESEARCH',
  DEVOPS = 'DEVOPS',
  CREATIVE = 'CREATIVE',
}

/**
 * Task priority values for scheduling and triage.
 */
export enum TaskPriority {
  P0_CRITICAL = 'P0-Critical',
  P1_HIGH = 'P1-High',
  P2_MEDIUM = 'P2-Medium',
  P3_LOW = 'P3-Low',
}

/**
 * Task complexity assessment values.
 */
export enum TaskComplexity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}
