import { Injectable, Logger } from '@nestjs/common';
import { CortexService } from '../dashboard/cortex.service';
import type { CortexModelPerformance, CortexWorker } from '../dashboard/cortex.service';
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
    const data = rows.map(this.mapModelPerf);
    return { data, total: data.length };
  }

  public getModelPerformanceById(modelId: string): ModelPerformanceResponseDto | null {
    const rows = this.cortex.getModelPerformance({ model: modelId });
    if (!rows) return null;
    const data = rows.map(this.mapModelPerf);
    return { data, total: data.length };
  }

  // ============================================================
  // Launcher Metrics
  // ============================================================

  public getLauncherMetrics(launcherId?: string): LauncherMetricsResponseDto | null {
    const workers = this.cortex.getWorkers();
    if (!workers) return null;

    const filtered = launcherId
      ? workers.filter((w) => w.launcher === launcherId)
      : workers;

    const grouped = this.groupWorkersByLauncher(filtered);
    const data = Array.from(grouped.entries()).map(([launcher, ws]) =>
      this.aggregateLauncherWorkers(launcher, ws),
    );

    return { data, total: data.length };
  }

  // ============================================================
  // Routing Recommendations
  // ============================================================

  public getRoutingRecommendations(): RoutingRecommendationsResponseDto | null {
    const rows = this.cortex.getModelPerformance();
    if (!rows) return null;

    const byTaskType = this.groupPerfByTaskType(rows);
    const recommendations: RoutingRecommendationDto[] = [];

    for (const [taskType, candidates] of byTaskType.entries()) {
      const best = this.pickBestModel(candidates);
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
      complexity: r.complexity,
      phaseCount: r.phase_count,
      reviewCount: r.review_count,
      avgDurationMinutes: r.avg_duration_minutes,
      totalInputTokens: r.total_input_tokens,
      totalOutputTokens: r.total_output_tokens,
      avgReviewScore: r.avg_review_score,
      avgCostUsd: r.avg_cost_usd,
      failureRate: r.failure_rate,
      lastRun: r.last_run,
    };
  }

  private groupWorkersByLauncher(workers: CortexWorker[]): Map<string, CortexWorker[]> {
    const map = new Map<string, CortexWorker[]>();
    for (const w of workers) {
      const key = w.launcher || 'unknown';
      const existing = map.get(key);
      if (existing) {
        existing.push(w);
      } else {
        map.set(key, [w]);
      }
    }
    return map;
  }

  private aggregateLauncherWorkers(launcher: string, workers: CortexWorker[]): LauncherMetricsDto {
    const total = workers.length;
    const completedCount = workers.filter((w) => this.isWorkerComplete(w)).length;
    const failedCount = workers.filter((w) => this.isWorkerFailed(w)).length;
    const totalCost = workers.reduce((sum, w) => sum + w.cost, 0);
    const totalInputTokens = workers.reduce((sum, w) => sum + w.input_tokens, 0);
    const totalOutputTokens = workers.reduce((sum, w) => sum + w.output_tokens, 0);

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
    return (
      outcome === 'COMPLETE' ||
      outcome === 'IMPLEMENTED' ||
      status === 'done'
    );
  }

  private isWorkerFailed(w: CortexWorker): boolean {
    const outcome = (w.outcome ?? '').toUpperCase();
    const status = (w.status ?? '').toLowerCase();
    return (
      outcome === 'FAILED' ||
      outcome === 'STUCK' ||
      status === 'failed' ||
      status === 'killed'
    );
  }

  private groupPerfByTaskType(rows: CortexModelPerformance[]): Map<string, CortexModelPerformance[]> {
    const map = new Map<string, CortexModelPerformance[]>();
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

  private pickBestModel(candidates: CortexModelPerformance[]): CortexModelPerformance | null {
    if (candidates.length === 0) return null;

    // Primary: highest avg_review_score (nulls sorted last)
    // Secondary: lowest avg_duration_minutes as tiebreaker
    return candidates.reduce((best, current) => {
      const bestScore = best.avg_review_score ?? -1;
      const curScore = current.avg_review_score ?? -1;

      if (curScore > bestScore) return current;
      if (curScore === bestScore) {
        const bestDur = best.avg_duration_minutes ?? Infinity;
        const curDur = current.avg_duration_minutes ?? Infinity;
        return curDur < bestDur ? current : best;
      }
      return best;
    });
  }

  private buildRecommendation(
    taskType: string,
    perf: CortexModelPerformance,
  ): RoutingRecommendationDto {
    let reason: string;
    if (perf.avg_review_score !== null) {
      reason = `Highest avg review score (${perf.avg_review_score.toFixed(1)}/10) across ${perf.phase_count} phases`;
    } else if (perf.avg_duration_minutes !== null) {
      reason = `Fastest avg phase duration (${perf.avg_duration_minutes.toFixed(1)}m) — no review scores available`;
    } else {
      reason = `Only model with data for this task type (${perf.phase_count} phases)`;
    }

    return {
      taskType,
      recommendedModel: perf.model,
      reason,
      avgReviewScore: perf.avg_review_score,
      avgDurationMinutes: perf.avg_duration_minutes,
      evidenceCount: perf.phase_count,
    };
  }
}
