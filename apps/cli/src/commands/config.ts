import { existsSync, unlinkSync } from 'node:fs';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import {
  readConfig,
  writeConfig,
  getConfigPath,
} from '../utils/provider-config.js';
import type { NitroFueledConfig } from '../utils/provider-config.js';
import { runDependencyChecks, checkOpencodeBinary, DEP_NAMES } from '../utils/dep-check.js';
import type { DependencyResult } from '../utils/dep-check.js';
import { ensureGitignore } from '../utils/gitignore.js';
import { getProviderStatus, printProviderStatusTable } from '../utils/provider-status.js';
import {
  runGlmMenu,
  runGlmFirstTimeMenu,
  runOpenCodeMenu,
  runOpenCodeFirstTimeMenu,
} from '../utils/provider-flow.js';

/** Known provider names for --unload validation. Claude cannot be unloaded. */
const UNLOADABLE_PROVIDERS = ['glm', 'opencode'] as const;
type UnloadableProvider = (typeof UNLOADABLE_PROVIDERS)[number];

function printDepResult(dep: DependencyResult): void {
  if (dep.found) {
    const ver = dep.version !== undefined ? ` (${dep.version})` : '';
    console.log(`  ✓ ${dep.name}${ver}`);
  } else {
    console.log(`  ✗ ${dep.name} not found`);
    if (dep.installHint !== undefined) {
      console.log(`    → ${dep.installHint}`);
    }
  }
}

async function runCheckMode(cwd: string): Promise<void> {
  console.log('\nDependencies:');
  const deps = runDependencyChecks();
  for (const dep of deps) {
    printDepResult(dep);
  }

  console.log('\nProviders:');
  const statuses = await getProviderStatus(cwd);
  printProviderStatusTable(statuses);

  const missing = deps.filter((d) => d.required && !d.found);
  console.log(missing.length > 0 ? '\nNot ready — required dependencies missing.' : '\nReady to run.');
  if (missing.length > 0) process.exitCode = 1;
}

async function runTestMode(cwd: string): Promise<void> {
  console.log('\nProviders:');
  const statuses = await getProviderStatus(cwd);
  printProviderStatusTable(statuses);

  const hasFailed = statuses.some((s) => s.status === 'failed');
  if (hasFailed) process.exitCode = 1;
}

function runUnloadMode(cwd: string, providerArg: string): void {
  const lower = providerArg.toLowerCase();

  if (!UNLOADABLE_PROVIDERS.includes(lower as UnloadableProvider)) {
    console.error(
      `  ✗ Unknown provider "${providerArg}". Valid providers: ${UNLOADABLE_PROVIDERS.join(', ')}.`,
    );
    process.exitCode = 1;
    return;
  }

  const provider = lower as UnloadableProvider;
  const config = readConfig(cwd);

  if (config === null || config.providers[provider] === undefined) {
    console.log(`  ${providerArg} is not configured — nothing to unload.`);
    return;
  }

  delete config.providers[provider];
  try {
    writeConfig(cwd, config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to save config: ${msg}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ ${providerArg} unloaded from config.`);
}

async function runProvidersPhase(cwd: string, opencodeFound: boolean): Promise<void> {
  // Step 1: Show current state upfront
  console.log('');
  const statuses = await getProviderStatus(cwd);
  printProviderStatusTable(statuses);

  const existing = readConfig(cwd);
  const config: NitroFueledConfig = existing ?? { providers: {} };

  // Claude is always connected — just set it
  config.providers.claude = { enabled: true, source: 'subscription' };

  // Step 2: Per-provider menus
  console.log('\nConfigure each provider:\n');

  // GLM
  const glmStatus = statuses.find((s) => s.name === 'GLM');
  const glmCurrent = config.providers.glm;

  if (glmCurrent !== undefined) {
    const result = await runGlmMenu(glmCurrent, glmStatus?.status ?? 'not configured');
    if (result.action === 'unload') {
      delete config.providers.glm;
    } else if (result.action === 'reconfigure') {
      config.providers.glm = result.config;
    }
    // 'keep': no change
  } else {
    const result = await runGlmFirstTimeMenu();
    if (result.action === 'reconfigure') {
      config.providers.glm = result.config;
    }
  }

  // OpenCode
  const openCodeStatus = statuses.find((s) => s.name === 'OpenCode');
  const opencodeCurrent = config.providers.opencode;

  if (opencodeCurrent !== undefined) {
    const result = await runOpenCodeMenu(opencodeCurrent, openCodeStatus?.status ?? 'not configured', opencodeFound);
    if (result.action === 'unload') {
      delete config.providers.opencode;
    } else if (result.action === 'reconfigure') {
      config.providers.opencode = result.config;
    }
  } else {
    const result = await runOpenCodeFirstTimeMenu(opencodeFound);
    if (result.action === 'reconfigure') {
      config.providers.opencode = result.config;
    }
  }

  try {
    writeConfig(cwd, config);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ✗ Failed to save config: ${msg}`);
    process.exitCode = 1;
    return;
  }
  ensureGitignore(cwd);

  const active = [
    config.providers.claude?.enabled === true ? 'Claude ✓' : null,
    config.providers.glm?.enabled === true ? 'GLM ✓' : null,
    config.providers.opencode?.enabled === true ? 'OpenCode ✓' : null,
  ].filter(Boolean).join('  ');

  console.log(`\n  Providers configured: ${active}`);
  console.log('\nConfig saved to .nitro-fueled/config.json');
}

export default class Config extends BaseCommand {
  public static override description = 'Configure providers and validate dependencies';

  public static override flags = {
    check: Flags.boolean({ description: 'Validate current config without making changes', default: false }),
    providers: Flags.boolean({ description: 'Configure providers only (skip dependency check)', default: false }),
    reset: Flags.boolean({ description: 'Remove config and start fresh', default: false }),
    test: Flags.boolean({ description: 'Test all configured provider connections and exit', default: false }),
    unload: Flags.string({ description: 'Remove a single provider non-interactively (glm, opencode)' }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Config);
    const cwd = process.cwd();
    console.log('');
    console.log('nitro-fueled config');
    console.log('===================');

    if (flags.reset) {
      const configPath = getConfigPath(cwd);
      if (existsSync(configPath)) {
        unlinkSync(configPath);
        console.log('\nConfig removed. Run `npx nitro-fueled config` to start fresh.');
      } else {
        console.log('\nNo config file found.');
      }
      return;
    }

    if (flags.unload !== undefined) {
      runUnloadMode(cwd, flags.unload);
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

    let opencodeFound = false;
    if (!flags.providers) {
      console.log('\nChecking dependencies...');
      const deps = runDependencyChecks();
      for (const dep of deps) {
        printDepResult(dep);
      }
      opencodeFound = deps.find((d) => d.name === DEP_NAMES.opencodeCli)?.found ?? false;
    } else {
      opencodeFound = checkOpencodeBinary().found;
    }

    await runProvidersPhase(cwd, opencodeFound);
  }
}
