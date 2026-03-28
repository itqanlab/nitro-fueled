import type { PipelinePhase, PipelinePhaseStatus, SessionAnalytics } from '../events/event-types.js';

const PHASE_ORDER: ReadonlyArray<string> = ['Build', 'Review', 'Fix', 'Complete'];

const STATUS_TO_ACTIVE_PHASE: Readonly<Record<string, string>> = {
  CREATED: '',
  IN_PROGRESS: 'Build',
  IMPLEMENTED: '',
  IN_REVIEW: 'Review',
  FIXING: 'Fix',
  COMPLETE: '',
  FAILED: '',
  BLOCKED: '',
  CANCELLED: '',
};

const COMPLETED_THROUGH: Readonly<Record<string, ReadonlyArray<string>>> = {
  CREATED: [],
  IN_PROGRESS: [],
  IMPLEMENTED: ['Build'],
  IN_REVIEW: ['Build'],
  FIXING: ['Build', 'Review'],
  COMPLETE: ['Build', 'Review', 'Fix', 'Complete'],
  FAILED: [],
  BLOCKED: [],
  CANCELLED: [],
};

// Map analytics phase names to pipeline phase names for duration display.
// Since session-analytics only records total duration, we only show it on
// the last completed phase to avoid misleading repeated values.
const ANALYTICS_PHASE_TO_LAST_PIPELINE_PHASE: Readonly<Record<string, string>> = {
  Dev: 'Build',
  QA: 'Fix',
};

export function buildPipelinePhases(
  taskStatus: string,
  analytics: SessionAnalytics | null,
): ReadonlyArray<PipelinePhase> {
  const activePhase = STATUS_TO_ACTIVE_PHASE[taskStatus] ?? '';
  const donePhases = new Set(COMPLETED_THROUGH[taskStatus] ?? []);

  // Determine which phase failed: the last completed + 1, or the active phase
  const isFailed = taskStatus === 'FAILED';
  const lastCompletedIdx = isFailed
    ? [...PHASE_ORDER].reduce((best, p, i) => (donePhases.has(p) ? i : best), -1)
    : -1;
  const failedPhaseName = isFailed
    ? (PHASE_ORDER[lastCompletedIdx + 1] ?? PHASE_ORDER[PHASE_ORDER.length - 1])
    : null;

  // Only show total duration on the last completed phase (not every phase)
  const lastCompletedPhase = analytics !== null
    ? getLastCompletedPhaseName(analytics)
    : null;

  return PHASE_ORDER.map((name) => {
    let status: PipelinePhaseStatus;
    if (donePhases.has(name)) {
      status = 'complete';
    } else if (isFailed && name === failedPhaseName) {
      status = 'failed';
    } else if (name === activePhase) {
      status = 'active';
    } else {
      status = 'pending';
    }

    const isParallel = name === 'Review';
    const parallelParts: ReadonlyArray<string> = isParallel ? ['Review Lead', 'Test Lead'] : [];
    const duration = name === lastCompletedPhase && analytics !== null
      ? analytics.duration
      : null;

    return { name, status, duration, isParallel, parallelParts };
  });
}

function getLastCompletedPhaseName(analytics: SessionAnalytics): string | null {
  // Find the last analytics phase that completed and return its pipeline phase
  const completedPipelinePhases: string[] = [];
  for (const [analyticsPhase, pipelinePhase] of Object.entries(ANALYTICS_PHASE_TO_LAST_PIPELINE_PHASE)) {
    if (analytics.phasesCompleted.includes(analyticsPhase)) {
      completedPipelinePhases.push(pipelinePhase);
    }
  }
  if (analytics.outcome === 'COMPLETE') {
    completedPipelinePhases.push('Complete');
  }
  // Return the last one in PHASE_ORDER
  for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
    if (completedPipelinePhases.includes(PHASE_ORDER[i])) {
      return PHASE_ORDER[i];
    }
  }
  return null;
}
