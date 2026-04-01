#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'node:path';
import { mcpLogger } from './utils/logger.js';
import { CANONICAL_TASK_TYPES, initDatabase } from './db/schema.js';
import { handleGetTasks, handleClaimTask, handleReleaseTask, handleUpdateTask, handleUpsertTask, handleGetOrphanedClaims, handleReleaseOrphanedClaims, handleBulkUpdateTasks, handleGetBacklogSummary } from './tools/tasks.js';
import { handleGetNextWave } from './tools/wave.js';
import { handleSyncTasksFromFiles, handleReconcileStatusFiles } from './tools/sync.js';
import { handleCreateSession, handleGetSession, handleUpdateSession, handleListSessions, handleEndSession, handleUpdateHeartbeat, handleCloseStaleSessions } from './tools/sessions.js';
import { handleSpawnWorker, handleListWorkers, handleGetWorkerStats, handleGetWorkerActivity, handleKillWorker } from './tools/workers.js';
import { FileWatcher, EmitQueue, handleSubscribeWorker, handleGetPendingEvents, handleEmitEvent } from './events/subscriptions.js';
import { JsonlWatcher } from './process/jsonl-watcher.js';
import { handleWriteHandoff, handleReadHandoff } from './tools/handoffs.js';
import { handleLogEvent, handleQueryEvents } from './tools/events.js';
import { handleGetTaskContext, handleGetReviewLessons, handleGetRecentChanges, handleGetCodebasePatterns, handleStageAndCommit, handleReportProgress } from './tools/context.js';
import { handleLogPhase, handleLogReview, handleLogFixCycle, handleGetModelPerformance, handleGetTaskTrace, handleGetSessionSummary, handleGetWorkerTelemetry, handleGetSessionTelemetry } from './tools/telemetry.js';
import { handleGetAvailableProviders, handleGetProviderStats } from './tools/providers.js';
import { handleGetNextTaskId, handleValidateTaskSizing, handleCreateTask, handleBulkCreateTasks } from './tools/task-creation.js';
import { handleListAgents, handleGetAgent, handleCreateAgent, handleUpdateAgent, handleDeleteAgent } from './tools/agent-tools.js';
import { handleListWorkflows, handleGetWorkflow, handleCreateWorkflow, handleUpdateWorkflow, handleDeleteWorkflow } from './tools/workflow-tools.js';
import { handleListLaunchers, handleGetLauncher, handleRegisterLauncher, handleUpdateLauncher, handleDeregisterLauncher } from './tools/launcher-tools.js';
import { handleLogCompatibility, handleQueryCompatibility } from './tools/compatibility-tools.js';
import { handleCreateSubtask, handleBulkCreateSubtasks, handleGetSubtasks, handleGetParentStatusRollup } from './tools/subtask-tools.js';
import {
  handleWriteReview, handleReadReviews,
  handleWriteTestReport, handleReadTestReport,
  handleWriteCompletionReport, handleReadCompletionReport,
  handleWritePlan, handleReadPlan,
  handleWriteTaskDescription, handleReadTaskDescription,
  handleWriteContext, handleReadContext,
  handleWriteSubtasks, handleReadSubtasks,
  handleGetTaskArtifacts,
} from './tools/artifacts.js';

const projectRoot = process.cwd();
const dbPath = join(projectRoot, '.nitro', 'cortex.db');

mcpLogger.info(`project root: ${projectRoot}`);
mcpLogger.info(`database: ${dbPath}`);

const db = initDatabase(dbPath);
mcpLogger.info('database initialized');

const jsonlWatcher = new JsonlWatcher(db);
const fileWatcher = new FileWatcher();
const emitQueue = new EmitQueue();

const server = new McpServer({
  name: 'nitro-cortex',
  version: '0.5.0',
});

// --- Task tools (from Part 1) ---

server.registerTool('get_tasks', {
  description: 'Filtered task list. When unblocked=true, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE. Use compact=true to omit description/acceptance_criteria/file_scope (saves ~80% tokens).',
  inputSchema: {
    status: z.enum(['CREATED','IN_PROGRESS','PREPPED','IMPLEMENTING','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED','ARCHIVE']).optional().describe('Filter by task status'),
    type: z.string().optional().describe('Filter by task type'),
    priority: z.string().optional().describe('Filter by priority'),
    unblocked: z.boolean().optional().describe('When true, return only unblocked tasks'),
    limit: z.number().int().min(1).max(200).optional().describe('Max tasks to return (default unlimited, max 200)'),
    compact: z.boolean().optional().describe('When true, return only lightweight columns (id, title, status, type, priority, complexity, dependencies, model). Omits description, acceptance_criteria, file_scope. Recommended for listing/routing.'),
  },
}, (args) => handleGetTasks(db, args));

// query_tasks is an alias for get_tasks (acceptance-criteria name from TASK_2026_138 spec)
server.registerTool('query_tasks', {
  description: 'Alias for get_tasks. Filtered task list. When unblocked=true, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE. Use compact=true to omit description/acceptance_criteria/file_scope (saves ~80% tokens).',
  inputSchema: {
    status: z.enum(['CREATED','IN_PROGRESS','PREPPED','IMPLEMENTING','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED','ARCHIVE']).optional().describe('Filter by task status'),
    type: z.string().optional().describe('Filter by task type'),
    priority: z.string().optional().describe('Filter by priority'),
    unblocked: z.boolean().optional().describe('When true, return only unblocked tasks'),
    limit: z.number().int().min(1).max(200).optional().describe('Max tasks to return (default unlimited, max 200)'),
    compact: z.boolean().optional().describe('When true, return only lightweight columns (id, title, status, type, priority, complexity, dependencies, model). Omits description, acceptance_criteria, file_scope. Recommended for listing/routing.'),
  },
}, (args) => handleGetTasks(db, args));

