import { Injectable, Logger } from '@nestjs/common';
import type {
  SessionData,
  SessionSummary,
  OrchestratorState,
  LogEntry,
} from './dashboard.types';

/**
 * SessionsService manages session state data.
 * Migrated from dashboard-service/src/state/session-store.ts and session-id.ts.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly sessions: Map<string, SessionData> = new Map();
  private readonly activeSessionIds: Set<string> = new Set();

  /**
   * Extract session ID from a file path.
   * Migrated from session-id.ts.
   */
  public extractSessionId(filePath: string): string | null {
    return filePath.match(/SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/)?.[0] ?? null;
  }

  /**
   * Get all sessions sorted by ID descending.
   */
  public getSessions(): ReadonlyArray<SessionSummary> {
    return Array.from(this.sessions.values())
      .map((data) => ({
        ...data.summary,
        isActive: this.activeSessionIds.has(data.summary.sessionId),
      }))
      .sort((a, b) => (a.sessionId > b.sessionId ? -1 : 1));
  }

  /**
   * Get a single session by ID.
   */
  public getSession(id: string): SessionData | null {
    const data = this.sessions.get(id);
    if (!data) return null;
    return {
      ...data,
      summary: {
        ...data.summary,
        isActive: this.activeSessionIds.has(id),
      },
    };
  }

  /**
   * Get all active sessions.
   */
  public getActiveSessions(): ReadonlyArray<SessionSummary> {
    return this.getSessions().filter((s) => s.isActive);
  }

  /**
   * Set session state from orchestrator state.
   */
  public setSessionState(id: string, state: OrchestratorState): void {
    const existing = this.sessions.get(id);
    const existingSummary = existing?.summary;

    const taskCount =
      state.completedTasks.length +
      state.failedTasks.length +
      state.activeWorkers.length +
      state.taskQueue.length;

    const summary: SessionSummary = {
      sessionId: id,
      isActive: this.activeSessionIds.has(id),
      source: existingSummary?.source ?? 'unknown',
      started: state.sessionStarted !== '' ? state.sessionStarted : (existingSummary?.started ?? ''),
      path: existingSummary?.path ?? '',
      taskCount,
      loopStatus: state.loopStatus,
      lastUpdated: state.lastUpdated,
    };

    this.sessions.set(id, {
      summary,
      state,
      log: existing?.log ?? [],
    });
  }

  /**
   * Set session log entries.
   */
  public setSessionLog(id: string, log: ReadonlyArray<LogEntry>): void {
    const existing = this.sessions.get(id);

    if (existing) {
      this.sessions.set(id, { ...existing, log });
      return;
    }

    const summary: SessionSummary = {
      sessionId: id,
      isActive: this.activeSessionIds.has(id),
      source: 'unknown',
      started: '',
      path: '',
      taskCount: 0,
      loopStatus: 'UNKNOWN',
      lastUpdated: '',
    };

    this.sessions.set(id, { summary, state: null, log });
  }

  /**
   * Set the list of active session IDs.
   */
  public setActiveSessionIds(ids: ReadonlyArray<string>): void {
    this.activeSessionIds.clear();
    for (const id of ids) {
      this.activeSessionIds.add(id);
    }
  }

  /**
   * Remove a session by ID.
   */
  public removeSession(id: string): void {
    this.sessions.delete(id);
  }

  /**
   * Get enhanced active sessions with mock task and phase data.
   */
  public getActiveSessionsEnhanced(): ReadonlyArray<{
    sessionId: string;
    taskId: string;
    taskTitle: string;
    startedAt: string;
    currentPhase: 'PM' | 'Architect' | 'Team-Leader' | 'Dev' | 'QA';
    status: 'running' | 'idle' | 'completed' | 'failed';
    lastActivity: string;
    duration: string;
  }> {
    const activeSessions = this.getSessions().filter(s => s.isActive);
    const phases: Array<'PM' | 'Architect' | 'Team-Leader' | 'Dev' | 'QA'> = ['PM', 'Architect', 'Team-Leader', 'Dev', 'QA'];
    const statuses: Array<'running' | 'idle' | 'completed' | 'failed'> = ['running', 'idle', 'completed', 'failed'];

    return activeSessions.map(session => {
      const started = new Date(session.started);
      const now = new Date();
      const diffMs = now.getTime() - started.getTime();
      const duration = this.formatDuration(diffMs);

      return {
        sessionId: session.sessionId,
        taskId: `TASK_${session.sessionId.slice(8, 12)}_${session.sessionId.slice(13, 16)}`,
        taskTitle: `Auto-pilot session for ${session.source}`,
        startedAt: session.started,
        currentPhase: phases[Math.floor(Math.random() * phases.length)],
        status: session.loopStatus === 'RUNNING' ? 'running' : statuses[Math.floor(Math.random() * statuses.length)],
        lastActivity: `Processing task ${session.taskCount} items`,
        duration,
      };
    });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
