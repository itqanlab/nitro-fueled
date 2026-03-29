import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

const UPDATABLE_COLUMNS = new Set([
  'title', 'type', 'priority', 'status', 'complexity', 'model',
  'dependencies', 'description', 'acceptance_criteria', 'file_scope',
  'session_claimed', 'claimed_at',
]);

export function handleGetTasks(
  db: Database.Database,
  args: { status?: string; type?: string; priority?: string; unblocked?: boolean },
): { content: Array<{ type: 'text'; text: string }> } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (args.status) {
    conditions.push('status = ?');
    params.push(args.status);
  }
  if (args.type) {
    conditions.push('type = ?');
    params.push(args.type);
  }
  if (args.priority) {
    conditions.push('priority = ?');
    params.push(args.priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM tasks ${where} ORDER BY id`).all(...params) as Array<Record<string, unknown>>;

  if (args.unblocked) {
    const completeTasks = new Set(
      (db.prepare("SELECT id FROM tasks WHERE status = 'COMPLETE'").all() as Array<{ id: string }>).map(r => r.id),
    );
    const filtered = rows.filter(row => {
      const deps = JSON.parse((row['dependencies'] as string) ?? '[]') as string[];
      return deps.length === 0 || deps.every(d => completeTasks.has(d));
    });
    return { content: [{ type: 'text' as const, text: JSON.stringify(filtered, null, 2) }] };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
}

export function handleClaimTask(
  db: Database.Database,
  args: { task_id: string; session_id: string },
): { content: Array<{ type: 'text'; text: string }> } {
  const now = new Date().toISOString();

  const result = db.transaction(() => {
    const row = db.prepare(
      'SELECT session_claimed FROM tasks WHERE id = ? AND (session_claimed IS NULL OR session_claimed = ?)',
    ).get(args.task_id, args.session_id) as { session_claimed: string | null } | undefined;

    if (!row) {
      const existing = db.prepare('SELECT session_claimed FROM tasks WHERE id = ?').get(args.task_id) as { session_claimed: string } | undefined;
      if (!existing) {
        return { ok: false, reason: 'task_not_found' };
      }
      return { ok: false, claimed_by: existing.session_claimed };
    }

    db.prepare(
      'UPDATE tasks SET session_claimed = ?, claimed_at = ?, status = ?, updated_at = ? WHERE id = ?',
    ).run(args.session_id, now, 'IN_PROGRESS', now, args.task_id);

    return { ok: true };
  })();

  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
}

export function handleReleaseTask(
  db: Database.Database,
  args: { task_id: string; new_status: string },
): { content: Array<{ type: 'text'; text: string }> } {
  const now = new Date().toISOString();
  const info = db.prepare(
    'UPDATE tasks SET session_claimed = NULL, claimed_at = NULL, status = ?, updated_at = ? WHERE id = ?',
  ).run(args.new_status, now, args.task_id);

  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}

const UPSERTABLE_COLUMNS = new Set([
  'title', 'type', 'priority', 'status', 'complexity', 'model',
  'dependencies', 'description', 'acceptance_criteria', 'file_scope',
]);

export function handleUpsertTask(
  db: Database.Database,
  args: { task_id: string; fields: Record<string, unknown> },
): ToolResult {
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(args.task_id) as { id: string } | undefined;

  if (existing) {
    // UPDATE path — same whitelist as update_task
    const sets: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(args.fields)) {
      if (!UPDATABLE_COLUMNS.has(key)) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: `column '${key}' not updatable` }) }] };
      }
      sets.push(`${key} = ?`);
      const serialized = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
      params.push(serialized);
    }

    if (sets.length > 0) {
      sets.push('updated_at = ?');
      params.push(now);
      params.push(args.task_id);
      db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, action: 'updated' }) }] };
  }

  // INSERT path — title, type, priority, status are required
  const f = args.fields as Record<string, unknown>;
  const title = f.title as string | undefined;
  const type = f.type as string | undefined;
  const priority = f.priority as string | undefined;
  const status = (f.status as string | undefined) ?? 'CREATED';

  if (!title || !type || !priority) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'title, type, and priority are required for insert' }) }] };
  }

  const complexity = f.complexity as string | null ?? null;
  const model = f.model as string | null ?? null;
  const dependencies = typeof f.dependencies === 'object' && f.dependencies !== null
    ? JSON.stringify(f.dependencies) : (f.dependencies as string | null ?? '[]');
  const description = f.description as string | null ?? null;
  const acceptanceCriteria = f.acceptance_criteria as string | null ?? null;
  const fileScope = typeof f.file_scope === 'object' && f.file_scope !== null
    ? JSON.stringify(f.file_scope) : (f.file_scope as string | null ?? '[]');

  db.prepare(
    `INSERT INTO tasks (id, title, type, priority, status, complexity, model, dependencies, description, acceptance_criteria, file_scope, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(args.task_id, title, type, priority, status, complexity, model, dependencies, description, acceptanceCriteria, fileScope, now, now);

  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, action: 'inserted' }) }] };
}

export function handleUpdateTask(
  db: Database.Database,
  args: { task_id: string; fields: Record<string, unknown> },
): { content: Array<{ type: 'text'; text: string }> } {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(args.fields)) {
    if (!UPDATABLE_COLUMNS.has(key)) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: `column '${key}' not updatable` }) }] };
    }
    sets.push(`${key} = ?`);
    const serialized = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    params.push(serialized);
  }

  if (sets.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no fields provided' }) }] };
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(args.task_id);

  const info = db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'task_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}