server.registerTool('get_backlog_summary', {
  description: 'Returns task counts grouped by status as a flat object, e.g. {CREATED:37,IN_PROGRESS:5,COMPLETE:55,total:130}. Always under 500 chars. Use instead of query_tasks when you only need counts for supervisor routing decisions. Optional group_by="priority" returns a nested breakdown by priority.',
  inputSchema: {
    group_by: z.enum(['priority']).optional().describe('Optional grouping: "priority" returns counts nested by priority. Omit for status-only summary.'),
  },
}, (args) => handleGetBacklogSummary(db, args));

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
    new_status: z.enum(['CREATED','IN_PROGRESS','PREPPED','IMPLEMENTING','IMPLEMENTED','IN_REVIEW','FIXING','COMPLETE','FAILED','BLOCKED','CANCELLED','ARCHIVE']).describe('New status to set'),
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
  return handleUpdateTask(db, { task_id: args.task_id, fields: parsed }, projectRoot);
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

server.registerTool('reconcile_status_files', {
  description: 'Compare status files on disk against DB rows. Updates DB where file status differs (file wins). Only updates existing rows — does not insert. Returns { ok, drifted, matched, missing_status_file, missing_db_row }. missing_status_file = tasks with no status file, empty file, or invalid enum value on disk. missing_db_row = tasks with a valid status file but no matching DB row (call sync_tasks_from_files first if missing_db_row > 0 on a fresh DB).',
}, () => handleReconcileStatusFiles(db, projectRoot));

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

server.registerTool('get_orphaned_claims', {
  description: 'Query tasks claimed by dead sessions or expired TTL. Returns array of {task_id, title, status, claimed_by, claimed_at, stale_for_ms}.',
  inputSchema: {},
}, () => handleGetOrphanedClaims(db));

server.registerTool('release_orphaned_claims', {
  description: 'Release all orphaned task claims atomically. Resets claims to CREATED, logs orphan_recovery events. Returns {released: N, tasks: [...]}.',
  inputSchema: {},
}, () => handleReleaseOrphanedClaims(db));

// --- Handoff tools ---

server.registerTool('write_handoff', {
  description: 'Record a worker handoff for a task. For build/review/implement/cleanup: pass files_changed, commits, decisions, risks. For prep: pass implementation_plan_summary, files_to_touch, batches, key_decisions, gotchas. Handoff records are immutable.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this handoff belongs to'),
    worker_type: z.enum(['build', 'prep', 'implement', 'review', 'cleanup']).describe('Worker type writing the handoff'),
    // Build/review/implement/cleanup fields
    files_changed: z.array(z.object({
      path: z.string().max(1000).describe('File path'),
      action: z.string().max(50).describe('new | modified | deleted'),
      lines: z.number().optional().describe('Line count or diff size'),
    })).max(500).optional().describe('Files changed in this work unit (build/review/implement/cleanup)'),
    commits: z.array(z.string().max(200)).max(200).optional().describe('Commit hashes included in this handoff (build/review/implement/cleanup)'),
    decisions: z.array(z.string().max(2000)).max(100).optional().describe('Key architectural or implementation decisions (build/review/implement/cleanup)'),
    risks: z.array(z.string().max(2000)).max(100).optional().describe('Known risks, edge cases, or areas needing extra review (build/review/implement/cleanup)'),
    // Prep-specific fields
    implementation_plan_summary: z.string().max(10000).optional().describe('Condensed implementation plan for the developer (prep only)'),
    files_to_touch: z.array(z.object({
      path: z.string().max(1000).describe('File path'),
      action: z.enum(['new', 'modify', 'delete']).describe('Action to take on the file'),
      why: z.string().max(2000).describe('Reason for the change'),
    })).max(500).optional().describe('Files to touch with actions and reasons (prep only)'),
    batches: z.array(z.object({
      summary: z.string().max(2000).describe('Batch summary'),
      files: z.array(z.string().max(1000)).max(100).describe('Files in this batch'),
    })).max(50).optional().describe('Implementation batches (prep only)'),
    key_decisions: z.array(z.string().max(2000)).max(100).optional().describe('Key decisions made during prep (prep only)'),
    gotchas: z.array(z.string().max(2000)).max(100).optional().describe('Gotchas and pitfalls to watch for (prep only)'),
  },
}, (args) => handleWriteHandoff(db, args));

server.registerTool('read_handoff', {
  description: 'Return the most recent handoff record for a task filtered by worker_type. Defaults to "build" when worker_type is omitted (backward compatible). Use worker_type="prep" to read prep handoffs.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve handoff for'),
    worker_type: z.enum(['build', 'prep', 'implement', 'review', 'cleanup']).optional().describe('Worker type to filter by (default: "build")'),
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
  description: 'Create a new supervisor session. Automatically runs orphaned claim recovery unless skip_orphan_recovery=true. Returns session_id.',
  inputSchema: {
    source: z.string().optional().describe('Session source identifier'),
    config: z.string().optional().describe('JSON config string'),
    task_count: z.number().optional().describe('Expected number of tasks'),
    skip_orphan_recovery: z.boolean().optional().describe('Skip automatic orphaned claim recovery at session startup'),
  },
}, (args) => handleCreateSession(db, args));

