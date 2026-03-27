import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export interface ClaudeProviderConfig {
  enabled: boolean;
  source: 'subscription';
}

export interface GlmProviderConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  models: {
    opus: string;
    sonnet: string;
    haiku: string;
  };
}

export interface OpenCodeProviderConfig {
  enabled: boolean;
  apiKey: string;
  defaultModel: string;
}

export interface ProvidersConfig {
  claude?: ClaudeProviderConfig;
  glm?: GlmProviderConfig;
  opencode?: OpenCodeProviderConfig;
}

export interface NitroFueledConfig {
  providers: ProvidersConfig;
}

export function getConfigPath(cwd: string): string {
  return resolve(cwd, '.nitro-fueled', 'config.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidConfig(value: unknown): value is NitroFueledConfig {
  return isRecord(value) && 'providers' in value && isRecord(value['providers']);
}

/**
 * Read provider config. Returns null if the file does not exist.
 * Emits a console.warn if the file exists but is malformed (parse error or wrong shape).
 */
export function readConfig(cwd: string): NitroFueledConfig | null {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: .nitro-fueled/config.json is unreadable (${msg}). Run 'npx nitro-fueled config' to reconfigure.`);
    return null;
  }

  if (!isValidConfig(parsed)) {
    console.warn(`Warning: .nitro-fueled/config.json has an unexpected shape. Run 'npx nitro-fueled config' to reconfigure.`);
    return null;
  }

  return parsed;
}

export function writeConfig(cwd: string, config: NitroFueledConfig): void {
  const configPath = getConfigPath(cwd);
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // mode: 0o600 sets permissions atomically at creation time, closing the write-then-chmod race.
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });

  // chmod also corrects permissions for pre-existing files (non-fatal if unsupported).
  try {
    chmodSync(configPath, 0o600);
  } catch {
    // non-fatal — some platforms may not support chmod
  }
}

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

export interface ProviderConfigIssue {
  provider: string;
  message: string;
}

const ZAI_API_KEY_ENV = 'ZAI_API_KEY';
const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY';

/**
 * Validate provider config for pre-flight. Returns issues for enabled providers
 * with missing or unresolvable credentials. Returns empty array if no config exists.
 */
export function checkProviderConfig(cwd: string): ProviderConfigIssue[] {
  const config = readConfig(cwd);
  if (config === null) return [];

  const issues: ProviderConfigIssue[] = [];

  const glm = config.providers.glm;
  if (glm?.enabled === true) {
    const key = resolveApiKey(glm.apiKey);
    if (key === '') {
      issues.push({ provider: 'GLM', message: `API key is empty (set ${ZAI_API_KEY_ENV} or run 'npx nitro-fueled config')` });
    }
  }

  const opencode = config.providers.opencode;
  if (opencode?.enabled === true) {
    const key = resolveApiKey(opencode.apiKey);
    if (key === '') {
      issues.push({ provider: 'OpenCode', message: `API key is empty (set ${OPENAI_API_KEY_ENV} or run 'npx nitro-fueled config')` });
    }
  }

  return issues;
}

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
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
