import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

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

  const result = db.prepare(
    `INSERT INTO events (session_id, task_id, source, event_type, data)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(args.session_id, args.task_id ?? null, args.source, args.event_type, dataJson);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ ok: true, id: result.lastInsertRowid }),
    }],
  };
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

  if (args.session_id) {
    conditions.push('session_id = ?');
    params.push(args.session_id);
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = args.limit && args.limit > 0 ? `LIMIT ${Math.min(args.limit, 1000)}` : 'LIMIT 500';

  const rows = db.prepare(
    `SELECT * FROM events ${where} ORDER BY id ASC ${limitClause}`,
  ).all(...params) as Array<Record<string, unknown>>;

  const parsed = rows.map((row) => ({
    ...row,
    data: JSON.parse(row.data as string) as unknown,
  }));

  return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
}
