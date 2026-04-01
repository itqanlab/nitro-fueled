/**
 * Shared types for all supervisor modules.
 *
 * Defines lightweight record shapes that mirror DB row columns without importing
 * the full DB layer, plus result types used across health, reconciliation, and
 * recovery functions.
 */

import type { WorkerType, WorkerStatus, TaskStatus, LoopStatus } from '../db/schema.js';
import type { HandoffRecord } from '../tools/handoffs.js';

export type { TaskStatus };

/** Subset of DB worker row needed by health and reconciliation modules. */
export interface WorkerRecord {
  id: string;
  session_id: string;
  task_id: string | null;
  worker_type: WorkerType;
  label: string;
  status: WorkerStatus;
  pid: number | null;
  spawn_time: string;
  progress_json: string;
  tokens_json: string;
  cost_json: string;
}

/** Subset of DB session row needed by recovery module. */
export interface SessionRecord {
  id: string;
  loop_status: LoopStatus;
}

/** Re-export HandoffRecord so callers import from one place. */
export type Handoff = HandoffRecord;

/** Outcome of a single worker health evaluation. */
export type HealthAction = 'healthy' | 'warn' | 'kill';

export interface HealthResult {
  action: HealthAction;
  reason: string;
  strikes: number;
}

/** Outcome of reconciling a task status after a worker exits. */
export interface ReconcileResult {
  newStatus: TaskStatus;
  reason: string;
}

/** Plan produced by startup recovery for a stale session. */
export interface RecoveryPlan {
  /** Worker IDs that should be transitioned to 'killed'. */
  workersToKill: string[];
  /** Task IDs that should be released (claims cleared, status reset). */
  tasksToRelease: string[];
}
