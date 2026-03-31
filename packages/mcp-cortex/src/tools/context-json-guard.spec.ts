/**
 * Tests for TASK_2026_189: JSON.parse guards in context.ts
 *
 * Verifies that malformed file_scope or dependencies columns do NOT crash
 * handleGetTaskContext and instead fall back to empty arrays [].
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase } from '../db/schema.js';
import { handleGetTaskContext } from './context.js';
import type Database from 'better-sqlite3';

function makeTempDb(): { db: Database.Database; cleanup: () => void } {
  const dbPath = join(tmpdir(), `cortex-context-guard-test-${randomUUID()}.db`);
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

/**
 * Insert a task with arbitrary raw values for file_scope and dependencies
 * columns. We use db.prepare directly to bypass any application-layer
 * serialisation so we can simulate bad data already in the DB.
 */
function insertTaskWithRawColumns(
  db: Database.Database,
  taskId: string,
  rawFileScope: string,
  rawDeps: string,
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, type, priority, status, file_scope, dependencies, created_at, updated_at)
     VALUES (?, 'Test task', 'BUGFIX', 'P1-High', 'CREATED', ?, ?, ?, ?)`,
  ).run(taskId, rawFileScope, rawDeps, now, now);
}

describe('context.ts — JSON.parse guard for file_scope column', () => {
  let db: Database.Database;
  let cleanup: () => void;
  // Use a temp dir that is guaranteed to exist as projectRoot so the
  // assertInsideBase check in handleGetTaskContext passes without real files.
  const projectRoot = tmpdir();

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('malformed file_scope column returns [] (no crash)', () => {
    insertTaskWithRawColumns(db, 'TASK_2026_811', 'NOT_VALID_JSON{{{', '[]');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_811' }, projectRoot),
    ) as { ok: boolean; file_scope: string[] };

    expect(result.ok).toBe(true);
    expect(result.file_scope).toEqual([]);
  });

  it('non-array valid JSON in file_scope (object) returns [] (no crash)', () => {
    insertTaskWithRawColumns(db, 'TASK_2026_812', '{"key":"value"}', '[]');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_812' }, projectRoot),
    ) as { ok: boolean; file_scope: string[] };

    expect(result.ok).toBe(true);
    expect(result.file_scope).toEqual([]);
  });

  it('empty string file_scope column returns [] (no crash)', () => {
    // An empty string is not valid JSON — the guard must catch the parse error.
    insertTaskWithRawColumns(db, 'TASK_2026_813', '', '[]');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_813' }, projectRoot),
    ) as { ok: boolean; file_scope: string[] };

    expect(result.ok).toBe(true);
    expect(result.file_scope).toEqual([]);
  });
});

describe('context.ts — JSON.parse guard for dependencies column', () => {
  let db: Database.Database;
  let cleanup: () => void;
  const projectRoot = tmpdir();

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it('malformed dependencies column returns [] (no crash)', () => {
    insertTaskWithRawColumns(db, 'TASK_2026_821', '[]', 'NOT_VALID_JSON{{{');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_821' }, projectRoot),
    ) as { ok: boolean; dependencies: string[] };

    expect(result.ok).toBe(true);
    expect(result.dependencies).toEqual([]);
  });

  it('non-array valid JSON in dependencies (string "None") returns []', () => {
    // "None" is not valid JSON so JSON.parse throws — guard must catch it.
    insertTaskWithRawColumns(db, 'TASK_2026_822', '[]', 'None');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_822' }, projectRoot),
    ) as { ok: boolean; dependencies: string[] };

    expect(result.ok).toBe(true);
    expect(result.dependencies).toEqual([]);
  });

  it('non-array valid JSON in dependencies (number) returns []', () => {
    insertTaskWithRawColumns(db, 'TASK_2026_823', '[]', '42');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_823' }, projectRoot),
    ) as { ok: boolean; dependencies: string[] };

    expect(result.ok).toBe(true);
    expect(result.dependencies).toEqual([]);
  });

  it('valid JSON array dependencies are returned correctly', () => {
    // Sanity check: a well-formed dependency list is preserved.
    insertTaskWithRawColumns(db, 'TASK_2026_824', '[]', '["TASK_2026_100"]');

    const result = parseText(
      handleGetTaskContext(db, { task_id: 'TASK_2026_824' }, projectRoot),
    ) as { ok: boolean; dependencies: string[] };

    expect(result.ok).toBe(true);
    expect(result.dependencies).toEqual(['TASK_2026_100']);
  });
});
