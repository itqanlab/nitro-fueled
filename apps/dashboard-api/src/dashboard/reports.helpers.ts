import type { CortexModelPerformance, CortexPhaseTiming, CortexSession, CortexTask, CortexWorker } from './cortex.types';
import type {
  CostTrendPoint,
  ModelCostRow,
  ModelPerformanceReportRow,
  QualityCategoryRow,
  QualityTrendPoint,
  RiskAreaRow,
  SessionReportRow,
  SessionTrendPoint,
  SuccessDimension,
  SuccessRateRow,
  TaskTypeCostRow,
} from './reports.types';

export interface ParsedSessionMetrics {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly label: string;
  readonly totalCost: number;
  readonly taskCount: number;
  readonly failureCount: number;
  readonly durationMinutes: number;
  readonly retryCount: number;
  readonly compactionCount: number;
  readonly avgReviewScore: number;
}

export interface ParsedReviewMetric {
  readonly taskId: string;
  readonly reviewType: string;
  readonly score: number;
  readonly assessment: string;
  readonly criticalIssues: number;
  readonly seriousIssues: number;
  readonly moderateIssues: number;
  readonly category: string;
  readonly observedAt: string;
}

export function parseMetricValue(content: string, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+)\\|`, 'i'));
  if (!match) {
    return 0;
  }
  const numeric = match[1].match(/-?\d+(?:\.\d+)?/);
  return numeric ? Number(numeric[0]) : 0;
}

export function parseSessionStarted(content: string, fallback: string): string {
  const match = content.match(/\*\*Session Started\*\*:\s*([^\n]+)/i) ?? content.match(/- \*\*Started\*\*:\s*([^\n]+)/i);
  return match ? match[1].trim() : fallback;
}

export function parseCompactionCount(content: string): number {
  const matches = content.matchAll(/\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*(\d+)\s*\|/g);
  let total = 0;
  for (const match of matches) {
    total += Number(match[1]);
  }
  return total;
}

export function withinRange(value: string, from: string | null, to: string | null): boolean {
  if (from !== null && value < from) {
    return false;
  }
  if (to !== null && value > to) {
    return false;
  }
  return true;
}

export function toIsoDate(value: string): string {
  const trimmed = value.trim();
  const direct = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (direct) {
    return direct[1];
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return trimmed;
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

export function buildSessionRow(
  session: ParsedSessionMetrics,
  primaryModel: string,
): SessionReportRow {
  return {
    sessionId: session.sessionId,
    startedAt: session.startedAt,
    tasksCompleted: Math.max(0, session.taskCount - session.failureCount),
    tasksFailed: session.failureCount,
    durationMinutes: session.durationMinutes,
    totalCost: session.totalCost,
    primaryModel,
    retryCount: session.retryCount,
    compactionCount: session.compactionCount,
    workerEfficiency: session.taskCount > 0 ? Number((session.taskCount / Math.max(session.durationMinutes, 1) * 60).toFixed(2)) : 0,
  };
}

export function buildSessionTrend(metrics: ReadonlyArray<ParsedSessionMetrics>): ReadonlyArray<SessionTrendPoint> {
  return metrics.map((session) => ({
    label: session.label,
    tasksCompleted: Math.max(0, session.taskCount - session.failureCount),
    tasksFailed: session.failureCount,
    totalCost: session.totalCost,
    durationMinutes: session.durationMinutes,
  }));
}

export function buildSuccessRows(
  dimensions: ReadonlyArray<{ dimension: SuccessDimension; label: string; status: string }>,
): ReadonlyArray<SuccessRateRow> {
  const counts = new Map<string, { dimension: SuccessDimension; label: string; total: number; complete: number; failed: number; blocked: number }>();
  for (const item of dimensions) {
    const key = `${item.dimension}:${item.label}`;
    const entry = counts.get(key) ?? { dimension: item.dimension, label: item.label, total: 0, complete: 0, failed: 0, blocked: 0 };
    entry.total += 1;
    if (item.status === 'COMPLETE') entry.complete += 1;
    if (item.status === 'FAILED') entry.failed += 1;
    if (item.status === 'BLOCKED') entry.blocked += 1;
    counts.set(key, entry);
  }
  return Array.from(counts.values())
    .map((entry) => ({
      dimension: entry.dimension,
      label: entry.label,
      total: entry.total,
      completeCount: entry.complete,
      failureCount: entry.failed,
      blockedCount: entry.blocked,
      successRate: entry.total > 0 ? Number((entry.complete / entry.total * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.successRate - left.successRate || right.total - left.total);
}

export function buildCostTrend(sessions: ReadonlyArray<CortexSession>): ReadonlyArray<CostTrendPoint> {
  return sessions.map((session) => ({
    label: session.started_at.slice(5, 10),
    cost: Number(session.total_cost.toFixed(4)),
    taskCount: session.tasks_terminal,
  }));
}

export function buildModelCostRows(
  models: ReadonlyArray<{ model: string; totalCost: number; taskCount: number }>,
): ReadonlyArray<ModelCostRow> {
  const total = models.reduce((sum, row) => sum + row.totalCost, 0);
  return models
    .map((row) => ({
      model: row.model,
      totalCost: Number(row.totalCost.toFixed(4)),
      sharePercent: total > 0 ? Number((row.totalCost / total * 100).toFixed(1)) : 0,
      taskCount: row.taskCount,
    }))
    .sort((left, right) => right.totalCost - left.totalCost);
}

export function buildTaskTypeCostRows(
  rows: ReadonlyArray<{ taskType: string; totalCost: number; taskCount: number }>,
): ReadonlyArray<TaskTypeCostRow> {
  return rows
    .map((row) => ({
      taskType: row.taskType,
      totalCost: Number(row.totalCost.toFixed(4)),
      taskCount: row.taskCount,
      avgCostPerTask: row.taskCount > 0 ? Number((row.totalCost / row.taskCount).toFixed(4)) : 0,
    }))
    .sort((left, right) => right.totalCost - left.totalCost);
}

export function buildModelPerformanceRows(
  rows: ReadonlyArray<CortexModelPerformance>,
): ReadonlyArray<ModelPerformanceReportRow> {
  return rows.map((row) => {
    const avgReviewScore = row.avg_review_score ?? 0;
    const avgCostUsd = row.avg_cost_usd ?? 0;
    return {
      model: row.model,
      taskType: row.task_type ?? 'Unknown',
      complexity: row.complexity ?? 'Unknown',
      avgReviewScore: Number(avgReviewScore.toFixed(2)),
      failureRate: Number(((row.failure_rate ?? 0) * 100).toFixed(1)),
      avgDurationMinutes: Number((row.avg_duration_minutes ?? 0).toFixed(1)),
      avgCostUsd: Number(avgCostUsd.toFixed(4)),
      qualityPerDollar: avgCostUsd > 0 ? Number((avgReviewScore / avgCostUsd).toFixed(2)) : 0,
      phaseCount: row.phase_count,
      reviewCount: row.review_count,
      lastRun: row.last_run ?? 'Unknown',
    };
  });
}

export function summarizePrimaryModel(workers: ReadonlyArray<CortexWorker>): Map<string, string> {
  const byTask = new Map<string, Map<string, number>>();
  for (const worker of workers) {
    const models = byTask.get(worker.task_id) ?? new Map<string, number>();
    models.set(worker.model, (models.get(worker.model) ?? 0) + Math.max(worker.cost, 1));
    byTask.set(worker.task_id, models);
  }
  const resolved = new Map<string, string>();
  for (const [taskId, models] of byTask.entries()) {
    let bestLabel = 'Unknown';
    let bestValue = -1;
    for (const [label, weight] of models.entries()) {
      if (weight > bestValue) {
        bestLabel = label;
        bestValue = weight;
      }
    }
    resolved.set(taskId, bestLabel);
  }
  return resolved;
}

export function summarizeTaskCosts(
  tasks: ReadonlyArray<CortexTask>,
  workers: ReadonlyArray<CortexWorker>,
): {
  readonly byModel: ReadonlyArray<{ model: string; totalCost: number; taskCount: number }>;
  readonly byTaskType: ReadonlyArray<{ taskType: string; totalCost: number; taskCount: number }>;
} {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const modelTotals = new Map<string, { totalCost: number; taskIds: Set<string> }>();
  const typeTotals = new Map<string, { totalCost: number; taskIds: Set<string> }>();

  for (const worker of workers) {
    const task = taskById.get(worker.task_id);
    if (!task) {
      continue;
    }
    const modelEntry = modelTotals.get(worker.model) ?? { totalCost: 0, taskIds: new Set<string>() };
    modelEntry.totalCost += worker.cost;
    modelEntry.taskIds.add(worker.task_id);
    modelTotals.set(worker.model, modelEntry);

    const typeEntry = typeTotals.get(task.type) ?? { totalCost: 0, taskIds: new Set<string>() };
    typeEntry.totalCost += worker.cost;
    typeEntry.taskIds.add(worker.task_id);
    typeTotals.set(task.type, typeEntry);
  }

  return {
    byModel: Array.from(modelTotals.entries()).map(([model, entry]) => ({
      model,
      totalCost: entry.totalCost,
      taskCount: entry.taskIds.size,
    })),
    byTaskType: Array.from(typeTotals.entries()).map(([taskType, entry]) => ({
      taskType,
      totalCost: entry.totalCost,
      taskCount: entry.taskIds.size,
    })),
  };
}

export function summarizeFastestPhase(phases: ReadonlyArray<CortexPhaseTiming>): string {
  let bestPhase = 'No phase data';
  let bestDuration = Number.POSITIVE_INFINITY;
  for (const phase of phases) {
    if (phase.avg_duration_minutes !== null && phase.avg_duration_minutes < bestDuration) {
      bestDuration = phase.avg_duration_minutes;
      bestPhase = phase.phase;
    }
  }
  return bestPhase;
}

export function buildQualityTrend(reviews: ReadonlyArray<ParsedReviewMetric>): ReadonlyArray<QualityTrendPoint> {
  const byDate = new Map<string, { totalScore: number; count: number }>();
  for (const review of reviews) {
    const entry = byDate.get(review.observedAt) ?? { totalScore: 0, count: 0 };
    entry.totalScore += review.score;
    entry.count += 1;
    byDate.set(review.observedAt, entry);
  }
  return Array.from(byDate.entries())
    .map(([label, entry]) => ({
      label,
      avgScore: entry.count > 0 ? Number((entry.totalScore / entry.count).toFixed(2)) : 0,
      reviewCount: entry.count,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildQualityCategories(reviews: ReadonlyArray<ParsedReviewMetric>): ReadonlyArray<QualityCategoryRow> {
  const counts = new Map<string, { count: number; severity: 'critical' | 'serious' | 'moderate' }>();
  for (const review of reviews) {
    const severity = review.criticalIssues > 0 ? 'critical' : review.seriousIssues > 0 ? 'serious' : 'moderate';
    const entry = counts.get(review.category) ?? { count: 0, severity };
    entry.count += review.criticalIssues + review.seriousIssues + review.moderateIssues;
    counts.set(review.category, entry);
  }
  return Array.from(counts.entries())
    .map(([category, entry]) => ({ category, count: entry.count, severity: entry.severity }))
    .sort((left, right) => right.count - left.count);
}

export function buildRiskAreas(reviews: ReadonlyArray<ParsedReviewMetric>): ReadonlyArray<RiskAreaRow> {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    if (review.assessment !== 'APPROVED') {
      counts.set(review.category, (counts.get(review.category) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      note: count > 1 ? 'Recurring review friction across tasks' : 'Single recent regression to monitor',
    }))
    .sort((left, right) => right.count - left.count);
}
