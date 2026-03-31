import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase } from '../db/schema.js';
import { handleCreateSession, handleUpdateSession } from './sessions.js';
import { toLegacySessionId } from './session-id.js';
import { handleClaimTask, handleGetTasks, handleGetOrphanedClaims, handleReleaseOrphanedClaims } from './tasks.js';
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
      // This exercises Math.trunc + Math.max(1, ...) guards directly.
      // A caller passing limit=0.9 (fractional) should get clamped to 1 after Math.trunc (0) -> Math.max(1, 0) = 1.
      // We use non-unblocked path here since guards apply before path branching.
      insertTaskWithStatus(db, 'TASK_2026_940', 'CREATED');
      insertTaskWithStatus(db, 'TASK_2026_941', 'CREATED');

      // limit: 0.9 -> Math.trunc = 0 -> Math.max(1, 0) = 1 -> returns 1 row, not 0
      const rows = parseText(handleGetTasks(db, { limit: 0.9 })) as Array<{ id: string }>;
      expect(rows).toHaveLength(1);
    });
});

describe('orphaned claim recovery', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let activeSessionId: string;
  let deadSessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    activeSessionId = createTestSession(db);
    deadSessionId = createTestSession(db);
    handleUpdateSession(db, { session_id: deadSessionId, fields: { loop_status: 'stopped' } });
  });

  afterEach(() => {
    cleanup();
  });

  function insertClaimedTask(db: Database.Database, taskId: string, status: string, sessionId: string, claimTimeoutMs: number | null): void {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, title, type, priority, status, dependencies, session_claimed, claimed_at, claim_timeout_ms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(taskId, `Task ${taskId}`, 'BUGFIX', 'P1-High', status, '[]', sessionId, now, claimTimeoutMs, now, now);
  }

  describe('get_orphaned_claims', () => {
    it('detects tasks claimed by dead sessions', () => {
      insertClaimedTask(db, 'TASK_2026_800', 'IN_PROGRESS', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_801', 'CREATED', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_802', 'IN_PROGRESS', activeSessionId, null);

      const result = parseText(handleGetOrphanedClaims(db)) as { orphaned: Array<{ task_id: string }> };

      expect(result.orphaned).toHaveLength(2);
      expect(result.orphaned.map(t => t.task_id).sort()).toEqual(['TASK_2026_800', 'TASK_2026_801']);
    });

    it('detects tasks with expired TTL', () => {
      insertClaimedTask(db, 'TASK_2026_803', 'IN_PROGRESS', activeSessionId, 1);
      insertClaimedTask(db, 'TASK_2026_804', 'IN_PROGRESS', activeSessionId, 10000000);

      const result = parseText(handleGetOrphanedClaims(db)) as { orphaned: Array<{ task_id: string }> };

      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0]?.task_id).toBe('TASK_2026_803');
    });

    it('detects tasks with both dead session and expired TTL', () => {
      insertClaimedTask(db, 'TASK_2026_805', 'IN_PROGRESS', deadSessionId, 1);

      const result = parseText(handleGetOrphanedClaims(db)) as { orphaned: Array<{ task_id: string }> };

      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0]?.task_id).toBe('TASK_2026_805');
    });

    it('does not detect tasks claimed by active sessions with valid TTL', () => {
      insertClaimedTask(db, 'TASK_2026_806', 'IN_PROGRESS', activeSessionId, null);
      insertClaimedTask(db, 'TASK_2026_807', 'IN_PROGRESS', activeSessionId, 10000000);

      const result = parseText(handleGetOrphanedClaims(db)) as { orphaned: Array<{ task_id: string }> };

      expect(result.orphaned).toHaveLength(0);
    });

    it('only checks tasks in CREATED or IN_PROGRESS status', () => {
      insertClaimedTask(db, 'TASK_2026_808', 'COMPLETE', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_809', 'IMPLEMENTED', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_810', 'IN_PROGRESS', deadSessionId, null);

      const result = parseText(handleGetOrphanedClaims(db)) as { orphaned: Array<{ task_id: string }> };

      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0]?.task_id).toBe('TASK_2026_810');
    });

    it('returns stale_for_ms for each orphaned claim', () => {
      insertClaimedTask(db, 'TASK_2026_811', 'IN_PROGRESS', deadSessionId, null);

      const result = parseText(handleGetOrphanedClaims(db)) as { orphaned: Array<{ task_id: string; stale_for_ms: number }> };

      expect(result.orphaned).toHaveLength(1);
      expect(result.orphaned[0]?.task_id).toBe('TASK_2026_811');
      expect(result.orphaned[0]?.stale_for_ms).toBeGreaterThan(0);
    });
  });

  describe('release_orphaned_claims', () => {
    it('releases tasks claimed by dead sessions', () => {
      insertClaimedTask(db, 'TASK_2026_820', 'IN_PROGRESS', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_821', 'CREATED', deadSessionId, null);

      const result = parseText(handleReleaseOrphanedClaims(db)) as { released: number; tasks: string[] };

      expect(result.released).toBe(2);
      expect(result.tasks.sort()).toEqual(['TASK_2026_820', 'TASK_2026_821']);

      const task1 = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_820') as { status: string; session_claimed: string | null };
      const task2 = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_821') as { status: string; session_claimed: string | null };

      expect(task1.status).toBe('CREATED');
      expect(task1.session_claimed).toBeNull();
      expect(task2.status).toBe('CREATED');
      expect(task2.session_claimed).toBeNull();
    });

    it('releases tasks with expired TTL', () => {
      insertClaimedTask(db, 'TASK_2026_822', 'IN_PROGRESS', activeSessionId, 1);

      const result = parseText(handleReleaseOrphanedClaims(db)) as { released: number; tasks: string[] };

      expect(result.released).toBe(1);
      expect(result.tasks).toEqual(['TASK_2026_822']);

      const task = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_822') as { status: string; session_claimed: string | null };

      expect(task.status).toBe('CREATED');
      expect(task.session_claimed).toBeNull();
    });

    it('logs orphan_recovery events for each released task', () => {
      insertClaimedTask(db, 'TASK_2026_823', 'IN_PROGRESS', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_824', 'IN_PROGRESS', deadSessionId, null);

      handleReleaseOrphanedClaims(db);

      const events = db.prepare(
        "SELECT task_id, event_type, data FROM events WHERE event_type = 'orphan_recovery' ORDER BY task_id"
      ).all() as Array<{ task_id: string; event_type: string; data: string }>;

      expect(events).toHaveLength(2);

      const event1 = events.find(e => e.task_id === 'TASK_2026_823')!;
      const event2 = events.find(e => e.task_id === 'TASK_2026_824')!;

      expect(event1.event_type).toBe('orphan_recovery');
      const data1 = JSON.parse(event1.data) as { details: { was_claimed_by: string; stale_for_ms: number } };
      expect(data1.details.was_claimed_by).toBe(deadSessionId);
      expect(data1.details.stale_for_ms).toBeGreaterThan(0);

      expect(event2.event_type).toBe('orphan_recovery');
      const data2 = JSON.parse(event2.data) as { details: { was_claimed_by: string; stale_for_ms: number } };
      expect(data2.details.was_claimed_by).toBe(deadSessionId);
      expect(data2.details.stale_for_ms).toBeGreaterThan(0);
    });

    it('does not release tasks claimed by active sessions with valid TTL', () => {
      insertClaimedTask(db, 'TASK_2026_825', 'IN_PROGRESS', activeSessionId, null);
      insertClaimedTask(db, 'TASK_2026_826', 'IN_PROGRESS', activeSessionId, 10000000);

      const result = parseText(handleReleaseOrphanedClaims(db)) as { released: number; tasks: string[] };

      expect(result.released).toBe(0);
      expect(result.tasks).toEqual([]);

      const task1 = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_825') as { status: string; session_claimed: string };
      const task2 = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_826') as { status: string; session_claimed: string };

      expect(task1.session_claimed).toBe(activeSessionId);
      expect(task2.session_claimed).toBe(activeSessionId);
    });

    it('handles atomic transaction - all-or-nothing release', () => {
      insertClaimedTask(db, 'TASK_2026_827', 'IN_PROGRESS', deadSessionId, null);
      insertClaimedTask(db, 'TASK_2026_828', 'IN_PROGRESS', deadSessionId, null);

      const result = parseText(handleReleaseOrphanedClaims(db)) as { released: number; tasks: string[] };

      expect(result.released).toBe(2);

      const task1 = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_2026_827') as { status: string };
      const task2 = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_2026_828') as { status: string };

      expect(task1.status).toBe('CREATED');
      expect(task2.status).toBe('CREATED');
    });

    it('returns empty result when no orphaned claims exist', () => {
      insertClaimedTask(db, 'TASK_2026_829', 'IN_PROGRESS', activeSessionId, null);

      const result = parseText(handleReleaseOrphanedClaims(db)) as { released: number; tasks: string[] };

      expect(result.released).toBe(0);
      expect(result.tasks).toEqual([]);
    });
  });
});
