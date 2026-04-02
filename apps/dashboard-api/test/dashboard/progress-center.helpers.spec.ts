/**
 * Unit tests for progress-center.helpers.ts
 *
 * All helpers are pure functions — no NestJS or DB setup required.
 * Tests cover: phase averages, phase states, progress percent, ETA,
 * session status, activity tone/summary, and terminal-status detection.
 */
import 'reflect-metadata';
import type { CortexEvent, CortexPhaseTiming, CortexSession, CortexTask, CortexTaskTrace, CortexWorker } from '../../src/dashboard/cortex.types';
import type { ProgressCenterPhase, ProgressCenterTask } from '../../src/dashboard/progress-center.types';
import {
  STALE_HEARTBEAT_MS,
  UI_PHASES,
  activitySummary,
  activityTone,
  buildPhaseAverages,
  collectSessionTaskIds,
  currentPhase,
  isSessionActive,
  isTerminalTaskStatus,
  isWorkerStuck,
  maxEta,
  minutesBetween,
  phaseStates,
  progressPercent,
  remainingEta,
  sessionStatus,
} from '../../src/dashboard/progress-center.helpers';

// ============================================================
// Shared test factories
// ============================================================

function makeSession(overrides: Partial<CortexSession> = {}): CortexSession {
  return {
    id: 'SESSION_2026-03-31_10-00-00',
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
    session_id: 'SESSION_2026-03-31_10-00-00',
    task_id: 'TASK_2026_001',
    worker_type: 'build',
    label: 'Build Worker',
    status: 'running',
    model: 'claude-sonnet',
    provider: 'claude',
    launcher: 'sdk',
    spawn_time: new Date().toISOString(),
    outcome: null,
    retry_number: 0,
    cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CortexEvent> = {}): CortexEvent {
  return {
    id: 1,
    session_id: 'SESSION_2026-03-31_10-00-00',
    task_id: null,
    source: 'supervisor',
    event_type: 'task_started',
    data: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTrace(overrides: Partial<CortexTaskTrace> = {}): CortexTaskTrace {
  return {
    task_id: 'TASK_2026_001',
    workers: [],
    phases: [],
    reviews: [],
    fix_cycles: [],
    events: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<CortexTask> = {}): CortexTask {
  return {
    id: 'TASK_2026_001',
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

// ============================================================
// Tests
// ============================================================

describe('UI_PHASES constant', () => {
  it('should contain exactly 5 phases in pipeline order', () => {
    expect(UI_PHASES).toEqual(['PM', 'Architect', 'Dev', 'QA', 'Review']);
  });
});

// ----------------------------------------------------------
// buildPhaseAverages
// ----------------------------------------------------------

describe('buildPhaseAverages()', () => {
  it('should return default averages when no timing data is provided', () => {
    const averages = buildPhaseAverages([]);
    expect(averages.get('PM')).toBe(5);
    expect(averages.get('Architect')).toBe(8);
    expect(averages.get('Dev')).toBe(18);
    expect(averages.get('QA')).toBe(10);
    expect(averages.get('Review')).toBe(4);
  });

  it('should override PM average from timing data', () => {
    const timing: CortexPhaseTiming[] = [{ phase: 'PM', count: 3, avg_duration_minutes: 7, min_duration_minutes: 4, max_duration_minutes: 10 }];
    const averages = buildPhaseAverages(timing);
    expect(averages.get('PM')).toBe(7);
  });

  it('should override Dev average from timing data', () => {
    const timing: CortexPhaseTiming[] = [{ phase: 'Dev', count: 5, avg_duration_minutes: 25, min_duration_minutes: 15, max_duration_minutes: 40 }];
    const averages = buildPhaseAverages(timing);
    expect(averages.get('Dev')).toBe(25);
  });

  it('should derive QA and Review from Review timing data', () => {
    const timing: CortexPhaseTiming[] = [{ phase: 'Review', count: 4, avg_duration_minutes: 12, min_duration_minutes: 8, max_duration_minutes: 20 }];
    const averages = buildPhaseAverages(timing);
    expect(averages.get('QA')).toBe(12);
    expect(averages.get('Review')).toBe(Math.max(2, Math.round(12 / 2)));
  });

  it('should override Review average from Completion timing data', () => {
    const timing: CortexPhaseTiming[] = [{ phase: 'Completion', count: 2, avg_duration_minutes: 3, min_duration_minutes: 2, max_duration_minutes: 4 }];
    const averages = buildPhaseAverages(timing);
    expect(averages.get('Review')).toBe(3);
  });

  it('should handle null avg_duration_minutes by using Dev default', () => {
    const timing: CortexPhaseTiming[] = [{ phase: 'Dev', count: 1, avg_duration_minutes: null, min_duration_minutes: null, max_duration_minutes: null }];
    const averages = buildPhaseAverages(timing);
    // null avg falls back to existing Dev default (18)
    expect(averages.get('Dev')).toBe(18);
  });
});

// ----------------------------------------------------------
// collectSessionTaskIds
// ----------------------------------------------------------

describe('collectSessionTaskIds()', () => {
  it('should collect task IDs from workers', () => {
    const workers = [makeWorker({ task_id: 'TASK_2026_001' }), makeWorker({ task_id: 'TASK_2026_002' })];
    const ids = collectSessionTaskIds('SESSION_2026-03-31_10-00-00', workers, []);
    expect(ids).toContain('TASK_2026_001');
    expect(ids).toContain('TASK_2026_002');
  });

  it('should collect task IDs from events matching the session', () => {
    const events = [makeEvent({ task_id: 'TASK_2026_003', session_id: 'SESSION_2026-03-31_10-00-00' })];
    const ids = collectSessionTaskIds('SESSION_2026-03-31_10-00-00', [], events);
    expect(ids).toContain('TASK_2026_003');
  });

  it('should not include task IDs from events belonging to other sessions', () => {
    const events = [makeEvent({ task_id: 'TASK_2026_004', session_id: 'SESSION_OTHER' })];
    const ids = collectSessionTaskIds('SESSION_2026-03-31_10-00-00', [], events);
    expect(ids).not.toContain('TASK_2026_004');
  });

  it('should deduplicate task IDs appearing in both workers and events', () => {
    const workers = [makeWorker({ task_id: 'TASK_2026_001' })];
    const events = [makeEvent({ task_id: 'TASK_2026_001', session_id: 'SESSION_2026-03-31_10-00-00' })];
    const ids = collectSessionTaskIds('SESSION_2026-03-31_10-00-00', workers, events);
    expect(ids.filter((id) => id === 'TASK_2026_001')).toHaveLength(1);
  });

  it('should skip workers with empty task_id', () => {
    const workers = [makeWorker({ task_id: '' })];
    const ids = collectSessionTaskIds('SESSION_2026-03-31_10-00-00', workers, []);
    expect(ids).toHaveLength(0);
  });

  it('should skip events with null task_id', () => {
    const events = [makeEvent({ task_id: null, session_id: 'SESSION_2026-03-31_10-00-00' })];
    const ids = collectSessionTaskIds('SESSION_2026-03-31_10-00-00', [], events);
    expect(ids).toHaveLength(0);
  });
});

// ----------------------------------------------------------
// currentPhase
// ----------------------------------------------------------

describe('currentPhase()', () => {
  it('should return Review for COMPLETE tasks', () => {
    const trace = makeTrace();
    expect(currentPhase(trace, 'COMPLETE')).toBe('Review');
  });

  it('should return QA for IN_REVIEW tasks', () => {
    const trace = makeTrace();
    expect(currentPhase(trace, 'IN_REVIEW')).toBe('QA');
  });

  it('should return QA for FIXING tasks', () => {
    const trace = makeTrace();
    expect(currentPhase(trace, 'FIXING')).toBe('QA');
  });

  it('should return QA when a running review worker exists', () => {
    const trace = makeTrace({
      workers: [makeWorker({ worker_type: 'Review', status: 'running' })],
    });
    expect(currentPhase(trace, 'IN_PROGRESS')).toBe('QA');
  });

  it('should return Dev when Dev phase has been logged', () => {
    const trace = makeTrace({
      phases: [{ id: 1, worker_run_id: 'w1', task_id: 'TASK_2026_001', phase: 'Dev', model: 'claude', start_time: '2026-03-31T10:00:00.000Z', end_time: null, duration_minutes: null, input_tokens: 0, output_tokens: 0, outcome: null }],
    });
    expect(currentPhase(trace, 'IN_PROGRESS')).toBe('Dev');
  });

  it('should return Architect when Architect phase has been logged but not Dev', () => {
    const trace = makeTrace({
      phases: [{ id: 1, worker_run_id: 'w1', task_id: 'TASK_2026_001', phase: 'Architect', model: 'claude', start_time: '2026-03-31T10:00:00.000Z', end_time: null, duration_minutes: null, input_tokens: 0, output_tokens: 0, outcome: null }],
    });
    expect(currentPhase(trace, 'IN_PROGRESS')).toBe('Architect');
  });

  it('should return PM when only PM phase has been logged', () => {
    const trace = makeTrace({
      phases: [{ id: 1, worker_run_id: 'w1', task_id: 'TASK_2026_001', phase: 'PM', model: 'claude', start_time: '2026-03-31T10:00:00.000Z', end_time: null, duration_minutes: null, input_tokens: 0, output_tokens: 0, outcome: null }],
    });
    expect(currentPhase(trace, 'IN_PROGRESS')).toBe('PM');
  });

  it('should default to PM when no phases have been logged', () => {
    const trace = makeTrace();
    expect(currentPhase(trace, 'IN_PROGRESS')).toBe('PM');
  });
});

// ----------------------------------------------------------
// phaseStates
// ----------------------------------------------------------

describe('phaseStates()', () => {
  it('should mark all phases as complete for a COMPLETE task', () => {
    const states = phaseStates('Dev', 'COMPLETE');
    expect(states.every((p) => p.state === 'complete')).toBe(true);
  });

  it('should mark all phases as complete for a FAILED task', () => {
    const states = phaseStates('PM', 'FAILED');
    expect(states.every((p) => p.state === 'complete')).toBe(true);
  });

  it('should mark all phases as complete for a CANCELLED task', () => {
    const states = phaseStates('PM', 'CANCELLED');
    expect(states.every((p) => p.state === 'complete')).toBe(true);
  });

  it('should mark PM as complete and Architect as active when current is Architect', () => {
    const states = phaseStates('Architect', 'IN_PROGRESS');
    const stateMap = Object.fromEntries(states.map((p) => [p.key, p.state]));
    expect(stateMap['PM']).toBe('complete');
    expect(stateMap['Architect']).toBe('active');
    expect(stateMap['Dev']).toBe('pending');
    expect(stateMap['QA']).toBe('pending');
    expect(stateMap['Review']).toBe('pending');
  });

  it('should mark first phase (PM) as active when current is PM', () => {
    const states = phaseStates('PM', 'IN_PROGRESS');
    expect(states[0].state).toBe('active');
    expect(states.slice(1).every((p) => p.state === 'pending')).toBe(true);
  });

  it('should include exactly 5 phase entries', () => {
    const states = phaseStates('Dev', 'IN_PROGRESS');
    expect(states).toHaveLength(5);
  });
});

// ----------------------------------------------------------
// progressPercent
// ----------------------------------------------------------

describe('progressPercent()', () => {
  it('should return 100 for terminal task status COMPLETE', () => {
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key) => ({ key, state: 'pending' }));
    expect(progressPercent(phases, 'COMPLETE')).toBe(100);
  });

  it('should return 100 for terminal task status FAILED', () => {
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key) => ({ key, state: 'pending' }));
    expect(progressPercent(phases, 'FAILED')).toBe(100);
  });

  it('should return 0 when all phases are pending', () => {
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key) => ({ key, state: 'pending' }));
    expect(progressPercent(phases, 'IN_PROGRESS')).toBe(0);
  });

  it('should return 100 when all phases are complete', () => {
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key) => ({ key, state: 'complete' }));
    expect(progressPercent(phases, 'IN_PROGRESS')).toBe(100);
  });

  it('should return 50 when half the phases are complete and one is active', () => {
    // 2 complete (score 2) + 1 active (score 0.5) + 2 pending (score 0) over 5 = 50%
    const phases: ProgressCenterPhase[] = [
      { key: 'PM', state: 'complete' },
      { key: 'Architect', state: 'complete' },
      { key: 'Dev', state: 'active' },
      { key: 'QA', state: 'pending' },
      { key: 'Review', state: 'pending' },
    ];
    expect(progressPercent(phases, 'IN_PROGRESS')).toBe(50);
  });

  it('should calculate partial progress with only an active phase', () => {
    // 1 active (0.5) over 5 = 10%
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key, i) => ({ key, state: i === 0 ? 'active' : 'pending' }));
    expect(progressPercent(phases, 'IN_PROGRESS')).toBe(10);
  });
});

