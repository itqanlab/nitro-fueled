import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';
import { normalizeSessionId } from './session-id.js';

// ---------------------------------------------------------------------------
// get_worker_telemetry
// ---------------------------------------------------------------------------

export function handleGetWorkerTelemetry(
  db: Database.Database,
  args: { worker_id: string },
): ToolResult {
  try {
    const row = db.prepare(`
      SELECT id, session_id, task_id, worker_type, label, status, pid,
             working_directory, model, provider, launcher, log_path,
             auto_close, spawn_time, last_health, stuck_count, compaction_count,
             tokens_json, cost_json, progress_json, outcome, retry_number,
             spawn_to_first_output_ms, total_duration_ms,
             files_changed_count, files_changed,
             review_result, review_findings_count, workflow_phase
      FROM workers WHERE id = ?
    `).get(args.worker_id) as Record<string, unknown> | undefined;

    if (!row) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'worker_not_found' }) }], isError: true };
    }

    let tokens: Record<string, unknown> = {};
    let cost: Record<string, unknown> = {};
    try { tokens = JSON.parse(row['tokens_json'] as string) as Record<string, unknown>; } catch { /* empty */ }
    try { cost = JSON.parse(row['cost_json'] as string) as Record<string, unknown>; } catch { /* empty */ }

    let filesChanged: unknown[] = [];
    if (row['files_changed']) {
      try { filesChanged = JSON.parse(row['files_changed'] as string) as unknown[]; } catch { /* empty */ }
    }

    const spawnMs = new Date(row['spawn_time'] as string).getTime();
    const elapsedMs = row['total_duration_ms'] != null
      ? (row['total_duration_ms'] as number)
      : Date.now() - spawnMs;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ok: true,
          worker_id: row['id'],
          session_id: row['session_id'],
          task_id: row['task_id'],
          worker_type: row['worker_type'],
          label: row['label'],
          status: row['status'],
          outcome: row['outcome'],
          retry_number: row['retry_number'],
          workflow_phase: row['workflow_phase'],
          model: row['model'],
          provider: row['provider'],
          launcher: row['launcher'],
          timing: {
            spawn_time: row['spawn_time'],
            spawn_to_first_output_ms: row['spawn_to_first_output_ms'],
            total_duration_ms: elapsedMs,
          },
          tokens,
          cost,
          review: {
            result: row['review_result'],
            findings_count: row['review_findings_count'],
          },
          files: {
            changed_count: row['files_changed_count'],
            changed: filesChanged,
          },
          health: {
            last_health: row['last_health'],
            stuck_count: row['stuck_count'],
            compaction_count: row['compaction_count'],
          },
          pid: row['pid'],
          log_path: row['log_path'],
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// get_session_telemetry
// ---------------------------------------------------------------------------

export function handleGetSessionTelemetry(
  db: Database.Database,
  args: { session_id: string },
): ToolResult {
  try {
    const sessionId = normalizeSessionId(args.session_id);
    if (sessionId === null) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }], isError: true };
    }

    const session = db.prepare('SELECT id, source, started_at, ended_at, loop_status FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
    if (!session) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }], isError: true };
    }

    const workers = db.prepare(`
      SELECT id, task_id, worker_type, label, status, model, provider, launcher,
             spawn_time, outcome, retry_number, workflow_phase,
             spawn_to_first_output_ms, total_duration_ms,
             files_changed_count, review_result, review_findings_count,
             tokens_json, cost_json, stuck_count, compaction_count
      FROM workers WHERE session_id = ? ORDER BY spawn_time
    `).all(sessionId) as Array<Record<string, unknown>>;

    // Aggregate metrics
    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalFilesChanged = 0;
    let totalReviewFindings = 0;
    let totalSpawnToFirstOutputMs = 0;
    let spawnToFirstOutputCount = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    const byPhase: Record<string, { count: number; completed: number; failed: number }> = {};
    const byModel: Record<string, { count: number; total_cost_usd: number }> = {};

    for (const w of workers) {
      try {
        const cost = JSON.parse(w['cost_json'] as string) as { total_usd?: number };
        const tokens = JSON.parse(w['tokens_json'] as string) as { total_input?: number; total_output?: number };
        if (cost.total_usd != null) totalCostUsd += cost.total_usd;
        if (tokens.total_input != null) totalInputTokens += tokens.total_input;
        if (tokens.total_output != null) totalOutputTokens += tokens.total_output;
      } catch { /* empty */ }

      if (w['files_changed_count'] != null) totalFilesChanged += w['files_changed_count'] as number;
      if (w['review_findings_count'] != null) totalReviewFindings += w['review_findings_count'] as number;
      if (w['spawn_to_first_output_ms'] != null) {
        totalSpawnToFirstOutputMs += w['spawn_to_first_output_ms'] as number;
        spawnToFirstOutputCount++;
      }
      if (w['total_duration_ms'] != null) {
        totalDurationMs += w['total_duration_ms'] as number;
        durationCount++;
      }

      const phase = (w['workflow_phase'] as string | null) ?? 'unknown';
      if (!byPhase[phase]) byPhase[phase] = { count: 0, completed: 0, failed: 0 };
      byPhase[phase].count++;
      if (w['outcome'] === 'COMPLETE' || w['status'] === 'completed') byPhase[phase].completed++;
      if (w['outcome'] === 'FAILED' || w['status'] === 'failed') byPhase[phase].failed++;

      const model = (w['model'] as string | null) ?? 'unknown';
      if (!byModel[model]) byModel[model] = { count: 0, total_cost_usd: 0 };
      byModel[model].count++;
      try {
        const cost = JSON.parse(w['cost_json'] as string) as { total_usd?: number };
        if (cost.total_usd != null) byModel[model].total_cost_usd += cost.total_usd;
      } catch { /* empty */ }
    }

    const startedAt = new Date(session['started_at'] as string).getTime();
    const endedAt = session['ended_at'] ? new Date(session['ended_at'] as string).getTime() : Date.now();

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
          total_duration_ms: endedAt - startedAt,
          worker_count: workers.length,
          aggregates: {
            total_cost_usd: Math.round(totalCostUsd * 10000) / 10000,
            total_input_tokens: totalInputTokens,
            total_output_tokens: totalOutputTokens,
            total_files_changed: totalFilesChanged,
            total_review_findings: totalReviewFindings,
            avg_spawn_to_first_output_ms: spawnToFirstOutputCount > 0
              ? Math.round(totalSpawnToFirstOutputMs / spawnToFirstOutputCount)
              : null,
            avg_worker_duration_ms: durationCount > 0
              ? Math.round(totalDurationMs / durationCount)
              : null,
          },
          by_phase: byPhase,
          by_model: Object.fromEntries(
            Object.entries(byModel).map(([k, v]) => [k, { ...v, total_cost_usd: Math.round(v.total_cost_usd * 10000) / 10000 }]),
          ),
          workers: workers.map(w => ({
            id: w['id'],
            task_id: w['task_id'],
            worker_type: w['worker_type'],
            label: w['label'],
            status: w['status'],
            outcome: w['outcome'],
            model: w['model'],
            provider: w['provider'],
            workflow_phase: w['workflow_phase'],
            retry_number: w['retry_number'],
            spawn_to_first_output_ms: w['spawn_to_first_output_ms'],
            total_duration_ms: w['total_duration_ms'],
            files_changed_count: w['files_changed_count'],
            review_result: w['review_result'],
            review_findings_count: w['review_findings_count'],
          })),
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

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
      } catch (err) {
        console.error(`[nitro-cortex] get_session_summary: failed to parse cost/tokens for worker, skipping`, err);
      }
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
