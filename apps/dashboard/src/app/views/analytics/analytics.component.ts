import { Component, inject } from '@angular/core';
import { NgFor, NgIf, NgClass, DecimalPipe } from '@angular/common';
import { MockDataService } from '../../services/mock-data.service';
import { AnalyticsData, FilterPeriod } from '../../models/analytics.model';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DecimalPipe],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent {
  private readonly mockData = inject(MockDataService);

  public readonly data: AnalyticsData = this.mockData.getAnalyticsPageData();

  public readonly maxDailyCost: number = Math.max(
    ...this.data.dailyCosts.map((e) => e.amount),
  );

  public selectedPeriod: FilterPeriod = '30d';
  public selectedClient = 'All Clients';
  public selectedTeam = 'All Teams';
  public selectedProject = 'All Projects';

  public selectPeriod(period: FilterPeriod): void {
    this.selectedPeriod = period;
  }

  public getSuccessRateClass(rate: number): string {
    if (rate >= 90) return 'badge-high';
    if (rate >= 80) return 'badge-medium';
    return 'badge-low';
  }

  public getBudgetClass(budgetUsed: number, budgetTotal: number): string {
    const percent = (budgetUsed / budgetTotal) * 100;
    if (percent > 90) return 'bar-danger';
    if (percent >= 70) return 'bar-warn';
    return 'bar-normal';
  }

  public getBarColor(amount: number, limit: number): string {
    return amount > limit ? 'bar-over-budget' : 'bar-normal';
  }

  public getBarHeightPercent(amount: number): number {
    return (amount / this.maxDailyCost) * 100;
  }

  public getBudgetPercent(budgetUsed: number, budgetTotal: number): number {
    return Math.min((budgetUsed / budgetTotal) * 100, 100);
  }
}
