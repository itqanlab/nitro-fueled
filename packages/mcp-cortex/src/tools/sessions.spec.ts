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
} from './sessions.js';
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
    const result = handleGetSession(db, { session_id: 'SESSION_nonexistent' });
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
    const result = handleGetSession(db, { session_id: sessionId.replace('T', '_') });
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
      session_id: 'SESSION_NOPE',
      fields: { loop_status: 'paused' },
    });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('session_not_found');
  });

  it('accepts legacy underscore session IDs when updating', () => {
    const result = handleUpdateSession(db, {
      session_id: sessionId.replace('T', '_'),
      fields: { loop_status: 'paused' },
    });
    const data = parseText(result) as { ok: boolean };
    expect(data.ok).toBe(true);
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
    // Insert sessions directly with unique IDs
    db.prepare(`INSERT INTO sessions (id, source, config, loop_status) VALUES (?, ?, '{}', 'running')`).run(
      'SESSION_TEST_FILTER_A', 'source-a',
    );
    db.prepare(`INSERT INTO sessions (id, source, config, loop_status) VALUES (?, ?, '{}', 'running')`).run(
      'SESSION_TEST_FILTER_B', 'source-b',
    );

    // End the first session
    handleEndSession(db, { session_id: 'SESSION_TEST_FILTER_A' });

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
    const result = handleEndSession(db, { session_id: 'SESSION_NOPE' });
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
});
