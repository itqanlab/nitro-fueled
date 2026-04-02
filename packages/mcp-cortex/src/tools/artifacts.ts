/**
 * MCP Tools: Task Artifact CRUD Operations
 *
 * Provides write/read tool pairs for all task artifact types that complement
 * the existing write_handoff/read_handoff tools. Each write tool validates
 * task_id existence before inserting. Each read tool returns structured data.
 *
 * Tool pairs:
 *   write_review / read_reviews
 *   write_test_report / read_test_report
 *   write_completion_report / read_completion_report
 *   write_plan / read_plan
 *   write_task_description / read_task_description
 *   write_context / read_context
 *   write_subtasks / read_subtasks
 *
 * Convenience:
 *   get_task_artifacts — returns all artifact types for a task in one call
 */

import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

// ── Shared helper ─────────────────────────────────────────────────────────────

/** Validate that a task_id exists. Returns the id string or null if not found. */
function requireTask(db: Database.Database, taskId: string): string | null {
  const row = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId) as { id: string } | undefined;
  return row?.id ?? null;
}

function notFound(taskId: string): ToolResult {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found', task_id: taskId }) }] };
}

function ok(data: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, ...data }) }] };
}

function err(reason: unknown): ToolResult {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: reason instanceof Error ? reason.message : String(reason) }) }] };
}

// ── Review ────────────────────────────────────────────────────────────────────

export interface ReviewRecord {
  id: number;
  task_id: string;
  review_type: 'style' | 'logic' | 'security' | 'visual' | 'other';
  verdict: 'PASS' | 'FAIL';
  findings: string;
  reviewer: string | null;
  created_at: string;
  updated_at: string;
}

export function handleWriteReview(
  db: Database.Database,
  args: {
    task_id: string;
    review_type: 'style' | 'logic' | 'security' | 'visual' | 'other';
    verdict: 'PASS' | 'FAIL';
    findings?: string;
    reviewer?: string;
  },
): ToolResult {
  try {
    const rowid = db.transaction(() => {
      if (!requireTask(db, args.task_id)) return null;
      const result = db.prepare(`
        INSERT INTO task_reviews (task_id, review_type, verdict, findings, reviewer)
        VALUES (?, ?, ?, ?, ?)
      `).run(args.task_id, args.review_type, args.verdict, args.findings ?? '', args.reviewer ?? null);
      return result.lastInsertRowid;
    })();

    if (rowid === null) return notFound(args.task_id);
    return ok({ id: rowid });
  } catch (e) {
    return err(e);
  }
}

