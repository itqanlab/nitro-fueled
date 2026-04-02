export type SessionStatus = 'running' | 'idle' | 'completed' | 'failed';
export type SessionPhase = 'PM' | 'Architect' | 'Team-Leader' | 'Dev' | 'QA';

export interface ActiveSessionSummary {
  readonly sessionId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly startedAt: string;
  readonly currentPhase: SessionPhase;
  readonly status: SessionStatus;
  readonly lastActivity: string;
  readonly duration: string;
}

export interface SessionDetail extends ActiveSessionSummary {
  readonly messages: Array<{
    readonly timestamp: string;
    readonly type: string;
    readonly content: string;
  }>;
}
