import type { WorkerCost } from '../db/schema.js';

/**
 * Context window sizes (in tokens) per model.
 * Used for context_percent calculation: Math.round((lastInputTokens / contextWindow) * 100).
 * If a model is not listed here, DEFAULT_CONTEXT_WINDOW is used.
 */
export const CONTEXT_WINDOWS: Record<string, number> = {
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
  'glm-5': 128_000,
  'glm-4.7': 128_000,
  'glm-4.5-air': 128_000,
  'openai/gpt-5.4': 128_000,
  'openai/gpt-5.4-mini': 128_000,
  'openai/codex-mini-latest': 128_000,
  'openai/gpt-4.1': 128_000,
  'openai/gpt-4.1-mini': 128_000,
  'openai/o4-mini': 128_000,
};

/** Default context window when the model is not in CONTEXT_WINDOWS. */
export const DEFAULT_CONTEXT_WINDOW = 200_000;

interface ModelPricing {
  input_per_mtok: number;
  output_per_mtok: number;
  cache_creation_per_mtok: number;
  cache_read_per_mtok: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': {
    input_per_mtok: 15.0, output_per_mtok: 75.0,
    cache_creation_per_mtok: 18.75, cache_read_per_mtok: 1.5,
  },
  'claude-sonnet-4-6': {
    input_per_mtok: 3.0, output_per_mtok: 15.0,
    cache_creation_per_mtok: 3.75, cache_read_per_mtok: 0.3,
  },
  'claude-haiku-4-5-20251001': {
    input_per_mtok: 0.8, output_per_mtok: 4.0,
    cache_creation_per_mtok: 1.0, cache_read_per_mtok: 0.08,
  },
  'glm-5': {
    input_per_mtok: 0, output_per_mtok: 0,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0,
  },
  'glm-4.7': {
    input_per_mtok: 0, output_per_mtok: 0,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0,
  },
  'glm-4.5-air': {
    input_per_mtok: 0, output_per_mtok: 0,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0,
  },
  'openai/gpt-5.4': {
    input_per_mtok: 2.5, output_per_mtok: 10.0,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 1.25,
  },
  'openai/gpt-5.4-mini': {
    input_per_mtok: 0.4, output_per_mtok: 1.6,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0.1,
  },
  'openai/codex-mini-latest': {
    input_per_mtok: 0.4, output_per_mtok: 1.6,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0.1,
  },
  'openai/gpt-4.1': {
    input_per_mtok: 2.0, output_per_mtok: 8.0,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0.5,
  },
  'openai/gpt-4.1-mini': {
    input_per_mtok: 0.4, output_per_mtok: 1.6,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0.1,
  },
  'openai/o4-mini': {
    input_per_mtok: 1.1, output_per_mtok: 4.4,
    cache_creation_per_mtok: 0, cache_read_per_mtok: 0.275,
  },
};

const ZERO_PRICING: ModelPricing = {
  input_per_mtok: 0, output_per_mtok: 0,
  cache_creation_per_mtok: 0, cache_read_per_mtok: 0,
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
    console.warn(`[token-calculator] No pricing for model "${model}", reporting $0`);
  }
  const pricing = p ?? ZERO_PRICING;
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
