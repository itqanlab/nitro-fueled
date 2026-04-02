/**
 * Task and session query functions for the cortex SQLite DB.
 */
import Database from 'better-sqlite3';
import type {
  CortexTask,
  CortexTaskContext,
  CortexSubtask,
  CortexSession,
  CortexSessionSummary,
  CortexSessionWorker,
  CostBreakdown,
  RawTask,
  RawSubtask,
  RawSession,
  RawWorker,
} from './cortex.types';
import { mapWorker } from './cortex-queries-worker';

// ============================================================
// Column lists
// ============================================================

export const TASK_COLS =
  'id, title, type, priority, status, complexity, dependencies, description, acceptance_criteria, file_scope, created_at, updated_at, model, preferred_provider, worker_mode, custom_flow_id';
export const SUBTASK_COLS =
  'id, title, status, complexity, model, subtask_order, file_scope';
export const SESSION_COLS =
  'id, source, started_at, ended_at, loop_status, tasks_terminal, supervisor_model, supervisor_launcher, mode, total_cost, total_input_tokens, total_output_tokens, last_heartbeat, drain_requested, supervisor_cost_usd, worker_costs_json';
export const WORKER_COLS =
  'id, session_id, task_id, worker_type, label, status, model, provider, launcher, spawn_time, tokens_json, cost_json, outcome, retry_number';

// ============================================================
// JSON parsing helper
// ============================================================

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ============================================================
// Mappers
// ============================================================

export function mapTask(row: RawTask): CortexTask {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    priority: row.priority,
    status: row.status,
    complexity: row.complexity,
    dependencies: parseJson<string[]>(row.dependencies, []),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapSubtask(row: RawSubtask): CortexSubtask {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    complexity: row.complexity ?? null,
    model: row.model ?? null,
    subtask_order: row.subtask_order ?? null,
    file_scope: parseJson<string[]>(row.file_scope, []),
  };
}

export function mapTaskContext(row: RawTask, subtasks: CortexSubtask[] = []): CortexTaskContext {
  return {
    ...mapTask(row),
    description: row.description,
    acceptance_criteria: row.acceptance_criteria,
    file_scope: parseJson<string[]>(row.file_scope, []),
    model: row.model ?? null,
    preferred_provider: row.preferred_provider ?? null,
    worker_mode: row.worker_mode ?? null,
    custom_flow_id: row.custom_flow_id ?? null,
    subtasks,
  };
}

export function mapSession(row: RawSession): CortexSession {
  return {
    id: row.id,
    source: row.source,
    started_at: row.started_at,
    ended_at: row.ended_at,
    loop_status: row.loop_status,
    tasks_terminal: row.tasks_terminal,
    supervisor_model: row.supervisor_model,
    supervisor_launcher: row.supervisor_launcher,
    mode: row.mode,
    total_cost: row.total_cost,
    total_input_tokens: row.total_input_tokens,
    total_output_tokens: row.total_output_tokens,
    last_heartbeat: row.last_heartbeat,
    drain_requested: row.drain_requested === 1,
  };
}

// ============================================================
// Query functions
// ============================================================

export function queryTasks(db: Database.Database, filters?: { status?: string; type?: string }): CortexTask[] {
  let sql = `SELECT ${TASK_COLS} FROM tasks`;
  const params: string[] = [];
  const conditions: string[] = [];
  if (filters?.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  return (db.prepare(sql).all(...params) as RawTask[]).map(mapTask);
}

export function queryTaskContext(db: Database.Database, taskId: string): CortexTaskContext | null {
  const row = db.prepare(`SELECT ${TASK_COLS} FROM tasks WHERE id = ?`).get(taskId) as RawTask | undefined;
  if (!row) return null;
  const subtaskRows = db.prepare(
    `SELECT ${SUBTASK_COLS} FROM tasks WHERE parent_task_id = ? ORDER BY subtask_order ASC`,
  ).all(taskId) as RawSubtask[];
  return mapTaskContext(row, subtaskRows.map(mapSubtask));
}

export function querySessions(db: Database.Database): CortexSession[] {
  return (
    db.prepare(`SELECT ${SESSION_COLS} FROM sessions ORDER BY started_at DESC`).all() as RawSession[]
  ).map(mapSession);
}

export function querySessionSummary(db: Database.Database, sessionId: string): CortexSessionSummary | null {
  const sessionRow = db
    .prepare(`SELECT ${SESSION_COLS} FROM sessions WHERE id = ?`)
    .get(sessionId) as RawSession | undefined;
  if (!sessionRow) return null;

  const workerRows = db
    .prepare(`SELECT ${WORKER_COLS} FROM workers WHERE session_id = ? ORDER BY spawn_time ASC`)
    .all(sessionId) as RawWorker[];

  const workers: CortexSessionWorker[] = workerRows.map((w) => {
    const m = mapWorker(w);
    return {
      id: m.id,
      task_id: m.task_id,
      worker_type: m.worker_type,
      label: m.label,
      status: m.status,
      model: m.model,
      cost: m.cost,
      input_tokens: m.input_tokens,
      output_tokens: m.output_tokens,
    };
  });

  // Compute cost_breakdown from workers' cost_json, then refine with stored session columns
  const perModelCost: Record<string, number> = {};
  for (const w of workerRows) {
    if (!w.cost_json) continue;
    try {
      const cost = JSON.parse(w.cost_json) as { total_usd?: number };
      if (cost.total_usd != null) {
        const key = w.model ?? 'unknown';
        perModelCost[key] = (perModelCost[key] ?? 0) + cost.total_usd;
      }
    } catch { /* skip malformed rows */ }
  }

  const supervisorCost = typeof sessionRow.supervisor_cost_usd === 'number' ? sessionRow.supervisor_cost_usd : 0;

  let workerCostByModel: Record<string, number> = Object.fromEntries(
    Object.entries(perModelCost).map(([k, v]) => [k, Math.round(v * 10000) / 10000]),
  );
  if (sessionRow.worker_costs_json) {
    try {
      const stored = JSON.parse(sessionRow.worker_costs_json) as Record<string, number>;
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        workerCostByModel = Object.fromEntries(
          Object.entries(stored).map(([k, v]) => [k, Math.round(v * 10000) / 10000]),
        );
      }
    } catch { /* use computed fallback */ }
  }

  const workerCostTotal = Object.values(workerCostByModel).reduce((s, v) => s + v, 0);
  const costBreakdown: CostBreakdown = {
    supervisor_cost: Math.round(supervisorCost * 10000) / 10000,
    worker_cost_by_model: workerCostByModel,
    total_cost: Math.round((supervisorCost + workerCostTotal) * 10000) / 10000,
  };

  return { ...mapSession(sessionRow), workers, cost_breakdown: costBreakdown };
}
