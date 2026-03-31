import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CortexService } from './cortex.service';
import type { CortexSession, CortexWorker, CortexEvent, CortexTaskTrace } from './cortex.types';

export type SessionEndStatus = 'completed' | 'killed' | 'crashed' | 'running' | 'stopped';

export interface SessionHistoryListItem {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly endStatus: SessionEndStatus;
  readonly durationMinutes: number | null;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly tasksBlocked: number;
  readonly totalTasks: number;
  readonly totalCost: number;
  readonly models: readonly string[];
  readonly supervisorModel: string;
  readonly mode: string;
}

export interface SessionHistoryTaskResult {
  readonly taskId: string;
  readonly outcome: string;
  readonly cost: number;
  readonly durationMinutes: number | null;
  readonly model: string;
  readonly reviewScore: number | null;
}

export interface SessionHistoryTimelineEvent {
  readonly id: number;
  readonly type: string;
  readonly source: string;
  readonly timestamp: string;
  readonly description: string;
}

export interface SessionHistoryWorker {
  readonly id: string;
  readonly taskId: string;
  readonly workerType: string;
  readonly label: string;
  readonly status: string;
  readonly model: string;
  readonly provider: string;
  readonly cost: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface SessionHistoryDetail {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly endStatus: SessionEndStatus;
  readonly durationMinutes: number | null;
  readonly totalCost: number;
  readonly mode: string;
  readonly supervisorModel: string;
  readonly workerCount: number;
  readonly taskResults: readonly SessionHistoryTaskResult[];
  readonly timeline: readonly SessionHistoryTimelineEvent[];
  readonly workers: readonly SessionHistoryWorker[];
  readonly logContent: string | null;
}

@Injectable()
export class SessionsHistoryService {
  private readonly logger = new Logger(SessionsHistoryService.name);

  public constructor(private readonly cortexService: CortexService) {}

  public getSessionsList(): SessionHistoryListItem[] | null {
    const sessions = this.cortexService.getSessions();
    if (sessions === null) return null;

    const workers = this.cortexService.getWorkers() ?? [];

    return sessions.map((session) => this.mapToListItem(session, workers));
  }

  public async getSessionDetail(sessionId: string): Promise<SessionHistoryDetail | null> {
    const sessions = this.cortexService.getSessions();
    if (sessions === null) return null;

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const workers = (this.cortexService.getWorkers({ sessionId }) ?? []);
    const events = this.loadSessionEvents(sessionId);
    const taskResults = this.buildTaskResults(workers);
    const logContent = await this.readLogContent(sessionId);

    return {
      id: session.id,
      source: session.source,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      endStatus: this.deriveEndStatus(session),
      durationMinutes: this.computeDuration(session.started_at, session.ended_at),
      totalCost: session.total_cost,
      mode: session.mode,
      supervisorModel: session.supervisor_model,
      workerCount: workers.length,
      taskResults,
      timeline: events.map((e) => ({
        id: e.id,
        type: e.event_type,
        source: e.source,
        timestamp: e.created_at,
        description: this.describeEvent(e),
      })),
      workers: workers.map((w) => ({
        id: w.id,
        taskId: w.task_id,
        workerType: w.worker_type,
        label: w.label,
        status: w.status,
        model: w.model,
        provider: w.provider,
        cost: w.cost,
        inputTokens: w.input_tokens,
        outputTokens: w.output_tokens,
      })),
      logContent,
    };
  }

  private mapToListItem(session: CortexSession, allWorkers: CortexWorker[]): SessionHistoryListItem {
    const sessionWorkers = allWorkers.filter((w) => w.session_id === session.id);
    const uniqueTasks = new Set(sessionWorkers.map((w) => w.task_id));
    const totalTasks = uniqueTasks.size || session.tasks_terminal;

    const completedCount = new Set(
      sessionWorkers.filter((w) => w.status === 'completed' || w.outcome === 'COMPLETE').map((w) => w.task_id),
    ).size;
    const failedCount = new Set(
      sessionWorkers.filter((w) => w.status === 'failed' || w.outcome === 'FAILED').map((w) => w.task_id),
    ).size;
    const blockedCount = new Set(
      sessionWorkers.filter((w) => w.outcome === 'BLOCKED').map((w) => w.task_id),
    ).size;

    const models = [...new Set(sessionWorkers.map((w) => w.model).filter(Boolean))];

    return {
      id: session.id,
      source: session.source,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      endStatus: this.deriveEndStatus(session),
      durationMinutes: this.computeDuration(session.started_at, session.ended_at),
      tasksCompleted: completedCount,
      tasksFailed: failedCount,
      tasksBlocked: blockedCount,
      totalTasks,
      totalCost: session.total_cost,
      models,
      supervisorModel: session.supervisor_model,
      mode: session.mode,
    };
  }

