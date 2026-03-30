import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';
import { normalizeSessionId } from './session-id.js';

export function handleLogEvent(
  db: Database.Database,
  args: {
    session_id: string;
    task_id?: string;
    source: string;
    event_type: string;
    data?: Record<string, unknown>;
  },
): ToolResult {
  const dataJson = JSON.stringify(args.data ?? {});
  const sessionId = normalizeSessionId(args.session_id);

  try {
    const result = db.prepare(
      `INSERT INTO events (session_id, task_id, source, event_type, data)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, args.task_id ?? null, args.source, args.event_type, dataJson);

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: result.lastInsertRowid }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }] };
  }
}

export function handleQueryEvents(
  db: Database.Database,
  args: {
    session_id?: string;
    task_id?: string;
    event_type?: string;
    since?: string;
    limit?: number;
  },
): ToolResult {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const sessionId = args.session_id ? normalizeSessionId(args.session_id) : undefined;

  if (sessionId) {
    conditions.push('session_id = ?');
    params.push(sessionId);
  }
  if (args.task_id) {
    conditions.push('task_id = ?');
    params.push(args.task_id);
  }
  if (args.event_type) {
    conditions.push('event_type = ?');
    params.push(args.event_type);
  }
  if (args.since) {
    conditions.push('created_at >= ?');
    params.push(args.since);
  }

  // Use a bound parameter for LIMIT to stay consistent with the parameterized-query pattern.
  // Undefined limit → default 500. Explicit limit (including 0) → capped at 1000.
  const limit = args.limit !== undefined ? Math.min(Math.max(0, args.limit), 1000) : 500;
  params.push(limit);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT * FROM events ${where} ORDER BY id ASC LIMIT ?`,
  ).all(...params) as Array<Record<string, unknown>>;

  const parsed = rows.map((row) => {
    let data: unknown;
    try {
      data = JSON.parse(row.data as string);
    } catch {
      data = { _parse_error: true, raw: row.data };
    }
    return { ...row, data };
  });

  return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
}