export function handleReadReviews(
  db: Database.Database,
  args: { task_id: string; review_type?: string },
): ToolResult {
  try {
    const query = args.review_type
      ? db.prepare('SELECT * FROM task_reviews WHERE task_id = ? AND review_type = ? ORDER BY id ASC')
      : db.prepare('SELECT * FROM task_reviews WHERE task_id = ? ORDER BY id ASC');
    const rows = args.review_type
      ? query.all(args.task_id, args.review_type) as ReviewRecord[]
      : query.all(args.task_id) as ReviewRecord[];
    return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── Test Report ───────────────────────────────────────────────────────────────

export interface TestReportRecord {
  id: number;
  task_id: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  summary: string;
  details: string;
  created_at: string;
  updated_at: string;
}

export function handleWriteTestReport(
  db: Database.Database,
  args: {
    task_id: string;
    status: 'PASS' | 'FAIL' | 'SKIPPED';
    summary?: string;
    details?: string;
  },
): ToolResult {
  try {
    const rowid = db.transaction(() => {
      if (!requireTask(db, args.task_id)) return null;
      const result = db.prepare(`
        INSERT INTO task_test_reports (task_id, status, summary, details)
        VALUES (?, ?, ?, ?)
      `).run(args.task_id, args.status, args.summary ?? '', args.details ?? '');
      return result.lastInsertRowid;
    })();

    if (rowid === null) return notFound(args.task_id);
    return ok({ id: rowid });
  } catch (e) {
    return err(e);
  }
}

export function handleReadTestReport(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const row = db.prepare(
      'SELECT * FROM task_test_reports WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as TestReportRecord | undefined;

    if (!row) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_test_report_found' }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── Completion Report ─────────────────────────────────────────────────────────

export interface CompletionReportRecord {
  id: number;
  task_id: string;
  summary: string;
  review_results: string;
  test_results: string;
  follow_on_tasks: string;
  files_changed_count: number;
  created_at: string;
  updated_at: string;
}

export function handleWriteCompletionReport(
  db: Database.Database,
  args: {
    task_id: string;
    summary?: string;
    review_results?: string;
    test_results?: string;
    follow_on_tasks?: string;
    files_changed_count?: number;
  },
): ToolResult {
  try {
    const rowid = db.transaction(() => {
      if (!requireTask(db, args.task_id)) return null;
      const result = db.prepare(`
        INSERT INTO task_completion_reports
          (task_id, summary, review_results, test_results, follow_on_tasks, files_changed_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        args.task_id,
        args.summary ?? '',
        args.review_results ?? '',
        args.test_results ?? '',
        args.follow_on_tasks ?? '',
        args.files_changed_count ?? 0,
      );
      return result.lastInsertRowid;
    })();

    if (rowid === null) return notFound(args.task_id);
    return ok({ id: rowid });
  } catch (e) {
    return err(e);
  }
}

export function handleReadCompletionReport(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const row = db.prepare(
      'SELECT * FROM task_completion_reports WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as CompletionReportRecord | undefined;

    if (!row) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_completion_report_found' }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export interface PlanRecord {
  id: number;
  task_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function handleWritePlan(
  db: Database.Database,
  args: { task_id: string; content: string },
): ToolResult {
  try {
    const rowid = db.transaction(() => {
      if (!requireTask(db, args.task_id)) return null;
      const result = db.prepare(
        'INSERT INTO task_plans (task_id, content) VALUES (?, ?)',
      ).run(args.task_id, args.content);
      return result.lastInsertRowid;
    })();

    if (rowid === null) return notFound(args.task_id);
    return ok({ id: rowid });
  } catch (e) {
    return err(e);
  }
}

export function handleReadPlan(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const row = db.prepare(
      'SELECT * FROM task_plans WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as PlanRecord | undefined;

    if (!row) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_plan_found' }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── Task Description ──────────────────────────────────────────────────────────

export interface TaskDescriptionRecord {
  id: number;
  task_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function handleWriteTaskDescription(
  db: Database.Database,
  args: { task_id: string; content: string },
): ToolResult {
  try {
    const rowid = db.transaction(() => {
      if (!requireTask(db, args.task_id)) return null;
      const result = db.prepare(
        'INSERT INTO task_descriptions (task_id, content) VALUES (?, ?)',
      ).run(args.task_id, args.content);
      return result.lastInsertRowid;
    })();

    if (rowid === null) return notFound(args.task_id);
    return ok({ id: rowid });
  } catch (e) {
    return err(e);
  }
}

export function handleReadTaskDescription(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const row = db.prepare(
      'SELECT * FROM task_descriptions WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as TaskDescriptionRecord | undefined;

    if (!row) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_task_description_found' }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface ContextRecord {
  id: number;
  task_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function handleWriteContext(
  db: Database.Database,
  args: { task_id: string; content: string },
): ToolResult {
  try {
    const rowid = db.transaction(() => {
      if (!requireTask(db, args.task_id)) return null;
      const result = db.prepare(
        'INSERT INTO task_contexts (task_id, content) VALUES (?, ?)',
      ).run(args.task_id, args.content);
      return result.lastInsertRowid;
    })();

    if (rowid === null) return notFound(args.task_id);
    return ok({ id: rowid });
  } catch (e) {
    return err(e);
  }
}

export function handleReadContext(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const row = db.prepare(
      'SELECT * FROM task_contexts WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as ContextRecord | undefined;

    if (!row) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no_context_found' }) }] };
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

export interface SubtaskEntry {
  batch_number?: number;
  subtask_name: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
  assigned_to?: string;
}

export interface SubtaskRecord {
  id: number;
  task_id: string;
  batch_number: number;
  subtask_name: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Replace all subtasks for a task with a fresh list.
 * Runs as a single transaction: DELETE existing, INSERT new batch.
 */
export function handleWriteSubtasks(
  db: Database.Database,
  args: { task_id: string; subtasks: SubtaskEntry[] },
): ToolResult {
  try {
    const count = db.transaction((): number | null => {
      if (!requireTask(db, args.task_id)) return null;
      db.prepare('DELETE FROM task_subtasks WHERE task_id = ?').run(args.task_id);

      const insert = db.prepare(`
        INSERT INTO task_subtasks (task_id, batch_number, subtask_name, status, assigned_to)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const sub of args.subtasks) {
        insert.run(
          args.task_id,
          sub.batch_number ?? 1,
          sub.subtask_name,
          sub.status ?? 'PENDING',
          sub.assigned_to ?? null,
        );
      }
      return args.subtasks.length;
    })();

    if (count === null) return notFound(args.task_id);
    return ok({ inserted: count });
  } catch (e) {
    return err(e);
  }
}

export function handleReadSubtasks(
  db: Database.Database,
  args: { task_id: string; batch_number?: number },
): ToolResult {
  try {
    const rows = args.batch_number !== undefined
      ? (db.prepare('SELECT * FROM task_subtasks WHERE task_id = ? AND batch_number = ? ORDER BY id ASC').all(args.task_id, args.batch_number) as SubtaskRecord[])
      : (db.prepare('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY batch_number ASC, id ASC').all(args.task_id) as SubtaskRecord[]);
    return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}

// ── get_task_artifacts ────────────────────────────────────────────────────────

export interface TaskArtifacts {
  task_id: string;
  context: ContextRecord | null;
  task_description: TaskDescriptionRecord | null;
  plan: PlanRecord | null;
  reviews: ReviewRecord[];
  test_report: TestReportRecord | null;
  completion_report: CompletionReportRecord | null;
  subtasks: SubtaskRecord[];
}

export function handleGetTaskArtifacts(
  db: Database.Database,
  args: { task_id: string },
): ToolResult {
  try {
    const context = db.prepare(
      'SELECT * FROM task_contexts WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as ContextRecord | undefined;

    const taskDescription = db.prepare(
      'SELECT * FROM task_descriptions WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as TaskDescriptionRecord | undefined;

    const plan = db.prepare(
      'SELECT * FROM task_plans WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as PlanRecord | undefined;

    const reviews = db.prepare(
      'SELECT * FROM task_reviews WHERE task_id = ? ORDER BY id ASC',
    ).all(args.task_id) as ReviewRecord[];

    const testReport = db.prepare(
      'SELECT * FROM task_test_reports WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as TestReportRecord | undefined;

    const completionReport = db.prepare(
      'SELECT * FROM task_completion_reports WHERE task_id = ? ORDER BY id DESC LIMIT 1',
    ).get(args.task_id) as CompletionReportRecord | undefined;

    const subtasks = db.prepare(
      'SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY batch_number ASC, id ASC',
    ).all(args.task_id) as SubtaskRecord[];

    const artifacts: TaskArtifacts = {
      task_id: args.task_id,
      context: context ?? null,
      task_description: taskDescription ?? null,
      plan: plan ?? null,
      reviews,
      test_report: testReport ?? null,
      completion_report: completionReport ?? null,
      subtasks,
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(artifacts, null, 2) }] };
  } catch (e) {
    return err(e);
  }
}