server.registerTool('get_session', {
  description: 'Get full session state including active workers, completed/failed lists, counters.',
  inputSchema: {
    session_id: z.string().describe('Session ID to retrieve'),
  },
}, (args) => handleGetSession(db, args));

server.registerTool('update_session', {
  description: 'Partial update of session fields (loop_status, tasks_terminal, config, supervisor_model, mode, total_cost, etc.).',
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

server.registerTool('update_heartbeat', {
  description: 'Update the last_heartbeat timestamp for a session. Should be called on each supervisor poll cycle.',
  inputSchema: {
    session_id: z.string().describe('Session ID to update heartbeat for'),
  },
}, (args) => handleUpdateHeartbeat(db, args));

server.registerTool('close_stale_sessions', {
  description: 'Close sessions that have not sent a heartbeat within the configured TTL. Default TTL is 30 minutes.',
  inputSchema: {
    ttl_minutes: z.number().int().min(1).max(1440).optional().describe('Time-to-live in minutes (default: 30, max: 1440/24h)'),
  },
}, (args) => handleCloseStaleSessions(db, args));

// --- Worker lifecycle tools ---

server.registerTool('spawn_worker', {
  description: 'Launch a worker process and track it in the DB. Returns worker_id. Use launcher="codex" to invoke the Codex CLI instead of Claude Code.',
  inputSchema: {
    session_id: z.string().describe('Session ID this worker belongs to'),
    task_id: z.string().optional().describe('Task ID this worker is executing'),
    worker_type: z.enum(['build', 'prep', 'implement', 'review', 'cleanup']).describe('Worker type'),
    prompt: z.string().describe('Full prompt to send to the worker'),
    working_directory: z.string().describe('Project directory to run in'),
    label: z.string().describe('Label for the worker'),
    model: z.string().optional().describe('Model to use (default: claude-sonnet-4-6)'),
    provider: z.enum(['claude', 'glm', 'opencode', 'codex']).optional().describe('Provider to use'),
    launcher: z.enum(['claude-code', 'codex', 'opencode']).optional().describe('Launcher CLI to use. "claude-code" (default) uses the Claude Code CLI. "codex" uses the Codex CLI. Overrides provider-derived launcher when specified.'),
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

server.registerTool('emit_event', {
  description: 'Emit a phase-transition event from a worker. Enqueued into the supervisor event queue. Retrieve via get_pending_events.',
  inputSchema: {
    worker_id: z.string().max(36).describe('Worker ID returned by spawn_worker'),
    label: z.string().regex(/^[A-Z0-9_]{1,64}$/).describe('Event label — uppercase letters, digits, underscores only (e.g. IN_PROGRESS, PM_COMPLETE, BATCH_COMPLETE, IMPLEMENTED)'),
    data: z.record(z.string().max(64), z.string().max(512)).optional().describe('Optional key-value payload'),
  },
}, (args) => handleEmitEvent(db, emitQueue, args));

server.registerTool('get_pending_events', {
  description: 'Drain and return all pending worker completion events (idempotent drain).',
  inputSchema: {
    session_id: z.string().optional().describe('Filter by session ID — only events for this session are returned'),
  },
}, (args) => handleGetPendingEvents(fileWatcher, emitQueue, args.session_id));

// --- Agent context tools ---

server.registerTool('get_task_context', {
  description: 'Returns task metadata + plan summary + file scope in one structured response. Agents use this instead of reading task.md + plan.md separately.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID (e.g. TASK_2026_143)'),
  },
}, (args) => handleGetTaskContext(db, args, projectRoot));

server.registerTool('get_review_lessons', {
  description: 'Returns only review lessons relevant to the specified file types (e.g. ["ts", "md"]). Filters review-lessons/*.md by file extension coverage.',
  inputSchema: {
    file_types: z.array(z.string().max(20)).min(1).max(20).describe('File extensions to filter by (e.g. ["ts", "tsx", "md"])'),
  },
}, (args) => handleGetReviewLessons(db, args, projectRoot));

server.registerTool('get_recent_changes', {
  description: 'Returns files changed in commits for a task (via git log --grep). Agents use this instead of running git log + git diff manually.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to find commits for'),
    include_diff: z.boolean().optional().describe('Include stat diff for the most recent commit'),
  },
}, (args) => handleGetRecentChanges(db, args, projectRoot));

server.registerTool('get_codebase_patterns', {
  description: 'Returns 2-3 example files matching a pattern type (service, component, repository, etc.). Agents use this to find existing patterns instead of manual globbing.',
  inputSchema: {
    pattern_type: z.string().max(50).describe('Pattern type: service, component, repository, controller, handler, middleware, schema, test, model, util, hook, store, type, config, tool'),
    limit: z.number().int().min(1).max(10).optional().describe('Max example files to return (default 3)'),
  },
}, (args) => handleGetCodebasePatterns(db, args, projectRoot));

server.registerTool('stage_and_commit', {
  description: 'Stages files and commits with traceability footer auto-populated from cortex session/task data. Agents use this instead of building the 11-field footer manually.',
  inputSchema: {
    files: z.array(z.string().max(1000)).min(1).max(200).describe('File paths to stage (relative to project root)'),
    message: z.string().min(1).max(500).describe('Commit message (subject line + optional body, without traceability footer)'),
    task_id: z.string().max(200).describe('Task ID for traceability footer'),
    agent: z.string().max(100).describe('Agent name (e.g. nitro-backend-developer)'),
    phase: z.string().max(100).describe('Phase name (e.g. implementation, review-fix, completion)'),
    worker_type: z.string().max(50).optional().describe('Worker type (build-worker, review-worker, interactive)'),
    session_id: z.string().max(200).optional().describe('Session ID (auto-detected from DB if omitted)'),
    provider: z.string().max(50).optional().describe('Provider (claude, glm, opencode)'),
    model: z.string().max(100).optional().describe('Model ID'),
    retry: z.string().max(10).optional().describe('Retry count in N/M format (e.g. 0/2)'),
    complexity: z.string().max(50).optional().describe('Task complexity (Simple, Medium, Complex)'),
    priority: z.string().max(50).optional().describe('Task priority (P0-Critical, P1-High, P2-Medium, P3-Low)'),
    version: z.string().max(20).optional().describe('nitro-fueled version'),
  },
}, (args) => handleStageAndCommit(db, args, projectRoot));

server.registerTool('report_progress', {
  description: 'Updates task progress in DB and logs a phase event. Supervisor gets real-time visibility without polling.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to update'),
    phase: z.string().max(100).describe('Phase name (PM, Architect, Dev, Review, Fix, Completion)'),
    status: z.string().max(50).describe('Status update (IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, or custom phase status)'),
    details: z.string().max(500).optional().describe('Optional details about the progress update'),
  },
}, (args) => handleReportProgress(db, args));

