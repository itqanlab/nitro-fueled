import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase } from '../db/schema.js';
import {
  handleCreateSession,
  handleGetSession,
  handleUpdateSession,
  handleListSessions,
  handleEndSession,
  handleUpdateHeartbeat,
  handleCloseStaleSessions,
} from './sessions.js';
import {
  handleGetOrphanedClaims,
  handleReleaseOrphanedClaims,
} from './tasks.js';
import { toLegacySessionId } from './session-id.js';
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

describe('handleCreateSession', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('creates a session and returns session_id', () => {
    const result = handleCreateSession(db, {});
    const data = parseText(result) as { ok: boolean; session_id: string };
    expect(data.ok).toBe(true);
    expect(data.session_id).toMatch(/^SESSION_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
  });

  it('stores the source when provided', () => {
    const result = handleCreateSession(db, { source: 'auto-pilot' });
    const data = parseText(result) as { session_id: string };
    const row = db.prepare('SELECT source FROM sessions WHERE id = ?').get(data.session_id) as { source: string };
    expect(row.source).toBe('auto-pilot');
  });

  it('stores the config when provided', () => {
    const result = handleCreateSession(db, { config: '{"max_workers":3}' });
    const data = parseText(result) as { session_id: string };
    const row = db.prepare('SELECT config FROM sessions WHERE id = ?').get(data.session_id) as { config: string };
    expect(row.config).toBe('{"max_workers":3}');
  });

  it('stores task_count as task_limit', () => {
    const result = handleCreateSession(db, { task_count: 5 });
    const data = parseText(result) as { session_id: string };
    const row = db.prepare('SELECT task_limit FROM sessions WHERE id = ?').get(data.session_id) as { task_limit: number };
    expect(row.task_limit).toBe(5);
  });

  it('session defaults to loop_status running', () => {
    const result = handleCreateSession(db, {});
    const data = parseText(result) as { session_id: string };
    const row = db.prepare('SELECT loop_status FROM sessions WHERE id = ?').get(data.session_id) as { loop_status: string };
    expect(row.loop_status).toBe('running');
  });
});

describe('handleGetSession', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    const r = handleCreateSession(db, { source: 'test-runner' });
    sessionId = (parseText(r) as { session_id: string }).session_id;
  });

  afterEach(() => {
    cleanup();
  });

  it('returns session not found for unknown session_id', () => {
    const result = handleGetSession(db, { session_id: 'SESSION_2099-01-01T00-00-00' });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('session_not_found');
  });

  it('round-trip: get_session returns the created session', () => {
    const result = handleGetSession(db, { session_id: sessionId });
    const data = parseText(result) as Record<string, unknown>;
    expect(data.id).toBe(sessionId);
    expect(data.source).toBe('test-runner');
    expect(data.loop_status).toBe('running');
  });

  it('accepts legacy underscore session IDs on lookup', () => {
    const result = handleGetSession(db, { session_id: toLegacySessionId(sessionId) });
    const data = parseText(result) as Record<string, unknown>;
    expect(data.id).toBe(sessionId);
  });

  it('includes worker_count structure', () => {
    const result = handleGetSession(db, { session_id: sessionId });
    const data = parseText(result) as { worker_count: { active: number; completed: number; failed: number } };
    expect(data.worker_count).toEqual({ active: 0, completed: 0, failed: 0 });
  });

  it('includes workers structure with active/completed/failed arrays', () => {
    const result = handleGetSession(db, { session_id: sessionId });
    const data = parseText(result) as { workers: { active: unknown[]; completed: unknown[]; failed: unknown[] } };
    expect(Array.isArray(data.workers.active)).toBe(true);
    expect(Array.isArray(data.workers.completed)).toBe(true);
    expect(Array.isArray(data.workers.failed)).toBe(true);
  });
});

