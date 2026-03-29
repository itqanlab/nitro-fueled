import type { CortexModelPerformance } from '../../../../../dashboard-api/src/dashboard/cortex.types';

export interface ModelPerfRow {
  model: string;
  taskType: string;
  phaseCount: number;
  reviewCount: number;
  avgDurationMin: number | null;
  avgReviewScore: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
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

function computeQualityPerDollar(
  score: number | null,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (score === null) return null;
  const estimatedCost =
    (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  if (estimatedCost === 0) return null;
  return score / estimatedCost;
}

export function adaptModelPerformance(
  raw: CortexModelPerformance[] | null,
): ModelPerfRow[] {
  if (!raw) return FALLBACK_MODEL_PERF_ROWS;
  return raw.map((item): ModelPerfRow => ({
    model: item.model,
    taskType: item.task_type ?? 'unknown',
    phaseCount: item.phase_count,
    reviewCount: item.review_count,
    avgDurationMin: item.avg_duration_minutes,
    avgReviewScore: item.avg_review_score,
    totalInputTokens: item.total_input_tokens,
    totalOutputTokens: item.total_output_tokens,
    qualityPerDollar: computeQualityPerDollar(
      item.avg_review_score,
      item.total_input_tokens,
      item.total_output_tokens,
    ),
    scoreClass: computeScoreClass(item.avg_review_score),
  }));
}
