/**
 * Interactive per-provider configuration menus.
 *
 * These are called from runProvidersPhase in config.ts to show the
 * [K]eep / [R]econfigure / [T]est / [U]nload menu for each provider.
 */
import { spawnSync } from 'node:child_process';
import { prompt } from './prompt.js';
import {
  testGlmConnection,
  resolveApiKey,
  type GlmProviderConfig,
  type OpenCodeProviderConfig,
} from './provider-config.js';
import type { ProviderStatus } from './provider-status.js';

export type GlmMenuResult =
  | { action: 'keep' }
  | { action: 'skip' }
  | { action: 'unload' }
  | { action: 'reconfigure'; config: GlmProviderConfig };

export type OpenCodeMenuResult =
  | { action: 'skip' }
  | { action: 'keep' }
  | { action: 'unload' }
  | { action: 'reconfigure'; config: OpenCodeProviderConfig };

const MODEL_FORMAT_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * Per-provider menu for GLM (already configured or failed).
 * Options: [K]eep [R]econfigure [T]est [U]nload
 */
export async function runGlmMenu(
  existing: GlmProviderConfig,
  currentStatus: ProviderStatus,
): Promise<GlmMenuResult> {
  console.log(`\n  GLM (currently: ${currentStatus})`);
  const raw = await prompt('  [K]eep  [R]econfigure  [T]est  [U]nload  (Enter = keep): ');
  const choice = raw.toLowerCase();

  if (choice === 'u') {
    console.log('  ↳ GLM unloaded');
    return { action: 'unload' };
  }

  if (choice === 't') {
    process.stdout.write('  ✓ Testing connection...');
    const result = await testGlmConnection(existing.apiKey, existing.baseUrl);
    if (result.ok) {
      console.log(` OK (${result.modelName ?? 'connected'} available)`);
    } else {
      const reason = result.error !== undefined ? ` (${result.error})` : '';
      console.log(` failed${reason}`);
    }
    // Test does not change config — treat as keep
    return { action: 'keep' };
  }

  if (choice === 'r') {
    const newConfig = await reconfigureGlm(existing);
    if (newConfig === null) return { action: 'keep' };
    return { action: 'reconfigure', config: newConfig };
  }

  // 'k' or Enter = keep
  console.log('  ↳ (kept)');
  return { action: 'keep' };
}

/**
 * Menu for GLM when it is not yet configured.
 * Options: [C]onfigure [S]kip
 */
export async function runGlmFirstTimeMenu(): Promise<GlmMenuResult> {
  console.log('\n  GLM (currently: not configured)');
  const raw = await prompt('  [C]onfigure  [S]kip  (Enter = skip): ');
  const choice = raw.toLowerCase();

  if (choice === 'c') {
    const newConfig = await reconfigureGlm(undefined);
    if (newConfig === null) return { action: 'skip' };
    return { action: 'reconfigure', config: newConfig };
  }

  console.log('  ↳ (skipped)');
  return { action: 'skip' };
}

/**
 * Per-provider menu for OpenCode (already configured).
 * Options: [K]eep [R]econfigure [U]nload
 */
export async function runOpenCodeMenu(
  existing: OpenCodeProviderConfig,
  currentStatus: ProviderStatus,
  opencodeFound: boolean,
): Promise<OpenCodeMenuResult> {
  console.log(`\n  OpenCode (currently: ${currentStatus})`);
  const raw = await prompt('  [K]eep  [R]econfigure  [U]nload  (Enter = keep): ');
  const choice = raw.toLowerCase();

  if (choice === 'u') {
    console.log('  ↳ OpenCode unloaded');
    return { action: 'unload' };
  }

  if (choice === 'r') {
    const newConfig = await reconfigureOpenCode(opencodeFound, existing);
    if (newConfig === null) return { action: 'keep' };
    return { action: 'reconfigure', config: newConfig };
  }

  console.log('  ↳ (kept)');
  return { action: 'keep' };
}

/**
 * Menu for OpenCode when it is not yet configured.
 * Options: [C]onfigure [S]kip
 */
export async function runOpenCodeFirstTimeMenu(
  opencodeFound: boolean,
): Promise<OpenCodeMenuResult> {
  console.log('\n  OpenCode (currently: not configured)');
  const raw = await prompt('  [C]onfigure  [S]kip  (Enter = skip): ');
  const choice = raw.toLowerCase();

  if (choice === 'c') {
    const newConfig = await reconfigureOpenCode(opencodeFound, undefined);
    if (newConfig === null) return { action: 'skip' };
    return { action: 'reconfigure', config: newConfig };
  }

  console.log('  ↳ (skipped)');
  return { action: 'skip' };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function reconfigureGlm(existing?: GlmProviderConfig): Promise<GlmProviderConfig | null> {
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

  console.log('  ✓ GLM reconfigured');
  return {
    enabled: true,
    apiKey,
    baseUrl,
    models: existing?.models ?? { opus: 'glm-5', sonnet: 'glm-4.7', haiku: 'glm-4.5-air' },
  };
}

/** Returns true if opencode was successfully installed, false if user declined or install failed. */
async function installOpenCode(): Promise<boolean> {
  console.log('  ✗ opencode CLI not found');
  const install = await prompt('  ? Install opencode globally? (Y/n) ');
  if (install.toLowerCase() === 'n') return false;

  console.log('  → Running: npm i -g opencode');
  const result = spawnSync('npm', ['i', '-g', 'opencode'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.log('  Installation failed. Skipping OpenCode configuration.');
    return false;
  }
  console.log('  ✓ opencode installed');
  return true;
}

async function reconfigureOpenCode(
  opencodeFound: boolean,
  existing?: OpenCodeProviderConfig,
): Promise<OpenCodeProviderConfig | null> {
  if (!opencodeFound) {
    const installed = await installOpenCode();
    if (!installed) return null;
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

  const resolvedKey = resolveApiKey(apiKey);
  if (resolvedKey === '') {
    console.log('  ✗ API key is empty or env var unset — verify before running.');
  } else {
    console.log(`  ✓ OpenCode reconfigured (${modelAnswer})`);
  }

  return { enabled: true, apiKey, defaultModel: modelAnswer };
}
