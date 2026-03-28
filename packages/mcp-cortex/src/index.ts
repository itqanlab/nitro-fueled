#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'node:path';
import { initDatabase } from './db/schema.js';
import { handleGetTasks, handleClaimTask, handleReleaseTask, handleUpdateTask } from './tools/tasks.js';
import { handleGetNextWave } from './tools/wave.js';
import { handleSyncTasksFromFiles } from './tools/sync.js';

const projectRoot = process.cwd();
const dbPath = join(projectRoot, '.nitro', 'cortex.db');

console.error(`[nitro-cortex] project root: ${projectRoot}`);
console.error(`[nitro-cortex] database: ${dbPath}`);

const db = initDatabase(dbPath);
console.error('[nitro-cortex] database initialized');

const server = new McpServer({
  name: 'nitro-cortex',
  version: '0.1.0',
});

server.registerTool('get_tasks', {
  description: 'Filtered task list. When unblocked=true, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE.',
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
    new_status: z.string().describe('New status to set'),
  },
}, (args) => handleReleaseTask(db, args));

server.registerTool('update_task', {
  description: 'Partial update of any task fields. Whitelists updatable columns for safety.',
  inputSchema: {
    task_id: z.string().describe('Task ID to update'),
    fields: z.string().describe('JSON string of fields to update'),
  },
}, (args) => {
  const parsed = JSON.parse(args.fields) as Record<string, unknown>;
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

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[nitro-cortex] MCP server connected via stdio');

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
