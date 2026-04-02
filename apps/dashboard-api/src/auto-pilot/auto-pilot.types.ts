/**
 * Types for the persistent Supervisor service.
 */

// ============================================================
// Configuration
// ============================================================

export type PriorityStrategy = 'build-first' | 'review-first' | 'balanced';
export type ProviderType = 'claude' | 'glm' | 'opencode' | 'codex';
export type LauncherMode = 'print' | 'opencode' | 'codex';
export type WorkerType = 'build' | 'review';
export type LoopStatus = 'running' | 'paused' | 'stopped';
export type WorkerStatus = 'active' | 'completed' | 'failed' | 'killed';
export type HealthStatus = 'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished';

export interface SupervisorConfig {
  concurrency: number;
  limit: number;
  prep_provider: ProviderType;
  prep_model: string;
  implement_provider: ProviderType;
  implement_model: string;
  implement_fallback_provider: ProviderType;
  implement_fallback_model: string;
  review_provider: ProviderType;
  review_model: string;
  supervisor_model: string;
  priority: PriorityStrategy;
  retries: number;
  poll_interval_ms: number;
  working_directory: string;
}

/**
 * Data-driven defaults from 143-worker analysis (RETRO_2026-03-30_3):
 * - Prep:      claude-sonnet-4-6  (100% success, $0.13/worker)
 * - Implement: glm-5.1            ($0/worker, retry with claude on fail)
 * - Review:    claude-sonnet-4-6  (100% success across 17 reviews, $0.78/worker)
 *
 * Expected cost: $0.91/task (best case) to $2.51/task (GLM retry)
 * vs previous gpt-5.4 routing: $3.54/task
 */
export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  concurrency: 2,
  limit: 10,
  prep_provider: 'claude',
  prep_model: 'claude-sonnet-4-6',
  implement_provider: 'glm',
  implement_model: 'zai-coding-plan/glm-5.1',
  implement_fallback_provider: 'claude',
  implement_fallback_model: 'claude-sonnet-4-6',
  review_provider: 'claude',
  review_model: 'claude-sonnet-4-6',
  supervisor_model: 'claude-haiku-4-5-20251001',
  priority: 'build-first',
  retries: 2,
  poll_interval_ms: 30_000,
  working_directory: process.cwd(),
};

// ============================================================
// Custom flows
// ============================================================

export interface CustomFlowStep {
  agent: string;
  label: string;
}

export interface CustomFlow {
  id: string;
  name: string;
  description: string | null;
  steps: CustomFlowStep[];
}

// ============================================================
// Task candidates
// ============================================================

export interface TaskCandidate {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  complexity: string;
  /**
   * Raw complexity value from the DB row — null means the subtask has no explicit complexity
   * set and should inherit from its parent task for model routing purposes.
   * Always non-null for top-level tasks (defaults to 'Medium').
   */
  rawComplexity: string | null;
  dependencies: string[];
  model: string | null;
  customFlowId: string | null;
  /** Non-null when this candidate is a subtask (TASK_YYYY_NNN.M format). */
  parentTaskId: string | null;
  /** 1-indexed position within the parent task's subtask sequence. */
  subtaskOrder: number | null;
}

// ============================================================
// Session state
// ============================================================

export interface SupervisorState {
  sessionId: string;
  config: SupervisorConfig;
  loopStatus: LoopStatus;
  retryCounters: Record<string, number>;
  stuckCounters: Record<string, number>;
  tasksCompleted: number;
  tasksFailed: number;
  startedAt: string;
}

// ============================================================
// Worker info
// ============================================================

export interface ActiveWorkerInfo {
  workerId: string;
  taskId: string;
  workerType: WorkerType;
  label: string;
  pid: number;
  provider: ProviderType;
  model: string;
  spawnTime: string;
  health: HealthStatus;
}

// ============================================================
// API request/response types
// ============================================================

export interface StartRequest {
  taskIds?: string[];
  concurrency?: number;
  limit?: number;
  prepProvider?: ProviderType;
  prepModel?: string;
  implementProvider?: ProviderType;
  implementModel?: string;
  implementFallbackProvider?: ProviderType;
  implementFallbackModel?: string;
  reviewProvider?: ProviderType;
  reviewModel?: string;
  priority?: PriorityStrategy;
  retries?: number;
}

export type UpdateConfigRequest = Partial<Pick<SupervisorConfig,
  | 'concurrency'
  | 'limit'
  | 'prep_provider'
  | 'prep_model'
  | 'implement_provider'
  | 'implement_model'
  | 'implement_fallback_provider'
  | 'implement_fallback_model'
  | 'review_provider'
  | 'review_model'
  | 'supervisor_model'
  | 'priority'
  | 'retries'
  | 'poll_interval_ms'
>>;

export interface SessionStatusResponse {
  sessionId: string;
  loopStatus: LoopStatus;
  config: SupervisorConfig;
  workers: {
    active: number;
    completed: number;
    failed: number;
  };
  tasks: {
    completed: number;
    failed: number;
    inProgress: number;
    remaining: number;
  };
  startedAt: string;
  uptimeMinutes: number;
  lastHeartbeat: string;
  drainRequested: boolean;
}

// ============================================================
// Events emitted via WebSocket
// ============================================================

export interface SupervisorEvent {
  type: 'supervisor:started' | 'supervisor:stopped' | 'supervisor:heartbeat'
    | 'supervisor:paused' | 'supervisor:resumed'
    | 'worker:spawned' | 'worker:completed' | 'worker:failed' | 'worker:killed'
    | 'task:claimed' | 'task:completed' | 'task:failed' | 'task:blocked'
    | 'task:subtask-parent-promoted';
  sessionId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
