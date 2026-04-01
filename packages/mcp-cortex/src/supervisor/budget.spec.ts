import { describe, it, expect } from 'vitest';
import { getCostBudget, checkBudget, shouldKill } from './budget.js';

describe('getCostBudget', () => {
  it('returns $3 for Simple by default', () => {
    expect(getCostBudget('Simple')).toBe(3);
  });

  it('returns $8 for Medium by default', () => {
    expect(getCostBudget('Medium')).toBe(8);
  });

  it('returns $15 for Complex by default', () => {
    expect(getCostBudget('Complex')).toBe(15);
  });

  it('falls back to Medium budget for unknown complexity', () => {
    expect(getCostBudget('Unknown')).toBe(8);
  });

  it('respects session config override', () => {
    const config = { budgets: { Simple: 1, Medium: 5, Complex: 20 } };
    expect(getCostBudget('Simple', config)).toBe(1);
    expect(getCostBudget('Medium', config)).toBe(5);
    expect(getCostBudget('Complex', config)).toBe(20);
  });

  it('falls back to default when complexity not in session config budgets', () => {
    const config = { budgets: { Medium: 10 } };
    expect(getCostBudget('Simple', config)).toBe(3);
  });
});

describe('checkBudget', () => {
  it('returns not exceeded when cost is below limit', () => {
    const costJson = JSON.stringify({ input_usd: 0.5, output_usd: 0.5, cache_usd: 0, total_usd: 1.0 });
    const result = checkBudget(costJson, 'Simple');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(1.0);
    expect(result.limit).toBe(3);
    expect(result.overage).toBe(0);
  });

  it('returns exceeded when cost is above limit', () => {
    const costJson = JSON.stringify({ input_usd: 2, output_usd: 2, cache_usd: 0.5, total_usd: 4.5 });
    const result = checkBudget(costJson, 'Simple');
    expect(result.exceeded).toBe(true);
    expect(result.current).toBe(4.5);
    expect(result.limit).toBe(3);
    expect(result.overage).toBeCloseTo(1.5);
  });

  it('handles malformed cost_json gracefully', () => {
    const result = checkBudget('not-json', 'Simple');
    expect(result.exceeded).toBe(false);
    expect(result.current).toBe(0);
  });

  it('uses session config override for limit', () => {
    const costJson = JSON.stringify({ input_usd: 1, output_usd: 1, cache_usd: 0, total_usd: 2 });
    const config = { budgets: { Simple: 1.5 } };
    const result = checkBudget(costJson, 'Simple', config);
    expect(result.exceeded).toBe(true);
    expect(result.limit).toBe(1.5);
  });
});

describe('shouldKill', () => {
  it('returns false when cost is under budget', () => {
    const costJson = JSON.stringify({ input_usd: 1, output_usd: 0.5, cache_usd: 0, total_usd: 1.5 });
    expect(shouldKill(costJson, 3)).toBe(false);
  });

  it('returns true when cost exceeds budget', () => {
    const costJson = JSON.stringify({ input_usd: 2, output_usd: 2, cache_usd: 1, total_usd: 5 });
    expect(shouldKill(costJson, 3)).toBe(true);
  });

  it('returns false for malformed cost_json', () => {
    expect(shouldKill('bad-json', 3)).toBe(false);
  });

  it('returns false when cost exactly equals budget', () => {
    const costJson = JSON.stringify({ input_usd: 1, output_usd: 1, cache_usd: 1, total_usd: 3 });
    expect(shouldKill(costJson, 3)).toBe(false);
  });
});
