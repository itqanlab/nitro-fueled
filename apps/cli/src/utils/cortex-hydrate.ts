// Hydration logic for the cortex SQLite DB — used by `update` and `db:rebuild`.
// Schema init is in cortex-db-init.ts; sync logic from packages/mcp-cortex/src/tools/sync.ts
// is inlined here because the cross-package relative import escapes tsconfig rootDir.

import type Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { initCortexDatabase } from './cortex-db-init.js';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Relative path to the cortex DB — matches packages/mcp-cortex/src/index.ts:19 */
export const CORTEX_DB_PATH_REL = '.nitro/cortex.db';

export interface HydrationResult {
  tasks: { imported: number; skipped: number; errors: string[] };
  sessions: { imported: number; skipped: number };
  handoffs: { imported: number; skipped: number };
  drifted: number;
}

// ─── Internal: task sync ──────────────────────────────────────────────────────
// Inlined from packages/mcp-cortex/src/tools/sync.ts:handleSyncTasksFromFiles
// cross-package import blocked by tsconfig rootDir

const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

function getMetadataField(content: string, field: string): string | null {
  const re = new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|]+)\\|`, 'i');
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

function getSection(content: string, heading: string): string | null {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

function parseDependencies(content: string): string[] {
  const section = getSection(content, 'Dependencies');
  if (!section || section.toLowerCase().includes('none')) return [];
  const ids: string[] = [];
  const re = /\bTASK_\d{4}_\d{3}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    ids.push(m[0]);
  }
  return ids;
}

function parseFileScope(content: string): string[] {
  const section = getSection(content, 'File Scope');
  if (!section) return [];
  const files: string[] = [];
  for (const line of section.split('\n')) {
    const trimmed = line.replace(/^[-*]\s*/, '').replace(/`/g, '').trim();
    if (trimmed.length > 0 && !trimmed.startsWith('|')) {
      files.push(trimmed);
    }
  }
  return files;
}