describe('handleUpdateSession', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    const r = handleCreateSession(db, {});
    sessionId = (parseText(r) as { session_id: string }).session_id;
  });

  afterEach(() => {
    cleanup();
  });

  it('updates loop_status field', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId,
      fields: { loop_status: 'paused' },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);

    const row = db.prepare('SELECT loop_status FROM sessions WHERE id = ?').get(sessionId) as { loop_status: string };
    expect(row.loop_status).toBe('paused');
  });

  it('updates tasks_terminal field', () => {
    handleUpdateSession(db, { session_id: sessionId, fields: { tasks_terminal: 3 } });
    const row = db.prepare('SELECT tasks_terminal FROM sessions WHERE id = ?').get(sessionId) as { tasks_terminal: number };
    expect(row.tasks_terminal).toBe(3);
  });

  it('rejects unknown columns', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId,
      fields: { bad_column: 'value' },
    });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toContain('not updatable');
  });

  it('returns error when no fields provided', () => {
    const result = handleUpdateSession(db, { session_id: sessionId, fields: {} });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('no fields provided');
  });

  it('returns session_not_found for unknown session', () => {
    const result = handleUpdateSession(db, {
      session_id: 'SESSION_2099-01-01T00-00-00',
      fields: { loop_status: 'paused' },
    });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('session_not_found');
  });

  it('accepts legacy underscore session IDs when updating', () => {
    const result = handleUpdateSession(db, {
      session_id: toLegacySessionId(sessionId),
      fields: { loop_status: 'paused' },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it('updates supervisor_model field', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId,
      fields: { supervisor_model: 'claude-sonnet-4-6' },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
    const row = db.prepare('SELECT supervisor_model FROM sessions WHERE id = ?').get(sessionId) as { supervisor_model: string };
    expect(row.supervisor_model).toBe('claude-sonnet-4-6');
  });

  it('updates mode field', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId,
      fields: { mode: 'auto-pilot' },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
    const row = db.prepare('SELECT mode FROM sessions WHERE id = ?').get(sessionId) as { mode: string };
    expect(row.mode).toBe('auto-pilot');
  });

  it('updates total_cost field', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId,
      fields: { total_cost: 1.23 },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
    const row = db.prepare('SELECT total_cost FROM sessions WHERE id = ?').get(sessionId) as { total_cost: number };
    expect(row.total_cost).toBeCloseTo(1.23);
  });

  it('updates supervisor_model, mode, and total_cost in a single call', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId,
      fields: { supervisor_model: 'claude-opus-4-6', mode: 'split', total_cost: 4.56 },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
    const row = db.prepare('SELECT supervisor_model, mode, total_cost FROM sessions WHERE id = ?').get(sessionId) as { supervisor_model: string; mode: string; total_cost: number };
    expect(row.supervisor_model).toBe('claude-opus-4-6');
    expect(row.mode).toBe('split');
    expect(row.total_cost).toBeCloseTo(4.56);
  });
});

describe('handleListSessions', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('returns empty array when no sessions exist', () => {
    const result = handleListSessions(db, {});
    const data = parseText(result) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it('returns all sessions', () => {
    // Insert sessions directly with unique IDs to avoid second-precision collision
    // in handleCreateSession's timestamp-based ID generator
    db.prepare(`INSERT INTO sessions (id, source, config, loop_status) VALUES (?, ?, '{}', 'running')`).run(
      'SESSION_TEST_LIST_A', 'session-a',
    );
    db.prepare(`INSERT INTO sessions (id, source, config, loop_status) VALUES (?, ?, '{}', 'running')`).run(
      'SESSION_TEST_LIST_B', 'session-b',
    );
    const result = handleListSessions(db, {});
    const data = parseText(result) as unknown[];
    expect(data).toHaveLength(2);
  });

  it('filters by status when provided', () => {
    // Use valid canonical session IDs so handler-level validation passes
    db.prepare(`INSERT INTO sessions (id, source, config, loop_status) VALUES (?, ?, '{}', 'running')`).run(
      'SESSION_2099-01-01T00-00-01', 'source-a',
    );
    db.prepare(`INSERT INTO sessions (id, source, config, loop_status) VALUES (?, ?, '{}', 'running')`).run(
      'SESSION_2099-01-01T00-00-02', 'source-b',
    );

    // End the first session using direct SQL to avoid format issues with hardcoded IDs
    db.prepare(`UPDATE sessions SET loop_status = 'stopped' WHERE id = ?`).run('SESSION_2099-01-01T00-00-01');

    const runningResult = handleListSessions(db, { status: 'running' });
    const runningData = parseText(runningResult) as unknown[];
    expect(runningData).toHaveLength(1);

    const stoppedResult = handleListSessions(db, { status: 'stopped' });
    const stoppedData = parseText(stoppedResult) as unknown[];
    expect(stoppedData).toHaveLength(1);
  });

  it('includes worker_counts per session', () => {
    handleCreateSession(db, {});
    const result = handleListSessions(db, {});
    const data = parseText(result) as Array<{ worker_counts: Record<string, number> }>;
    expect(typeof data[0]!.worker_counts).toBe('object');
  });
});

describe('handleEndSession', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    const r = handleCreateSession(db, {});
    sessionId = (parseText(r) as { session_id: string }).session_id;
  });

  afterEach(() => {
    cleanup();
  });

  it('marks session as stopped', () => {
    handleEndSession(db, { session_id: sessionId });
    const row = db.prepare('SELECT loop_status FROM sessions WHERE id = ?').get(sessionId) as { loop_status: string };
    expect(row.loop_status).toBe('stopped');
  });

  it('returns ok: true with final_counters', () => {
    const result = handleEndSession(db, { session_id: sessionId });
    const data = parseText(result) as { ok: boolean; final_counters: Record<string, number> };
    expect(data.ok).toBe(true);
    expect(typeof data.final_counters).toBe('object');
  });

  it('stores the summary when provided', () => {
    handleEndSession(db, { session_id: sessionId, summary: '3 tasks completed' });
    const row = db.prepare('SELECT summary FROM sessions WHERE id = ?').get(sessionId) as { summary: string };
    expect(row.summary).toBe('3 tasks completed');
  });

  it('returns session_not_found for unknown session', () => {
    const result = handleEndSession(db, { session_id: 'SESSION_2099-01-01T00-00-00' });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('session_not_found');
  });

  it('sets ended_at timestamp', () => {
    handleEndSession(db, { session_id: sessionId });
    const row = db.prepare('SELECT ended_at FROM sessions WHERE id = ?').get(sessionId) as { ended_at: string };
    expect(row.ended_at).toBeTruthy();
    expect(() => new Date(row.ended_at)).not.toThrow();
  });

  it('accepts legacy underscore session IDs when ending', () => {
    const result = handleEndSession(db, { session_id: toLegacySessionId(sessionId) });
    const data = parseText(result) as { ok: boolean; final_counters: Record<string, number> };
    expect(data.ok).toBe(true);
    const row = db.prepare('SELECT loop_status FROM sessions WHERE id = ?').get(sessionId) as { loop_status: string };
    expect(row.loop_status).toBe('stopped');
  });
});

