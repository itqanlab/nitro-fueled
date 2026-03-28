#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  WorkerRegistry,
  JsonlWatcher,
  killProcess,
  closeItermSession,
  isProcessAlive,
  killPrintProcess,
  killOpenCodeProcess,
  FileWatcher,
  EventQueue,
} from '@nitro-fueled/worker-core';
import { handleSpawnWorker, spawnWorkerSchema } from './tools/spawn-worker.js';
import { handleSubscribeWorker, subscribeWorkerSchema } from './tools/subscribe-worker.js';
import { handleGetPendingEvents, getPendingEventsSchema } from './tools/get-pending-events.js';
import type { HealthStatus } from '@nitro-fueled/worker-core';

const registryDir = join(homedir(), '.session-orchestrator');
try {
  mkdirSync(registryDir, { recursive: true, mode: 0o700 });
} catch (err) {
  console.error(`[session-orchestrator] failed to create registry directory ${registryDir}:`, err);
}
const registryPath = join(registryDir, 'registry.json');
const registry = new WorkerRegistry(registryPath);
const watcher = new JsonlWatcher(registry);
const fileWatcher = new FileWatcher();
const eventQueue = new EventQueue();

const server = new McpServer({
  name: 'session-orchestrator',
  version: '1.0.0',
});

// --- spawn_worker ---
server.tool(
  'spawn_worker',
  'Spawn a new autonomous Claude Code worker session. Uses --print mode by default (headless subprocess). Set use_iterm=true for a visible iTerm window.',
  spawnWorkerSchema,
  async (args) => {
    return handleSpawnWorker(args, registry, watcher);
  },
);

// --- list_workers ---
server.tool(
  'list_workers',
  'List all tracked worker sessions with status, tokens, and cost',
  {
    status_filter: z.enum(['active', 'completed', 'failed', 'all']).optional().describe('Filter by status (default: all)'),
  },
  async ({ status_filter }) => {
    const workers = registry.list(status_filter ?? 'all');
    if (workers.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No workers tracked.' }] };
    }

    const lines = workers.map((w) => {
      const elapsed = Math.round((Date.now() - w.started_at) / 60000);
      const totalStr = w.tokens.total_combined >= 1_000_000
        ? `${(w.tokens.total_combined / 1_000_000).toFixed(1)}M`
        : `${Math.round(w.tokens.total_combined / 1000)}k`;
      return [
        `[${w.status.toUpperCase()}] ${w.label}`,
        `  ID: ${w.worker_id} | PID: ${w.pid} | ${elapsed}m`,
        `  Provider: ${w.provider} | Model: ${w.model}`,
        `  Tokens: ${totalStr} | Ctx: ${w.tokens.context_percent}% | Compactions: ${w.tokens.compaction_count}`,
        `  Cost: $${w.cost.total_usd} | Last: ${w.progress.last_action}`,
      ].join('\n');
    });

    return { content: [{ type: 'text' as const, text: lines.join('\n\n') }] };
  },
);

// --- get_worker_stats ---
server.tool(
  'get_worker_stats',
  'Get detailed token usage, cost, progress, and health for a specific worker',
  {
    worker_id: z.string().describe('Worker ID returned by spawn_worker'),
  },
  async ({ worker_id }) => {
    const w = registry.get(worker_id);
    if (!w) return { content: [{ type: 'text' as const, text: `Worker ${worker_id} not found.` }], isError: true };

    const health = getHealth(w.pid, w.tokens.context_percent, w.tokens.compaction_count, w.progress.last_action_at, w.progress.message_count, w.started_at);
    const elapsed = Math.round((Date.now() - w.started_at) / 60000);

    const report = [
      `# ${w.label} (${w.status} | ${health})`,
      `PID: ${w.pid} | Elapsed: ${elapsed}m | Provider: ${w.provider} | Model: ${w.model}`,
      ``,
      `Tokens: ${w.tokens.total_combined.toLocaleString()} total`,
      `  In: ${w.tokens.total_input.toLocaleString()} | Out: ${w.tokens.total_output.toLocaleString()}`,
      `  Cache: ${w.tokens.total_cache_creation.toLocaleString()} create, ${w.tokens.total_cache_read.toLocaleString()} read`,
      `  Context: ${w.tokens.context_current_k}k (${w.tokens.context_percent}%) | Compactions: ${w.tokens.compaction_count}`,
      ``,
      `Cost: $${w.cost.total_usd} (in: $${w.cost.input_usd}, out: $${w.cost.output_usd}, cache: $${w.cost.cache_usd})`,
      ``,
      `Progress: ${w.progress.message_count} msgs, ${w.progress.tool_calls} tools`,
      `  Read: ${w.progress.files_read.length} files | Written: ${w.progress.files_written.length} files`,
      `  Last: ${w.progress.last_action}`,
    ].join('\n');

    return { content: [{ type: 'text' as const, text: report }] };
  },
);

