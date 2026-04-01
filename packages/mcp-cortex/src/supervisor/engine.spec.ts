import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SupervisorEngine } from './engine.js';
import type { SpawnParams, SpawnOutcome, EngineConfig } from './engine.js';
import type Database from 'better-sqlite3';
import {
  getBuildPipelineConfig,
  buildOrchestrationInstructions,
  buildPhaseTelemetry,
  buildWorkerPrompt,
} from './engine.js';
import type { PromptContext } from './engine.js';

const baseCtx: PromptContext = {
  taskId: 'TASK_2026_001',
  workerId: 'WID_test1234',
  sessionId: 'SESSION_2026-01-01T10-00-00',
  complexity: 'Simple',
  priority: 'P2-Medium',
  provider: 'claude',
  model: 'claude-sonnet-4-6',
  retryCount: 0,
  maxRetries: 2,
  projectRoot: '/project',
};

describe('getBuildPipelineConfig', () => {
  it('skips PM and Architect for Simple', () => {
    const config = getBuildPipelineConfig('Simple');
    expect(config.runPM).toBe(false);
    expect(config.runArchitect).toBe(false);
    expect(config.skippedPhases).toEqual(['PM', 'Architect']);
  });

  it('runs full pipeline for Medium', () => {
    const config = getBuildPipelineConfig('Medium');
    expect(config.runPM).toBe(true);
    expect(config.runArchitect).toBe(true);
    expect(config.skippedPhases).toHaveLength(0);
  });

  it('runs full pipeline for Complex', () => {
    const config = getBuildPipelineConfig('Complex');
    expect(config.runPM).toBe(true);
    expect(config.runArchitect).toBe(true);
    expect(config.skippedPhases).toHaveLength(0);
  });

  it('runs full pipeline for unknown complexity', () => {
    const config = getBuildPipelineConfig('Unknown');
    expect(config.runPM).toBe(true);
    expect(config.runArchitect).toBe(true);
    expect(config.skippedPhases).toHaveLength(0);
  });
});

describe('buildOrchestrationInstructions', () => {
  it('mentions skipped phases for Simple', () => {
    const result = buildOrchestrationInstructions('Simple');
    expect(result).toContain('SKIPPED');
    expect(result).toContain('PM');
    expect(result).toContain('Architect');
    expect(result).not.toContain('PM -> Architect');
  });

  it('includes full pipeline instruction for Medium', () => {
    const result = buildOrchestrationInstructions('Medium');
    expect(result).toContain('PM -> Architect -> Team-Leader -> Dev');
    expect(result).not.toContain('SKIPPED');
  });

  it('includes full pipeline instruction for Complex', () => {
    const result = buildOrchestrationInstructions('Complex');
    expect(result).toContain('PM -> Architect -> Team-Leader -> Dev');
  });
});

describe('buildPhaseTelemetry', () => {
  it('returns skipped phases annotation for Simple', () => {
    const result = buildPhaseTelemetry('Simple');
    expect(result).toBe('Skipped-Phases: PM, Architect');
  });

  it('returns empty string for Medium (no skips)', () => {
    expect(buildPhaseTelemetry('Medium')).toBe('');
  });

  it('returns empty string for Complex (no skips)', () => {
    expect(buildPhaseTelemetry('Complex')).toBe('');
  });
});

describe('buildWorkerPrompt', () => {
  it('Simple prompt includes skipped phases annotation in footer', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Simple' });
    expect(prompt).toContain('Skipped-Phases: PM, Architect');
  });

  it('Medium prompt does not include skipped phases', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Medium' });
    expect(prompt).not.toContain('Skipped-Phases');
  });

  it('Simple prompt skips PM/Architect orchestration instructions', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Simple' });
    expect(prompt).toContain('SKIPPED');
    expect(prompt).not.toContain('PM -> Architect');
  });

  it('Medium prompt includes full pipeline instructions', () => {
    const prompt = buildWorkerPrompt({ ...baseCtx, complexity: 'Medium' });
    expect(prompt).toContain('PM -> Architect -> Team-Leader -> Dev');
  });

  it('prompt contains task ID and worker ID', () => {
    const prompt = buildWorkerPrompt(baseCtx);
    expect(prompt).toContain('TASK_2026_001');
    expect(prompt).toContain('WID_test1234');
  });

  it('commit footer contains all required metadata fields', () => {
    const prompt = buildWorkerPrompt(baseCtx);
    expect(prompt).toContain('Task: TASK_2026_001');
    expect(prompt).toContain('Session: SESSION_2026-01-01T10-00-00');
    expect(prompt).toContain('Provider: claude');
    expect(prompt).toContain('Model: claude-sonnet-4-6');
    expect(prompt).toContain('Retry: 0/2');
    expect(prompt).toContain('Complexity: Simple');
    expect(prompt).toContain('Priority: P2-Medium');
    expect(prompt).toContain('Generated-By: nitro-fueled');
  });
});

