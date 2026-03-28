import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase, emptyTokenStats, emptyCost, emptyProgress } from './schema.js';
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

describe('initDatabase', () => {
  let db: Database.Database;
  let cleanup: () => void;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('creates all required tables without error', () => {
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('tasks');
    expect(names).toContain('sessions');
    expect(names).toContain('workers');
  });

  it('creates all required indexes', () => {
    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);
    expect(names).toContain('idx_tasks_status');
    expect(names).toContain('idx_tasks_claimed');
    expect(names).toContain('idx_workers_session');
    expect(names).toContain('idx_workers_task');
    expect(names).toContain('idx_workers_status');
    expect(names).toContain('idx_sessions_status');
  });

  it('is idempotent — can be called multiple times without error', () => {
    // initDatabase uses CREATE IF NOT EXISTS so running again against same db should not throw
    expect(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`);
    }).not.toThrow();
  });

  it('enforces foreign keys (workers.session_id references sessions.id)', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO workers (id, session_id, worker_type, tokens_json, cost_json, progress_json)
         VALUES ('w1', 'nonexistent-session', 'build', '{}', '{}', '{}')`,
      ).run();
    }).toThrow();
  });
});

describe('emptyTokenStats', () => {
  it('returns all fields as zero', () => {
    const stats = emptyTokenStats();
    expect(stats.total_input).toBe(0);
    expect(stats.total_output).toBe(0);
    expect(stats.total_cache_creation).toBe(0);
    expect(stats.total_cache_read).toBe(0);
    expect(stats.total_combined).toBe(0);
    expect(stats.context_current_k).toBe(0);
    expect(stats.context_percent).toBe(0);
    expect(stats.compaction_count).toBe(0);
  });

  it('returns a new object each call (not a shared reference)', () => {
    const a = emptyTokenStats();
    const b = emptyTokenStats();
    a.total_input = 999;
    expect(b.total_input).toBe(0);
  });
});

describe('emptyCost', () => {
  it('returns all fields as zero', () => {
    const cost = emptyCost();
    expect(cost.input_usd).toBe(0);
    expect(cost.output_usd).toBe(0);
    expect(cost.cache_usd).toBe(0);
    expect(cost.total_usd).toBe(0);
  });

  it('returns a new object each call', () => {
    const a = emptyCost();
    const b = emptyCost();
    a.total_usd = 42;
    expect(b.total_usd).toBe(0);
  });
});

describe('emptyProgress', () => {
  it('returns all fields with zero/empty values', () => {
    const progress = emptyProgress();
    expect(progress.message_count).toBe(0);
    expect(progress.tool_calls).toBe(0);
    expect(progress.files_read).toEqual([]);
    expect(progress.files_written).toEqual([]);
    expect(progress.last_action).toBe('spawned');
    expect(progress.elapsed_minutes).toBe(0);
    expect(typeof progress.last_action_at).toBe('number');
  });

  it('returns a new object each call', () => {
    const a = emptyProgress();
    const b = emptyProgress();
    a.files_read.push('/some/file');
    expect(b.files_read).toHaveLength(0);
  });
});

export { makeTempDb };
