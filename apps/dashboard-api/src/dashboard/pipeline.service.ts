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
} from './dashboard.types';

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
 * PipelineService provides task pipeline state and diffing.
 * Migrated from dashboard-service/src/state/store.ts, pipeline-helpers.ts, and differ.ts.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private registry: ReadonlyArray<TaskRecord> = [];
  private plan: import('./dashboard.types').PlanData | null = null;
  private orchestratorState: OrchestratorState | null = null;
  private taskDefinitions: Map<string, TaskDefinition> = new Map();
  private reviews: Map<string, ReviewData[]> = new Map();
  private completionReports: Map<string, CompletionReport> = new Map();
  private antiPatterns: ReadonlyArray<AntiPatternRule> = [];
  private lessons: Map<string, ReadonlyArray<LessonEntry>> = new Map();
  private sessionAnalyticsMap: Map<string, SessionAnalytics> = new Map();

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

  public getPlan(): import('./dashboard.types').PlanData | null {
    return this.plan;
  }

  public setPlan(plan: import('./dashboard.types').PlanData): import('./dashboard.types').PlanData | null {
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
    return this.buildWorkerTrees(workers);
  }

  // === Diff Methods (migrated from differ.ts) ===

  public diffRegistry(
    oldRecords: ReadonlyArray<TaskRecord>,
    newRecords: ReadonlyArray<TaskRecord>,
  ): ReadonlyArray<import('./dashboard.types').DashboardEvent> {
    const events: import('./dashboard.types').DashboardEvent[] = [];
    const now = new Date().toISOString();
    const oldMap = new Map(oldRecords.map((r) => [r.id, r]));
    const newMap = new Map(newRecords.map((r) => [r.id, r]));

    for (const [id, newRecord] of newMap) {
      const oldRecord = oldMap.get(id);
      if (!oldRecord) {
        events.push({
          type: 'task:created',
          timestamp: now,
          payload: { taskId: id, type: newRecord.type, model: newRecord.model },
        });
        continue;
      }

      if (oldRecord.status !== newRecord.status) {
        events.push({
          type: 'task:state_changed',
          timestamp: now,
          payload: {
            taskId: id,
            from: oldRecord.status,
            to: newRecord.status,
          },
        });
      }

      if (oldRecord.description !== newRecord.description || oldRecord.type !== newRecord.type) {
        events.push({
          type: 'task:updated',
          timestamp: now,
          payload: { taskId: id, field: 'description', oldValue: oldRecord.description, newValue: newRecord.description },
        });
      }
    }

    for (const [id] of oldMap) {
      if (!newMap.has(id)) {
        events.push({
          type: 'task:deleted',
          timestamp: now,
          payload: { taskId: id },
        });
      }
    }

    return events;
  }

  public diffState(
    oldState: OrchestratorState | null,
    newState: OrchestratorState,
  ): ReadonlyArray<import('./dashboard.types').DashboardEvent> {
    const events: import('./dashboard.types').DashboardEvent[] = [];
    const now = new Date().toISOString();

    if (oldState === null) {
      for (const worker of newState.activeWorkers) {
        events.push({
          type: 'worker:spawned',
          timestamp: now,
          payload: {
            workerId: worker.workerId,
            taskId: worker.taskId,
            type: worker.workerType,
          },
        });
      }
      return events;
    }

    const oldWorkerIds = new Set(oldState.activeWorkers.map((w) => w.workerId));
    const newWorkerIds = new Set(newState.activeWorkers.map((w) => w.workerId));

    for (const worker of newState.activeWorkers) {
      if (!oldWorkerIds.has(worker.workerId)) {
        events.push({
          type: 'worker:spawned',
          timestamp: now,
          payload: {
            workerId: worker.workerId,
            taskId: worker.taskId,
            type: worker.workerType,
          },
        });
      }
    }

    for (const worker of oldState.activeWorkers) {
      if (!newWorkerIds.has(worker.workerId)) {
        const completed = newState.completedTasks.find(
          (t) =>
            t.taskId === worker.taskId &&
            !oldState.completedTasks.some((ot) => ot.taskId === t.taskId),
        );
        const failed = newState.failedTasks.find(
          (t) =>
            t.taskId === worker.taskId &&
            !oldState.failedTasks.some((ot) => ot.taskId === t.taskId),
        );

        if (failed) {
          events.push({
            type: 'worker:failed',
            timestamp: now,
            payload: {
              workerId: worker.workerId,
              taskId: worker.taskId,
              reason: failed.reason,
            },
          });
        } else {
          events.push({
            type: 'worker:completed',
            timestamp: now,
            payload: {
              workerId: worker.workerId,
              taskId: worker.taskId,
              finalState: completed ? 'completed' : 'removed',
            },
          });
        }
      }
    }

    const compacted = newState.compactionCount > oldState.compactionCount;
    if (!compacted && newState.sessionLog.length > oldState.sessionLog.length) {
      const newEntries = newState.sessionLog.slice(oldState.sessionLog.length);
      for (const entry of newEntries) {
        events.push({
          type: 'log:entry',
          timestamp: now,
          payload: { timestamp: entry.timestamp, event: entry.event },
        });
      }
    }

    return events;
  }

  // === Task Cleanup ===

  public removeTask(taskId: string): void {
    this.taskDefinitions.delete(taskId);
    this.reviews.delete(taskId);
    this.completionReports.delete(taskId);
  }

  // === Worker Tree Helpers (migrated from worker-tree-helpers.ts) ===

  private buildWorkerTrees(
    workers: ReadonlyArray<OrchestratorState['activeWorkers'][0]>,
  ): ReadonlyArray<WorkerTree> {
    const byTask = new Map<string, OrchestratorState['activeWorkers'][0][]>();
    for (const w of workers) {
      const group = byTask.get(w.taskId) ?? [];
      group.push(w);
      byTask.set(w.taskId, group);
    }

    return Array.from(byTask.entries()).map(([taskId, taskWorkers]) => {
      return this.buildTaskTree(taskId, taskWorkers);
    });
  }

  private buildTaskTree(
    taskId: string,
    taskWorkers: ReadonlyArray<OrchestratorState['activeWorkers'][0]>,
  ): WorkerTree {
    const roots: import('./dashboard.types').WorkerTreeNode[] = [];
    const reviewLeadChildren: import('./dashboard.types').WorkerTreeNode[] = [];
    const testLeadChildren: import('./dashboard.types').WorkerTreeNode[] = [];
    let reviewLeadNode: import('./dashboard.types').WorkerTreeNode | null = null;
    let testLeadNode: import('./dashboard.types').WorkerTreeNode | null = null;

    const REVIEW_LEAD_CHILDREN = new Set([
      'style reviewer', 'logic reviewer', 'security reviewer',
      'code style', 'code logic', 'code security',
      'code-style', 'code-logic', 'code-security',
    ]);

    const TEST_LEAD_CHILDREN = new Set([
      'unit tester', 'integration tester', 'e2e tester',
      'unit-tester', 'integration-tester', 'e2e-tester',
    ]);

    for (const w of taskWorkers) {
      const role = this.inferRole(w.label);
      const health = this.computeHealth(w.stuckCount);
      const spawnMs = w.spawnTime ? new Date(w.spawnTime).getTime() : NaN;
      const elapsedMs = Number.isNaN(spawnMs) ? 0 : Math.max(0, Date.now() - spawnMs);

      const node: import('./dashboard.types').WorkerTreeNode = {
        workerId: w.workerId,
        taskId: w.taskId,
        label: w.label,
        role,
        workerType: w.workerType,
        status: w.status,
        health,
        elapsedMs,
        spawnTime: w.spawnTime,
        stuckCount: w.stuckCount,
        children: [],
      };

      if (role === 'Review Lead') {
        reviewLeadNode = node;
      } else if (role === 'Test Lead') {
        testLeadNode = node;
      } else if (REVIEW_LEAD_CHILDREN.has(role.toLowerCase())) {
        reviewLeadChildren.push(node);
      } else if (TEST_LEAD_CHILDREN.has(role.toLowerCase())) {
        testLeadChildren.push(node);
      } else {
        roots.push(node);
      }
    }

    if (reviewLeadNode !== null) {
      roots.push({ ...reviewLeadNode, children: reviewLeadChildren });
    } else {
      roots.push(...reviewLeadChildren);
    }

    if (testLeadNode !== null) {
      roots.push({ ...testLeadNode, children: testLeadChildren });
    } else {
      roots.push(...testLeadChildren);
    }

    return { taskId, roots };
  }

  private inferRole(label: string): string {
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

  private computeHealth(stuckCount: number): import('./dashboard.types').WorkerHealth {
    if (stuckCount > 2) return 'stuck';
    if (stuckCount > 0) return 'warning';
    return 'healthy';
  }
}
