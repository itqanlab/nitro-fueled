import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { AnalyticsData, FilterPeriod, DailyCostBar, TeamCardView, ClientBar } from '../../models/analytics.model';
import type {
  AnalyticsCostData,
  AnalyticsModelsData,
} from '../../models/api.types';
import { buildAnalyticsData, FALLBACK_ANALYTICS_DATA } from './analytics.adapters';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { StatusIndicatorComponent } from '../../shared/status-indicator/status-indicator.component';

const DAILY_BUDGET_MAX = 50;

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [NgClass, DecimalPipe, BadgeComponent, StatusIndicatorComponent],
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

  public selectedPeriod: FilterPeriod = '30d';
  public selectedClient = 'All Clients';
  public selectedTeam = 'All Teams';
  public selectedProject = 'All Projects';

  private sourceData: AnalyticsData = FALLBACK_ANALYTICS_DATA;

  public data: AnalyticsData = FALLBACK_ANALYTICS_DATA;

  public dailyCostBars: readonly DailyCostBar[] = [];

  public teamCardsView: readonly TeamCardView[] = [];

  public agentRows: AnalyticsData['agentPerformance'] = [];

  public clientBars: readonly ClientBar[] = [];

  public budgetLineBottom = 0;

  constructor() {
    effect(() => {
      this.sourceData = this.dataSignal();
      this.recomputeDerived();
    });
  }

  private recomputeDerived(): void {
    const data = this.getFilteredData();

    this.data = data;

    const maxDaily = data.dailyCosts.length
      ? Math.max(...data.dailyCosts.map(e => e.amount))
      : 0;

    this.dailyCostBars = data.dailyCosts.map(e => ({
      day: e.day,
      amount: e.amount,
      heightPercent: maxDaily > 0 ? Math.min(100, (e.amount / maxDaily) * 100) : 0,
      colorClass: e.amount > data.dailyBudgetLimit ? 'bar-over-budget' : 'bar-normal',
    }));

    this.teamCardsView = data.teamBreakdowns.map(t => {
      const ratio = t.budgetTotal > 0 ? t.budgetUsed / t.budgetTotal : 0;
      return {
        ...t,
        budgetPercent: Math.min(100, ratio * 100),
        budgetClass: ratio >= 0.9 ? 'bar-danger' : ratio >= 0.7 ? 'bar-warn' : 'bar-normal',
        avgCostFormatted: t.avgCost.toFixed(2),
      };
    });

    this.agentRows = data.agentPerformance;

    this.clientBars = data.clientCosts.map(c => ({
      ...c,
      budgetPercent: c.budget > 0 ? Math.min(100, (c.amount / c.budget) * 100) : 0,
    }));

    this.budgetLineBottom = Math.min(
      100,
      DAILY_BUDGET_MAX > 0 ? (data.dailyBudgetLimit / DAILY_BUDGET_MAX) * 100 : 0,
    );
  }

  private getFilteredData(): AnalyticsData {
    const dailyCosts =
      this.selectedPeriod === '7d'
        ? this.sourceData.dailyCosts.slice(-7)
        : this.selectedPeriod === '30d'
          ? this.sourceData.dailyCosts.slice(-30)
          : this.sourceData.dailyCosts;

    const clientCosts =
      this.selectedClient === 'All Clients'
        ? this.sourceData.clientCosts
        : this.sourceData.clientCosts.filter(client => client.name === this.selectedClient);

    const teamBreakdowns =
      this.selectedTeam === 'All Teams'
        ? this.sourceData.teamBreakdowns
        : this.sourceData.teamBreakdowns.filter(team => team.name === this.selectedTeam);

    return {
      ...this.sourceData,
      dailyCosts,
      clientCosts,
      teamBreakdowns,
      filterOptions: this.sourceData.filterOptions,
    };
  }

  public selectPeriod(period: FilterPeriod): void {
    this.selectedPeriod = period;
    this.recomputeDerived();
  }

  public onClientChange(event: Event): void {
    this.selectedClient = (event.target as HTMLSelectElement).value;
    this.recomputeDerived();
  }

  public onTeamChange(event: Event): void {
    this.selectedTeam = (event.target as HTMLSelectElement).value;
    this.recomputeDerived();
  }

  public onProjectChange(event: Event): void {
    this.selectedProject = (event.target as HTMLSelectElement).value;
    this.recomputeDerived();
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
