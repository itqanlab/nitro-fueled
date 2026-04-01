import { describe, it, expect } from 'vitest';
import { routeModel } from './router.js';
import type { TaskMeta, Provider, CompatRecord, ModelSelection } from './router.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const claudeProvider: Provider = {
  name: 'anthropic',
  launcher: 'claude',
  available: true,
  models: {
    light: 'claude-haiku-4-5-20251001',
    balanced: 'claude-sonnet-4-6',
    heavy: 'claude-opus-4-6',
  },
};

const glmProvider: Provider = {
  name: 'glm',
  launcher: 'glm',
  available: true,
  models: {
    light: 'zai-coding-plan/glm-4.5-air',
    balanced: 'zai-coding-plan/glm-5.1',
    heavy: 'zai-coding-plan/glm-5.1',
  },
};

const unavailableProvider: Provider = {
  name: 'opencode',
  launcher: 'opencode',
  available: false,
  models: { balanced: 'openai/gpt-5.4' },
};

const allProviders: Provider[] = [claudeProvider, glmProvider, unavailableProvider];

const featureTask: TaskMeta = { type: 'FEATURE' };

// ---------------------------------------------------------------------------
// 1. No history — worker-type defaults
// ---------------------------------------------------------------------------

describe('routeModel — no history', () => {
  it('prep worker defaults to claude/claude-sonnet-4-6', () => {
    const result = routeModel(featureTask, 'prep', allProviders, []);
    expect(result.launcher).toBe('claude');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.reason).toContain('default');
  });

  it('implement worker defaults to glm/zai-coding-plan/glm-5.1', () => {
    const result = routeModel(featureTask, 'implement', allProviders, []);
    expect(result.launcher).toBe('glm');
    expect(result.model).toBe('zai-coding-plan/glm-5.1');
    expect(result.reason).toContain('default');
  });

  it('build worker defaults to claude/claude-sonnet-4-6', () => {
    const result = routeModel(featureTask, 'build', allProviders, []);
    expect(result.launcher).toBe('claude');
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('review worker defaults to claude/claude-sonnet-4-6', () => {
    const result = routeModel(featureTask, 'review', allProviders, []);
    expect(result.launcher).toBe('claude');
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('falls back to first available provider when default launcher is unavailable', () => {
    // Only glm available
    const result = routeModel(featureTask, 'prep', [glmProvider], []);
    expect(result.launcher).toBe('glm');
    expect(result.reason).toContain('fallback');
  });

  it('returns no-provider result when providers list is empty', () => {
    const result = routeModel(featureTask, 'build', [], []);
    expect(result.provider).toBe('unknown');
    expect(result.reason).toContain('no available providers');
  });
});

// ---------------------------------------------------------------------------
// 2. With history — weighted scoring
// ---------------------------------------------------------------------------

describe('routeModel — history-based scoring', () => {
  const historyClaudeGood: CompatRecord[] = [
    { launcher_type: 'claude', model: 'claude-sonnet-4-6', task_type: 'FEATURE', outcome: 'success', duration_ms: 300_000, cost_estimate: 0.85 },
    { launcher_type: 'claude', model: 'claude-sonnet-4-6', task_type: 'FEATURE', outcome: 'success', duration_ms: 280_000, cost_estimate: 0.90 },
  ];

  const historyGlmBad: CompatRecord[] = [
    { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'FEATURE', outcome: 'failed', duration_ms: 600_000, cost_estimate: 0.0 },
    { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'FEATURE', outcome: 'failed', duration_ms: 620_000, cost_estimate: 0.0 },
  ];

  it('prefers provider with higher success rate', () => {
    const history = [...historyClaudeGood, ...historyGlmBad];
    const result = routeModel(featureTask, 'build', allProviders, history);
    expect(result.launcher).toBe('claude');
    expect(result.reason).toContain('history-based');
  });

  it('picks best scored candidate across all history records', () => {
    // GLM: 100% success, free → high score
    const history: CompatRecord[] = [
      { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'FEATURE', outcome: 'success', duration_ms: 200_000, cost_estimate: 0.0 },
      { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'FEATURE', outcome: 'success', duration_ms: 210_000, cost_estimate: 0.0 },
      { launcher_type: 'claude', model: 'claude-sonnet-4-6', task_type: 'FEATURE', outcome: 'success', duration_ms: 400_000, cost_estimate: 1.50 },
    ];
    const result = routeModel(featureTask, 'build', allProviders, history);
    expect(result.launcher).toBe('glm');
  });

  it('ignores history for a different task_type', () => {
    const bugfixHistory: CompatRecord[] = [
      { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'BUGFIX', outcome: 'success', duration_ms: 200_000, cost_estimate: 0.0 },
    ];
    // FEATURE task — no matching history → falls back to defaults
    const result = routeModel(featureTask, 'build', allProviders, bugfixHistory);
    expect(result.reason).toContain('default');
  });

  it('skips unavailable providers even if they have the best history', () => {
    const history: CompatRecord[] = [
      { launcher_type: 'opencode', model: 'openai/gpt-5.4', task_type: 'FEATURE', outcome: 'success', duration_ms: 100_000, cost_estimate: 0.5 },
      { launcher_type: 'claude', model: 'claude-sonnet-4-6', task_type: 'FEATURE', outcome: 'success', duration_ms: 300_000, cost_estimate: 0.85 },
    ];
    const result = routeModel(featureTask, 'build', allProviders, history);
    expect(result.launcher).not.toBe('opencode');
  });
});

// ---------------------------------------------------------------------------
// 3. Tier override
// ---------------------------------------------------------------------------

describe('routeModel — preferred_tier override', () => {
  it('light tier selects the light model from first available provider', () => {
    const task: TaskMeta = { type: 'FEATURE', preferred_tier: 'light' };
    const result = routeModel(task, 'build', allProviders, []);
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.reason).toContain('preferred_tier override: light');
  });

  it('balanced tier selects the balanced model', () => {
    const task: TaskMeta = { type: 'FEATURE', preferred_tier: 'balanced' };
    const result = routeModel(task, 'build', allProviders, []);
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.reason).toContain('preferred_tier override: balanced');
  });

  it('heavy tier selects the heavy model', () => {
    const task: TaskMeta = { type: 'FEATURE', preferred_tier: 'heavy' };
    const result = routeModel(task, 'build', allProviders, []);
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.reason).toContain('preferred_tier override: heavy');
  });

  it('auto tier falls through to defaults', () => {
    const task: TaskMeta = { type: 'FEATURE', preferred_tier: 'auto' };
    const result = routeModel(task, 'build', allProviders, []);
    expect(result.reason).toContain('default');
  });

  it('tier override takes precedence over history', () => {
    const task: TaskMeta = { type: 'FEATURE', preferred_tier: 'heavy' };
    const history: CompatRecord[] = [
      { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'FEATURE', outcome: 'success', duration_ms: 100_000, cost_estimate: 0.0 },
    ];
    const result = routeModel(task, 'build', allProviders, history);
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.reason).toContain('preferred_tier override');
  });
});