// ----------------------------------------------------------
// remainingEta
// ----------------------------------------------------------

describe('remainingEta()', () => {
  const defaults = new Map<'PM' | 'Architect' | 'Dev' | 'QA' | 'Review', number>([
    ['PM', 5],
    ['Architect', 8],
    ['Dev', 18],
    ['QA', 10],
    ['Review', 4],
  ]);

  it('should return null when all phases are complete', () => {
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key) => ({ key, state: 'complete' }));
    expect(remainingEta(phases, defaults)).toBeNull();
  });

  it('should return half the phase average for an active phase', () => {
    const phases: ProgressCenterPhase[] = [
      { key: 'PM', state: 'complete' },
      { key: 'Architect', state: 'complete' },
      { key: 'Dev', state: 'active' },
      { key: 'QA', state: 'pending' },
      { key: 'Review', state: 'pending' },
    ];
    // Dev active = 18/2 = 9, QA pending = 10, Review pending = 4 => 23
    expect(remainingEta(phases, defaults)).toBe(23);
  });

  it('should return full sum for all pending phases', () => {
    const phases: ProgressCenterPhase[] = UI_PHASES.map((key) => ({ key, state: 'pending' }));
    // 5 + 8 + 18 + 10 + 4 = 45
    expect(remainingEta(phases, defaults)).toBe(45);
  });

  it('should fall back to 5 for unknown phase keys', () => {
    const emptyAverages = new Map<'PM' | 'Architect' | 'Dev' | 'QA' | 'Review', number>();
    const phases: ProgressCenterPhase[] = [{ key: 'PM', state: 'pending' }];
    expect(remainingEta(phases, emptyAverages)).toBe(5);
  });
});

