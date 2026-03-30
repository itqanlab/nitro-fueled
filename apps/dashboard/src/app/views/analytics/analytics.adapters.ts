import { AnalyticsData, AnalyticsStatCard, ProviderCost } from '../../models/analytics.model';
import type {
  AnalyticsCostData,
  AnalyticsModelsData,
} from '../../models/api.types';

const PROVIDER_COLOR_CLASSES = ['blue', 'green', 'orange', 'gray'] as const;

export const FALLBACK_ANALYTICS_DATA: AnalyticsData = {
  statCards: [],
  providerCosts: [],
  clientCosts: [],
  agentPerformance: [],
  dailyCosts: [],
  dailyBudgetLimit: 50,
  teamBreakdowns: [],
  filterOptions: { clients: [], teams: [], projects: [] },
};

export function buildAnalyticsData(
  cost: AnalyticsCostData | null,
  models: AnalyticsModelsData | null,
): AnalyticsData {
  const statCards: AnalyticsStatCard[] = [];

  if (cost) {
    statCards.push({
      label: 'Cumulative Cost',
      value: `$${cost.cumulativeCost.toFixed(2)}`,
      trend: { direction: 'up', percent: 0, goodWhenDown: true },
      sub: 'total spend',
      colorKey: 'warning',
    });
    statCards.push({
      label: 'Hypothetical Opus',
      value: `$${cost.hypotheticalOpusCost.toFixed(2)}`,
      sub: 'if all on Opus',
      colorKey: 'text-secondary',
    });
  }

  if (models) {
    statCards.push({
      label: 'Model Savings',
      value: `$${models.actualSavings.toFixed(2)}`,
      trend: { direction: 'up', percent: 0, goodWhenDown: false },
      sub: 'vs Opus baseline',
      colorKey: 'success',
    });
  }

  const dailyCosts = (cost?.sessions ?? [])
    .slice(-30)
    .map((session, index) => ({ day: index + 1, amount: session.totalCost }));

  const totalModelCost = models?.totalCost ?? 0;
  const providerCosts: ProviderCost[] = (models?.models ?? []).map((m, index) => ({
    name: m.model,
    percent: totalModelCost > 0 ? Math.min(100, (m.totalCost / totalModelCost) * 100) : 0,
    amount: m.totalCost,
    colorClass: PROVIDER_COLOR_CLASSES[index % PROVIDER_COLOR_CLASSES.length],
  }));

  return {
    statCards,
    providerCosts,
    clientCosts: [],
    agentPerformance: [],
    dailyCosts,
    dailyBudgetLimit: 50,
    teamBreakdowns: [],
    filterOptions: { clients: [], teams: [], projects: [] },
  };
}
