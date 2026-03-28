import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { MockDataService } from '../../services/mock-data.service';
import { AnalyticsData, FilterPeriod } from '../../models/analytics.model';

const DAILY_BUDGET_MAX = 50;

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [NgClass, DecimalPipe],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent {
  private readonly mockData = inject(MockDataService);

  public readonly data: AnalyticsData = this.mockData.getAnalyticsPageData();

  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedPeriod: FilterPeriod = '30d';
  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedClient = 'All Clients';
  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedTeam = 'All Teams';
  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedProject = 'All Projects';

  public readonly dailyCostBars = this.data.dailyCosts.map((e) => ({
    day: e.day,
    amount: e.amount,
    heightPercent: Math.min(100, (e.amount / DAILY_BUDGET_MAX) * 100),
    colorClass: e.amount > this.data.dailyBudgetLimit ? 'bar-over-budget' : 'bar-normal',
  }));

  public readonly teamCardsView = this.data.teamBreakdowns.map((t) => {
    const ratio = t.budgetUsed / t.budgetTotal;
    return {
      ...t,
      budgetPercent: Math.min(100, ratio * 100),
      budgetClass: ratio >= 0.9 ? 'bar-danger' : ratio >= 0.7 ? 'bar-warn' : 'bar-normal',
      avgCostFormatted: t.avgCost.toFixed(2),
    };
  });

  public readonly agentRows = this.data.agentPerformance.map((a) => ({
    ...a,
    badgeClass: a.successRate >= 90 ? 'badge-high' : a.successRate >= 80 ? 'badge-medium' : 'badge-low',
  }));

  public readonly clientBars = this.data.clientCosts.map((c) => ({
    ...c,
    budgetPercent: Math.min(100, (c.amount / c.budget) * 100),
  }));

  public readonly budgetLineBottom = Math.min(
    100,
    (this.data.dailyBudgetLimit / DAILY_BUDGET_MAX) * 100,
  );

  public selectPeriod(period: FilterPeriod): void {
    this.selectedPeriod = period;
  }

  public onClientChange(event: Event): void {
    this.selectedClient = (event.target as HTMLSelectElement).value;
  }

  public onTeamChange(event: Event): void {
    this.selectedTeam = (event.target as HTMLSelectElement).value;
  }

  public onProjectChange(event: Event): void {
    this.selectedProject = (event.target as HTMLSelectElement).value;
  }

  public getTrendClass(card: AnalyticsData['statCards'][number]): string {
    if (!card.trend) return '';
    const { direction, goodWhenDown } = card.trend;
    if (goodWhenDown) {
      return direction === 'down' ? 'trend-up' : 'trend-down';
    }
    return direction === 'up' ? 'trend-up' : 'trend-down';
  }
}
