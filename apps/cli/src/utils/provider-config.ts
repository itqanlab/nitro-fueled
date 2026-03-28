import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, renameSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Launcher types
// ---------------------------------------------------------------------------

export type LauncherName = 'claude' | 'opencode' | 'codex';
export type AuthMethod = 'oauth' | 'api-key';

export interface LauncherInfo {
  found: boolean;
  authenticated: boolean;
  authMethods?: AuthMethod[];
  models: string[];
}

export type LaunchersConfig = Record<LauncherName, LauncherInfo>;

// ---------------------------------------------------------------------------
// Tier + Provider types
// ---------------------------------------------------------------------------

export type ModelTier = 'heavy' | 'balanced' | 'light';

export interface ProviderEntry {
  launcher: LauncherName;
  modelPrefix?: string;
  models: Record<ModelTier, string>;
}

export type RoutingSlot =
  | 'default'
  | 'heavy'
  | 'balanced'
  | 'light'
  | 'review-logic'
  | 'review-style'
  | 'review-simple'
  | 'documentation';

export type RoutingConfig = Partial<Record<RoutingSlot, string>>;

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export interface NitroFueledConfig {
  launchers: Partial<LaunchersConfig>;
  providers: Record<string, ProviderEntry>;
  routing: RoutingConfig;
}

// ---------------------------------------------------------------------------
// Default provider/routing definitions
// ---------------------------------------------------------------------------

export const DEFAULT_PROVIDERS: Record<string, ProviderEntry> = {
  anthropic: {
    launcher: 'claude',
    models: {
      heavy: 'claude-opus-4-6',
      balanced: 'claude-sonnet-4-6',
      light: 'claude-haiku-4-5-20251001',
    },
  },
  zai: {
    launcher: 'opencode',
    modelPrefix: 'zai-coding-plan/',
    models: {
      heavy: 'zai-coding-plan/glm-5',
      balanced: 'zai-coding-plan/glm-4.7',
      light: 'zai-coding-plan/glm-4.5-air',
    },
  },
  'openai-opencode': {
    launcher: 'opencode',
    modelPrefix: 'openai/',
    models: {
      heavy: 'openai/gpt-5.4',
      balanced: 'openai/gpt-5.4-mini',
      light: 'openai/gpt-5.4-mini',
    },
  },
  'openai-codex': {
    launcher: 'codex',
    modelPrefix: 'openai/',
    models: {
      heavy: 'openai/gpt-5.4',
      balanced: 'openai/gpt-5.4-mini',
      light: 'openai/codex-mini-latest',
    },
  },
};

export const DEFAULT_ROUTING: RoutingConfig = {
  default: 'anthropic',
  heavy: 'anthropic',
  balanced: 'anthropic',
  light: 'anthropic',
  'review-logic': 'anthropic',
  'review-style': 'anthropic',
  'review-simple': 'anthropic',
  documentation: 'anthropic',
};

// ---------------------------------------------------------------------------
// Config paths
// ---------------------------------------------------------------------------

/** Global config path: ~/.nitro-fueled/config.json */
export function getGlobalConfigPath(): string {
  return join(homedir(), '.nitro-fueled', 'config.json');
}

/** Per-project config path: {cwd}/.nitro-fueled/config.json */
export function getProjectConfigPath(cwd: string): string {
  return resolve(cwd, '.nitro-fueled', 'config.json');
}

/**
 * @deprecated Use getGlobalConfigPath() or getProjectConfigPath() instead.
 * Kept for backward-compat with existing callers (run.ts, config.ts --reset).
 */
export function getConfigPath(cwd: string): string {
  return getProjectConfigPath(cwd);
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidNewConfig(value: unknown): value is NitroFueledConfig {
  if (!isRecord(value)) return false;
  if (!('launchers' in value && isRecord(value['launchers']))) return false;
  if (!('providers' in value && isRecord(value['providers']))) return false;
  if (!('routing' in value && isRecord(value['routing']))) return false;
  return true;
}

/** Check if a parsed JSON blob is an old-format config (has providers.claude/glm/opencode). */
function isOldFormatConfig(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!('providers' in value && isRecord(value['providers']))) return false;
  const providers = value['providers'] as Record<string, unknown>;
  // Old format had provider keys like 'claude', 'glm', 'opencode' with an 'enabled' field
  return (
    (isRecord(providers['claude']) && 'enabled' in providers['claude']) ||
    (isRecord(providers['glm']) && 'enabled' in providers['glm']) ||
    (isRecord(providers['opencode']) && 'enabled' in providers['opencode'])
  );
}

// ---------------------------------------------------------------------------
// Read / Write / Merge
// ---------------------------------------------------------------------------

function parseConfigFile(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
    console.warn(`Warning: ${filePath} is unreadable (${msg}). Run 'npx nitro-fueled config' to reconfigure.`);
    return null;
  }
}

/**
 * Read config with global + project merge.
 * Project values win over global when both exist.
 * Auto-migrates old-format project configs on first read.
 */
export function readConfig(cwd: string): NitroFueledConfig | null {
  const globalPath = getGlobalConfigPath();
  const projectPath = getProjectConfigPath(cwd);

  // Handle old-format migration for project config
  const projectRaw = parseConfigFile(projectPath);
  if (projectRaw !== null && isOldFormatConfig(projectRaw)) {
    migrateOldConfig(projectPath, projectRaw);
  }

  const globalParsed = parseConfigFile(globalPath);
  const projectParsed = parseConfigFile(projectPath);

  const globalConfig = globalParsed !== null && isValidNewConfig(globalParsed) ? globalParsed : null;
  const projectConfig = projectParsed !== null && isValidNewConfig(projectParsed) ? projectParsed : null;

  if (globalConfig === null && projectConfig === null) return null;
  if (globalConfig === null) return projectConfig;
  if (projectConfig === null) return globalConfig;

  // Merge: project wins
  return {
    launchers: { ...globalConfig.launchers, ...projectConfig.launchers },
    providers: { ...globalConfig.providers, ...projectConfig.providers },
    routing: { ...globalConfig.routing, ...projectConfig.routing },
  };
}

