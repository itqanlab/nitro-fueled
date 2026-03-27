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
  PipelinePhase,
  PipelinePhaseStatus,
  WorkerTree,
  WorkerTreeNode,
  WorkerHealth,
} from '../events/event-types.js';

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

// --- Pipeline phase derivation ---

const PHASE_ORDER: ReadonlyArray<string> = ['Build', 'Review', 'Fix', 'Complete'];

function buildPipelinePhases(
  taskStatus: string,
  analytics: SessionAnalytics | null,
): ReadonlyArray<PipelinePhase> {
  const statusToActivePhase: Record<string, string> = {
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

  const completedThrough: Record<string, ReadonlyArray<string>> = {
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

  const activePhase = statusToActivePhase[taskStatus] ?? '';
  const donePhases = new Set(completedThrough[taskStatus] ?? []);

  const phases: PipelinePhase[] = PHASE_ORDER.map((name) => {
    let status: PipelinePhaseStatus;
    if (donePhases.has(name)) {
      status = 'complete';
    } else if (name === activePhase) {
      status = 'active';
    } else if (taskStatus === 'FAILED' && name === activePhase) {
      status = 'failed';
    } else {
      status = 'pending';
    }

    const isParallel = name === 'Review';
    const parallelParts = isParallel ? ['Review Lead', 'Test Lead'] : [];
    const duration = analytics !== null && name !== 'Complete'
      ? getDurationForPhase(name, analytics)
      : null;

    return { name, status, duration, isParallel, parallelParts };
  });

  return phases;
}

function getDurationForPhase(phaseName: string, analytics: SessionAnalytics): string | null {
  const phaseMap: Record<string, string> = {
    Build: 'Dev',
    Review: 'QA',
    Fix: 'QA',
  };
  const analyticsPhase = phaseMap[phaseName];
  if (!analyticsPhase) return null;
  if (analytics.phasesCompleted.includes(analyticsPhase)) {
    return analytics.duration;
  }
  return null;
}

// --- Worker tree derivation ---

const REVIEW_LEAD_CHILDREN = new Set([
  'style reviewer', 'logic reviewer', 'security reviewer',
  'code style', 'code logic', 'code security',
  'code-style', 'code-logic', 'code-security',
]);

const TEST_LEAD_CHILDREN = new Set([
  'unit tester', 'integration tester', 'e2e tester',
  'unit-tester', 'integration-tester', 'e2e-tester',
]);

function inferRole(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('build worker')) return 'Build Worker';
  if (lower.includes('review lead')) return 'Review Lead';
  if (lower.includes('test lead')) return 'Test Lead';
  if (lower.includes('fix worker')) return 'Fix Worker';
  if (lower.includes('completion worker')) return 'Completion Worker';
  if (lower.includes('style reviewer') || lower.includes('code style') || lower.includes('code-style')) return 'Style Reviewer';
  if (lower.includes('logic reviewer') || lower.includes('code logic') || lower.includes('code-logic')) return 'Logic Reviewer';
  if (lower.includes('security reviewer') || lower.includes('code security') || lower.includes('code-security')) return 'Security Reviewer';
  if (lower.includes('unit tester') || lower.includes('unit-tester')) return 'Unit Tester';
  if (lower.includes('integration tester') || lower.includes('integration-tester')) return 'Integration Tester';
  if (lower.includes('e2e tester') || lower.includes('e2e-tester')) return 'E2E Tester';
  return label;
}

function isReviewLeadChild(role: string): boolean {
  return REVIEW_LEAD_CHILDREN.has(role.toLowerCase());
}

function isTestLeadChild(role: string): boolean {
  return TEST_LEAD_CHILDREN.has(role.toLowerCase());
}

function computeHealth(stuckCount: number): WorkerHealth {
  if (stuckCount > 2) return 'stuck';
  if (stuckCount > 0) return 'warning';
  return 'healthy';
}

function buildWorkerTrees(
  workers: ReadonlyArray<{ readonly workerId: string; readonly taskId: string; readonly label: string; readonly workerType: string; readonly status: string; readonly spawnTime: string; readonly stuckCount: number; readonly lastHealth: string; readonly expectedEndState: string }>,
): ReadonlyArray<WorkerTree> {
  const byTask = new Map<string, typeof workers[number][]>();
  for (const w of workers) {
    const group = byTask.get(w.taskId) ?? [];
    group.push(w);
    byTask.set(w.taskId, group);
  }

  const trees: WorkerTree[] = [];

  for (const [taskId, taskWorkers] of byTask) {
    const roots: WorkerTreeNode[] = [];
    const reviewLeadChildren: WorkerTreeNode[] = [];
    const testLeadChildren: WorkerTreeNode[] = [];
    let reviewLeadNode: WorkerTreeNode | null = null;
    let testLeadNode: WorkerTreeNode | null = null;

    for (const w of taskWorkers) {
      const role = inferRole(w.label);
      const health = computeHealth(w.stuckCount);
      const elapsedMs = w.spawnTime ? Date.now() - new Date(w.spawnTime).getTime() : 0;

      const node: WorkerTreeNode = {
        workerId: w.workerId,
        taskId: w.taskId,
        label: w.label,
        role,
        workerType: w.workerType,
        status: w.status,
        health,
        elapsedMs: Math.max(0, elapsedMs),
        spawnTime: w.spawnTime,
        stuckCount: w.stuckCount,
        children: [],
      };

      if (role === 'Review Lead') {
        reviewLeadNode = node;
      } else if (role === 'Test Lead') {
        testLeadNode = node;
      } else if (isReviewLeadChild(role)) {
        reviewLeadChildren.push(node);
      } else if (isTestLeadChild(role)) {
        testLeadChildren.push(node);
      } else {
        roots.push(node);
      }
    }

    if (reviewLeadNode !== null) {
      const withChildren: WorkerTreeNode = { ...reviewLeadNode, children: reviewLeadChildren };
      roots.push(withChildren);
    } else {
      roots.push(...reviewLeadChildren);
    }

    if (testLeadNode !== null) {
      const withChildren: WorkerTreeNode = { ...testLeadNode, children: testLeadChildren };
      roots.push(withChildren);
    } else {
      roots.push(...testLeadChildren);
    }

    trees.push({ taskId, roots });
  }

  return trees;
}
