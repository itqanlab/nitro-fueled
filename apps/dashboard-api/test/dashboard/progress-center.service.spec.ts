/**
 * Unit tests for ProgressCenterService.
 *
 * CortexService is fully mocked — no DB or NestJS HTTP server needed.
 * Tests cover: snapshot assembly, health tone logic, session status aggregation,
 * activity feed filtering, and cortex-unavailable fallback.
 */
import 'reflect-metadata';
import type { CortexEvent, CortexPhaseTiming, CortexSession, CortexTask, CortexTaskTrace, CortexWorker } from '../../src/dashboard/cortex.types';
import { ProgressCenterService } from '../../src/dashboard/progress-center.service';

// ============================================================
// Shared factories
// ============================================================

const SESSION_ID = 'SESSION_2026-03-31_10-00-00';
const TASK_ID = 'TASK_2026_001';

function makeSession(overrides: Partial<CortexSession> = {}): CortexSession {
  return {
    id: SESSION_ID,
    source: 'auto-pilot',
    started_at: '2026-03-31T10:00:00.000Z',
    ended_at: null,
    loop_status: 'running',
    tasks_terminal: 0,
    supervisor_model: 'claude-sonnet',
    supervisor_launcher: 'sdk',
    mode: 'auto',
    total_cost: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    last_heartbeat: new Date().toISOString(),
    drain_requested: false,
    ...overrides,
  };
}

function makeWorker(overrides: Partial<CortexWorker> = {}): CortexWorker {
  return {
    id: 'worker-1',
    session_id: SESSION_ID,
    task_id: TASK_ID,
    worker_type: 'build',
    label: 'Build Worker',
    status: 'running',
    model: 'claude-sonnet',
    provider: 'claude',
    launcher: 'sdk',
    spawn_time: '2026-03-31T10:00:00.000Z',
    outcome: null,
    retry_number: 0,
    cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    ...overrides,
  };
}

