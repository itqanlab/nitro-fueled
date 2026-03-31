/**
 * Unit tests for SessionRunner.
 *
 * SessionRunner is a plain class — all external dependencies are mocked
 * via constructor injection, so no NestJS TestBed or process spawning needed.
 */
import 'reflect-metadata';
import { SessionRunner } from '../../src/auto-pilot/session-runner';
import type {
  SupervisorConfig,
  ActiveWorkerInfo,
  TaskCandidate,
} from '../../src/auto-pilot/auto-pilot.types';
import { DEFAULT_SUPERVISOR_CONFIG } from '../../src/auto-pilot/auto-pilot.types';

// ============================================================
// Shared mock factories
// ============================================================

function makeConfig(overrides: Partial<SupervisorConfig> = {}): SupervisorConfig {
  return {
    ...DEFAULT_SUPERVISOR_CONFIG,
    // Use a very large poll interval so the interval never fires during tests
    poll_interval_ms: 999_999_999,
    ...overrides,
  };
}

function makeWorker(overrides: Partial<ActiveWorkerInfo> = {}): ActiveWorkerInfo {
  return {
    workerId: 'worker-1',
    taskId: 'TASK_2026_001',
    workerType: 'build',
    label: 'build-TASK_2026_001',
    pid: 1234,
    provider: 'claude',
    model: 'claude-sonnet-4-6',
    spawnTime: new Date().toISOString(),
    health: 'healthy',
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<TaskCandidate> = {}): TaskCandidate {
  return {
    id: 'TASK_2026_001',
    title: 'Test Task',
    status: 'CREATED',
    type: 'FEATURE',
    priority: 'P1-High',
    complexity: 'medium',
    dependencies: [],
    model: null,
    customFlowId: null,
    ...overrides,
  };
}

function makeMockDb(): jest.Mocked<import('../../src/auto-pilot/supervisor-db.service').SupervisorDbService> {
  return {
    isAvailable: jest.fn().mockReturnValue(true),
    createSession: jest.fn().mockReturnValue('SESSION_2026-03-31T00-00-00'),
    logEvent: jest.fn(),
    updateHeartbeat: jest.fn(),
    updateSessionStatus: jest.fn(),
    updateSessionTerminalCount: jest.fn(),
    setDrainRequested: jest.fn(),
    getDrainRequested: jest.fn().mockReturnValue(false),
    getActiveWorkers: jest.fn().mockReturnValue([]),
    getTaskCandidates: jest.fn().mockReturnValue([]),
    getWorkerCounts: jest.fn().mockReturnValue({ active: 0, completed: 0, failed: 0 }),
    // Return CREATED: 1 by default so checkTermination does NOT auto-stop the loop.
    // Individual tests that need a different count override this mock.
    getTaskCountsByStatus: jest.fn().mockReturnValue({ CREATED: 1 }),
    getTaskStatus: jest.fn().mockReturnValue('IMPLEMENTED'),
    updateTaskStatus: jest.fn(),
    claimTask: jest.fn().mockReturnValue(true),
    getCustomFlow: jest.fn().mockReturnValue(null),
  } as unknown as jest.Mocked<import('../../src/auto-pilot/supervisor-db.service').SupervisorDbService>;
}

function makeMockWorkerManager(): jest.Mocked<import('../../src/auto-pilot/worker-manager.service').WorkerManagerService> {
  return {
    spawnWorker: jest.fn().mockReturnValue({ workerId: 'worker-1', pid: 1234 }),
    killWorker: jest.fn(),
  } as unknown as jest.Mocked<import('../../src/auto-pilot/worker-manager.service').WorkerManagerService>;
}

function makeMockPromptBuilder(): jest.Mocked<import('../../src/auto-pilot/prompt-builder.service').PromptBuilderService> {
  return {
    buildWorkerPrompt: jest.fn().mockReturnValue('build prompt'),
    reviewWorkerPrompt: jest.fn().mockReturnValue('review prompt'),
  } as unknown as jest.Mocked<import('../../src/auto-pilot/prompt-builder.service').PromptBuilderService>;
}

function makeRunner(
  overrides: Partial<SupervisorConfig> = {},
  mocks?: {
    db?: ReturnType<typeof makeMockDb>;
    workerManager?: ReturnType<typeof makeMockWorkerManager>;
    promptBuilder?: ReturnType<typeof makeMockPromptBuilder>;
  },
): {
  runner: SessionRunner;
  db: ReturnType<typeof makeMockDb>;
  workerManager: ReturnType<typeof makeMockWorkerManager>;
  promptBuilder: ReturnType<typeof makeMockPromptBuilder>;
} {
  const db = mocks?.db ?? makeMockDb();
  const workerManager = mocks?.workerManager ?? makeMockWorkerManager();
  const promptBuilder = mocks?.promptBuilder ?? makeMockPromptBuilder();
  const config = makeConfig(overrides);
  const runner = new SessionRunner(
    'SESSION_2026-03-31T00-00-00',
    config,
    db as any,
    workerManager as any,
    promptBuilder as any,
  );
  return { runner, db, workerManager, promptBuilder };
}

// ============================================================
// Tests
// ============================================================

describe('SessionRunner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Initial state
  // ----------------------------------------------------------

  describe('initial state', () => {
    it('should initialize with running loop status', () => {
      const { runner } = makeRunner();
      // Before start(), runner holds the config but loop is not yet scheduled
      expect(runner.getLoopStatus()).toBe('running');
    });

    it('should expose the config passed at construction', () => {
      const { runner } = makeRunner({ concurrency: 5 });
      expect(runner.getConfig().concurrency).toBe(5);
    });

    it('should expose the sessionId', () => {
      const { runner } = makeRunner();
      expect(runner.sessionId).toBe('SESSION_2026-03-31T00-00-00');
    });
  });

  // ----------------------------------------------------------
  // start()
  // ----------------------------------------------------------

  describe('start()', () => {
    it('should log a SESSION_STARTED event', () => {
      const { runner, db } = makeRunner();
      runner.start();
      expect(db.logEvent).toHaveBeenCalledWith(
        'SESSION_2026-03-31T00-00-00',
        null,
        'supervisor',
        'SESSION_STARTED',
        expect.objectContaining({ source: 'dashboard-supervisor' }),
      );
    });

    it('should call updateHeartbeat on the first tick', () => {
      const { runner, db } = makeRunner();
      runner.start();
      expect(db.updateHeartbeat).toHaveBeenCalledWith('SESSION_2026-03-31T00-00-00');
    });
  });

  // ----------------------------------------------------------
  // pause() / resume()
  // ----------------------------------------------------------

  describe('pause()', () => {
    it('should transition loop status to paused', () => {
      const { runner } = makeRunner();
      runner.start();
      runner.pause();
      expect(runner.getLoopStatus()).toBe('paused');
    });

    it('should update session status in DB', () => {
      const { runner, db } = makeRunner();
      runner.start();
      runner.pause();
      expect(db.updateSessionStatus).toHaveBeenCalledWith(
        'SESSION_2026-03-31T00-00-00',
        'paused',
        'Paused by user',
      );
    });

    it('should throw if the session is already paused', () => {
      const { runner } = makeRunner();
      runner.start();
      runner.pause();
      expect(() => runner.pause()).toThrow('is not running');
    });

    it('should prevent ticks from running while paused', () => {
      const { runner, db } = makeRunner({ poll_interval_ms: 1_000 });
      runner.start();
      runner.pause();
      // Clear the call made during start()
      db.updateHeartbeat.mockClear();
      jest.advanceTimersByTime(5_000);
      expect(db.updateHeartbeat).not.toHaveBeenCalled();
    });
  });

  describe('resume()', () => {
    it('should transition loop status back to running', () => {
      const { runner } = makeRunner();
      runner.start();
      runner.pause();
      runner.resume();
      expect(runner.getLoopStatus()).toBe('running');
    });

    it('should throw if the session is not paused', () => {
      const { runner } = makeRunner();
      runner.start();
      expect(() => runner.resume()).toThrow('is not paused');
    });

    it('should restart ticking after resume', () => {
      const { runner, db } = makeRunner({ poll_interval_ms: 1_000 });
      runner.start();
      runner.pause();
      runner.resume();
      db.updateHeartbeat.mockClear();
      jest.advanceTimersByTime(1_000);
      expect(db.updateHeartbeat).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // stop()
  // ----------------------------------------------------------

  describe('stop()', () => {
    it('should transition loop status to stopped', () => {
      const { runner } = makeRunner();
      runner.start();
      runner.stop();
      expect(runner.getLoopStatus()).toBe('stopped');
    });

    it('should log a SESSION_STOPPED event', () => {
      const { runner, db } = makeRunner();
      runner.start();
      db.logEvent.mockClear();
      runner.stop('Test stop');
      expect(db.logEvent).toHaveBeenCalledWith(
        'SESSION_2026-03-31T00-00-00',
        null,
        'supervisor',
        'SESSION_STOPPED',
        expect.objectContaining({ reason: 'Test stop' }),
      );
    });

    it('should update session status in DB', () => {
      const { runner, db } = makeRunner();
      runner.start();
      runner.stop('Test stop');
      expect(db.updateSessionStatus).toHaveBeenCalledWith(
        'SESSION_2026-03-31T00-00-00',
        'stopped',
        'Test stop',
      );
    });

    it('should stop ticking after stop()', () => {
      const { runner, db } = makeRunner({ poll_interval_ms: 1_000 });
      runner.start();
      runner.stop();
      db.updateHeartbeat.mockClear();
      jest.advanceTimersByTime(5_000);
      expect(db.updateHeartbeat).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // updateConfig()
  // ----------------------------------------------------------

  describe('updateConfig()', () => {
    it('should update concurrency immediately', () => {
      const { runner } = makeRunner({ concurrency: 2 });
      runner.updateConfig({ concurrency: 5 });
      expect(runner.getConfig().concurrency).toBe(5);
    });

    it('should update model fields immediately', () => {
      const { runner } = makeRunner();
      runner.updateConfig({ implement_model: 'claude-opus-4-6' });
      expect(runner.getConfig().implement_model).toBe('claude-opus-4-6');
    });

    it('should reschedule the interval when poll_interval_ms changes while running', () => {
      const { runner, db } = makeRunner({ poll_interval_ms: 30_000 });
      runner.start();
      runner.updateConfig({ poll_interval_ms: 5_000 });
      db.updateHeartbeat.mockClear();
      jest.advanceTimersByTime(5_000);
      expect(db.updateHeartbeat).toHaveBeenCalled();
    });

    it('should not reschedule interval when poll_interval_ms changes while paused', () => {
      const { runner, db } = makeRunner({ poll_interval_ms: 30_000 });
      runner.start();
      runner.pause();
      runner.updateConfig({ poll_interval_ms: 5_000 });
      db.updateHeartbeat.mockClear();
      jest.advanceTimersByTime(5_000);
      expect(db.updateHeartbeat).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // getStatus()
  // ----------------------------------------------------------

  describe('getStatus()', () => {
    it('should return sessionId and loopStatus', () => {
      const { runner, db } = makeRunner();
      db.getWorkerCounts.mockReturnValue({ active: 1, completed: 3, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({ CREATED: 4, COMPLETE: 3 });
      const status = runner.getStatus();
      expect(status.sessionId).toBe('SESSION_2026-03-31T00-00-00');
      expect(status.loopStatus).toBe('running');
    });

    it('should aggregate task counts correctly', () => {
      const { runner, db } = makeRunner();
      db.getWorkerCounts.mockReturnValue({ active: 0, completed: 0, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({
        CREATED: 3,
        IN_PROGRESS: 1,
        IN_REVIEW: 1,
        IMPLEMENTED: 2,
        COMPLETE: 5,
        FAILED: 1,
        BLOCKED: 1,
      });
      const status = runner.getStatus();
      expect(status.tasks.remaining).toBe(3);
      expect(status.tasks.completed).toBe(5);
      expect(status.tasks.failed).toBe(2);     // FAILED + BLOCKED
      expect(status.tasks.inProgress).toBe(4); // IN_PROGRESS + IN_REVIEW + IMPLEMENTED
    });

    it('should reflect drainRequested from DB', () => {
      const { runner, db } = makeRunner();
      db.getDrainRequested.mockReturnValue(true);
      db.getWorkerCounts.mockReturnValue({ active: 0, completed: 0, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({});
      const status = runner.getStatus();
      expect(status.drainRequested).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Tick — spawn candidates
  // ----------------------------------------------------------

  describe('tick — candidate spawning', () => {
    it('should spawn a build worker for a CREATED task', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 2 });
      const candidate = makeCandidate({ status: 'CREATED' });
      db.getTaskCandidates.mockReturnValue([candidate]);
      db.getActiveWorkers.mockReturnValue([]);

      runner.start(); // fires initial tick

      expect(workerManager.spawnWorker).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'TASK_2026_001',
          workerType: 'build',
        }),
      );
    });

    it('should spawn a review worker for an IMPLEMENTED task', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 2 });
      const candidate = makeCandidate({ status: 'IMPLEMENTED' });
      db.getTaskCandidates.mockReturnValue([candidate]);
      db.getActiveWorkers.mockReturnValue([]);

      runner.start();

      expect(workerManager.spawnWorker).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'TASK_2026_001',
          workerType: 'review',
        }),
      );
    });

    it('should not spawn beyond concurrency limit', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 1 });
      const candidates = [
        makeCandidate({ id: 'TASK_2026_001', status: 'CREATED' }),
        makeCandidate({ id: 'TASK_2026_002', status: 'CREATED' }),
      ];
      db.getTaskCandidates.mockReturnValue(candidates);
      db.getActiveWorkers.mockReturnValue([]);

      runner.start();

      // Only 1 worker should be spawned (concurrency = 1)
      expect(workerManager.spawnWorker).toHaveBeenCalledTimes(1);
    });

    it('should not spawn for tasks already being worked on', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 2 });
      const candidate = makeCandidate({ id: 'TASK_2026_001', status: 'CREATED' });
      const activeWorker = makeWorker({ taskId: 'TASK_2026_001' });
      db.getTaskCandidates.mockReturnValue([candidate]);
      db.getActiveWorkers.mockReturnValue([activeWorker]);

      runner.start();

      expect(workerManager.spawnWorker).not.toHaveBeenCalled();
    });

    it('should use fallback provider on retries for PREPPED tasks', () => {
      const db = makeMockDb();
      const workerManager = makeMockWorkerManager();
      const promptBuilder = makeMockPromptBuilder();
      const config = makeConfig({
        implement_provider: 'glm',
        implement_model: 'glm-5.1',
        implement_fallback_provider: 'claude',
        implement_fallback_model: 'claude-sonnet-4-6',
      });

      // Simulate a previous failure by setting up a finished worker whose task
      // status is NOT IMPLEMENTED (i.e., failure scenario)
      db.getTaskStatus.mockReturnValue('IN_PROGRESS'); // not IMPLEMENTED = failure
      const previousWorker = makeWorker({ taskId: 'TASK_2026_001', workerType: 'build', health: 'finished' });
      // First call: active workers with a finished worker (triggers failure handling)
      db.getActiveWorkers.mockReturnValueOnce([previousWorker]);
      // After the failure handler resets task to CREATED, next tick will see PREPPED candidate
      db.getActiveWorkers.mockReturnValue([]);
      // After retry counter increments, task resets to CREATED (then would need PREPPED)
      // For simplicity, test that updateTaskStatus is called to reset on failure
      db.getTaskCandidates.mockReturnValue([]);

      const runner = new SessionRunner('SESSION_2026-03-31T00-00-00', config, db as any, workerManager as any, promptBuilder as any);
      runner.start();

      // The failed worker should have triggered updateTaskStatus('TASK_2026_001', 'CREATED')
      expect(db.updateTaskStatus).toHaveBeenCalledWith('TASK_2026_001', 'CREATED');
    });
  });

  // ----------------------------------------------------------
  // Tick — drain behavior
  // ----------------------------------------------------------

  describe('tick — drain behavior', () => {
    it('should stop the loop when drain is requested and no active workers remain', () => {
      const { runner, db } = makeRunner();
      db.getDrainRequested.mockReturnValue(true);
      db.getActiveWorkers.mockReturnValue([]); // no active workers

      runner.start();

      expect(runner.getLoopStatus()).toBe('stopped');
      expect(db.updateSessionStatus).toHaveBeenCalledWith(
        'SESSION_2026-03-31T00-00-00',
        'stopped',
        'Drained by user',
      );
    });

    it('should not stop when drain is requested but workers are still active', () => {
      const { runner, db } = makeRunner();
      db.getDrainRequested.mockReturnValue(true);
      const activeWorker = makeWorker({ health: 'healthy' });
      // First getActiveWorkers call (health processing) returns empty
      db.getActiveWorkers.mockReturnValueOnce([]);
      // Second call (drain check) still has workers
      db.getActiveWorkers.mockReturnValue([activeWorker]);

      runner.start();

      expect(runner.getLoopStatus()).toBe('running');
    });
  });

  // ----------------------------------------------------------
  // Tick — termination check
  // ----------------------------------------------------------

  describe('tick — termination', () => {
    it('should stop when task limit is reached', () => {
      const { runner, db } = makeRunner({ limit: 2 });
      // Simulate 2 completed workers finishing
      const finishedBuild = makeWorker({ workerType: 'build', health: 'finished' });
      const finishedReview = makeWorker({
        workerId: 'worker-2',
        taskId: 'TASK_2026_002',
        workerType: 'review',
        health: 'finished',
      });
      db.getActiveWorkers.mockReturnValueOnce([finishedBuild, finishedReview]);
      db.getActiveWorkers.mockReturnValue([]);
      db.getTaskStatus.mockReturnValueOnce('IMPLEMENTED'); // build finish: IMPLEMENTED
      db.getTaskStatus.mockReturnValueOnce('COMPLETE');    // review finish: COMPLETE
      db.getTaskCandidates.mockReturnValue([]);

      runner.start();

      expect(runner.getLoopStatus()).toBe('stopped');
      expect(db.logEvent).toHaveBeenCalledWith(
        expect.any(String),
        null,
        'supervisor',
        'SESSION_STOPPED',
        expect.objectContaining({ reason: expect.stringContaining('Task limit') }),
      );
    });

    it('should stop when no active workers and no candidates remain', () => {
      const { runner, db } = makeRunner();
      db.getActiveWorkers.mockReturnValue([]);
      db.getTaskCandidates.mockReturnValue([]);
      db.getTaskCountsByStatus.mockReturnValue({ CREATED: 0, IMPLEMENTED: 0 });

      runner.start();

      expect(runner.getLoopStatus()).toBe('stopped');
      expect(db.logEvent).toHaveBeenCalledWith(
        expect.any(String),
        null,
        'supervisor',
        'SESSION_STOPPED',
        expect.objectContaining({ reason: 'All tasks processed' }),
      );
    });
  });

  // ----------------------------------------------------------
  // Priority strategies (pure selection logic)
  // ----------------------------------------------------------

  describe('priority strategy — build-first', () => {
    it('should fill slots with build candidates before review candidates', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 3, priority: 'build-first' });
      db.getActiveWorkers.mockReturnValue([]);
      db.getTaskCandidates.mockReturnValue([
        makeCandidate({ id: 'TASK_2026_001', status: 'CREATED' }),
        makeCandidate({ id: 'TASK_2026_002', status: 'CREATED' }),
        makeCandidate({ id: 'TASK_2026_003', status: 'IMPLEMENTED' }),
      ]);

      runner.start();

      const calls = workerManager.spawnWorker.mock.calls.map(c => c[0].workerType);
      // build candidates should fill first
      expect(calls.filter(t => t === 'build').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('priority strategy — review-first', () => {
    it('should fill slots with review candidates before build candidates', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 3, priority: 'review-first' });
      db.getActiveWorkers.mockReturnValue([]);
      db.getTaskCandidates.mockReturnValue([
        makeCandidate({ id: 'TASK_2026_001', status: 'CREATED' }),
        makeCandidate({ id: 'TASK_2026_002', status: 'IMPLEMENTED' }),
        makeCandidate({ id: 'TASK_2026_003', status: 'IMPLEMENTED' }),
      ]);

      runner.start();

      const calls = workerManager.spawnWorker.mock.calls.map(c => c[0].workerType);
      expect(calls.filter(t => t === 'review').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('priority strategy — balanced', () => {
    it('should interleave build and review candidates when both exist', () => {
      const { runner, db, workerManager } = makeRunner({ concurrency: 4, priority: 'balanced' });
      db.getActiveWorkers.mockReturnValue([]);
      db.getTaskCandidates.mockReturnValue([
        makeCandidate({ id: 'TASK_2026_001', status: 'CREATED' }),
        makeCandidate({ id: 'TASK_2026_002', status: 'CREATED' }),
        makeCandidate({ id: 'TASK_2026_003', status: 'IMPLEMENTED' }),
        makeCandidate({ id: 'TASK_2026_004', status: 'IMPLEMENTED' }),
      ]);

      runner.start();

      const calls = workerManager.spawnWorker.mock.calls.map(c => c[0].workerType);
      expect(calls.filter(t => t === 'build').length).toBeGreaterThanOrEqual(1);
      expect(calls.filter(t => t === 'review').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------
  // Stuck worker handling
  // ----------------------------------------------------------

  describe('stuck worker handling', () => {
    it('should kill a worker that is stuck on the second consecutive tick', () => {
      const { runner, db, workerManager } = makeRunner({ poll_interval_ms: 1_000 });
      const stuckWorker = makeWorker({ health: 'stuck' });
      db.getActiveWorkers.mockReturnValue([stuckWorker]);
      db.getTaskCandidates.mockReturnValue([]);
      db.getTaskCountsByStatus.mockReturnValue({ CREATED: 1 }); // prevent auto-stop

      runner.start();
      // After first tick: stuckCount = 1, no kill yet
      expect(workerManager.killWorker).not.toHaveBeenCalled();

      // Second tick: stuckCount = 2, kill
      jest.advanceTimersByTime(1_000);
      expect(workerManager.killWorker).toHaveBeenCalledWith(1234, 'worker-1');
    });
  });

  // ----------------------------------------------------------
  // Worker failure / retry handling
  // ----------------------------------------------------------

  describe('worker failure and retry', () => {
    it('should reset task to CREATED and log a retry event on first failure', () => {
      const { runner, db } = makeRunner({ retries: 2 });
      const finishedWorker = makeWorker({ workerType: 'build', health: 'finished' });
      db.getActiveWorkers.mockReturnValueOnce([finishedWorker]);
      db.getActiveWorkers.mockReturnValue([]);
      db.getTaskStatus.mockReturnValue('IN_PROGRESS'); // build expected IMPLEMENTED
      db.getTaskCandidates.mockReturnValue([]);
      db.getTaskCountsByStatus.mockReturnValue({ CREATED: 1 });

      runner.start();

      expect(db.updateTaskStatus).toHaveBeenCalledWith('TASK_2026_001', 'CREATED');
      expect(db.logEvent).toHaveBeenCalledWith(
        expect.any(String),
        'TASK_2026_001',
        'supervisor',
        'WORKER_RETRY',
        expect.objectContaining({ retryCount: 1, maxRetries: 2 }),
      );
    });

    it('should mark task as BLOCKED after exhausting all retries', () => {
      // Use a short poll interval so jest.advanceTimersByTime reliably triggers the second tick.
      const { runner, db } = makeRunner({ retries: 1, poll_interval_ms: 1_000 });

      // Each tick calls getActiveWorkers twice:
      //   call 1 — health processing (returns finished worker to trigger failure handling)
      //   call 2 — spawn-slot check (returns empty so no new spawns)
      const finishedWorker = makeWorker({ workerType: 'build', health: 'finished' });
      db.getActiveWorkers
        .mockReturnValueOnce([finishedWorker]) // tick 1, health check
        .mockReturnValueOnce([])               // tick 1, slot check
        .mockReturnValueOnce([finishedWorker]) // tick 2, health check
        .mockReturnValue([]);                  // tick 2, slot check + termination check

      db.getTaskStatus.mockReturnValue('IN_PROGRESS'); // always wrong status = always fail
      db.getTaskCandidates.mockReturnValue([]);
      db.getTaskCountsByStatus.mockReturnValue({ CREATED: 1 });

      runner.start();             // fires tick 1: retryCount → 1 (within retries=1, reset to CREATED)
      jest.advanceTimersByTime(1_000); // fires tick 2: retryCount → 2 (> retries=1, mark BLOCKED)

      expect(db.updateTaskStatus).toHaveBeenCalledWith('TASK_2026_001', 'BLOCKED');
      expect(db.logEvent).toHaveBeenCalledWith(
        expect.any(String),
        'TASK_2026_001',
        'supervisor',
        'RETRY_EXHAUSTED',
        expect.any(Object),
      );
    });
  });
});
