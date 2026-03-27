import { existsSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import type { Command } from 'commander';
import {
  readConfig,
  writeConfig,
  ensureGitignore,
  getConfigPath,
  testGlmConnection,
} from '../utils/provider-config.js';
import type { NitroFueledConfig, GlmProviderConfig } from '../utils/provider-config.js';
import { runDependencyChecks } from '../utils/dep-check.js';
import type { DependencyResult } from '../utils/dep-check.js';

interface ConfigOptions {
  check: boolean;
  providers: boolean;
  reset: boolean;
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim());
    });
  });
}

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

async function configureGlmProvider(existing?: GlmProviderConfig): Promise<GlmProviderConfig | null> {
  const answer = await prompt('\n  ? Enable GLM provider? (y/N) ');
  if (answer.toLowerCase() !== 'y') return null;

  const defaultKey = existing?.apiKey ?? '$ZAI_API_KEY';
  const keyAnswer = await prompt(`  ? Z.AI API key [${defaultKey}]: `);
  const apiKey = keyAnswer !== '' ? keyAnswer : defaultKey;
  const baseUrl = existing?.baseUrl ?? 'https://api.z.ai/api/anthropic';

  process.stdout.write('  ✓ Testing connection...');
  const testResult = await testGlmConnection(apiKey, baseUrl);

  if (testResult.ok) {
    console.log(` OK (${testResult.modelName ?? 'connected'} available)`);
  } else {
    console.log(' failed (check your API key)');
    const proceed = await prompt('  ? Save anyway? (y/N) ');
    if (proceed.toLowerCase() !== 'y') return null;
  }

  console.log('  ✓ GLM configured');
  return {
    enabled: true,
    apiKey,
    baseUrl,
    models: existing?.models ?? { opus: 'glm-5', sonnet: 'glm-4.7', haiku: 'glm-4.5-air' },
  };
}

async function configureOpenCodeProvider(opencodeFound: boolean): Promise<{ enabled: boolean; defaultModel: string } | null> {
  const answer = await prompt('\n  ? Enable OpenCode provider? (y/N) ');
  if (answer.toLowerCase() !== 'y') return null;

  if (!opencodeFound) {
    console.log('  ✗ opencode CLI not found');
    const install = await prompt('  ? Install opencode globally? (Y/n) ');
    if (install.toLowerCase() !== 'n') {
      console.log('  → Running: npm i -g opencode');
      const result = spawnSync('npm', ['i', '-g', 'opencode'], { stdio: 'inherit' });
      if (result.status !== 0) {
        console.log('  Installation failed. Skipping OpenCode configuration.');
        return null;
      }
      console.log('  ✓ opencode installed');
    } else {
      return null;
    }
  }

  const modelAnswer = await prompt('  ? Default model [openai/gpt-4.1-mini]: ');
  const defaultModel = modelAnswer !== '' ? modelAnswer : 'openai/gpt-4.1-mini';
  console.log(`  ✓ OpenCode configured (${defaultModel})`);
  return { enabled: true, defaultModel };
}

async function runCheckMode(cwd: string): Promise<void> {
  console.log('\nDependencies:');
  const deps = runDependencyChecks();
  for (const dep of deps) {
    printDepResult(dep);
  }

  const config = readConfig(cwd);
  console.log('\nProviders:');
  if (config === null) {
    console.log('  No config file found. Run `npx nitro-fueled config` to set up providers.');
  } else {
    const claude = config.providers.claude;
    console.log(claude?.enabled === true ? '  ✓ Claude — connected (subscription)' : '  - Claude — not configured');

    const glm = config.providers.glm;
    if (glm?.enabled === true) {
      const m = glm.models;
      console.log(`  ✓ GLM — configured (${m.opus}, ${m.sonnet}, ${m.haiku})`);
    } else {
      console.log('  - GLM — not configured');
    }

    const opencode = config.providers.opencode;
    console.log(opencode?.enabled === true
      ? `  ✓ OpenCode — configured (${opencode.defaultModel})`
      : '  - OpenCode — not configured');
  }

  const missing = deps.filter((d) => d.required && !d.found);
  console.log(missing.length > 0 ? '\nNot ready — required dependencies missing.' : '\nReady to run.');
  if (missing.length > 0) process.exitCode = 1;
}

async function runProvidersPhase(cwd: string): Promise<void> {
  const existing = readConfig(cwd);
  const config: NitroFueledConfig = existing ?? { providers: {} };

  console.log('\nConfigure providers:\n');
  console.log('  Claude (subscription)');
  console.log('  ✓ Already configured — logged in via Claude Code');
  config.providers.claude = { enabled: true, source: 'subscription' };

  console.log('\n  GLM (Z.AI)');
  const glmConfig = await configureGlmProvider(config.providers.glm);
  if (glmConfig !== null) config.providers.glm = glmConfig;

  const deps = runDependencyChecks();
  const opencodeFound = deps.find((d) => d.name === 'opencode CLI')?.found ?? false;
  console.log('\n  OpenCode (GPT and others)');
  const opencodeConfig = await configureOpenCodeProvider(opencodeFound);
  if (opencodeConfig !== null) config.providers.opencode = opencodeConfig;

  writeConfig(cwd, config);
  ensureGitignore(cwd);

  const active = [
    config.providers.claude?.enabled === true ? 'Claude ✓' : null,
    config.providers.glm?.enabled === true ? 'GLM ✓' : null,
    config.providers.opencode?.enabled === true ? 'OpenCode ✓' : null,
  ].filter(Boolean).join('  ');

  console.log(`\n  Providers configured: ${active}`);
  console.log('\nConfig saved to .nitro-fueled/config.json');
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Configure providers and validate dependencies')
    .option('--check', 'Validate current config without making changes', false)
    .option('--providers', 'Configure providers only (skip dependency check)', false)
    .option('--reset', 'Remove config and start fresh', false)
    .action(async (opts: ConfigOptions) => {
      const cwd = process.cwd();
      console.log('');
      console.log('nitro-fueled config');
      console.log('===================');

      if (opts.reset) {
        const configPath = getConfigPath(cwd);
        if (existsSync(configPath)) {
          unlinkSync(configPath);
          console.log('\nConfig removed. Run `npx nitro-fueled config` to start fresh.');
        } else {
          console.log('\nNo config file found.');
        }
        return;
      }

      if (opts.check) {
        await runCheckMode(cwd);
        return;
      }

      if (!opts.providers) {
        console.log('\nChecking dependencies...');
        for (const dep of runDependencyChecks()) {
          printDepResult(dep);
        }
      }

      await runProvidersPhase(cwd);
    });
}
