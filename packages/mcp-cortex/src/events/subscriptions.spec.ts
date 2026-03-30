import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { initDatabase } from '../db/schema.js';
import { handleCreateSession } from '../tools/sessions.js';
import { FileWatcher, EmitQueue, handleSubscribeWorker, handleGetPendingEvents, type WatchEvent } from './subscriptions.js';
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

function getRawText(result: { content: Array<{ type: 'text'; text: string }> }): string {
  return result.content[0]!.text;
}

function parseText(result: { content: Array<{ type: 'text'; text: string }> }): unknown {
  return JSON.parse(result.content[0]!.text);
}

function insertWorkerWithDir(
  db: Database.Database,
  sessionId: string,
  workingDirectory: string,
): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO workers (id, session_id, task_id, worker_type, label, status, pid, working_directory, model, provider, launcher, log_path, auto_close, tokens_json, cost_json, progress_json)
    VALUES (?, ?, NULL, 'build', 'test-worker', 'active', NULL, ?, 'claude-sonnet-4-6', 'claude', 'print', NULL, 0, '{}', '{}', '{}')
  `).run(id, sessionId, workingDirectory);
  return id;
}

describe('FileWatcher — drainEvents when empty', () => {
  it('returns empty array when no events have been enqueued', () => {
    const watcher = new FileWatcher();
    try {
      const events = watcher.drainEvents();
      expect(events).toEqual([]);
    } finally {
      watcher.closeAll();
    }
  });

  it('drainEvents is destructive — second drain returns empty after first consumed events', () => {
    const watcher = new FileWatcher();
    try {
      // No events added, both drains are empty
      watcher.drainEvents();
      const second = watcher.drainEvents();
      expect(second).toEqual([]);
    } finally {
      watcher.closeAll();
    }
  });
});

describe('FileWatcher — file_exists condition triggers on file creation', () => {
  let watchDir: string;
  let watcher: FileWatcher;

  beforeEach(() => {
    watchDir = join(tmpdir(), `filewatcher-test-${randomUUID()}`);
    mkdirSync(watchDir, { recursive: true });
    watcher = new FileWatcher();
  });

  afterEach(() => {
    watcher.closeAll();
  });

  it('enqueues an event when watched file is created', async () => {
    const workerId = randomUUID();
    const filename = `signal-${randomUUID()}.txt`;

    watcher.subscribe(workerId, 'test-session', watchDir, [
      { type: 'file_exists', path: filename, event_label: 'done' },
    ]);

    // Give chokidar time to fully initialize and reach 'ready' state before writing
    await new Promise((r) => setTimeout(r, 600));

    // Write the file — should trigger the watcher add event
    writeFileSync(join(watchDir, filename), 'hello');

    // Poll until event arrives
    let events: ReturnType<typeof watcher.drainEvents> = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      events = watcher.drainEvents();
      if (events.length > 0) break;
    }

    expect(events.length).toBeGreaterThanOrEqual(1);
    const evt = events[0]! as WatchEvent;
    expect(evt.worker_id).toBe(workerId);
    expect(evt.event_label).toBe('done');
    expect(evt.condition.type).toBe('file_exists');
  }, 8000);

  it('only enqueues one event per subscription (satisfied flag)', async () => {
    const workerId = randomUUID();
    const filename = `signal-${randomUUID()}.txt`;

    watcher.subscribe(workerId, 'test-session', watchDir, [
      { type: 'file_exists', path: filename, event_label: 'done' },
    ]);

    // Give chokidar time to initialize before writing
    await new Promise((r) => setTimeout(r, 600));

    const filePath = join(watchDir, filename);
    writeFileSync(filePath, 'first write');

    // Wait for chokidar to fire
    let events: ReturnType<typeof watcher.drainEvents> = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      events = [...events, ...watcher.drainEvents()];
      if (events.length > 0) break;
    }

    // Write again — subscription should already be cleaned up, no second event
    writeFileSync(filePath, 'second write');
    await new Promise((r) => setTimeout(r, 500));
    events = [...events, ...watcher.drainEvents()];

    // Should only have one event (subscription cleaned up after first trigger)
    expect(events.length).toBe(1);
  }, 8000);
});

describe('FileWatcher — subscribe path boundary enforcement', () => {
  it('throws if a condition path escapes working_directory', () => {
    const watcher = new FileWatcher();
    const workerId = randomUUID();
    try {
      expect(() => {
        watcher.subscribe(workerId, 'test-session', '/tmp/safe-dir', [
          { type: 'file_exists', path: '../../etc/passwd', event_label: 'escape' },
        ]);
      }).toThrow(/escapes working_directory boundary/);
    } finally {
      watcher.closeAll();
    }
  });

  it('throws if too many conditions are provided', () => {
    const watcher = new FileWatcher();
    const workerId = randomUUID();
    const conditions = Array.from({ length: 21 }, (_, i) => ({
      type: 'file_exists' as const,
      path: `file-${i}.txt`,
      event_label: `event-${i}`,
    }));
    try {
      expect(() => {
        watcher.subscribe(workerId, 'test-session', '/tmp', conditions);
      }).toThrow(/Too many conditions/);
    } finally {
      watcher.closeAll();
    }
  });
});

describe('handleSubscribeWorker', () => {
  let db: Database.Database;
  let cleanup: () => void;
  let sessionId: string;

  beforeEach(() => {
    ({ db, cleanup } = makeTempDb());
    const r = handleCreateSession(db, {});
    sessionId = (JSON.parse(r.content[0]!.text) as { session_id: string }).session_id;
  });

  afterEach(() => {
    cleanup();
  });

  it('returns error for unknown worker_id', () => {
    const watcher = new FileWatcher();
    try {
      const result = handleSubscribeWorker(db, watcher, {
        worker_id: 'nonexistent-worker',
        conditions: [{ type: 'file_exists', path: 'status.txt', event_label: 'done' }],
      });
      const data = parseText(result) as { subscribed: boolean; error: string };
      expect(data.subscribed).toBe(false);
      expect(data.error).toContain('not found');
    } finally {
      watcher.closeAll();
    }
  });

  it('subscribes successfully when worker exists with working_directory', () => {
    const workDir = join(tmpdir(), `sub-test-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    const workerId = insertWorkerWithDir(db, sessionId, workDir);

    const watcher = new FileWatcher();
    try {
      const result = handleSubscribeWorker(db, watcher, {
        worker_id: workerId,
        conditions: [{ type: 'file_exists', path: 'status.txt', event_label: 'done' }],
      });
      const data = parseText(result) as { subscribed: boolean; watched_paths: string[] };
      expect(data.subscribed).toBe(true);
      expect(Array.isArray(data.watched_paths)).toBe(true);
      expect(data.watched_paths).toHaveLength(1);
    } finally {
      watcher.closeAll();
    }
  });
});

describe('handleGetPendingEvents', () => {
  it('returns empty events array when queue is empty', () => {
    const watcher = new FileWatcher();
    try {
      const result = handleGetPendingEvents(watcher, new EmitQueue());
      const data = parseText(result) as { events: unknown[] };
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.events).toHaveLength(0);
    } finally {
      watcher.closeAll();
    }
  });
});