// --- Telemetry tools ---

server.registerTool('log_phase', {
  description: 'Record per-phase timing and outcome for a worker run. Called by orchestration skill at each phase boundary.',
  inputSchema: {
    worker_run_id: z.string().max(200).describe('Worker ID or session ID for this run'),
    task_id: z.string().max(200).optional().describe('Task ID this phase belongs to'),
    phase: z.string().max(100).describe('Phase name (PM, Architect, Dev, Review, Fix, Completion)'),
    start: z.string().max(50).describe('Phase start time (ISO 8601)'),
    end: z.string().max(50).describe('Phase end time (ISO 8601)'),
    outcome: z.string().max(50).describe('Phase outcome (COMPLETE, FAILED, SKIPPED)'),
    model: z.string().max(100).optional().describe('Model used for this phase'),
    input_tokens: z.number().int().optional().describe('Input tokens consumed in this phase'),
    output_tokens: z.number().int().optional().describe('Output tokens produced in this phase'),
    metadata: z.record(z.string().max(64), z.unknown()).optional().describe('Optional phase metadata'),
  },
}, (args) => handleLogPhase(db, args));

server.registerTool('log_review', {
  description: 'Record review results with model provenance. Called by Review Lead after collecting reports.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this review belongs to'),
    phase_id: z.number().int().optional().describe('Phase ID from log_phase (optional)'),
    review_type: z.string().max(50).describe('Review type (code-style, code-logic, security, visual)'),
    score: z.number().min(0).max(10).describe('Review score out of 10'),
    findings_count: z.number().int().min(0).describe('Total number of findings'),
    critical_count: z.number().int().min(0).optional().describe('Critical findings count'),
    serious_count: z.number().int().min(0).optional().describe('Serious findings count'),
    minor_count: z.number().int().min(0).optional().describe('Minor findings count'),
    model_that_built: z.string().max(100).optional().describe('Model that built the implementation'),
    model_that_reviewed: z.string().max(100).optional().describe('Model that performed the review'),
    launcher_that_built: z.string().max(50).optional().describe('Launcher used to build'),
    launcher_that_reviewed: z.string().max(50).optional().describe('Launcher used to review'),
  },
}, (args) => handleLogReview(db, args));

server.registerTool('log_fix_cycle', {
  description: 'Record fix phase results with model info. Called by Fix Worker / Review Lead after applying fixes.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this fix cycle belongs to'),
    phase_id: z.number().int().optional().describe('Phase ID from log_phase (optional)'),
    fixes_applied: z.number().int().min(0).describe('Number of fixes applied'),
    fixes_skipped: z.number().int().min(0).optional().describe('Number of fixes skipped (out of scope or false positive)'),
    required_manual: z.number().int().min(0).optional().describe('Number of fixes that required manual intervention'),
    model_that_fixed: z.string().max(100).optional().describe('Model that applied the fixes'),
    launcher_that_fixed: z.string().max(50).optional().describe('Launcher used to apply fixes'),
    duration_minutes: z.number().optional().describe('Fix cycle duration in minutes'),
  },
}, (args) => handleLogFixCycle(db, args));

server.registerTool('get_model_performance', {
  description: 'Query aggregated quality/cost/failure stats across all runs. Used by supervisor for data-driven model routing.',
  inputSchema: {
    task_type: z.string().max(50).optional().describe('Filter by task type (FEATURE, BUG, REFACTOR, etc.)'),
    complexity: z.string().max(50).optional().describe('Filter by task complexity (Simple, Medium, Complex)'),
    model: z.string().max(100).optional().describe('Filter by model name'),
    launcher: z.string().max(50).optional().describe('Filter by launcher type'),
  },
}, (args) => handleGetModelPerformance(db, args));

