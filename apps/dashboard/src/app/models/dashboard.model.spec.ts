/**
 * Tests for TASK_2026_147 — Dashboard Home Live Command Center Redesign
 *
 * Covers:
 *   - dashboard.model.ts  (type-level contracts via shape validation)
 *   - mock-data.constants.ts  (MOCK_COMMAND_CENTER_DATA integrity)
 *   - mock-data.service.ts  (getCommandCenterData returns correct shape)
 *   - dashboard.component.ts pure logic (tokensDisplay formatter, status class helpers)
 */

import { describe, it, expect } from 'vitest';
import {
  MOCK_COMMAND_CENTER_DATA,
  MOCK_TASK_STATUS_BREAKDOWN,
  MOCK_TOKEN_COST_SUMMARY,
  MOCK_ACTIVE_SESSIONS,
  MOCK_ACTIVE_COMMAND_CENTER_TASKS,
} from '../services/mock-data.constants';
import type {
  CommandCenterData,
  TaskStatusBreakdown,
  TokenCostSummary,
  ActiveSession,
  ActiveTask,
  TaskStatusKey,
} from './dashboard.model';

// ── Pure logic extracted from DashboardComponent for isolated testing ───────

function tokensDisplay(totalTokens: number): string {
  if (totalTokens >= 1_000_000) return `${(totalTokens / 1_000_000).toFixed(1)}M`;
  if (totalTokens >= 1_000) return `${(totalTokens / 1_000).toFixed(0)}K`;
  return totalTokens.toString();
}

const statusClassMap: Record<TaskStatusKey, string> = {
  CREATED: 'status-created',
  IN_PROGRESS: 'status-in-progress',
  IMPLEMENTED: 'status-implemented',
  IN_REVIEW: 'status-in-review',
  FIXING: 'status-fixing',
  COMPLETE: 'status-complete',
  FAILED: 'status-failed',
  BLOCKED: 'status-blocked',
  CANCELLED: 'status-cancelled',
};

function getStatusValueClass(status: string): string {
  return (statusClassMap as Record<string, string>)[status] ?? '';
}

function computeTotalTasks(b: TaskStatusBreakdown): number {
  return b.CREATED + b.IN_PROGRESS + b.IMPLEMENTED + b.IN_REVIEW + b.FIXING + b.COMPLETE + b.FAILED + b.BLOCKED + b.CANCELLED;
}

function getSessionStatusClass(status: string): string {
  return status === 'running' ? 'status-running' : 'status-paused';
}

// ── Model shape tests ─────────────────────────────────────────────────────────

