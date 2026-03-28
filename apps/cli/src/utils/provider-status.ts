import { readConfig, readGlobalConfig, type LauncherName } from './provider-config.js';

export type ProviderStatus = 'connected' | 'failed' | 'not configured';

export interface ProviderStatusResult {
  name: string;
  status: ProviderStatus;
  /** e.g. "oauth + api-key" or "not found" */
  detail?: string;
}

/**
 * Build the current provider status table from the launchers section.
 * No live connection tests — status is derived from stored launcher state.
 */
export async function getProviderStatus(cwd: string): Promise<ProviderStatusResult[]> {
  const config = readConfig(cwd) ?? readGlobalConfig();

  if (config === null) {
    return [
      { name: 'claude', status: 'not configured' },
      { name: 'opencode', status: 'not configured' },
      { name: 'codex', status: 'not configured' },
    ];
  }

  const launchers = config.launchers;
  const names: LauncherName[] = ['claude', 'opencode', 'codex'];
  const results: ProviderStatusResult[] = [];

  for (const name of names) {
    const info = launchers[name];
    if (info === undefined) {
      results.push({ name, status: 'not configured' });
      continue;
    }

    if (!info.found) {
      results.push({ name, status: 'failed', detail: 'not found' });
      continue;
    }

    if (!info.authenticated) {
      results.push({ name, status: 'failed', detail: 'not authenticated' });
      continue;
    }

    const detail = info.authMethods !== undefined
      ? info.authMethods.join(' + ')
      : 'connected';
    results.push({ name, status: 'connected', detail });
  }

  return results;
}

/** Print the provider status table to stdout. */
export function printProviderStatusTable(statuses: ProviderStatusResult[]): void {
  console.log('Launcher Status');
  console.log('───────────────');
  for (const s of statuses) {
    const icon = s.status === 'connected' ? '✓' : s.status === 'failed' ? '✗' : '-';
    const detail = s.detail !== undefined ? ` (${s.detail})` : '';
    const label = s.status === 'not configured' ? 'not configured' : s.status;
    console.log(`  ${icon} ${s.name.padEnd(12)} ${label}${detail}`);
  }
}
