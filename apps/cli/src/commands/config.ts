import { existsSync, unlinkSync } from 'node:fs';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import {
  readConfig,
  readGlobalConfig,
  writeConfig,
  getGlobalConfigPath,
  DEFAULT_ROUTING,
} from '../utils/provider-config.js';
import { getProviderStatus, printProviderStatusTable } from '../utils/provider-status.js';
import {
  detectLaunchers,
  deriveAvailableProviders,
  printDerivedTiers,
  promptRoutingAssignment,
  buildConfig,
} from '../utils/provider-flow.js';

async function runCheckMode(cwd: string): Promise<void> {
  console.log('\nLaunchers:');
  const statuses = await getProviderStatus(cwd);
  printProviderStatusTable(statuses);

  const config = readConfig(cwd) ?? readGlobalConfig();
  if (config === null) {
    console.log('\nNo config found. Run `npx nitro-fueled config` to set up.');
    process.exitCode = 1;
    return;
  }

  const missing = statuses.filter((s) => s.status === 'failed' || s.status === 'not configured');
  console.log(missing.length === statuses.length ? '\nNot ready — no launchers detected.' : '\nReady to run.');
  if (missing.length === statuses.length) process.exitCode = 1;
}

async function runTestMode(cwd: string): Promise<void> {
  console.log('\nLaunchers:');
  const statuses = await getProviderStatus(cwd);
  printProviderStatusTable(statuses);

  const hasFailed = statuses.some((s) => s.status === 'failed');
  if (hasFailed) process.exitCode = 1;
}

function runUnloadMode(providerArg: string): void {
  const config = readGlobalConfig();
  if (config === null) {
    console.log(`  No config found — nothing to unload.`);
    return;
  }

  // Remove provider from routing (set all slots pointing to it back to default)
  let changed = false;
  for (const [slot, value] of Object.entries(config.routing)) {
    if (value === providerArg) {
      const defaultVal = DEFAULT_ROUTING[slot as keyof typeof DEFAULT_ROUTING] ?? 'anthropic';
      config.routing[slot as keyof typeof config.routing] = defaultVal;
      changed = true;
    }
  }

  // Remove from providers if it exists
  if (providerArg in config.providers) {
    delete config.providers[providerArg];
    changed = true;
  }

  if (!changed) {
    console.log(`  ${providerArg} is not configured — nothing to unload.`);
    return;
  }

  try {
    writeConfig(config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to save config: ${msg}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ ${providerArg} unloaded from config.`);
}

async function runDetectionWizard(cwd: string): Promise<void> {
  // Step 1: Detect launchers
  const launchers = detectLaunchers();

  // Step 2: Derive available providers
  const availableProviders = deriveAvailableProviders(launchers);

  // Load existing routing or use defaults
  const existing = readGlobalConfig();
  const existingRouting = existing?.routing ?? { ...DEFAULT_ROUTING };

  // Step 3: Show derived tiers
  printDerivedTiers(availableProviders, existingRouting);

  // Step 4: Prompt routing assignments
  const routing = await promptRoutingAssignment(availableProviders, existingRouting);

  // Step 5: Build and save config
  const config = buildConfig(launchers, routing);

  try {
    writeConfig(config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ✗ Failed to save config: ${msg}`);
    process.exitCode = 1;
    return;
  }

  // Print summary
  const connected = Object.entries(launchers)
    .filter(([, info]) => info.found && info.authenticated)
    .map(([name]) => `${name} ✓`)
    .join('  ');

  console.log(`\n  Launchers: ${connected || 'none'}`);
  console.log(`\nConfig saved to ${getGlobalConfigPath()}`);
}

export default class Config extends BaseCommand {
  public static override description = 'Configure launchers and routing';

  public static override flags = {
    check: Flags.boolean({ description: 'Validate current config without making changes', default: false }),
    reset: Flags.boolean({ description: 'Remove config and start fresh', default: false }),
    test: Flags.boolean({ description: 'Show launcher status and exit', default: false }),
    unload: Flags.string({ description: 'Remove a provider from routing non-interactively' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Config);
    const cwd = process.cwd();
    console.log('');
    console.log('nitro-fueled config');
    console.log('===================');

    if (flags.reset) {
      const configPath = getGlobalConfigPath();
      if (existsSync(configPath)) {
        unlinkSync(configPath);
        console.log('\nConfig removed. Run `npx nitro-fueled config` to start fresh.');
      } else {
        console.log('\nNo config file found.');
      }
      return;
    }

    if (flags.unload !== undefined) {
      runUnloadMode(flags.unload);
      return;
    }

    if (flags.test) {
      await runTestMode(cwd);
      return;
    }

    if (flags.check) {
      await runCheckMode(cwd);
      return;
    }

    await runDetectionWizard(cwd);
  }
}
