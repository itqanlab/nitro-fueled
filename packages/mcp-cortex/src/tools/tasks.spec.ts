import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase } from '../db/schema.js';
import { handleCreateSession } from './sessions.js';
import { toLegacySessionId } from './session-id.js';
import { handleClaimTask, handleGetTasks } from './tasks.js';
import { handleGetNextWave } from './wave.js';
import type Database from 'better-sqlite3';

function makeTempDb(): { db: Database.Database; cleanup: () => void } {
  const dbPath = join(tmpdir(), `cortex-test-${randomUUID()}.db`);
  const db = initDatabase(dbPath);
  return {
    db,
    cleanup: () => {
      try { db.close(); } catch { /* ignore */ }
    },
  };
}

function parseText(result: { content: Array<{ type: 'text'; text: string }> }): unknown {
  return JSON.parse(result.content[0]!.text);
}

function createTestSession(db: Database.Database): string {
  const result = handleCreateSession(db, { source: 'test' });
  return (parseText(result) as { session_id: string }).session_id;
}

function insertTask(db: Database.Database, taskId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, type, priority, status, dependencies, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'CREATED', '[]', ?, ?)`,
  ).run(taskId, 'Test task', 'BUGFIX', 'P1-High', now, now);
}

function insertTaskWithStatus(db: Database.Database, taskId: string, status: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, type, priority, status, dependencies, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`,
  ).run(taskId, `Task ${taskId}`, 'BUGFIX', 'P1-High', status, now, now);
}

describe('session ID normalization in task claims', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    sessionId = createTestSession(db);
  });

  afterEach(() => {
    cleanup();
  });

  it('normalizes legacy session IDs in claim_task', () => {
    insertTask(db, 'TASK_2026_900');

    const result = parseText(handleClaimTask(db, {
      task_id: 'TASK_2026_900',
      session_id: toLegacySessionId(sessionId),
    })) as { ok: boolean };

    expect(result.ok).toBe(true);

    const row = db.prepare('SELECT session_claimed FROM tasks WHERE id = ?').get('TASK_2026_900') as { session_claimed: string };
    expect(row.session_claimed).toBe(sessionId);
  });

  it('normalizes legacy session IDs in get_next_wave claims', () => {
    insertTask(db, 'TASK_2026_901');

    const wave = parseText(handleGetNextWave(db, {
      session_id: toLegacySessionId(sessionId),
      slots: 1,
    })) as Array<{ id: string }>;

    expect(wave).toEqual([{ id: 'TASK_2026_901' }]);

    const row = db.prepare('SELECT session_claimed FROM tasks WHERE id = ?').get('TASK_2026_901') as { session_claimed: string };
    expect(row.session_claimed).toBe(sessionId);
  });
});

describe('get_tasks limit support', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('returns at most the requested number of rows', () => {
    insertTaskWithStatus(db, 'TASK_2026_910', 'CREATED');
    insertTaskWithStatus(db, 'TASK_2026_911', 'CREATED');
    insertTaskWithStatus(db, 'TASK_2026_912', 'CREATED');

    const rows = parseText(handleGetTasks(db, { status: 'CREATED', limit: 2 })) as Array<{ id: string }>;

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.id)).toEqual(['TASK_2026_910', 'TASK_2026_911']);
  });

  it('caps limit to the tool maximum', () => {
    for (let i = 0; i < 210; i += 1) {
      const suffix = String(i).padStart(3, '0');
      insertTaskWithStatus(db, `TASK_2030_${suffix}`, 'CREATED');
    }

    const rows = parseText(handleGetTasks(db, { status: 'CREATED', limit: 9999 })) as Array<{ id: string }>;

    expect(rows).toHaveLength(200);
  });
});

describe('get_tasks unblocked + limit post-filter', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  function insertTaskWithDeps(taskId: string, status: string, deps: string[]): void {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, title, type, priority, status, dependencies, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(taskId, `Task ${taskId}`, 'BUGFIX', 'P1-High', status, JSON.stringify(deps), now, now);
  }

  it('applies limit after dependency filtering so blocked tasks do not consume limit slots', () => {
    // Insert two tasks with an unresolved dependency (blocked in effect) first by ID order.
    // Then insert two genuinely unblocked tasks.
    // Without the post-filter fix, limit=2 in SQL would grab the first two blocked rows,
    // pass them to dependency filtering, produce an empty result, and the caller would see nothing.
    insertTaskWithDeps('TASK_2026_920', 'CREATED', ['TASK_2026_999']); // blocked — dep not complete
    insertTaskWithDeps('TASK_2026_921', 'CREATED', ['TASK_2026_999']); // blocked — dep not complete
    insertTaskWithDeps('TASK_2026_922', 'CREATED', []);                 // unblocked
    insertTaskWithDeps('TASK_2026_923', 'CREATED', []);                 // unblocked

    const rows = parseText(handleGetTasks(db, { unblocked: true, limit: 1 })) as Array<{ id: string }>;

    // The caller asked for 1 unblocked task. Even though the first 2 rows by ID are blocked,
    // the result must still return exactly 1 unblocked task.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('TASK_2026_922');
  });

  it('returns all unblocked tasks when limit exceeds the unblocked count', () => {
    insertTaskWithDeps('TASK_2026_930', 'CREATED', ['TASK_2026_999']); // blocked
    insertTaskWithDeps('TASK_2026_931', 'CREATED', []);                 // unblocked
    insertTaskWithDeps('TASK_2026_932', 'CREATED', []);                 // unblocked

    const rows = parseText(handleGetTasks(db, { unblocked: true, limit: 10 })) as Array<{ id: string }>;

    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.id)).toEqual(['TASK_2026_931', 'TASK_2026_932']);
  });

  it('Math.min/Math.max guards clamp fractional and near-zero limit values', () => {
    // This exercises the Math.trunc + Math.max(1, ...) guards directly.
    // A caller passing limit=0.9 (fractional) should get clamped to 1 after Math.trunc (0) -> Math.max(1, 0) = 1.
    // We use the non-unblocked path here since the guards apply before path branching.
    insertTaskWithStatus(db, 'TASK_2026_940', 'CREATED');
    insertTaskWithStatus(db, 'TASK_2026_941', 'CREATED');

    // limit: 0.9 -> Math.trunc = 0 -> Math.max(1, 0) = 1 -> returns 1 row, not 0
    const rows = parseText(handleGetTasks(db, { limit: 0.9 })) as Array<{ id: string }>;
    expect(rows).toHaveLength(1);
  });
});
