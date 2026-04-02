// Public entry point for cortex DB hydration — used by `update` and `db:rebuild`.
// Schema init:   cortex-db-init.ts
// Sync logic:    cortex-sync.ts (syncTasksFromFiles, reconcileStatusFiles, hydrateSessions, hydrateHandoffs)

import { existsSync } from 'node:fs';
import { logger } from './logger.js';
import { join, resolve } from 'node:path';
import { initCortexDatabase } from './cortex-db-init.js';
import { syncTasksFromFiles, reconcileStatusFiles } from './cortex-sync-tasks.js';
import { hydrateSessions, hydrateHandoffs } from './cortex-sync-entities.js';
import type Database from 'better-sqlite3';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Relative path to the cortex DB — matches packages/mcp-cortex/src/index.ts:19 */
export const CORTEX_DB_PATH_REL = '.nitro/cortex.db';

export interface HydrationResult {
  tasks: { imported: number; skipped: number; errors: string[] };
  sessions: { imported: number; skipped: number };
  handoffs: { imported: number; skipped: number };
  drifted: number;
  migrationsApplied: number;
}

// ─── Internal: helpers ────────────────────────────────────────────────────────

function resolveDbPath(cwd: string): string {
  return resolve(cwd, CORTEX_DB_PATH_REL);
}

/**
 * Clears tasks, handoffs, and events rows.
 * Sessions and workers are intentionally preserved across rebuilds.
 * Delete order respects FK constraints: handoffs (child of tasks) first,
 * then events, then tasks (parent).
 */
function clearImportedData(db: Database.Database): void {
  db.exec('DELETE FROM handoffs');
  db.exec('DELETE FROM events');
  db.exec('DELETE FROM tasks');
}

// ─── Exported entry point ─────────────────────────────────────────────────────

/**
 * Opens or creates the cortex DB, applies schema init/migrations, then
 * hydrates from task-tracking files according to the specified mode.
 *
 * @param cwd  - Project root (process.cwd() from the calling command)
 * @param mode - 'init-or-migrate': full hydrate on new DB or empty DB; reconcile-only otherwise
 *             - 'rebuild': drop tasks/handoffs/events rows, then fully re-hydrate
 * @returns HydrationResult (including migrationsApplied count), or null if the DB cannot be opened
 */
export function runCortexStep(
  cwd: string,
  mode: 'init-or-migrate' | 'rebuild',
): HydrationResult | null {
  const dbPath = resolveDbPath(cwd);

  let db: Database.Database | null = null;
  try {
    const dbWasNew = !existsSync(dbPath);
    const { db: openedDb, migrationsApplied } = initCortexDatabase(dbPath);
    db = openedDb;

    const trackingDir = join(cwd, 'task-tracking');
    const result: HydrationResult = {
      tasks: { imported: 0, skipped: 0, errors: [] },
      sessions: { imported: 0, skipped: 0 },
      handoffs: { imported: 0, skipped: 0 },
      drifted: 0,
      migrationsApplied,
    };

    if (mode === 'rebuild') {
      clearImportedData(db);
      result.tasks = syncTasksFromFiles(db, cwd);
      result.sessions = hydrateSessions(db, trackingDir);
      result.handoffs = hydrateHandoffs(db, trackingDir);
    } else {
      // Full hydration when: DB was just created, OR the tasks table is empty
      // (handles the case where the MCP server created the DB before update ran)
      const taskCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count;
      const isEmpty = taskCount === 0;

      if (dbWasNew || isEmpty) {
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
    const message = err instanceof Error ? err.message : String(err);
    const capped = message.length > 200 ? message.slice(0, 200) + '...' : message;
    logger.error(`cortex-hydrate: DB error: ${capped}`);
    return null;
  }
}
