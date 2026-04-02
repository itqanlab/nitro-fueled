/**
 * Unit tests for SessionManagerService.
 *
 * SessionManagerService is a NestJS injectable that holds the Map<sessionId, SessionRunner>.
 * We instantiate it directly (no TestBed) and mock all injected dependencies.
 */
import 'reflect-metadata';
import { SessionManagerService } from '../../src/auto-pilot/session-manager.service';

// ============================================================
// Dependency mocks
// ============================================================

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
    // Return CREATED: 1 by default so the tick's checkTermination does NOT auto-stop the session.
    // Tests that specifically need a different count override this mock.
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

function makeService() {
  const db = makeMockDb();
  const workerManager = makeMockWorkerManager();
  const promptBuilder = makeMockPromptBuilder();
  const service = new SessionManagerService(db as any, workerManager as any, promptBuilder as any);
  return { service, db, workerManager, promptBuilder };
}

// ============================================================
// Tests
// ============================================================

describe('SessionManagerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // createSession()
  // ----------------------------------------------------------

  describe('createSession()', () => {
    it('should return a session ID when DB is available', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      expect(sessionId).toBe('SESSION_2026-03-31T00-00-00');
    });

    it('should throw when Cortex DB is not available', () => {
      const { service, db } = makeService();
      db.isAvailable.mockReturnValue(false);
      expect(() => service.createSession({})).toThrow('Cortex DB not available');
    });

    it('should register the runner so getSessionStatus returns a value', () => {
      const { service, db } = makeService();
      const sessionId = service.createSession({});
      db.getWorkerCounts.mockReturnValue({ active: 0, completed: 0, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({});
      const status = service.getSessionStatus(sessionId);
      expect(status).not.toBeNull();
      expect(status!.sessionId).toBe(sessionId);
    });

    it('should merge provided config with defaults', () => {
      const { service, db } = makeService();
      service.createSession({ concurrency: 5, priority: 'review-first' });
      // DB createSession receives the merged config
      expect(db.createSession).toHaveBeenCalledWith(
        'dashboard-supervisor',
        expect.objectContaining({ concurrency: 5, priority: 'review-first' }),
        expect.any(Number),
      );
    });

    it('should support multiple concurrent sessions', () => {
      const { service, db } = makeService();
      db.createSession
        .mockReturnValueOnce('SESSION_A')
        .mockReturnValueOnce('SESSION_B');

      const idA = service.createSession({});
      const idB = service.createSession({});

      expect(idA).toBe('SESSION_A');
      expect(idB).toBe('SESSION_B');
      expect(service.listSessions()).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // stopSession()
  // ----------------------------------------------------------

  describe('stopSession()', () => {
    it('should return true and remove runner when session exists', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      const result = service.stopSession(sessionId);
      expect(result).toBe(true);
      expect(service.getSessionStatus(sessionId)).toBeNull();
    });

    it('should return false for an unknown session ID', () => {
      const { service } = makeService();
      expect(service.stopSession('SESSION_DOES_NOT_EXIST')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // pauseSession() / resumeSession()
  // ----------------------------------------------------------

  describe('pauseSession()', () => {
    it('should return true when session exists', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      expect(service.pauseSession(sessionId)).toBe(true);
    });

    it('should return false for an unknown session ID', () => {
      const { service } = makeService();
      expect(service.pauseSession('SESSION_UNKNOWN')).toBe(false);
    });
  });

  describe('resumeSession()', () => {
    it('should return true when paused session is resumed', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      service.pauseSession(sessionId);
      expect(service.resumeSession(sessionId)).toBe(true);
    });

    it('should return false for an unknown session ID', () => {
      const { service } = makeService();
      expect(service.resumeSession('SESSION_UNKNOWN')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // drainSession()
  // ----------------------------------------------------------

  describe('drainSession()', () => {
    it('should return true and call setDrainRequested on the DB', () => {
      const { service, db } = makeService();
      const sessionId = service.createSession({});
      const result = service.drainSession(sessionId);
      expect(result).toBe(true);
      expect(db.setDrainRequested).toHaveBeenCalledWith(sessionId);
    });

    it('should return false for an unknown session ID', () => {
      const { service } = makeService();
      expect(service.drainSession('SESSION_UNKNOWN')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // updateSessionConfig()
  // ----------------------------------------------------------

  describe('updateSessionConfig()', () => {
    it('should return true and update the runner config', () => {
      const { service, db } = makeService();
      const sessionId = service.createSession({});
      const result = service.updateSessionConfig(sessionId, { concurrency: 7 });
      expect(result).toBe(true);
      db.getWorkerCounts.mockReturnValue({ active: 0, completed: 0, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({});
      const status = service.getSessionStatus(sessionId);
      expect(status!.config.concurrency).toBe(7);
    });

    it('should return false for unknown session ID', () => {
      const { service } = makeService();
      expect(service.updateSessionConfig('SESSION_UNKNOWN', { concurrency: 3 })).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // listSessions()
  // ----------------------------------------------------------

  describe('listSessions()', () => {
    it('should return empty array when no sessions exist', () => {
      const { service } = makeService();
      expect(service.listSessions()).toHaveLength(0);
    });

    it('should return one entry per active session', () => {
      const { service, db } = makeService();
      db.createSession
        .mockReturnValueOnce('SESSION_A')
        .mockReturnValueOnce('SESSION_B');
      db.getWorkerCounts.mockReturnValue({ active: 0, completed: 0, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({});

      service.createSession({});
      service.createSession({});

      const list = service.listSessions();
      expect(list).toHaveLength(2);
    });

    it('should exclude stopped sessions', () => {
      const { service, db } = makeService();
      const sessionId = service.createSession({});
      service.stopSession(sessionId);
      db.getWorkerCounts.mockReturnValue({ active: 0, completed: 0, failed: 0 });
      db.getTaskCountsByStatus.mockReturnValue({});

      expect(service.listSessions()).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // hasActiveSession()
  // ----------------------------------------------------------

  describe('hasActiveSession()', () => {
    it('should return false when no sessions exist', () => {
      const { service } = makeService();
      expect(service.hasActiveSession()).toBe(false);
    });

    it('should return true when a running session exists', () => {
      const { service } = makeService();
      service.createSession({});
      expect(service.hasActiveSession()).toBe(true);
    });

    it('should return false after the only session is stopped', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      service.stopSession(sessionId);
      expect(service.hasActiveSession()).toBe(false);
    });

    it('should return true for a paused session', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      service.pauseSession(sessionId);
      expect(service.hasActiveSession()).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // getRunner()
  // ----------------------------------------------------------

  describe('getRunner()', () => {
    it('should return the runner for a known session', () => {
      const { service } = makeService();
      const sessionId = service.createSession({});
      const runner = service.getRunner(sessionId);
      expect(runner).toBeDefined();
      expect(runner!.sessionId).toBe(sessionId);
    });

    it('should return undefined for an unknown session', () => {
      const { service } = makeService();
      expect(service.getRunner('SESSION_UNKNOWN')).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // onModuleDestroy()
  // ----------------------------------------------------------

  describe('onModuleDestroy()', () => {
    it('should stop all running sessions on module destroy', () => {
      const { service, db } = makeService();
      db.createSession
        .mockReturnValueOnce('SESSION_A')
        .mockReturnValueOnce('SESSION_B');

      service.createSession({});
      service.createSession({});

      service.onModuleDestroy();

      expect(service.listSessions()).toHaveLength(0);
    });
  });
});
