// Types migrated from dashboard-service/src/events/event-types.ts

export type TaskStatus =
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'FIXING'
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
  readonly model: string;
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
  readonly stuckCount: number;
  readonly lastHealth: string;
  readonly expectedEndState: string;
}

export interface CompletedTask {
  readonly taskId: string;
  readonly completedAt: string;
}

export interface FailedTask {
  readonly taskId: string;
  readonly reason: string;
  readonly retryCount: number;
}

export interface LogEntry {
  readonly timestamp: string;
  readonly event: string;
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
  readonly completedTasks: ReadonlyArray<CompletedTask>;
  readonly failedTasks: ReadonlyArray<FailedTask>;
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
  readonly sessionLog: ReadonlyArray<LogEntry>;
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
  readonly byModel: Record<string, number>;
  readonly completionRate: number;
  readonly activeWorkers: number;
  readonly totalCost: number;
  readonly totalTokens: number;
  readonly costByModel: Record<string, number>;
  readonly tokensByModel: Record<string, number>;
}

export interface SessionSummary {
  readonly sessionId: string;
  readonly isActive: boolean;
  readonly source: string;
  readonly started: string;
  readonly path: string;
  readonly taskCount: number;
  readonly loopStatus: string;
  readonly lastUpdated: string;
}

export interface SessionData {
  readonly summary: SessionSummary;
  readonly state: OrchestratorState | null;
  readonly log: ReadonlyArray<{ readonly timestamp: string; readonly source: string; readonly event: string }>;
}

export interface GraphNode {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly type: string;
  readonly priority: string;
  readonly isUnblocked: boolean;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface GraphData {
  readonly nodes: ReadonlyArray<GraphNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
}

export type DashboardEventType =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'task:state_changed'
  | 'worker:spawned'
  | 'worker:progress'
  | 'worker:completed'
  | 'worker:failed'
  | 'review:written'
  | 'plan:updated'
  | 'log:entry'
  | 'state:refreshed'
  | 'session:updated'
  | 'sessions:changed';

export interface DashboardEvent {
  readonly type: DashboardEventType;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}

export type PipelinePhaseStatus = 'pending' | 'active' | 'complete' | 'failed';

export interface PipelinePhase {
  readonly name: string;
  readonly status: PipelinePhaseStatus;
  readonly duration: string | null;
  readonly isParallel: boolean;
  readonly parallelParts: ReadonlyArray<string>;
}

export interface PipelineData {
  readonly taskId: string;
  readonly taskStatus: string;
  readonly phases: ReadonlyArray<PipelinePhase>;
  readonly totalDuration: string | null;
  readonly outcome: string | null;
}

export type WorkerHealth = 'healthy' | 'warning' | 'stuck';

export interface WorkerTreeNode {
  readonly workerId: string;
  readonly taskId: string;
  readonly label: string;
  readonly role: string;
  readonly workerType: string;
  readonly status: string;
  readonly health: WorkerHealth;
  readonly elapsedMs: number;
  readonly spawnTime: string;
  readonly stuckCount: number;
  readonly children: ReadonlyArray<WorkerTreeNode>;
}

export interface WorkerTree {
  readonly taskId: string;
  readonly roots: ReadonlyArray<WorkerTreeNode>;
}

export interface SessionAnalytics {
  readonly taskId: string;
  readonly outcome: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly duration: string;
  readonly phasesCompleted: ReadonlyArray<string>;
  readonly filesModified: number | null;
}

export interface SessionCostPoint {
  readonly sessionId: string;
  readonly date: string;
  readonly totalCost: number;
  readonly costByModel: Record<string, number>;
  readonly taskCount: number;
}

export interface EfficiencyPoint {
  readonly sessionId: string;
  readonly date: string;
  readonly avgDurationMinutes: number;
  readonly avgTokensPerTask: number;
  readonly retryRate: number;
  readonly failureRate: number;
  readonly avgReviewScore: number;
}

export interface ModelUsagePoint {
  readonly model: string;
  readonly totalCost: number;
  readonly taskCount: number;
  readonly tokenCount: number;
}

export interface SessionComparisonRow {
  readonly sessionId: string;
  readonly date: string;
  readonly taskCount: number;
  readonly durationMinutes: number;
  readonly totalCost: number;
  readonly failureCount: number;
  readonly avgReviewScore: number;
}

export interface AnalyticsCostData {
  readonly sessions: ReadonlyArray<SessionCostPoint>;
  readonly cumulativeCost: number;
  readonly hypotheticalOpusCost: number;
}

export interface AnalyticsEfficiencyData {
  readonly sessions: ReadonlyArray<EfficiencyPoint>;
}

export interface AnalyticsModelsData {
  readonly models: ReadonlyArray<ModelUsagePoint>;
  readonly totalCost: number;
  readonly hypotheticalOpusCost: number;
  readonly actualSavings: number;
}

export interface AnalyticsSessionsData {
  readonly sessions: ReadonlyArray<SessionComparisonRow>;
}

export type FileChangeEvent = 'add' | 'change' | 'unlink';
