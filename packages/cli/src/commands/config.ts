import { existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type { Command } from 'commander';
import {
  readConfig,
  writeConfig,
  resolveApiKey,
  getConfigPath,
  testGlmConnection,
} from '../utils/provider-config.js';
import type { NitroFueledConfig, GlmProviderConfig, OpenCodeProviderConfig } from '../utils/provider-config.js';
import { runDependencyChecks, checkOpencodeBinary, DEP_NAMES } from '../utils/dep-check.js';
import type { DependencyResult } from '../utils/dep-check.js';
import { ensureGitignore } from '../utils/gitignore.js';
import { prompt } from '../utils/prompt.js';

const MODEL_FORMAT_RE = /^[\w.-]+\/[\w.-]+$/;

interface ConfigOptions {
  check: boolean;
  providers: boolean;
  reset: boolean;
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

  const defaultKeyHint = existing !== undefined
    ? (existing.apiKey.startsWith('$') ? existing.apiKey : '[keep existing]')
    : '$ZAI_API_KEY';
  const keyAnswer = await prompt(`  ? Z.AI API key [${defaultKeyHint}]: `);
  const apiKey = keyAnswer !== ''
    ? keyAnswer
    : (existing?.apiKey ?? '$ZAI_API_KEY');
  const baseUrl = existing?.baseUrl ?? 'https://api.z.ai/api/anthropic';

  process.stdout.write('  ✓ Testing connection...');
  const testResult = await testGlmConnection(apiKey, baseUrl);

  if (testResult.ok) {
    console.log(` OK (${testResult.modelName ?? 'connected'} available)`);
  } else {
    const reason = testResult.error !== undefined ? ` (${testResult.error})` : '';
    console.log(` failed${reason}`);
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

async function configureOpenCodeProvider(
  opencodeFound: boolean,
  existing?: OpenCodeProviderConfig,
): Promise<OpenCodeProviderConfig | null> {
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

  const defaultKeyHint = existing !== undefined
    ? (existing.apiKey.startsWith('$') ? existing.apiKey : '[keep existing]')
    : '$OPENAI_API_KEY';
  const keyAnswer = await prompt(`  ? OpenAI API key [${defaultKeyHint}]: `);
  const apiKey = keyAnswer !== ''
    ? keyAnswer
    : (existing?.apiKey ?? '$OPENAI_API_KEY');

  const defaultModel = existing?.defaultModel ?? 'openai/gpt-4.1-mini';
  let modelAnswer = await prompt(`  ? Default model [${defaultModel}]: `);
  if (modelAnswer === '') modelAnswer = defaultModel;

  if (!MODEL_FORMAT_RE.test(modelAnswer)) {
    console.log(`  Warning: "${modelAnswer}" does not match the expected format (provider/model). Saved anyway.`);
  }

  // Connection check: verify the API key resolves.
  const resolvedKey = resolveApiKey(apiKey);
  if (resolvedKey === '') {
    console.log(`  ✗ API key is empty or env var unset — verify before running.`);
  } else {
    console.log(`  ✓ OpenCode configured (${modelAnswer})`);
  }

  return { enabled: true, apiKey, defaultModel: modelAnswer };
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
      process.stdout.write('  ✓ GLM — testing...');
      const live = await testGlmConnection(glm.apiKey, glm.baseUrl);
      console.log(live.ok
        ? ` connected (${live.modelName ?? 'OK'} available)`
        : ` failed${live.error !== undefined ? ` (${live.error})` : ''}`);
    } else {
      console.log('  - GLM — not configured');
    }

    const opencode = config.providers.opencode;
    if (opencode?.enabled === true) {
      const binaryOk = checkOpencodeBinary().found;
      const keyOk = resolveApiKey(opencode.apiKey) !== '';
      const status = binaryOk && keyOk ? 'ready' : (!binaryOk ? 'binary missing' : 'API key unset');
      console.log(`  ${binaryOk && keyOk ? '✓' : '✗'} OpenCode — ${status} (${opencode.defaultModel})`);
    } else {
      console.log('  - OpenCode — not configured');
    }
  }

  const missing = deps.filter((d) => d.required && !d.found);
  console.log(missing.length > 0 ? '\nNot ready — required dependencies missing.' : '\nReady to run.');
  if (missing.length > 0) process.exitCode = 1;
}

async function runProvidersPhase(cwd: string, initialOpencodeFound: boolean): Promise<void> {
  const existing = readConfig(cwd);
  const config: NitroFueledConfig = existing ?? { providers: {} };

  console.log('\nConfigure providers:\n');
  console.log('  Claude (subscription)');
  console.log('  ✓ Already configured — logged in via Claude Code');
  config.providers.claude = { enabled: true, source: 'subscription' };

  console.log('\n  GLM (Z.AI)');
  const glmConfig = await configureGlmProvider(config.providers.glm);
  if (glmConfig !== null) config.providers.glm = glmConfig;

  console.log('\n  OpenCode (GPT and others)');
  const opencodeConfig = await configureOpenCodeProvider(initialOpencodeFound, config.providers.opencode);
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

      let opencodeFound = false;
      if (!opts.providers) {
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
    });
}
