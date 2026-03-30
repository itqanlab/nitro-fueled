import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  public overview: ReportsOverview = EMPTY_REPORTS_OVERVIEW;
  public loading = true;
  public unavailable = false;
  public from = '';
  public to = '';
  public sessionCostMax = 0;
  public successRateMax = 100;
  public costTrendMax = 0;
  public qualityReviewMax = 0;

  public ngOnInit(): void {
    this.load();
  }

  public applyRange(): void {
    this.load();
  }

  public resetRange(): void {
    this.from = '';
    this.to = '';
    this.load();
  }

  public exportSessionReport(): void {
    downloadCsv('session-report.csv', ['Session', 'Started', 'Completed', 'Failed', 'Minutes', 'Cost', 'Model', 'Retries', 'Compactions'], this.overview.sessionReport.rows.map((row) => [row.sessionId, row.startedAt, row.tasksCompleted, row.tasksFailed, row.durationMinutes, row.totalCost, row.primaryModel, row.retryCount, row.compactionCount]));
  }

  public exportSuccessReport(): void {
    downloadCsv('task-success-rate-report.csv', ['Dimension', 'Label', 'Total', 'Complete', 'Failed', 'Blocked', 'Success Rate'], this.overview.successRateReport.rows.map((row) => [row.dimension, row.label, row.total, row.completeCount, row.failureCount, row.blockedCount, row.successRate]));
  }

  public exportCostReport(): void {
    downloadCsv('cost-analysis-report.csv', ['Task Type', 'Total Cost', 'Task Count', 'Avg Cost/Task'], this.overview.costAnalysisReport.taskTypeBreakdown.map((row) => [row.taskType, row.totalCost, row.taskCount, row.avgCostPerTask]));
  }

  public exportModelReport(): void {
    downloadCsv('model-performance-report.csv', ['Model', 'Task Type', 'Complexity', 'Avg Review Score', 'Failure Rate', 'Avg Duration', 'Avg Cost', 'Quality/$'], this.overview.modelPerformanceReport.rows.map((row) => [row.model, row.taskType, row.complexity, row.avgReviewScore, row.failureRate, row.avgDurationMinutes, row.avgCostUsd, row.qualityPerDollar]));
  }

  public exportQualityReport(): void {
    downloadCsv('quality-trends-report.csv', ['Category', 'Count', 'Severity'], this.overview.qualityTrendsReport.categories.map((row) => [row.category, row.count, row.severity]));
  }

  private load(): void {
    this.loading = true;
    this.api.getReportsOverview({ from: this.from || undefined, to: this.to || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.loading = false;
          this.unavailable = false;
          this.overview = overview;
          this.from = overview.dateRange.from ?? this.from;
          this.to = overview.dateRange.to ?? this.to;
          this.sessionCostMax = Math.max(1, ...overview.sessionReport.trend.map((point) => point.totalCost));
          this.costTrendMax = Math.max(1, ...overview.costAnalysisReport.trend.map((point) => point.cost));
          this.qualityReviewMax = Math.max(1, ...overview.qualityTrendsReport.trend.map((point) => point.reviewCount));
        },
        error: () => {
          this.loading = false;
          this.unavailable = true;
          this.overview = EMPTY_REPORTS_OVERVIEW;
          this.sessionCostMax = 0;
          this.costTrendMax = 0;
          this.qualityReviewMax = 0;
        },
      });
  }
}
