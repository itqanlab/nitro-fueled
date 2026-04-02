/**
 * Unit tests for AutoPilotController validation logic.
 *
 * The controller's two main responsibilities are:
 * 1. Input validation (session ID format, field types, ranges)
 * 2. Delegating to AutoPilotService and mapping 404/400 responses
 *
 * AutoPilotService is mocked so no NestJS TestBed or HTTP is needed.
 */
import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AutoPilotController } from '../../src/auto-pilot/auto-pilot.controller';
import type { SessionStatusResponse } from '../../src/auto-pilot/auto-pilot.types';
import { DEFAULT_SUPERVISOR_CONFIG } from '../../src/auto-pilot/auto-pilot.types';

// ============================================================
// Shared mock factories
// ============================================================

const VALID_SESSION_ID = 'SESSION_2026-03-31T00-00-00';

function makeSessionStatus(overrides: Partial<SessionStatusResponse> = {}): SessionStatusResponse {
  return {
    sessionId: VALID_SESSION_ID,
    loopStatus: 'running',
    config: DEFAULT_SUPERVISOR_CONFIG,
    workers: { active: 0, completed: 0, failed: 0 },
    tasks: { completed: 0, failed: 0, inProgress: 0, remaining: 0 },
    startedAt: new Date().toISOString(),
    uptimeMinutes: 0,
    lastHeartbeat: new Date().toISOString(),
    drainRequested: false,
    ...overrides,
  };
}

function makeMockService() {
  return {
    createSession: jest.fn().mockReturnValue({ sessionId: VALID_SESSION_ID, status: 'starting' }),
    listSessions: jest.fn().mockReturnValue({ sessions: [] }),
    getSessionStatus: jest.fn().mockReturnValue(makeSessionStatus()),
    updateSessionConfig: jest.fn().mockReturnValue({ sessionId: VALID_SESSION_ID, config: DEFAULT_SUPERVISOR_CONFIG }),
    pauseSession: jest.fn().mockReturnValue({ sessionId: VALID_SESSION_ID, action: 'paused' }),
    resumeSession: jest.fn().mockReturnValue({ sessionId: VALID_SESSION_ID, action: 'resumed' }),
    stopSession: jest.fn().mockReturnValue({ sessionId: VALID_SESSION_ID, action: 'stopped' }),
    drainSession: jest.fn().mockReturnValue({ sessionId: VALID_SESSION_ID, action: 'draining' }),
  };
}

function makeController() {
  const service = makeMockService();
  const controller = new AutoPilotController(service as any);
  return { controller, service };
}

// ============================================================
// Tests
// ============================================================

