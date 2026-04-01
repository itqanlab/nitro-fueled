/**
 * Dashboard API types — local copy of types shared between dashboard and dashboard-api.
 * Kept in the dashboard app to avoid cross-app imports that break build isolation.
 */

// ── Task types ───────────────────────────────────────────────────────────────

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
  | 'OPS'
  | 'CREATIVE'
  | 'CONTENT'
  | 'SOCIAL'
  | 'DESIGN';

export type TaskPriority = 'P0-Critical' | 'P1-High' | 'P2-Medium' | 'P3-Low';

export type TaskComplexity = 'Low' | 'Medium' | 'High';

export interface TaskRecord {
  readonly id: string;
  readonly status: TaskStatus;
  readonly type: TaskType;
  readonly description: string;
  readonly created: string;
  readonly model: string;
}

export interface TaskDefinition {
  readonly title: string;
  readonly type: TaskType;
  readonly priority: TaskPriority;
  readonly complexity: TaskComplexity;
  readonly description: string;
  readonly dependencies: ReadonlyArray<string>;
  readonly acceptanceCriteria: ReadonlyArray<string>;
  readonly references: ReadonlyArray<string>;
}

// ── Plan types ───────────────────────────────────────────────────────────────

export interface PlanPhase {
  readonly name: string;
  readonly status: string;
  readonly description: string;
  readonly milestones: ReadonlyArray<string>;
  readonly taskMap: ReadonlyArray<{
    readonly taskId: string;
    readonly title: string;
    readonly status: TaskStatus;
    readonly priority: TaskPriority;
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

// ── Worker types ─────────────────────────────────────────────────────────────

export type WorkerType = 'Build' | 'Review';
export type WorkerStatus = 'running' | 'completed' | 'failed' | 'killed';
export type WorkerHealth = 'healthy' | 'warning' | 'stuck';

export interface ActiveWorker {
  readonly workerId: string;
  readonly taskId: string;
  readonly workerType: WorkerType;
  readonly label: string;
  readonly status: WorkerStatus;
  readonly spawnTime: string;
  readonly stuckCount: number;
  readonly lastHealth: string;
  readonly expectedEndState: string;
  readonly cost?: number;
  readonly tokens?: number;
  readonly model?: string;
}

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

// ── Orchestrator state ───────────────────────────────────────────────────────

export interface LogEntry {
  readonly timestamp: string;
  readonly source: string;
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
  readonly completedTasks: ReadonlyArray<{ readonly taskId: string; readonly completedAt: string }>;
  readonly failedTasks: ReadonlyArray<{ readonly taskId: string; readonly reason: string; readonly retryCount: number }>;
  readonly taskQueue: ReadonlyArray<{
    readonly taskId: string;
    readonly priority: string;
    readonly type: string;
    readonly workerType: string;
  }>;
  readonly retryTracker: ReadonlyArray<{ readonly taskId: string; readonly retryCount: number }>;
  readonly sessionLog: ReadonlyArray<LogEntry>;
  readonly compactionCount: number;
}

// ── Review types ─────────────────────────────────────────────────────────────

export type ReviewSeverity = 'critical' | 'serious' | 'moderate' | 'minor' | 'info';

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
  readonly reviewScores: ReadonlyArray<{ readonly review: string; readonly score: string }>;
  readonly findingsFixed: ReadonlyArray<string>;
  readonly findingsAcknowledged: ReadonlyArray<string>;
  readonly rootCause: string;
  readonly fix: string;
}

export interface FullTaskData {
  readonly definition: TaskDefinition | null;
  readonly registryRecord: TaskRecord | null;
  readonly reviews: ReadonlyArray<ReviewData>;
  readonly completionReport: CompletionReport | null;
}

// ── Dashboard stats ──────────────────────────────────────────────────────────

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
  readonly recentSessions: ReadonlyArray<{
    readonly sessionId: string;
    readonly date: string;
    readonly tokens: number;
    readonly cost: number;
  }>;
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

// ── Session types ────────────────────────────────────────────────────────────

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
  readonly log: ReadonlyArray<LogEntry>;
}

// ── Auto-pilot / Session types ────────────────────────────────────────────────

export type ProviderType = 'claude' | 'glm' | 'opencode' | 'codex';
export type PriorityStrategy = 'build-first' | 'review-first' | 'balanced';
export type LoopStatus = 'running' | 'paused' | 'stopped';

