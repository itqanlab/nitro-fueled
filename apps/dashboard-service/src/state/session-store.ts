import type { OrchestratorState, SessionData, SessionSummary } from '../events/event-types.js';

type LogEntry = { readonly timestamp: string; readonly source: string; readonly event: string };

export class SessionStore {
  private readonly sessions: Map<string, SessionData> = new Map();
  private readonly activeSessionIds: Set<string> = new Set();

  public getSessions(): ReadonlyArray<SessionSummary> {
    return Array.from(this.sessions.values())
      .map((data) => ({
        ...data.summary,
        isActive: this.activeSessionIds.has(data.summary.sessionId),
      }))
      .sort((a, b) => (a.sessionId > b.sessionId ? -1 : 1));
  }

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

  public getActiveSessions(): ReadonlyArray<SessionSummary> {
    return this.getSessions().filter((s) => s.isActive);
  }

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

  public setActiveSessionIds(ids: ReadonlyArray<string>): void {
    this.activeSessionIds.clear();
    for (const id of ids) {
      this.activeSessionIds.add(id);
    }
  }

  public removeSession(id: string): void {
    this.sessions.delete(id);
  }
}
