import type Database from 'better-sqlite3';
import type { LoopStatus } from '../db/schema.js';
import type { ToolResult } from './types.js';

// M1: 'ended_at' and 'summary' are updatable here; use end_session to set them atomically
// together with loop_status='stopped'. These are also allowed as direct updates for cases
// where the caller wants to set them independently.
const UPDATABLE_SESSION_COLUMNS = new Set([
  'loop_status', 'tasks_terminal', 'config', 'task_limit', 'source', 'ended_at', 'summary',
]);

export function handleCreateSession(
  db: Database.Database,
  args: { source?: string; config?: string; task_count?: number },
): ToolResult {
  const id = `SESSION_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const config = args.config ?? '{}';

  db.prepare(
    `INSERT INTO sessions (id, source, config, task_limit) VALUES (?, ?, ?, ?)`,
  ).run(id, args.source ?? null, config, args.task_count ?? null);

  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, session_id: id }) }] };
}

export function handleGetSession(
  db: Database.Database,
  args: { session_id: string },
): ToolResult {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(args.session_id) as Record<string, unknown> | undefined;
  if (!session) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
  }

  const workers = db.prepare(
    'SELECT id, task_id, worker_type, label, status, pid, model, provider FROM workers WHERE session_id = ?',
  ).all(args.session_id) as Array<Record<string, unknown>>;

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
  params.push(args.session_id);

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
  const now = new Date().toISOString();

  const info = db.prepare(
    `UPDATE sessions SET loop_status = 'stopped', ended_at = ?, summary = ?, updated_at = ? WHERE id = ?`,
  ).run(now, args.summary ?? null, now, args.session_id);

  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'session_not_found' }) }] };
  }

  const counters = db.prepare(
    `SELECT status, COUNT(*) as count FROM workers WHERE session_id = ? GROUP BY status`,
  ).all(args.session_id) as Array<{ status: string; count: number }>;

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ ok: true, final_counters: Object.fromEntries(counters.map((c) => [c.status, c.count])) }),
    }],
  };
}
