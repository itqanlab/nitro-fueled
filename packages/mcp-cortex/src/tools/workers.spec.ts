import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase, emptyTokenStats, emptyCost, emptyProgress } from '../db/schema.js';
import { handleCreateSession } from './sessions.js';
import { toLegacySessionId } from './session-id.js';
import {
  handleListWorkers,
  handleGetWorkerStats,
  handleGetWorkerActivity,
  handleKillWorker,
  handleSpawnWorker,
} from './workers.js';
import type Database from 'better-sqlite3';

// Mock the spawn module to avoid actually spawning processes in tests
vi.mock('../process/spawn.js', () => ({
  spawnWorkerProcess: vi.fn(() => ({ pid: 99999, logPath: '/tmp/test.log' })),
  killWorkerProcess: vi.fn(() => true),
  isProcessAlive: vi.fn(() => false),
  resolveGlmApiKey: vi.fn(() => undefined),
}));

// Mock the jsonl-watcher's feedMessage
const mockJsonlWatcher = {
  feedMessage: vi.fn(),
};

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

function getRawText(result: { content: Array<{ type: 'text'; text: string }> }): string {
  return result.content[0]!.text;
}

function createTestSession(db: Database.Database): string {
  const r = handleCreateSession(db, { source: 'test' });
  return (JSON.parse(r.content[0]!.text) as { session_id: string }).session_id;
}

function insertWorkerRow(
  db: Database.Database,
  sessionId: string,
  overrides: Partial<{
    id: string;
    worker_type: string;
    label: string;
    status: string;
    pid: number | null;
    model: string;
    provider: string;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  // Use proper JSON blobs with all required fields so parseTokens/parseCost/parseProgress work correctly
  const tokensJson = JSON.stringify(emptyTokenStats());
  const costJson = JSON.stringify(emptyCost());
  const progressJson = JSON.stringify(emptyProgress());
  db.prepare(`
    INSERT INTO workers (id, session_id, task_id, worker_type, label, status, pid, working_directory, model, provider, launcher, log_path, auto_close, tokens_json, cost_json, progress_json)
    VALUES (?, ?, NULL, ?, ?, ?, ?, '/tmp', ?, ?, 'print', '/tmp/test.log', 0, ?, ?, ?)
  `).run(
    id,
    sessionId,
    overrides.worker_type ?? 'build',
    overrides.label ?? 'test-worker',
    overrides.status ?? 'active',
    overrides.pid ?? null,
    overrides.model ?? 'claude-sonnet-4-6',
    overrides.provider ?? 'claude',
    tokensJson,
    costJson,
    progressJson,
  );
  return id;
}

describe('handleListWorkers', () => {
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

  it('returns empty JSON array when no workers found', () => {
    const result = handleListWorkers(db, {});
    const data = parseText(result);
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(0);
  });

  it('returns empty JSON array for empty session', () => {
    const result = handleListWorkers(db, { session_id: sessionId });
    const data = parseText(result);
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(0);
  });

  it('returns JSON array with worker info when workers exist', () => {
    insertWorkerRow(db, sessionId, { label: 'build-worker-1' });
    const result = handleListWorkers(db, { session_id: sessionId });
    const data = parseText(result) as Array<{ label: string; status: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0]!.label).toBe('build-worker-1');
    expect(data[0]!.status).toBe('active');
  });

  it('accepts legacy underscore session IDs when listing workers', () => {
    insertWorkerRow(db, sessionId, { label: 'legacy-session-worker' });
    const result = parseText(handleListWorkers(db, { session_id: toLegacySessionId(sessionId) })) as Array<{ label: string }>;
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('legacy-session-worker');
  });

  it('filters by status_filter', () => {
    insertWorkerRow(db, sessionId, { label: 'active-worker', status: 'active' });
    insertWorkerRow(db, sessionId, { label: 'completed-worker', status: 'completed' });

    const activeResult = parseText(handleListWorkers(db, { session_id: sessionId, status_filter: 'active' })) as Array<{ label: string }>;
    expect(activeResult.map((w) => w.label)).toContain('active-worker');
    expect(activeResult.map((w) => w.label)).not.toContain('completed-worker');

    const completedResult = parseText(handleListWorkers(db, { session_id: sessionId, status_filter: 'completed' })) as Array<{ label: string }>;
    expect(completedResult.map((w) => w.label)).toContain('completed-worker');
    expect(completedResult.map((w) => w.label)).not.toContain('active-worker');
  });

  it('includes provider and model in worker JSON output', () => {
    insertWorkerRow(db, sessionId, { label: 'my-worker', model: 'claude-sonnet-4-6', provider: 'claude' });
    const result = parseText(handleListWorkers(db, { session_id: sessionId })) as Array<{ provider: string; model: string }>;
    expect(result[0]!.provider).toBe('claude');
    expect(result[0]!.model).toBe('claude-sonnet-4-6');
  });
});