// ----------------------------------------------------------
// maxEta
// ----------------------------------------------------------

describe('maxEta()', () => {
  it('should return null when no tasks have ETA', () => {
    const tasks = [{ etaMinutes: null }, { etaMinutes: null }] as ProgressCenterTask[];
    expect(maxEta(tasks)).toBeNull();
  });

  it('should return null for empty task list', () => {
    expect(maxEta([])).toBeNull();
  });

  it('should return the maximum ETA value', () => {
    const tasks = [{ etaMinutes: 10 }, { etaMinutes: 25 }, { etaMinutes: 5 }] as ProgressCenterTask[];
    expect(maxEta(tasks)).toBe(25);
  });

  it('should ignore null ETA values when some tasks have values', () => {
    const tasks = [{ etaMinutes: null }, { etaMinutes: 15 }] as ProgressCenterTask[];
    expect(maxEta(tasks)).toBe(15);
  });
});

// ----------------------------------------------------------
// sessionStatus
// ----------------------------------------------------------

describe('sessionStatus()', () => {
  it('should return completed when session loop_status is not running', () => {
    const session = makeSession({ loop_status: 'stopped' });
    expect(sessionStatus(session, 0)).toBe('completed');
  });

  it('should return stuck when stuckWorkers > 0', () => {
    const session = makeSession({ loop_status: 'running' });
    expect(sessionStatus(session, 1)).toBe('stuck');
  });

  it('should return warning when heartbeat is stale', () => {
    const staleTime = new Date(Date.now() - STALE_HEARTBEAT_MS - 10_000).toISOString();
    const session = makeSession({ loop_status: 'running', last_heartbeat: staleTime });
    expect(sessionStatus(session, 0)).toBe('warning');
  });

  it('should return running when heartbeat is fresh and no stuck workers', () => {
    const freshTime = new Date().toISOString();
    const session = makeSession({ loop_status: 'running', last_heartbeat: freshTime });
    expect(sessionStatus(session, 0)).toBe('running');
  });

  it('should return running when last_heartbeat is null and no stuck workers', () => {
    const session = makeSession({ loop_status: 'running', last_heartbeat: null });
    expect(sessionStatus(session, 0)).toBe('running');
  });
});

