#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'node:path';
import { initDatabase } from './db/schema.js';
import { handleGetTasks, handleClaimTask, handleReleaseTask, handleUpdateTask, handleUpsertTask } from './tools/tasks.js';
import { handleGetNextWave } from './tools/wave.js';
import { handleSyncTasksFromFiles } from './tools/sync.js';
import { handleCreateSession, handleGetSession, handleUpdateSession, handleListSessions, handleEndSession } from './tools/sessions.js';
import { handleSpawnWorker, handleListWorkers, handleGetWorkerStats, handleGetWorkerActivity, handleKillWorker } from './tools/workers.js';
import { FileWatcher, handleSubscribeWorker, handleGetPendingEvents } from './events/subscriptions.js';
import { JsonlWatcher } from './process/jsonl-watcher.js';
import { handleWriteHandoff, handleReadHandoff } from './tools/handoffs.js';
import { handleLogEvent, handleQueryEvents } from './tools/events.js';

const projectRoot = process.cwd();
const dbPath = join(projectRoot, '.nitro', 'cortex.db');

console.error(`[nitro-cortex] project root: ${projectRoot}`);
console.error(`[nitro-cortex] database: ${dbPath}`);

const db = initDatabase(dbPath);
console.error('[nitro-cortex] database initialized');

const jsonlWatcher = new JsonlWatcher(db);
const fileWatcher = new FileWatcher();

const server = new McpServer({
  name: 'nitro-cortex',
  version: '0.2.0',
});

// --- Task tools (from Part 1) ---

server.registerTool('get_tasks', {
  description: 'Filtered task list. When unblocked=true, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE.',
  inputSchema: {
    status: z.string().optional().describe('Filter by task status'),
    type: z.string().optional().describe('Filter by task type'),
    priority: z.string().optional().describe('Filter by priority'),
    unblocked: z.boolean().optional().describe('When true, return only unblocked tasks'),
  },
}, (args) => handleGetTasks(db, args));

// query_tasks is an alias for get_tasks (acceptance-criteria name from TASK_2026_138 spec)
server.registerTool('query_tasks', {
  description: 'Alias for get_tasks. Filtered task list. When unblocked=true, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE.',
  inputSchema: {
    status: z.string().optional().describe('Filter by task status'),
    type: z.string().optional().describe('Filter by task type'),
    priority: z.string().optional().describe('Filter by priority'),
    unblocked: z.boolean().optional().describe('When true, return only unblocked tasks'),
  },
}, (args) => handleGetTasks(db, args));

server.registerTool('claim_task', {
  description: 'Atomic claim on a task. Returns {ok: true} or {ok: false, claimed_by: session_id}.',
  inputSchema: {
    task_id: z.string().describe('Task ID to claim'),
    session_id: z.string().describe('Session ID claiming this task'),
  },
}, (args) => handleClaimTask(db, args));

server.registerTool('release_task', {
  description: 'Release a claimed task, clearing the claim and setting a new status.',
  inputSchema: {
    task_id: z.string().describe('Task ID to release'),
    new_status: z.enum(['CREATED','IN_PROGRESS','IMPLEMENTED','IN_REVIEW','COMPLETE','FAILED','BLOCKED','CANCELLED']).describe('New status to set'),
  },
}, (args) => handleReleaseTask(db, args));

server.registerTool('update_task', {
  description: 'Partial update of any task fields. Whitelists updatable columns for safety.',
  inputSchema: {
    task_id: z.string().describe('Task ID to update'),
    fields: z.string().describe('JSON string of fields to update'),
  },
}, (args) => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(args.fields) as Record<string, unknown>;
  } catch {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid JSON in fields' }) }] };
  }
  return handleUpdateTask(db, { task_id: args.task_id, fields: parsed });
});

server.registerTool('get_next_wave', {
  description: 'Returns up to N unclaimed, dependency-resolved CREATED tasks. Atomically claims them.',
  inputSchema: {
    session_id: z.string().describe('Session ID requesting the wave'),
    slots: z.number().describe('Max number of tasks to return (1-20)'),
  },
}, (args) => handleGetNextWave(db, args));

server.registerTool('sync_tasks_from_files', {
  description: 'Bootstrap: scan task-tracking/TASK_*/ folders, import into DB. Safe to re-run (upsert).',
}, () => handleSyncTasksFromFiles(db, projectRoot));