// ===========================================================================
// SupervisorEngine tests
// ===========================================================================

/**
 * Lightweight test DB that creates only the tables the engine needs.
 * Avoids the pre-existing index ordering bug in the full initDatabase().
 */
function makeTempDb(): { db: Database.Database; cleanup: () => void } {
  const dbPath = join(tmpdir(), `engine-test-${randomUUID()}.db`);
  const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
  const db: Database.Database = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Tasks table (with all migration columns baked in)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'CREATED',
      type             TEXT NOT NULL DEFAULT 'FEATURE',
      priority         TEXT NOT NULL DEFAULT 'P2-Medium',
      complexity       TEXT,
      model            TEXT,
      dependencies     TEXT NOT NULL DEFAULT '[]',
      session_claimed  TEXT,
      claimed_at       TEXT,
      claim_timeout_ms INTEGER,
      preferred_provider TEXT,
      parent_task_id   TEXT,
      subtask_order    INTEGER,
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      project_root TEXT NOT NULL DEFAULT '',
      loop_status  TEXT NOT NULL DEFAULT 'running',
      updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  // Workers table (with all migration columns baked in)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id                TEXT PRIMARY KEY,
      session_id        TEXT NOT NULL REFERENCES sessions(id),
      task_id           TEXT REFERENCES tasks(id),
      worker_type       TEXT NOT NULL DEFAULT 'build',
      label             TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'active',
      working_directory TEXT NOT NULL DEFAULT '',
      model             TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      provider          TEXT NOT NULL DEFAULT 'claude',
      launcher          TEXT NOT NULL DEFAULT 'print',
      auto_close        INTEGER NOT NULL DEFAULT 0,
      pid               INTEGER,
      spawn_time        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      progress_json     TEXT NOT NULL DEFAULT '{}',
      tokens_json       TEXT NOT NULL DEFAULT '{}',
      cost_json         TEXT NOT NULL DEFAULT '{}',
      updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  // Handoffs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS handoffs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      TEXT NOT NULL REFERENCES tasks(id),
      worker_type  TEXT NOT NULL DEFAULT 'build',
      files_changed TEXT NOT NULL DEFAULT '[]',
      commits      TEXT NOT NULL DEFAULT '[]',
      decisions    TEXT NOT NULL DEFAULT '[]',
      risks        TEXT NOT NULL DEFAULT '[]',
      created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  return { db, cleanup: () => { try { db.close(); } catch { /* ignore */ } } };
}

const SESSION_ID = 'SESSION_2026-01-01T10-00-00';

