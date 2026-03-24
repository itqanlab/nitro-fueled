import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseRegistry } from './registry.js';
import type { RegistryRow } from './registry.js';
import { detectMcpConfig } from './mcp-config.js';
import type { McpConfigResult } from './mcp-config.js';
import { displayMcpSetupGuide } from './mcp-setup-guide.js';

function isClaudeAvailable(): boolean {
  try {
    execSync('command -v claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export interface PreflightResult {
  rows: RegistryRow[];
  mcpConfig: McpConfigResult;
}

/**
 * Lightweight checks: workspace dirs exist + Claude CLI available.
 * Used by commands that don't need registry/MCP validation (e.g. create).
 */
export function basicPreflightChecks(cwd: string): boolean {
  const claudeDir = resolve(cwd, '.claude');
  const taskTrackingDir = resolve(cwd, 'task-tracking');

  if (!existsSync(claudeDir)) {
    console.error('Error: .claude/ directory not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return false;
  }

  if (!existsSync(taskTrackingDir)) {
    console.error('Error: task-tracking/ directory not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return false;
  }

  if (!isClaudeAvailable()) {
    console.error('Error: Claude Code CLI not found on PATH.');
    console.error('Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code');
    return false;
  }

  return true;
}

export function preflightChecks(cwd: string, taskId: string | undefined): PreflightResult | null {
  const claudeDir = resolve(cwd, '.claude');
  const taskTrackingDir = resolve(cwd, 'task-tracking');
  const registryPath = resolve(cwd, 'task-tracking/registry.md');

  if (!existsSync(claudeDir)) {
    console.error('Error: .claude/ directory not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return null;
  }

  if (!existsSync(taskTrackingDir)) {
    console.error('Error: task-tracking/ directory not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return null;
  }

  if (!existsSync(registryPath)) {
    console.error('Error: task-tracking/registry.md not found.');
    console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
    return null;
  }

  if (!isClaudeAvailable()) {
    console.error('Error: Claude Code CLI not found on PATH.');
    console.error('Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code');
    return null;
  }

  const mcpConfig = detectMcpConfig(cwd);
  if (!mcpConfig.found) {
    displayMcpSetupGuide();
    return null;
  }

  console.log(`MCP session-orchestrator: configured (${mcpConfig.location}, ${mcpConfig.configPath})`);

  const rows = parseRegistry(cwd);

  if (rows.length === 0) {
    console.error('Error: No tasks found in registry.');
    console.error('Create tasks with `npx nitro-fueled create` or `/create-task`.');
    return null;
  }

  if (taskId !== undefined) {
    const taskIdPattern = /^TASK_\d{4}_\d{3}$/;
    if (!taskIdPattern.test(taskId)) {
      console.error(`Error: Invalid task ID format "${taskId}".`);
      console.error('Expected format: TASK_YYYY_NNN (e.g., TASK_2026_010)');
      return null;
    }

    const task = rows.find((r) => r.id === taskId);
    if (task === undefined) {
      console.error(`Error: Task ${taskId} not found in registry.`);
      return null;
    }

    if (task.status === 'BLOCKED' || task.status === 'CANCELLED' || task.status === 'FAILED') {
      console.error(`Error: Task ${taskId} is ${task.status} and cannot be processed.`);
      return null;
    }

    if (task.status === 'COMPLETE') {
      console.warn(`Warning: Task ${taskId} is already COMPLETE.`);
      return null;
    }
  } else {
    const actionable = rows.filter(
      (r) => r.status !== 'COMPLETE' && r.status !== 'BLOCKED' && r.status !== 'CANCELLED' && r.status !== 'FAILED'
    );
    if (actionable.length === 0) {
      console.log('All tasks are complete, blocked, cancelled, or failed. Nothing to process.');
      return null;
    }
  }

  return { rows, mcpConfig };
}
