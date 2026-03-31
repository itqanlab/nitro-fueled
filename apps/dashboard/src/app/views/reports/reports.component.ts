import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { EMPTY_REPORTS_OVERVIEW, type ReportsOverview } from '../../models/reports.model';
import { downloadCsv } from './reports-export';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [DecimalPipe, FormsModule, NgClass],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<{ from: string | undefined; to: string | undefined }>();

  public readonly from = signal('');
  public readonly to = signal('');
  public readonly overview = signal<ReportsOverview>(EMPTY_REPORTS_OVERVIEW);
  public readonly loading = signal(true);
  public readonly unavailable = signal(false);

  public readonly sessionCostMax = computed(() => {
    const points = this.overview().sessionReport.trend;
    return points.length > 0 ? points.reduce((max, point) => Math.max(max, point.totalCost), 1) : 1;
  });

  public readonly costTrendMax = computed(() => {
    const points = this.overview().costAnalysisReport.trend;
    return points.length > 0 ? points.reduce((max, point) => Math.max(max, point.cost), 1) : 1;
  });

  public readonly qualityReviewMax = computed(() => {
    const points = this.overview().qualityTrendsReport.trend;
    return points.length > 0 ? points.reduce((max, point) => Math.max(max, point.reviewCount), 1) : 1;
  });

  public constructor() {
    this.reload$
      .pipe(
        switchMap((params) => this.api.getReportsOverview(params)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.loading.set(false);
          this.unavailable.set(false);
          this.overview.set(data);
          if (data.dateRange.from) this.from.set(data.dateRange.from);
          if (data.dateRange.to) this.to.set(data.dateRange.to);
        },
        error: () => {
          this.loading.set(false);
          this.unavailable.set(true);
          this.overview.set(EMPTY_REPORTS_OVERVIEW);
        },
      });
    this.load();
  }

  public applyRange(): void {
    this.load();
  }

  public resetRange(): void {
    this.from.set('');
    this.to.set('');
    this.load();
  }

  public exportSessionReport(): void {
    downloadCsv('session-report.csv', ['Session', 'Started', 'Completed', 'Failed', 'Minutes', 'Cost', 'Model', 'Retries', 'Compactions'], this.overview().sessionReport.rows.map((row) => [row.sessionId, row.startedAt, row.tasksCompleted, row.tasksFailed, row.durationMinutes, row.totalCost, row.primaryModel, row.retryCount, row.compactionCount]));
  }

  public exportSuccessReport(): void {
    downloadCsv('task-success-rate-report.csv', ['Dimension', 'Label', 'Total', 'Complete', 'Failed', 'Blocked', 'Success Rate'], this.overview().successRateReport.rows.map((row) => [row.dimension, row.label, row.total, row.completeCount, row.failureCount, row.blockedCount, row.successRate]));
  }

  public exportCostReport(): void {
    downloadCsv('cost-analysis-report.csv', ['Task Type', 'Total Cost', 'Task Count', 'Avg Cost/Task'], this.overview().costAnalysisReport.taskTypeBreakdown.map((row) => [row.taskType, row.totalCost, row.taskCount, row.avgCostPerTask]));
  }

  public exportModelReport(): void {
    downloadCsv('model-performance-report.csv', ['Model', 'Task Type', 'Complexity', 'Avg Review Score', 'Failure Rate', 'Avg Duration', 'Avg Cost', 'Quality/$'], this.overview().modelPerformanceReport.rows.map((row) => [row.model, row.taskType, row.complexity, row.avgReviewScore, row.failureRate, row.avgDurationMinutes, row.avgCostUsd, row.qualityPerDollar]));
  }

  public exportQualityReport(): void {
    downloadCsv('quality-trends-report.csv', ['Category', 'Count', 'Severity'], this.overview().qualityTrendsReport.categories.map((row) => [row.category, row.count, row.severity]));
  }

  private load(): void {
    this.loading.set(true);
    this.reload$.next({ from: this.from() || undefined, to: this.to() || undefined });
  }
}
