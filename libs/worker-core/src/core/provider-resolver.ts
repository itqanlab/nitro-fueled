import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import type { NitroFueledConfig, LauncherName, LauncherInfo, ProviderEntry } from '../types.js';

// ---------------------------------------------------------------------------
// Hardcoded last-resort fallback
// ---------------------------------------------------------------------------

export const FALLBACK_PROVIDER: { providerName: string; model: string; launcher: LauncherName } = {
  providerName: 'anthropic',
  model: 'claude-sonnet-4-6',
  launcher: 'claude',
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLauncherInfo(value: unknown): value is LauncherInfo {
  if (!isRecord(value)) return false;
  return typeof value['found'] === 'boolean' && typeof value['authenticated'] === 'boolean';
}

function isValidLauncherName(value: unknown): value is LauncherName {
  return value === 'claude' || value === 'opencode' || value === 'codex';
}

function isProviderEntry(value: unknown): value is ProviderEntry {
  if (!isRecord(value)) return false;
  if (!isValidLauncherName(value['launcher'])) return false;
  if (!isRecord(value['models'])) return false;
  return true;
}

function isNitroFueledConfig(value: unknown): value is NitroFueledConfig {
  if (!isRecord(value)) return false;
  if (!('launchers' in value && isRecord(value['launchers']))) return false;
  if (!('providers' in value && isRecord(value['providers']))) return false;
  if (!('routing' in value && isRecord(value['routing']))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Config parsing
// ---------------------------------------------------------------------------

function parseConfigFile(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
    console.warn(`provider-resolver: ${filePath} is unreadable (${msg}). Phase 2 re-validation skipped.`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public: readProviderConfig
// ---------------------------------------------------------------------------

/**
 * Reads global (~/.nitro-fueled/config.json) and project ({cwd}/.nitro-fueled/config.json)
 * configs and merges them. Project values win over global.
 * Returns null if neither config file is valid.
 */
export function readProviderConfig(cwd: string): NitroFueledConfig | null {
  const globalPath = join(homedir(), '.nitro-fueled', 'config.json');
  const projectPath = resolve(cwd, '.nitro-fueled', 'config.json');

  const globalParsed = parseConfigFile(globalPath);
  const projectParsed = parseConfigFile(projectPath);

  const globalConfig = globalParsed !== null && isNitroFueledConfig(globalParsed) ? globalParsed : null;
  const projectConfig = projectParsed !== null && isNitroFueledConfig(projectParsed) ? projectParsed : null;

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isLauncherAvailable(launcherName: LauncherName, config: NitroFueledConfig): boolean {
  const launcher = config.launchers[launcherName];
  if (!isLauncherInfo(launcher)) return false;
  return launcher.found && launcher.authenticated;
}

function tryProvider(
  providerName: string,
  config: NitroFueledConfig,
): { providerName: string; model: string; launcher: LauncherName } | null {
  const entry = config.providers[providerName];
  if (!isProviderEntry(entry)) return null;
  if (!isLauncherAvailable(entry.launcher, config)) return null;

  // Pick any available model — prefer balanced, then heavy, then light
  const model = entry.models['balanced'] ?? entry.models['heavy'] ?? entry.models['light'];
  if (model === undefined || model === '') return null;

  return { providerName, model, launcher: entry.launcher };
}

// ---------------------------------------------------------------------------
// Public: resolveProviderForSpawn
// ---------------------------------------------------------------------------

/**
 * Re-validates that the given provider+model are actually available (launcher found + authenticated).
 * Runs fallback chain if needed. Returns the resolved (possibly substituted) result.
 *
 * Fallback order when the requested provider is unavailable:
 *   Tries each entry in config.providers in insertion order, then hardcoded FALLBACK_PROVIDER.
 */
export function resolveProviderForSpawn(
  providerName: string,
  model: string,
  config: NitroFueledConfig,
): { providerName: string; model: string; launcher: LauncherName } | null {
  // Check if the requested provider + model are already valid
  const requestedEntry = config.providers[providerName];
  if (isProviderEntry(requestedEntry) && isLauncherAvailable(requestedEntry.launcher, config)) {
    return { providerName, model, launcher: requestedEntry.launcher };
  }

  // Walk all providers in config for a fallback (includes anthropic if present)
  for (const candidateName of Object.keys(config.providers)) {
    if (candidateName === providerName) continue;
    const result = tryProvider(candidateName, config);
    if (result !== null) return result;
  }

  // All config providers (including anthropic) are unavailable — return null
  return null;
}