server.registerTool('upsert_task', {
  description: 'Create or update a task record. If task_id exists, updates provided fields. If not, inserts a new row (title, type, priority required for insert).',
  inputSchema: {
    task_id: z.string().describe('Task ID (e.g. TASK_2026_001)'),
    fields: z.string().describe('JSON string of task fields to set'),
  },
}, (args) => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(args.fields) as Record<string, unknown>;
  } catch {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid JSON in fields' }) }] };
  }
  return handleUpsertTask(db, { task_id: args.task_id, fields: parsed });
});

// --- Handoff tools ---

server.registerTool('write_handoff', {
  description: 'Record a Build-to-Review handoff: files changed, commits, decisions, and risks for a task. Handoff records are immutable — no update tool exists.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this handoff belongs to'),
    worker_type: z.enum(['build', 'review']).describe('Worker type writing the handoff'),
    files_changed: z.array(z.object({
      path: z.string().max(1000).describe('File path'),
      action: z.string().max(50).describe('new | modified | deleted'),
      lines: z.number().optional().describe('Line count or diff size'),
    })).max(500).describe('Files changed in this work unit'),
    commits: z.array(z.string().max(200)).max(200).describe('Commit hashes included in this handoff'),
    decisions: z.array(z.string().max(2000)).max(100).describe('Key architectural or implementation decisions'),
    risks: z.array(z.string().max(2000)).max(100).describe('Known risks, edge cases, or areas needing extra review'),
  },
}, (args) => handleWriteHandoff(db, args));

server.registerTool('read_handoff', {
  description: 'Return the most recent handoff record for a task (parsed JSON fields).',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve handoff for'),
  },
}, (args) => handleReadHandoff(db, args));

// --- Event tools ---

server.registerTool('log_event', {
  description: 'Append a structured event to the events log. Replaces log.md for queryable event history.',
  inputSchema: {
    session_id: z.string().max(200).describe('Session ID this event belongs to'),
    task_id: z.string().max(200).optional().describe('Task ID this event relates to (optional)'),
    source: z.string().max(200).describe("Event source: 'auto-pilot', 'orchestrate', or a worker_id"),
    event_type: z.string().max(100).describe("Event type: SPAWNED, HEALTH_CHECK, STATE_TRANSITIONED, PM_COMPLETE, etc."),
    data: z.record(z.string(), z.unknown()).optional().describe('Optional JSON payload'),
  },
}, (args) => handleLogEvent(db, args));

server.registerTool('query_events', {
  description: 'Query the events log with optional filters. Returns events ordered by id ASC. limit=0 returns an empty set; omitting limit defaults to 500.',
  inputSchema: {
    session_id: z.string().max(200).optional().describe('Filter by session ID'),
    task_id: z.string().max(200).optional().describe('Filter by task ID'),
    event_type: z.string().max(100).optional().describe('Filter by event type'),
    since: z.string().max(50).optional().describe('ISO timestamp — return events at or after this time'),
    limit: z.number().int().min(0).max(1000).optional().describe('Max events to return (default 500, max 1000, 0 = empty set)'),
  },
}, (args) => handleQueryEvents(db, args));

// --- Session tools ---

server.registerTool('create_session', {
  description: 'Create a new supervisor session. Returns session_id.',
  inputSchema: {
    source: z.string().optional().describe('Session source identifier'),
    config: z.string().optional().describe('JSON config string'),
    task_count: z.number().optional().describe('Expected number of tasks'),
  },
}, (args) => handleCreateSession(db, args));

server.registerTool('get_session', {
  description: 'Get full session state including active workers, completed/failed lists, counters.',
  inputSchema: {
    session_id: z.string().describe('Session ID to retrieve'),
  },
}, (args) => handleGetSession(db, args));

server.registerTool('update_session', {
  description: 'Partial update of session fields (loop_status, tasks_terminal, config, etc.).',
  inputSchema: {
    session_id: z.string().describe('Session ID to update'),
    fields: z.string().describe('JSON string of fields to update'),
  },
}, (args) => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(args.fields) as Record<string, unknown>;
  } catch {
    return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid JSON in fields' }) }] };
  }
  return handleUpdateSession(db, { session_id: args.session_id, fields: parsed });
});

server.registerTool('list_sessions', {
  description: 'List all sessions or filter by loop_status. Enables cross-session awareness.',
  inputSchema: {
    status: z.string().optional().describe('Filter by loop_status (running/paused/stopped)'),
  },
}, (args) => handleListSessions(db, args));

