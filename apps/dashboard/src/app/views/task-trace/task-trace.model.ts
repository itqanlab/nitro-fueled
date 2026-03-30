/**
 * View-model interfaces for the Task Trace view.
 * These are the camelCase, UI-ready shapes derived from raw CortexXxx types.
 */

export interface WorkerRow {
  id: string;
  sessionId: string;
  taskId: string;
  workerType: string;
  label: string;
  status: string;
  model: string;
  provider: string;
  launcher: string;
  spawnTime: string;
  outcome: string | null;
  retryNumber: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  durationMin: number | null;
}

export interface PhaseRow {
  id: number;
  workerRunId: string;
  taskId: string;
  phase: string;
  model: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  inputTokens: number;
  outputTokens: number;
  outcome: string | null;
}

export interface ReviewRow {
  id: number;
  taskId: string;
  reviewType: string;
  score: number;
  findingsCount: number;
  criticalCount: number;
  modelThatBuilt: string;
  modelThatReviewed: string;
}

export interface FixCycleRow {
  id: number;
  taskId: string;
  fixesApplied: number;
  fixesSkipped: number;
  requiredManual: boolean;
  modelThatFixed: string;
}

export interface TimelineEvent {
  /** ISO timestamp. Null for entries where timing is unknown (e.g. reviews, fix cycles without timestamps). */
  time: string | null;
  label: string;
  type: 'worker' | 'phase' | 'review' | 'fix' | 'event';
  detail: string;
  cost?: number;
  tokens?: number;
}

export interface TaskTraceViewModel {
  taskId: string;
  workers: WorkerRow[];
  phases: PhaseRow[];
  reviews: ReviewRow[];
  fixCycles: FixCycleRow[];
  timelineEvents: TimelineEvent[];
}
