import type {
  TaskRecord,
  PlanData,
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
  WorkerTree,
} from '../events/event-types.js';
import { buildPipelinePhases } from './pipeline-helpers.js';
import { buildWorkerTrees } from './worker-tree-helpers.js';

export class StateStore {
  private registry: ReadonlyArray<TaskRecord> = [];
  private plan: PlanData | null = null;
  private orchestratorState: OrchestratorState | null = null;
  private taskDefinitions: Map<string, TaskDefinition> = new Map();
  private reviews: Map<string, ReviewData[]> = new Map();
  private completionReports: Map<string, CompletionReport> = new Map();
  private antiPatterns: ReadonlyArray<AntiPatternRule> = [];
  private lessons: Map<string, ReadonlyArray<LessonEntry>> = new Map();
  private sessionAnalyticsMap: Map<string, SessionAnalytics> = new Map();

  public getRegistry(): ReadonlyArray<TaskRecord> {
    return this.registry;
  }

  public setRegistry(records: ReadonlyArray<TaskRecord>): ReadonlyArray<TaskRecord> {
    const old = this.registry;
    this.registry = records;
    return old;
  }

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

  public getTaskDefinition(taskId: string): TaskDefinition | null {
    return this.taskDefinitions.get(taskId) ?? null;
  }

  public setTaskDefinition(taskId: string, definition: TaskDefinition): void {
    this.taskDefinitions.set(taskId, definition);
  }

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

  public getCompletionReport(taskId: string): CompletionReport | null {
    return this.completionReports.get(taskId) ?? null;
  }

  public setCompletionReport(taskId: string, report: CompletionReport): void {
    this.completionReports.set(taskId, report);
  }

  public removeCompletionReport(taskId: string): void {
    this.completionReports.delete(taskId);
  }

  public getAntiPatterns(): ReadonlyArray<AntiPatternRule> {
    return this.antiPatterns;
  }

  public setAntiPatterns(patterns: ReadonlyArray<AntiPatternRule>): void {
    this.antiPatterns = patterns;
  }

  public clearAntiPatterns(): void {
    this.antiPatterns = [];
  }

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

  public getFullTask(taskId: string): FullTaskData {
    const registryRecord = this.registry.find((r) => r.id === taskId) ?? null;
    return {
      definition: this.getTaskDefinition(taskId),
      registryRecord,
      reviews: this.getReviews(taskId),
      completionReport: this.getCompletionReport(taskId),
    };
  }

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
    // Workers write cost totals into the state; sum across completed + active workers.
    let totalCost = 0;
    let totalTokens = 0;
    const costByModel: Record<string, number> = {};
    const tokensByModel: Record<string, number> = {};

    if (this.orchestratorState) {
      for (const worker of [
        ...this.orchestratorState.activeWorkers,
      ]) {
        const workerAny = worker as unknown as Record<string, unknown>;
        const cost = typeof workerAny['cost'] === 'number' ? workerAny['cost'] : 0;
        const tokens = typeof workerAny['tokens'] === 'number' ? workerAny['tokens'] : 0;
        const model = typeof workerAny['model'] === 'string' ? workerAny['model'] : 'unknown';
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

  public getGraph(): GraphData {
    const TASK_ID_RE = /TASK_\d{4}_\d{3}/;
    const taskIdSet = new Set(this.registry.map((r) => r.id));

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Build edges and track which tasks have unmet dependencies
    const depsOf = new Map<string, string[]>();

    for (const record of this.registry) {
      const def = this.taskDefinitions.get(record.id);
      const rawDeps = def?.dependencies ?? [];

      // Extract TASK_YYYY_NNN IDs from dependency strings (may include description text)
      const resolvedDeps: string[] = [];
      for (const dep of rawDeps) {
        const match = dep.match(TASK_ID_RE);
        if (match && taskIdSet.has(match[0])) {
          resolvedDeps.push(match[0]);
          edges.push({ from: match[0], to: record.id });
        }
      }
      depsOf.set(record.id, resolvedDeps);
    }

    // Deduplicate edges (same from→to may appear multiple times)
    const edgeSet = new Set<string>();
    const dedupedEdges: GraphEdge[] = [];
    for (const edge of edges) {
      const key = `${edge.from}→${edge.to}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        dedupedEdges.push(edge);
      }
    }

    for (const record of this.registry) {
      const def = this.taskDefinitions.get(record.id);
      const deps = depsOf.get(record.id) ?? [];
      const isUnblocked =
        deps.length === 0 ||
        deps.every((depId) => {
          const depRecord = this.registry.find((r) => r.id === depId);
          return depRecord?.status === 'COMPLETE';
        });

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

  public getSessionAnalytics(taskId: string): SessionAnalytics | null {
    return this.sessionAnalyticsMap.get(taskId) ?? null;
  }

  public setSessionAnalytics(taskId: string, analytics: SessionAnalytics): void {
    this.sessionAnalyticsMap.set(taskId, analytics);
  }

  public removeSessionAnalytics(taskId: string): void {
    this.sessionAnalyticsMap.delete(taskId);
  }

  public getTaskPipeline(taskId: string): PipelineData {
    const record = this.registry.find((r) => r.id === taskId);
    const analytics = this.sessionAnalyticsMap.get(taskId) ?? null;
    const taskStatus = record?.status ?? 'CREATED';

    const phases = buildPipelinePhases(taskStatus, analytics);

    return {
      taskId,
      taskStatus,
      phases,
      totalDuration: analytics?.duration ?? null,
      outcome: analytics?.outcome ?? null,
    };
  }

  public getWorkerTree(): ReadonlyArray<WorkerTree> {
    const workers = this.orchestratorState?.activeWorkers ?? [];
    return buildWorkerTrees(workers);
  }

  public removeTask(taskId: string): void {
    this.taskDefinitions.delete(taskId);
    this.reviews.delete(taskId);
    this.completionReports.delete(taskId);
  }
}