// ---------------------------------------------------------------------------
// 4. Model override
// ---------------------------------------------------------------------------

describe('routeModel — model override', () => {
  it('forces the specified model when a provider exposes it', () => {
    const task: TaskMeta = { type: 'FEATURE', model: 'claude-opus-4-6' };
    const result = routeModel(task, 'build', allProviders, []);
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.reason).toContain('task model override');
  });

  it('model override takes precedence over tier and history', () => {
    const task: TaskMeta = { type: 'FEATURE', model: 'claude-opus-4-6', preferred_tier: 'light' };
    const history: CompatRecord[] = [
      { launcher_type: 'glm', model: 'zai-coding-plan/glm-5.1', task_type: 'FEATURE', outcome: 'success', duration_ms: 100_000, cost_estimate: 0.0 },
    ];
    const result = routeModel(task, 'build', allProviders, history);
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.reason).toContain('task model override');
  });

  it('falls through when overridden model is not in any available provider', () => {
    const task: TaskMeta = { type: 'FEATURE', model: 'nonexistent/model-99' };
    const result = routeModel(task, 'build', allProviders, []);
    // Falls through to default
    expect(result.reason).toContain('default');
  });

  it('ignores "default" as a model value', () => {
    const task: TaskMeta = { type: 'FEATURE', model: 'default' };
    const result = routeModel(task, 'build', allProviders, []);
    expect(result.reason).toContain('default');
    expect(result.reason).not.toContain('task model override');
  });
});

// ---------------------------------------------------------------------------
// 5. Provider availability check
// ---------------------------------------------------------------------------

describe('routeModel — provider availability', () => {
  it('excludes unavailable providers from all selection paths', () => {
    const result = routeModel(featureTask, 'build', allProviders, []);
    expect(result.provider).not.toBe('opencode');
    expect(result.launcher).not.toBe('opencode');
  });

  it('all providers unavailable — returns unknown provider marker', () => {
    const onlyUnavailable: Provider[] = [unavailableProvider];
    const result = routeModel(featureTask, 'build', onlyUnavailable, []);
    expect(result.provider).toBe('unknown');
    expect(result.reason).toContain('no available providers');
  });

  it('returns correct selection when only one provider is available', () => {
    const result = routeModel(featureTask, 'implement', [glmProvider], []);
    expect(result.provider).toBe('glm');
    expect(result.launcher).toBe('glm');
  });
});
