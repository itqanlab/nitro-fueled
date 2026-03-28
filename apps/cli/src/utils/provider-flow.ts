/**
 * Launcher detection and routing assignment flow.
 *
 * Replaces the old per-provider menus. Now scans for installed launchers,
 * derives available models, and prompts for routing slot assignments.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { prompt } from './prompt.js';
import {
  DEFAULT_PROVIDERS,
  DEFAULT_ROUTING,
  type LauncherInfo,
  type LaunchersConfig,
  type LauncherName,
  type NitroFueledConfig,
  type RoutingConfig,
  type RoutingSlot,
} from './provider-config.js';

// ---------------------------------------------------------------------------
// Launcher detection
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function detectClaude(): LauncherInfo {
  const result = spawnSync('claude', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (result.status !== 0) {
    return { found: false, authenticated: false, models: [] };
  }

  // Check auth
  for (const args of [['auth', 'status'], ['status']]) {
    const auth = spawnSync('claude', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });

    if (auth.error !== undefined) break;

    if (auth.status === 0) {
      return {
        found: true,
        authenticated: true,
        models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      };
    }

    const stderr = (auth.stderr ?? '').toLowerCase();
    const unknownCmd = stderr.includes('unknown command') || stderr.includes('unknown subcommand');
    if (!unknownCmd) break;
  }

  return { found: true, authenticated: false, models: [] };
}

interface OpenCodeAuthRow {
  prefix: string;
  method: string;
}

function parseOpenCodeAuthList(): OpenCodeAuthRow[] {
  const result = spawnSync('opencode', ['auth', 'list'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (result.status !== 0) return [];

  const output = (result.stdout ?? '').trim();
  const rows: OpenCodeAuthRow[] = [];

  for (const line of output.split('\n')) {
    const lower = line.toLowerCase();
    if (lower.includes('openai') && (lower.includes('oauth') || lower.includes('authenticated'))) {
      rows.push({ prefix: 'openai', method: 'oauth' });
    }
    if (lower.includes('zai') && (lower.includes('api') || lower.includes('authenticated'))) {
      rows.push({ prefix: 'zai', method: 'api-key' });
    }
    // opencode free-tier is always available if the binary is found
  }
  return rows;
}

function detectOpenCode(): LauncherInfo {
  const versionResult = spawnSync('opencode', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (versionResult.status !== 0) {
    return { found: false, authenticated: false, models: [] };
  }

  const authRows = parseOpenCodeAuthList();
  const models: string[] = [];
  const authMethods: Array<'oauth' | 'api-key'> = [];

  for (const row of authRows) {
    if (row.prefix === 'openai') {
      models.push('openai/gpt-5.4', 'openai/gpt-5.4-mini');
      authMethods.push('oauth');
    }
    if (row.prefix === 'zai') {
      models.push('zai-coding-plan/glm-5', 'zai-coding-plan/glm-4.7');
      authMethods.push('api-key');
    }
  }

  // Check ZAI_API_KEY env var as alternative
  if (!authMethods.includes('api-key') && (process.env['ZAI_API_KEY'] ?? '') !== '') {
    models.push('zai-coding-plan/glm-5', 'zai-coding-plan/glm-4.7');
    authMethods.push('api-key');
  }

  // opencode free tier always available
  models.push('opencode/big-pickle');

  const authenticated = authMethods.length > 0;

  return {
    found: true,
    authenticated,
    authMethods: authMethods.length > 0 ? authMethods : undefined,
    models,
  };
}

function detectCodex(): LauncherInfo {
  const versionResult = spawnSync('codex', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
  });

  if (versionResult.status !== 0) {
    return { found: false, authenticated: false, models: [] };
  }

  // Read ~/.codex/auth.json
  const authFile = join(homedir(), '.codex', 'auth.json');
  if (!existsSync(authFile)) {
    return { found: true, authenticated: false, models: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(authFile, 'utf8'));
  } catch {
    return { found: true, authenticated: false, models: [] };
  }

  if (!isRecord(parsed)) {
    return { found: true, authenticated: false, models: [] };
  }

  const authMode = typeof parsed['auth_mode'] === 'string' ? parsed['auth_mode'] : '';
  if (authMode === 'chatgpt' || authMode === 'api-key') {
    const method = authMode === 'chatgpt' ? 'oauth' : 'api-key';
    return {
      found: true,
      authenticated: true,
      authMethods: [method],
      models: ['openai/codex-mini-latest', 'openai/gpt-5.4'],
    };
  }

  // Check OPENAI_API_KEY env var
  if ((process.env['OPENAI_API_KEY'] ?? '') !== '') {
    return {
      found: true,
      authenticated: true,
      authMethods: ['api-key'],
      models: ['openai/codex-mini-latest', 'openai/gpt-5.4'],
    };
  }

  return { found: true, authenticated: false, models: [] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Detect all launchers. Returns partial LaunchersConfig. */
export function detectLaunchers(): Partial<LaunchersConfig> {
  const launchers: Partial<LaunchersConfig> = {};

  console.log('\nDetecting launchers...');

  const claude = detectClaude();
  launchers.claude = claude;
  printLauncherResult('claude', claude);

  const opencode = detectOpenCode();
  launchers.opencode = opencode;
  printLauncherResult('opencode', opencode);

  const codex = detectCodex();
  launchers.codex = codex;
  printLauncherResult('codex', codex);

  return launchers;
}

function printLauncherResult(name: LauncherName, info: LauncherInfo): void {
  if (!info.found) {
    const hints: Record<LauncherName, string> = {
      claude: 'install: https://docs.anthropic.com/en/docs/claude-code',
      opencode: 'install: npm i -g opencode',
      codex: 'install: npm i -g @openai/codex',
    };
    console.log(`  ✗ ${name.padEnd(12)} not found — ${hints[name]}`);
    return;
  }

  if (!info.authenticated) {
    const hints: Record<LauncherName, string> = {
      claude: 'run: claude auth login',
      opencode: 'run: opencode auth login',
      codex: 'run: codex --login',
    };
    console.log(`  ✗ ${name.padEnd(12)} not authenticated — ${hints[name]}`);
    return;
  }

  const detail = info.authMethods !== undefined
    ? info.authMethods.join(' + ')
    : 'connected';
  console.log(`  ✓ ${name.padEnd(12)} ${detail}`);
}

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

/**
 * Print derived tier assignments for available providers.
 */
export function printDerivedTiers(
  availableProviders: string[],
  routing: RoutingConfig,
): void {
  console.log('\nAvailable model tiers (derived from detected launchers):');
  const tiers: RoutingSlot[] = ['heavy', 'balanced', 'light'];

  for (const tier of tiers) {
    const providerName = routing[tier] ?? routing['default'] ?? 'anthropic';
    const provider = DEFAULT_PROVIDERS[providerName];
    if (provider !== undefined) {
      const model = provider.models[tier as 'heavy' | 'balanced' | 'light'];
      console.log(`  ${tier.padEnd(10)} → ${model.padEnd(30)} (${providerName} via ${provider.launcher})`);
    }
  }
}

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
      if (availableProviders.includes(answer) || Object.keys(DEFAULT_PROVIDERS).includes(answer)) {
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
