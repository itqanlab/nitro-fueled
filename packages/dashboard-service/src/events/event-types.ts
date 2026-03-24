export type TaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'COMPLETE'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED';

export type TaskType =
  | 'FEATURE'
  | 'BUGFIX'
  | 'REFACTORING'
  | 'DOCUMENTATION'
  | 'RESEARCH'
  | 'DEVOPS'
  | 'CREATIVE';

export type TaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';

export type WorkerType = 'Build' | 'Review';

export type WorkerStatus = 'running' | 'completed' | 'failed' | 'killed';

export type ReviewSeverity = 'critical' | 'serious' | 'moderate' | 'minor' | 'info';

export interface TaskRecord {
  readonly id: string;
  readonly status: TaskStatus;
  readonly type: string;
  readonly description: string;
  readonly created: string;
}

export interface TaskDefinition {
  readonly title: string;
  readonly type: TaskType;
  readonly priority: TaskPriority;
  readonly complexity: string;
  readonly description: string;
  readonly dependencies: ReadonlyArray<string>;
  readonly acceptanceCriteria: ReadonlyArray<string>;
  readonly references: ReadonlyArray<string>;
}

export interface PlanPhase {
  readonly name: string;
  readonly status: string;
  readonly description: string;
  readonly milestones: ReadonlyArray<string>;
  readonly taskMap: ReadonlyArray<{
    readonly taskId: string;
    readonly title: string;
    readonly status: string;
    readonly priority: string;
  }>;
}

export interface PlanData {
  readonly overview: string;
  readonly phases: ReadonlyArray<PlanPhase>;
  readonly currentFocus: {
    readonly activePhase: string;
    readonly activeMilestone: string;
    readonly nextPriorities: ReadonlyArray<string>;
    readonly supervisorGuidance: string;
    readonly guidanceNote: string;
  };
  readonly decisions: ReadonlyArray<{
    readonly date: string;
    readonly decision: string;
    readonly rationale: string;
  }>;
}

export interface ActiveWorker {
  readonly workerId: string;
  readonly taskId: string;
  readonly workerType: string;
  readonly label: string;
  readonly status: string;
  readonly spawnTime: string;
  readonly lastHealth: string;
  readonly stuckCount: number;
  readonly expectedEndState: string;
}

export interface OrchestratorState {
  readonly loopStatus: string;
  readonly lastUpdated: string;
  readonly sessionStarted: string;
  readonly configuration: {
    readonly concurrencyLimit: number;
    readonly monitoringInterval: string;
    readonly retryLimit: number;
  };
  readonly activeWorkers: ReadonlyArray<ActiveWorker>;
  readonly completedTasks: ReadonlyArray<{
    readonly taskId: string;
    readonly completedAt: string;
  }>;
  readonly failedTasks: ReadonlyArray<{
    readonly taskId: string;
    readonly reason: string;
    readonly retryCount: number;
  }>;
  readonly taskQueue: ReadonlyArray<{
    readonly taskId: string;
    readonly priority: string;
    readonly type: string;
    readonly workerType: string;
  }>;
  readonly retryTracker: ReadonlyArray<{
    readonly taskId: string;
    readonly retryCount: number;
  }>;
  readonly sessionLog: ReadonlyArray<{
    readonly timestamp: string;
    readonly event: string;
  }>;
  readonly compactionCount: number;
}

export interface ReviewFinding {
  readonly question: string;
  readonly content: string;
}

export interface ReviewData {
  readonly taskId: string;
  readonly reviewType: string;
  readonly overallScore: string;
  readonly assessment: string;
  readonly criticalIssues: number;
  readonly seriousIssues: number;
  readonly moderateIssues: number;
  readonly findings: ReadonlyArray<ReviewFinding>;
}

export interface CompletionReport {
  readonly taskId: string;
  readonly filesCreated: ReadonlyArray<string>;
  readonly filesModified: ReadonlyArray<string>;
  readonly reviewScores: ReadonlyArray<{
    readonly review: string;
    readonly score: string;
  }>;
  readonly findingsFixed: ReadonlyArray<string>;
  readonly findingsAcknowledged: ReadonlyArray<string>;
  readonly rootCause: string;
  readonly fix: string;
}

export interface AntiPatternRule {
  readonly category: string;
  readonly rules: ReadonlyArray<string>;
}

export interface LessonEntry {
  readonly domain: string;
  readonly category: string;
  readonly rules: ReadonlyArray<string>;
}

export interface FullTaskData {
  readonly definition: TaskDefinition | null;
  readonly registryRecord: TaskRecord | null;
  readonly reviews: ReadonlyArray<ReviewData>;
  readonly completionReport: CompletionReport | null;
}

export interface DashboardStats {
  readonly totalTasks: number;
  readonly byStatus: Record<string, number>;
  readonly byType: Record<string, number>;
  readonly completionRate: number;
  readonly activeWorkers: number;
}

export type DashboardEventType =
  | 'task:created'
  | 'task:updated'
  | 'task:state_changed'
  | 'worker:spawned'
  | 'worker:progress'
  | 'worker:completed'
  | 'worker:failed'
  | 'review:written'
  | 'plan:updated'
  | 'log:entry'
  | 'state:refreshed';

export interface DashboardEvent {
  readonly type: DashboardEventType;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}
