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
  CortexBuilderQuality,
  CortexLauncherMetrics,
  CortexRoutingRecommendation,
  CortexSkillUsage,
  RawWorker,
  RawPhase,
  RawReview,
  RawFixCycle,
  RawEvent,
  ModelPerfRow,
  PhaseTimingRow,
  BuilderQualityRow,
  LauncherMetricsRow,
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
  const tokens = parseJson<{ input?: number; output?: number; total_input?: number; total_output?: number }>(row.tokens_json, {});
  const cost = parseJson<{ total?: number; total_usd?: number }>(row.cost_json, {});
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
    cost: cost.total ?? cost.total_usd ?? 0,
    input_tokens: tokens.input ?? tokens.total_input ?? 0,
    output_tokens: tokens.output ?? tokens.total_output ?? 0,
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

export function queryWorkers(db: Database.Database, filters?: { sessionId?: string; status?: string; launcher?: string }): CortexWorker[] {
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
  if (filters?.launcher) {
    conditions.push('launcher = ?');
    params.push(filters.launcher);
  }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY spawn_time DESC';
  return (db.prepare(sql).all(...params) as RawWorker[]).map(mapWorker);
}

export function queryTaskTrace(db: Database.Database, taskId: string): CortexTaskTrace | null {
  // Return null when the task doesn't exist so controllers can distinguish 404 from 503
  const exists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
  if (!exists) return null;

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
  // Phase and review params are built separately then concatenated to match CTE bind order:
  // SQL scans phase_data CTE first (uses phaseParams), then review_data CTE (uses reviewParams).
  const phaseParams: string[] = [];
  const reviewParams: string[] = [];
  let phaseWhere = '';
  let reviewWhere = '';
  if (filters?.model) {
    phaseWhere += ' AND p.model = ?';
    phaseParams.push(filters.model);
    reviewWhere += ' AND r.model_that_reviewed = ?';
    reviewParams.push(filters.model);
  }
  if (filters?.taskType) {
    phaseWhere += ' AND t.type = ?';
    phaseParams.push(filters.taskType);
    reviewWhere += ' AND t.type = ?';
    reviewParams.push(filters.taskType);
  }
  const params = [...phaseParams, ...reviewParams];
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
    complexity: null, avg_cost_usd: null, failure_rate: null, last_run: null,
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

/**
 * Returns average review scores grouped by the model that BUILT the task (model_that_built),
 * not the model that performed the review. Use this for routing recommendations.
 */
export function queryBuilderQuality(db: Database.Database): CortexBuilderQuality[] {
  const sql = `
    SELECT
      r.model_that_built AS model,
      t.type AS task_type,
      COUNT(r.id) AS review_count,
      AVG(r.score) AS avg_builder_score
    FROM reviews r
    LEFT JOIN tasks t ON r.task_id = t.id
    WHERE r.model_that_built IS NOT NULL AND r.model_that_built != ''
    GROUP BY r.model_that_built, t.type
    ORDER BY r.model_that_built ASC, t.type ASC
  `;
  return (db.prepare(sql).all() as BuilderQualityRow[]).map((r): CortexBuilderQuality => ({
    model: r.model,
    task_type: r.task_type,
    review_count: r.review_count,
    avg_builder_score: r.avg_builder_score,
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

/**
 * Aggregates worker stats grouped by launcher.
 * Treats workers with outcome='COMPLETE' as completed; 'FAILED' as failed.
 */
export function queryLauncherMetrics(db: Database.Database): CortexLauncherMetrics[] {
  const sql = `
    SELECT
      COALESCE(launcher, 'unknown') AS launcher,
      COUNT(*) AS total_workers,
      SUM(CASE WHEN outcome = 'COMPLETE' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN outcome = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
      SUM(COALESCE(json_extract(cost_json, '$.total'), json_extract(cost_json, '$.total_usd'), 0)) AS total_cost,
      SUM(COALESCE(json_extract(tokens_json, '$.input'), json_extract(tokens_json, '$.total_input'), 0)) AS total_input_tokens,
      SUM(COALESCE(json_extract(tokens_json, '$.output'), json_extract(tokens_json, '$.total_output'), 0)) AS total_output_tokens
    FROM workers
    GROUP BY COALESCE(launcher, 'unknown')
    ORDER BY total_workers DESC
  `;
  return (db.prepare(sql).all() as LauncherMetricsRow[]).map((r): CortexLauncherMetrics => ({
    launcher: r.launcher,
    total_workers: r.total_workers,
    completed_count: r.completed_count,
    failed_count: r.failed_count,
    completion_rate: r.total_workers > 0 ? r.completed_count / r.total_workers : 0,
    total_cost: r.total_cost,
    total_input_tokens: r.total_input_tokens,
    total_output_tokens: r.total_output_tokens,
  }));
}

/**
 * Derives routing recommendations from builder quality data.
 * For each task_type, picks the model with the highest avg_builder_score.
 * Falls back to avg_duration_minutes from model performance for the same combination.
 */
export function queryRoutingRecommendations(db: Database.Database): CortexRoutingRecommendation[] {
  const sql = `
    WITH ranked AS (
      SELECT
        r.model_that_built AS model,
        t.type AS task_type,
        COUNT(r.id) AS evidence_count,
        AVG(r.score) AS avg_builder_score,
        ROW_NUMBER() OVER (
          PARTITION BY t.type
          ORDER BY AVG(r.score) DESC, COUNT(r.id) DESC
        ) AS rn
      FROM reviews r
      LEFT JOIN tasks t ON r.task_id = t.id
      WHERE r.model_that_built IS NOT NULL AND r.model_that_built != ''
        AND t.type IS NOT NULL
      GROUP BY r.model_that_built, t.type
    )
    SELECT model, task_type, evidence_count, avg_builder_score
    FROM ranked
    WHERE rn = 1
    ORDER BY task_type ASC
  `;
  interface RecommendationRow {
    model: string;
    task_type: string;
    evidence_count: number;
    avg_builder_score: number | null;
  }
  const rows = db.prepare(sql).all() as RecommendationRow[];

  // Fetch avg_duration per (model, task_type) from phases for additional context
  const durationSql = `
    SELECT p.model, t.type AS task_type, AVG(p.duration_minutes) AS avg_duration_minutes
    FROM phases p LEFT JOIN tasks t ON p.task_id = t.id
    WHERE p.duration_minutes IS NOT NULL AND t.type IS NOT NULL
    GROUP BY p.model, t.type
  `;
  interface DurationRow { model: string; task_type: string; avg_duration_minutes: number | null; }
  const durationRows = db.prepare(durationSql).all() as DurationRow[];
  const durationMap = new Map<string, number | null>();
  for (const d of durationRows) {
    durationMap.set(`${d.model}::${d.task_type}`, d.avg_duration_minutes);
  }

  return rows.map((r): CortexRoutingRecommendation => ({
    task_type: r.task_type,
    recommended_model: r.model,
    reason: `Best builder score across ${r.evidence_count} review${r.evidence_count !== 1 ? 's' : ''}`,
    avg_builder_score: r.avg_builder_score,
    avg_duration_minutes: durationMap.get(`${r.model}::${r.task_type}`) ?? null,
    evidence_count: r.evidence_count,
  }));
}

export function querySkillUsage(
  db: Database.Database,
  filters?: { period?: string },
): CortexSkillUsage[] {
  const period = filters?.period ?? '30d';

  let sinceExpr: string;
  const daysMatch = /^(\d+)d$/.exec(period);
  if (period === 'all') {
    sinceExpr = '';
  } else if (daysMatch) {
    sinceExpr = `invoked_at >= datetime('now', '-${parseInt(daysMatch[1], 10)} days')`;
  } else {
    // Default to 30d for unknown formats
    sinceExpr = `invoked_at >= datetime('now', '-30 days')`;
  }

  const where = sinceExpr ? `WHERE ${sinceExpr}` : '';
  const sql = `
    SELECT
      skill_name AS skill,
      COUNT(*) AS count,
      AVG(CAST(duration_ms AS REAL)) AS avg_duration_ms,
      MAX(invoked_at) AS last_used
    FROM skill_invocations
    ${where}
    GROUP BY skill_name
    ORDER BY count DESC
  `;

  interface SkillRow {
    skill: string;
    count: number;
    avg_duration_ms: number | null;
    last_used: string | null;
  }

  return (db.prepare(sql).all() as SkillRow[]).map((r): CortexSkillUsage => ({
    skill: r.skill,
    count: r.count,
    avg_duration_ms: r.avg_duration_ms,
    last_used: r.last_used,
  }));
}