server.registerTool('get_task_trace', {
  description: 'Full trace for one task: session → workers → phases → reviews → fix cycles. Complete observability.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to get full trace for'),
  },
}, (args) => handleGetTaskTrace(db, args));

server.registerTool('get_session_summary', {
  description: 'Session overview: supervisor model, mode, tasks processed, cost breakdown, per-worker timing.',
  inputSchema: {
    session_id: z.string().max(200).describe('Session ID to summarize'),
  },
}, (args) => handleGetSessionSummary(db, args));

server.registerTool('get_worker_telemetry', {
  description: 'Full telemetry for one worker: timing (spawn_to_first_output_ms, total_duration_ms), tokens, cost, review result, files changed, workflow phase, and health stats.',
  inputSchema: {
    worker_id: z.string().max(36).describe('Worker ID to retrieve telemetry for'),
  },
}, (args) => handleGetWorkerTelemetry(db, args));

server.registerTool('get_session_telemetry', {
  description: 'Aggregated telemetry for a session: total cost, tokens, files changed, review findings, avg latencies, breakdown by phase and model across all workers.',
  inputSchema: {
    session_id: z.string().max(200).describe('Session ID to aggregate telemetry for'),
  },
}, (args) => handleGetSessionTelemetry(db, args));

// --- Provider tools ---

server.registerTool('get_available_providers', {
  description: 'Discover which providers are configured and available. Reads ~/.nitro-fueled/config.json, probes each launcher, returns availability, models, and routing.',
  inputSchema: {
    working_directory: z.string().max(500).optional().describe('Project root to find .nitro-fueled/config.json. Falls back to ~/.nitro-fueled/config.json if omitted.'),
  },
}, (args) => handleGetAvailableProviders(args));

server.registerTool('get_provider_stats', {
  description: 'Aggregate worker history by provider/model — success rate, avg cost, avg tokens, avg compactions.',
  inputSchema: {
    provider: z.string().max(50).optional().describe('Filter by provider name (e.g., "anthropic", "zai"). Omit for all.'),
    model: z.string().max(100).optional().describe('Filter by model name. Omit for all.'),
    worker_type: z.string().max(50).optional().describe('Filter by worker type pattern in label (e.g., "BUILD", "REVIEW"). Omit for all.'),
  },
}, (args) => handleGetProviderStats(args, db));

// --- Task creation tools ---

server.registerTool('get_next_task_id', {
  description: 'Scan task-tracking/ for highest TASK_YYYY_NNN folder and return the next sequential ID.',
}, () => handleGetNextTaskId(projectRoot));

server.registerTool('validate_task_sizing', {
  description: 'Validate a task definition against sizing-rules.md limits. Returns valid/invalid with violation details.',
  inputSchema: {
    description: z.string().max(50000).describe('Task description text'),
    acceptanceCriteria: z.array(z.string().max(2000)).max(20).optional().describe('Acceptance criteria groups'),
    fileScope: z.array(z.string().max(1000)).max(20).optional().describe('Files in scope'),
    complexity: z.string().max(50).optional().describe('Task complexity (Simple, Medium, Complex)'),
  },
}, (args) => handleValidateTaskSizing(projectRoot, args));

server.registerTool('create_task', {
  description: 'Full lifecycle task creation: validates sizing, auto-generates next task ID, creates folder + task.md + status file, upserts into DB, and git commits.',
  inputSchema: {
    title: z.string().min(1).max(500).describe('Task title'),
    description: z.string().max(50000).describe('Task description'),
    type: z.enum(CANONICAL_TASK_TYPES).describe('Task type'),
    priority: z.enum(['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low']).describe('Task priority'),
    complexity: z.enum(['Simple', 'Medium', 'Complex']).optional().describe('Task complexity'),
    model: z.string().max(100).optional().describe('Model to use'),
    dependencies: z.array(z.string().max(200)).max(20).optional().describe('Task IDs this depends on'),
    acceptanceCriteria: z.array(z.string().max(2000)).max(20).optional().describe('Acceptance criteria'),
    fileScope: z.array(z.string().max(1000)).max(20).optional().describe('Files in scope'),
    parallelism: z.string().max(500).optional().describe('Parallelism constraints'),
  },
}, (args) => handleCreateTask(db, projectRoot, args));

server.registerTool('bulk_create_tasks', {
  description: 'Create multiple tasks with sequential IDs, individual sizing validation, dependency wiring, and a single git commit.',
  inputSchema: {
    tasks: z.array(z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(50000),
      type: z.enum(CANONICAL_TASK_TYPES),
      priority: z.enum(['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low']),
      complexity: z.enum(['Simple', 'Medium', 'Complex']).optional(),
      model: z.string().max(100).optional(),
      dependencies: z.array(z.string().max(200)).max(20).optional(),
      acceptanceCriteria: z.array(z.string().max(2000)).max(20).optional(),
      fileScope: z.array(z.string().max(1000)).max(20).optional(),
      parallelism: z.string().max(500).optional(),
    })).min(1).max(20).describe('Array of task definitions to create'),
  },
}, (args) => handleBulkCreateTasks(db, projectRoot, args));

