import { Injectable } from '@nestjs/common';
import { CortexService } from './cortex.service';
import type {
  CortexEvent,
  CortexSession,
  CortexTask,
  CortexWorker,
} from './cortex.types';
import type {
  ProgressCenterActivity,
  ProgressCenterHealth,
  ProgressCenterPhase,
  ProgressCenterPhaseKey,
  ProgressCenterSession,
  ProgressCenterSnapshot,
  ProgressCenterTask,
} from './progress-center.types';
import {
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
} from './progress-center.helpers';

@Injectable()
export class ProgressCenterService {
  public constructor(private readonly cortexService: CortexService) {}

  public getSnapshot(): ProgressCenterSnapshot | null {
    const sessions = this.cortexService.getSessions();
    const workers = this.cortexService.getWorkers({});
    const tasks = this.cortexService.getTasks({});
    const phaseTiming = this.cortexService.getPhaseTiming();
    const events = this.cortexService.getEventsSince(0);
    if (sessions === null || workers === null || tasks === null || phaseTiming === null || events === null) {
      return null;
    }

    const activeSessions = sessions.filter((session) => isSessionActive(session));
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const phaseAverages = buildPhaseAverages(phaseTiming);
    const sessionSnapshots = activeSessions.map((session) =>
      this.buildSessionSnapshot(session, workers, taskMap, phaseAverages, events),
    );

    return {
      generatedAt: new Date().toISOString(),
      health: this.buildHealth(sessionSnapshots, tasks, workers),
      sessions: sessionSnapshots,
      activity: this.buildActivity(events, activeSessions),
    };
  }

  private buildSessionSnapshot(
    session: CortexSession,
    workers: ReadonlyArray<CortexWorker>,
    taskMap: ReadonlyMap<string, CortexTask>,
    phaseAverages: ReadonlyMap<ProgressCenterPhaseKey, number>,
    events: ReadonlyArray<CortexEvent>,
  ): ProgressCenterSession {
    const sessionWorkers = workers.filter((worker) => worker.session_id === session.id);
    const sessionTaskIds = this.collectSessionTaskIds(session.id, sessionWorkers, events);
    const taskSnapshots = sessionTaskIds
      .map((taskId) => this.buildTaskSnapshot(taskId, sessionWorkers, taskMap.get(taskId), phaseAverages))
      .filter((task): task is ProgressCenterTask => task !== null)
      .sort((left, right) => right.progressPercent - left.progressPercent);
    const completedTasks = taskSnapshots.filter((task) => isTerminalTaskStatus(task.status)).length;
    const totalTasks = Math.max(taskSnapshots.length, completedTasks + new Set(sessionWorkers.map((worker) => worker.task_id)).size, 1);
    const progressPercent = Math.round((completedTasks / totalTasks) * 100);
    const stuckWorkers = sessionWorkers.filter((worker) => isWorkerStuck(worker, session)).length;
    const activeWorkers = sessionWorkers.filter((worker) => worker.status === 'running').length;
    const currentTask = taskSnapshots[0] ?? null;
    const etaMinutes = maxEta(taskSnapshots);

    return {
      sessionId: session.id,
      source: session.source,
      startedAt: session.started_at,
      status: sessionStatus(session, stuckWorkers),
      progressPercent,
      completedTasks,
      totalTasks,
      activeWorkers,
      stuckWorkers,
      elapsedMinutes: minutesBetween(session.started_at, new Date().toISOString()),
      etaMinutes,
      currentPhase: currentTask?.currentPhase ?? 'PM',
      currentTaskLabel: currentTask?.title ?? 'Waiting for worker activity',
      tasks: taskSnapshots,
    };
  }

  private buildTaskSnapshot(
    taskId: string,
    sessionWorkers: ReadonlyArray<CortexWorker>,
    task: CortexTask | undefined,
    phaseAverages: ReadonlyMap<ProgressCenterPhaseKey, number>,
  ): ProgressCenterTask | null {
    const trace = this.cortexService.getTaskTrace(taskId);
    if (trace === null) {
      return null;
    }
    const currentTaskPhase = currentPhase(trace, task?.status ?? 'IN_PROGRESS');
    const phases = phaseStates(currentTaskPhase, task?.status ?? 'IN_PROGRESS');
    const workerCount = sessionWorkers.filter((worker) => worker.task_id === taskId && worker.status === 'running').length;

    return {
      taskId,
      title: task?.title ?? taskId,
      status: task?.status ?? 'IN_PROGRESS',
      currentPhase: currentTaskPhase,
      progressPercent: progressPercent(phases, task?.status ?? 'IN_PROGRESS'),
      etaMinutes: remainingEta(phases, phaseAverages),
      workerCount,
      updatedAt: trace.events[trace.events.length - 1]?.created_at ?? null,
      phases,
    };
  }

  private collectSessionTaskIds(
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

  private buildHealth(
    sessions: ReadonlyArray<ProgressCenterSession>,
    tasks: ReadonlyArray<CortexTask>,
    workers: ReadonlyArray<CortexWorker>,
  ): ProgressCenterHealth {
    const activeWorkers = sessions.reduce((sum, session) => sum + session.activeWorkers, 0);
    const stuckWorkers = sessions.reduce((sum, session) => sum + session.stuckWorkers, 0);
    const failedTasks = tasks.filter((task) => task.status === 'FAILED').length;
    const retryingWorkers = workers.filter((worker) => worker.retry_number > 0 && worker.status === 'running').length;
    const tone = stuckWorkers > 0 || failedTasks > 0 ? 'critical' : retryingWorkers > 0 ? 'warning' : 'healthy';

    return {
      tone,
      activeSessions: sessions.length,
      activeWorkers,
      stuckWorkers,
      failedTasks,
      retryingWorkers,
    };
  }

  private buildActivity(events: ReadonlyArray<CortexEvent>, activeSessions: ReadonlyArray<CortexSession>): readonly ProgressCenterActivity[] {
    const activeSessionIds = new Set(activeSessions.map((session) => session.id));
    return events
      .filter((event) => activeSessionIds.has(event.session_id))
      .slice(-40)
      .reverse()
      .map((event) => ({
        id: event.id,
        sessionId: event.session_id,
        taskId: event.task_id,
        timestamp: event.created_at,
        eventType: event.event_type,
        source: event.source,
        summary: activitySummary(event),
        tone: activityTone(event.event_type),
      }));
  }
}