describe('handleUpdateHeartbeat', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    const r = handleCreateSession(db, {});
    sessionId = (parseText(r) as { session_id: string }).session_id;
  });

  afterEach(() => {
    cleanup();
  });

  it('updates last_heartbeat timestamp', () => {
    handleUpdateHeartbeat(db, { session_id: sessionId });
    const row = db.prepare('SELECT last_heartbeat FROM sessions WHERE id = ?').get(sessionId) as { last_heartbeat: string };
    expect(row.last_heartbeat).toBeTruthy();
    expect(() => new Date(row.last_heartbeat)).not.toThrow();
  });

  it('returns session_not_found for unknown session', () => {
    const result = handleUpdateHeartbeat(db, { session_id: 'SESSION_2099-01-01T00-00-00' });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('session_not_found');
  });

  it('accepts legacy underscore session IDs', () => {
    const result = handleUpdateHeartbeat(db, { session_id: toLegacySessionId(sessionId) });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});

describe('handleCloseStaleSessions', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('closes sessions with last_heartbeat older than TTL', () => {
    const r = handleCreateSession(db, {});
    const sessionId = (parseText(r) as { session_id: string }).session_id;

    const oldHeartbeat = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    db.prepare('UPDATE sessions SET last_heartbeat = ? WHERE id = ?').run(oldHeartbeat, sessionId);

    const result = handleCloseStaleSessions(db, { ttl_minutes: 30 });
    const data = parseText(result) as { ok: boolean; closed_sessions: number };
    expect(data.ok).toBe(true);
    expect(data.closed_sessions).toBe(1);

    const row = db.prepare('SELECT loop_status FROM sessions WHERE id = ?').get(sessionId) as { loop_status: string };
    expect(row.loop_status).toBe('stopped');
  });

  it('does not close sessions with recent heartbeat', () => {
    const r = handleCreateSession(db, {});
    const sessionId = (parseText(r) as { session_id: string }).session_id;
    handleUpdateHeartbeat(db, { session_id: sessionId });

    const result = handleCloseStaleSessions(db, { ttl_minutes: 30 });
    const data = parseText(result) as { ok: boolean; closed_sessions: number };
    expect(data.ok).toBe(true);
    expect(data.closed_sessions).toBe(0);
  });

  it('closes sessions with no heartbeat', () => {
    const r = handleCreateSession(db, {});
    const sessionId = (parseText(r) as { session_id: string }).session_id;

    const result = handleCloseStaleSessions(db, { ttl_minutes: 0 });
    const data = parseText(result) as { ok: boolean; closed_sessions: number };
    expect(data.ok).toBe(true);
    expect(data.closed_sessions).toBe(1);

    const row = db.prepare('SELECT loop_status FROM sessions WHERE id = ?').get(sessionId) as { loop_status: string };
    expect(row.loop_status).toBe('stopped');
  });

  it('uses default TTL of 30 minutes when not specified', () => {
    const r = handleCreateSession(db, {});
    const sessionId = (parseText(r) as { session_id: string }).session_id;

    const oldHeartbeat = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    db.prepare('UPDATE sessions SET last_heartbeat = ? WHERE id = ?').run(oldHeartbeat, sessionId);

    const result = handleCloseStaleSessions(db, {});
    const data = parseText(result) as { ok: boolean; closed_sessions: number };
    expect(data.ok).toBe(true);
    expect(data.closed_sessions).toBe(1);
  });
});

