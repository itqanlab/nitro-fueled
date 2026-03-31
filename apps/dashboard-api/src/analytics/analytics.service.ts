import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CortexService } from '../dashboard/cortex.service';
import type { CortexModelPerformance, CortexBuilderQuality, CortexWorker } from '../dashboard/cortex.service';
import type {
  ModelPerformanceRowDto,
  ModelPerformanceResponseDto,
  LauncherMetricsDto,
  LauncherMetricsResponseDto,
  RoutingRecommendationDto,
  RoutingRecommendationsResponseDto,
} from './analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  public constructor(private readonly cortex: CortexService) {}

  // ============================================================
  // Model Performance
  // ============================================================

  public getModelPerformance(filters?: { taskType?: string }): ModelPerformanceResponseDto | null {
    const rows = this.cortex.getModelPerformance({ taskType: filters?.taskType });
    if (!rows) return null;
    const data = rows.map((r) => this.mapModelPerf(r));
    return { data, total: data.length };
  }

  public getModelPerformanceById(modelId: string): ModelPerformanceResponseDto | null {
    const rows = this.cortex.getModelPerformance({ model: modelId });
    if (!rows) return null;
    const data = rows.map((r) => this.mapModelPerf(r));
    return { data, total: data.length };
  }

  // ============================================================
  // Launcher Metrics
  // ============================================================

  public getLauncherMetrics(launcherId: string): LauncherMetricsResponseDto | null {
    const workers = this.cortex.getWorkers({ launcher: launcherId });
    if (!workers) return null;

    if (workers.length === 0) {
      throw new NotFoundException(`No workers found for launcher: ${launcherId}`);
    }

    const data = [this.aggregateLauncherWorkers(launcherId, workers)];
    return { data, total: data.length };
  }

  // ============================================================
  // Routing Recommendations
  // ============================================================

  public getRoutingRecommendations(): RoutingRecommendationsResponseDto | null {
    const qualityRows = this.cortex.getBuilderQuality();
    if (!qualityRows) return null;

    const byTaskType = this.groupBuilderQualityByTaskType(qualityRows);
    const recommendations: RoutingRecommendationDto[] = [];

    for (const [taskType, candidates] of byTaskType.entries()) {
      const best = this.pickBestBuilderModel(candidates);
      if (!best) continue;
      recommendations.push(this.buildRecommendation(taskType, best));
    }

    recommendations.sort((a, b) => a.taskType.localeCompare(b.taskType));
    return { recommendations, total: recommendations.length };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private mapModelPerf(r: CortexModelPerformance): ModelPerformanceRowDto {
    return {
      model: r.model,
      taskType: r.task_type,
      phaseCount: r.phase_count,
      reviewCount: r.review_count,
      avgDurationMinutes: r.avg_duration_minutes,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
      avgReviewScore: r.avg_review_score,
    };
  }

  private aggregateLauncherWorkers(launcher: string, workers: CortexWorker[]): LauncherMetricsDto {
    const total = workers.length;
    const completedCount = workers.filter((w) => this.isWorkerComplete(w)).length;
    const failedCount = workers.filter((w) => this.isWorkerFailed(w)).length;
    const totalCost = workers.reduce((sum, w) => sum + (w.cost ?? 0), 0);
    const totalInputTokens = workers.reduce((sum, w) => sum + (w.input_tokens ?? 0), 0);
    const totalOutputTokens = workers.reduce((sum, w) => sum + (w.output_tokens ?? 0), 0);

    return {
      launcher,
      totalWorkers: total,
      completedCount,
      failedCount,
      completionRate: total > 0 ? completedCount / total : 0,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
    };
  }

  private isWorkerComplete(w: CortexWorker): boolean {
    const outcome = (w.outcome ?? '').toUpperCase();
    const status = (w.status ?? '').toLowerCase();
    return outcome === 'COMPLETE' || outcome === 'IMPLEMENTED' || status === 'done';
  }

  private isWorkerFailed(w: CortexWorker): boolean {
    const outcome = (w.outcome ?? '').toUpperCase();
    const status = (w.status ?? '').toLowerCase();
    return outcome === 'FAILED' || outcome === 'STUCK' || status === 'failed' || status === 'killed';
  }

  private groupBuilderQualityByTaskType(rows: CortexBuilderQuality[]): Map<string, CortexBuilderQuality[]> {
    const map = new Map<string, CortexBuilderQuality[]>();
    for (const r of rows) {
      const key = r.task_type ?? 'UNKNOWN';
      const existing = map.get(key);
      if (existing) {
        existing.push(r);
      } else {
        map.set(key, [r]);
      }
    }
    return map;
  }

  private pickBestBuilderModel(candidates: CortexBuilderQuality[]): CortexBuilderQuality | null {
    if (candidates.length === 0) return null;

    // Primary sort: highest avg_builder_score (nulls sorted last).
    // Tiebreaker: highest review_count (more evidence = more trustworthy).
    return candidates.reduce((best, current) => {
      const bestScore = best.avg_builder_score ?? -1;
      const curScore = current.avg_builder_score ?? -1;

      if (curScore > bestScore) return current;
      if (curScore === bestScore && current.review_count > best.review_count) return current;
      return best;
    });
  }

  private buildRecommendation(taskType: string, quality: CortexBuilderQuality): RoutingRecommendationDto {
    let reason: string;
    if (quality.avg_builder_score !== null) {
      reason = `Best builder quality score (${quality.avg_builder_score.toFixed(1)}/10) across ${quality.review_count} reviewed tasks`;
    } else {
      reason = `Only model with builder data for this task type (${quality.review_count} reviews)`;
    }

    return {
      taskType,
      recommendedModel: quality.model,
      reason,
      avgBuilderScore: quality.avg_builder_score,
      avgDurationMinutes: null,
      evidenceCount: quality.review_count,
    };
  }

  /** @internal exposed for logging in controller — strips newlines and truncates */
  public static sanitizeForLog(value: string): string {
    return value.replace(/[\r\n\t]/g, ' ').slice(0, 200);
  }
}
