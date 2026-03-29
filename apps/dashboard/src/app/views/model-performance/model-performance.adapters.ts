import type { CortexModelPerformance } from '../../../../../dashboard-api/src/dashboard/cortex.types';

export interface ModelPerfRow {
  model: string;
  taskType: string;
  complexity: string | null;
  phaseCount: number;
  reviewCount: number;
  avgDurationMin: number | null;
  avgReviewScore: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  failureRate: number | null;
  lastRun: string | null;
  qualityPerDollar: number | null;
  scoreClass: 'score-high' | 'score-mid' | 'score-low';
}

export const FALLBACK_MODEL_PERF_ROWS: ModelPerfRow[] = [];

function computeScoreClass(score: number | null): 'score-high' | 'score-mid' | 'score-low' {
  if (score === null) return 'score-low';
  if (score >= 4) return 'score-high';
  if (score >= 3) return 'score-mid';
  return 'score-low';
}

/**
 * Compute quality per dollar using the actual avg_cost_usd from the DB.
 * Falls back to null if cost data is unavailable or zero.
 */
function computeQualityPerDollar(
  score: number | null,
  avgCostUsd: number | null,
): number | null {
  if (score === null || avgCostUsd === null || avgCostUsd <= 0) return null;
  return score / avgCostUsd;
}

export function adaptModelPerformance(
  raw: CortexModelPerformance[] | null,
): ModelPerfRow[] {
  if (!raw) return FALLBACK_MODEL_PERF_ROWS;
  return raw.map((item): ModelPerfRow => ({
    model: item.model,
    taskType: item.task_type ?? 'unknown',
    complexity: item.complexity ?? null,
    phaseCount: item.phase_count,
    reviewCount: item.review_count,
    avgDurationMin: item.avg_duration_minutes,
    avgReviewScore: item.avg_review_score,
    totalInputTokens: item.total_input_tokens,
    totalOutputTokens: item.total_output_tokens,
    failureRate: item.failure_rate ?? null,
    lastRun: item.last_run ?? null,
    qualityPerDollar: computeQualityPerDollar(
      item.avg_review_score,
      item.avg_cost_usd ?? null,
    ),
    scoreClass: computeScoreClass(item.avg_review_score),
  }));
}
