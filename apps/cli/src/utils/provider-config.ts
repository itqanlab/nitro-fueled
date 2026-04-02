import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, renameSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from './logger.js';
import { isOldFormatConfig, buildMigratedConfig } from './provider-migration.js';

// Re-export defaults and GLM test utilities so existing callers do not need
// to update their import paths.
export { DEFAULT_PROVIDERS, DEFAULT_ROUTING } from './provider-defaults.js';
export { resolveApiKey, testGlmConnection, type GlmTestResult } from './glm-test.js';

// ---------------------------------------------------------------------------
// Launcher types
// NOTE: LauncherName, ModelTier, LauncherInfo, ProviderEntry, NitroFueledConfig are
// mirrored in libs/worker-core/src/types.ts — keep in sync (no cross-app import path).
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

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidNewConfig(value: unknown): value is NitroFueledConfig {
  if (!isRecord(value)) return false;
  if (!('launchers' in value && isRecord(value['launchers']))) return false;
  if (!('providers' in value && isRecord(value['providers']))) return false;
  if (!('routing' in value && isRecord(value['routing']))) return false;
  return true;
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
    logger.warn(
      `Warning: ${filePath} is unreadable (${msg}). Run 'npx nitro-fueled config' to reconfigure.`,
    );
    return null;
  }
}

/**
 * Read config with global + project merge.
 * Project values win over global when both exist.
 * Auto-migrates old-format project configs on first read.
 */
export function readConfig(cwd: string): NitroFueledConfig | null {
  const projectPath = getProjectConfigPath(cwd);

  // Auto-migrate old-format project config if present
  const projectRaw = parseConfigFile(projectPath);
  if (projectRaw !== null && isOldFormatConfig(projectRaw)) {
    const result = buildMigratedConfig(projectPath, projectRaw);
    if (result !== null) {
      writeConfig(result.migratedConfig);
      logger.log(
        `  Migrated old config to ${getGlobalConfigPath()} (backup: ${result.backupPath})`,
      );
    }
  }

  const globalParsed = parseConfigFile(getGlobalConfigPath());
  const projectParsed = parseConfigFile(projectPath);

  const globalConfig =
    globalParsed !== null && isValidNewConfig(globalParsed) ? globalParsed : null;
  const projectConfig =
    projectParsed !== null && isValidNewConfig(projectParsed) ? projectParsed : null;

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
  writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });

  try {
    chmodSync(tmpPath, 0o600);
  } catch (err: unknown) {
    logger.debug(
      `Note: chmod not supported on this platform: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  renameSync(tmpPath, configPath);
}

// ---------------------------------------------------------------------------
// Provider config validation (pre-flight)
// ---------------------------------------------------------------------------

export interface ProviderConfigIssue {
  provider: string;
  message: string;
}

/**
 * Validate config for pre-flight. Returns issues for providers with missing
 * launchers or auth. Returns empty array when no config exists.
 */
export function checkProviderConfig(cwd: string): ProviderConfigIssue[] {
  const config = readConfig(cwd);
  if (config === null) return [];

  const issues: ProviderConfigIssue[] = [];
  const { routing, launchers } = config;

  const usedProviders = new Set(Object.values(routing).filter(Boolean));
  for (const providerName of usedProviders) {
    if (providerName === undefined) continue;
    const provider = config.providers[providerName];
    if (provider === undefined) {
      issues.push({
        provider: providerName,
        message: `Provider "${providerName}" referenced in routing but not defined`,
      });
      continue;
    }
    const launcher = launchers[provider.launcher];
    if (launcher === undefined || !launcher.found) {
      issues.push({
        provider: providerName,
        message: `Launcher "${provider.launcher}" not found — install it or run 'npx nitro-fueled config'`,
      });
    } else if (!launcher.authenticated) {
      issues.push({
        provider: providerName,
        message: `Launcher "${provider.launcher}" not authenticated — run 'npx nitro-fueled config' for setup instructions`,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Utility: build available providers from launcher state
// ---------------------------------------------------------------------------

/**
 * Return provider names that are usable (launcher found + authenticated).
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
