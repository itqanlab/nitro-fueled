/**
 * Dashboard Command Center Model
 * Types for the live operational command center view on the home page.
 */

// Task status breakdown from registry
export type TaskStatusKey =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'COMPLETE'
  | 'FAILED'
  | 'BLOCKED';

export interface TaskStatusBreakdown {
  readonly CREATED: number;
  readonly IN_PROGRESS: number;
  readonly IMPLEMENTED: number;
  readonly IN_REVIEW: number;
  readonly COMPLETE: number;
  readonly FAILED: number;
  readonly BLOCKED: number;
  readonly total: number;
}

// Token and cost summary
export interface TokenCostSummary {
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly recentSessions: readonly SessionCost[];
}

export interface SessionCost {
  readonly sessionId: string;
  readonly date: string;
  readonly tokens: number;
  readonly cost: number;
}

// Active sessions
export interface ActiveSession {
  readonly sessionId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly status: 'running' | 'paused';
}

// Active tasks (IN_PROGRESS)
export interface ActiveTask {
  readonly taskId: string;
  readonly title: string;
  readonly status: 'IN_PROGRESS';
  readonly type: string;
  readonly priority: string;
}

// Complete command center data
export interface CommandCenterData {
  readonly taskBreakdown: TaskStatusBreakdown;
  readonly tokenCost: TokenCostSummary;
  readonly activeSessions: readonly ActiveSession[];
  readonly activeTasks: readonly ActiveTask[];
}