describe('AutoPilotController', () => {
  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------
  // Session ID validation
  // ----------------------------------------------------------

  describe('validateSessionId()', () => {
    const VALID_IDS = [
      'SESSION_2026-03-31T00-00-00',
      'SESSION_2026-01-01T12-30-59',
      'SESSION_2099-12-31T23-59-59',
    ];

    const INVALID_IDS = [
      '',
      'session_2026-03-31T00-00-00',   // lowercase
      'SESSION_2026-3-31T00-00-00',    // single-digit month
      'SESSION_2026-03-31',            // missing time
      'SESSION_2026-03-31T00:00:00',   // colons instead of hyphens
      'TASK_2026_001',                 // wrong prefix
      '../../etc/passwd',              // path traversal
      'SESSION_2026-03-31T00-00-00 extra', // trailing content
    ];

    VALID_IDS.forEach(id => {
      it(`should accept valid session ID: ${id}`, () => {
        const { controller, service } = makeController();
        expect(() => controller.getSession(id)).not.toThrow();
      });
    });

    INVALID_IDS.forEach(id => {
      it(`should reject invalid session ID: "${id}"`, () => {
        const { controller } = makeController();
        expect(() => controller.getSession(id)).toThrow(BadRequestException);
      });
    });
  });

  // ----------------------------------------------------------
  // createSession() — body validation
  // ----------------------------------------------------------

  describe('createSession()', () => {
    it('should succeed with an empty body', () => {
      const { controller, service } = makeController();
      const result = controller.createSession(undefined);
      expect(result.sessionId).toBe(VALID_SESSION_ID);
      expect(service.createSession).toHaveBeenCalledWith({});
    });

    it('should succeed with null body', () => {
      const { controller } = makeController();
      expect(() => controller.createSession(null)).not.toThrow();
    });

    it('should reject non-object body', () => {
      const { controller } = makeController();
      expect(() => controller.createSession('string')).toThrow(BadRequestException);
    });

    it('should accept valid concurrency (1-10)', () => {
      const { controller, service } = makeController();
      controller.createSession({ concurrency: 3 });
      expect(service.createSession).toHaveBeenCalledWith(expect.objectContaining({ concurrency: 3 }));
    });

    it('should reject concurrency below 1', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ concurrency: 0 })).toThrow(BadRequestException);
    });

    it('should reject concurrency above 10', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ concurrency: 11 })).toThrow(BadRequestException);
    });

    it('should accept valid limit (1-100)', () => {
      const { controller, service } = makeController();
      controller.createSession({ limit: 50 });
      expect(service.createSession).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });

    it('should reject limit below 1', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ limit: 0 })).toThrow(BadRequestException);
    });

    it('should reject limit above 100', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ limit: 101 })).toThrow(BadRequestException);
    });

    it('should accept valid provider values', () => {
      const { controller, service } = makeController();
      controller.createSession({ prepProvider: 'claude', implementProvider: 'glm', reviewProvider: 'claude' });
      expect(service.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ prepProvider: 'claude', implementProvider: 'glm' }),
      );
    });

    it('should reject unknown provider', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ prepProvider: 'gpt-5' })).toThrow(BadRequestException);
    });

    it('should accept valid priority values', () => {
      for (const p of ['build-first', 'review-first', 'balanced'] as const) {
        const { controller, service } = makeController();
        controller.createSession({ priority: p });
        expect(service.createSession).toHaveBeenCalledWith(expect.objectContaining({ priority: p }));
      }
    });

    it('should reject unknown priority', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ priority: 'random' })).toThrow(BadRequestException);
    });

    it('should accept retries 0-5', () => {
      const { controller, service } = makeController();
      controller.createSession({ retries: 3 });
      expect(service.createSession).toHaveBeenCalledWith(expect.objectContaining({ retries: 3 }));
    });

    it('should reject retries above 5', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ retries: 6 })).toThrow(BadRequestException);
    });

    it('should reject retries below 0', () => {
      const { controller } = makeController();
      expect(() => controller.createSession({ retries: -1 })).toThrow(BadRequestException);
    });

  });

  // ----------------------------------------------------------
  // listSessions()
  // ----------------------------------------------------------

  describe('listSessions()', () => {
    it('should return the service result', () => {
      const { controller, service } = makeController();
      const result = controller.listSessions();
      expect(result.sessions).toEqual([]);
      expect(service.listSessions).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // getSession()
  // ----------------------------------------------------------

  describe('getSession()', () => {
    it('should return session status for a known session', () => {
      const { controller, service } = makeController();
      service.getSessionStatus.mockReturnValue(makeSessionStatus());
      const result = controller.getSession(VALID_SESSION_ID);
      expect(result.sessionId).toBe(VALID_SESSION_ID);
    });

    it('should throw NotFoundException when session does not exist', () => {
      const { controller, service } = makeController();
      service.getSessionStatus.mockReturnValue(null);
      expect(() => controller.getSession(VALID_SESSION_ID)).toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // updateConfig()
  // ----------------------------------------------------------

  describe('updateConfig()', () => {
    it('should return updated config for a known session', () => {
      const { controller, service } = makeController();
      service.updateSessionConfig.mockReturnValue({
        sessionId: VALID_SESSION_ID,
        config: DEFAULT_SUPERVISOR_CONFIG,
      });
      const result = controller.updateConfig(VALID_SESSION_ID, { concurrency: 4 });
      expect(result.sessionId).toBe(VALID_SESSION_ID);
    });

    it('should throw NotFoundException when session does not exist', () => {
      const { controller, service } = makeController();
      service.updateSessionConfig.mockReturnValue(null);
      expect(() => controller.updateConfig(VALID_SESSION_ID, {})).toThrow(NotFoundException);
    });

    it('should accept valid pollIntervalMs (5000-300000)', () => {
      const { controller, service } = makeController();
      controller.updateConfig(VALID_SESSION_ID, { pollIntervalMs: 30_000 });
      expect(service.updateSessionConfig).toHaveBeenCalledWith(
        VALID_SESSION_ID,
        expect.objectContaining({ pollIntervalMs: 30_000 }),
      );
    });

    it('should reject pollIntervalMs below 5000', () => {
      const { controller } = makeController();
      expect(() => controller.updateConfig(VALID_SESSION_ID, { pollIntervalMs: 1000 })).toThrow(BadRequestException);
    });

    it('should reject pollIntervalMs above 300000', () => {
      const { controller } = makeController();
      expect(() => controller.updateConfig(VALID_SESSION_ID, { pollIntervalMs: 400_000 })).toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------
  // pauseSession()
  // ----------------------------------------------------------

  describe('pauseSession()', () => {
    it('should return action:paused for a known session', () => {
      const { controller } = makeController();
      const result = controller.pauseSession(VALID_SESSION_ID);
      expect(result.action).toBe('paused');
    });

    it('should throw NotFoundException when session does not exist', () => {
      const { controller, service } = makeController();
      service.pauseSession.mockReturnValue(null);
      expect(() => controller.pauseSession(VALID_SESSION_ID)).toThrow(NotFoundException);
    });

    it('should reject invalid session ID format', () => {
      const { controller } = makeController();
      expect(() => controller.pauseSession('invalid-id')).toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------
  // resumeSession()
  // ----------------------------------------------------------

  describe('resumeSession()', () => {
    it('should return action:resumed for a known session', () => {
      const { controller } = makeController();
      const result = controller.resumeSession(VALID_SESSION_ID);
      expect(result.action).toBe('resumed');
    });

    it('should throw NotFoundException when session does not exist', () => {
      const { controller, service } = makeController();
      service.resumeSession.mockReturnValue(null);
      expect(() => controller.resumeSession(VALID_SESSION_ID)).toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // stopSession()
  // ----------------------------------------------------------

  describe('stopSession()', () => {
    it('should return action:stopped for a known session', () => {
      const { controller } = makeController();
      const result = controller.stopSession(VALID_SESSION_ID);
      expect(result.action).toBe('stopped');
    });

    it('should throw NotFoundException when session does not exist', () => {
      const { controller, service } = makeController();
      service.stopSession.mockReturnValue(null);
      expect(() => controller.stopSession(VALID_SESSION_ID)).toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // drainSession()
  // ----------------------------------------------------------

  describe('drainSession()', () => {
    it('should return action:draining for a known session', () => {
      const { controller } = makeController();
      const result = controller.drainSession(VALID_SESSION_ID);
      expect(result.action).toBe('draining');
    });

    it('should throw NotFoundException when session does not exist', () => {
      const { controller, service } = makeController();
      service.drainSession.mockReturnValue(null);
      expect(() => controller.drainSession(VALID_SESSION_ID)).toThrow(NotFoundException);
    });

    it('should reject invalid session ID format', () => {
      const { controller } = makeController();
      expect(() => controller.drainSession('bad_format')).toThrow(BadRequestException);
    });
  });
});
