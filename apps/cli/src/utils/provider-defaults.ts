/**
 * Default provider and routing definitions.
 * Extracted from provider-config.ts to keep that file within the 200-line limit.
 */
import type { ProviderEntry, RoutingConfig } from './provider-config.js';

export const DEFAULT_PROVIDERS: Record<string, ProviderEntry> = {
  anthropic: {
    launcher: 'claude',
    models: {
      heavy: 'claude-opus-4-6',
      balanced: 'claude-sonnet-4-6',
      light: 'claude-haiku-4-5-20251001',
    },
  },
  zai: {
    launcher: 'opencode',
    modelPrefix: 'zai-coding-plan/',
    models: {
      heavy: 'zai-coding-plan/glm-5',
      balanced: 'zai-coding-plan/glm-4.7',
      light: 'zai-coding-plan/glm-4.5-air',
    },
  },
  'openai-opencode': {
    launcher: 'opencode',
    modelPrefix: 'openai/',
    models: {
      heavy: 'openai/gpt-5.4',
      balanced: 'openai/gpt-5.4-mini',
      light: 'openai/gpt-5.4-mini',
    },
  },
  'openai-codex': {
    launcher: 'codex',
    modelPrefix: 'openai/',
    models: {
      heavy: 'openai/gpt-5.4',
      balanced: 'openai/gpt-5.4-mini',
      light: 'openai/codex-mini-latest',
    },
  },
};

export const DEFAULT_ROUTING: RoutingConfig = {
  default: 'anthropic',
  heavy: 'anthropic',
  balanced: 'anthropic',
  light: 'anthropic',
  'review-logic': 'anthropic',
  'review-style': 'anthropic',
  'review-simple': 'anthropic',
  documentation: 'anthropic',
};
