import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

interface WorkflowPhase {
  name: string;
  required_capability: string;
  next_phase: string | null;
}

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  phases: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

interface WorkflowRecord {
  id: string;
  name: string;
  description: string | null;
  phases: WorkflowPhase[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const UPDATABLE_WORKFLOW_COLUMNS = new Set([
  'name', 'description', 'phases', 'is_default',
]);

function parseWorkflowRow(row: WorkflowRow): WorkflowRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    phases: JSON.parse(row.phases) as WorkflowPhase[],
    is_default: row.is_default === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function handleListWorkflows(
  db: Database.Database,
  args: { is_default?: boolean },
): ToolResult {
  let rows: WorkflowRow[];

  if (args.is_default !== undefined) {
    const flag = args.is_default ? 1 : 0;
    rows = db.prepare('SELECT * FROM workflows WHERE is_default = ? ORDER BY name').all(flag) as WorkflowRow[];
  } else {
    rows = db.prepare('SELECT * FROM workflows ORDER BY name').all() as WorkflowRow[];
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(rows.map(parseWorkflowRow), null, 2),
    }],
  };
}

export function handleGetWorkflow(
  db: Database.Database,
  args: { id: string },
): ToolResult {
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(args.id) as WorkflowRow | undefined;
  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'workflow_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(parseWorkflowRow(row), null, 2) }] };
}

export function handleCreateWorkflow(
  db: Database.Database,
  args: {
    id: string;
    name: string;
    description?: string;
    phases?: WorkflowPhase[];
    is_default?: boolean;
  },
): ToolResult {
  const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(args.id) as { id: string } | undefined;
  if (existing) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'workflow_already_exists' }) }] };
  }

  try {
    db.transaction(() => {
      if (args.is_default === true) {
        db.prepare('UPDATE workflows SET is_default = 0, updated_at = ?').run(new Date().toISOString());
      }
      db.prepare(
        `INSERT INTO workflows (id, name, description, phases, is_default)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        args.id,
        args.name,
        args.description ?? null,
        JSON.stringify(args.phases ?? []),
        args.is_default === true ? 1 : 0,
      );
    })();

    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id: args.id }) }] };
  } catch (err) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ ok: false, reason: err instanceof Error ? err.message : String(err) }),
      }],
    };
  }
}

export function handleUpdateWorkflow(
  db: Database.Database,
  args: { id: string; fields: Record<string, unknown> },
): ToolResult {
  const sets: string[] = [];
  const params: unknown[] = [];
  let settingDefault = false;

  for (const [key, value] of Object.entries(args.fields)) {
    if (!UPDATABLE_WORKFLOW_COLUMNS.has(key)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: false, reason: `column '${key}' not updatable` }),
        }],
      };
    }
    if (key === 'phases' && Array.isArray(value)) {
      sets.push(`${key} = ?`);
      params.push(JSON.stringify(value));
    } else if (key === 'is_default') {
      settingDefault = value === true || value === 1;
      sets.push(`${key} = ?`);
      params.push(settingDefault ? 1 : 0);
    } else {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (sets.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no fields provided' }) }] };
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(args.id);

  try {
    db.transaction(() => {
      if (settingDefault) {
        db.prepare('UPDATE workflows SET is_default = 0, updated_at = ? WHERE id != ?').run(
          new Date().toISOString(),
          args.id,
        );
      }
      const info = db.prepare(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      if (info.changes === 0) {
        throw new Error('workflow_not_found');
      }
    })();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason }) }] };
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}

export function handleDeleteWorkflow(
  db: Database.Database,
  args: { id: string },
): ToolResult {
  const row = db.prepare('SELECT is_default FROM workflows WHERE id = ?').get(args.id) as { is_default: number } | undefined;
  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'workflow_not_found' }) }] };
  }
  if (row.is_default === 1) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'cannot_delete_default_workflow' }) }] };
  }
  db.prepare('DELETE FROM workflows WHERE id = ?').run(args.id);
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}
