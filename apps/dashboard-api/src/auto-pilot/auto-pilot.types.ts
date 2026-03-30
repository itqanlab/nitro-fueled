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
  build_provider: ProviderType;
  build_model: string;
  review_provider: ProviderType;
  review_model: string;
  priority: PriorityStrategy;
  retries: number;
  poll_interval_ms: number;
  working_directory: string;
}

export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  concurrency: 2,
  limit: 10,
  build_provider: 'claude',
  build_model: 'claude-sonnet-4-6',
  review_provider: 'claude',
  review_model: 'claude-sonnet-4-6',
  priority: 'build-first',
  retries: 2,
  poll_interval_ms: 30_000,
  working_directory: process.cwd(),
};

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
  dependencies: string[];
  model: string | null;
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
  buildProvider?: ProviderType;
  buildModel?: string;
  reviewProvider?: ProviderType;
  reviewModel?: string;
  priority?: PriorityStrategy;
  retries?: number;
}

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
}

// ============================================================
// Events emitted via WebSocket
// ============================================================

export interface SupervisorEvent {
  type: 'supervisor:started' | 'supervisor:stopped' | 'supervisor:heartbeat'
    | 'worker:spawned' | 'worker:completed' | 'worker:failed' | 'worker:killed'
    | 'task:claimed' | 'task:completed' | 'task:failed' | 'task:blocked';
  sessionId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
