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

export function readConfig(cwd: string): NitroFueledConfig | null {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as NitroFueledConfig;
  } catch {
    return null;
  }
}

export function writeConfig(cwd: string, config: NitroFueledConfig): void {
  const configPath = getConfigPath(cwd);
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8' });

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

const GITIGNORE_ENTRY = '.nitro-fueled/';

export function ensureGitignore(cwd: string): void {
  const gitignorePath = resolve(cwd, '.gitignore');

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (content.includes(GITIGNORE_ENTRY)) return;
    const newContent = content.endsWith('\n')
      ? content + GITIGNORE_ENTRY + '\n'
      : content + '\n' + GITIGNORE_ENTRY + '\n';
    writeFileSync(gitignorePath, newContent, 'utf8');
  } else {
    writeFileSync(gitignorePath, GITIGNORE_ENTRY + '\n', 'utf8');
  }
}

export interface ProviderConfigIssue {
  provider: string;
  message: string;
}

/**
 * Validate provider config for pre-flight: returns issues for enabled providers
 * with missing credentials. Returns empty array if no config exists (config is optional).
 */
export function checkProviderConfig(cwd: string): ProviderConfigIssue[] {
  const config = readConfig(cwd);
  if (config === null) return [];

  const issues: ProviderConfigIssue[] = [];

  const glm = config.providers.glm;
  if (glm?.enabled === true) {
    const key = resolveApiKey(glm.apiKey);
    if (key === '') {
      issues.push({ provider: 'GLM', message: `API key is empty (set ZAI_API_KEY or run 'npx nitro-fueled config')` });
    }
  }

  return issues;
}

export interface GlmTestResult {
  ok: boolean;
  modelName?: string;
}

export async function testGlmConnection(apiKey: string, baseUrl: string): Promise<GlmTestResult> {
  const resolved = resolveApiKey(apiKey);
  if (resolved === '') return { ok: false };

  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { 'x-api-key': resolved, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return { ok: false };

    const data = await response.json() as { data?: Array<{ id: string }> };
    const models = data.data ?? [];
    const modelName = models[0]?.id ?? 'connected';
    return { ok: true, modelName };
  } catch {
    return { ok: false };
  }
}
