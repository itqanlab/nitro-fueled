import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emptyProgress } from '../db/schema.js';
import type { WorkerProgress } from '../db/schema.js';
import {
  checkWorkerHealth,
  checkHeartbeat,
  reconcileWorkerExit,
  recoverStaleSession,
} from './health.js';
import type { WorkerRecord, SessionRecord, Handoff } from './types.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../process/spawn.js', () => ({
  isProcessAlive: vi.fn(),
}));

import { isProcessAlive } from '../process/spawn.js';
const mockIsProcessAlive = vi.mocked(isProcessAlive);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWorker(overrides: Partial<WorkerRecord> = {}): WorkerRecord {
  return {
    id: 'worker-1',
    session_id: 'session-1',
    task_id: 'task-1',
    worker_type: 'build',
    label: 'test worker',
    status: 'active',
    pid: 1234,
    spawn_time: new Date().toISOString(),
    progress_json: JSON.stringify(emptyProgress()),
    tokens_json: '{}',
    cost_json: '{}',
    ...overrides,
  };
}

function progressJson(overrides: Partial<WorkerProgress> = {}): string {
  return JSON.stringify({ ...emptyProgress(), ...overrides });
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    loop_status: 'running',
    ...overrides,
  };
}

function makeHandoff(overrides: Partial<Handoff> = {}): Handoff {
  return {
    id: 1,
    task_id: 'task-1',
    worker_type: 'build',
    files_changed: [],
    commits: [],
    decisions: [],
    risks: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── checkWorkerHealth ─────────────────────────────────────────────────────────

describe('checkWorkerHealth', () => {
  let strikeMap: Map<string, number>;

  beforeEach(() => {
    strikeMap = new Map();
  });

  it('returns healthy and clears any existing strike when worker is active', () => {
    // Worker acted 10 seconds ago — well within the 120s threshold
    const worker = makeWorker({
      progress_json: progressJson({ last_action_at: Date.now() - 10_000 }),
    });
    strikeMap.set(worker.id, 1); // pre-existing strike

    const result = checkWorkerHealth(worker, strikeMap);

    expect(result.action).toBe('healthy');
    expect(result.reason).toBe('active');
    expect(result.strikes).toBe(0);
    expect(strikeMap.has(worker.id)).toBe(false);
  });

  it('returns warn with strike 1 on first idle detection', () => {
    const worker = makeWorker({
      progress_json: progressJson({ last_action_at: Date.now() - 300_000 }), // 5 min ago
    });

    const result = checkWorkerHealth(worker, strikeMap);

    expect(result.action).toBe('warn');
    expect(result.strikes).toBe(1);
    expect(strikeMap.get(worker.id)).toBe(1);
  });

  it('returns kill with strike 2 on second consecutive idle detection', () => {
    const worker = makeWorker({
      progress_json: progressJson({ last_action_at: Date.now() - 300_000 }),
    });

    // First check
    checkWorkerHealth(worker, strikeMap);
    // Second check
    const result = checkWorkerHealth(worker, strikeMap);

    expect(result.action).toBe('kill');
    expect(result.strikes).toBe(2);
  });

  it('clears strike when worker becomes active again after being idle', () => {
    const idleWorker = makeWorker({ progress_json: progressJson({ last_action_at: Date.now() - 300_000 }) });
    checkWorkerHealth(idleWorker, strikeMap);
    expect(strikeMap.get(idleWorker.id)).toBe(1);

    const activeWorker = makeWorker({ id: idleWorker.id, progress_json: progressJson({ last_action_at: Date.now() - 5_000 }) });
    const result = checkWorkerHealth(activeWorker, strikeMap);

    expect(result.action).toBe('healthy');
    expect(strikeMap.has(idleWorker.id)).toBe(false);
  });
});

// ── checkHeartbeat ────────────────────────────────────────────────────────────

describe('checkHeartbeat', () => {
  it('returns false when last action is older than the timeout', () => {
    const worker = makeWorker({
      progress_json: progressJson({ last_action_at: Date.now() - 6 * 60_000 }), // 6 min ago
    });

    expect(checkHeartbeat(worker, 5 * 60_000)).toBe(false);
  });

  it('returns true when last action is within the timeout', () => {
    const worker = makeWorker({
      progress_json: progressJson({ last_action_at: Date.now() - 30_000 }), // 30s ago
    });

    expect(checkHeartbeat(worker, 5 * 60_000)).toBe(true);
  });

  it('uses 5-minute default: active at 4min returns true, stale at 6min returns false', () => {
    const alive = makeWorker({ progress_json: progressJson({ last_action_at: Date.now() - 4 * 60_000 }) });
    const stale = makeWorker({ progress_json: progressJson({ last_action_at: Date.now() - 6 * 60_000 }) });
    expect(checkHeartbeat(alive)).toBe(true);
    expect(checkHeartbeat(stale)).toBe(false);
  });

  it('does not throw for malformed progress_json', () => {
    const worker = makeWorker({ progress_json: 'not-valid-json' });
    expect(() => checkHeartbeat(worker)).not.toThrow();
  });
});

// ── reconcileWorkerExit ───────────────────────────────────────────────────────

describe('reconcileWorkerExit', () => {
  it('returns FAILED with "no handoff" reason when handoff is null', () => {
    const worker = makeWorker({ worker_type: 'build' });
    const result = reconcileWorkerExit(worker, null);

    expect(result.newStatus).toBe('FAILED');
    expect(result.reason).toContain('no handoff');
  });

  it('returns IMPLEMENTED for a build worker with commits in handoff', () => {
    const worker = makeWorker({ worker_type: 'build' });
    const handoff = makeHandoff({ commits: ['abc1234'], files_changed: [] });
    const result = reconcileWorkerExit(worker, handoff);

    expect(result.newStatus).toBe('IMPLEMENTED');
  });

  it('returns IMPLEMENTED for a build worker with files_changed in handoff', () => {
    const worker = makeWorker({ worker_type: 'build' });
    const handoff = makeHandoff({
      commits: [],
      files_changed: [{ path: 'src/foo.ts', action: 'modified' }],
    });
    const result = reconcileWorkerExit(worker, handoff);

    expect(result.newStatus).toBe('IMPLEMENTED');
  });

  it('returns FAILED for a build worker with empty handoff (no commits, no files)', () => {
    const worker = makeWorker({ worker_type: 'build' });
    const handoff = makeHandoff({ commits: [], files_changed: [] });
    const result = reconcileWorkerExit(worker, handoff);

    expect(result.newStatus).toBe('FAILED');
  });

  it('returns IMPLEMENTED for an implement worker with changes', () => {
    const worker = makeWorker({ worker_type: 'implement' });
    const handoff = makeHandoff({ worker_type: 'implement', commits: ['def5678'] });
    const result = reconcileWorkerExit(worker, handoff);

    expect(result.newStatus).toBe('IMPLEMENTED');
  });

  it('returns PREPPED for a prep worker with handoff', () => {
    const worker = makeWorker({ worker_type: 'prep' });
    const handoff = makeHandoff({ worker_type: 'prep' });
    const result = reconcileWorkerExit(worker, handoff);

    expect(result.newStatus).toBe('PREPPED');
    expect(result.reason).toContain('prep worker');
  });

  it('returns COMPLETE for review and cleanup workers with handoff', () => {
    for (const workerType of ['review', 'cleanup'] as const) {
      const worker = makeWorker({ worker_type: workerType });
      const handoff = makeHandoff({ worker_type: workerType });
      const result = reconcileWorkerExit(worker, handoff);
      expect(result.newStatus).toBe('COMPLETE');
    }
  });
});

// ── recoverStaleSession ───────────────────────────────────────────────────────

describe('recoverStaleSession', () => {
  beforeEach(() => {
    mockIsProcessAlive.mockReset();
  });

  it('marks an active worker for kill when its PID is dead', () => {
    mockIsProcessAlive.mockReturnValue(false);

    const session = makeSession();
    const worker = makeWorker({
      status: 'active',
      pid: 9999,
      // Recent heartbeat — only the dead PID should trigger the kill
      progress_json: progressJson({ last_action_at: Date.now() - 10_000 }),
    });

    const plan = recoverStaleSession(session, [worker]);

    expect(plan.workersToKill).toContain(worker.id);
    expect(plan.tasksToRelease).toContain(worker.task_id);
  });

  it('marks an active worker for kill when its heartbeat is stale (>5min), even if PID is alive', () => {
    mockIsProcessAlive.mockReturnValue(true);

    const session = makeSession();
    const worker = makeWorker({
      status: 'active',
      pid: 5678,
      progress_json: progressJson({ last_action_at: Date.now() - 6 * 60_000 }), // 6 min stale
    });

    const plan = recoverStaleSession(session, [worker]);

    expect(plan.workersToKill).toContain(worker.id);
    expect(plan.tasksToRelease).toContain(worker.task_id);
  });

  it('does not kill a healthy worker (alive PID + recent heartbeat)', () => {
    mockIsProcessAlive.mockReturnValue(true);

    const session = makeSession();
    const worker = makeWorker({
      status: 'active',
      pid: 1111,
      progress_json: progressJson({ last_action_at: Date.now() - 30_000 }), // 30s ago
    });

    const plan = recoverStaleSession(session, [worker]);

    expect(plan.workersToKill).not.toContain(worker.id);
    expect(plan.tasksToRelease).not.toContain(worker.task_id);
  });

  it('skips workers that are already in a terminal status', () => {
    mockIsProcessAlive.mockReturnValue(false);

    const session = makeSession();
    const completedWorker = makeWorker({
      id: 'worker-done',
      status: 'completed',
      pid: 2222,
      progress_json: progressJson({ last_action_at: Date.now() - 300_000 }),
    });
    const killedWorker = makeWorker({
      id: 'worker-killed',
      status: 'killed',
      pid: 3333,
      progress_json: progressJson({ last_action_at: Date.now() - 300_000 }),
    });

    const plan = recoverStaleSession(session, [completedWorker, killedWorker]);

    expect(plan.workersToKill).toHaveLength(0);
    expect(plan.tasksToRelease).toHaveLength(0);
  });

  it('does not add a task ID to tasksToRelease when worker has no task_id', () => {
    mockIsProcessAlive.mockReturnValue(false);

    const session = makeSession();
    const worker = makeWorker({
      status: 'active',
      pid: 4444,
      task_id: null,
      progress_json: progressJson({ last_action_at: Date.now() - 300_000 }),
    });

    const plan = recoverStaleSession(session, [worker]);

    expect(plan.workersToKill).toContain(worker.id);
    expect(plan.tasksToRelease).toHaveLength(0);
  });

  it('handles an empty worker list gracefully', () => {
    const plan = recoverStaleSession(makeSession(), []);

    expect(plan.workersToKill).toHaveLength(0);
    expect(plan.tasksToRelease).toHaveLength(0);
  });
});
