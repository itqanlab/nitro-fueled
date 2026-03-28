import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { WorkerTokenStats, WorkerCost, WorkerProgress, HealthStatus } from '../db/schema.js';
import { emptyTokenStats, emptyCost, emptyProgress } from '../db/schema.js';
import { spawnWorkerProcess, killWorkerProcess, isProcessAlive, resolveGlmApiKey } from '../process/spawn.js';
import type { JsonlWatcher } from '../process/jsonl-watcher.js';

type ToolResult = { content: Array<{ type: 'text'; text: string }> };

const DEFAULT_MODEL = process.env['DEFAULT_MODEL'] ?? 'claude-sonnet-4-6';
const STARTUP_GRACE_MS = 300_000;

interface WorkerRow {
  id: string;
  session_id: string;
  task_id: string | null;
  worker_type: string;
  label: string;
  status: string;
  pid: number | null;
  working_directory: string | null;
  model: string | null;
  provider: string | null;
  launcher: string | null;
  log_path: string | null;
  auto_close: number;
  spawn_time: string;
  compaction_count: number;
  tokens_json: string;
  cost_json: string;
  progress_json: string;
}

function parseTokens(json: string): WorkerTokenStats {
  try { return JSON.parse(json) as WorkerTokenStats; } catch { return emptyTokenStats(); }
}

function parseCost(json: string): WorkerCost {
  try { return JSON.parse(json) as WorkerCost; } catch { return emptyCost(); }
}

function parseProgress(json: string): WorkerProgress {
  try { return JSON.parse(json) as WorkerProgress; } catch { return emptyProgress(); }
}

function getHealth(row: WorkerRow): HealthStatus {
  if (!row.pid || !isProcessAlive(row.pid)) return 'finished';
  if (row.compaction_count >= 2) return 'compacting';
  const tokens = parseTokens(row.tokens_json);
  if (tokens.context_percent > 80) return 'high_context';
  const progress = parseProgress(row.progress_json);
  const spawnMs = new Date(row.spawn_time).getTime();
  if (progress.message_count === 0 && Date.now() - spawnMs < STARTUP_GRACE_MS) return 'starting';
  if (Date.now() - progress.last_action_at > 120_000) return 'stuck';
  return 'healthy';
}

export function handleSpawnWorker(
  db: Database.Database,
  watcher: JsonlWatcher,
  args: {
    session_id: string;
    task_id?: string;
    worker_type: string;
    prompt: string;
    working_directory: string;
    label: string;
    model?: string;
    provider?: string;
    auto_close?: boolean;
  },
): ToolResult {
  const model = args.model ?? DEFAULT_MODEL;
  const provider = (args.provider ?? 'claude') as 'claude' | 'glm' | 'opencode';
  const workerId = randomUUID();

  let glmApiKey: string | undefined;
  if (provider === 'glm') {
    glmApiKey = resolveGlmApiKey(args.working_directory);
    if (!glmApiKey) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ok: false, reason: 'GLM API key not found. Set ZAI_API_KEY or configure .nitro-fueled/config.json',
      }) }] };
    }
  }

  const { pid, logPath } = spawnWorkerProcess({
    prompt: args.prompt,
    workingDirectory: args.working_directory,
    label: args.label,
    model,
    provider,
    glmApiKey,
    onMessage: (msg) => {
      watcher.feedMessage(workerId, model, msg);
    },
    onExit: (code) => {
      const newStatus = code === 0 ? 'completed' : 'failed';
      db.prepare('UPDATE workers SET status = ? WHERE id = ?').run(newStatus, workerId);
    },
  });

  db.prepare(`
    INSERT INTO workers (id, session_id, task_id, worker_type, label, status, pid, working_directory, model, provider, launcher, log_path, auto_close, tokens_json, cost_json, progress_json)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'print', ?, ?, '{}', '{}', '{}')
  `).run(
    workerId, args.session_id, args.task_id ?? null,
    args.worker_type, args.label, pid, args.working_directory,
    model, provider, logPath, args.auto_close ? 1 : 0,
  );

  return { content: [{ type: 'text' as const, text: JSON.stringify({
    ok: true, worker_id: workerId, pid, label: args.label, provider, model, log_path: logPath,
  }) }] };
}

export function handleListWorkers(
  db: Database.Database,
  args: { session_id?: string; status_filter?: string },
): ToolResult {
  let rows: WorkerRow[];
  if (args.session_id && args.status_filter && args.status_filter !== 'all') {
    rows = db.prepare('SELECT * FROM workers WHERE session_id = ? AND status = ? ORDER BY spawn_time').all(args.session_id, args.status_filter) as WorkerRow[];
  } else if (args.session_id) {
    rows = db.prepare('SELECT * FROM workers WHERE session_id = ? ORDER BY spawn_time').all(args.session_id) as WorkerRow[];
  } else if (args.status_filter && args.status_filter !== 'all') {
    rows = db.prepare('SELECT * FROM workers WHERE status = ? ORDER BY spawn_time').all(args.status_filter) as WorkerRow[];
  } else {
    rows = db.prepare('SELECT * FROM workers ORDER BY spawn_time').all() as WorkerRow[];
  }

  if (rows.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No workers found.' }] };
  }

  const lines = rows.map((w) => {
    const tokens = parseTokens(w.tokens_json);
    const cost = parseCost(w.cost_json);
    const progress = parseProgress(w.progress_json);
    const elapsed = Math.round((Date.now() - new Date(w.spawn_time).getTime()) / 60000);
    const totalStr = tokens.total_combined >= 1_000_000
      ? `${(tokens.total_combined / 1_000_000).toFixed(1)}M`
      : `${Math.round(tokens.total_combined / 1000)}k`;
    return [
      `[${w.status.toUpperCase()}] ${w.label}`,
      `  ID: ${w.id} | PID: ${w.pid ?? 'n/a'} | ${elapsed}m`,
      `  Provider: ${w.provider ?? 'claude'} | Model: ${w.model ?? 'unknown'}`,
      `  Tokens: ${totalStr} | Ctx: ${tokens.context_percent}% | Compactions: ${tokens.compaction_count}`,
      `  Cost: $${cost.total_usd} | Last: ${progress.last_action}`,
    ].join('\n');
  });

  return { content: [{ type: 'text' as const, text: lines.join('\n\n') }] };
}

