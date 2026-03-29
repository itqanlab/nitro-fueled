import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

export interface HandoffFileEntry {
  path: string;
  action: string;
  lines?: number;
}

export interface HandoffRecord {
  id: number;
  task_id: string;
  worker_type: string;
  files_changed: HandoffFileEntry[];
  commits: string[];
  decisions: string[];
  risks: string[];
  created_at: string;
}

export function handleWriteHandoff(
  db: Database.Database,
  args: {
    task_id: string;
    worker_type: string;
    files_changed: HandoffFileEntry[];
    commits: string[];
    decisions: string[];
    risks: string[];
  },
): ToolResult {
  // Validate task exists
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(args.task_id) as { id: string } | undefined;
  if (!task) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }] };
  }

  const filesJson = JSON.stringify(args.files_changed);
  const commitsJson = JSON.stringify(args.commits);
  const decisionsJson = JSON.stringify(args.decisions);
  const risksJson = JSON.stringify(args.risks);

  const result = db.prepare(
    `INSERT INTO handoffs (task_id, worker_type, files_changed, commits, decisions, risks)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(args.task_id, args.worker_type, filesJson, commitsJson, decisionsJson, risksJson);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ ok: true, id: result.lastInsertRowid }),
    }],
  };
}

export function handleReadHandoff(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  const row = db.prepare(
    'SELECT * FROM handoffs WHERE task_id = ? ORDER BY id DESC LIMIT 1',
  ).get(args.task_id) as Record<string, unknown> | undefined;

  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_handoff_found' }) }] };
  }

  const parsed: HandoffRecord = {
    id: row.id as number,
    task_id: row.task_id as string,
    worker_type: row.worker_type as string,
    files_changed: JSON.parse(row.files_changed as string) as HandoffFileEntry[],
    commits: JSON.parse(row.commits as string) as string[],
    decisions: JSON.parse(row.decisions as string) as string[],
    risks: JSON.parse(row.risks as string) as string[],
    created_at: row.created_at as string,
  };

  return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
}