// ----------------------------------------------------------
// isWorkerStuck
// ----------------------------------------------------------

describe('isWorkerStuck()', () => {
  it('should return false for a non-running worker', () => {
    const worker = makeWorker({ status: 'completed' });
    const session = makeSession({ last_heartbeat: new Date(Date.now() - STALE_HEARTBEAT_MS - 1000).toISOString() });
    expect(isWorkerStuck(worker, session)).toBe(false);
  });

  it('should return false when session has no heartbeat', () => {
    const worker = makeWorker({ status: 'running' });
    const session = makeSession({ last_heartbeat: null });
    expect(isWorkerStuck(worker, session)).toBe(false);
  });

  it('should return false when heartbeat is fresh', () => {
    const worker = makeWorker({ status: 'running' });
    const session = makeSession({ last_heartbeat: new Date().toISOString() });
    expect(isWorkerStuck(worker, session)).toBe(false);
  });

  it('should return true when worker is running and heartbeat is stale', () => {
    const worker = makeWorker({ status: 'running' });
    const staleTime = new Date(Date.now() - STALE_HEARTBEAT_MS - 10_000).toISOString();
    const session = makeSession({ last_heartbeat: staleTime });
    expect(isWorkerStuck(worker, session)).toBe(true);
  });
});

// ----------------------------------------------------------
// isSessionActive
// ----------------------------------------------------------

