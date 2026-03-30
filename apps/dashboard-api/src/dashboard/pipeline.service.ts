import { Injectable, Logger } from '@nestjs/common';
import type {
  TaskRecord,
  OrchestratorState,
  TaskDefinition,
  ReviewData,
  CompletionReport,
  AntiPatternRule,
  LessonEntry,
  FullTaskData,
  DashboardStats,
  GraphData,
  GraphNode,
  GraphEdge,
  SessionAnalytics,
  PipelineData,
  PipelinePhase,
  PipelinePhaseStatus,
  WorkerTree,
  PlanData,
  DashboardEvent,
} from './dashboard.types';
import { DiffService } from './diff.service';
import { WorkerTreeService } from './worker-tree.service';

const PHASE_ORDER: ReadonlyArray<string> = ['Build', 'Review', 'Fix', 'Complete'];

const STATUS_TO_ACTIVE_PHASE: Readonly<Record<string, string>> = {
  CREATED: '',
  IN_PROGRESS: 'Build',
  IMPLEMENTED: '',
  IN_REVIEW: 'Review',
  FIXING: 'Fix',
  COMPLETE: '',
  FAILED: '',
  BLOCKED: '',
  CANCELLED: '',
};

const COMPLETED_THROUGH: Readonly<Record<string, ReadonlyArray<string>>> = {
  CREATED: [],
  IN_PROGRESS: [],
  IMPLEMENTED: ['Build'],
  IN_REVIEW: ['Build'],
  FIXING: ['Build', 'Review'],
  COMPLETE: ['Build', 'Review', 'Fix', 'Complete'],
  FAILED: [],
  BLOCKED: [],
  CANCELLED: [],
};

// Map analytics phase names to pipeline phase names for duration display.
// Since session-analytics only records total duration, we only show it on
// the last completed phase to avoid misleading repeated values.
const ANALYTICS_PHASE_TO_LAST_PIPELINE_PHASE: Readonly<Record<string, string>> = {
  Dev: 'Build',
  QA: 'Fix',
};

