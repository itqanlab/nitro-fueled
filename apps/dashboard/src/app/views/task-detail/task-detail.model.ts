export interface StatusTransition {
  from: string;
  to: string;
  timestamp: string;
  duration: string | null;
}

export interface PhaseTimingEntry {
  phase: string;
  model: string;
  durationMinutes: number | null;
  inputTokens: number;
  outputTokens: number;
  outcome: string | null;
  startTime: string;
  endTime: string | null;
}

export interface WorkerEntry {
  id: string;
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
  sessionId: string;
}

export interface ReviewEntry {
  id: number;
  reviewType: string;
  score: number;
  findingsCount: number;
  criticalCount: number;
  modelThatBuilt: string;
  modelThatReviewed: string;
}

export interface EventEntry {
  id: number;
  eventType: string;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TaskDetailViewModel {
  taskId: string;
  title: string;
  type: string;
  priority: string;
  complexity: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  description: string;
  dependencies: string[];
  dependentTasks: string[];
  acceptanceCriteria: string[];
  fileScope: string[];
  statusTransitions: StatusTransition[];
  workers: WorkerEntry[];
  phases: PhaseTimingEntry[];
  reviews: ReviewEntry[];
  events: EventEntry[];
  completionReport: {
    filesCreated: string[];
    filesModified: string[];
    findingsFixed: string[];
    rootCause: string | null;
    fix: string | null;
    reviewScores: Array<{ review: string; score: string }>;
  } | null;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cortexAvailable: boolean;
  pipelineAvailable: boolean;
}
