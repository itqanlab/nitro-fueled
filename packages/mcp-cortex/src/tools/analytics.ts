import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// log_skill_invocation
// ---------------------------------------------------------------------------

export function handleLogSkillInvocation(
  db: Database.Database,
  args: {
    skill_name: string;
    session_id?: string;
    worker_id?: string;
    task_id?: string;
    duration_ms?: number;
    outcome?: string;
  },
): ToolResult {
  try {
    const result = db.prepare(
      `INSERT INTO skill_invocations (skill_name, session_id, worker_id, task_id, invoked_at, duration_ms, outcome)
       VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?)`,
    ).run(
      args.skill_name,
      args.session_id ?? null,
      args.worker_id ?? null,
      args.task_id ?? null,
      args.duration_ms ?? null,
      args.outcome ?? null,
    );

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: result.lastInsertRowid }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}

// ---------------------------------------------------------------------------
// get_skill_usage
// ---------------------------------------------------------------------------

export function handleGetSkillUsage(
  db: Database.Database,
  args: {
    period?: string;
    skill_name?: string;
  },
): ToolResult {
  try {
    // Parse period — default 30d. Supported: Nd (days), Nh (hours)
    const periodStr = args.period ?? '30d';
    let sinceExpr: string;

    const daysMatch = /^(\d+)d$/.exec(periodStr);
    const hoursMatch = /^(\d+)h$/.exec(periodStr);

    if (daysMatch) {
      sinceExpr = `datetime('now', '-${parseInt(daysMatch[1], 10)} days')`;
    } else if (hoursMatch) {
      sinceExpr = `datetime('now', '-${parseInt(hoursMatch[1], 10)} hours')`;
    } else {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid period format — use Nd (days) or Nh (hours), e.g. 30d or 24h' }) }],
        isError: true,
      };
    }

    const conditions: string[] = [`invoked_at >= ${sinceExpr}`];
    const params: unknown[] = [];

    if (args.skill_name) {
      conditions.push('skill_name = ?');
      params.push(args.skill_name);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const rows = db.prepare(
      `SELECT
         skill_name,
         COUNT(*) as invocation_count,
         SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END) as failure_count,
         ROUND(AVG(duration_ms), 0) as avg_duration_ms,
         MIN(invoked_at) as first_seen,
         MAX(invoked_at) as last_seen
       FROM skill_invocations
       ${where}
       GROUP BY skill_name
       ORDER BY invocation_count DESC`,
    ).all(...params) as Array<Record<string, unknown>>;

    const total = rows.reduce((sum, r) => sum + (r['invocation_count'] as number), 0);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ok: true,
          period: periodStr,
          total_invocations: total,
          skills: rows,
        }, null, 2),
      }],
    };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }], isError: true };
  }
}
