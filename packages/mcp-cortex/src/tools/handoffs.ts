import type Database from 'better-sqlite3';
import type { WorkerType } from '../db/schema.js';
import type { ToolResult } from './types.js';

export interface HandoffFileEntry {
  path: string;
  action: 'new' | 'modified' | 'deleted' | string;
  lines?: number;
}

interface HandoffRow {
  id: number;
  task_id: string;
  worker_type: string;
  files_changed: string;
  commits: string;
  decisions: string;
  risks: string;
  created_at: string;
}

export interface HandoffRecord {
  id: number;
  task_id: string;
  worker_type: WorkerType;
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
  const filesJson = JSON.stringify(args.files_changed ?? []);
  const commitsJson = JSON.stringify(args.commits ?? []);
  const decisionsJson = JSON.stringify(args.decisions ?? []);
  const risksJson = JSON.stringify(args.risks ?? []);

  try {
    const rowid = db.transaction(() => {
      // Validate task FK inside the transaction to make the check + insert atomic
      const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(args.task_id) as { id: string } | undefined;
      if (!task) return null;

      const result = db.prepare(
        `INSERT INTO handoffs (task_id, worker_type, files_changed, commits, decisions, risks)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(args.task_id, args.worker_type, filesJson, commitsJson, decisionsJson, risksJson);

      return result.lastInsertRowid;
    })();

    if (rowid === null) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }] };
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: rowid }) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }) }] };
  }
}

export function handleReadHandoff(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  const row = db.prepare(
    'SELECT * FROM handoffs WHERE task_id = ? ORDER BY id DESC LIMIT 1',
  ).get(args.task_id) as HandoffRow | undefined;

  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_handoff_found' }) }] };
  }

  try {
    const parsed: HandoffRecord = {
      id: row.id,
      task_id: row.task_id,
      worker_type: row.worker_type as WorkerType,
      files_changed: JSON.parse(row.files_changed) as HandoffFileEntry[],
      commits: JSON.parse(row.commits) as string[],
      decisions: JSON.parse(row.decisions) as string[],
      risks: JSON.parse(row.risks) as string[],
      created_at: row.created_at,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'json_parse_error', detail: err instanceof Error ? err.message : String(err) }) }] };
  }
}