// --- get_worker_activity ---
server.tool(
  'get_worker_activity',
  'Compact, context-efficient summary of a worker. Minimizes token usage in orchestrator.',
  {
    worker_id: z.string().describe('Worker ID returned by spawn_worker'),
  },
  async ({ worker_id }) => {
    const w = registry.get(worker_id);
    if (!w) return { content: [{ type: 'text' as const, text: `Worker ${worker_id} not found.` }], isError: true };

    const elapsed = Math.round((Date.now() - w.started_at) / 60000);
    const health = getHealth(w.pid, w.tokens.context_percent, w.tokens.compaction_count, w.progress.last_action_at, w.progress.message_count, w.started_at);
    const writes = w.progress.files_written.slice(-5).map((p) => {
      const parts = p.split('/');
      return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p;
    });

    const summary = [
      `${w.label} (${w.status}, ${elapsed}m, ${w.tokens.context_percent}% ctx, $${w.cost.total_usd})`,
      `  Provider: ${w.provider} | Model: ${w.model}`,
      `  ${w.progress.message_count} msgs | ${w.progress.tool_calls} tools | ${w.tokens.compaction_count} compactions | ${health}`,
      writes.length > 0 ? `  Writes: ${writes.join(', ')}` : '  No writes yet',
      `  Last: ${w.progress.last_action}`,
    ].join('\n');

    return { content: [{ type: 'text' as const, text: summary }] };
  },
);

// --- emit_event ---
server.tool(
  'emit_event',
  'Emit a phase-transition event from a worker. Enqueued into the supervisor event queue. Retrieve via get_pending_events.',
  {
    worker_id: z.string().describe('Worker ID returned by spawn_worker'),
    label: z.string().max(64).describe('Event label (e.g. IN_PROGRESS, PM_COMPLETE, ARCHITECTURE_COMPLETE, BATCH_COMPLETE, IMPLEMENTED)'),
    data: z.record(z.string(), z.unknown()).optional().describe('Optional key-value payload attached to the event'),
  },
  ({ worker_id, label, data }) => {
    // Validate worker exists (informational — we still accept the event either way
    // so fast workers that finish before state is written are not silently dropped)
    const w = registry.get(worker_id);
    if (!w) {
      process.stderr.write(`[emit_event] worker ${worker_id} not found in registry — event queued anyway\n`);
    }

    eventQueue.enqueue({
      worker_id,
      event_label: label,
      emitted_at: new Date().toISOString(),
      data: data as Record<string, unknown> | undefined,
      source: 'emit_event',
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ ok: true, worker_id, label }),
      }],
    };
  },
);

// --- subscribe_worker ---
server.tool(
  'subscribe_worker',
  'Register file-system watch conditions for a worker. When any condition is met, a completion event is enqueued. Call get_pending_events to drain the queue.',
  subscribeWorkerSchema,
  async (args) => {
    return handleSubscribeWorker(args, fileWatcher, registry);
  },
);

// --- get_pending_events ---
server.tool(
  'get_pending_events',
  'Drain and return all pending worker events (file-watcher completion events + worker-emitted phase events). Each call removes returned events from the queue.',
  getPendingEventsSchema,
  () => {
    return handleGetPendingEvents(fileWatcher, eventQueue);
  },
);

// --- kill_worker ---
server.tool(
  'kill_worker',
  'Terminate a worker session (SIGTERM then SIGKILL)',
  {
    worker_id: z.string().describe('Worker ID to terminate'),
    reason: z.string().optional().describe('Reason for termination'),
  },
  async ({ worker_id, reason }) => {
    const w = registry.get(worker_id);
    if (!w) return { content: [{ type: 'text' as const, text: `Worker ${worker_id} not found.` }], isError: true };

    let killed: boolean;
    let paneClosed = false;

    if (w.launcher === 'iterm') {
      killed = await killProcess(w.pid);
      paneClosed = await closeItermSession(w.iterm_session_id);
    } else if (w.launcher === 'opencode') {
      killed = killOpenCodeProcess(w.pid);
    } else {
      killed = killPrintProcess(w.pid);
    }

    registry.updateStatus(w.worker_id, 'killed');

    const lines = [
      `Worker ${w.label} ${killed ? 'terminated' : 'failed to terminate'}.`,
      `  Mode: ${w.launcher ?? 'iterm'}`,
      `  Provider: ${w.provider}`,
      `  Reason: ${reason ?? 'manual'}`,
    ];
    if (w.launcher === 'iterm') lines.push(`  Pane closed: ${paneClosed ? 'yes' : 'no'}`);
    if (w.log_path) lines.push(`  Log: ${w.log_path}`);
    lines.push(`  Final cost: $${w.cost.total_usd} | Tokens: ${w.tokens.total_combined.toLocaleString()} | Ctx: ${w.tokens.context_percent}%`);

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  },
);

const STARTUP_GRACE_MS = 300_000; // 5 minutes for workers with 0 messages

function getHealth(pid: number, ctxPct: number, compactions: number, lastAt: number, messageCount: number, startedAt: number): HealthStatus {
  if (!isProcessAlive(pid)) return 'finished';
  if (compactions >= 2) return 'compacting';
  if (ctxPct > 80) return 'high_context';
  if (messageCount === 0 && Date.now() - startedAt < STARTUP_GRACE_MS) return 'starting';
  if (Date.now() - lastAt > 120_000) return 'stuck';
  return 'healthy';
}

// Start watcher & connect
watcher.start();
const transport = new StdioServerTransport();
await server.connect(transport);

process.on('SIGINT', () => { watcher.stop(); fileWatcher.closeAll(); process.exit(0); });
process.on('SIGTERM', () => { watcher.stop(); fileWatcher.closeAll(); process.exit(0); });