// --- Orphan claim tests ---

function insertTask(db: Database.Database, taskId: string, sessionId: string | null, claimedAt: string | null = null, claimTimeoutMs: number | null = null): void {
  db.prepare(
    `INSERT INTO tasks (id, title, type, priority, status, session_claimed, claimed_at, claim_timeout_ms)
     VALUES (?, ?, 'FEATURE', 'P2-Medium', 'IN_PROGRESS', ?, ?, ?)`,
  ).run(taskId, `Task ${taskId}`, sessionId, claimedAt, claimTimeoutMs);
}

describe('handleGetOrphanedClaims', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('returns empty orphaned array when no tasks are claimed', () => {
    const result = handleGetOrphanedClaims(db);
    const data = parseText(result) as { orphaned: unknown[] };
    expect(Array.isArray(data.orphaned)).toBe(true);
    expect(data.orphaned).toHaveLength(0);
  });

  it('returns empty orphaned array when claimed task session is still running', () => {
    const sessionResult = handleCreateSession(db, { skip_orphan_recovery: true });
    const sessionId = (parseText(sessionResult) as { session_id: string }).session_id;

    insertTask(db, 'TASK_2026_TST1', sessionId, new Date().toISOString());

    const result = handleGetOrphanedClaims(db);
    const data = parseText(result) as { orphaned: unknown[] };
    expect(data.orphaned).toHaveLength(0);
  });

  it('returns orphaned tasks when session is dead (stopped)', () => {
    const sessionResult = handleCreateSession(db, { skip_orphan_recovery: true });
    const sessionId = (parseText(sessionResult) as { session_id: string }).session_id;

    insertTask(db, 'TASK_2026_TST2', sessionId, new Date().toISOString());

    // Stop the session so it is considered dead
    handleEndSession(db, { session_id: sessionId });

    const result = handleGetOrphanedClaims(db);
    const data = parseText(result) as { orphaned: Array<{ task_id: string; claimed_by: string }> };
    expect(data.orphaned).toHaveLength(1);
    expect(data.orphaned[0]!.task_id).toBe('TASK_2026_TST2');
    expect(data.orphaned[0]!.claimed_by).toBe(sessionId);
  });

  it('returns orphaned tasks when claimed by a nonexistent session', () => {
    insertTask(db, 'TASK_2026_TST3', 'SESSION_GHOST_9999', new Date().toISOString());

    const result = handleGetOrphanedClaims(db);
    const data = parseText(result) as { orphaned: Array<{ task_id: string }> };
    expect(data.orphaned.some(o => o.task_id === 'TASK_2026_TST3')).toBe(true);
  });
});

describe('TTL expiration detection', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('detects TTL-expired claim even when session is still running', () => {
    const sessionResult = handleCreateSession(db, { skip_orphan_recovery: true });
    const sessionId = (parseText(sessionResult) as { session_id: string }).session_id;

    // claimed_at set to 2 minutes ago, timeout = 1 minute (60000 ms)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    insertTask(db, 'TASK_2026_TTL1', sessionId, twoMinutesAgo, 60_000);

    const result = handleGetOrphanedClaims(db);
    const data = parseText(result) as { orphaned: Array<{ task_id: string; stale_for_ms: number }> };

    const found = data.orphaned.find(o => o.task_id === 'TASK_2026_TTL1');
    expect(found).toBeDefined();
    expect(found!.stale_for_ms).toBeGreaterThan(60_000);
  });

  it('does not report a claim as orphaned when TTL has not expired and session is running', () => {
    const sessionResult = handleCreateSession(db, { skip_orphan_recovery: true });
    const sessionId = (parseText(sessionResult) as { session_id: string }).session_id;

    // claimed_at = just now, timeout = 1 hour (should not expire)
    insertTask(db, 'TASK_2026_TTL2', sessionId, new Date().toISOString(), 3_600_000);

    const result = handleGetOrphanedClaims(db);
    const data = parseText(result) as { orphaned: Array<{ task_id: string }> };
    expect(data.orphaned.some(o => o.task_id === 'TASK_2026_TTL2')).toBe(false);
  });
});

