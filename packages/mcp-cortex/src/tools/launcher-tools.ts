import type Database from 'better-sqlite3';
import type { ToolResult } from './types.js';

interface LauncherRow {
  id: string;
  type: string;
  config: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface LauncherRecord {
  id: string;
  type: string;
  config: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

const UPDATABLE_LAUNCHER_COLUMNS = new Set([
  'type', 'config', 'status',
]);

function parseLauncherRow(row: LauncherRow): LauncherRecord {
  return {
    id: row.id,
    type: row.type,
    config: JSON.parse(row.config) as Record<string, unknown>,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function handleListLaunchers(
  db: Database.Database,
  args: { type?: string; status?: string },
): ToolResult {
  let rows: LauncherRow[];

  if (args.type !== undefined && args.status !== undefined) {
    rows = db.prepare(
      'SELECT * FROM launchers WHERE type = ? AND status = ? ORDER BY id',
    ).all(args.type, args.status) as LauncherRow[];
  } else if (args.type !== undefined) {
    rows = db.prepare(
      'SELECT * FROM launchers WHERE type = ? ORDER BY id',
    ).all(args.type) as LauncherRow[];
  } else if (args.status !== undefined) {
    rows = db.prepare(
      'SELECT * FROM launchers WHERE status = ? ORDER BY id',
    ).all(args.status) as LauncherRow[];
  } else {
    rows = db.prepare('SELECT * FROM launchers ORDER BY id').all() as LauncherRow[];
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(rows.map(parseLauncherRow), null, 2),
    }],
  };
}

export function handleGetLauncher(
  db: Database.Database,
  args: { id: string },
): ToolResult {
  const row = db.prepare('SELECT * FROM launchers WHERE id = ?').get(args.id) as LauncherRow | undefined;
  if (!row) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'launcher_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(parseLauncherRow(row), null, 2) }] };
}

export function handleRegisterLauncher(
  db: Database.Database,
  args: { id: string; type: string; config?: Record<string, unknown>; status?: string },
): ToolResult {
  const now = new Date().toISOString();
  const configJson = JSON.stringify(args.config ?? {});
  const status = args.status ?? 'active';

  try {
    db.prepare(`
      INSERT INTO launchers (id, type, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        config = excluded.config,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(args.id, args.type, configJson, status, now, now);

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

export function handleUpdateLauncher(
  db: Database.Database,
  args: { id: string; fields: Record<string, unknown> },
): ToolResult {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(args.fields)) {
    if (!UPDATABLE_LAUNCHER_COLUMNS.has(key)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: false, reason: `column '${key}' not updatable` }),
        }],
      };
    }
    sets.push(`${key} = ?`);
    if (key === 'config' && typeof value === 'object' && value !== null) {
      params.push(JSON.stringify(value));
    } else {
      params.push(value);
    }
  }

  if (sets.length === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'no fields provided' }) }] };
  }

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(args.id);

  const info = db.prepare(`UPDATE launchers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'launcher_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}

export function handleDeregisterLauncher(
  db: Database.Database,
  args: { id: string },
): ToolResult {
  const now = new Date().toISOString();
  const info = db.prepare(
    `UPDATE launchers SET status = 'inactive', updated_at = ? WHERE id = ?`,
  ).run(now, args.id);
  if (info.changes === 0) {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'launcher_not_found' }) }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }] };
}
