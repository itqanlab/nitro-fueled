/**
 * Project Queue Model
 * Types for the Task Queue Board page — full task list with live status indicators.
 */

export type QueueTaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'FIXING'
  | 'COMPLETE'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export type QueueTaskPhase = 'PM' | 'Architect' | 'Dev' | 'QA' | null;

export type QueueTaskType = 'FEATURE' | 'BUGFIX' | 'REFACTOR' | 'DOCS' | 'TEST' | 'CHORE';

export type QueueTaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';

export type QueueViewMode = 'list' | 'kanban';

export interface QueueTask {
  readonly id: string;
  readonly title: string;
  readonly status: QueueTaskStatus;
  readonly type: QueueTaskType;
  readonly priority: QueueTaskPriority;
  readonly phase: QueueTaskPhase;
  readonly sessionId: string | null;
  readonly lastActivity: string;
}

export interface QueueFilter {
  readonly statusFilter: QueueTaskStatus | 'ALL';
  readonly searchQuery: string;
}
