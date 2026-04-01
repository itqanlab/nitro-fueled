import type Database from 'better-sqlite3';
import type { LoopStatus } from '../db/schema.js';
import type { ToolResult } from './types.js';
import { buildSessionId, normalizeSessionId } from './session-id.js';
import { handleReleaseOrphanedClaims } from './tasks.js';

// M1: 'ended_at' and 'summary' are updatable here; use end_session to set them atomically
// together with loop_status='stopped'. These are also allowed as direct updates for cases
// where the caller wants to set them independently.
const UPDATABLE_SESSION_COLUMNS = new Set([
  'loop_status', 'tasks_terminal', 'config', 'task_limit', 'source', 'ended_at', 'summary',
  'supervisor_model', 'supervisor_launcher', 'mode', 'total_cost', 'total_input_tokens', 'total_output_tokens',
]);

export function handleCreateSession(
  db: Database.Database,
  args: { source?: string; config?: string; task_count?: number; skip_orphan_recovery?: boolean },
): ToolResult {
  const id = buildSessionId();
  const config = args.config ?? '{}';

  db.prepare(
    `INSERT INTO sessions (id, source, config, task_limit) VALUES (?, ?, ?, ?)`,
  ).run(id, args.source ?? null, config, args.task_count ?? null);

  let recoveryResult: { orphaned_claims_released: number; task_ids: string[] } | null = null;
  if (!args.skip_orphan_recovery) {
    const releaseResult = handleReleaseOrphanedClaims(db);
    try {
      const released = JSON.parse((releaseResult.content[0] as { text: string }).text) as { released: number; tasks: string[] };
      // Only include orphan_recovery in the response when claims were actually released
      if (released.released > 0) {
        recoveryResult = { orphaned_claims_released: released.released, task_ids: released.tasks };
      }
    } catch {
      // If parsing fails, don't block session creation — best-effort logging only
    }
  }

  const result: { ok: true; session_id: string; orphan_recovery?: typeof recoveryResult } = {
    ok: true,
    session_id: id,
  };
  if (recoveryResult !== null) {
    result.orphan_recovery = recoveryResult;
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

export function handleGetSession(
  db: Database.Database,
  args: { session_id: string },
): ToolResult {
  const sessionId = normalizeSessionId(args.session_id);
  if (sessionId === null) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }] };
  }
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
  if (!session) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
  }

  const workers = db.prepare(
    'SELECT id, task_id, worker_type, label, status, pid, model, provider FROM workers WHERE session_id = ?',
  ).all(sessionId) as Array<Record<string, unknown>>;

  const activeWorkers = workers.filter((w) => w.status === 'active');
  const completedWorkers = workers.filter((w) => w.status === 'completed');
  const failedWorkers = workers.filter((w) => w.status === 'failed' || w.status === 'killed');

  const result = {
    ...session,
    workers: { active: activeWorkers, completed: completedWorkers, failed: failedWorkers },
    worker_count: { active: activeWorkers.length, completed: completedWorkers.length, failed: failedWorkers.length },
  };

  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

export function handleUpdateSession(
  db: Database.Database,
  args: { session_id: string; fields: Record<string, unknown> },
): ToolResult {
  const sessionId = normalizeSessionId(args.session_id);
  if (sessionId === null) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }] };
  }
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(args.fields)) {
    if (!UPDATABLE_SESSION_COLUMNS.has(key)) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: `column '${key}' not updatable` }) }] };
    }
    sets.push(`${key} = ?`);
    params.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
  }

  if (sets.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no fields provided' }) }] };
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(sessionId);

  const info = db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}

export function handleListSessions(
  db: Database.Database,
  args: { status?: string },
): ToolResult {
  let rows: Array<Record<string, unknown>>;
  if (args.status) {
    rows = db.prepare('SELECT * FROM sessions WHERE loop_status = ? ORDER BY started_at DESC').all(args.status) as Array<Record<string, unknown>>;
  } else {
    rows = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as Array<Record<string, unknown>>;
  }

  for (const row of rows) {
    const counts = db.prepare(
      `SELECT status, COUNT(*) as count FROM workers WHERE session_id = ? GROUP BY status`,
    ).all(row.id as string) as Array<{ status: string; count: number }>;
    row.worker_counts = Object.fromEntries(counts.map((c) => [c.status, c.count]));
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
}

export function handleEndSession(
  db: Database.Database,
  args: { session_id: string; summary?: string },
): ToolResult {
  const sessionId = normalizeSessionId(args.session_id);
  if (sessionId === null) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }] };
  }
  const now = new Date().toISOString();

  const info = db.prepare(
    `UPDATE sessions SET loop_status = 'stopped', ended_at = ?, summary = ?, updated_at = ? WHERE id = ?`,
  ).run(now, args.summary ?? null, now, sessionId);

  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
  }

  const counters = db.prepare(
    `SELECT status, COUNT(*) as count FROM workers WHERE session_id = ? GROUP BY status`,
  ).all(sessionId) as Array<{ status: string; count: number }>;

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ ok: true, final_counters: Object.fromEntries(counters.map((c) => [c.status, c.count])) }),
    }],
  };
}