describe('isSessionActive()', () => {
  it('should return true for a running session with no end time', () => {
    const session = makeSession({ loop_status: 'running', ended_at: null });
    expect(isSessionActive(session)).toBe(true);
  });

  it('should return false when loop_status is not running', () => {
    const session = makeSession({ loop_status: 'stopped', ended_at: null });
    expect(isSessionActive(session)).toBe(false);
  });

  it('should return false when ended_at is set', () => {
    const session = makeSession({ loop_status: 'running', ended_at: '2026-03-31T12:00:00.000Z' });
    expect(isSessionActive(session)).toBe(false);
  });
});

// ----------------------------------------------------------
// minutesBetween
// ----------------------------------------------------------

describe('minutesBetween()', () => {
  it('should return 0 when start equals end', () => {
    const t = '2026-03-31T10:00:00.000Z';
    expect(minutesBetween(t, t)).toBe(0);
  });

  it('should return correct minutes for a 30-minute interval', () => {
    const start = '2026-03-31T10:00:00.000Z';
    const end = '2026-03-31T10:30:00.000Z';
    expect(minutesBetween(start, end)).toBe(30);
  });

  it('should return 0 (not negative) when end is before start', () => {
    const start = '2026-03-31T10:30:00.000Z';
    const end = '2026-03-31T10:00:00.000Z';
    expect(minutesBetween(start, end)).toBe(0);
  });

  it('should return 60 for a 1-hour interval', () => {
    const start = '2026-03-31T10:00:00.000Z';
    const end = '2026-03-31T11:00:00.000Z';
    expect(minutesBetween(start, end)).toBe(60);
  });
});