function insertTask(
  db: Database.Database,
  id: string,
  opts: { status?: string; priority?: string; complexity?: string; deps?: string } = {},
): void {
  db.prepare(`
    INSERT INTO tasks (id, title, status, priority, complexity, dependencies)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    `Task ${id}`,
    opts.status ?? 'CREATED',
    opts.priority ?? 'P2-Medium',
    opts.complexity ?? 'Medium',
    opts.deps ?? '[]',
  );
}

function insertSession(db: Database.Database): void {
  db.prepare(`INSERT INTO sessions (id, project_root) VALUES (?, ?)`).run(SESSION_ID, '/tmp/test');
}

function insertWorker(
  db: Database.Database,
  id: string,
  opts: {
    taskId?: string;
    status?: string;
    workerType?: string;
    /**
     * Use process.pid for workers that should survive startup recovery.
     * Use null (default) for stale workers that startup recovery should kill.
     */
    pid?: number | null;
    progressJson?: string;
    costJson?: string;
  } = {},
): void {
  db.prepare(`
    INSERT INTO workers
      (id, session_id, task_id, worker_type, label, status, working_directory, model, provider, launcher, pid, progress_json, cost_json, tokens_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    SESSION_ID,
    opts.taskId ?? null,
    opts.workerType ?? 'build',
    `Worker ${id}`,
    opts.status ?? 'active',
    '/tmp/test',
    'claude-sonnet-4-6',
    'claude',
    'print',
    opts.pid ?? null,
    opts.progressJson ?? JSON.stringify({ message_count: 1, tool_calls: 0, files_read: [], files_written: [], last_action: 'test', last_action_at: Date.now(), elapsed_minutes: 0 }),
    opts.costJson ?? '{"input_usd":0,"output_usd":0,"cache_usd":0,"total_usd":0}',
    '{"total_input":0,"total_output":0,"total_cache_creation":0,"total_cache_read":0,"total_combined":0,"context_current_k":0,"context_percent":0,"compaction_count":0}',
  );
}

function makeEngine(
  db: Database.Database,
  spawnFn: (p: SpawnParams) => SpawnOutcome,
  overrides: Partial<EngineConfig> = {},
): SupervisorEngine {
  return new SupervisorEngine(db, {
    sessionId: SESSION_ID,
    workingDirectory: '/tmp/test',
    concurrencyLimit: 3,
    intervalMs: 60_000,  // long interval — tests call _runCycle indirectly via start()
    spawnFn,
    ...overrides,
  });
}

// ── 1. State machine: CREATED → IN_PROGRESS on spawn ─────────────────────────

describe('SupervisorEngine — state machine', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const result = makeTempDb();
    db = result.db;
    cleanup = result.cleanup;
    insertSession(db);
  });

  afterEach(() => cleanup());

  it('transitions a CREATED task to IN_PROGRESS when a worker is spawned', () => {
    insertTask(db, 'TASK_001');
    const spawned: string[] = [];
    const engine = makeEngine(db, (p) => { spawned.push(p.taskId); return { ok: true, workerId: 'WID_1' }; });

    // run one cycle via start() then immediately stop
    engine.start();
    engine.stop();

    expect(spawned).toContain('TASK_001');
    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_001') as { status: string };
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('does not spawn a task that has a CREATED dep that is not yet terminal', () => {
    insertTask(db, 'TASK_DEP', { status: 'CREATED' });
    insertTask(db, 'TASK_001', { deps: '["TASK_DEP"]' });
    const spawned: string[] = [];
    const engine = makeEngine(db, (p) => { spawned.push(p.taskId); return { ok: true, workerId: 'WID_1' }; });

    engine.start();
    engine.stop();

    expect(spawned).not.toContain('TASK_001');
  });

  it('spawns a task whose dep is COMPLETE', () => {
    insertTask(db, 'TASK_DEP', { status: 'COMPLETE' });
    insertTask(db, 'TASK_001', { deps: '["TASK_DEP"]' });
    const spawned: string[] = [];
    const engine = makeEngine(db, (p) => { spawned.push(p.taskId); return { ok: true, workerId: 'WID_1' }; });

    engine.start();
    engine.stop();

    expect(spawned).toContain('TASK_001');
  });

  it('releases claim back to CREATED when spawn fails', () => {
    insertTask(db, 'TASK_001');
    const engine = makeEngine(db, () => ({ ok: false, reason: 'spawn failed' }));

    engine.start();
    engine.stop();

    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_001') as { status: string };
    expect(row.status).toBe('CREATED');
  });
});

// ── 2. Concurrency limit ──────────────────────────────────────────────────────

