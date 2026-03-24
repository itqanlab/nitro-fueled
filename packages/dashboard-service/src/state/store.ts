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

  public getOrchestratorState(): OrchestratorState | null {
    return this.orchestratorState;
  }

  public setOrchestratorState(state: OrchestratorState): OrchestratorState | null {
    const old = this.orchestratorState;
    this.orchestratorState = state;
    return old;
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

  public getCompletionReport(taskId: string): CompletionReport | null {
    return this.completionReports.get(taskId) ?? null;
  }

  public setCompletionReport(taskId: string, report: CompletionReport): void {
    this.completionReports.set(taskId, report);
  }

  public getAntiPatterns(): ReadonlyArray<AntiPatternRule> {
    return this.antiPatterns;
  }

  public setAntiPatterns(patterns: ReadonlyArray<AntiPatternRule>): void {
    this.antiPatterns = patterns;
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

    for (const record of this.registry) {
      byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
      byType[record.type] = (byType[record.type] ?? 0) + 1;
    }

    const totalTasks = this.registry.length;
    const completedCount = byStatus['COMPLETE'] ?? 0;
    const completionRate = totalTasks > 0 ? completedCount / totalTasks : 0;
    const activeWorkers = this.orchestratorState?.activeWorkers.length ?? 0;

    return { totalTasks, byStatus, byType, completionRate, activeWorkers };
  }

  public removeTask(taskId: string): void {
    this.taskDefinitions.delete(taskId);
    this.reviews.delete(taskId);
    this.completionReports.delete(taskId);
  }
}
