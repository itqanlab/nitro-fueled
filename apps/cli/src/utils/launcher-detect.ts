/**
 * Launcher detection helpers (claude / opencode / codex).
 * Extracted from provider-flow.ts to keep that file within the 200-line limit.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isRecord } from './provider-config.js';
import type { LauncherInfo, LaunchersConfig, LauncherName } from './provider-config.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface OpenCodeAuthRow {
  prefix: string;
  method: string;
}

function parseOpenCodeAuthList(): OpenCodeAuthRow[] {
  let result: SpawnSyncReturns<string>;
  try {
    result = spawnSync('opencode', ['auth', 'list'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: unknown) {
    console.debug(`opencode auth list failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

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

/**
 * Query `opencode models` for a dynamic list of available models.
 * Returns model names grouped by prefix (e.g., 'openai', 'zai-coding-plan', 'opencode').
 */
function queryOpenCodeModels(): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  let result: SpawnSyncReturns<string>;
  try {
    result = spawnSync('opencode', ['models'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: unknown) {
    console.debug(`opencode models failed: ${err instanceof Error ? err.message : String(err)}`);
    return grouped;
  }

  if (result.status !== 0) return grouped;

  const output = (result.stdout ?? '').trim();
  for (const line of output.split('\n')) {
    const model = line.trim();
    if (model.length === 0) continue;
    const slashIdx = model.indexOf('/');
    const prefix = slashIdx > 0 ? model.slice(0, slashIdx) : 'opencode';
    if (!grouped.has(prefix)) grouped.set(prefix, []);
    grouped.get(prefix)!.push(model);
  }
  return grouped;
}

function detectClaude(): LauncherInfo {
  let result: SpawnSyncReturns<string>;
  try {
    result = spawnSync('claude', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: unknown) {
    console.debug(`claude --version failed: ${err instanceof Error ? err.message : String(err)}`);
    return { found: false, authenticated: false, models: [] };
  }

  if (result.status !== 0) {
    return { found: false, authenticated: false, models: [] };
  }

  // Check auth — try 'auth status', fall back to 'status' for older CLI versions
  for (const args of [['auth', 'status'], ['status']]) {
    let auth: SpawnSyncReturns<string>;
    try {
      auth = spawnSync('claude', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
    } catch (err: unknown) {
      console.debug(`claude ${args.join(' ')} failed: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    if (auth.error !== undefined) break;

    if (auth.status === 0) {
      return {
        found: true,
        authenticated: true,
        models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
      };
    }

    const stderr = (auth.stderr ?? '').toLowerCase();
    const unknownCmd =
      stderr.includes('unknown command') || stderr.includes('unknown subcommand');
    if (!unknownCmd) break;
  }

  return { found: true, authenticated: false, models: [] };
}

function detectOpenCode(): LauncherInfo {
  let versionResult: SpawnSyncReturns<string>;
  try {
    versionResult = spawnSync('opencode', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: unknown) {
    console.debug(`opencode --version failed: ${err instanceof Error ? err.message : String(err)}`);
    return { found: false, authenticated: false, models: [] };
  }

  if (versionResult.status !== 0) {
    return { found: false, authenticated: false, models: [] };
  }

  const authRows = parseOpenCodeAuthList();
  const authMethods: Array<'oauth' | 'api-key'> = [];

  // Deduplicate by prefix — a misbehaving opencode binary could emit duplicate lines
  const seenPrefixes = new Set<string>();
  for (const row of authRows) {
    if (seenPrefixes.has(row.prefix)) continue;
    seenPrefixes.add(row.prefix);

    if (row.prefix === 'openai') {
      authMethods.push('oauth');
    }
    if (row.prefix === 'zai') {
      authMethods.push('api-key');
    }
  }

  // Check ZAI_API_KEY env var as alternative auth source
  if (!authMethods.includes('api-key') && (process.env['ZAI_API_KEY'] ?? '') !== '') {
    authMethods.push('api-key');
  }

  // Query actual models from `opencode models` instead of hardcoding
  const dynamicModels = queryOpenCodeModels();
  const models: string[] = [];

  // Add models for each authenticated prefix
  if (authMethods.includes('oauth')) {
    const openaiModels = dynamicModels.get('openai') ?? [];
    models.push(...openaiModels);
  }
  if (authMethods.includes('api-key')) {
    const zaiModels = dynamicModels.get('zai-coding-plan') ?? [];
    models.push(...zaiModels);
  }

  // opencode free-tier models are always available when the binary is found
  const opencodeModels = dynamicModels.get('opencode') ?? [];
  models.push(...opencodeModels);

  // If dynamic discovery returned nothing (e.g., command not available), use minimal fallbacks
  if (models.length === 0) {
    if (authMethods.includes('oauth')) models.push('openai/gpt-5.4', 'openai/gpt-5.4-mini');
    if (authMethods.includes('api-key')) models.push('zai-coding-plan/glm-5', 'zai-coding-plan/glm-4.7');
    models.push('opencode/big-pickle');
  }

  const authenticated = authMethods.length > 0;

  return {
    found: true,
    authenticated,
    authMethods: authMethods.length > 0 ? authMethods : undefined,
    models,
  };
}

function detectCodex(): LauncherInfo {
  let versionResult: SpawnSyncReturns<string>;
  try {
    versionResult = spawnSync('codex', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (err: unknown) {
    console.debug(`codex --version failed: ${err instanceof Error ? err.message : String(err)}`);
    return { found: false, authenticated: false, models: [] };
  }

  if (versionResult.status !== 0) {
    return { found: false, authenticated: false, models: [] };
  }

  // Read ~/.codex/auth.json for auth state
  const authFile = join(homedir(), '.codex', 'auth.json');
  if (!existsSync(authFile)) {
    return { found: true, authenticated: false, models: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(authFile, 'utf8'));
  } catch (err: unknown) {
    console.debug(
      `Could not parse codex auth file: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { found: true, authenticated: false, models: [] };
  }

  if (!isRecord(parsed)) {
    return { found: true, authenticated: false, models: [] };
  }

  const authMode = typeof parsed['auth_mode'] === 'string' ? parsed['auth_mode'] : '';
  if (authMode === 'chatgpt' || authMode === 'api-key') {
    const method: 'oauth' | 'api-key' = authMode === 'chatgpt' ? 'oauth' : 'api-key';
    // Try to get dynamic model list from opencode (which also lists openai/ models)
    const dynamicModels = queryOpenCodeModels();
    const openaiModels = dynamicModels.get('openai') ?? [];
    const codexModels = openaiModels.length > 0
      ? openaiModels
      : ['openai/codex-mini-latest', 'openai/gpt-5.4'];
    return {
      found: true,
      authenticated: true,
      authMethods: [method],
      models: codexModels,
    };
  }

  // Check OPENAI_API_KEY env var as alternative
  if ((process.env['OPENAI_API_KEY'] ?? '') !== '') {
    const dynamicModels = queryOpenCodeModels();
    const openaiModels = dynamicModels.get('openai') ?? [];
    const codexModels = openaiModels.length > 0
      ? openaiModels
      : ['openai/codex-mini-latest', 'openai/gpt-5.4'];
    return {
      found: true,
      authenticated: true,
      authMethods: ['api-key'],
      models: codexModels,
    };
  }

  return { found: true, authenticated: false, models: [] };
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

  const detail =
    info.authMethods !== undefined ? info.authMethods.join(' + ') : 'connected';
  console.log(`  ✓ ${name.padEnd(12)} ${detail}`);
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
