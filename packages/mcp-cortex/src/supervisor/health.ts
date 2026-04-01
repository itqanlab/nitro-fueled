/**
 * Health Monitor & Reconciliation Module
 *
 * Pure functions — no DB calls. Callers (the supervisor loop) pass data in and
 * act on the returned results.
 *
 * Three concerns:
 *  1. Worker health check   — decide healthy / warn / kill based on idle time
 *  2. Heartbeat check       — boolean liveness probe with configurable timeout
 *  3. Worker-exit reconcile — determine what task status a completed worker implies
 *  4. Stale-session recovery — identify workers/tasks to clean up at startup
 */

import { isProcessAlive } from '../process/spawn.js';
import { emptyProgress } from '../db/schema.js';
import type { WorkerProgress } from '../db/schema.js';
import type {
  WorkerRecord,
  SessionRecord,
  Handoff,
  HealthResult,
  ReconcileResult,
  RecoveryPlan,
} from './types.js';

/** 2 minutes — matches the existing getHealth() threshold in workers.ts */
const IDLE_THRESHOLD_MS = 120_000;

/** 5 minutes — default heartbeat liveness probe */
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1_000;

/** 5 minutes — session staleness cutoff used during startup recovery */
const STALE_SESSION_THRESHOLD_MS = 5 * 60 * 1_000;

function parseProgress(json: string): WorkerProgress {
  try {
    return JSON.parse(json) as WorkerProgress;
  } catch {
    return emptyProgress();
  }
}

/**
 * Evaluate worker health based on idle time.
 *
 * Uses a persistent strike map (owned by the caller) so that consecutive idle
 * checks accumulate.  A strike is added each time the worker is idle beyond
 * IDLE_THRESHOLD_MS; the strike is cleared once the worker shows activity.
 *
 * Thresholds:
 *  - strikes < 2  → warn
 *  - strikes >= 2 → kill
 */
export function checkWorkerHealth(
  worker: WorkerRecord,
  strikeMap: Map<string, number>,
): HealthResult {
  const progress = parseProgress(worker.progress_json);
  const idleMs = Date.now() - progress.last_action_at;

  if (idleMs <= IDLE_THRESHOLD_MS) {
    strikeMap.delete(worker.id);
    return { action: 'healthy', reason: 'active', strikes: 0 };
  }

  const current = (strikeMap.get(worker.id) ?? 0) + 1;
  strikeMap.set(worker.id, current);

  const idleMin = Math.round(idleMs / 60_000);

  if (current >= 2) {
    return {
      action: 'kill',
      reason: `stuck for ${idleMin}m (${current} strikes)`,
      strikes: current,
    };
  }

  return {
    action: 'warn',
    reason: `idle for ${idleMin}m (strike ${current})`,
    strikes: current,
  };
}

/**
 * Return true when the worker produced activity within `timeoutMs`.
 * Used as a lightweight liveness probe that does not accumulate state.
 */
export function checkHeartbeat(
  worker: WorkerRecord,
  timeoutMs: number = DEFAULT_HEARTBEAT_TIMEOUT_MS,
): boolean {
  const progress = parseProgress(worker.progress_json);
  return Date.now() - progress.last_action_at < timeoutMs;
}

/**
 * Determine the task status that should follow a worker's exit.
 *
 * The presence of a handoff and the worker type drive the outcome:
 *  - No handoff at all → FAILED (allow retry)
 *  - build / implement with changes in handoff → IMPLEMENTED
 *  - build / implement with empty handoff     → FAILED
 *  - prep                                     → PREPPED
 *  - review / cleanup                         → COMPLETE
 */
export function reconcileWorkerExit(
  worker: WorkerRecord,
  handoff: Handoff | null,
): ReconcileResult {
  if (!handoff) {
    return { newStatus: 'FAILED', reason: 'no handoff written — reset for retry' };
  }

  switch (worker.worker_type) {
    case 'build':
    case 'implement': {
      const hasChanges =
        handoff.commits.length > 0 || handoff.files_changed.length > 0;
      if (hasChanges) {
        return {
          newStatus: 'IMPLEMENTED',
          reason: 'build worker with changes in handoff',
        };
      }
      return {
        newStatus: 'FAILED',
        reason: 'build worker with empty handoff',
      };
    }

    case 'prep':
      return { newStatus: 'PREPPED', reason: 'prep worker with handoff' };

    case 'review':
    case 'cleanup':
      return { newStatus: 'COMPLETE', reason: 'review/cleanup worker completed' };

    default: {
      const exhaustive: never = worker.worker_type;
      return { newStatus: 'FAILED', reason: `unknown worker type: ${exhaustive}` };
    }
  }
}

/**
 * Build a recovery plan for a session that may have been orphaned (e.g. after a
 * server crash).  Called once at supervisor startup for each non-stopped session.
 *
 * A worker is marked for cleanup when either:
 *  - Its PID is no longer alive, OR
 *  - Its heartbeat is stale (last activity > STALE_SESSION_THRESHOLD_MS ago)
 *
 * Only workers with status 'active' are evaluated — completed/failed/killed rows
 * are left untouched.
 */
export function recoverStaleSession(
  _session: SessionRecord,
  workers: WorkerRecord[],
): RecoveryPlan {
  const workersToKill: string[] = [];
  const tasksToRelease: string[] = [];

  for (const worker of workers) {
    if (worker.status !== 'active') continue;

    const pidAlive = worker.pid !== null && isProcessAlive(worker.pid);
    const progress = parseProgress(worker.progress_json);
    const heartbeatStale =
      Date.now() - progress.last_action_at > STALE_SESSION_THRESHOLD_MS;

    if (!pidAlive || heartbeatStale) {
      workersToKill.push(worker.id);
      if (worker.task_id) {
        tasksToRelease.push(worker.task_id);
      }
    }
  }

  return { workersToKill, tasksToRelease };
}