server.registerTool('bulk_update_tasks', {
  description: 'Update multiple tasks in a single DB transaction. Returns per-task success/failure summary. Invalid task IDs or unparsable fields are reported as errors without blocking other updates.',
  inputSchema: {
    updates: z.array(z.object({
      task_id: z.string().max(200).describe('Task ID to update'),
      fields: z.string().describe('JSON string of fields to update (same format as update_task)'),
    })).min(1).max(50).describe('Array of {task_id, fields} update descriptors (max 50)'),
  },
}, (args) => handleBulkUpdateTasks(db, args, projectRoot));

// --- Agent tools ---

server.registerTool('list_agents', {
  description: 'List agent definitions. Optionally filter by capability substring or launcher compatibility substring.',
  inputSchema: {
    capability: z.string().max(100).optional().describe('Filter by capability (substring match)'),
    launcher: z.string().max(100).optional().describe('Filter by launcher compatibility (substring match)'),
    limit: z.number().int().min(1).max(500).optional().describe('Max agents to return (default 100)'),
  },
}, (args) => handleListAgents(db, args));

server.registerTool('get_agent', {
  description: 'Get a single agent definition by ID.',
  inputSchema: {
    id: z.string().max(200).describe('Agent ID'),
  },
}, (args) => handleGetAgent(db, args));

server.registerTool('create_agent', {
  description: 'Create a new agent definition. Returns {ok: true, id} on success.',
  inputSchema: {
    id: z.string().max(200).describe('Agent ID (unique)'),
    name: z.string().max(200).describe('Agent name'),
    description: z.string().max(2000).optional().describe('Agent description'),
    capabilities: z.array(z.string().max(100)).max(50).optional().describe('List of capabilities (e.g. ["project-management","architecture"])'),
    prompt_template: z.string().max(50000).optional().describe('Agent prompt template text'),
    launcher_compatibility: z.array(z.string().max(100)).max(20).optional().describe('Compatible launcher types (e.g. ["claude-code","codex"])'),
  },
}, (args) => handleCreateAgent(db, args));

server.registerTool('update_agent', {
  description: 'Update fields on an existing agent. Updatable fields: name, description, capabilities, prompt_template, launcher_compatibility.',
  inputSchema: {
    id: z.string().max(200).describe('Agent ID'),
    fields: z.string().describe('JSON string of fields to update'),
  },
}, (args) => {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(args.fields) as Record<string, unknown>; }
  catch { return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid JSON in fields' }) }] }; }
  return handleUpdateAgent(db, { id: args.id, fields: parsed });
});

server.registerTool('delete_agent', {
  description: 'Delete an agent by ID.',
  inputSchema: {
    id: z.string().max(200).describe('Agent ID'),
  },
}, (args) => handleDeleteAgent(db, args));

// --- Workflow tools ---

server.registerTool('list_workflows', {
  description: 'List workflow definitions. Optionally filter to only default workflows.',
  inputSchema: {
    is_default: z.boolean().optional().describe('When true, return only default workflows'),
  },
}, (args) => handleListWorkflows(db, args));

server.registerTool('get_workflow', {
  description: 'Get a single workflow definition by ID.',
  inputSchema: {
    id: z.string().max(200).describe('Workflow ID'),
  },
}, (args) => handleGetWorkflow(db, args));

server.registerTool('create_workflow', {
  description: 'Create a new workflow definition. If is_default=true, clears default flag on all others first.',
  inputSchema: {
    id: z.string().max(200).describe('Workflow ID (unique)'),
    name: z.string().max(200).describe('Workflow name'),
    description: z.string().max(2000).optional().describe('Workflow description'),
    phases: z.array(z.object({
      name: z.string().max(100),
      required_capability: z.string().max(100),
      next_phase: z.string().max(100).nullable(),
    })).max(20).optional().describe('Ordered phase definitions'),
    is_default: z.boolean().optional().describe('Set as the default workflow'),
  },
}, (args) => handleCreateWorkflow(db, args));

server.registerTool('update_workflow', {
  description: 'Update a workflow definition. Updatable fields: name, description, phases, is_default.',
  inputSchema: {
    id: z.string().max(200).describe('Workflow ID'),
    fields: z.string().describe('JSON string of fields to update'),
  },
}, (args) => {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(args.fields) as Record<string, unknown>; }
  catch { return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid JSON in fields' }) }] }; }
  return handleUpdateWorkflow(db, { id: args.id, fields: parsed });
});

server.registerTool('delete_workflow', {
  description: 'Delete a workflow by ID. Refuses to delete the default workflow.',
  inputSchema: {
    id: z.string().max(200).describe('Workflow ID'),
  },
}, (args) => handleDeleteWorkflow(db, args));

// --- Launcher tools ---

server.registerTool('list_launchers', {
  description: 'List registered launcher adapters. Optionally filter by type or status.',
  inputSchema: {
    type: z.string().max(100).optional().describe('Filter by launcher type (claude-code, codex, cursor, opencode, other)'),
    status: z.string().max(50).optional().describe('Filter by status (active, inactive)'),
  },
}, (args) => handleListLaunchers(db, args));

server.registerTool('get_launcher', {
  description: 'Get a single launcher registration by ID.',
  inputSchema: {
    id: z.string().max(200).describe('Launcher ID'),
  },
}, (args) => handleGetLauncher(db, args));