describe('handleGetWorkerStats', () => {
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

  it('returns not found message for unknown worker_id', () => {
    const result = handleGetWorkerStats(db, { worker_id: 'nonexistent-id' });
    expect(getRawText(result)).toContain('not_found');
  });

  it('returns stats report for existing worker', () => {
    const workerId = insertWorkerRow(db, sessionId, { label: 'stats-worker' });
    const result = handleGetWorkerStats(db, { worker_id: workerId });
    const text = getRawText(result);
    expect(text).toContain('stats-worker');
    expect(text).toContain('Tokens:');
    expect(text).toContain('Cost:');
    expect(text).toContain('Progress:');
  });
});

describe('handleGetWorkerActivity', () => {
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

  it('returns not found message for unknown worker_id', () => {
    const result = handleGetWorkerActivity(db, { worker_id: 'nonexistent-id' });
    expect(getRawText(result)).toContain('not_found');
  });

  it('returns activity summary for existing worker', () => {
    const workerId = insertWorkerRow(db, sessionId, { label: 'activity-worker' });
    const result = handleGetWorkerActivity(db, { worker_id: workerId });
    const text = getRawText(result);
    expect(text).toContain('activity-worker');
    expect(text).toContain('Provider:');
  });
});

describe('handleKillWorker', () => {
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

  it('returns not found message for unknown worker_id', () => {
    const result = handleKillWorker(db, { worker_id: 'nonexistent-id' });
    expect(getRawText(result)).toContain('not_found');
  });

  it('marks worker status as killed in DB', () => {
    const workerId = insertWorkerRow(db, sessionId, { status: 'active' });
    handleKillWorker(db, { worker_id: workerId });
    const row = db.prepare('SELECT status FROM workers WHERE id = ?').get(workerId) as { status: string };
    expect(row.status).toBe('killed');
  });

  it('returns termination message with provider and reason', () => {
    const workerId = insertWorkerRow(db, sessionId, { label: 'doomed-worker' });
    const result = handleKillWorker(db, { worker_id: workerId, reason: 'timeout' });
    const text = getRawText(result);
    expect(text).toContain('doomed-worker');
    expect(text).toContain('timeout');
  });
});

describe('handleSpawnWorker — DB insertion', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    sessionId = createTestSession(db);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('inserts worker row and returns worker_id', async () => {
    const result = handleSpawnWorker(db, mockJsonlWatcher as never, {
      session_id: sessionId,
      worker_type: 'build',
      prompt: 'Do some work',
      working_directory: '/tmp',
      label: 'spawn-test-worker',
    });
    const data = parseText(result) as { ok: boolean; worker_id: string; pid: number; label: string };
    expect(data.ok).toBe(true);
    expect(typeof data.worker_id).toBe('string');
    expect(data.label).toBe('spawn-test-worker');

    // Verify DB row was inserted
    const row = db.prepare('SELECT id, status, worker_type FROM workers WHERE id = ?').get(data.worker_id) as { id: string; status: string; worker_type: string };
    expect(row).toBeTruthy();
    expect(row.status).toBe('active');
    expect(row.worker_type).toBe('build');
  });

  it('accepts legacy underscore session IDs when spawning a worker', async () => {
    const result = handleSpawnWorker(db, mockJsonlWatcher as never, {
      session_id: toLegacySessionId(sessionId),
      worker_type: 'build',
      prompt: 'Do some work',
      working_directory: '/tmp',
      label: 'legacy-spawn-worker',
    });
    const data = parseText(result) as { ok: boolean; worker_id: string };
    expect(data.ok).toBe(true);

    const row = db.prepare('SELECT session_id FROM workers WHERE id = ?').get(data.worker_id) as { session_id: string };
    expect(row.session_id).toBe(sessionId);
  });

  it('returns error when GLM provider requested but no API key', async () => {
    const result = handleSpawnWorker(db, mockJsonlWatcher as never, {
      session_id: sessionId,
      worker_type: 'build',
      prompt: 'Do some work',
      working_directory: '/tmp',
      label: 'glm-test-worker',
      provider: 'glm',
    });
    const data = parseText(result) as { ok: boolean; reason: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toContain('GLM API key not found');
  });

  it('uses default model when none provided', async () => {
    const result = handleSpawnWorker(db, mockJsonlWatcher as never, {
      session_id: sessionId,
      worker_type: 'review',
      prompt: 'Review this',
      working_directory: '/tmp',
      label: 'default-model-worker',
    });
    const data = parseText(result) as { ok: boolean; worker_id: string; model: string };
    expect(data.ok).toBe(true);
    // Model should be set (either default or environment-provided)
    const row = db.prepare('SELECT model FROM workers WHERE id = ?').get(data.worker_id) as { model: string };
    expect(typeof row.model).toBe('string');
    expect(row.model.length).toBeGreaterThan(0);
  });
});
