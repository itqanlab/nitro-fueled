import type Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ToolResult } from './types.js';

// ---------------------------------------------------------------------------
// get_available_providers — reads config, probes launcher binaries
// ---------------------------------------------------------------------------

interface ProviderConfig {
  launcher: string;
  enabled?: boolean;
  models?: Record<string, string>;
  autoPromote?: boolean;
  [key: string]: unknown;
}

interface ConfigFile {
  providers?: Record<string, ProviderConfig>;
  routing?: Record<string, string>;
  fallbackChain?: string[];
}

interface ProviderResult {
  name: string;
  launcher: string;
  available: boolean;
  reason?: string;
  models: Record<string, string>;
}

function probeLauncher(launcher: string): { available: boolean; reason?: string } {
  switch (launcher) {
    case 'claude':
      return { available: true };

    case 'glm': {
      const key = process.env['ZAI_API_KEY'];
      if (key) return { available: true };
      return { available: false, reason: 'ZAI_API_KEY not set in environment' };
    }

    case 'opencode': {
      try {
        execSync('which opencode', { stdio: 'pipe', timeout: 5000 });
        return { available: true };
      } catch {
        return { available: false, reason: 'opencode binary not found in PATH' };
      }
    }

    case 'codex': {
      try {
        execSync('which codex', { stdio: 'pipe', timeout: 5000 });
        return { available: true };
      } catch {
        return { available: false, reason: 'codex binary not found in PATH' };
      }
    }

    default: {
      try {
        execSync(`which ${launcher}`, { stdio: 'pipe', timeout: 5000 });
        return { available: true };
      } catch {
        return { available: false, reason: `${launcher} binary not found in PATH` };
      }
    }
  }
}

/**
 * Query `opencode models` for dynamic model discovery.
 * Returns all model names grouped by prefix.
 */
function queryDynamicModels(): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  try {
    const output = execSync('opencode models', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
    }).trim();

    for (const line of output.split('\n')) {
      const model = line.trim();
      if (model.length === 0) continue;
      const slashIdx = model.indexOf('/');
      const prefix = slashIdx > 0 ? model.slice(0, slashIdx) : 'opencode';
      if (!grouped.has(prefix)) grouped.set(prefix, []);
      grouped.get(prefix)!.push(model);
    }
  } catch {
    // opencode not available or models command failed — return empty
  }
  return grouped;
}

/**
 * Parse a model name into a sortable version tuple.
 * e.g. "zai-coding-plan/glm-5.1" → [5, 1, 0]
 *      "openai/gpt-5.4-mini" → [5, 4, 0] (with suffix "mini")
 * Returns null if no version is found.
 */
