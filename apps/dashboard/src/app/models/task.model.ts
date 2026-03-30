export type TaskStatus = 'running' | 'paused' | 'completed';
export type TaskType = 'FEATURE' | 'BUGFIX' | 'REFACTOR' | 'DOCS';
export type TaskPriority = 'high' | 'medium' | 'low';
export type PipelineStage = 'PM' | 'Arch' | 'TL' | 'Dev' | 'QA';
export type PipelineStageStatus = 'done' | 'active' | 'pending';

export interface PipelineStep {
  readonly stage: PipelineStage;
  readonly status: PipelineStageStatus;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly type: TaskType;
  readonly priority: TaskPriority;
  readonly autoRun: boolean;
  readonly agentLabel: string;
  readonly elapsedMinutes: number;
  readonly cost: number;
  readonly progressPercent: number;
  readonly tokensUsed: string;
  readonly completedAgo: string;
  readonly pipeline: readonly PipelineStep[];
}
