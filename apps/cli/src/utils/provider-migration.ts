/**
 * Migration logic for old-format provider configs.
 * Extracted from provider-config.ts to keep that file within the 200-line limit.
 *
 * Uses a local isRecord copy (instead of importing from provider-config.ts) to
 * avoid a circular dependency: provider-config.ts imports buildMigratedConfig
 * from this module, so this module cannot also import values from provider-config.ts.
 */
import { renameSync } from 'node:fs';
import type { NitroFueledConfig } from './provider-config.js';
import { DEFAULT_PROVIDERS, DEFAULT_ROUTING } from './provider-defaults.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface OldProviders {
  claude?: { enabled: boolean; source: string };
  glm?: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    models: { opus: string; sonnet: string; haiku: string };
  };
  opencode?: { enabled: boolean; authMethod?: string; apiKey?: string; defaultModel: string };
}

/** Check if a parsed JSON blob is an old-format config (has providers.claude/glm/opencode). */
export function isOldFormatConfig(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!('providers' in value)) return false;
  const providers = value['providers'];
  if (!isRecord(providers)) return false;
  return (
    (isRecord(providers['claude']) && 'enabled' in providers['claude']) ||
    (isRecord(providers['glm']) && 'enabled' in providers['glm']) ||
    (isRecord(providers['opencode']) && 'enabled' in providers['opencode'])
  );
}

/**
 * Build a migrated NitroFueledConfig from an old-format config blob.
 * Also renames the old project config file to *.json.migrated.
 * Returns null if the raw input is not a valid record.
 *
 * Callers are responsible for writing the returned config and logging the result.
 */
export function buildMigratedConfig(
  projectPath: string,
  raw: unknown,
): { migratedConfig: NitroFueledConfig; backupPath: string } | null {
  if (!isRecord(raw)) return null;
  const providers = raw['providers'];
  if (!isRecord(providers)) return null;

  const glm = providers['glm'];
  const glmEnabled = isRecord(glm) && glm['enabled'] === true;

  const migratedConfig: NitroFueledConfig = {
    launchers: {},
    providers: { ...DEFAULT_PROVIDERS },
    routing: { ...DEFAULT_ROUTING },
  };

  // Derive routing from what was previously enabled
  if (glmEnabled) {
    migratedConfig.routing['default'] = 'zai';
    migratedConfig.routing['balanced'] = 'zai';
  }

  const backupPath = projectPath.replace(/\.json$/, '.json.migrated');
  try {
    renameSync(projectPath, backupPath);
  } catch (err: unknown) {
    console.warn(
      `  Could not rename old config to backup: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { migratedConfig, backupPath };
}
