// Session and handoff hydration operations for the cortex DB.
// Inlined from packages/mcp-cortex/src/tools/sync.ts — cross-package import blocked by tsconfig rootDir.

import type Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TASK_ID_RE } from './cortex-sync-tasks.js';

// ─── Exported: sessions hydration ────────────────────────────────────────────

const SESSION_FOLDER_RE = /^SESSION_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/;

export function hydrateSessions(
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
    if (!match) { skipped++; continue; }

    const [, year, month, day, hour, min, sec] = match;
    const startedAt = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;

    try {
      const result = insert.run(entry.name, 'file-import', 'stopped', startedAt);
      if (result.changes > 0) { imported++; } else { skipped++; }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const capped = message.length > 200 ? message.slice(0, 200) + '...' : message;
      console.error(`cortex-sync: session insert failed for ${entry.name}: ${capped}`);
      skipped++;
    }
  }

  return { imported, skipped };
}

// ─── Exported: handoffs hydration ────────────────────────────────────────────

/** Maximum bytes of handoff.md content stored in the DB to prevent unbounded BLOB growth. */
const HANDOFF_CONTENT_MAX_BYTES = 8192;

export function hydrateHandoffs(
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

    if (!checkTask.get(entry.name)) { skipped++; continue; }
    if (checkExisting.get(entry.name, 'build')) { skipped++; continue; }

    try {
      const rawContent = readFileSync(handoffPath, 'utf8');
      // Cap content to prevent unbounded BLOB growth in the handoffs table
      const content = rawContent.length > HANDOFF_CONTENT_MAX_BYTES
        ? rawContent.slice(0, HANDOFF_CONTENT_MAX_BYTES) + '\n...[truncated]'
        : rawContent;
      insert.run(
        entry.name, 'build',
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([content]),
        JSON.stringify([]),
      );
      imported++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const capped = message.length > 200 ? message.slice(0, 200) + '...' : message;
      console.error(`cortex-sync: handoff insert failed for ${entry.name}: ${capped}`);
      skipped++;
    }
  }

  return { imported, skipped };
}
