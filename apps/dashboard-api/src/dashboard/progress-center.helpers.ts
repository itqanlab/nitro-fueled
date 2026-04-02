import type {
  CortexEvent,
  CortexPhaseTiming,
  CortexSession,
  CortexTask,
  CortexTaskTrace,
  CortexWorker,
} from './cortex.types';
import type {
  ProgressCenterActivity,
  ProgressCenterPhase,
  ProgressCenterPhaseKey,
  ProgressCenterSessionStatus,
  ProgressCenterTask,
} from './progress-center.types';

export const UI_PHASES: readonly ProgressCenterPhaseKey[] = ['PM', 'Architect', 'Dev', 'QA', 'Review'];
export const STALE_HEARTBEAT_MS = 3 * 60 * 1000;

export function buildPhaseAverages(phaseTiming: ReadonlyArray<CortexPhaseTiming>): ReadonlyMap<ProgressCenterPhaseKey, number> {
  const averages = new Map<ProgressCenterPhaseKey, number>([
    ['PM', 5],
    ['Architect', 8],
    ['Dev', 18],
    ['QA', 10],
    ['Review', 4],
  ]);
  for (const item of phaseTiming) {
    const avg = item.avg_duration_minutes ?? averages.get('Dev') ?? 18;
    if (item.phase === 'PM') averages.set('PM', avg);
    if (item.phase === 'Architect') averages.set('Architect', avg);
    if (item.phase === 'Dev') averages.set('Dev', avg);
    if (item.phase === 'Review') {
      averages.set('QA', avg);
      averages.set('Review', Math.max(2, Math.round(avg / 2)));
    }
    if (item.phase === 'Completion') averages.set('Review', avg);
  }
  return averages;
}

export function collectSessionTaskIds(
  sessionId: string,
  workers: ReadonlyArray<CortexWorker>,
  events: ReadonlyArray<CortexEvent>,
): readonly string[] {
  const ids = new Set<string>();
  for (const worker of workers) {
    if (worker.task_id !== '') ids.add(worker.task_id);
  }
  for (const event of events) {
    if (event.session_id === sessionId && event.task_id) ids.add(event.task_id);
  }
  return [...ids];
}

export function currentPhase(trace: CortexTaskTrace, status: CortexTask['status']): ProgressCenterPhaseKey {
  if (status === 'COMPLETE') return 'Review';
  if (status === 'IN_REVIEW' || status === 'FIXING') return 'QA';
  const reviewWorker = trace.workers.some((worker) => worker.worker_type.toLowerCase() === 'review' && worker.status === 'running');
  if (reviewWorker) return 'QA';
  const seen = new Set(trace.phases.map((phase) => phase.phase));
  // Check most advanced phases first so a task that has progressed past Dev is not frozen at Dev.
  if (seen.has('Completion')) return 'Review';
  if (seen.has('Review')) return 'QA';
  if (seen.has('Dev')) return 'Dev';
  if (seen.has('Architect')) return 'Architect';
  if (seen.has('PM')) return 'PM';
  return 'PM';
}

export function phaseStates(current: ProgressCenterPhaseKey, status: CortexTask['status']): readonly ProgressCenterPhase[] {
  if (isTerminalTaskStatus(status)) {
    return UI_PHASES.map((key) => ({ key, state: 'complete' }));
  }
  const currentIndex = UI_PHASES.indexOf(current);
  return UI_PHASES.map((key, index) => ({
    key,
    state: index < currentIndex ? 'complete' : index === currentIndex ? 'active' : 'pending',
  }));
}

export function progressPercent(phases: ReadonlyArray<ProgressCenterPhase>, status: CortexTask['status']): number {
  if (isTerminalTaskStatus(status)) return 100;
  const score = phases.reduce((sum, phase) => sum + (phase.state === 'complete' ? 1 : phase.state === 'active' ? 0.5 : 0), 0);
  return Math.round((score / phases.length) * 100);
}

export function remainingEta(
  phases: ReadonlyArray<ProgressCenterPhase>,
  averages: ReadonlyMap<ProgressCenterPhaseKey, number>,
): number | null {
  const minutes = phases.reduce((sum, phase) => {
    if (phase.state === 'complete') return sum;
    const avg = averages.get(phase.key) ?? 5;
    return sum + (phase.state === 'active' ? avg / 2 : avg);
  }, 0);
  return minutes > 0 ? Math.round(minutes) : null;
}

export function maxEta(tasks: ReadonlyArray<ProgressCenterTask>): number | null {
  const values = tasks.map((task) => task.etaMinutes).filter((value): value is number => value !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

export function sessionStatus(session: CortexSession, stuckWorkers: number): ProgressCenterSessionStatus {
  if (session.loop_status !== 'running') return 'completed';
  if (stuckWorkers > 0) return 'stuck';
  return session.last_heartbeat && Date.now() - new Date(session.last_heartbeat).getTime() > STALE_HEARTBEAT_MS
    ? 'warning'
    : 'running';
}

export function isWorkerStuck(worker: CortexWorker, session: CortexSession): boolean {
  return worker.status === 'running' && session.last_heartbeat !== null
    ? Date.now() - new Date(session.last_heartbeat).getTime() > STALE_HEARTBEAT_MS
    : false;
}

export function isSessionActive(session: CortexSession): boolean {
  return session.loop_status === 'running' && session.ended_at === null;
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function activitySummary(event: CortexEvent): string {
  const phase = typeof event.data['phase'] === 'string' ? event.data['phase'] : null;
  const status = typeof event.data['status'] === 'string' ? event.data['status'] : null;
  const target = event.task_id ?? event.session_id;
  const suffix = [phase, status].filter((value) => value !== null).join(' ');
  return suffix === '' ? `${event.event_type} on ${target}` : `${event.event_type} on ${target} (${suffix})`;
}

export function activityTone(eventType: string): ProgressCenterActivity['tone'] {
  const lowered = eventType.toLowerCase();
  if (lowered.includes('fail') || lowered.includes('error')) return 'error';
  if (lowered.includes('warn') || lowered.includes('stuck')) return 'warning';
  if (lowered.includes('complete') || lowered.includes('implemented')) return 'success';
  return 'info';
}

export function isTerminalTaskStatus(status: CortexTask['status']): boolean {
  return status === 'COMPLETE' || status === 'FAILED' || status === 'CANCELLED';
}
