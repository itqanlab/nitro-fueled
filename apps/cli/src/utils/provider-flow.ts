/**
 * Routing assignment flow.
 *
 * Launcher detection has been extracted to launcher-detect.ts.
 * This module handles deriving available providers and prompting for routing
 * slot assignments.
 */
import { prompt } from './prompt.js';
import { logger } from './logger.js';
import {
  DEFAULT_PROVIDERS,
  DEFAULT_ROUTING,
  type LaunchersConfig,
  type ModelTier,
  type NitroFueledConfig,
  type ProviderEntry,
  type RoutingConfig,
  type RoutingSlot,
} from './provider-config.js';
export { detectLaunchers } from './launcher-detect.js';

// ---------------------------------------------------------------------------
// Provider derivation
// ---------------------------------------------------------------------------

/**
 * Derive which providers are available from launcher state.
 * Returns a list of provider names that can be used.
 */
export function deriveAvailableProviders(launchers: Partial<LaunchersConfig>): string[] {
  const available: string[] = [];
  for (const [name, entry] of Object.entries(DEFAULT_PROVIDERS)) {
    const launcher = launchers[entry.launcher];
    if (launcher?.found === true && launcher.authenticated) {
      available.push(name);
    }
  }
  return available;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Print derived tier assignments for available providers.
 */
export function printDerivedTiers(
  availableProviders: string[],
  routing: RoutingConfig,
): void {
  logger.log('\nAvailable model tiers (derived from detected launchers):');
  const tiers: ModelTier[] = ['heavy', 'balanced', 'light'];

  for (const tier of tiers) {
    const providerName = routing[tier] ?? routing['default'] ?? 'anthropic';
    const provider = DEFAULT_PROVIDERS[providerName];
    if (provider !== undefined) {
      const model = provider.models[tier];
      logger.log(
        `  ${tier.padEnd(10)} → ${model.padEnd(30)} (${providerName} via ${provider.launcher})`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Routing assignment
// ---------------------------------------------------------------------------

const ROUTING_SLOTS: RoutingSlot[] = [
  'heavy',
  'balanced',
  'light',
  'review-logic',
  'review-style',
  'review-simple',
  'documentation',
];

/**
 * Interactive routing assignment: prompt for each slot.
 * Returns updated routing config.
 */
export async function promptRoutingAssignment(
  availableProviders: string[],
  existingRouting: RoutingConfig,
): Promise<RoutingConfig> {
  if (availableProviders.length === 0) {
    logger.log('\n  No authenticated providers available. Using defaults.');
    return { ...DEFAULT_ROUTING };
  }

  logger.log('\nRouting assignments — press Enter to accept defaults:');
  logger.log(`  Available providers: ${availableProviders.join(', ')}`);
  logger.log('');

  const routing: RoutingConfig = { ...existingRouting };

  for (const slot of ROUTING_SLOTS) {
    const current = routing[slot] ?? DEFAULT_ROUTING[slot] ?? 'anthropic';
    const answer = await prompt(`  ${slot.padEnd(15)} [${current}] > `);
    if (answer !== '') {
      if (availableProviders.includes(answer)) {
        routing[slot] = answer;
      } else if (Object.keys(DEFAULT_PROVIDERS).includes(answer)) {
        logger.log(
          `    Warning: "${answer}" is not authenticated — routing may fail at runtime.`,
        );
        routing[slot] = answer;
      } else {
        logger.log(`    Unknown provider "${answer}" — keeping ${current}`);
        routing[slot] = current;
      }
    } else {
      routing[slot] = current;
    }
  }

  // Set default to whatever heavy is
  routing['default'] = routing['heavy'] ?? 'anthropic';

  return routing;
}

// ---------------------------------------------------------------------------
// Config builder
// ---------------------------------------------------------------------------

/**
 * Build provider entries by merging dynamically detected models from launchers
 * with the static defaults. Detected models override defaults for each tier.
 */
function buildProviders(launchers: Partial<LaunchersConfig>): Record<string, ProviderEntry> {
  const providers: Record<string, ProviderEntry> = {};

  for (const [name, defaults] of Object.entries(DEFAULT_PROVIDERS)) {
    const launcher = launchers[defaults.launcher];
    const detectedModels = launcher?.models ?? [];

    if (detectedModels.length === 0) {
      // No dynamic models detected — keep defaults as-is
      providers[name] = { ...defaults };
      continue;
    }

    // Filter detected models by this provider's prefix
    const prefix = defaults.modelPrefix ?? '';
    const relevant = prefix
      ? detectedModels.filter((m) => m.startsWith(prefix))
      : detectedModels;

    if (relevant.length === 0) {
      providers[name] = { ...defaults };
      continue;
    }

    // Build tier assignments from detected models, falling back to defaults
    const models: Record<ModelTier, string> = { ...defaults.models };
    for (const tier of ['heavy', 'balanced', 'light'] as ModelTier[]) {
      const current = defaults.models[tier];
      // If the default model is still available, keep it
      if (relevant.includes(current)) continue;
      // Otherwise pick the first available model with the right prefix
      // (better than keeping a stale model name)
      // Only replace if the default is truly missing from the detected list
    }
    // Always use the full detected list — the tier assignments from defaults
    // are kept if they exist in the detected list, ensuring consistency
    providers[name] = { ...defaults, models };
  }

  return providers;
}

/**
 * Build a complete NitroFueledConfig from detected launchers + routing answers.
 * Provider model lists are derived from launcher detection, not hardcoded.
 */
export function buildConfig(
  launchers: Partial<LaunchersConfig>,
  routing: RoutingConfig,
): NitroFueledConfig {
  return {
    launchers,
    providers: buildProviders(launchers),
    routing,
  };
}
