/**
 * Worker, task trace, analytics, and event query functions for the cortex SQLite DB.
 */
import Database from 'better-sqlite3';
import type {
  CortexWorker,
  CortexPhase,
  CortexReview,
  CortexFixCycle,
  CortexEvent,
  CortexTaskTrace,
  CortexModelPerformance,
  CortexPhaseTiming,
  RawWorker,
  RawPhase,
  RawReview,
  RawFixCycle,
  RawEvent,
  ModelPerfRow,
  PhaseTimingRow,
} from './cortex.types';

const WORKER_COLS =
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

export function mapWorker(row: RawWorker): CortexWorker {
  const tokens = parseJson<{ input?: number; output?: number }>(row.tokens_json, {});
  const cost = parseJson<{ total?: number }>(row.cost_json, {});
  return {
    id: row.id,
    session_id: row.session_id,
    task_id: row.task_id,
    worker_type: row.worker_type,
    label: row.label,
    status: row.status,
    model: row.model,
    provider: row.provider,
    launcher: row.launcher,
    spawn_time: row.spawn_time,
    outcome: row.outcome,
    retry_number: row.retry_number,
    cost: cost.total ?? 0,
    input_tokens: tokens.input ?? 0,
    output_tokens: tokens.output ?? 0,
  };
}

export function mapEvent(row: RawEvent): CortexEvent {
  return {
    id: row.id,
    session_id: row.session_id,
    task_id: row.task_id,
    source: row.source,
    event_type: row.event_type,
    data: parseJson<Record<string, unknown>>(row.data, {}),
    created_at: row.created_at,
  };
}

// ============================================================
// Query functions
// ============================================================

