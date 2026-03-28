export interface AnalyticsSummary {
  readonly activeTasks: number;
  readonly activeBreakdown: string;
  readonly completedTasks: number;
  readonly completedPeriod: string;
  readonly budgetUsed: number;
  readonly budgetTotal: number;
  readonly budgetAlertPercent: number;
  readonly tokensUsed: string;
  readonly tokensPeriod: string;
  readonly totalCost: number;
  readonly clientCost: number;
  readonly internalCost: number;
}
