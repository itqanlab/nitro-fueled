/**
 * Model Router — Adaptive Provider/Model Selection
 *
 * Pure function module: no DB access, no I/O.
 * Callers supply pre-fetched providers and compatibility history.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkerType = 'prep' | 'implement' | 'build' | 'review' | 'cleanup';

/** Minimal task metadata needed for routing decisions. */
export interface TaskMeta {
  /** Task type string (FEATURE, BUGFIX, REFACTORING, etc.) */
  type: string;
  /**
   * Tier override from task metadata.
   * 'light' | 'balanced' | 'heavy' force a specific model tier.
   * 'auto' or absent → fall through to worker-type defaults.
   */
  preferred_tier?: 'light' | 'balanced' | 'heavy' | 'auto';
  /**
   * Specific model override. When set, forces this exact model
   * regardless of tier, defaults, or history.
   */
  model?: string;
}

/** A provider entry as returned by get_available_providers. */
export interface Provider {
  /** Config key / provider name (e.g. 'anthropic', 'glm') */
  name: string;
  /** Internal launcher identifier (e.g. 'claude', 'glm', 'opencode') */
  launcher: string;
  available: boolean;
  /** Tier-to-model map: { light: '...', balanced: '...', heavy: '...' } */
  models: Record<string, string>;
}

/** A single row from the compatibility table. */
export interface CompatRecord {
  launcher_type: string;
  model: string;
  task_type: string;
  outcome: 'success' | 'failed' | 'killed';
  duration_ms: number | null;
  cost_estimate: number | null;
}

/** The result of a routing decision. */
export interface ModelSelection {
  /** Provider config key (e.g. 'anthropic', 'glm') */
  provider: string;
  /** Internal launcher identifier (e.g. 'claude', 'glm') */
  launcher: string;
  /** Model identifier to pass to the launcher */
  model: string;
  /** Human-readable explanation of why this selection was made */
  reason: string;
}

// ---------------------------------------------------------------------------
// Internal defaults
// ---------------------------------------------------------------------------

