import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { AnalyticsData, FilterPeriod } from '../../models/analytics.model';
import type {
  AnalyticsCostData,
  AnalyticsModelsData,
} from '../../../../dashboard-api/src/dashboard/dashboard.types';
import { buildAnalyticsData, FALLBACK_ANALYTICS_DATA } from './analytics.adapters';

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
  private readonly api = inject(ApiService);

  private readonly costSignal = toSignal(
    this.api.getAnalyticsCost().pipe(catchError(() => of(null as AnalyticsCostData | null))),
    { initialValue: null as AnalyticsCostData | null },
  );

  private readonly modelsSignal = toSignal(
    this.api.getAnalyticsModels().pipe(catchError(() => of(null as AnalyticsModelsData | null))),
    { initialValue: null as AnalyticsModelsData | null },
  );

  private readonly dataSignal = computed<AnalyticsData>(() =>
    buildAnalyticsData(this.costSignal(), this.modelsSignal()),
  );

  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedPeriod: FilterPeriod = '30d';
  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedClient = 'All Clients';
  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedTeam = 'All Teams';
  // Filter state — visual toggle only; data filtering requires real data integration
  public selectedProject = 'All Projects';

  public data: AnalyticsData = FALLBACK_ANALYTICS_DATA;

  public dailyCostBars: Array<{
    day: number;
    amount: number;
    heightPercent: number;
    colorClass: string;
  }> = [];

  public teamCardsView: Array<{
    name: string; cost: number; tasks: number; agents: number;
    avgCost: number; budgetUsed: number; budgetTotal: number;
    budgetPercent: number; budgetClass: string; avgCostFormatted: string;
  }> = [];

  public agentRows: Array<{
    name: string; online: boolean; tasks: number; avgDuration: string;
    tokensPerTask: string; costPerTask: number; successRate: number; badgeClass: string;
  }> = [];

  public clientBars: Array<{
    name: string; amount: number; budget: number; colorClass: string; budgetPercent: number;
  }> = [];

  public budgetLineBottom = 0;

  constructor() {
    effect(() => {
      this.data = this.dataSignal();
      this._recomputeDerived();
    });
  }

  private _recomputeDerived(): void {
    const maxDaily = this.data.dailyCosts.length
      ? Math.max(...this.data.dailyCosts.map(e => e.amount))
      : 0;

    this.dailyCostBars = this.data.dailyCosts.map(e => ({
      day: e.day,
      amount: e.amount,
      heightPercent: maxDaily > 0 ? Math.min(100, (e.amount / maxDaily) * 100) : 0,
      colorClass: e.amount > this.data.dailyBudgetLimit ? 'bar-over-budget' : 'bar-normal',
    }));

    this.teamCardsView = this.data.teamBreakdowns.map(t => {
      const ratio = t.budgetTotal > 0 ? t.budgetUsed / t.budgetTotal : 0;
      return {
        ...t,
        budgetPercent: Math.min(100, ratio * 100),
        budgetClass: ratio >= 0.9 ? 'bar-danger' : ratio >= 0.7 ? 'bar-warn' : 'bar-normal',
        avgCostFormatted: t.avgCost.toFixed(2),
      };
    });

    this.agentRows = this.data.agentPerformance.map(a => ({
      ...a,
      badgeClass:
        a.successRate >= 90 ? 'badge-high' : a.successRate >= 80 ? 'badge-medium' : 'badge-low',
    }));

    this.clientBars = this.data.clientCosts.map(c => ({
      ...c,
      budgetPercent: c.budget > 0 ? Math.min(100, (c.amount / c.budget) * 100) : 0,
    }));

    this.budgetLineBottom = Math.min(
      100,
      DAILY_BUDGET_MAX > 0 ? (this.data.dailyBudgetLimit / DAILY_BUDGET_MAX) * 100 : 0,
    );
  }

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
