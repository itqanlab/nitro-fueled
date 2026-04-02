import type {
  AnalyticsModelPerfRow,
  AnalyticsLauncherMetrics,
  AnalyticsRoutingRecommendation,
} from '../../../models/api.types';

// ── Heatmap ───────────────────────────────────────────────────────────────────

export type HeatCellClass = 'heat-high' | 'heat-mid' | 'heat-low' | 'heat-none';

export interface HeatCell {
  readonly score: number | null;
  readonly phaseCount: number;
  readonly reviewCount: number;
  readonly cellClass: HeatCellClass;
  readonly label: string;
}

/** row = model, col = taskType */
export type HeatMatrix = Map<string, Map<string, HeatCell>>;

function cellClass(score: number | null): HeatCellClass {
  if (score === null) return 'heat-none';
  if (score >= 7) return 'heat-high';
  if (score >= 4) return 'heat-mid';
  return 'heat-low';
}

export function buildHeatMatrix(rows: readonly AnalyticsModelPerfRow[]): HeatMatrix {
  const matrix: HeatMatrix = new Map();
  for (const r of rows) {
    const model = r.model;
    const taskType = r.taskType ?? 'unknown';
    if (!matrix.has(model)) matrix.set(model, new Map());
    matrix.get(model)!.set(taskType, {
      score: r.avgReviewScore,
      phaseCount: r.phaseCount,
      reviewCount: r.reviewCount,
      cellClass: cellClass(r.avgReviewScore),
      label: r.avgReviewScore !== null ? r.avgReviewScore.toFixed(1) : '—',
    });
  }
  return matrix;
}

export function uniqueModels(rows: readonly AnalyticsModelPerfRow[]): string[] {
  return [...new Set(rows.map(r => r.model))].sort();
}

export function uniqueTaskTypes(rows: readonly AnalyticsModelPerfRow[]): string[] {
  return [...new Set(rows.map(r => r.taskType ?? 'unknown'))].sort();
}

// ── Launcher cards ─────────────────────────────────────────────────────────────

export interface LauncherCard {
  readonly launcher: string;
  readonly totalWorkers: number;
  readonly completionPct: number;
  readonly failedCount: number;
  readonly totalCostFormatted: string;
  readonly totalTokens: number;
  readonly completionClass: 'rate-high' | 'rate-mid' | 'rate-low';
}

function completionClass(rate: number): 'rate-high' | 'rate-mid' | 'rate-low' {
  if (rate >= 0.8) return 'rate-high';
  if (rate >= 0.5) return 'rate-mid';
  return 'rate-low';
}

export function adaptLauncherCards(items: readonly AnalyticsLauncherMetrics[]): LauncherCard[] {
  return items.map((m): LauncherCard => ({
    launcher: m.launcher,
    totalWorkers: m.totalWorkers,
    completionPct: Math.round(m.completionRate * 100),
    failedCount: m.failedCount,
    totalCostFormatted: `$${m.totalCost.toFixed(2)}`,
    totalTokens: m.totalInputTokens + m.totalOutputTokens,
    completionClass: completionClass(m.completionRate),
  }));
}

// ── Routing recommendation cards ──────────────────────────────────────────────

export interface RecommendationCard {
  readonly taskType: string;
  readonly model: string;
  readonly reason: string;
  readonly scoreLabel: string;
  readonly evidenceCount: number;
  readonly scoreClass: 'score-high' | 'score-mid' | 'score-low' | 'score-none';
}

function recScoreClass(score: number | null): RecommendationCard['scoreClass'] {
  if (score === null) return 'score-none';
  if (score >= 7) return 'score-high';
  if (score >= 4) return 'score-mid';
  return 'score-low';
}

export function adaptRecommendationCards(
  items: readonly AnalyticsRoutingRecommendation[],
): RecommendationCard[] {
  return items.map((r): RecommendationCard => ({
    taskType: r.taskType,
    model: r.recommendedModel,
    reason: r.reason,
    scoreLabel: r.avgBuilderScore !== null ? `${r.avgBuilderScore.toFixed(1)}/10` : 'No score',
    evidenceCount: r.evidenceCount,
    scoreClass: recScoreClass(r.avgBuilderScore),
  }));
}
