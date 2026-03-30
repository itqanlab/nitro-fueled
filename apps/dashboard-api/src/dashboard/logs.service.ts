import { Injectable } from '@nestjs/common';
import { CortexService } from './cortex.service';
import type { CortexEvent, CortexWorker, CortexPhase } from './cortex.types';

export interface LogEventFilters {
  sessionId?: string;
  taskId?: string;
  eventType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}

export interface LogSearchQuery {
  query: string;
  sessionId?: string;
  taskId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface SessionLogSummary {
  sessionId: string;
  eventCount: number;
  workerCount: number;
  taskIds: string[];
  startTime: string | null;
  lastActivity: string | null;
  events: CortexEvent[];
  workers: CortexWorker[];
  phases: CortexPhase[];
}

export interface WorkerLogEntry {
  worker: CortexWorker;
  phases: CortexPhase[];
  events: CortexEvent[];
}

export interface SearchResult {
  events: CortexEvent[];
  total: number;
  query: string;
}

@Injectable()
export class LogsService {
  public constructor(private readonly cortexService: CortexService) {}

  public getEvents(filters: LogEventFilters): CortexEvent[] | null {
    if (!this.cortexService.isAvailable()) return null;

    const allEvents = this.cortexService.getEventsSince(0);
    if (allEvents === null) return null;

    let filtered = allEvents;

    if (filters.sessionId) {
      filtered = filtered.filter((e) => e.session_id === filters.sessionId);
    }
    if (filters.taskId) {
      filtered = filtered.filter((e) => e.task_id === filters.taskId);
    }
    if (filters.eventType) {
      filtered = filtered.filter((e) =>
        e.event_type.toLowerCase().includes(filters.eventType!.toLowerCase()),
      );
    }
    if (filters.severity) {
      const sev = filters.severity.toLowerCase();
      filtered = filtered.filter((e) => {
        const dataStr = JSON.stringify(e.data).toLowerCase();
        const eventTypeLower = e.event_type.toLowerCase();
        if (sev === 'error' || sev === 'critical') {
          return dataStr.includes('error') || dataStr.includes('fail') || eventTypeLower.includes('fail') || eventTypeLower.includes('error');
        }
        if (sev === 'warning') {
          return dataStr.includes('warn') || eventTypeLower.includes('warn');
        }
        if (sev === 'info') {
          return !dataStr.includes('error') && !dataStr.includes('fail') && !dataStr.includes('warn');
        }
        return true;
      });
    }

    filtered.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeB - timeA;
    });

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 100;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Returns null when the Cortex DB is unavailable, undefined when the worker
   * is not found, and WorkerLogEntry when found.
   */
  public getWorkerLogs(workerId: string): WorkerLogEntry | null | undefined {
    if (!this.cortexService.isAvailable()) return null;

    const workers = this.cortexService.getWorkers({});
    if (workers === null) return null;

    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return undefined;

    const taskTrace = this.cortexService.getTaskTrace(worker.task_id);
    if (!taskTrace) {
      return { worker, phases: [], events: [] };
    }

    const phases = taskTrace.phases.filter(
      (p) => p.worker_run_id === workerId || p.task_id === worker.task_id,
    );
    const events = taskTrace.events.filter(
      (e) => e.task_id === worker.task_id,
    );

    return { worker, phases, events };
  }

  public getSessionLogs(sessionId: string): SessionLogSummary | null {
    if (!this.cortexService.isAvailable()) return null;

    const allEvents = this.cortexService.getEventsSince(0);
    if (allEvents === null) return null;

    const sessionEvents = allEvents.filter(
      (e) => e.session_id === sessionId,
    );

    const workers = this.cortexService.getWorkers({ sessionId });
    if (workers === null) return null;

    const taskIds = [...new Set(sessionEvents.map((e) => e.task_id).filter(Boolean) as string[])];

    const allPhases: CortexPhase[] = [];
    for (const taskId of taskIds) {
      const trace = this.cortexService.getTaskTrace(taskId);
      if (trace) {
        allPhases.push(...trace.phases);
      }
    }

    const sortedEvents = [...sessionEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    return {
      sessionId,
      eventCount: sessionEvents.length,
      workerCount: workers.length,
      taskIds,
      startTime: sortedEvents.length > 0 ? sortedEvents[0]!.created_at : null,
      lastActivity: sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1]!.created_at : null,
      events: sortedEvents,
      workers,
      phases: allPhases,
    };
  }

  public searchLogs(searchQuery: LogSearchQuery): SearchResult | null {
    if (!this.cortexService.isAvailable()) return null;

    const allEvents = this.cortexService.getEventsSince(0);
    if (allEvents === null) return null;

    const q = searchQuery.query.toLowerCase();

    let filtered = allEvents.filter((e) => {
      const searchable = [
        e.event_type,
        e.source,
        e.task_id ?? '',
        e.session_id,
        JSON.stringify(e.data),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });

    if (searchQuery.sessionId) {
      filtered = filtered.filter((e) => e.session_id === searchQuery.sessionId);
    }
    if (searchQuery.taskId) {
      filtered = filtered.filter((e) => e.task_id === searchQuery.taskId);
    }
    if (searchQuery.startTime) {
      const start = new Date(searchQuery.startTime).getTime();
      filtered = filtered.filter((e) => new Date(e.created_at).getTime() >= start);
    }
    if (searchQuery.endTime) {
      const end = new Date(searchQuery.endTime).getTime();
      filtered = filtered.filter((e) => new Date(e.created_at).getTime() <= end);
    }

    const total = filtered.length;

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const offset = searchQuery.offset ?? 0;
    const limit = searchQuery.limit ?? 50;

    return {
      events: filtered.slice(offset, offset + limit),
      total,
      query: searchQuery.query,
    };
  }
}