  private deriveEndStatus(session: CortexSession): SessionEndStatus {
    if (session.loop_status === 'running') return 'running';
    if (session.ended_at === null) return 'running';
    if (session.loop_status === 'stopped' && session.drain_requested) return 'stopped';
    if (session.loop_status === 'stopped') return 'completed';
    if (session.loop_status === 'crashed') return 'crashed';
    return 'completed';
  }

  private computeDuration(startedAt: string, endedAt: string | null): number | null {
    if (!endedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return Math.round((end - start) / 60000);
  }

  private loadSessionEvents(sessionId: string): CortexEvent[] {
    const allEvents = this.cortexService.getEventsSince(0);
    if (allEvents === null) return [];
    return allEvents.filter((e) => e.session_id === sessionId);
  }

  private buildTaskResults(workers: CortexWorker[]): SessionHistoryTaskResult[] {
    const taskMap = new Map<string, { outcome: string; cost: number; model: string }>();
    for (const w of workers) {
      const existing = taskMap.get(w.task_id);
      if (!existing) {
        taskMap.set(w.task_id, {
          outcome: w.outcome ?? w.status ?? 'UNKNOWN',
          cost: w.cost,
          model: w.model,
        });
      } else {
        existing.cost += w.cost;
      }
    }

    const taskTraces = this.gatherTaskTraces([...taskMap.keys()]);

    return [...taskMap.entries()].map(([taskId, data]) => {
      const trace = taskTraces.get(taskId);
      let reviewScore: number | null = null;
      let durationMinutes: number | null = null;
      if (trace) {
        if (trace.reviews.length > 0) {
          const sum = trace.reviews.reduce((s, r) => s + r.score, 0);
          reviewScore = Math.round((sum / trace.reviews.length) * 10) / 10;
        }
        if (trace.phases.length > 0) {
          const totalMin = trace.phases.reduce((s, p) => s + (p.duration_minutes ?? 0), 0);
          durationMinutes = Math.round(totalMin * 10) / 10;
        }
      }
      return {
        taskId,
        outcome: data.outcome,
        cost: Math.round(data.cost * 10000) / 10000,
        durationMinutes,
        model: data.model,
        reviewScore,
      };
    });
  }

  private gatherTaskTraces(taskIds: string[]): Map<string, CortexTaskTrace> {
    const traces = new Map<string, CortexTaskTrace>();
    for (const taskId of taskIds) {
      const trace = this.cortexService.getTaskTrace(taskId);
      if (trace) traces.set(taskId, trace);
    }
    return traces;
  }

  private describeEvent(event: CortexEvent): string {
    const data = event.data ?? {};
    const parts: string[] = [event.event_type];
    if (data.message && typeof data.message === 'string') {
      parts.push(data.message);
    } else if (data.task_id && typeof data.task_id === 'string') {
      parts.push(data.task_id);
    } else if (data.worker_id && typeof data.worker_id === 'string') {
      parts.push(data.worker_id);
    }
    return parts.join(' — ');
  }

  private async readLogContent(sessionId: string): Promise<string | null> {
    const projectRoot = process.cwd();
    const candidates = [
      join(projectRoot, 'task-tracking', 'sessions', sessionId, 'log.md'),
      join(projectRoot, '.nitro', 'sessions', sessionId, 'log.md'),
    ];
    for (const filePath of candidates) {
      try {
        const content = await readFile(filePath, 'utf-8');
        if (content.trim()) return content;
      } catch {
        continue;
      }
    }
    return null;
  }
}