export function handleUpdateHeartbeat(
  db: Database.Database,
  args: { session_id: string },
): ToolResult {
  const sessionId = normalizeSessionId(args.session_id);
  if (sessionId === null) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }] };
  }
  const now = new Date().toISOString();

  const info = db.prepare(
    `UPDATE sessions SET last_heartbeat = ?, updated_at = ? WHERE id = ?`,
  ).run(now, now, sessionId);

  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}

export function handleEvaluateSession(
  db: Database.Database,
  args: { session_id: string },
): ToolResult {
  try {
    const sessionId = normalizeSessionId(args.session_id);
    if (sessionId === null) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid_session_id_format' }) }] };
    }

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
    if (!session) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
    }

    // Gather task info for this session
    const sessionTasks = db.prepare(
      `SELECT t.id, t.status FROM tasks t WHERE t.session_claimed = ?`,
    ).all(sessionId) as Array<{ id: string; status: string }>;
    const taskCount = sessionTasks.length;
    const taskIds = sessionTasks.map((t) => t.id);

    // --- Quality (35%) ---
    let avgReviewScore = 0;
    let blockingFindingsPerTask = 0;
    if (taskCount > 0 && taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(',');
      const reviewRows = db.prepare(
        `SELECT AVG(score) as avg_score, SUM(critical_count) as total_critical, COUNT(*) as review_count
         FROM reviews WHERE task_id IN (${placeholders})`,
      ).get(...taskIds) as { avg_score: number | null; total_critical: number | null; review_count: number } | undefined;

      if (reviewRows && reviewRows.review_count > 0) {
        avgReviewScore = reviewRows.avg_score ?? 0;
        blockingFindingsPerTask = (reviewRows.total_critical ?? 0) / taskCount;
      }
    }

    const lessonViolationRate = 0.0; // Not available from DB alone — reserved for future
    const blockingPenalty = Math.min(blockingFindingsPerTask, 10);
    const qualityScore = Math.min(10, Math.max(0,
      avgReviewScore * 0.7 + (10 - blockingPenalty) * 0.3,
    ));

    // --- Efficiency (30%) ---
    const workerRows = db.prepare(
      `SELECT status, compaction_count, cost_json FROM workers WHERE session_id = ?`,
    ).all(sessionId) as Array<{ status: string; compaction_count: number; cost_json: string }>;
    const totalWorkers = workerRows.length;
    const killedWorkers = workerRows.filter((w) => w.status === 'killed').length;
    const killRate = totalWorkers > 0 ? killedWorkers / totalWorkers : 0;
    const totalCompactions = workerRows.reduce((sum, w) => sum + (w.compaction_count ?? 0), 0);
    const compactionRate = totalWorkers > 0 ? totalCompactions / totalWorkers : 0;

    let totalSessionCost = 0;
    for (const w of workerRows) {
      try {
        const cost = JSON.parse(w.cost_json) as { total_usd?: number };
        totalSessionCost += cost.total_usd ?? 0;
      } catch {
        // ignore malformed cost_json
      }
    }
    const avgCostPerTask = taskCount > 0 ? totalSessionCost / taskCount : 0;

    const efficiencyScore = Math.min(10, Math.max(0,
      10 - (killRate * 10 * 1.5) - (compactionRate * 0.5),
    ));

    // --- Process (20%) ---
    const phaseRows = db.prepare(
      `SELECT outcome FROM phases WHERE task_id IN (${taskIds.length > 0 ? taskIds.map(() => '?').join(',') : 'NULL'})`,
    ).all(...(taskIds.length > 0 ? taskIds : [])) as Array<{ outcome: string | null }>;
    const totalPhases = phaseRows.length;
    const completePhases = phaseRows.filter((p) => p.outcome === 'COMPLETE').length;
    const phaseCompletionRate = totalPhases > 0 ? completePhases / totalPhases : 0;

    let handoffRate = 0;
    if (taskCount > 0 && taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(',');
      const handoffRow = db.prepare(
        `SELECT COUNT(DISTINCT task_id) as handoff_count FROM handoffs WHERE task_id IN (${placeholders})`,
      ).get(...taskIds) as { handoff_count: number } | undefined;
      handoffRate = (handoffRow?.handoff_count ?? 0) / taskCount;
    }

    const processScore = Math.min(10, Math.max(0,
      (phaseCompletionRate * 0.6 + handoffRate * 0.4) * 10,
    ));

    // --- Outcome (15%) ---
    const completeTaskCount = sessionTasks.filter((t) => t.status === 'COMPLETE').length;
    const completeRate = taskCount > 0 ? completeTaskCount / taskCount : 0;

    let firstAttemptPassRate = 0;
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(',');
      // Tasks with a review_result='PASS' worker where retry_number=0
      const passRow = db.prepare(
        `SELECT COUNT(DISTINCT task_id) as pass_count
         FROM workers
         WHERE task_id IN (${placeholders})
           AND review_result = 'PASS'
           AND retry_number = 0`,
      ).get(...taskIds) as { pass_count: number } | undefined;

      const reviewedTaskRow = db.prepare(
        `SELECT COUNT(DISTINCT task_id) as reviewed_count
         FROM workers
         WHERE task_id IN (${placeholders})
           AND review_result IS NOT NULL`,
      ).get(...taskIds) as { reviewed_count: number } | undefined;

      const reviewedCount = reviewedTaskRow?.reviewed_count ?? 0;
      firstAttemptPassRate = reviewedCount > 0 ? (passRow?.pass_count ?? 0) / reviewedCount : 0;
    }

    const outcomeScore = Math.min(10, Math.max(0,
      (completeRate * 0.7 + firstAttemptPassRate * 0.3) * 10,
    ));

    // --- Overall ---
    const overallScore = (
      qualityScore * 0.35 +
      efficiencyScore * 0.30 +
      processScore * 0.20 +
      outcomeScore * 0.15
    );

    const signals = {
      task_count: taskCount,
      avg_review_score: avgReviewScore,
      lesson_violation_rate: lessonViolationRate,
      blocking_findings_per_task: blockingFindingsPerTask,
      blocking_penalty: blockingPenalty,
      total_workers: totalWorkers,
      killed_workers: killedWorkers,
      kill_rate: killRate,
      total_compactions: totalCompactions,
      compaction_rate: compactionRate,
      total_session_cost_usd: totalSessionCost,
      avg_cost_per_task_usd: avgCostPerTask,
      total_phases: totalPhases,
      complete_phases: completePhases,
      phase_completion_rate: phaseCompletionRate,
      handoff_rate: handoffRate,
      complete_task_count: completeTaskCount,
      complete_rate: completeRate,
      first_attempt_pass_rate: firstAttemptPassRate,
    };

    const signalsJson = JSON.stringify(signals);

    const insertResult = db.prepare(
      `INSERT INTO session_evaluations
         (session_id, overall_score, quality_score, efficiency_score, process_score, outcome_score, signals_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(sessionId, overallScore, qualityScore, efficiencyScore, processScore, outcomeScore, signalsJson);

    const result = {
      ok: true,
      session_id: sessionId,
      score_card: {
        overall: Math.round(overallScore * 100) / 100,
        quality: Math.round(qualityScore * 100) / 100,
        efficiency: Math.round(efficiencyScore * 100) / 100,
        process: Math.round(processScore * 100) / 100,
        outcome: Math.round(outcomeScore * 100) / 100,
      },
      signals,
      evaluation_id: insertResult.lastInsertRowid,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: message }) }],
      isError: true,
    };
  }
}

export function handleCloseStaleSessions(
  db: Database.Database,
  args: { ttl_minutes?: number },
): ToolResult {
  const ttlMinutes = args.ttl_minutes ?? 30;
  const cutoffTime = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();

  const staleSessions = db.prepare(
    `SELECT id FROM sessions WHERE loop_status = 'running' AND (last_heartbeat IS NULL OR last_heartbeat < ?)`,
  ).all(cutoffTime) as Array<{ id: string }>;

  let closedCount = 0;
  if (staleSessions.length > 0) {
    const now = new Date().toISOString();
    const updateStmt = db.prepare(
      `UPDATE sessions SET loop_status = 'stopped', ended_at = ?, summary = ?, updated_at = ? WHERE id = ?`,
    );

    for (const session of staleSessions) {
      updateStmt.run(now, 'stale: no heartbeat', now, session.id);
      closedCount++;
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ ok: true, closed_sessions: closedCount }),
    }],
  };
}
