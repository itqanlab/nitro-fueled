// Task sync operations for the cortex DB.
// Inlined from packages/mcp-cortex/src/tools/sync.ts — cross-package import blocked by tsconfig rootDir.

import type Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─── Shared constants ─────────────────────────────────────────────────────────

export const TASK_ID_RE = /^TASK_\d{4}_\d{3}$/;

export const VALID_STATUSES = new Set([
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW',
  'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
]);

/** DB row shape for tasks — used in reconcileStatusFiles query. */
export interface TaskRow { id: string; status: string }

// ─── Internal: task content parsers ──────────────────────────────────────────

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

// ─── Exported: task sync ──────────────────────────────────────────────────────

/**
 * Scans task-tracking/ directories and upserts each task into the DB.
 * Each task runs in its own transaction so one malformed task.md never
 * aborts the rest of the batch ("graceful failure per task" contract).
 * Status and type values are validated before INSERT to avoid DB CHECK violations.
 */
export function syncTasksFromFiles(
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

  const VALID_TYPES = new Set(['FEATURE', 'BUG', 'REFACTOR', 'DOCS', 'TEST', 'CHORE']);
  const VALID_PRIORITIES = new Set(['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low']);

  const upsert = db.prepare(`
    INSERT INTO tasks (id, title, type, priority, status, complexity, model, dependencies, description, acceptance_criteria, file_scope)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      priority = excluded.priority,
      status = excluded.status,
      complexity = excluded.complexity,
      model = excluded.model,
      dependencies = excluded.dependencies,
      description = excluded.description,
      acceptance_criteria = excluded.acceptance_criteria,
      file_scope = excluded.file_scope,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `);

  for (const entry of entries) {
    if (!entry.isDirectory() || !TASK_ID_RE.test(entry.name)) continue;

    const taskDir = join(trackingDir, entry.name);
    const taskPath = join(taskDir, 'task.md');
    if (!existsSync(taskPath)) { skipped++; continue; }

    // Per-task transaction: one bad task never aborts sibling tasks
    const runTaskUpsert = db.transaction(() => {
      const content = readFileSync(taskPath, 'utf8');
      const statusPath = join(taskDir, 'status');
      const rawStatus = existsSync(statusPath) ? readFileSync(statusPath, 'utf8').trim() : 'CREATED';
      let status = rawStatus;
      if (!VALID_STATUSES.has(rawStatus)) {
        errors.push(`${entry.name}: unrecognised status "${rawStatus}" — defaulting to CREATED`);
        status = 'CREATED';
      }
      const titleMatch = content.match(/^#\s+Task:\s*(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
      const rawType = getMetadataField(content, 'Type') ?? 'CHORE';
      const type = VALID_TYPES.has(rawType) ? rawType : 'CHORE';
      if (rawType !== type) errors.push(`${entry.name}: unrecognised type "${rawType}" — defaulting to CHORE`);
      const rawPriority = getMetadataField(content, 'Priority') ?? 'P2-Medium';
      const priority = VALID_PRIORITIES.has(rawPriority) ? rawPriority : 'P2-Medium';
      if (rawPriority !== priority) errors.push(`${entry.name}: unrecognised priority "${rawPriority}" — defaulting to P2-Medium`);
      upsert.run(
        entry.name, title, type, priority, status,
        getMetadataField(content, 'Complexity'),
        getMetadataField(content, 'Model'),
        JSON.stringify(parseDependencies(content)),
        getSection(content, 'Description'),
        getSection(content, 'Acceptance Criteria'),
        JSON.stringify(parseFileScope(content)),
      );
    });

    try {
      runTaskUpsert();
      imported++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const capped = message.length > 200 ? message.slice(0, 200) + '...' : message;
      errors.push(`${entry.name}: ${capped}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

// ─── Exported: status reconcile ──────────────────────────────────────────────

/**
 * Checks each task-tracking/{TASK_ID}/status file against the DB row.
 * Updates the DB when file status differs from the stored value.
 * Only VALID_STATUSES values are accepted from disk.
 */
export function reconcileStatusFiles(db: Database.Database, projectRoot: string): number {
  const trackingDir = join(projectRoot, 'task-tracking');
  if (!existsSync(trackingDir)) return 0;

  const entries = readdirSync(trackingDir, { withFileTypes: true });
  let drifted = 0;

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