export function queryWorkers(db: Database.Database, filters?: { sessionId?: string; status?: string }): CortexWorker[] {
  let sql = `SELECT ${WORKER_COLS} FROM workers`;
  const params: string[] = [];
  const conditions: string[] = [];
  if (filters?.sessionId) {
    conditions.push('session_id = ?');
    params.push(filters.sessionId);
  }
  if (filters?.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY spawn_time DESC';
  return (db.prepare(sql).all(...params) as RawWorker[]).map(mapWorker);
}

export function queryTaskTrace(db: Database.Database, taskId: string): CortexTaskTrace {
  const workers = (
    db.prepare(`SELECT ${WORKER_COLS} FROM workers WHERE task_id = ? ORDER BY spawn_time ASC`).all(taskId) as RawWorker[]
  ).map(mapWorker);

  const phases: CortexPhase[] = (
    db
      .prepare(
        'SELECT id, worker_run_id, task_id, phase, model, start_time, end_time, duration_minutes, input_tokens, output_tokens, outcome FROM phases WHERE task_id = ? ORDER BY start_time ASC',
      )
      .all(taskId) as RawPhase[]
  ).map((r) => ({
    id: r.id, worker_run_id: r.worker_run_id, task_id: r.task_id, phase: r.phase,
    model: r.model, start_time: r.start_time, end_time: r.end_time,
    duration_minutes: r.duration_minutes, input_tokens: r.input_tokens,
    output_tokens: r.output_tokens, outcome: r.outcome,
  }));

  const reviews: CortexReview[] = (
    db
      .prepare(
        'SELECT id, task_id, review_type, score, findings_count, critical_count, model_that_built, model_that_reviewed FROM reviews WHERE task_id = ?',
      )
      .all(taskId) as RawReview[]
  ).map((r) => ({
    id: r.id, task_id: r.task_id, review_type: r.review_type, score: r.score,
    findings_count: r.findings_count, critical_count: r.critical_count,
    model_that_built: r.model_that_built, model_that_reviewed: r.model_that_reviewed,
  }));

  const fix_cycles: CortexFixCycle[] = (
    db
      .prepare(
        'SELECT id, task_id, fixes_applied, fixes_skipped, required_manual, model_that_fixed FROM fix_cycles WHERE task_id = ?',
      )
      .all(taskId) as RawFixCycle[]
  ).map((r) => ({
    id: r.id, task_id: r.task_id, fixes_applied: r.fixes_applied, fixes_skipped: r.fixes_skipped,
    required_manual: Boolean(r.required_manual), model_that_fixed: r.model_that_fixed,
  }));

  const events = (
    db
      .prepare(
        'SELECT id, session_id, task_id, source, event_type, data, created_at FROM events WHERE task_id = ? ORDER BY id ASC',
      )
      .all(taskId) as RawEvent[]
  ).map(mapEvent);

  return { task_id: taskId, workers, phases, reviews, fix_cycles, events };
}

export function queryModelPerformance(
  db: Database.Database,
  filters?: { taskType?: string; model?: string },
): CortexModelPerformance[] {
  const params: string[] = [];
  let phaseWhere = '';
  let reviewWhere = '';
  if (filters?.model) {
    phaseWhere += ' AND p.model = ?';
    params.push(filters.model);
    reviewWhere += ' AND r.model_that_reviewed = ?';
    params.push(filters.model);
  }
  if (filters?.taskType) {
    phaseWhere += ' AND t.type = ?';
    params.push(filters.taskType);
    reviewWhere += ' AND t.type = ?';
    params.push(filters.taskType);
  }
  const sql = `
    WITH phase_data AS (
      SELECT p.model, t.type AS task_type, p.duration_minutes, p.input_tokens, p.output_tokens
      FROM phases p LEFT JOIN tasks t ON p.task_id = t.id WHERE 1=1${phaseWhere}
    ),
    review_data AS (
      SELECT r.model_that_reviewed AS model, t.type AS task_type, r.score
      FROM reviews r LEFT JOIN tasks t ON r.task_id = t.id WHERE 1=1${reviewWhere}
    )
    SELECT pd.model, pd.task_type,
      COUNT(pd.model) AS phase_count,
      COALESCE((SELECT COUNT(*) FROM review_data rd
        WHERE rd.model = pd.model
          AND (rd.task_type = pd.task_type OR (rd.task_type IS NULL AND pd.task_type IS NULL))), 0) AS review_count,
      AVG(pd.duration_minutes) AS avg_duration_minutes,
      SUM(pd.input_tokens) AS total_input_tokens,
      SUM(pd.output_tokens) AS total_output_tokens,
      (SELECT AVG(rd.score) FROM review_data rd
        WHERE rd.model = pd.model
          AND (rd.task_type = pd.task_type OR (rd.task_type IS NULL AND pd.task_type IS NULL))) AS avg_review_score
    FROM phase_data pd
    GROUP BY pd.model, pd.task_type
    ORDER BY pd.model ASC, pd.task_type ASC
  `;
  return (db.prepare(sql).all(...params) as ModelPerfRow[]).map((r): CortexModelPerformance => ({
    model: r.model, task_type: r.task_type, phase_count: r.phase_count, review_count: r.review_count,
    avg_duration_minutes: r.avg_duration_minutes, total_input_tokens: r.total_input_tokens,
    total_output_tokens: r.total_output_tokens, avg_review_score: r.avg_review_score,
  }));
}

export function queryPhaseTiming(db: Database.Database): CortexPhaseTiming[] {
  return (
    db
      .prepare(
        `SELECT phase, COUNT(*) AS count,
         AVG(duration_minutes) AS avg_duration_minutes,
         MIN(duration_minutes) AS min_duration_minutes,
         MAX(duration_minutes) AS max_duration_minutes
         FROM phases WHERE duration_minutes IS NOT NULL GROUP BY phase ORDER BY phase ASC`,
      )
      .all() as PhaseTimingRow[]
  ).map((r): CortexPhaseTiming => ({
    phase: r.phase, count: r.count, avg_duration_minutes: r.avg_duration_minutes,
    min_duration_minutes: r.min_duration_minutes, max_duration_minutes: r.max_duration_minutes,
  }));
}

export function queryEventsSince(db: Database.Database, sinceId: number): CortexEvent[] {
  return (
    db
      .prepare(
        'SELECT id, session_id, task_id, source, event_type, data, created_at FROM events WHERE id > ? ORDER BY id ASC',
      )
      .all(sinceId) as RawEvent[]
  ).map(mapEvent);
}
