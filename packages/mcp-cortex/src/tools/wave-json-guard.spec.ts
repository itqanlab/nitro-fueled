/**
 * Tests for TASK_2026_189: JSON.parse guards in wave.ts
 *
 * Verifies that malformed or non-array dependencies columns do NOT crash
 * handleGetNextWave and instead fall back to treating the task as having
 * no dependencies (deps = []).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDatabase } from '../db/schema.js';
import { handleCreateSession } from './sessions.js';
import { handleGetNextWave } from './wave.js';
import type Database from 'better-sqlite3';

function makeTempDb(): { db: Database.Database; cleanup: () => void } {
  const dbPath = join(tmpdir(), `cortex-wave-guard-test-${randomUUID()}.db`);
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

function insertTaskWithRawDeps(db: Database.Database, taskId: string, rawDeps: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, type, priority, status, dependencies, created_at, updated_at)
     VALUES (?, 'Test task', 'BUGFIX', 'P1-High', 'CREATED', ?, ?, ?)`,
  ).run(taskId, rawDeps, now, now);
}

describe('wave.ts — JSON.parse guard for dependencies column', () => {
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

  it('malformed dependencies column returns [] (no crash, task is included in wave)', () => {
    // Insert a task with an invalid JSON string in the dependencies column.
    // The guard should catch the SyntaxError and treat deps as [], so the task
    // has no dependencies and is eligible for the next wave.
    insertTaskWithRawDeps(db, 'TASK_2026_801', 'NOT_VALID_JSON{{{');

    const wave = parseText(
      handleGetNextWave(db, { session_id: sessionId, slots: 5 }),
    ) as Array<{ id: string }>;

    // Task must appear — malformed deps are treated as no deps (all deps complete = true)
    expect(wave.some(t => t.id === 'TASK_2026_801')).toBe(true);
  });

  it('non-array valid JSON (e.g. "None") returns [] (task included in wave)', () => {
    // Some rows may have the string "None" stored as the dependencies value.
    // JSON.parse("None") throws, so the guard catches it and returns [].
    insertTaskWithRawDeps(db, 'TASK_2026_802', 'None');

    const wave = parseText(
      handleGetNextWave(db, { session_id: sessionId, slots: 5 }),
    ) as Array<{ id: string }>;

    expect(wave.some(t => t.id === 'TASK_2026_802')).toBe(true);
  });

  it('non-array valid JSON object returns [] (task included in wave)', () => {
    // JSON.parse('{"key":"value"}') succeeds but is not an array.
    // The guard checks Array.isArray and falls back to [].
    insertTaskWithRawDeps(db, 'TASK_2026_803', '{"key":"value"}');

    const wave = parseText(
      handleGetNextWave(db, { session_id: sessionId, slots: 5 }),
    ) as Array<{ id: string }>;

    expect(wave.some(t => t.id === 'TASK_2026_803')).toBe(true);
  });

  it('non-array valid JSON number returns [] (task included in wave)', () => {
    // JSON.parse('42') succeeds but is not an array — should fall back to [].
    insertTaskWithRawDeps(db, 'TASK_2026_804', '42');

    const wave = parseText(
      handleGetNextWave(db, { session_id: sessionId, slots: 5 }),
    ) as Array<{ id: string }>;

    expect(wave.some(t => t.id === 'TASK_2026_804')).toBe(true);
  });

  it('valid JSON array with an unsatisfied dep keeps task blocked', () => {
    // Sanity check: a well-formed dependency array that points to an incomplete
    // task should still block the dependent task from the wave.
    insertTaskWithRawDeps(db, 'TASK_2026_805', '["TASK_2026_999"]');

    const wave = parseText(
      handleGetNextWave(db, { session_id: sessionId, slots: 5 }),
    ) as Array<{ id: string }>;

    expect(wave.some(t => t.id === 'TASK_2026_805')).toBe(false);
  });
});
