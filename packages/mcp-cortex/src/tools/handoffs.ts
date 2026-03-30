import type Database from 'better-sqlite3';
import type { WorkerType } from '../db/schema.js';
import type { ToolResult } from './types.js';

export interface HandoffFileEntry {
  path: string;
  action: 'new' | 'modified' | 'deleted' | string;
  lines?: number;
}

export interface PrepFilesTouchEntry {
  path: string;
  action: 'new' | 'modify' | 'delete';
  why: string;
}

export interface PrepBatchEntry {
  summary: string;
  files: string[];
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

export interface PrepHandoffRecord {
  id: number;
  task_id: string;
  worker_type: 'prep';
  implementation_plan_summary: string;
  files_to_touch: PrepFilesTouchEntry[];
  batches: PrepBatchEntry[];
  key_decisions: string[];
  gotchas: string[];
  created_at: string;
}

/**
 * Write a build/review handoff with the standard schema (files_changed, commits, decisions, risks).
 * Also used for implement/cleanup worker types that share the same schema.
 */
export function handleWriteHandoff(
  db: Database.Database,
  args: {
    task_id: string;
    worker_type: string;
    files_changed?: HandoffFileEntry[];
    commits?: string[];
    decisions?: string[];
    risks?: string[];
    implementation_plan_summary?: string;
    files_to_touch?: PrepFilesTouchEntry[];
    batches?: PrepBatchEntry[];
    key_decisions?: string[];
    gotchas?: string[];
  },
): ToolResult {
  // For prep worker type, store prep-specific fields in the JSON columns
  // files_changed -> files_to_touch, commits -> batches, decisions -> key_decisions, risks -> gotchas
  // Plus implementation_plan_summary is stored in files_changed as a wrapper
  const isPrepHandoff = args.worker_type === 'prep';

  const filesJson = isPrepHandoff
    ? JSON.stringify(args.files_to_touch ?? [])
    : JSON.stringify(args.files_changed ?? []);
  const commitsJson = isPrepHandoff
    ? JSON.stringify(args.batches ?? [])
    : JSON.stringify(args.commits ?? []);
  const decisionsJson = isPrepHandoff
    ? JSON.stringify(args.key_decisions ?? [])
    : JSON.stringify(args.decisions ?? []);
  const risksJson = isPrepHandoff
    ? JSON.stringify({ implementation_plan_summary: args.implementation_plan_summary ?? '', gotchas: args.gotchas ?? [] })
    : JSON.stringify(args.risks ?? []);

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
  args: { task_id: string; worker_type?: string },
): ToolResult {
  // Default to 'build' for backward compatibility when no worker_type specified
  const workerType = args.worker_type ?? 'build';

  const row = db.prepare(
    'SELECT * FROM handoffs WHERE task_id = ? AND worker_type = ? ORDER BY id DESC LIMIT 1',
  ).get(args.task_id, workerType) as HandoffRow | undefined;

  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_handoff_found' }) }] };
  }

  try {
    if (row.worker_type === 'prep') {
      const risksData = JSON.parse(row.risks) as { implementation_plan_summary: string; gotchas: string[] };
      const parsed: PrepHandoffRecord = {
        id: row.id,
        task_id: row.task_id,
        worker_type: 'prep',
        implementation_plan_summary: risksData.implementation_plan_summary ?? '',
        files_to_touch: JSON.parse(row.files_changed) as PrepFilesTouchEntry[],
        batches: JSON.parse(row.commits) as PrepBatchEntry[],
        key_decisions: JSON.parse(row.decisions) as string[],
        gotchas: risksData.gotchas ?? [],
        created_at: row.created_at,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    }

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
