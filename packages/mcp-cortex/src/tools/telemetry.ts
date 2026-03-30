import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';
import { normalizeSessionId } from './session-id.js';

// ---------------------------------------------------------------------------
// log_phase
// ---------------------------------------------------------------------------

export function handleLogPhase(
  db: Database.Database,
  args: {
    worker_run_id: string;
    task_id?: string;
    phase: string;
    start: string;
    end: string;
    outcome: string;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
    metadata?: Record<string, unknown>;
  },
): ToolResult {
  try {
    const startMs = new Date(args.start).getTime();
    const endMs = new Date(args.end).getTime();
    const rawDuration = isNaN(startMs) || isNaN(endMs) ? null : (endMs - startMs) / 60_000;
    // Clamp to 0 to handle clock skew or caller errors
    const durationMinutes = rawDuration !== null ? Math.max(0, Math.round(rawDuration * 10) / 10) : null;

    const result = db.prepare(
      `INSERT INTO phases (worker_run_id, task_id, phase, model, start_time, end_time, duration_minutes, input_tokens, output_tokens, outcome, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.worker_run_id,
      args.task_id ?? null,
      args.phase,
      args.model ?? null,
      args.start,
      args.end,
      durationMinutes,
      args.input_tokens ?? null,
      args.output_tokens ?? null,
      args.outcome,
      args.metadata ? JSON.stringify(args.metadata) : null,
    );

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: result.lastInsertRowid }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// log_review
// ---------------------------------------------------------------------------

export function handleLogReview(
  db: Database.Database,
  args: {
    task_id: string;
    phase_id?: number;
    review_type: string;
    score: number;
    findings_count: number;
    critical_count?: number;
    serious_count?: number;
    minor_count?: number;
    model_that_built?: string;
    model_that_reviewed?: string;
    launcher_that_built?: string;
    launcher_that_reviewed?: string;
  },
): ToolResult {
  try {
    const taskExists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(args.task_id) as { id: string } | undefined;
    if (!taskExists) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }], isError: true };
    }

    const result = db.prepare(
      `INSERT INTO reviews (task_id, phase_id, review_type, score, findings_count, critical_count, serious_count, minor_count, model_that_built, model_that_reviewed, launcher_that_built, launcher_that_reviewed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.task_id,
      args.phase_id ?? null,
      args.review_type,
      args.score,
      args.findings_count,
      args.critical_count ?? 0,
      args.serious_count ?? 0,
      args.minor_count ?? 0,
      args.model_that_built ?? null,
      args.model_that_reviewed ?? null,
      args.launcher_that_built ?? null,
      args.launcher_that_reviewed ?? null,
    );

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: result.lastInsertRowid }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// log_fix_cycle
// ---------------------------------------------------------------------------

export function handleLogFixCycle(
  db: Database.Database,
  args: {
    task_id: string;
    phase_id?: number;
    fixes_applied: number;
    fixes_skipped?: number;
    required_manual?: number;
    model_that_fixed?: string;
    launcher_that_fixed?: string;
    duration_minutes?: number;
  },
): ToolResult {
  try {
    const taskExists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(args.task_id) as { id: string } | undefined;
    if (!taskExists) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }], isError: true };
    }

    const result = db.prepare(
      `INSERT INTO fix_cycles (task_id, phase_id, fixes_applied, fixes_skipped, required_manual, model_that_fixed, launcher_that_fixed, duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      args.task_id,
      args.phase_id ?? null,
      args.fixes_applied,
      args.fixes_skipped ?? 0,
      args.required_manual ?? 0,
      args.model_that_fixed ?? null,
      args.launcher_that_fixed ?? null,
      args.duration_minutes ?? null,
    );

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: result.lastInsertRowid }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// get_model_performance
// ---------------------------------------------------------------------------

export function handleGetModelPerformance(
  db: Database.Database,
  args: {
    task_type?: string;
    complexity?: string;
    model?: string;
    launcher?: string;
  },
): ToolResult {
  try {
    // Aggregate review scores per model/launcher combination
    const reviewConditions: string[] = [];
    const reviewParams: unknown[] = [];

    if (args.model) {
      reviewConditions.push('(r.model_that_built = ? OR r.model_that_reviewed = ?)');
      reviewParams.push(args.model, args.model);
    }
    if (args.launcher) {
      reviewConditions.push('(r.launcher_that_built = ? OR r.launcher_that_reviewed = ?)');
      reviewParams.push(args.launcher, args.launcher);
    }

    const reviewWhere = reviewConditions.length > 0 ? `WHERE ${reviewConditions.join(' AND ')}` : '';
    const reviewStats = db.prepare(
      `SELECT
         r.model_that_built,
         r.model_that_reviewed,
         r.launcher_that_built,
         r.review_type,
         COUNT(*) as review_count,
         ROUND(AVG(r.score), 2) as avg_score,
         ROUND(AVG(r.findings_count), 2) as avg_findings,
         ROUND(AVG(r.critical_count), 2) as avg_critical,
         ROUND(AVG(r.serious_count), 2) as avg_serious
       FROM reviews r
       ${reviewWhere}
       GROUP BY r.model_that_built, r.launcher_that_built, r.review_type
       ORDER BY avg_score DESC`,
    ).all(...reviewParams) as Array<Record<string, unknown>>;

    // Phase timing stats per model
    const phaseConditions: string[] = [];
    const phaseParams: unknown[] = [];
    if (args.model) {
      phaseConditions.push('p.model = ?');
      phaseParams.push(args.model);
    }
    if (args.task_type || args.complexity) {
      phaseConditions.push('p.task_id IN (SELECT id FROM tasks WHERE 1=1' +
        (args.task_type ? ' AND type = ?' : '') +
        (args.complexity ? ' AND complexity = ?' : '') +
        ')');
      if (args.task_type) phaseParams.push(args.task_type);
      if (args.complexity) phaseParams.push(args.complexity);
    }

    const phaseWhere = phaseConditions.length > 0 ? `WHERE ${phaseConditions.join(' AND ')}` : '';
    const phaseStats = db.prepare(
      `SELECT
         p.model,
         p.phase,
         COUNT(*) as run_count,
         ROUND(AVG(p.duration_minutes), 2) as avg_duration_m,
         ROUND(AVG(p.input_tokens), 0) as avg_input_tokens,
         ROUND(AVG(p.output_tokens), 0) as avg_output_tokens,
         SUM(CASE WHEN p.outcome = 'COMPLETE' THEN 1 ELSE 0 END) as successes,
         SUM(CASE WHEN p.outcome != 'COMPLETE' THEN 1 ELSE 0 END) as failures
       FROM phases p
       ${phaseWhere}
       GROUP BY p.model, p.phase
       ORDER BY p.model, p.phase`,
    ).all(...phaseParams) as Array<Record<string, unknown>>;

    // Fix cycle stats
    const fixConditions: string[] = [];
    const fixParams: unknown[] = [];
    if (args.model) {
      fixConditions.push('model_that_fixed = ?');
      fixParams.push(args.model);
    }
    if (args.launcher) {
      fixConditions.push('launcher_that_fixed = ?');
      fixParams.push(args.launcher);
    }

    const fixWhere = fixConditions.length > 0 ? `WHERE ${fixConditions.join(' AND ')}` : '';
    const fixStats = db.prepare(
      `SELECT
         model_that_fixed,
         launcher_that_fixed,
         COUNT(*) as fix_cycle_count,
         ROUND(AVG(fixes_applied), 2) as avg_fixes_applied,
         ROUND(AVG(fixes_skipped), 2) as avg_fixes_skipped,
         ROUND(AVG(required_manual), 2) as avg_required_manual
       FROM fix_cycles
       ${fixWhere}
       GROUP BY model_that_fixed, launcher_that_fixed`,
    ).all(...fixParams) as Array<Record<string, unknown>>;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ok: true,
          filters: { task_type: args.task_type, complexity: args.complexity, model: args.model, launcher: args.launcher },
          review_stats: reviewStats,
          phase_stats: phaseStats,
          fix_stats: fixStats,
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// get_task_trace
// ---------------------------------------------------------------------------

export function handleGetTaskTrace(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const task = db.prepare('SELECT id, title, type, priority, status, complexity FROM tasks WHERE id = ?').get(args.task_id) as Record<string, unknown> | undefined;
    if (!task) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }], isError: true };
    }

    const workers = db.prepare(
      'SELECT id, session_id, worker_type, label, status, model, provider, spawn_time FROM workers WHERE task_id = ? ORDER BY spawn_time',
    ).all(args.task_id) as Array<Record<string, unknown>>;

    const phases = db.prepare(
      `SELECT id, worker_run_id, task_id, phase, model, start_time, end_time, duration_minutes,
              input_tokens, output_tokens, outcome, created_at
       FROM phases WHERE task_id = ? ORDER BY start_time`,
    ).all(args.task_id) as Array<Record<string, unknown>>;

    const reviews = db.prepare(
      `SELECT id, task_id, phase_id, review_type, score, findings_count, critical_count,
              serious_count, minor_count, model_that_built, model_that_reviewed,
              launcher_that_built, launcher_that_reviewed, created_at
       FROM reviews WHERE task_id = ? ORDER BY id`,
    ).all(args.task_id) as Array<Record<string, unknown>>;

    const fixCycles = db.prepare(
      `SELECT id, task_id, phase_id, fixes_applied, fixes_skipped, required_manual,
              model_that_fixed, launcher_that_fixed, duration_minutes, created_at
       FROM fix_cycles WHERE task_id = ? ORDER BY id`,
    ).all(args.task_id) as Array<Record<string, unknown>>;

    const handoffs = db.prepare(
      'SELECT id, worker_type, created_at FROM handoffs WHERE task_id = ? ORDER BY id',
    ).all(args.task_id) as Array<Record<string, unknown>>;

    const events = db.prepare(
      'SELECT id, session_id, source, event_type, data, created_at FROM events WHERE task_id = ? ORDER BY id LIMIT 100',
    ).all(args.task_id) as Array<Record<string, unknown>>;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ok: true,
          task,
          workers,
          phases,
          reviews,
          fix_cycles: fixCycles,
          handoffs,
          events,
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// get_session_summary
// ---------------------------------------------------------------------------

export function handleGetSessionSummary(
  db: Database.Database,
  args: { session_id: string },
): ToolResult {
  try {
    const sessionId = normalizeSessionId(args.session_id);
    if (sessionId === null) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }], isError: true };
    }
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
    if (!session) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }], isError: true };
    }

    const workerSummary = db.prepare(
      `SELECT
         worker_type,
         status,
         COUNT(*) as count,
         model,
         provider
       FROM workers
       WHERE session_id = ?
       GROUP BY worker_type, status, model, provider`,
    ).all(sessionId) as Array<Record<string, unknown>>;

    const taskIds = (db.prepare(
      'SELECT DISTINCT task_id FROM workers WHERE session_id = ? AND task_id IS NOT NULL',
    ).all(sessionId) as Array<{ task_id: string }>).map(r => r.task_id);

    // Cost breakdown: sum from workers cost_json
    const workers = db.prepare(
      'SELECT cost_json, tokens_json, model, provider, spawn_time FROM workers WHERE session_id = ?',
    ).all(sessionId) as Array<{ cost_json: string; tokens_json: string; model: string | null; provider: string | null; spawn_time: string }>;

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheTokens = 0;
    const perModelCost: Record<string, number> = {};

    for (const w of workers) {
      try {
        const cost = JSON.parse(w.cost_json) as { total_usd?: number };
        const tokens = JSON.parse(w.tokens_json) as { total_input?: number; total_output?: number; total_cache_creation?: number; total_cache_read?: number };
        if (cost.total_usd != null) {
          totalCost += cost.total_usd;
          const key = w.model ?? 'unknown';
          perModelCost[key] = (perModelCost[key] ?? 0) + cost.total_usd;
        }
        if (tokens.total_input != null) totalInputTokens += tokens.total_input;
        if (tokens.total_output != null) totalOutputTokens += tokens.total_output;
        if (tokens.total_cache_creation != null) totalCacheTokens += tokens.total_cache_creation;
        if (tokens.total_cache_read != null) totalCacheTokens += tokens.total_cache_read;
      } catch { /* ignore */ }
    }

    // Elapsed time
    const startedAt = new Date(session['started_at'] as string).getTime();
    const endedAt = session['ended_at'] ? new Date(session['ended_at'] as string).getTime() : Date.now();
    const durationMinutes = Math.round((endedAt - startedAt) / 60_000);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ok: true,
          session_id: sessionId,
          source: session['source'],
          loop_status: session['loop_status'],
          started_at: session['started_at'],
          ended_at: session['ended_at'],
          duration_minutes: durationMinutes,
          tasks_terminal: session['tasks_terminal'],
          task_ids: taskIds,
          worker_summary: workerSummary,
          cost: {
            total_usd: Math.round(totalCost * 10000) / 10000,
            per_model: Object.fromEntries(Object.entries(perModelCost).map(([k, v]) => [k, Math.round(v * 10000) / 10000])),
          },
          tokens: {
            input: totalInputTokens,
            output: totalOutputTokens,
            cache: totalCacheTokens,
          },
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}
