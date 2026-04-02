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
  readonly description: string;
  readonly status: QueueTaskStatus;
  readonly type: QueueTaskType;
  readonly priority: QueueTaskPriority;
  readonly phase: QueueTaskPhase;
  readonly sessionId: string | null;
  readonly model: string | null;
  readonly createdAt: string;
  readonly lastActivity: string;
}

export enum SortField {
  ID = 'id',
  STATUS = 'status',
  PRIORITY = 'priority',
  CREATED_AT = 'createdAt',
  TYPE = 'type'
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface QueueTaskExtended {
  readonly id: string;
  readonly title: string;
  description?: string;
  readonly status: QueueTaskStatus;
  readonly type: QueueTaskType;
  readonly priority: QueueTaskPriority;
  readonly phase: QueueTaskPhase;
  readonly sessionId: string | null;
  readonly model: string | null;
  created?: string;
  readonly lastActivity: string;
}

export interface FilterChips {
  statuses: QueueTaskStatus[];
  types: QueueTaskType[];
  priorities: QueueTaskPriority[];
  models: string[];
}

export interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

export interface QueueFilterState {
  readonly searchQuery: string;
  readonly statuses: readonly QueueTaskStatus[];
  readonly types: readonly QueueTaskType[];
  readonly priorities: readonly QueueTaskPriority[];
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly models: readonly string[];
  readonly sortField: SortField;
  readonly sortDirection: SortDirection;
  readonly activeChips?: FilterChips;
}

export interface QueueFilter {
  readonly statusFilter: QueueTaskStatus | 'ALL';
  readonly searchQuery: string;
}