describe('SupervisorEngine — concurrency limit', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const result = makeTempDb();
    db = result.db;
    cleanup = result.cleanup;
    insertSession(db);
  });

  afterEach(() => cleanup());

  it('respects concurrencyLimit — does not spawn when limit is reached', () => {
    insertTask(db, 'TASK_001');
    insertTask(db, 'TASK_002');
    // Insert tasks before workers (FK: workers.task_id → tasks.id)
    insertTask(db, 'TASK_A', { status: 'IN_PROGRESS' });
    insertTask(db, 'TASK_B', { status: 'IN_PROGRESS' });
    // Two active workers fill the limit of 2; use process.pid so startup recovery doesn't kill them
    insertWorker(db, 'WID_A', { status: 'active', taskId: 'TASK_A', pid: process.pid });
    insertWorker(db, 'WID_B', { status: 'active', taskId: 'TASK_B', pid: process.pid });

    const spawned: string[] = [];
    const engine = makeEngine(db, (p) => { spawned.push(p.taskId); return { ok: true }; }, { concurrencyLimit: 2 });

    engine.start();
    engine.stop();

    expect(spawned).toHaveLength(0);
  });

  it('spawns up to (limit - active) workers', () => {
    insertTask(db, 'TASK_001');
    insertTask(db, 'TASK_002');
    insertTask(db, 'TASK_003');
    insertTask(db, 'TASK_A', { status: 'IN_PROGRESS' });
    // pid = process.pid so the worker survives startup recovery
    insertWorker(db, 'WID_A', { status: 'active', taskId: 'TASK_A', pid: process.pid });

    const spawned: string[] = [];
    const engine = makeEngine(db, (p) => { spawned.push(p.taskId); return { ok: true, workerId: randomUUID() }; }, { concurrencyLimit: 3 });

    engine.start();
    engine.stop();

    // slots = 3 - 1 = 2 → should spawn at most 2
    expect(spawned.length).toBeLessThanOrEqual(2);
    expect(spawned.length).toBeGreaterThan(0);
  });
});

// ── 3. Model routing ──────────────────────────────────────────────────────────

describe('SupervisorEngine — model routing', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const result = makeTempDb();
    db = result.db;
    cleanup = result.cleanup;
    insertSession(db);
  });

  afterEach(() => cleanup());

  it('passes the routed model and provider to spawnFn', () => {
    insertTask(db, 'TASK_001');
    let capturedModel = '';
    let capturedProvider = '';

    const engine = makeEngine(
      db,
      (p) => { capturedModel = p.model; capturedProvider = p.provider; return { ok: true }; },
      {
        providers: [{
          name: 'anthropic',
          launcher: 'claude',
          available: true,
          models: { balanced: 'claude-sonnet-4-6' },
        }],
      },
    );

    engine.start();
    engine.stop();

    expect(capturedModel).toBe('claude-sonnet-4-6');
    expect(capturedProvider).toBe('anthropic');
  });
});

// ── 4. Reconciliation ─────────────────────────────────────────────────────────

describe('SupervisorEngine — worker-exit reconciliation', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const result = makeTempDb();
    db = result.db;
    cleanup = result.cleanup;
    insertSession(db);
  });

  afterEach(() => cleanup());

  it('transitions task to IMPLEMENTED when build worker exits with a handoff with commits', () => {
    insertTask(db, 'TASK_001', { status: 'IN_PROGRESS' });
    insertWorker(db, 'WID_1', { taskId: 'TASK_001', status: 'completed', workerType: 'build' });
    // Insert a handoff with commits
    db.prepare(`
      INSERT INTO handoffs (task_id, worker_type, files_changed, commits, decisions, risks)
      VALUES (?, 'build', '[]', '["abc123: feat: done"]', '[]', '[]')
    `).run('TASK_001');

    const engine = makeEngine(db, () => ({ ok: true }));
    engine.start();
    engine.stop();

    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_001') as { status: string };
    expect(row.status).toBe('IMPLEMENTED');
  });

  it('transitions task to FAILED when build worker exits without a handoff', () => {
    insertTask(db, 'TASK_001', { status: 'IN_PROGRESS' });
    insertWorker(db, 'WID_1', { taskId: 'TASK_001', status: 'completed', workerType: 'build' });
    // No handoff inserted

    const engine = makeEngine(db, () => ({ ok: true }));
    engine.start();
    engine.stop();

    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_001') as { status: string };
    expect(row.status).toBe('FAILED');
  });

  it('emits task:transitioned event with from/to status', () => {
    insertTask(db, 'TASK_001', { status: 'IN_PROGRESS' });
    insertWorker(db, 'WID_1', { taskId: 'TASK_001', status: 'completed', workerType: 'review' });
    db.prepare(`INSERT INTO handoffs (task_id, worker_type, files_changed, commits, decisions, risks) VALUES (?, 'review', '[]', '[]', '[]', '[]')`).run('TASK_001');

    const transitions: Array<{ taskId: string; from: string; to: string }> = [];
    const engine = makeEngine(db, () => ({ ok: true }));
    engine.on('task:transitioned', (e) => transitions.push(e));

    engine.start();
    engine.stop();

    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.from).toBe('IN_PROGRESS');
    expect(transitions[0]!.to).toBe('COMPLETE');
  });

  it('does not reconcile the same worker twice', () => {
    insertTask(db, 'TASK_001', { status: 'IN_PROGRESS' });
    insertWorker(db, 'WID_1', { taskId: 'TASK_001', status: 'completed', workerType: 'build' });

    let transitionCount = 0;
    const engine = makeEngine(db, () => ({ ok: true }));
    engine.on('task:transitioned', () => transitionCount++);

    // Simulate two cycles by calling start() (which runs one cycle immediately)
    // then manually triggering another via the internal method reflection
    engine.start();
    // Access the private method via type assertion for test purposes
    (engine as unknown as { _runCycle: () => void })._runCycle();
    engine.stop();

    // Should only reconcile once despite two cycles
    expect(transitionCount).toBe(1);
  });
});