/**
 * PipelineService provides task registry, plan, orchestrator state, stats, and graph data.
 * Diff logic delegated to DiffService; worker-tree logic delegated to WorkerTreeService.
 * Migrated from dashboard-service/src/state/store.ts and pipeline-helpers.ts.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private registry: ReadonlyArray<TaskRecord> = [];
  private plan: PlanData | null = null;
  private orchestratorState: OrchestratorState | null = null;
  private readonly taskDefinitions: Map<string, TaskDefinition> = new Map();
  private readonly reviews: Map<string, ReviewData[]> = new Map();
  private readonly completionReports: Map<string, CompletionReport> = new Map();
  private antiPatterns: ReadonlyArray<AntiPatternRule> = [];
  private readonly lessons: Map<string, ReadonlyArray<LessonEntry>> = new Map();
  private readonly sessionAnalyticsMap: Map<string, SessionAnalytics> = new Map();

  public constructor(
    private readonly diffService: DiffService,
    private readonly workerTreeService: WorkerTreeService,
  ) {}

  // === Registry Methods ===

  public getRegistry(): ReadonlyArray<TaskRecord> {
    return this.registry;
  }

  public setRegistry(records: ReadonlyArray<TaskRecord>): ReadonlyArray<TaskRecord> {
    const old = this.registry;
    this.registry = records;
    return old;
  }

  // === Plan Methods ===

  public getPlan(): PlanData | null {
    return this.plan;
  }

  public setPlan(plan: PlanData): PlanData | null {
    const old = this.plan;
    this.plan = plan;
    return old;
  }

  public clearPlan(): void {
    this.plan = null;
  }

  // === Orchestrator State Methods ===

  public getOrchestratorState(): OrchestratorState | null {
    return this.orchestratorState;
  }

  public setOrchestratorState(state: OrchestratorState): OrchestratorState | null {
    const old = this.orchestratorState;
    this.orchestratorState = state;
    return old;
  }

  public clearOrchestratorState(): void {
    this.orchestratorState = null;
  }

  // === Task Definition Methods ===

  public getTaskDefinition(taskId: string): TaskDefinition | null {
    return this.taskDefinitions.get(taskId) ?? null;
  }

  public setTaskDefinition(taskId: string, definition: TaskDefinition): void {
    this.taskDefinitions.set(taskId, definition);
  }

  // === Review Methods ===

  public getReviews(taskId: string): ReadonlyArray<ReviewData> {
    return this.reviews.get(taskId) ?? [];
  }

  public addReview(taskId: string, review: ReviewData): void {
    const existing = this.reviews.get(taskId) ?? [];
    const filtered = existing.filter((r) => r.reviewType !== review.reviewType);
    filtered.push(review);
    this.reviews.set(taskId, filtered);
  }

  public removeReview(taskId: string, reviewType: string): void {
    const existing = this.reviews.get(taskId);
    if (!existing) return;
    const filtered = existing.filter((r) => r.reviewType !== reviewType);
    if (filtered.length === 0) {
      this.reviews.delete(taskId);
    } else {
      this.reviews.set(taskId, filtered);
    }
  }

  // === Completion Report Methods ===

  public getCompletionReport(taskId: string): CompletionReport | null {
    return this.completionReports.get(taskId) ?? null;
  }

  public setCompletionReport(taskId: string, report: CompletionReport): void {
    this.completionReports.set(taskId, report);
  }

  public removeCompletionReport(taskId: string): void {
    this.completionReports.delete(taskId);
  }

  // === Anti-Pattern Methods ===

  public getAntiPatterns(): ReadonlyArray<AntiPatternRule> {
    return this.antiPatterns;
  }

  public setAntiPatterns(patterns: ReadonlyArray<AntiPatternRule>): void {
    this.antiPatterns = patterns;
  }

  public clearAntiPatterns(): void {
    this.antiPatterns = [];
  }

  // === Lessons Methods ===

  public getLessons(): ReadonlyArray<LessonEntry> {
    const all: LessonEntry[] = [];
    for (const entries of this.lessons.values()) {
      all.push(...entries);
    }
    return all;
  }

  public setLessons(domain: string, entries: ReadonlyArray<LessonEntry>): void {
    this.lessons.set(domain, entries);
  }

  public removeLessons(domain: string): void {
    this.lessons.delete(domain);
  }

  // === Full Task Data ===

  public getFullTask(taskId: string): FullTaskData {
    const registryRecord = this.registry.find((r) => r.id === taskId) ?? null;
    return {
      definition: this.getTaskDefinition(taskId),
      registryRecord,
      reviews: this.getReviews(taskId),
      completionReport: this.getCompletionReport(taskId),
    };
  }

  // === Statistics ===

  public getStats(): DashboardStats {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const record of this.registry) {
      byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
      byType[record.type] = (byType[record.type] ?? 0) + 1;
      if (record.model) {
        byModel[record.model] = (byModel[record.model] ?? 0) + 1;
      }
    }

    const totalTasks = this.registry.length;
    const completedCount = byStatus['COMPLETE'] ?? 0;
    const completionRate = totalTasks > 0 ? completedCount / totalTasks : 0;
    const activeWorkers = this.orchestratorState?.activeWorkers.length ?? 0;

    // Aggregate cost and token data from the orchestrator session log if available.
    let totalCost = 0;
    let totalTokens = 0;
    const costByModel: Record<string, number> = {};
    const tokensByModel: Record<string, number> = {};

    if (this.orchestratorState) {
      for (const worker of this.orchestratorState.activeWorkers) {
        const cost = worker.cost ?? 0;
        const tokens = worker.tokens ?? 0;
        const model = worker.model ?? 'unknown';
        totalCost += cost;
        totalTokens += tokens;
        if (cost > 0) costByModel[model] = (costByModel[model] ?? 0) + cost;
        if (tokens > 0) tokensByModel[model] = (tokensByModel[model] ?? 0) + tokens;
      }
    }

    return {
      totalTasks,
      byStatus,
      byType,
      byModel,
      completionRate,
      activeWorkers,
      totalCost,
      totalTokens,
      costByModel,
      tokensByModel,
    };
  }

  // === Graph Data ===

  public getGraph(): GraphData {
    const TASK_ID_RE = /TASK_\d{4}_\d{3}/;
    const registryById = new Map(this.registry.map((r) => [r.id, r]));
    const taskIdSet = new Set(registryById.keys());

    const nodes: GraphNode[] = [];
    const edgeSet = new Set<string>();
    const dedupedEdges: GraphEdge[] = [];

    const rawDepsByTask = new Map<string, ReadonlyArray<string>>();
    const resolvedDepsByTask = new Map<string, string[]>();

    for (const record of this.registry) {
      const def = this.taskDefinitions.get(record.id);
      const rawDeps = def?.dependencies ?? [];
      rawDepsByTask.set(record.id, rawDeps);

      const resolvedDeps: string[] = [];
      for (const dep of rawDeps) {
        const match = dep.match(TASK_ID_RE);
        if (match && taskIdSet.has(match[0])) {
          resolvedDeps.push(match[0]);
          const key = `${match[0]}→${record.id}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            dedupedEdges.push({ from: match[0], to: record.id });
          }
        }
      }
      resolvedDepsByTask.set(record.id, resolvedDeps);
    }

    for (const record of this.registry) {
      const def = this.taskDefinitions.get(record.id);
      const rawDeps = rawDepsByTask.get(record.id) ?? [];
      const resolvedDeps = resolvedDepsByTask.get(record.id) ?? [];

      const rawTaskDepCount = rawDeps.filter((d) => TASK_ID_RE.test(d)).length;
      const isUnblocked =
        rawTaskDepCount === 0
          ? rawDeps.length === 0
          : resolvedDeps.length >= rawTaskDepCount &&
            resolvedDeps.every((depId) => registryById.get(depId)?.status === 'COMPLETE');

      nodes.push({
        id: record.id,
        title: def?.title ?? record.description,
        status: record.status,
        type: record.type,
        priority: def?.priority ?? 'P2-Medium',
        isUnblocked,
      });
    }

    return { nodes, edges: dedupedEdges };
  }

  // === Session Analytics ===

  public getSessionAnalytics(taskId: string): SessionAnalytics | null {
    return this.sessionAnalyticsMap.get(taskId) ?? null;
  }

  public setSessionAnalytics(taskId: string, analytics: SessionAnalytics): void {
    this.sessionAnalyticsMap.set(taskId, analytics);
  }

  public removeSessionAnalytics(taskId: string): void {
    this.sessionAnalyticsMap.delete(taskId);
  }

  // === Pipeline Data ===

  public getTaskPipeline(taskId: string): PipelineData {
    const record = this.registry.find((r) => r.id === taskId);
    const analytics = this.sessionAnalyticsMap.get(taskId) ?? null;
    const taskStatus = record?.status ?? 'CREATED';

    const phases = this.buildPipelinePhases(taskStatus, analytics);

    return {
      taskId,
      taskStatus,
      phases,
      totalDuration: analytics?.duration ?? null,
      outcome: analytics?.outcome ?? null,
    };
  }

  private buildPipelinePhases(
    taskStatus: string,
    analytics: SessionAnalytics | null,
  ): ReadonlyArray<PipelinePhase> {
    const activePhase = STATUS_TO_ACTIVE_PHASE[taskStatus] ?? '';
    const donePhases = new Set(COMPLETED_THROUGH[taskStatus] ?? []);

    const isFailed = taskStatus === 'FAILED';
    const lastCompletedIdx = isFailed
      ? [...PHASE_ORDER].reduce((best, p, i) => (donePhases.has(p) ? i : best), -1)
      : -1;
    const failedPhaseName = isFailed
      ? (PHASE_ORDER[lastCompletedIdx + 1] ?? PHASE_ORDER[PHASE_ORDER.length - 1])
      : null;

    const lastCompletedPhase = analytics !== null
      ? this.getLastCompletedPhaseName(analytics)
      : null;

    return PHASE_ORDER.map((name) => {
      let status: PipelinePhaseStatus;
      if (donePhases.has(name)) {
        status = 'complete';
      } else if (isFailed && name === failedPhaseName) {
        status = 'failed';
      } else if (name === activePhase) {
        status = 'active';
      } else {
        status = 'pending';
      }

      const isParallel = name === 'Review';
      const parallelParts: ReadonlyArray<string> = isParallel ? ['Review Lead', 'Test Lead'] : [];
      const duration = name === lastCompletedPhase && analytics !== null
        ? analytics.duration
        : null;

      return { name, status, duration, isParallel, parallelParts };
    });
  }

  private getLastCompletedPhaseName(analytics: SessionAnalytics): string | null {
    const completedPipelinePhases: string[] = [];
    for (const [analyticsPhase, pipelinePhase] of Object.entries(ANALYTICS_PHASE_TO_LAST_PIPELINE_PHASE)) {
      if (analytics.phasesCompleted.includes(analyticsPhase)) {
        completedPipelinePhases.push(pipelinePhase);
      }
    }
    if (analytics.outcome === 'COMPLETE') {
      completedPipelinePhases.push('Complete');
    }
    for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
      if (completedPipelinePhases.includes(PHASE_ORDER[i])) {
        return PHASE_ORDER[i];
      }
    }
    return null;
  }

  // === Worker Tree ===

  public getWorkerTree(): ReadonlyArray<WorkerTree> {
    const workers = this.orchestratorState?.activeWorkers ?? [];
    return this.workerTreeService.buildWorkerTrees(workers);
  }

  // === Diff Methods (delegated to DiffService) ===

  public diffRegistry(
    oldRecords: ReadonlyArray<TaskRecord>,
    newRecords: ReadonlyArray<TaskRecord>,
  ): ReadonlyArray<DashboardEvent> {
    return this.diffService.diffRegistry(oldRecords, newRecords);
  }

  public diffState(
    oldState: OrchestratorState | null,
    newState: OrchestratorState,
  ): ReadonlyArray<DashboardEvent> {
    return this.diffService.diffState(oldState, newState);
  }

  // === Task Cleanup ===

  public removeTask(taskId: string): void {
    this.taskDefinitions.delete(taskId);
    this.reviews.delete(taskId);
    this.completionReports.delete(taskId);
  }
}