/** Read only the global config (no project merge). */
export function readGlobalConfig(): NitroFueledConfig | null {
  const parsed = parseConfigFile(getGlobalConfigPath());
  if (parsed !== null && isValidNewConfig(parsed)) return parsed;
  return null;
}

/** Write config to the global path (~/.nitro-fueled/config.json). */
export function writeConfig(config: NitroFueledConfig): void {
  const configPath = getGlobalConfigPath();
  const dir = dirname(configPath);

  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const tmpPath = configPath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });

  try {
    chmodSync(tmpPath, 0o600);
  } catch {
    // non-fatal — some platforms may not support chmod
  }

  renameSync(tmpPath, configPath);
}

// ---------------------------------------------------------------------------
// Migration from old format
// ---------------------------------------------------------------------------

interface OldProviders {
  claude?: { enabled: boolean; source: string };
  glm?: { enabled: boolean; apiKey: string; baseUrl: string; models: { opus: string; sonnet: string; haiku: string } };
  opencode?: { enabled: boolean; authMethod?: string; apiKey?: string; defaultModel: string };
}

function migrateOldConfig(projectPath: string, raw: unknown): void {
  if (!isRecord(raw)) return;
  const old = raw as { providers: OldProviders };

  const newConfig: NitroFueledConfig = {
    launchers: {},
    providers: { ...DEFAULT_PROVIDERS },
    routing: { ...DEFAULT_ROUTING },
  };

  // Derive routing from what was enabled
  if (old.providers.glm?.enabled === true) {
    newConfig.routing['default'] = 'zai';
    newConfig.routing['balanced'] = 'zai';
  }

  // Rename old file
  const migratedPath = projectPath.replace(/\.json$/, '.json.migrated');
  try {
    renameSync(projectPath, migratedPath);
  } catch {
    // If rename fails, just continue
  }

  // Write migrated config to global
  writeConfig(newConfig);
  console.log(`  Migrated old config to ${getGlobalConfigPath()} (backup: ${migratedPath})`);
}

// ---------------------------------------------------------------------------
// API key resolution (kept for GLM connection test)
// ---------------------------------------------------------------------------

/**
 * Resolve an API key value: if it starts with '$', read from the named env var.
 * Returns empty string if the env var is unset.
 */
export function resolveApiKey(value: string): string {
  if (value.startsWith('$')) {
    const envVarName = value.slice(1);
    return process.env[envVarName] ?? '';
  }
  return value;
}

// ---------------------------------------------------------------------------
// GLM connection test (kept for --test mode)
// ---------------------------------------------------------------------------

export interface GlmTestResult {
  ok: boolean;
  modelName?: string;
  error?: string;
}

export async function testGlmConnection(apiKey: string, baseUrl: string): Promise<GlmTestResult> {
  const resolved = resolveApiKey(apiKey);
  if (resolved === '') return { ok: false, error: 'API key is empty' };

  let url: URL;
  try {
    url = new URL(`${baseUrl}/v1/models`);
  } catch {
    return { ok: false, error: 'Invalid base URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Base URL must use HTTPS' };
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { 'x-api-key': resolved, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${String(response.status)} from provider` };
    }

    const data: unknown = await response.json();
    const models = isRecord(data) && Array.isArray(data['data'])
      ? (data['data'] as Array<unknown>)
      : [];
    const first = models[0];
    const modelName = isRecord(first) && typeof first['id'] === 'string'
      ? first['id']
      : 'connected';
    return { ok: true, modelName };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Provider config validation (pre-flight)
// ---------------------------------------------------------------------------

export interface ProviderConfigIssue {
  provider: string;
  message: string;
}

/**
 * Validate config for pre-flight. Returns issues for providers with
 * missing launchers or auth. Returns empty array if no config exists.
 */
export function checkProviderConfig(cwd: string): ProviderConfigIssue[] {
  const config = readConfig(cwd);
  if (config === null) return [];

  const issues: ProviderConfigIssue[] = [];
  const routing = config.routing;
  const launchers = config.launchers;

  // Check that routed providers have working launchers
  const usedProviders = new Set(Object.values(routing).filter(Boolean));
  for (const providerName of usedProviders) {
    if (providerName === undefined) continue;
    const provider = config.providers[providerName];
    if (provider === undefined) {
      issues.push({ provider: providerName, message: `Provider "${providerName}" referenced in routing but not defined` });
      continue;
    }
    const launcher = launchers[provider.launcher];
    if (launcher === undefined || !launcher.found) {
      issues.push({ provider: providerName, message: `Launcher "${provider.launcher}" not found — install it or run 'npx nitro-fueled config'` });
    } else if (!launcher.authenticated) {
      issues.push({ provider: providerName, message: `Launcher "${provider.launcher}" not authenticated — run 'npx nitro-fueled config' for setup instructions` });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Utility: build available providers from launcher state
// ---------------------------------------------------------------------------

/**
 * Given detected launchers, return provider names that are usable
 * (launcher found + authenticated).
 */
export function getAvailableProviders(config: NitroFueledConfig): string[] {
  const available: string[] = [];
  for (const [name, entry] of Object.entries(config.providers)) {
    const launcher = config.launchers[entry.launcher];
    if (launcher?.found === true && launcher.authenticated) {
      available.push(name);
    }
  }
  return available;
}