server.registerTool('register_launcher', {
  description: 'Register or update a launcher adapter. Upserts by ID.',
  inputSchema: {
    id: z.string().max(200).describe('Launcher ID'),
    type: z.enum(['claude-code', 'codex', 'cursor', 'opencode', 'other']).describe('Launcher type'),
    config: z.record(z.string().max(64), z.unknown()).optional().describe('Launcher configuration JSON'),
    status: z.enum(['active', 'inactive']).optional().describe('Launcher status (default: active)'),
  },
}, (args) => handleRegisterLauncher(db, args));

server.registerTool('update_launcher', {
  description: 'Update a launcher registration. Updatable fields: type, config, status.',
  inputSchema: {
    id: z.string().max(200).describe('Launcher ID'),
    fields: z.string().describe('JSON string of fields to update'),
  },
}, (args) => {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(args.fields) as Record<string, unknown>; }
  catch { return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, reason: 'invalid JSON in fields' }) }] }; }
  return handleUpdateLauncher(db, { id: args.id, fields: parsed });
});

server.registerTool('deregister_launcher', {
  description: 'Mark a launcher as inactive (soft deregister).',
  inputSchema: {
    id: z.string().max(200).describe('Launcher ID'),
  },
}, (args) => handleDeregisterLauncher(db, args));

// --- Compatibility tools ---

server.registerTool('log_compatibility', {
  description: 'Record an execution outcome for the intelligence layer. Tracks launcher × model × task_type success/failure/cost data.',
  inputSchema: {
    launcher_type: z.string().max(100).describe('Launcher type that ran the task'),
    model: z.string().max(100).describe('Model used'),
    task_type: z.string().max(50).describe('Task type (FEATURE, BUGFIX, etc.)'),
    workflow_id: z.string().max(200).optional().describe('Workflow ID used (optional)'),
    outcome: z.enum(['success', 'failed', 'killed']).describe('Execution outcome'),
    duration_ms: z.number().int().min(0).optional().describe('Execution duration in milliseconds'),
    cost_estimate: z.number().min(0).optional().describe('Estimated cost in USD'),
    review_pass: z.boolean().optional().describe('Whether the review passed (true/false)'),
  },
}, (args) => handleLogCompatibility(db, args));

server.registerTool('query_compatibility', {
  description: 'Query compatibility records with optional filters. Returns records + aggregate summary (success_rate, avg_duration, avg_cost).',
  inputSchema: {
    launcher_type: z.string().max(100).optional().describe('Filter by launcher type'),
    model: z.string().max(100).optional().describe('Filter by model'),
    task_type: z.string().max(50).optional().describe('Filter by task type'),
    outcome: z.enum(['success', 'failed', 'killed']).optional().describe('Filter by outcome'),
    limit: z.number().int().min(1).max(1000).optional().describe('Max records to return (default 100)'),
  },
}, (args) => handleQueryCompatibility(db, args));

// --- Subtask tools ---

server.registerTool('create_subtask', {
  description: 'Create a single subtask under a parent task. Validates parent exists, parent is not itself a subtask (flat only), auto-assigns next M value. Subtask ID format: TASK_YYYY_NNN.M. Creates task.md + status file on disk and inserts into DB.',
  inputSchema: {
    parent_task_id: z.string().max(200).describe('Parent task ID (e.g. TASK_2026_261)'),
    title: z.string().min(1).max(500).describe('Subtask title'),
    description: z.string().max(10000).optional().describe('Subtask description'),
    type: z.enum(CANONICAL_TASK_TYPES).optional().describe('Task type (default: FEATURE)'),
    priority: z.enum(['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low']).optional().describe('Task priority (default: P2-Medium)'),
  },
}, (args) => handleCreateSubtask(db, projectRoot, args));

server.registerTool('bulk_create_subtasks', {
  description: 'Create multiple subtasks under a parent task in one call with sequential ordering. Same validations as create_subtask.',
  inputSchema: {
    parent_task_id: z.string().max(200).describe('Parent task ID (e.g. TASK_2026_261)'),
    subtasks: z.array(z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(10000).optional(),
      type: z.enum(CANONICAL_TASK_TYPES).optional(),
      priority: z.enum(['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low']).optional(),
    })).min(1).max(50).describe('Array of subtask definitions to create'),
  },
}, (args) => handleBulkCreateSubtasks(db, projectRoot, args));

server.registerTool('get_subtasks', {
  description: 'Return ordered subtasks for a given parent_task_id, sorted by subtask_order ascending.',
  inputSchema: {
    parent_task_id: z.string().max(200).describe('Parent task ID to retrieve subtasks for'),
  },
}, (args) => handleGetSubtasks(db, args));

server.registerTool('get_parent_status_rollup', {
  description: 'Derive parent status from subtask completion state. Returns derivedStatus: IMPLEMENTED (all COMPLETE), BLOCKED (any FAILED), or IN_PROGRESS (otherwise). Query helper — does not mutate parent task.',
  inputSchema: {
    parent_task_id: z.string().max(200).describe('Parent task ID to compute rollup for'),
  },
}, (args) => handleGetParentStatusRollup(db, args));

// --- Task Artifact tools ---

server.registerTool('write_review', {
  description: 'Write a code review artifact for a task. Validates task_id exists before inserting. Use read_reviews to retrieve all reviews for a task.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this review belongs to'),
    review_type: z.enum(['style', 'logic', 'security', 'visual', 'other']).describe('Type of review performed'),
    verdict: z.enum(['PASS', 'FAIL']).describe('Overall review outcome'),
    findings: z.string().max(50000).optional().describe('Detailed review findings (markdown)'),
    reviewer: z.string().max(200).optional().describe('Agent or reviewer identifier'),
  },
}, (args) => handleWriteReview(db, args));

