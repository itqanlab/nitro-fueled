import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ToolResult } from './types.js';

const SUBTASK_ID_RE = /^(TASK_\d{4}_\d{3})\.(\d+)$/;
const PARENT_TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

interface SubtaskDefinition {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
}

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errIsError(reason: string, extra?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, reason, ...extra }) }], isError: true };
}

function getNextSubtaskOrder(db: Database.Database, parentTaskId: string): number {
  const row = db.prepare(
    'SELECT MAX(subtask_order) as max_order FROM tasks WHERE parent_task_id = ?',
  ).get(parentTaskId) as { max_order: number | null };
  return (row.max_order ?? 0) + 1;
}

function writeSubtaskFiles(projectRoot: string, subtaskId: string, def: SubtaskDefinition, parentTaskId: string): void {
  const taskDir = join(projectRoot, 'task-tracking', subtaskId);
  mkdirSync(taskDir, { recursive: true, mode: 0o755 });

  const title = def.title;
  const description = def.description ?? '';
  const type = def.type ?? 'FEATURE';
  const priority = def.priority ?? 'P2-Medium';

  const taskMd = `# Task: ${title}

## Metadata

| Field                 | Value    |
|-----------------------|----------|
| Type                  | ${type} |
| Priority              | ${priority} |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | single |

## Description

${description}

## Dependencies

- ${parentTaskId} (parent task)

## Acceptance Criteria

## References

- task-tracking/task-template.md

## File Scope

## Parallelism

Subtask of ${parentTaskId}. Runs sequentially within parent.
`;

  writeFileSync(join(taskDir, 'task.md'), taskMd, { encoding: 'utf-8', flag: 'wx' });
  writeFileSync(join(taskDir, 'status'), 'CREATED', { encoding: 'utf-8', flag: 'wx' });
}

function insertSubtaskRow(
  db: Database.Database,
  subtaskId: string,
  parentTaskId: string,
  order: number,
  def: SubtaskDefinition,
): void {
  db.prepare(`
    INSERT INTO tasks (id, title, type, priority, status, parent_task_id, subtask_order, dependencies, file_scope)
    VALUES (?, ?, ?, ?, 'CREATED', ?, ?, '[]', '[]')
  `).run(
    subtaskId,
    def.title,
    def.type ?? 'FEATURE',
    def.priority ?? 'P2-Medium',
    parentTaskId,
    order,
  );
}