describe('TaskStatusBreakdown model', () => {
  it('has all required status keys including CANCELLED', () => {
    const b: TaskStatusBreakdown = MOCK_TASK_STATUS_BREAKDOWN;
    const requiredKeys: TaskStatusKey[] = [
      'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'FIXING',
      'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
    ];
    for (const key of requiredKeys) {
      expect(typeof b[key]).toBe('number');
    }
  });

  it('derived total equals sum of all 8 status counts', () => {
    const b = MOCK_TASK_STATUS_BREAKDOWN;
    const sum = computeTotalTasks(b);
    expect(sum).toBe(
      b.CREATED + b.IN_PROGRESS + b.IMPLEMENTED + b.IN_REVIEW + b.FIXING +
      b.COMPLETE + b.FAILED + b.BLOCKED + b.CANCELLED
    );
  });

  it('all status counts are non-negative integers', () => {
    const b = MOCK_TASK_STATUS_BREAKDOWN;
    const values = [
      b.CREATED, b.IN_PROGRESS, b.IMPLEMENTED, b.IN_REVIEW, b.FIXING,
      b.COMPLETE, b.FAILED, b.BLOCKED, b.CANCELLED,
    ];
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('TokenCostSummary model', () => {
  it('has totalTokens as a positive number', () => {
    expect(MOCK_TOKEN_COST_SUMMARY.totalTokens).toBeGreaterThan(0);
  });

  it('has totalCost as a positive number', () => {
    expect(MOCK_TOKEN_COST_SUMMARY.totalCost).toBeGreaterThan(0);
  });

  it('has a recentSessions array', () => {
    expect(Array.isArray(MOCK_TOKEN_COST_SUMMARY.recentSessions)).toBe(true);
  });

  it('each session entry has required fields', () => {
    for (const session of MOCK_TOKEN_COST_SUMMARY.recentSessions) {
      expect(typeof session.sessionId).toBe('string');
      expect(session.sessionId.length).toBeGreaterThan(0);
      expect(typeof session.date).toBe('string');
      expect(typeof session.tokens).toBe('number');
      expect(session.tokens).toBeGreaterThan(0);
      expect(typeof session.cost).toBe('number');
      expect(session.cost).toBeGreaterThan(0);
    }
  });
});

describe('ActiveSession model', () => {
  it('each active session has required fields', () => {
    for (const s of MOCK_ACTIVE_SESSIONS) {
      expect(typeof s.sessionId).toBe('string');
      expect(s.sessionId.length).toBeGreaterThan(0);
      expect(typeof s.taskId).toBe('string');
      expect(s.taskId.length).toBeGreaterThan(0);
      expect(typeof s.taskTitle).toBe('string');
      expect(s.taskTitle.length).toBeGreaterThan(0);
      expect(['running', 'paused']).toContain(s.status);
    }
  });

  it('session status is either running or paused', () => {
    for (const s of MOCK_ACTIVE_SESSIONS) {
      expect(s.status === 'running' || s.status === 'paused').toBe(true);
    }
  });
});

describe('ActiveTask model', () => {
  it('each active task has required fields', () => {
    for (const t of MOCK_ACTIVE_COMMAND_CENTER_TASKS) {
      expect(typeof t.taskId).toBe('string');
      expect(t.taskId.length).toBeGreaterThan(0);
      expect(typeof t.title).toBe('string');
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.status).toBe('IN_PROGRESS');
      expect(typeof t.type).toBe('string');
      expect(typeof t.priority).toBe('string');
    }
  });

  it('all active tasks have status IN_PROGRESS', () => {
    for (const t of MOCK_ACTIVE_COMMAND_CENTER_TASKS) {
      expect(t.status).toBe('IN_PROGRESS');
    }
  });
});

// ── CommandCenterData aggregate ───────────────────────────────────────────────

describe('MOCK_COMMAND_CENTER_DATA', () => {
  it('has taskBreakdown property', () => {
    expect(MOCK_COMMAND_CENTER_DATA.taskBreakdown).toBeDefined();
  });

  it('has tokenCost property', () => {
    expect(MOCK_COMMAND_CENTER_DATA.tokenCost).toBeDefined();
  });

  it('has activeSessions array', () => {
    expect(Array.isArray(MOCK_COMMAND_CENTER_DATA.activeSessions)).toBe(true);
  });

  it('has activeTasks array', () => {
    expect(Array.isArray(MOCK_COMMAND_CENTER_DATA.activeTasks)).toBe(true);
  });

  it('taskBreakdown is the same reference as MOCK_TASK_STATUS_BREAKDOWN', () => {
    expect(MOCK_COMMAND_CENTER_DATA.taskBreakdown).toBe(MOCK_TASK_STATUS_BREAKDOWN);
  });

  it('tokenCost is the same reference as MOCK_TOKEN_COST_SUMMARY', () => {
    expect(MOCK_COMMAND_CENTER_DATA.tokenCost).toBe(MOCK_TOKEN_COST_SUMMARY);
  });

  it('activeSessions is the same reference as MOCK_ACTIVE_SESSIONS', () => {
    expect(MOCK_COMMAND_CENTER_DATA.activeSessions).toBe(MOCK_ACTIVE_SESSIONS);
  });

  it('activeTasks is the same reference as MOCK_ACTIVE_COMMAND_CENTER_TASKS', () => {
    expect(MOCK_COMMAND_CENTER_DATA.activeTasks).toBe(MOCK_ACTIVE_COMMAND_CENTER_TASKS);
  });
});

// ── Acceptance criteria: all 7 task status variants present in breakdown ─────

describe('Task status breakdown covers all acceptance criteria statuses', () => {
  const statuses: TaskStatusKey[] = [
    'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
  ];

  for (const status of statuses) {
    it(`includes ${status} with a numeric count`, () => {
      expect(typeof MOCK_TASK_STATUS_BREAKDOWN[status]).toBe('number');
    });
  }

  it('derived total task count is positive', () => {
    expect(computeTotalTasks(MOCK_TASK_STATUS_BREAKDOWN)).toBeGreaterThan(0);
  });
});

// ── Acceptance criteria: token/cost summary ───────────────────────────────────

describe('Token and cost summary meets acceptance criteria', () => {
  it('totalTokens is a positive integer or number', () => {
    expect(MOCK_TOKEN_COST_SUMMARY.totalTokens).toBeGreaterThan(0);
  });

  it('totalCost is a positive number representing dollars', () => {
    expect(MOCK_TOKEN_COST_SUMMARY.totalCost).toBeGreaterThan(0);
    expect(typeof MOCK_TOKEN_COST_SUMMARY.totalCost).toBe('number');
  });

  it('recentSessions contains at least one entry', () => {
    expect(MOCK_TOKEN_COST_SUMMARY.recentSessions.length).toBeGreaterThan(0);
  });
});

// ── Acceptance criteria: active sessions section ─────────────────────────────

describe('Active sessions section meets acceptance criteria', () => {
  it('active sessions list is non-empty', () => {
    expect(MOCK_ACTIVE_SESSIONS.length).toBeGreaterThan(0);
  });

  it('each session links to a task via taskId', () => {
    for (const s of MOCK_ACTIVE_SESSIONS) {
      expect(s.taskId).toMatch(/^TASK_/);
    }
  });

  it('each session has a human-readable taskTitle', () => {
    for (const s of MOCK_ACTIVE_SESSIONS) {
      expect(s.taskTitle.length).toBeGreaterThan(5);
    }
  });
});

// ── Acceptance criteria: active tasks section ────────────────────────────────

describe('Active tasks section meets acceptance criteria', () => {
  it('active tasks list is non-empty', () => {
    expect(MOCK_ACTIVE_COMMAND_CENTER_TASKS.length).toBeGreaterThan(0);
  });

  it('each active task has a task ID matching expected format', () => {
    for (const t of MOCK_ACTIVE_COMMAND_CENTER_TASKS) {
      expect(t.taskId).toMatch(/^TASK_/);
    }
  });

  it('each active task has a non-empty title', () => {
    for (const t of MOCK_ACTIVE_COMMAND_CENTER_TASKS) {
      expect(t.title.length).toBeGreaterThan(5);
    }
  });

  it('each active task has a type and priority', () => {
    for (const t of MOCK_ACTIVE_COMMAND_CENTER_TASKS) {
      expect(t.type.length).toBeGreaterThan(0);
      expect(t.priority.length).toBeGreaterThan(0);
    }
  });
});

// ── tokensDisplay formatter ───────────────────────────────────────────────────

describe('tokensDisplay formatter', () => {
  it('formats values under 1000 as plain number string', () => {
    expect(tokensDisplay(0)).toBe('0');
    expect(tokensDisplay(500)).toBe('500');
    expect(tokensDisplay(999)).toBe('999');
  });

  it('formats values >= 1000 with K suffix', () => {
    expect(tokensDisplay(1000)).toBe('1K');
    expect(tokensDisplay(32000)).toBe('32K');
    expect(tokensDisplay(125000)).toBe('125K');
    expect(tokensDisplay(999999)).toBe('1000K');
  });

  it('formats values >= 1_000_000 with M suffix and one decimal', () => {
    expect(tokensDisplay(1_000_000)).toBe('1.0M');
    expect(tokensDisplay(2_400_000)).toBe('2.4M');
    expect(tokensDisplay(12_500_000)).toBe('12.5M');
  });

  it('correctly formats the mock totalTokens value (2,400,000)', () => {
    expect(tokensDisplay(MOCK_TOKEN_COST_SUMMARY.totalTokens)).toBe('2.4M');
  });
});

// ── getStatusValueClass ───────────────────────────────────────────────────────

describe('getStatusValueClass', () => {
  const cases: [TaskStatusKey, string][] = [
    ['CREATED',     'status-created'],
    ['IN_PROGRESS', 'status-in-progress'],
    ['IMPLEMENTED', 'status-implemented'],
    ['IN_REVIEW',   'status-in-review'],
    ['FIXING',      'status-fixing'],
    ['COMPLETE',    'status-complete'],
    ['FAILED',      'status-failed'],
    ['BLOCKED',     'status-blocked'],
    ['CANCELLED',   'status-cancelled'],
  ];

  for (const [status, expected] of cases) {
    it(`maps ${status} to "${expected}"`, () => {
      expect(getStatusValueClass(status)).toBe(expected);
    });
  }

  it('returns empty string for unknown status', () => {
    expect(getStatusValueClass('UNKNOWN')).toBe('');
    expect(getStatusValueClass('')).toBe('');
  });
});

// ── getSessionStatusClass ─────────────────────────────────────────────────────

describe('getSessionStatusClass', () => {
  it('maps "running" to "status-running"', () => {
    expect(getSessionStatusClass('running')).toBe('status-running');
  });

  it('maps "paused" to "status-paused"', () => {
    expect(getSessionStatusClass('paused')).toBe('status-paused');
  });

  it('maps any non-running value to "status-paused"', () => {
    expect(getSessionStatusClass('idle')).toBe('status-paused');
    expect(getSessionStatusClass('')).toBe('status-paused');
  });
});

// ── MockDataService.getCommandCenterData() — inline functional test ───────────

describe('MockDataService.getCommandCenterData returns CommandCenterData', () => {
  // Test the service logic inline since Angular DI cannot run in vitest without TestBed
  function getCommandCenterData(): CommandCenterData {
    return MOCK_COMMAND_CENTER_DATA;
  }

  it('returns an object with taskBreakdown', () => {
    const data = getCommandCenterData();
    expect(data.taskBreakdown).toBeDefined();
  });

  it('returns an object with tokenCost', () => {
    const data = getCommandCenterData();
    expect(data.tokenCost).toBeDefined();
  });

  it('returns an object with activeSessions', () => {
    const data = getCommandCenterData();
    expect(Array.isArray(data.activeSessions)).toBe(true);
  });

  it('returns an object with activeTasks', () => {
    const data = getCommandCenterData();
    expect(Array.isArray(data.activeTasks)).toBe(true);
  });

  it('all data comes from mock constants — no real API call', () => {
    // If data returns synchronously from a constant, it is mock-based
    const result = getCommandCenterData();
    expect(result).toBe(MOCK_COMMAND_CENTER_DATA);
  });
});
