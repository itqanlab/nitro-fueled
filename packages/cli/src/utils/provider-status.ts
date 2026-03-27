import {
  readConfig,
  testGlmConnection,
  resolveApiKey,
} from './provider-config.js';

export type ProviderStatus = 'connected' | 'failed' | 'not configured';

export interface ProviderStatusResult {
  name: string;
  status: ProviderStatus;
  /** e.g. "HTTP 401 — check API key" or "subscription" */
  detail?: string;
}

/**
 * Build the current provider status table.
 * Runs a live GLM connection test if GLM is configured.
 * OpenCode status is derived from binary + key presence (no live test).
 */
export async function getProviderStatus(cwd: string): Promise<ProviderStatusResult[]> {
  const config = readConfig(cwd);

  const results: ProviderStatusResult[] = [
    { name: 'Claude', status: 'connected', detail: 'subscription' },
  ];

  if (config === null) {
    results.push({ name: 'GLM', status: 'not configured' });
    results.push({ name: 'OpenCode', status: 'not configured' });
    return results;
  }

  // GLM — live connection test
  const glm = config.providers.glm;
  if (glm?.enabled === true) {
    const live = await testGlmConnection(glm.apiKey, glm.baseUrl);
    if (live.ok) {
      results.push({ name: 'GLM', status: 'connected', detail: live.modelName });
    } else {
      const detail = live.error !== undefined ? live.error : 'connection failed';
      results.push({ name: 'GLM', status: 'failed', detail });
    }
  } else {
    results.push({ name: 'GLM', status: 'not configured' });
  }

  // OpenCode — binary + key presence (no live test needed)
  const opencode = config.providers.opencode;
  if (opencode?.enabled === true) {
    const keyOk = resolveApiKey(opencode.apiKey) !== '';
    if (keyOk) {
      results.push({ name: 'OpenCode', status: 'connected', detail: opencode.defaultModel });
    } else {
      results.push({ name: 'OpenCode', status: 'failed', detail: 'API key unset' });
    }
  } else {
    results.push({ name: 'OpenCode', status: 'not configured' });
  }

  return results;
}

/** Print the provider status table to stdout. */
export function printProviderStatusTable(statuses: ProviderStatusResult[]): void {
  console.log('Provider Status');
  console.log('───────────────');
  for (const s of statuses) {
    const icon = s.status === 'connected' ? '✓' : s.status === 'failed' ? '✗' : '-';
    const detail = s.detail !== undefined ? ` (${s.detail})` : '';
    const label = s.status === 'not configured' ? 'not configured' : s.status;
    console.log(`  ${icon} ${s.name.padEnd(10)} ${label}${detail}`);
  }
}