describe('handleReleaseOrphanedClaims', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('returns released: 0 when no orphans exist', () => {
    const result = handleReleaseOrphanedClaims(db);
    const data = parseText(result) as { released: number; tasks: string[] };
    expect(data.released).toBe(0);
    expect(data.tasks).toHaveLength(0);
  });

  it('releases orphaned claims and resets status to CREATED', () => {
    insertTask(db, 'TASK_2026_REL1', 'SESSION_DEAD_111', new Date().toISOString());

    const result = handleReleaseOrphanedClaims(db);
    const data = parseText(result) as { released: number; tasks: string[] };
    expect(data.released).toBe(1);
    expect(data.tasks).toContain('TASK_2026_REL1');

    const row = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_REL1') as { status: string; session_claimed: string | null };
    expect(row.status).toBe('CREATED');
    expect(row.session_claimed).toBeNull();
  });

  it('logs an orphan_recovery event with correct event_type and details structure', () => {
    insertTask(db, 'TASK_2026_REL2', 'SESSION_DEAD_222', new Date().toISOString());

    handleReleaseOrphanedClaims(db);

    const event = db.prepare(
      `SELECT event_type, data FROM events WHERE task_id = ? AND event_type = 'orphan_recovery'`,
    ).get('TASK_2026_REL2') as { event_type: string; data: string } | undefined;

    expect(event).toBeDefined();
    expect(event!.event_type).toBe('orphan_recovery');

    const payload = JSON.parse(event!.data) as { details: { was_claimed_by: string; stale_for_ms: number } };
    expect(payload.details).toBeDefined();
    expect(payload.details.was_claimed_by).toBe('SESSION_DEAD_222');
    expect(typeof payload.details.stale_for_ms).toBe('number');
  });

  it('logs session_id = "system" on orphan_recovery events', () => {
    insertTask(db, 'TASK_2026_REL3', 'SESSION_DEAD_333', new Date().toISOString());

    handleReleaseOrphanedClaims(db);

    const event = db.prepare(
      `SELECT session_id FROM events WHERE task_id = ? AND event_type = 'orphan_recovery'`,
    ).get('TASK_2026_REL3') as { session_id: string } | undefined;

    expect(event).toBeDefined();
    expect(event!.session_id).toBe('system');
  });
});

describe('create_session auto-recovery', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-releases orphaned claims on session creation and includes orphan_recovery in response', () => {
    insertTask(db, 'TASK_2026_AUTO1', 'SESSION_DEAD_AUTO', new Date().toISOString());

    const result = handleCreateSession(db, {});
    const data = parseText(result) as { ok: boolean; session_id: string; orphan_recovery?: { orphaned_claims_released: number; task_ids: string[] } };

    expect(data.ok).toBe(true);
    expect(data.orphan_recovery).toBeDefined();
    expect(data.orphan_recovery!.orphaned_claims_released).toBe(1);
    expect(data.orphan_recovery!.task_ids).toContain('TASK_2026_AUTO1');

    const row = db.prepare('SELECT status, session_claimed FROM tasks WHERE id = ?').get('TASK_2026_AUTO1') as { status: string; session_claimed: string | null };
    expect(row.status).toBe('CREATED');
    expect(row.session_claimed).toBeNull();
  });

  it('skip_orphan_recovery: true suppresses auto-recovery', () => {
    insertTask(db, 'TASK_2026_SKIP1', 'SESSION_DEAD_SKIP', new Date().toISOString());

    const result = handleCreateSession(db, { skip_orphan_recovery: true });
    const data = parseText(result) as { ok: boolean; orphan_recovery?: unknown };

    expect(data.ok).toBe(true);
    expect(data.orphan_recovery).toBeUndefined();

    // Task should still be claimed — recovery was skipped
    const row = db.prepare('SELECT session_claimed FROM tasks WHERE id = ?').get('TASK_2026_SKIP1') as { session_claimed: string | null };
    expect(row.session_claimed).toBe('SESSION_DEAD_SKIP');
  });

  it('orphan_recovery field is absent when no orphans were released', () => {
    // No orphaned tasks — fresh DB with no claims
    const result = handleCreateSession(db, {});
    const data = parseText(result) as { ok: boolean; orphan_recovery?: unknown };
    expect(data.ok).toBe(true);
    // orphan_recovery should be absent (not included) when released count is 0
    expect(data.orphan_recovery).toBeUndefined();
  });
});