export function handleCreateSubtask(
  db: Database.Database,
  projectRoot: string,
  args: {
    parent_task_id: string;
    title: string;
    description?: string;
    type?: string;
    priority?: string;
  },
): ToolResult {
  if (!args.parent_task_id || !args.title) {
    return errIsError('parent_task_id and title are required');
  }

  if (!PARENT_TASK_ID_RE.test(args.parent_task_id)) {
    return errIsError('parent_task_id must be in TASK_YYYY_NNN format');
  }

  // Validate parent exists
  const parent = db.prepare('SELECT id, parent_task_id FROM tasks WHERE id = ?').get(args.parent_task_id) as
    | { id: string; parent_task_id: string | null }
    | undefined;

  if (!parent) {
    return errIsError('parent task not found', { parent_task_id: args.parent_task_id });
  }

  // Reject nesting: parent must not itself be a subtask
  if (parent.parent_task_id !== null && parent.parent_task_id !== undefined) {
    return errIsError('nesting not allowed: parent task is already a subtask', { parent_task_id: args.parent_task_id });
  }

  const order = getNextSubtaskOrder(db, args.parent_task_id);
  const subtaskId = `${args.parent_task_id}.${order}`;

  // Check no collision in DB or on disk
  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(subtaskId);
  if (existing) {
    return errIsError('subtask id collision', { subtask_id: subtaskId });
  }

  const def: SubtaskDefinition = {
    title: args.title,
    description: args.description,
    type: args.type,
    priority: args.priority,
  };

  try {
    writeSubtaskFiles(projectRoot, subtaskId, def, args.parent_task_id);
    insertSubtaskRow(db, subtaskId, args.parent_task_id, order, def);

    return ok({ subtaskId, parentTaskId: args.parent_task_id, subtaskOrder: order, status: 'CREATED' });
  } catch (error) {
    // Best-effort cleanup
    db.prepare('DELETE FROM tasks WHERE id = ?').run(subtaskId);
    const taskDir = join(projectRoot, 'task-tracking', subtaskId);
    if (existsSync(taskDir)) {
      try { rmSync(taskDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    const message = error instanceof Error ? error.message : String(error);
    return errIsError('subtask_creation_failed', { error: message });
  }
}

export function handleBulkCreateSubtasks(
  db: Database.Database,
  projectRoot: string,
  args: {
    parent_task_id: string;
    subtasks: Array<{
      title: string;
      description?: string;
      type?: string;
      priority?: string;
    }>;
  },
): ToolResult {
  if (!args.parent_task_id || !Array.isArray(args.subtasks) || args.subtasks.length === 0) {
    return errIsError('parent_task_id and non-empty subtasks array are required');
  }

  if (!PARENT_TASK_ID_RE.test(args.parent_task_id)) {
    return errIsError('parent_task_id must be in TASK_YYYY_NNN format');
  }

  // Validate parent exists and is not itself a subtask
  const parent = db.prepare('SELECT id, parent_task_id FROM tasks WHERE id = ?').get(args.parent_task_id) as
    | { id: string; parent_task_id: string | null }
    | undefined;

  if (!parent) {
    return errIsError('parent task not found', { parent_task_id: args.parent_task_id });
  }

  if (parent.parent_task_id !== null && parent.parent_task_id !== undefined) {
    return errIsError('nesting not allowed: parent task is already a subtask', { parent_task_id: args.parent_task_id });
  }

  let nextOrder = getNextSubtaskOrder(db, args.parent_task_id);
  const results: Array<{ subtaskId: string; subtaskOrder: number; status: string; error?: string }> = [];

  for (const subtaskDef of args.subtasks) {
    if (!subtaskDef.title) {
      results.push({ subtaskId: '', subtaskOrder: nextOrder, status: 'rejected', error: 'title is required' });
      continue;
    }

    const subtaskId = `${args.parent_task_id}.${nextOrder}`;
    const def: SubtaskDefinition = {
      title: subtaskDef.title,
      description: subtaskDef.description,
      type: subtaskDef.type,
      priority: subtaskDef.priority,
    };

    try {
      writeSubtaskFiles(projectRoot, subtaskId, def, args.parent_task_id);
      insertSubtaskRow(db, subtaskId, args.parent_task_id, nextOrder, def);
      results.push({ subtaskId, subtaskOrder: nextOrder, status: 'CREATED' });
      nextOrder++;
    } catch (error) {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(subtaskId);
      const message = error instanceof Error ? error.message : String(error);
      results.push({ subtaskId, subtaskOrder: nextOrder, status: 'failed', error: message });
    }
  }

  return ok({ parentTaskId: args.parent_task_id, results });
}

export function handleGetSubtasks(
  db: Database.Database,
  args: {
    parent_task_id: string;
  },
): ToolResult {
  if (!args.parent_task_id) {
    return errIsError('parent_task_id is required');
  }

  const subtasks = db.prepare(`
    SELECT id, title, type, priority, status, subtask_order, created_at, updated_at
    FROM tasks
    WHERE parent_task_id = ?
    ORDER BY subtask_order ASC
  `).all(args.parent_task_id);

  return ok({ parentTaskId: args.parent_task_id, subtasks, count: (subtasks as unknown[]).length });
}

export function handleGetParentStatusRollup(
  db: Database.Database,
  args: {
    parent_task_id: string;
  },
): ToolResult {
  if (!args.parent_task_id) {
    return errIsError('parent_task_id is required');
  }

  const subtasks = db.prepare(
    'SELECT id, status FROM tasks WHERE parent_task_id = ? ORDER BY subtask_order ASC',
  ).all(args.parent_task_id) as Array<{ id: string; status: string }>;

  if (subtasks.length === 0) {
    return ok({ parentTaskId: args.parent_task_id, subtaskCount: 0, derivedStatus: null, reason: 'no subtasks' });
  }

  const statuses = subtasks.map(s => s.status);
  const allComplete = statuses.every(s => s === 'COMPLETE');
  const anyFailed = statuses.some(s => s === 'FAILED');

  let derivedStatus: string;
  let reason: string;

  if (anyFailed) {
    derivedStatus = 'BLOCKED';
    reason = 'one or more subtasks FAILED';
  } else if (allComplete) {
    derivedStatus = 'IMPLEMENTED';
    reason = 'all subtasks COMPLETE — parent can advance to IMPLEMENTED';
  } else {
    derivedStatus = 'IN_PROGRESS';
    reason = 'subtasks still in progress';
  }

  const counts: Record<string, number> = {};
  for (const s of statuses) {
    counts[s] = (counts[s] ?? 0) + 1;
  }

  return ok({
    parentTaskId: args.parent_task_id,
    subtaskCount: subtasks.length,
    derivedStatus,
    reason,
    statusCounts: counts,
  });
}

// Re-export subtask ID helper for external use
export function parseSubtaskId(id: string): { parentId: string; order: number } | null {
  const m = SUBTASK_ID_RE.exec(id);
  if (!m) return null;
  return { parentId: m[1], order: parseInt(m[2], 10) };
}