server.registerTool('end_session', {
  description: 'Mark session as stopped, write final counters and optional summary.',
  inputSchema: {
    session_id: z.string().describe('Session ID to end'),
    summary: z.string().optional().describe('Optional summary of session results'),
  },
}, (args) => handleEndSession(db, args));

// --- Worker lifecycle tools ---

server.registerTool('spawn_worker', {
  description: 'Launch a Claude Code worker process and track it in the DB. Returns worker_id.',
  inputSchema: {
    session_id: z.string().describe('Session ID this worker belongs to'),
    task_id: z.string().optional().describe('Task ID this worker is executing'),
    worker_type: z.enum(['build', 'review']).describe('Worker type'),
    prompt: z.string().describe('Full prompt to send to the worker'),
    working_directory: z.string().describe('Project directory to run in'),
    label: z.string().describe('Label for the worker'),
    model: z.string().optional().describe('Model to use (default: claude-sonnet-4-6)'),
    provider: z.enum(['claude', 'glm', 'opencode']).optional().describe('Provider to use'),
    auto_close: z.boolean().optional().describe('Auto-kill when worker finishes'),
  },
}, (args) => handleSpawnWorker(db, jsonlWatcher, args));

server.registerTool('list_workers', {
  description: 'List tracked workers with status, tokens, cost, and health.',
  inputSchema: {
    session_id: z.string().optional().describe('Filter by session ID'),
    status_filter: z.enum(['active', 'completed', 'failed', 'killed', 'all']).optional().describe('Filter by status'),
  },
}, (args) => handleListWorkers(db, args));

server.registerTool('get_worker_stats', {
  description: 'Detailed token usage, cost, progress, and health for a specific worker.',
  inputSchema: {
    worker_id: z.string().describe('Worker ID'),
  },
}, (args) => handleGetWorkerStats(db, args));

server.registerTool('get_worker_activity', {
  description: 'Compact, context-efficient summary of a worker. Minimizes token usage.',
  inputSchema: {
    worker_id: z.string().describe('Worker ID'),
  },
}, (args) => handleGetWorkerActivity(db, args));

server.registerTool('kill_worker', {
  description: 'Terminate a worker process (SIGTERM then SIGKILL) and update status.',
  inputSchema: {
    worker_id: z.string().describe('Worker ID to terminate'),
    reason: z.string().optional().describe('Reason for termination'),
  },
}, (args) => handleKillWorker(db, args));

// --- Event subscription tools ---

const watchConditionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file_value'),
    path: z.string().min(1).max(500).describe('Path relative to worker working_directory'),
    value: z.string().max(500).describe('File content (trimmed) must equal this value'),
    event_label: z.string().min(1).max(100).describe('Label for the emitted event'),
  }),
  z.object({
    type: z.literal('file_contains'),
    path: z.string().min(1).max(500).describe('Path relative to worker working_directory'),
    contains: z.string().min(1).max(500).describe('File content must contain this substring'),
    event_label: z.string().min(1).max(100).describe('Label for the emitted event'),
  }),
  z.object({
    type: z.literal('file_exists'),
    path: z.string().min(1).max(500).describe('Path relative to worker working_directory'),
    event_label: z.string().min(1).max(100).describe('Label for the emitted event'),
  }),
]);

server.registerTool('subscribe_worker', {
  description: 'Register file-system watch conditions for a worker. When met, a completion event is enqueued.',
  inputSchema: {
    worker_id: z.string().describe('Worker ID'),
    conditions: z.array(watchConditionSchema).min(1).max(20).describe('Watch conditions'),
  },
}, (args) => handleSubscribeWorker(db, fileWatcher, args));

server.registerTool('get_pending_events', {
  description: 'Drain and return all pending worker completion events (idempotent drain).',
  inputSchema: {
    session_id: z.string().optional().describe('Optional session filter (not yet implemented)'),
  },
}, (args) => handleGetPendingEvents(fileWatcher, args.session_id));

// --- Start ---

jsonlWatcher.start();
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[nitro-cortex] MCP server connected via stdio (v0.3.0 — sessions + workers + handoffs + events)');

process.on('SIGINT', () => { jsonlWatcher.stop(); fileWatcher.closeAll(); db.close(); process.exit(0); });
process.on('SIGTERM', () => { jsonlWatcher.stop(); fileWatcher.closeAll(); db.close(); process.exit(0); });
