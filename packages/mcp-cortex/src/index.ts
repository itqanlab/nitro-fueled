#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { join } from 'node:path';
import { initDatabase } from './db/schema.js';
import {
  getTasksSchema, claimTaskSchema, releaseTaskSchema, updateTaskSchema,
  handleGetTasks, handleClaimTask, handleReleaseTask, handleUpdateTask,
} from './tools/tasks.js';
import { getNextWaveSchema, handleGetNextWave } from './tools/wave.js';
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

server.tool(
  'get_tasks',
  'Filtered task list. When unblocked=true, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE.',
  getTasksSchema,
  async (args) => handleGetTasks(db, args),
);

server.tool(
  'claim_task',
  'Atomic claim on a task. Returns {ok: true} or {ok: false, claimed_by: session_id}. Uses exclusive transaction.',
  claimTaskSchema,
  async (args) => handleClaimTask(db, args),
);

server.tool(
  'release_task',
  'Release a claimed task, clearing the claim and setting a new status.',
  releaseTaskSchema,
  async (args) => handleReleaseTask(db, args),
);

server.tool(
  'update_task',
  'Partial update of any task fields. Whitelists updatable columns for safety.',
  updateTaskSchema,
  async (args) => handleUpdateTask(db, args),
);

server.tool(
  'get_next_wave',
  'Returns up to N unclaimed, dependency-resolved CREATED tasks. Atomically claims them for the requesting session.',
  getNextWaveSchema,
  async (args) => handleGetNextWave(db, args),
);

server.tool(
  'sync_tasks_from_files',
  'Bootstrap: scan task-tracking/TASK_*/ folders, import task.md fields and status files into DB. Safe to re-run (upsert by task_id).',
  {},
  async () => handleSyncTasksFromFiles(db, projectRoot),
);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[nitro-cortex] MCP server connected via stdio');

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