export interface SupervisorConfig {
  readonly concurrency: number;
  readonly limit: number;
  readonly prep_provider: ProviderType;
  readonly prep_model: string;
  readonly implement_provider: ProviderType;
  readonly implement_model: string;
  readonly implement_fallback_provider: ProviderType;
  readonly implement_fallback_model: string;
  readonly review_provider: ProviderType;
  readonly review_model: string;
  readonly priority: PriorityStrategy;
  readonly retries: number;
  readonly poll_interval_ms: number;
  readonly working_directory: string;
}

export interface CreateSessionRequest {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly prepProvider?: ProviderType;
  readonly prepModel?: string;
  readonly implementProvider?: ProviderType;
  readonly implementModel?: string;
  readonly implementFallbackProvider?: ProviderType;
  readonly implementFallbackModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
  readonly supervisorModel?: string;
  readonly maxCompactions?: number;
  readonly pollIntervalMs?: number;
  readonly dryRun?: boolean;
}

export interface CreateSessionResponse {
  readonly sessionId: string;
  readonly status: 'starting';
}

export interface UpdateSessionConfigRequest {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly prepProvider?: ProviderType;
  readonly prepModel?: string;
  readonly implementProvider?: ProviderType;
  readonly implementModel?: string;
  readonly implementFallbackProvider?: ProviderType;
  readonly implementFallbackModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
  readonly pollIntervalMs?: number;
}

export interface UpdateSessionConfigResponse {
  readonly sessionId: string;
  readonly config: SupervisorConfig;
}

export interface SessionStatusResponse {
  readonly sessionId: string;
  readonly loopStatus: LoopStatus;
  readonly config: SupervisorConfig;
  readonly workers: {
    readonly active: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly tasks: {
    readonly completed: number;
    readonly failed: number;
    readonly inProgress: number;
    readonly remaining: number;
  };
  readonly startedAt: string;
  readonly uptimeMinutes: number;
  readonly lastHeartbeat: string;
  readonly drainRequested: boolean;
}

export interface SessionActionResponse {
  readonly sessionId: string;
  readonly action: 'stopped' | 'paused' | 'resumed' | 'draining';
}

export interface ListSessionsResponse {
  readonly sessions: ReadonlyArray<SessionStatusResponse>;
}

// ── Graph types ──────────────────────────────────────────────────────────────

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

// ── Event types ──────────────────────────────────────────────────────────────

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
  | 'sessions:changed'
  | 'session:update';

export interface DashboardEvent {
  readonly type: DashboardEventType;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}

// ── Pipeline types ───────────────────────────────────────────────────────────

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

// ── Analytics types ──────────────────────────────────────────────────────────

export interface SessionCostPoint {
  readonly sessionId: string;
  readonly date: string;
  readonly totalCost: number;
  readonly costByModel: Record<string, number>;
  readonly taskCount: number;
}

export interface ModelUsagePoint {
  readonly model: string;
  readonly totalCost: number;
  readonly taskCount: number;
  readonly tokenCount: number;
}

export interface AnalyticsCostData {
  readonly sessions: ReadonlyArray<SessionCostPoint>;
  readonly cumulativeCost: number;
  readonly hypotheticalOpusCost: number;
}

export interface AnalyticsEfficiencyData {
  readonly sessions: ReadonlyArray<{
    readonly sessionId: string;
    readonly date: string;
    readonly avgDurationMinutes: number;
    readonly avgTokensPerTask: number;
    readonly retryRate: number;
    readonly failureRate: number;
    readonly avgReviewScore: number;
  }>;
}

export interface AnalyticsModelsData {
  readonly models: ReadonlyArray<ModelUsagePoint>;
  readonly totalCost: number;
  readonly hypotheticalOpusCost: number;
  readonly actualSavings: number;
}

export interface AnalyticsSessionsData {
  readonly sessions: ReadonlyArray<{
    readonly sessionId: string;
    readonly date: string;
    readonly taskCount: number;
    readonly durationMinutes: number;
    readonly totalCost: number;
    readonly failureCount: number;
    readonly avgReviewScore: number;
  }>;
}

// ── Orchestration flow types ─────────────────────────────────────────────────

export interface OrchestrationFlowPhase {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isOptional: boolean;
  readonly outputs: readonly string[];
}

export interface OrchestrationFlow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly taskTypes: readonly string[];
  readonly phases: readonly OrchestrationFlowPhase[];
  readonly hasParallelReview: boolean;
  readonly strategy: string;
}

export interface CustomFlowPhase {
  readonly order: number;
  readonly agentName: string;
  readonly agentTitle: string;
  readonly optional: boolean;
  readonly estimatedDuration: number;
  readonly deliverables: readonly string[];
}