// ----------------------------------------------------------
// activitySummary
// ----------------------------------------------------------

describe('activitySummary()', () => {
  it('should generate summary with task_id as target', () => {
    const event = makeEvent({ event_type: 'task_started', task_id: 'TASK_2026_001', data: {} });
    expect(activitySummary(event)).toBe('task_started on TASK_2026_001');
  });

  it('should fall back to session_id when task_id is null', () => {
    const event = makeEvent({ event_type: 'heartbeat', task_id: null, session_id: 'SESSION_2026-03-31_10-00-00', data: {} });
    expect(activitySummary(event)).toBe('heartbeat on SESSION_2026-03-31_10-00-00');
  });

  it('should include phase when present in data', () => {
    const event = makeEvent({ event_type: 'phase_started', task_id: 'TASK_2026_001', data: { phase: 'Dev' } });
    expect(activitySummary(event)).toBe('phase_started on TASK_2026_001 (Dev)');
  });

  it('should include status when present in data', () => {
    const event = makeEvent({ event_type: 'task_updated', task_id: 'TASK_2026_001', data: { status: 'IN_REVIEW' } });
    expect(activitySummary(event)).toBe('task_updated on TASK_2026_001 (IN_REVIEW)');
  });

  it('should include both phase and status when both present in data', () => {
    const event = makeEvent({ event_type: 'worker_status', task_id: 'TASK_2026_001', data: { phase: 'QA', status: 'running' } });
    expect(activitySummary(event)).toBe('worker_status on TASK_2026_001 (QA running)');
  });

  it('should not include non-string phase/status values', () => {
    const event = makeEvent({ event_type: 'custom', task_id: 'TASK_2026_001', data: { phase: 42, status: null } });
    expect(activitySummary(event)).toBe('custom on TASK_2026_001');
  });
});

// ----------------------------------------------------------
// activityTone
// ----------------------------------------------------------

describe('activityTone()', () => {
  it('should return error for event types containing "fail"', () => {
    expect(activityTone('task_failed')).toBe('error');
    expect(activityTone('TASK_FAIL')).toBe('error');
  });

  it('should return error for event types containing "error"', () => {
    expect(activityTone('worker_error')).toBe('error');
  });

  it('should return warning for event types containing "warn"', () => {
    expect(activityTone('worker_warn')).toBe('warning');
  });

  it('should return warning for event types containing "stuck"', () => {
    expect(activityTone('worker_stuck')).toBe('warning');
  });

  it('should return success for event types containing "complete"', () => {
    expect(activityTone('task_complete')).toBe('success');
    expect(activityTone('TASK_COMPLETED')).toBe('success');
  });

  it('should return success for event types containing "implemented"', () => {
    expect(activityTone('task_implemented')).toBe('success');
  });

  it('should return info for neutral event types', () => {
    expect(activityTone('task_started')).toBe('info');
    expect(activityTone('heartbeat')).toBe('info');
    expect(activityTone('phase_logged')).toBe('info');
  });
});

// ----------------------------------------------------------
// isTerminalTaskStatus
// ----------------------------------------------------------

describe('isTerminalTaskStatus()', () => {
  it('should return true for COMPLETE', () => {
    expect(isTerminalTaskStatus('COMPLETE')).toBe(true);
  });

  it('should return true for FAILED', () => {
    expect(isTerminalTaskStatus('FAILED')).toBe(true);
  });

  it('should return true for CANCELLED', () => {
    expect(isTerminalTaskStatus('CANCELLED')).toBe(true);
  });

  it('should return false for IN_PROGRESS', () => {
    expect(isTerminalTaskStatus('IN_PROGRESS')).toBe(false);
  });

  it('should return false for IN_REVIEW', () => {
    expect(isTerminalTaskStatus('IN_REVIEW')).toBe(false);
  });

  it('should return false for CREATED', () => {
    expect(isTerminalTaskStatus('CREATED')).toBe(false);
  });

  it('should return false for BLOCKED', () => {
    expect(isTerminalTaskStatus('BLOCKED')).toBe(false);
  });
});
