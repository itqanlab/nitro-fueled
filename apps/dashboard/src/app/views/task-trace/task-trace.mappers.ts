/**
 * Low-level row mappers for the task-trace adapter.
 * Converts raw CortexXxx types to camelCase view-model rows.
 */
import type {
  CortexWorker,
  CortexPhase,
  CortexReview,
  CortexFixCycle,
} from '../../../../../dashboard-api/src/dashboard/cortex.types';
import type { WorkerRow, PhaseRow, ReviewRow, FixCycleRow } from './task-trace.model';

export function mapWorker(w: CortexWorker): WorkerRow {
  return {
    id: w.id,
    sessionId: w.session_id,
    taskId: w.task_id,
    workerType: w.worker_type,
    label: w.label,
    status: w.status,
    model: w.model,
    provider: w.provider,
    launcher: w.launcher,
    spawnTime: w.spawn_time,
    outcome: w.outcome,
    retryNumber: w.retry_number,
    cost: w.cost,
    inputTokens: w.input_tokens,
    outputTokens: w.output_tokens,
    durationMin: null,
  };
}

export function mapPhase(p: CortexPhase): PhaseRow {
  return {
    id: p.id,
    workerRunId: p.worker_run_id,
    taskId: p.task_id,
    phase: p.phase,
    model: p.model,
    startTime: p.start_time,
    endTime: p.end_time,
    durationMinutes: p.duration_minutes,
    inputTokens: p.input_tokens,
    outputTokens: p.output_tokens,
    outcome: p.outcome,
  };
}

export function mapReview(r: CortexReview): ReviewRow {
  return {
    id: r.id,
    taskId: r.task_id,
    reviewType: r.review_type,
    score: r.score,
    findingsCount: r.findings_count,
    criticalCount: r.critical_count,
    modelThatBuilt: r.model_that_built,
    modelThatReviewed: r.model_that_reviewed,
  };
}

export function mapFixCycle(f: CortexFixCycle): FixCycleRow {
  return {
    id: f.id,
    taskId: f.task_id,
    fixesApplied: f.fixes_applied,
    fixesSkipped: f.fixes_skipped,
    requiredManual: f.required_manual,
    modelThatFixed: f.model_that_fixed,
  };
}
