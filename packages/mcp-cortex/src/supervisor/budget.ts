import type { WorkerCost } from '../db/schema.js';

export interface BudgetResult {
  exceeded: boolean;
  current: number;
  limit: number;
  overage: number;
}

/** Default cost ceilings in USD per complexity tier. */
const DEFAULT_BUDGETS: Record<string, number> = {
  Simple: 3,
  Medium: 8,
  Complex: 15,
};

/**
 * Returns the max allowed cost in USD for a given complexity level.
 * Override precedence: sessionConfig > defaults.
 */
export function getCostBudget(complexity: string, sessionConfig?: Record<string, unknown>): number {
  if (sessionConfig) {
    const budgets = sessionConfig['budgets'] as Record<string, number> | undefined;
    if (budgets && typeof budgets[complexity] === 'number') {
      return budgets[complexity];
    }
  }
  return DEFAULT_BUDGETS[complexity] ?? DEFAULT_BUDGETS['Medium']!;
}

/**
 * Parses a worker's cost_json and checks it against the budget for the given complexity.
 */
export function checkBudget(
  costJson: string,
  complexity: string,
  sessionConfig?: Record<string, unknown>,
): BudgetResult {
  let cost: WorkerCost;
  try {
    cost = JSON.parse(costJson) as WorkerCost;
  } catch {
    cost = { input_usd: 0, output_usd: 0, cache_usd: 0, total_usd: 0 };
  }

  const current = cost.total_usd ?? 0;
  const limit = getCostBudget(complexity, sessionConfig);
  const exceeded = current > limit;
  const overage = exceeded ? current - limit : 0;

  return { exceeded, current, limit, overage };
}

/**
 * Returns true when a worker's cost has exceeded the given budget.
 */
export function shouldKill(costJson: string, budget: number): boolean {
  let cost: WorkerCost;
  try {
    cost = JSON.parse(costJson) as WorkerCost;
  } catch {
    return false;
  }
  return (cost.total_usd ?? 0) > budget;
}