export function handleGetWorkerStats(
  db: Database.Database,
  args: { worker_id: string },
): ToolResult {
  const w = db.prepare('SELECT * FROM workers WHERE id = ?').get(args.worker_id) as WorkerRow | undefined;
  if (!w) return { content: [{ type: 'text' as const, text: `Worker ${args.worker_id} not found.` }] };

  const tokens = parseTokens(w.tokens_json);
  const cost = parseCost(w.cost_json);
  const progress = parseProgress(w.progress_json);
  const health = getHealth(w);
  const elapsed = Math.round((Date.now() - new Date(w.spawn_time).getTime()) / 60000);

  const report = [
    `# ${w.label} (${w.status} | ${health})`,
    `PID: ${w.pid ?? 'n/a'} | Elapsed: ${elapsed}m | Provider: ${w.provider} | Model: ${w.model}`,
    ``,
    `Tokens: ${tokens.total_combined.toLocaleString()} total`,
    `  In: ${tokens.total_input.toLocaleString()} | Out: ${tokens.total_output.toLocaleString()}`,
    `  Cache: ${tokens.total_cache_creation.toLocaleString()} create, ${tokens.total_cache_read.toLocaleString()} read`,
    `  Context: ${tokens.context_current_k}k (${tokens.context_percent}%) | Compactions: ${tokens.compaction_count}`,
    ``,
    `Cost: $${cost.total_usd} (in: $${cost.input_usd}, out: $${cost.output_usd}, cache: $${cost.cache_usd})`,
    ``,
    `Progress: ${progress.message_count} msgs, ${progress.tool_calls} tools`,
    `  Read: ${progress.files_read.length} files | Written: ${progress.files_written.length} files`,
    `  Last: ${progress.last_action}`,
  ].join('\n');

  return { content: [{ type: 'text' as const, text: report }] };
}

export function handleGetWorkerActivity(
  db: Database.Database,
  args: { worker_id: string },
): ToolResult {
  const w = db.prepare('SELECT * FROM workers WHERE id = ?').get(args.worker_id) as WorkerRow | undefined;
  if (!w) return { content: [{ type: 'text' as const, text: `Worker ${args.worker_id} not found.` }] };

  const tokens = parseTokens(w.tokens_json);
  const cost = parseCost(w.cost_json);
  const progress = parseProgress(w.progress_json);
  const health = getHealth(w);
  const elapsed = Math.round((Date.now() - new Date(w.spawn_time).getTime()) / 60000);

  const writes = progress.files_written.slice(-5).map((p) => {
    const parts = p.split('/');
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p;
  });

  const summary = [
    `${w.label} (${w.status}, ${elapsed}m, ${tokens.context_percent}% ctx, $${cost.total_usd})`,
    `  Provider: ${w.provider} | Model: ${w.model}`,
    `  ${progress.message_count} msgs | ${progress.tool_calls} tools | ${tokens.compaction_count} compactions | ${health}`,
    writes.length > 0 ? `  Writes: ${writes.join(', ')}` : '  No writes yet',
    `  Last: ${progress.last_action}`,
  ].join('\n');

  return { content: [{ type: 'text' as const, text: summary }] };
}

export function handleKillWorker(
  db: Database.Database,
  args: { worker_id: string; reason?: string },
): ToolResult {
  const w = db.prepare('SELECT * FROM workers WHERE id = ?').get(args.worker_id) as WorkerRow | undefined;
  if (!w) return { content: [{ type: 'text' as const, text: `Worker ${args.worker_id} not found.` }] };

  let killed = false;
  if (w.pid) {
    killed = killWorkerProcess(w.pid);
  }

  db.prepare("UPDATE workers SET status = 'killed' WHERE id = ?").run(args.worker_id);

  const cost = parseCost(w.cost_json);
  const tokens = parseTokens(w.tokens_json);

  const lines = [
    `Worker ${w.label} ${killed ? 'terminated' : 'failed to terminate'}.`,
    `  PID: ${w.pid ?? 'n/a'}`,
    `  Provider: ${w.provider}`,
    `  Reason: ${args.reason ?? 'manual'}`,
    w.log_path ? `  Log: ${w.log_path}` : null,
    `  Final cost: $${cost.total_usd} | Tokens: ${tokens.total_combined.toLocaleString()} | Ctx: ${tokens.context_percent}%`,
  ].filter(Boolean);

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