function syncTasksFromFiles(
  db: Database.Database,
  projectRoot: string,
): { imported: number; skipped: number; errors: string[] } {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) {
    return { imported: 0, skipped: 0, errors: ['task-tracking directory not found'] };
  }

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const upsert = db.prepare(`
    INSERT INTO tasks (id, title, type, priority, status, complexity, model, dependencies, description, file_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      priority = excluded.priority,
      status = excluded.status,
      complexity = excluded.complexity,
      model = excluded.model,
      dependencies = excluded.dependencies,
      description = excluded.description,
      file_scope = excluded.file_scope,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `);

  const runSync = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory() || !TASK_ID_RE.test(entry.name)) continue;

      const taskDir = join(trackingDir, entry.name);
      const taskPath = join(taskDir, 'task.md');
      if (!existsSync(taskPath)) {
        skipped++;
        continue;
      }

      try {
        const content = readFileSync(taskPath, 'utf8');
        const statusPath = join(taskDir, 'status');
        const status = existsSync(statusPath) ? readFileSync(statusPath, 'utf8').trim() : 'CREATED';
        const titleMatch = content.match(/^#\s+Task:\s*(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

        upsert.run(
          entry.name,
          title,
          getMetadataField(content, 'Type') ?? 'CHORE',
          getMetadataField(content, 'Priority') ?? 'P2-Medium',
          status,
          getMetadataField(content, 'Complexity'),
          getMetadataField(content, 'Model'),
          JSON.stringify(parseDependencies(content)),
          getSection(content, 'Description'),
          JSON.stringify(parseFileScope(content)),
        );
        imported++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${entry.name}: ${message}`);
      }
    }
  });

  runSync();
  return { imported, skipped, errors };
}

// ─── Internal: status reconcile ──────────────────────────────────────────────
// Inlined from packages/mcp-cortex/src/tools/sync.ts:handleReconcileStatusFiles

const VALID_STATUSES = new Set([
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW',
  'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
]);

function reconcileStatusFiles(db: Database.Database, projectRoot: string): number {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) return 0;

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let drifted = 0;

  interface TaskRow { id: string; status: string }

  const selectRow = db.prepare('SELECT id, status FROM tasks WHERE id = ?');
  const updateStatus = db.prepare(
    "UPDATE tasks SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  );

  const runReconcile = db.transaction(() => {
    for (const entry of entries) {
      if (!entry.isDirectory() || !TASK_ID_RE.test(entry.name)) continue;

      const statusPath = join(trackingDir, entry.name, 'status');
      if (!existsSync(statusPath)) continue;

      const fileStatus = readFileSync(statusPath, 'utf8').trim();
      if (fileStatus.length === 0 || !VALID_STATUSES.has(fileStatus)) continue;

      const existing = selectRow.get(entry.name);
      if (!existing || typeof existing !== 'object') continue;

      const dbRow = existing as TaskRow;
      if (dbRow.status !== fileStatus) {
        updateStatus.run(fileStatus, entry.name);
        drifted++;
      }
    }
  });

  runReconcile();
  return drifted;
}

// ─── Internal: sessions hydration ────────────────────────────────────────────

const SESSION_FOLDER_RE = /^SESSION_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/;

function hydrateSessions(
  db: Database.Database,
  trackingDir: string,
): { imported: number; skipped: number } {
  const sessionsDir = join(trackingDir, 'sessions');
  if (!existsSync(sessionsDir)) return { imported: 0, skipped: 0 };

  const entries = readdirSync(sessionsDir, { withFileTypes: true });
  let imported = 0;
  let skipped = 0;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO sessions (id, source, loop_status, started_at)
     VALUES (?, ?, ?, ?)`,
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const match = SESSION_FOLDER_RE.exec(entry.name);
    if (!match) {
      skipped++;
      continue;
    }

    const [, year, month, day, hour, min, sec] = match;
    const startedAt = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;

    try {
      const result = insert.run(entry.name, 'file-import', 'stopped', startedAt);
      if (result.changes > 0) {
        imported++;
      } else {
        skipped++;
      }
    } catch (err: unknown) {
      console.error(
        `cortex-hydrate: session insert failed for ${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      skipped++;
    }
  }

  return { imported, skipped };
}

// ─── Internal: handoffs hydration ────────────────────────────────────────────

function hydrateHandoffs(
  db: Database.Database,
  trackingDir: string,
): { imported: number; skipped: number } {
  if (!existsSync(trackingDir)) return { imported: 0, skipped: 0 };

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let imported = 0;
  let skipped = 0;

  const checkTask = db.prepare('SELECT id FROM tasks WHERE id = ?');
  const checkExisting = db.prepare('SELECT id FROM handoffs WHERE task_id = ? AND worker_type = ?');
  const insert = db.prepare(
    `INSERT INTO handoffs (task_id, worker_type, files_changed, commits, decisions, risks)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const entry of entries) {
    if (!entry.isDirectory() || !TASK_ID_RE.test(entry.name)) continue;

    const handoffPath = join(trackingDir, entry.name, 'handoff.md');
    if (!existsSync(handoffPath)) continue;

    if (!checkTask.get(entry.name)) {
      skipped++;
      continue;
    }

    if (checkExisting.get(entry.name, 'build')) {
      skipped++;
      continue;
    }

    try {
      const rawContent = readFileSync(handoffPath, 'utf8');
      insert.run(
        entry.name,
        'build',
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([rawContent]),
        JSON.stringify([]),
      );
      imported++;
    } catch (err: unknown) {
      console.error(
        `cortex-hydrate: handoff insert failed for ${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      skipped++;
    }
  }

  return { imported, skipped };
}

// ─── Internal: helpers ────────────────────────────────────────────────────────

function resolveDbPath(cwd: string): string {
  return resolve(cwd, CORTEX_DB_PATH_REL);
}

function dropHydratableTables(db: Database.Database): void {
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM handoffs');
  db.exec('DELETE FROM events');
}

// ─── Exported entry point ─────────────────────────────────────────────────────

/**
 * Opens or creates the cortex DB, applies schema init/migrations, then
 * hydrates from task-tracking files according to the specified mode.
 *
 * @param cwd  - Project root (process.cwd() from the calling command)
 * @param mode - 'init-or-migrate': full hydrate on new DB; reconcile-only on existing DB
 *             - 'rebuild': drop tasks/handoffs/events rows, then fully re-hydrate
 * @returns HydrationResult, or null if the DB cannot be opened
 */
export function runCortexStep(
  cwd: string,
  mode: 'init-or-migrate' | 'rebuild',
): HydrationResult | null {
  const dbPath = resolveDbPath(cwd);

  let db: Database.Database | null = null;
  try {
    const dbWasNew = !existsSync(dbPath);
    db = initCortexDatabase(dbPath);

    const trackingDir = join(cwd, 'task-tracking');
    const result: HydrationResult = {
      tasks: { imported: 0, skipped: 0, errors: [] },
      sessions: { imported: 0, skipped: 0 },
      handoffs: { imported: 0, skipped: 0 },
      drifted: 0,
    };

    if (mode === 'rebuild') {
      dropHydratableTables(db);
      result.tasks = syncTasksFromFiles(db, cwd);
      result.sessions = hydrateSessions(db, trackingDir);
      result.handoffs = hydrateHandoffs(db, trackingDir);
    } else {
      if (dbWasNew) {
        result.tasks = syncTasksFromFiles(db, cwd);
        result.sessions = hydrateSessions(db, trackingDir);
        result.handoffs = hydrateHandoffs(db, trackingDir);
      } else {
        result.drifted = reconcileStatusFiles(db, cwd);
      }
    }

    db.close();
    return result;
  } catch (err: unknown) {
    if (db !== null) {
      try { db.close(); } catch { /* ignore close errors */ }
    }
    console.error(
      `cortex-hydrate: DB error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