export interface CustomFlow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly source_flow_id: string | null;
  readonly phases: readonly CustomFlowPhase[];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CreateCustomFlowRequest {
  name: string;
  description?: string;
  sourceFlowId?: string;
  phases?: CustomFlowPhase[];
}

export interface UpdateCustomFlowRequest {
  name?: string;
  description?: string;
  phases?: CustomFlowPhase[];
}

// ── Cortex types ─────────────────────────────────────────────────────────────

export interface CortexTask {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly priority: string;
  readonly status: string;
  readonly complexity: string;
  readonly dependencies: string[];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CortexTaskContext extends CortexTask {
  readonly description: string;
  readonly acceptance_criteria: string;
  readonly file_scope: string[];
  readonly model: string | null;
  readonly preferred_provider: string | null;
  readonly worker_mode: string | null;
  readonly custom_flow_id?: string | null;
}

export interface CortexSession {
  readonly id: string;
  readonly source: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly loop_status: string;
  readonly tasks_terminal: number;
  readonly supervisor_model: string;
  readonly supervisor_launcher: string;
  readonly mode: string;
  readonly total_cost: number;
  readonly total_input_tokens: number;
  readonly total_output_tokens: number;
  readonly last_heartbeat: string | null;
}

export interface CortexSessionWorker {
  readonly id: string;
  readonly task_id: string;
  readonly worker_type: string;
  readonly label: string;
  readonly status: string;
  readonly model: string;
  readonly cost: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
}

export interface CortexSessionSummary extends CortexSession {
  readonly workers: CortexSessionWorker[];
}

export interface CortexWorker {
  readonly id: string;
  readonly session_id: string;
  readonly task_id: string;
  readonly worker_type: string;
  readonly label: string;
  readonly status: string;
  readonly model: string;
  readonly provider: string;
  readonly launcher: string;
  readonly spawn_time: string;
  readonly outcome: string | null;
  readonly retry_number: number;
  readonly cost: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
}

export interface CortexPhase {
  id: number;
  worker_run_id: string;
  task_id: string;
  phase: string;
  model: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  input_tokens: number;
  output_tokens: number;
  outcome: string | null;
}

export interface CortexReview {
  id: number;
  task_id: string;
  review_type: string;
  score: number;
  findings_count: number;
  critical_count: number;
  model_that_built: string;
  model_that_reviewed: string;
}

export interface CortexFixCycle {
  id: number;
  task_id: string;
  fixes_applied: number;
  fixes_skipped: number;
  required_manual: boolean;
  model_that_fixed: string;
}

export interface CortexEvent {
  id: number;
  session_id: string;
  task_id: string | null;
  source: string;
  event_type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface CortexTaskTrace {
  task_id: string;
  workers: CortexWorker[];
  phases: CortexPhase[];
  reviews: CortexReview[];
  fix_cycles: CortexFixCycle[];
  events: CortexEvent[];
}

export interface CortexModelPerformance {
  model: string;
  task_type: string | null;
  complexity: string | null;
  phase_count: number;
  review_count: number;
  avg_duration_minutes: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  avg_review_score: number | null;
  avg_cost_usd: number | null;
  failure_rate: number | null;
  last_run: string | null;
}

export interface CortexPhaseTiming {
  phase: string;
  count: number;
  avg_duration_minutes: number | null;
  min_duration_minutes: number | null;
  max_duration_minutes: number | null;
}

// ── Analytics Module types (TASK_2026_216 endpoints) ─────────────────────────

/** One row from GET /api/analytics/model-performance. */
export interface AnalyticsModelPerfRow {
  readonly model: string;
  readonly taskType: string | null;
  readonly phaseCount: number;
  readonly reviewCount: number;
  readonly avgDurationMinutes: number | null;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  /** Average score given by this model when acting as a reviewer (0–10). */
  readonly avgReviewScore: number | null;
}

export interface AnalyticsModelPerfResponse {
  readonly data: readonly AnalyticsModelPerfRow[];
  readonly total: number;
}

/** Aggregated metrics for one launcher. */
export interface AnalyticsLauncherMetrics {
  readonly launcher: string;
  readonly totalWorkers: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly completionRate: number;
  readonly totalCost: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
}

export interface AnalyticsLauncherMetricsResponse {
  readonly data: readonly AnalyticsLauncherMetrics[];
  readonly total: number;
}

/** One routing recommendation from GET /api/analytics/routing-recommendations. */
export interface AnalyticsRoutingRecommendation {
  readonly taskType: string;
  readonly recommendedModel: string;
  readonly reason: string;
  readonly avgBuilderScore: number | null;
  readonly avgDurationMinutes: number | null;
  readonly evidenceCount: number;
}

export interface AnalyticsRoutingRecommendationsResponse {
  readonly recommendations: readonly AnalyticsRoutingRecommendation[];
  readonly total: number;
}

// ── Provider Quota types ──────────────────────────────────────────────────────

export type ProviderId = 'glm' | 'anthropic' | 'openai';

export interface ProviderQuotaAvailable {
  readonly provider: ProviderId;
  readonly unavailable: false;
  readonly plan: string;
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAt: string | null;
  readonly currency: string;
  readonly costThisPeriod: number;
}

export interface ProviderQuotaUnavailable {
  readonly provider: ProviderId;
  readonly unavailable: true;
  readonly reason: string;
}

export type ProviderQuotaItem = ProviderQuotaAvailable | ProviderQuotaUnavailable;

// ── Logs types ─────────────────────────────────────────────────────────────────

export interface LogsEventFilters {
  readonly sessionId?: string;
  readonly taskId?: string;
  readonly eventType?: string;
  readonly severity?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkerLogEntry {
  readonly worker: CortexWorker;
  readonly phases: readonly CortexPhase[];
  readonly events: readonly CortexEvent[];
}

export interface SessionLogSummary {
  readonly sessionId: string;
  readonly eventCount: number;
  readonly workerCount: number;
  readonly taskIds: readonly string[];
  readonly startTime: string | null;
  readonly lastActivity: string | null;
  readonly events: readonly CortexEvent[];
  readonly workers: readonly CortexWorker[];
  readonly phases: readonly CortexPhase[];
}

export interface LogSearchResult {
  readonly events: readonly CortexEvent[];
  readonly total: number;
  readonly query: string;
}

// Task creation API types
export type TaskCreationComplexity = 'Simple' | 'Medium' | 'Complex';

export interface CreateTaskOverrides {
  type?: TaskType;
  priority?: TaskPriority;
  complexity?: TaskCreationComplexity;
  model?: string;
  dependencies?: string[];
}

export interface CreateTaskRequest {
  description: string;
  overrides?: CreateTaskOverrides;
}

export interface CreatedTask {
  taskId: string;
  title: string;
  status: 'CREATED';
  folder: string;
}

export interface CreateTaskResponse {
  tasks: CreatedTask[];
  autoSplit?: boolean;
}

// ── Command Console types ────────────────────────────────────────────────────

export interface CommandCatalogEntry {
  readonly name: string;
  readonly slashCommand: string;
  readonly description: string;
  readonly category: string;
  readonly args?: readonly string[];
}

export interface CommandSuggestion {
  readonly command: string;
  readonly label: string;
  readonly reason: string;
}

export interface CommandExecuteRequest {
  readonly command: string;
  readonly args?: Record<string, unknown>;
}

export interface CommandExecuteResult {
  readonly success: boolean;
  readonly output: string;
  readonly data?: Record<string, unknown>;
}

export type SessionEndStatus = 'completed' | 'killed' | 'crashed' | 'running' | 'stopped';

export interface SessionHistoryListItem {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly endStatus: SessionEndStatus;
  readonly durationMinutes: number | null;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly tasksBlocked: number;
  readonly totalTasks: number;
  readonly totalCost: number;
  readonly models: readonly string[];
  readonly supervisorModel: string;
  readonly mode: string;
}

export interface SessionHistoryTaskResult {
  readonly taskId: string;
  readonly outcome: string;
  readonly cost: number;
  readonly durationMinutes: number | null;
  readonly model: string;
  readonly reviewScore: number | null;
}

export interface SessionHistoryTimelineEvent {
  readonly id: number;
  readonly type: string;
  readonly source: string;
  readonly timestamp: string;
  readonly description: string;
}

export interface SessionHistoryWorker {
  readonly id: string;
  readonly taskId: string;
  readonly workerType: string;
  readonly label: string;
  readonly status: string;
  readonly model: string;
  readonly provider: string;
  readonly cost: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface SessionHistoryDetail {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly endStatus: SessionEndStatus;
  readonly durationMinutes: number | null;
  readonly totalCost: number;
  readonly mode: string;
  readonly supervisorModel: string;
  readonly workerCount: number;
  readonly taskResults: readonly SessionHistoryTaskResult[];
  readonly timeline: readonly SessionHistoryTimelineEvent[];
  readonly workers: readonly SessionHistoryWorker[];
  readonly logContent: string | null;
  readonly drainRequested: boolean;
}