function makeTask(overrides: Partial<CortexTask> = {}): CortexTask {
  return {
    id: TASK_ID,
    title: 'Test Task',
    type: 'feature',
    priority: 'medium',
    status: 'IN_PROGRESS',
    complexity: 'medium',
    dependencies: [],
    created_at: '2026-03-31T09:00:00.000Z',
    updated_at: '2026-03-31T10:00:00.000Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CortexEvent> = {}): CortexEvent {
  return {
    id: 1,
    session_id: SESSION_ID,
    task_id: TASK_ID,
    source: 'supervisor',
    event_type: 'task_started',
    data: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTrace(overrides: Partial<CortexTaskTrace> = {}): CortexTaskTrace {
  return {
    task_id: TASK_ID,
    workers: [],
    phases: [],
    reviews: [],
    fix_cycles: [],
    events: [],
    ...overrides,
  };
}

function makePhaseTiming(): CortexPhaseTiming[] {
  return [];
}

// ============================================================
// Mock CortexService factory
// ============================================================

function makeMockCortexService(overrides: Record<string, jest.Mock> = {}) {
  return {
    getSessions: jest.fn().mockReturnValue([]),
    getWorkers: jest.fn().mockReturnValue([]),
    getTasks: jest.fn().mockReturnValue([]),
    getPhaseTiming: jest.fn().mockReturnValue(makePhaseTiming()),
    getEventsSince: jest.fn().mockReturnValue([]),
    getTaskTrace: jest.fn().mockReturnValue(makeTrace()),
    ...overrides,
  };
}

function makeService(cortexOverrides: Record<string, jest.Mock> = {}) {
  const cortex = makeMockCortexService(cortexOverrides);
  const service = new ProgressCenterService(cortex as any);
  return { service, cortex };
}

// ============================================================
// Tests
// ============================================================

describe('ProgressCenterService', () => {
  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------
  // getSnapshot() — cortex unavailable
  // ----------------------------------------------------------

  describe('getSnapshot() — cortex unavailable', () => {
    it('should return null when getSessions returns null', () => {
      const { service } = makeService({ getSessions: jest.fn().mockReturnValue(null) });
      expect(service.getSnapshot()).toBeNull();
    });

    it('should return null when getWorkers returns null', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getWorkers: jest.fn().mockReturnValue(null),
      });
      expect(service.getSnapshot()).toBeNull();
    });

    it('should return null when getTasks returns null', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue(null),
      });
      expect(service.getSnapshot()).toBeNull();
    });

    it('should return null when getPhaseTiming returns null', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getPhaseTiming: jest.fn().mockReturnValue(null),
      });
      expect(service.getSnapshot()).toBeNull();
    });

    it('should return null when getEventsSince returns null', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getPhaseTiming: jest.fn().mockReturnValue([]),
        getEventsSince: jest.fn().mockReturnValue(null),
      });
      expect(service.getSnapshot()).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // getSnapshot() — empty data
  // ----------------------------------------------------------

  describe('getSnapshot() — empty data', () => {
    it('should return a valid snapshot with no active sessions', () => {
      const { service } = makeService();
      const snapshot = service.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.sessions).toHaveLength(0);
      expect(snapshot!.activity).toHaveLength(0);
    });

    it('should have a generatedAt ISO timestamp', () => {
      const { service } = makeService();
      const snapshot = service.getSnapshot()!;
      expect(() => new Date(snapshot.generatedAt)).not.toThrow();
      expect(new Date(snapshot.generatedAt).toISOString()).toBe(snapshot.generatedAt);
    });

    it('should have a healthy tone with no sessions or failed tasks', () => {
      const { service } = makeService();
      const snapshot = service.getSnapshot()!;
      expect(snapshot.health.tone).toBe('healthy');
      expect(snapshot.health.activeSessions).toBe(0);
      expect(snapshot.health.failedTasks).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // getSnapshot() — active session
  // ----------------------------------------------------------

  describe('getSnapshot() — active session', () => {
    it('should include a running session in the snapshot', () => {
      const session = makeSession();
      const worker = makeWorker();
      const task = makeTask();
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([worker]),
        getTasks: jest.fn().mockReturnValue([task]),
        getTaskTrace: jest.fn().mockReturnValue(makeTrace()),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions).toHaveLength(1);
      expect(snapshot.sessions[0].sessionId).toBe(SESSION_ID);
    });

    it('should not include sessions that have ended', () => {
      const session = makeSession({ ended_at: '2026-03-31T12:00:00.000Z' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions).toHaveLength(0);
    });

    it('should not include sessions with loop_status other than running', () => {
      const session = makeSession({ loop_status: 'stopped' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions).toHaveLength(0);
    });

    it('should report active workers count correctly', () => {
      const session = makeSession();
      const workers = [makeWorker({ status: 'running' }), makeWorker({ id: 'w2', status: 'running' }), makeWorker({ id: 'w3', status: 'completed' })];
      const task = makeTask();
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue(workers),
        getTasks: jest.fn().mockReturnValue([task]),
        getTaskTrace: jest.fn().mockReturnValue(makeTrace()),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].activeWorkers).toBe(2);
    });

    it('should use task title from task map when available', () => {
      const session = makeSession();
      const worker = makeWorker();
      const task = makeTask({ title: 'Build Progress Center' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([worker]),
        getTasks: jest.fn().mockReturnValue([task]),
        getTaskTrace: jest.fn().mockReturnValue(makeTrace()),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].tasks[0]?.title).toBe('Build Progress Center');
    });

    it('should fall back to task ID as title when task is not in map', () => {
      const session = makeSession();
      const worker = makeWorker({ task_id: 'TASK_2026_999' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([worker]),
        getTasks: jest.fn().mockReturnValue([]),
        getTaskTrace: jest.fn().mockReturnValue(makeTrace({ task_id: 'TASK_2026_999' })),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].tasks[0]?.title).toBe('TASK_2026_999');
    });

    it('should exclude tasks where getTaskTrace returns null', () => {
      const session = makeSession();
      const worker = makeWorker();
      const task = makeTask();
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([worker]),
        getTasks: jest.fn().mockReturnValue([task]),
        getTaskTrace: jest.fn().mockReturnValue(null),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].tasks).toHaveLength(0);
    });

    it('should report source from session data', () => {
      const session = makeSession({ source: 'manual-run' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].source).toBe('manual-run');
    });
  });

  // ----------------------------------------------------------
  // health tone logic
  // ----------------------------------------------------------

  describe('health tone logic', () => {
    it('should return healthy tone when no stuck workers, failed tasks, or retrying workers', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([makeTask({ status: 'COMPLETE' })]),
        getWorkers: jest.fn().mockReturnValue([makeWorker({ status: 'completed', retry_number: 0 })]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.health.tone).toBe('healthy');
    });

    it('should return critical tone when there are failed tasks', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([makeTask({ status: 'FAILED' })]),
        getWorkers: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.health.tone).toBe('critical');
      expect(snapshot.health.failedTasks).toBe(1);
    });

    it('should return warning tone when there are retrying workers (no stuck/failed)', () => {
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getWorkers: jest.fn().mockReturnValue([makeWorker({ status: 'running', retry_number: 1 })]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.health.tone).toBe('warning');
      expect(snapshot.health.retryingWorkers).toBe(1);
    });

    it('should count active sessions in health', () => {
      const session = makeSession();
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.health.activeSessions).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // activity feed
  // ----------------------------------------------------------

  describe('activity feed', () => {
    it('should include events belonging to active sessions', () => {
      const session = makeSession();
      const event = makeEvent({ session_id: SESSION_ID, event_type: 'task_started' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getEventsSince: jest.fn().mockReturnValue([event]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.activity).toHaveLength(1);
      expect(snapshot.activity[0].eventType).toBe('task_started');
    });

    it('should exclude events from sessions that are not active', () => {
      const stoppedSession = makeSession({ loop_status: 'stopped' });
      const event = makeEvent({ session_id: SESSION_ID, event_type: 'task_started' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([stoppedSession]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getEventsSince: jest.fn().mockReturnValue([event]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.activity).toHaveLength(0);
    });

    it('should return events in reverse chronological order (most recent first)', () => {
      const session = makeSession();
      const events: CortexEvent[] = [
        makeEvent({ id: 1, event_type: 'first', created_at: '2026-03-31T10:00:00.000Z' }),
        makeEvent({ id: 2, event_type: 'second', created_at: '2026-03-31T10:01:00.000Z' }),
        makeEvent({ id: 3, event_type: 'third', created_at: '2026-03-31T10:02:00.000Z' }),
      ];
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getEventsSince: jest.fn().mockReturnValue(events),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.activity[0].eventType).toBe('third');
      expect(snapshot.activity[1].eventType).toBe('second');
      expect(snapshot.activity[2].eventType).toBe('first');
    });

    it('should cap activity feed at 40 events', () => {
      const session = makeSession();
      const events: CortexEvent[] = Array.from({ length: 50 }, (_, i) =>
        makeEvent({ id: i + 1, event_type: `event_${i}` }),
      );
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getEventsSince: jest.fn().mockReturnValue(events),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.activity.length).toBeLessThanOrEqual(40);
    });

    it('should map event fields to activity shape correctly', () => {
      const session = makeSession();
      const event = makeEvent({
        id: 99,
        session_id: SESSION_ID,
        task_id: TASK_ID,
        source: 'build-worker',
        event_type: 'task_complete',
        created_at: '2026-03-31T11:00:00.000Z',
        data: {},
      });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
        getEventsSince: jest.fn().mockReturnValue([event]),
      });
      const snapshot = service.getSnapshot()!;
      const activity = snapshot.activity[0];
      expect(activity.id).toBe(99);
      expect(activity.sessionId).toBe(SESSION_ID);
      expect(activity.taskId).toBe(TASK_ID);
      expect(activity.source).toBe('build-worker');
      expect(activity.eventType).toBe('task_complete');
      expect(activity.timestamp).toBe('2026-03-31T11:00:00.000Z');
      expect(activity.tone).toBe('success');
    });
  });

  // ----------------------------------------------------------
  // session progress calculations
  // ----------------------------------------------------------

  describe('session progress calculations', () => {
    it('should report 0 completedTasks when no tasks are terminal', () => {
      const session = makeSession();
      const worker = makeWorker();
      const task = makeTask({ status: 'IN_PROGRESS' });
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([worker]),
        getTasks: jest.fn().mockReturnValue([task]),
        getTaskTrace: jest.fn().mockReturnValue(makeTrace()),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].completedTasks).toBe(0);
    });

    it('should count completed tasks correctly', () => {
      const session = makeSession();
      const workers = [
        makeWorker({ id: 'w1', task_id: 'TASK_2026_001', status: 'completed' }),
        makeWorker({ id: 'w2', task_id: 'TASK_2026_002', session_id: SESSION_ID, status: 'completed' }),
      ];
      const tasks = [makeTask({ id: 'TASK_2026_001', status: 'COMPLETE' }), makeTask({ id: 'TASK_2026_002', status: 'COMPLETE' })];
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue(workers),
        getTasks: jest.fn().mockReturnValue(tasks),
        getTaskTrace: jest.fn().mockImplementation((id: string) => makeTrace({ task_id: id })),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].completedTasks).toBe(2);
    });

    it('should use Waiting for worker activity as currentTaskLabel when no tasks are present', () => {
      const session = makeSession();
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].currentTaskLabel).toBe('Waiting for worker activity');
    });

    it('should set currentPhase to PM as default when no tasks exist', () => {
      const session = makeSession();
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue([]),
        getTasks: jest.fn().mockReturnValue([]),
      });
      const snapshot = service.getSnapshot()!;
      expect(snapshot.sessions[0].currentPhase).toBe('PM');
    });

    it('should sort tasks by progressPercent descending', () => {
      const session = makeSession();
      const workers = [
        makeWorker({ id: 'w1', task_id: 'TASK_2026_001' }),
        makeWorker({ id: 'w2', task_id: 'TASK_2026_002', session_id: SESSION_ID }),
      ];
      const tasks = [
        makeTask({ id: 'TASK_2026_001', status: 'IN_PROGRESS' }),
        makeTask({ id: 'TASK_2026_002', status: 'COMPLETE' }),
      ];
      const { service } = makeService({
        getSessions: jest.fn().mockReturnValue([session]),
        getWorkers: jest.fn().mockReturnValue(workers),
        getTasks: jest.fn().mockReturnValue(tasks),
        getTaskTrace: jest.fn().mockImplementation((id: string) => makeTrace({ task_id: id })),
      });
      const snapshot = service.getSnapshot()!;
      // COMPLETE tasks get 100% progress — should be first
      expect(snapshot.sessions[0].tasks[0]?.progressPercent).toBeGreaterThanOrEqual(
        snapshot.sessions[0].tasks[1]?.progressPercent ?? 0,
      );
    });
  });
});
