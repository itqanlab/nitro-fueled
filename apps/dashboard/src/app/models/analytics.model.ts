export type TrendDirection = 'up' | 'down' | 'neutral';

export interface AnalyticsTrend {
  readonly direction: TrendDirection;
  readonly percent: number;
}

export interface AnalyticsStatCard {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly trend?: AnalyticsTrend;
  readonly sub: string;
  readonly colorVar: string;
}

export interface ProviderCost {
  readonly name: string;
  readonly percent: number;
  readonly amount: number;
  readonly colorClass: 'blue' | 'green' | 'orange' | 'gray';
}

export interface ClientCost {
  readonly name: string;
  readonly amount: number;
  readonly budget: number;
  readonly barColorVar: string;
}

export interface AgentPerformance {
  readonly name: string;
  readonly online: boolean;
  readonly tasks: number;
  readonly avgDuration: string;
  readonly tokensPerTask: string;
  readonly costPerTask: number;
  readonly successRate: number;
}

export interface DailyCostEntry {
  readonly day: number;
  readonly amount: number;
}

export interface TeamBreakdown {
  readonly name: string;
  readonly cost: number;
  readonly tasks: number;
  readonly agents: number;
  readonly avgCost: number;
  readonly budgetUsed: number;
  readonly budgetTotal: number;
}

export type FilterPeriod = '7d' | '30d' | 'month' | 'custom';

export interface AnalyticsFilterOptions {
  readonly clients: readonly string[];
  readonly teams: readonly string[];
  readonly projects: readonly string[];
}

export interface AnalyticsData {
  readonly statCards: readonly AnalyticsStatCard[];
  readonly providerCosts: readonly ProviderCost[];
  readonly clientCosts: readonly ClientCost[];
  readonly agentPerformance: readonly AgentPerformance[];
  readonly dailyCosts: readonly DailyCostEntry[];
  readonly dailyBudgetLimit: number;
  readonly teamBreakdowns: readonly TeamBreakdown[];
  readonly filterOptions: AnalyticsFilterOptions;
}