server.registerTool('read_reviews', {
  description: 'Return all review records for a task, ordered by insertion time. Filter by review_type to get a specific review.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve reviews for'),
    review_type: z.enum(['style', 'logic', 'security', 'visual', 'other']).optional().describe('Filter to a specific review type'),
  },
}, (args) => handleReadReviews(db, args));

server.registerTool('write_test_report', {
  description: 'Write a test report artifact for a task. Validates task_id exists before inserting. Use read_test_report to retrieve.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this test report belongs to'),
    status: z.enum(['PASS', 'FAIL', 'SKIPPED']).describe('Overall test run outcome'),
    summary: z.string().max(5000).optional().describe('Short summary of test results'),
    details: z.string().max(50000).optional().describe('Full test output or detailed breakdown'),
  },
}, (args) => handleWriteTestReport(db, args));

server.registerTool('read_test_report', {
  description: 'Return the most recent test report for a task.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve the test report for'),
  },
}, (args) => handleReadTestReport(db, args));

server.registerTool('write_completion_report', {
  description: 'Write a completion report artifact for a task. Validates task_id exists before inserting. Use read_completion_report to retrieve.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this completion report belongs to'),
    summary: z.string().max(10000).optional().describe('Summary of what was built'),
    review_results: z.string().max(10000).optional().describe('Aggregated review outcomes'),
    test_results: z.string().max(10000).optional().describe('Test run outcome summary'),
    follow_on_tasks: z.string().max(5000).optional().describe('Any follow-on tasks or TODOs'),
    files_changed_count: z.number().int().min(0).optional().describe('Number of files changed'),
  },
}, (args) => handleWriteCompletionReport(db, args));

server.registerTool('read_completion_report', {
  description: 'Return the most recent completion report for a task.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve the completion report for'),
  },
}, (args) => handleReadCompletionReport(db, args));

server.registerTool('write_plan', {
  description: 'Write an implementation plan artifact for a task. Validates task_id exists before inserting. Use read_plan to retrieve.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this plan belongs to'),
    content: z.string().max(100000).describe('Implementation plan content (markdown)'),
  },
}, (args) => handleWritePlan(db, args));

server.registerTool('read_plan', {
  description: 'Return the most recent implementation plan for a task.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve the plan for'),
  },
}, (args) => handleReadPlan(db, args));

server.registerTool('write_task_description', {
  description: 'Write a task description (PM requirements) artifact. Validates task_id exists before inserting. Use read_task_description to retrieve.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this description belongs to'),
    content: z.string().max(100000).describe('Task description content (markdown)'),
  },
}, (args) => handleWriteTaskDescription(db, args));

server.registerTool('read_task_description', {
  description: 'Return the most recent task description for a task.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve the description for'),
  },
}, (args) => handleReadTaskDescription(db, args));

server.registerTool('write_context', {
  description: 'Write a context artifact (PM context gathering) for a task. Validates task_id exists before inserting. Use read_context to retrieve.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID this context belongs to'),
    content: z.string().max(100000).describe('Context content (markdown)'),
  },
}, (args) => handleWriteContext(db, args));

server.registerTool('read_context', {
  description: 'Return the most recent context artifact for a task.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve the context for'),
  },
}, (args) => handleReadContext(db, args));

server.registerTool('write_subtasks', {
  description: 'Replace all subtasks for a task with a fresh list. Runs as a single transaction: deletes existing subtasks, then inserts the new batch. Use read_subtasks to retrieve current state.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID these subtasks belong to'),
    subtasks: z.array(z.object({
      batch_number: z.number().int().min(1).optional().describe('Batch number (default: 1)'),
      subtask_name: z.string().max(500).describe('Name or description of the subtask'),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED']).optional().describe('Subtask status (default: PENDING)'),
      assigned_to: z.string().max(200).optional().describe('Agent or role assigned to this subtask'),
    })).max(500).describe('Full list of subtasks to write (replaces existing)'),
  },
}, (args) => handleWriteSubtasks(db, args));

server.registerTool('read_subtasks', {
  description: 'Return all subtasks for a task ordered by batch_number then insertion order. Filter by batch_number to get a specific batch.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve subtasks for'),
    batch_number: z.number().int().min(1).optional().describe('Filter to a specific batch number'),
  },
}, (args) => handleReadSubtasks(db, args));

server.registerTool('get_task_artifacts', {
  description: 'Convenience tool: return all artifact types for a task in one call. Includes context, task_description, plan, all reviews, test_report, completion_report, and subtasks.',
  inputSchema: {
    task_id: z.string().max(200).describe('Task ID to retrieve all artifacts for'),
  },
}, (args) => handleGetTaskArtifacts(db, args));

// --- Start ---

jsonlWatcher.start();
const transport = new StdioServerTransport();
await server.connect(transport);

mcpLogger.info('MCP server connected via stdio (v0.6.0 — sessions + workers + handoffs + events + agent-context + telemetry + providers)');

process.on('SIGINT', () => { jsonlWatcher.stop(); fileWatcher.closeAll(); db.close(); process.exit(0); });
process.on('SIGTERM', () => { jsonlWatcher.stop(); fileWatcher.closeAll(); db.close(); process.exit(0); });
