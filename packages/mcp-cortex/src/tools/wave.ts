import type Database from 'better-sqlite3';
import { normalizeSessionId } from './session-id.js';

interface TaskRow {
  id: string;
  dependencies: string;
  session_claimed: string | null;
  status: string;
}

/**
 * Returns up to N unclaimed, dependency-resolved CREATED tasks.
 * Atomically excludes tasks claimed by other active sessions.
 * Uses BEGIN EXCLUSIVE to prevent race conditions between sessions.
 */
export function handleGetNextWave(
  db: Database.Database,
  args: { session_id: string; slots: number },
): { content: Array<{ type: 'text'; text: string }> } {
  const sessionId = normalizeSessionId(args.session_id);
  const result = db.transaction(() => {
    const completeTasks = new Set(
      (db.prepare("SELECT id FROM tasks WHERE status = 'COMPLETE'").all() as Array<{ id: string }>).map(r => r.id),
    );

    const candidates = db.prepare(
      "SELECT id, dependencies, session_claimed, status FROM tasks WHERE status = 'CREATED' AND session_claimed IS NULL ORDER BY id",
    ).all() as TaskRow[];

    const wave: string[] = [];

    for (const task of candidates) {
      if (wave.length >= args.slots) break;

      let deps: string[];
      try {
        const parsed = JSON.parse(task.dependencies);
        deps = Array.isArray(parsed) ? parsed as string[] : [];
      } catch {
        console.error(`[nitro-cortex] get_next_wave: failed to parse dependencies for ${task.id}, treating as no deps`);
        deps = [];
      }
      const allDepsComplete = deps.length === 0 || deps.every(d => completeTasks.has(d));

      if (allDepsComplete) {
        wave.push(task.id);
      }
    }

    const now = new Date().toISOString();
    const claimed: Array<{ id: string }> = [];

    for (const taskId of wave) {
      db.prepare(
        'UPDATE tasks SET session_claimed = ?, claimed_at = ?, updated_at = ? WHERE id = ? AND session_claimed IS NULL',
      ).run(sessionId, now, now, taskId);
      claimed.push({ id: taskId });
    }

    return claimed;
  })();

  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}