function parseModelVersion(model: string): { major: number; minor: number; patch: number; suffix: string } | null {
  // Match version-like patterns: digits.digits(.digits)? optionally followed by -suffix
  const match = model.match(/(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
  if (!match) {
    // Try single digit version like "glm-5"
    const single = model.match(/(\d+)(?:-(.+))?$/);
    if (!single) return null;
    return { major: parseInt(single[1], 10), minor: 0, patch: 0, suffix: single[2] ?? '' };
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
    suffix: match[4] ?? '',
  };
}

/** Suffixes that indicate a lighter/smaller model variant — these should not auto-promote to heavy. */
const LIGHT_SUFFIXES = new Set(['mini', 'air', 'flash', 'flashx', 'lite', 'small', 'spark', 'turbo']);

/**
 * From a list of discovered models, pick the best candidate for the heavy tier.
 * Skips models with light suffixes (mini, air, flash, etc.) and vision variants.
 * Returns the full model name or null if no suitable candidate.
 */
function pickHeavyModel(discovered: string[]): string | null {
  let best: { model: string; ver: { major: number; minor: number; patch: number } } | null = null;

  for (const model of discovered) {
    const parsed = parseModelVersion(model);
    if (!parsed) continue;
    // Skip light/small variants and vision models
    if (LIGHT_SUFFIXES.has(parsed.suffix.toLowerCase())) continue;
    if (parsed.suffix.toLowerCase().endsWith('v')) continue;

    if (!best ||
        parsed.major > best.ver.major ||
        (parsed.major === best.ver.major && parsed.minor > best.ver.minor) ||
        (parsed.major === best.ver.major && parsed.minor === best.ver.minor && parsed.patch > best.ver.patch)) {
      best = { model, ver: { major: parsed.major, minor: parsed.minor, patch: parsed.patch } };
    }
  }

  return best?.model ?? null;
}

function loadConfig(workingDirectory?: string): ConfigFile {
  const userConfig = join(homedir(), '.nitro-fueled', 'config.json');
  const projectConfig = workingDirectory
    ? join(workingDirectory, '.nitro-fueled', 'config.json')
    : null;

  let merged: ConfigFile = {};

  if (existsSync(userConfig)) {
    try {
      merged = JSON.parse(readFileSync(userConfig, 'utf8')) as ConfigFile;
    } catch {
      console.error(`[get_available_providers] failed to parse ${userConfig}`);
    }
  }

  if (projectConfig && existsSync(projectConfig)) {
    try {
      const project = JSON.parse(readFileSync(projectConfig, 'utf8')) as ConfigFile;
      if (project.routing) merged.routing = { ...merged.routing, ...project.routing };
      if (project.providers) merged.providers = { ...merged.providers, ...project.providers };
      if (project.fallbackChain) merged.fallbackChain = project.fallbackChain;
    } catch {
      console.error(`[get_available_providers] failed to parse ${projectConfig}`);
    }
  }

  if (!merged.providers || Object.keys(merged.providers).length === 0) {
    merged.providers = {
      anthropic: {
        launcher: 'claude',
        models: { balanced: 'claude-sonnet-4-6' },
      },
    };
  }

  return merged;
}

export async function handleGetAvailableProviders(
  args: { working_directory?: string },
): Promise<ToolResult> {
  const config = loadConfig(args.working_directory);
  const dynamicModels = queryDynamicModels();
  const results: ProviderResult[] = [];

  for (const [name, providerConfig] of Object.entries(config.providers ?? {})) {
    if (providerConfig.enabled === false) {
      results.push({ name, launcher: providerConfig.launcher ?? name, available: false, reason: 'disabled in config', models: {} });
      continue;
    }

    const launcher = providerConfig.launcher ?? name;
    const probe = probeLauncher(launcher);

    // Enrich config models with dynamically discovered models
    let models = probe.available ? (providerConfig.models ?? {}) : {};
    if (probe.available && dynamicModels.size > 0) {
      // Find the prefix for this provider (e.g., 'openai/', 'zai-coding-plan/')
      const prefix = (providerConfig as Record<string, unknown>)['modelPrefix'] as string | undefined;
      if (prefix) {
        const prefixKey = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
        const discovered = dynamicModels.get(prefixKey) ?? [];
        if (discovered.length > 0) {
          // Auto-promote heavy tier to the best available model (unless autoPromote: false)
          if (providerConfig.autoPromote !== false) {
            const bestHeavy = pickHeavyModel(discovered);
            if (bestHeavy && bestHeavy !== models['heavy']) {
              models = { ...models, heavy: bestHeavy, _configHeavy: models['heavy'] ?? '' };
            }
          }
          // Add full list of available models
          models = { ...models, _available: discovered.join(', ') } as Record<string, string>;
        }
      }
    }

    results.push({ name, launcher, available: probe.available, reason: probe.reason, models });
  }

  const lines = results.map((p) => {
    const status = p.available ? 'AVAILABLE' : 'UNAVAILABLE';
    const modelList = Object.entries(p.models).map(([tier, model]) => `${tier}=${model}`).join(', ');
    const reason = p.reason ? ` (${p.reason})` : '';
    return `${p.name}: ${status}${reason} — launcher=${p.launcher}, models=[${modelList || 'none'}]`;
  });

  if (config.routing) {
    lines.push('', 'Routing:');
    for (const [slot, provider] of Object.entries(config.routing)) {
      const available = results.find((r) => r.name === provider)?.available ?? false;
      lines.push(`  ${slot} → ${provider}${available ? '' : ' (UNAVAILABLE — will fallback)'}`);
    }
  }

  if (config.fallbackChain) {
    lines.push(`Fallback chain: ${config.fallbackChain.join(' → ')}`);
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}

// ---------------------------------------------------------------------------
// get_provider_stats — aggregates worker history by provider/model from DB
// ---------------------------------------------------------------------------

interface WorkerRow {
  provider: string | null;
  model: string | null;
  label: string;
  status: string;
  cost_json: string;
  tokens_json: string;
  spawn_time: string;
  compaction_count: number;
}

export async function handleGetProviderStats(
  args: { provider?: string; model?: string; worker_type?: string },
  db: Database.Database,
): Promise<ToolResult> {
  let query = 'SELECT provider, model, label, status, cost_json, tokens_json, spawn_time, compaction_count FROM workers WHERE 1=1';
  const params: string[] = [];

  if (args.provider) { query += ' AND provider = ?'; params.push(args.provider); }
  if (args.model) { query += ' AND model = ?'; params.push(args.model); }
  if (args.worker_type) { query += ' AND UPPER(label) LIKE ?'; params.push(`%${args.worker_type.toUpperCase()}%`); }

  const rows = db.prepare(query).all(...params) as WorkerRow[];

  if (rows.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No matching workers found.' }] };
  }

  const groups = new Map<string, WorkerRow[]>();
  for (const row of rows) {
    const key = `${row.provider ?? 'unknown'}/${row.model ?? 'unknown'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const stats: Array<{ key: string; total: number; completed: number; failed: number; killed: number; avgCost: number; avgTokens: number; avgCompactions: number; successRate: number }> = [];

  for (const [key, group] of groups) {
    const completed = group.filter((w) => w.status === 'completed').length;
    const failed = group.filter((w) => w.status === 'failed').length;
    const killed = group.filter((w) => w.status === 'killed').length;
    const finished = group.filter((w) => w.status === 'completed' || w.status === 'failed');

    let avgCost = 0;
    let avgTokens = 0;
    let avgCompactions = 0;

    if (finished.length > 0) {
      avgCost = finished.reduce((sum, w) => { try { const c = JSON.parse(w.cost_json) as { total_usd?: number }; return sum + (c.total_usd ?? 0); } catch { return sum; } }, 0) / finished.length;
      avgTokens = finished.reduce((sum, w) => { try { const t = JSON.parse(w.tokens_json) as { total_combined?: number }; return sum + (t.total_combined ?? 0); } catch { return sum; } }, 0) / finished.length;
      avgCompactions = finished.reduce((sum, w) => sum + w.compaction_count, 0) / finished.length;
    }

    stats.push({
      key,
      total: group.length,
      completed,
      failed,
      killed,
      avgCost: Math.round(avgCost * 100) / 100,
      avgTokens: Math.round(avgTokens),
      avgCompactions: Math.round(avgCompactions * 10) / 10,
      successRate: group.length > 0 ? Math.round((completed / group.length) * 100) : 0,
    });
  }

  stats.sort((a, b) => b.successRate - a.successRate || a.avgCost - b.avgCost);

  const lines = stats.map((s) => [
    `${s.key}: ${s.total} workers (${s.completed} ok, ${s.failed} fail, ${s.killed} killed)`,
    `  Success: ${s.successRate}% | Avg cost: $${s.avgCost} | Avg tokens: ${(s.avgTokens / 1000).toFixed(0)}k | Avg compactions: ${s.avgCompactions}`,
  ].join('\n'));

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