// ── 5. Startup recovery ───────────────────────────────────────────────────────

describe('SupervisorEngine — startup recovery', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const result = makeTempDb();
    db = result.db;
    cleanup = result.cleanup;
    insertSession(db);
  });

  afterEach(() => cleanup());

  it('kills stale workers and releases their tasks on startup', () => {
    insertTask(db, 'TASK_001', { status: 'IN_PROGRESS' });
    // Stale worker: last_action_at > 5 minutes ago
    const staleProgress = JSON.stringify({
      message_count: 1,
      tool_calls: 0,
      files_read: [],
      files_written: [],
      last_action: 'test',
      last_action_at: Date.now() - 10 * 60 * 1000,  // 10 min ago
      elapsed_minutes: 10,
    });
    insertWorker(db, 'WID_STALE', { taskId: 'TASK_001', status: 'active', pid: null, progressJson: staleProgress });

    // concurrencyLimit: 0 prevents the cycle from spawning new workers after recovery
    const engine = makeEngine(db, () => ({ ok: true }), { concurrencyLimit: 0 });
    engine.start();
    engine.stop();

    const worker = db.prepare('SELECT status FROM workers WHERE id = ?').get('WID_STALE') as { status: string };
    expect(worker.status).toBe('killed');

    const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get('TASK_001') as { status: string };
    expect(task.status).toBe('CREATED');
  });
});

// ── 6. Orphan guard ───────────────────────────────────────────────────────────

describe('SupervisorEngine — orphan guard', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    const result = makeTempDb();
    db = result.db;
    cleanup = result.cleanup;
    insertSession(db);
  });

  afterEach(() => cleanup());

  it('kills active workers whose tasks are not IN_PROGRESS on stop()', () => {
    insertTask(db, 'TASK_001', { status: 'COMPLETE' });
    insertWorker(db, 'WID_ORPHAN', { taskId: 'TASK_001', status: 'active', pid: null });

    const engine = makeEngine(db, () => ({ ok: true }));
    // Don't start — just stop to trigger orphan guard directly
    engine.stop();

    const worker = db.prepare('SELECT status FROM workers WHERE id = ?').get('WID_ORPHAN') as { status: string };
    expect(worker.status).toBe('killed');
  });

  it('does not kill workers whose task is IN_PROGRESS', () => {
    insertTask(db, 'TASK_001', { status: 'IN_PROGRESS' });
    // pid = process.pid so the orphan guard checks task status (not pid)
    insertWorker(db, 'WID_ACTIVE', { taskId: 'TASK_001', status: 'active', pid: process.pid });

    const engine = makeEngine(db, () => ({ ok: true }));
    engine.stop();

    const worker = db.prepare('SELECT status FROM workers WHERE id = ?').get('WID_ACTIVE') as { status: string };
    expect(worker.status).toBe('active');
  });
});
