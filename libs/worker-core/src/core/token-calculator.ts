import type { WorkerCost } from '../types.js';

interface ModelPricing {
  input_per_mtok: number;
  output_per_mtok: number;
  cache_creation_per_mtok: number;
  cache_read_per_mtok: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Claude models
  'claude-opus-4-6': {
    input_per_mtok: 15.0,
    output_per_mtok: 75.0,
    cache_creation_per_mtok: 18.75,
    cache_read_per_mtok: 1.5,
  },
  'claude-sonnet-4-6': {
    input_per_mtok: 3.0,
    output_per_mtok: 15.0,
    cache_creation_per_mtok: 3.75,
    cache_read_per_mtok: 0.3,
  },
  'claude-haiku-4-5-20251001': {
    input_per_mtok: 0.8,
    output_per_mtok: 4.0,
    cache_creation_per_mtok: 1.0,
    cache_read_per_mtok: 0.08,
  },
  // GLM models (Z.AI)
  'glm-5': {
    input_per_mtok: 0.0,
    output_per_mtok: 0.0,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 0.0,
  },
  'glm-4.7': {
    input_per_mtok: 0.0,
    output_per_mtok: 0.0,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 0.0,
  },
  'glm-4.5-air': {
    input_per_mtok: 0.0,
    output_per_mtok: 0.0,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 0.0,
  },
  // OpenAI models (via OpenCode)
  'openai/gpt-5.4': {
    input_per_mtok: 2.5,
    output_per_mtok: 10.0,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 1.25,
  },
  'openai/gpt-4.1': {
    input_per_mtok: 2.0,
    output_per_mtok: 8.0,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 0.5,
  },
  'openai/gpt-4.1-mini': {
    input_per_mtok: 0.4,
    output_per_mtok: 1.6,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 0.1,
  },
  'openai/o4-mini': {
    input_per_mtok: 1.1,
    output_per_mtok: 4.4,
    cache_creation_per_mtok: 0.0,
    cache_read_per_mtok: 0.275,
  },
};

const ZERO_COST_PRICING: ModelPricing = {
  input_per_mtok: 0,
  output_per_mtok: 0,
  cache_creation_per_mtok: 0,
  cache_read_per_mtok: 0,
};

export function calculateCost(
  totalInput: number,
  totalOutput: number,
  totalCacheCreation: number,
  totalCacheRead: number,
  model: string,
): WorkerCost {
  const p = PRICING[model];
  if (!p) {
    console.warn(`[token-calculator] No pricing entry for model "${model}", reporting $0 cost`);
  }
  const pricing = p ?? ZERO_COST_PRICING;
  const inputCost = (totalInput / 1_000_000) * pricing.input_per_mtok;
  const outputCost = (totalOutput / 1_000_000) * pricing.output_per_mtok;
  const cacheCost =
    (totalCacheCreation / 1_000_000) * pricing.cache_creation_per_mtok +
    (totalCacheRead / 1_000_000) * pricing.cache_read_per_mtok;

  return {
    input_usd: round(inputCost),
    output_usd: round(outputCost),
    cache_usd: round(cacheCost),
    total_usd: round(inputCost + outputCost + cacheCost),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
