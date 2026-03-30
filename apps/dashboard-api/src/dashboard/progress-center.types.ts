export type ProgressCenterHealthTone = 'healthy' | 'warning' | 'critical';
export type ProgressCenterActivityTone = 'info' | 'success' | 'warning' | 'error';
export type ProgressCenterSessionStatus = 'running' | 'warning' | 'stuck' | 'completed';
export type ProgressCenterPhaseKey = 'PM' | 'Architect' | 'Dev' | 'QA' | 'Review';
export type ProgressCenterPhaseState = 'complete' | 'active' | 'pending';

export interface ProgressCenterPhase {
  readonly key: ProgressCenterPhaseKey;
  readonly state: ProgressCenterPhaseState;
}

export interface ProgressCenterTask {
  readonly taskId: string;
  readonly title: string;
  readonly status: string;
  readonly currentPhase: ProgressCenterPhaseKey;
  readonly progressPercent: number;
  readonly etaMinutes: number | null;
  readonly workerCount: number;
  readonly updatedAt: string | null;
  readonly phases: readonly ProgressCenterPhase[];
}

export interface ProgressCenterSession {
  readonly sessionId: string;
  readonly source: string;
  readonly startedAt: string;
  readonly status: ProgressCenterSessionStatus;
  readonly progressPercent: number;
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly activeWorkers: number;
  readonly stuckWorkers: number;
  readonly elapsedMinutes: number;
  readonly etaMinutes: number | null;
  readonly currentPhase: ProgressCenterPhaseKey;
  readonly currentTaskLabel: string;
  readonly tasks: readonly ProgressCenterTask[];
}

export interface ProgressCenterHealth {
  readonly tone: ProgressCenterHealthTone;
  readonly activeSessions: number;
  readonly activeWorkers: number;
  readonly stuckWorkers: number;
  readonly failedTasks: number;
  readonly retryingWorkers: number;
}

export interface ProgressCenterActivity {
  readonly id: number;
  readonly sessionId: string;
  readonly taskId: string | null;
  readonly timestamp: string;
  readonly eventType: string;
  readonly source: string;
  readonly summary: string;
  readonly tone: ProgressCenterActivityTone;
}

export interface ProgressCenterSnapshot {
  readonly generatedAt: string;
  readonly health: ProgressCenterHealth;
  readonly sessions: readonly ProgressCenterSession[];
  readonly activity: readonly ProgressCenterActivity[];
}
