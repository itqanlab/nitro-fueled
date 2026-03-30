import type { NitroFueledConfig, LauncherName } from './provider-config.js';

export type ComplexityTier = 'simple' | 'medium' | 'complex';
export type Confidence = 'high' | 'low';
export type PreferredTier = 'light' | 'balanced' | 'heavy';

export interface ResolvedProvider {
  providerName: string;
  model: string;
  launcher: LauncherName;
}

export interface ComplexityEstimate {
  tier: ComplexityTier;
  confidence: Confidence;
  signals: string[];
  preferredTier: PreferredTier;
}

const COMPLEX_PATTERNS: RegExp[] = [
  /\bscaffold\b/i,
  /\bintegrate\b/i,
  /\bcross[- ]service\b/i,
  /\barchitect/i,
  /\bpipeline\b/i,
  /\bmigrate\s+database\b/i,
  /\bnew\s+subsystem\b/i,
  /\binfrastructure\b/i,
  /\bmulti[- ]service\b/i,
  /\bfull[- ]stack\b/i,
];

const SIMPLE_PATTERNS: RegExp[] = [
  /\bupdate\s+config\b/i,
  /\badd\s+field\b/i,
  /\brename\b/i,
  /\bsingle\s+file\b/i,
  /\bdocumentation\s+update\b/i,
  /\bconfig\s+change\b/i,
  /\btypo\b/i,
  /\bupdate\s+readme\b/i,
  /\badd\s+comment\b/i,
];

const MEDIUM_PATTERNS: RegExp[] = [
  /\badd\s+endpoint\b/i,
  /\bnew\s+endpoint\b/i,
  /\bcreate\s+component\b/i,
  /\bnew\s+component\b/i,
  /\bmigrate\s+command\b/i,
  /\brefactor\b/i,
  /\badd\s+feature\b/i,
  /\bimplement\b/i,
  /\bcreate\s+service\b/i,
];

const TIER_MAP: Record<ComplexityTier, PreferredTier> = {
  simple: 'light',
  medium: 'balanced',
  complex: 'heavy',
};

/**
 * Estimates the complexity tier of a task from its description.
 *
 * Signals are matched against keyword patterns for complex, medium, and simple tiers.
 * Low-confidence estimates default to `medium` / `balanced`.
 */
export function estimateComplexity(description: string): ComplexityEstimate {
  const input = description.slice(0, 4096);
  const signals: string[] = [];

  let complexScore = 0;
  for (const pattern of COMPLEX_PATTERNS) {
    const match = input.match(pattern);
    if (match !== null) {
      complexScore++;
      signals.push(match[0].toLowerCase());
    }
  }

  let simpleScore = 0;
  for (const pattern of SIMPLE_PATTERNS) {
    const match = input.match(pattern);
    if (match !== null) {
      simpleScore++;
      signals.push(match[0].toLowerCase());
    }
  }

  let mediumScore = 0;
  for (const pattern of MEDIUM_PATTERNS) {
    const match = input.match(pattern);
    if (match !== null) {
      mediumScore++;
      signals.push(match[0].toLowerCase());
    }
  }

  let tier: ComplexityTier;
  let confidence: Confidence;

  if (complexScore >= 1) {
    tier = 'complex';
    confidence = complexScore >= 2 ? 'high' : 'low';
  } else if (simpleScore >= 1 && mediumScore === 0) {
    tier = 'simple';
    confidence = simpleScore >= 2 ? 'high' : 'low';
  } else if (mediumScore >= 1) {
    tier = 'medium';
    confidence = mediumScore >= 2 ? 'high' : 'low';
  } else {
    // No signals — default to medium with low confidence
    tier = 'medium';
    confidence = 'low';
  }

  return {
    tier,
    confidence,
    signals,
    preferredTier: TIER_MAP[tier],
  };
}

// ---------------------------------------------------------------------------
// Provider resolution for tier
// ---------------------------------------------------------------------------

const TIER_TO_MODEL_TIER: Record<PreferredTier, 'heavy' | 'balanced' | 'light'> = {
  heavy: 'heavy',
  balanced: 'balanced',
  light: 'light',
};

// Fallback chains when the primary tier's provider is unavailable
const FALLBACK_CHAINS: Record<PreferredTier, PreferredTier[]> = {
  heavy: ['balanced', 'light'],
  balanced: ['light'],
  light: [],
};

function isLauncherAvailable(
  launcherName: LauncherName,
  config: NitroFueledConfig,
): boolean {
  const launcher = config.launchers[launcherName];
  if (launcher === undefined) return false;
  return launcher.found && launcher.authenticated;
}

function tryResolveSlot(
  slot: PreferredTier,
  config: NitroFueledConfig,
): ResolvedProvider | null {
  const modelTier = TIER_TO_MODEL_TIER[slot];
  const providerName = config.routing[slot] ?? config.routing['default'];
  if (providerName === undefined) return null;

  const entry = config.providers[providerName];
  if (entry === undefined) return null;
  if (!isLauncherAvailable(entry.launcher, config)) return null;

  // Chain through tier alternatives if the primary tier is not filled in the config entry
  const model = entry.models[modelTier]
    ?? entry.models['balanced']
    ?? entry.models['heavy']
    ?? entry.models['light'];
  if (model === undefined || model === '') return null;

  return { providerName, model, launcher: entry.launcher };
}

/**
 * Resolves the best available provider and model for the given PreferredTier.
 * Runs a fallback chain if the primary provider's launcher is not available.
 * Returns null if no provider is available (including anthropic fallback).
 */
export function resolveProviderForTier(
  tier: PreferredTier,
  config: NitroFueledConfig,
): ResolvedProvider | null {
  // Try the requested tier first
  const primary = tryResolveSlot(tier, config);
  if (primary !== null) return primary;

  // Walk fallback chain
  for (const fallbackTier of FALLBACK_CHAINS[tier]) {
    const fallback = tryResolveSlot(fallbackTier, config);
    if (fallback !== null) return fallback;
  }

  // Last resort: hardcoded anthropic
  const anthropicEntry = config.providers['anthropic'];
  if (anthropicEntry !== undefined && isLauncherAvailable(anthropicEntry.launcher, config)) {
    const model = anthropicEntry.models[TIER_TO_MODEL_TIER[tier]]
      ?? anthropicEntry.models['balanced']
      ?? anthropicEntry.models['light'];
    if (model !== undefined && model !== '') {
      return { providerName: 'anthropic', model, launcher: anthropicEntry.launcher };
    }
  }

  return null;
}
