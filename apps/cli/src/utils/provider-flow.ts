/**
 * Routing assignment flow.
 *
 * Launcher detection has been extracted to launcher-detect.ts.
 * This module handles deriving available providers and prompting for routing
 * slot assignments.
 */
import { prompt } from './prompt.js';
import {
  DEFAULT_PROVIDERS,
  DEFAULT_ROUTING,
  type LaunchersConfig,
  type ModelTier,
  type NitroFueledConfig,
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
  console.log('\nAvailable model tiers (derived from detected launchers):');
  const tiers: ModelTier[] = ['heavy', 'balanced', 'light'];

  for (const tier of tiers) {
    const providerName = routing[tier] ?? routing['default'] ?? 'anthropic';
    const provider = DEFAULT_PROVIDERS[providerName];
    if (provider !== undefined) {
      const model = provider.models[tier];
      console.log(
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
    console.log('\n  No authenticated providers available. Using defaults.');
    return { ...DEFAULT_ROUTING };
  }

  console.log('\nRouting assignments — press Enter to accept defaults:');
  console.log(`  Available providers: ${availableProviders.join(', ')}`);
  console.log('');

  const routing: RoutingConfig = { ...existingRouting };

  for (const slot of ROUTING_SLOTS) {
    const current = routing[slot] ?? DEFAULT_ROUTING[slot] ?? 'anthropic';
    const answer = await prompt(`  ${slot.padEnd(15)} [${current}] > `);
    if (answer !== '') {
      if (availableProviders.includes(answer)) {
        routing[slot] = answer;
      } else if (Object.keys(DEFAULT_PROVIDERS).includes(answer)) {
        console.log(
          `    Warning: "${answer}" is not authenticated — routing may fail at runtime.`,
        );
        routing[slot] = answer;
      } else {
        console.log(`    Unknown provider "${answer}" — keeping ${current}`);
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
 * Build a complete NitroFueledConfig from detected launchers + routing answers.
 */
export function buildConfig(
  launchers: Partial<LaunchersConfig>,
  routing: RoutingConfig,
): NitroFueledConfig {
  return {
    launchers,
    providers: { ...DEFAULT_PROVIDERS },
    routing,
  };
}