/** Worker-type defaults when no compatibility history exists. */
const WORKER_DEFAULTS: Record<WorkerType, { launcher: string; model: string }> = {
  prep:      { launcher: 'claude', model: 'claude-sonnet-4-6' },
  implement: { launcher: 'glm',   model: 'zai-coding-plan/glm-5.1' },
  build:     { launcher: 'claude', model: 'claude-sonnet-4-6' },
  review:    { launcher: 'claude', model: 'claude-sonnet-4-6' },
  cleanup:   { launcher: 'claude', model: 'claude-sonnet-4-6' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a provider by launcher name (internal launcher identifier). */
function findProviderByLauncher(
  launcher: string,
  providers: Provider[],
): Provider | undefined {
  return providers.find((p) => p.launcher === launcher && p.available);
}

/** Find a provider by its config key name. */
function findProviderByName(
  name: string,
  providers: Provider[],
): Provider | undefined {
  return providers.find((p) => p.name === name && p.available);
}

/**
 * Given a specific model string, find the first available provider
 * that exposes this model in its models map (any tier).
 */
function findProviderForModel(
  model: string,
  providers: Provider[],
): Provider | undefined {
  return providers.find(
    (p) => p.available && Object.values(p.models).includes(model),
  );
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface GroupStats {
  launcher_type: string;
  model: string;
  success_rate: number;
  avg_cost: number | null;
  avg_duration_ms: number | null;
}

function aggregateHistory(records: CompatRecord[]): GroupStats[] {
  const groups = new Map<string, CompatRecord[]>();
  for (const rec of records) {
    const key = `${rec.launcher_type}::${rec.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rec);
  }

  return Array.from(groups.entries()).map(([key, recs]) => {
    const [launcher_type, model] = key.split('::');
    const total = recs.length;
    const successes = recs.filter((r) => r.outcome === 'success').length;

    const costsWithValues = recs.filter((r) => r.cost_estimate !== null);
    const avg_cost =
      costsWithValues.length > 0
        ? costsWithValues.reduce((s, r) => s + (r.cost_estimate ?? 0), 0) / costsWithValues.length
        : null;

    const durationsWithValues = recs.filter((r) => r.duration_ms !== null);
    const avg_duration_ms =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / durationsWithValues.length
        : null;

    return {
      launcher_type: launcher_type!,
      model: model!,
      success_rate: total > 0 ? successes / total : 0,
      avg_cost,
      avg_duration_ms,
    };
  });
}

/**
 * Score each group using:
 *   score = 0.4 * success_rate + 0.3 * cost_efficiency + 0.3 * duration_efficiency
 *
 * cost_efficiency:    0 cost (free) = 1.0; higher cost = lower score.
 * duration_efficiency: shorter duration = higher score.
 * Null values are treated as 0 (best possible) for that dimension.
 */
function scoreGroups(
  groups: GroupStats[],
): Array<GroupStats & { score: number }> {
  const maxCost = Math.max(
    ...groups.map((g) => g.avg_cost ?? 0),
    Number.EPSILON,
  );
  const maxDuration = Math.max(
    ...groups.map((g) => g.avg_duration_ms ?? 0),
    Number.EPSILON,
  );

  return groups.map((g) => {
    const cost_eff = g.avg_cost === null ? 1.0 : 1 - g.avg_cost / maxCost;
    const dur_eff = g.avg_duration_ms === null ? 1.0 : 1 - g.avg_duration_ms / maxDuration;
    const score = 0.4 * g.success_rate + 0.3 * cost_eff + 0.3 * dur_eff;
    return { ...g, score };
  });
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

/**
 * Select the best provider/model/launcher for a given task + worker type.
 *
 * Priority order:
 *   1. task.model override  → forces exact model, find first available provider
 *   2. task.preferred_tier  → map tier to model via get_available_providers tiers
 *   3. History scoring      → weighted scoring on compatibility records
 *   4. Worker-type defaults → hardcoded defaults when no history exists
 *
 * Unavailable providers are never returned.
 */
export function routeModel(
  task: TaskMeta,
  workerType: WorkerType,
  providers: Provider[],
  history: CompatRecord[],
): ModelSelection {
  const availableProviders = providers.filter((p) => p.available);

  // ── 1. Explicit model override ────────────────────────────────────────────
  if (task.model && task.model !== 'default' && task.model !== '') {
    const provider = findProviderForModel(task.model, availableProviders);
    if (provider) {
      return {
        provider: provider.name,
        launcher: provider.launcher,
        model: task.model,
        reason: `task model override: ${task.model}`,
      };
    }
    // Model override specified but no provider has it — fall through
  }

  // ── 2. Preferred tier override ────────────────────────────────────────────
  const tier = task.preferred_tier;
  if (tier && tier !== 'auto') {
    for (const provider of availableProviders) {
      const model = provider.models[tier];
      if (model) {
        return {
          provider: provider.name,
          launcher: provider.launcher,
          model,
          reason: `preferred_tier override: ${tier} → ${model}`,
        };
      }
    }
    // Tier requested but no provider can satisfy it — fall through
  }

  // ── 3. Adaptive routing from compatibility history ─────────────────────────
  const taskHistory = history.filter((r) => r.task_type === task.type);
  if (taskHistory.length > 0) {
    const groups = aggregateHistory(taskHistory);
    const scored = scoreGroups(groups).sort((a, b) => b.score - a.score);

    for (const candidate of scored) {
      const provider = findProviderByLauncher(candidate.launcher_type, availableProviders)
        ?? findProviderByName(candidate.launcher_type, availableProviders);
      if (provider) {
        return {
          provider: provider.name,
          launcher: candidate.launcher_type,
          model: candidate.model,
          reason: `history-based routing: score=${candidate.score.toFixed(2)} (success=${(candidate.success_rate * 100).toFixed(0)}%)`,
        };
      }
    }
  }

  // ── 4. Worker-type defaults ───────────────────────────────────────────────
  const defaults = WORKER_DEFAULTS[workerType];

  // Try the default launcher first
  const defaultProvider = findProviderByLauncher(defaults.launcher, availableProviders);
  if (defaultProvider) {
    return {
      provider: defaultProvider.name,
      launcher: defaults.launcher,
      model: defaults.model,
      reason: `default for ${workerType} worker`,
    };
  }

  // Fall back to any available provider
  const fallback = availableProviders[0];
  if (fallback) {
    const fallbackModel =
      fallback.models['balanced'] ?? fallback.models['heavy'] ?? fallback.models['light'] ?? defaults.model;
    return {
      provider: fallback.name,
      launcher: fallback.launcher,
      model: fallbackModel,
      reason: `fallback: default launcher '${defaults.launcher}' unavailable, using first available provider`,
    };
  }

  // No providers available at all — return defaults with unavailable marker
  return {
    provider: 'unknown',
    launcher: defaults.launcher,
    model: defaults.model,
    reason: `no available providers — returning default for ${workerType} worker (UNAVAILABLE)`,
  };
}
