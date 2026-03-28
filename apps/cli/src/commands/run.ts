import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import type { RegistryRow } from '../utils/registry.js';
import { parseRegistry } from '../utils/registry.js';
import { basicPreflightChecks, preflightChecks } from '../utils/preflight.js';
import { testMcpConnectivity } from '../utils/mcp-connectivity.js';
import { spawnClaude } from '../utils/spawn-claude.js';
import {
  DEFAULT_PORT,
  STARTUP_TIMEOUT_MS,
  checkExistingService,
  dashboardFilePaths,
  findEntryScript,
  pollForPortFile,
} from '../utils/dashboard-helpers.js';
import { checkProviderConfig } from '../utils/provider-config.js';

interface RunFlags {
  task: string | undefined;
  'dry-run': boolean;
  concurrency: string | undefined;
  interval: string | undefined;
  retries: string | undefined;
  'skip-connectivity': boolean;
}

function displaySummary(rows: RegistryRow[], options: RunFlags): void {
  const created = rows.filter((r) => r.status === 'CREATED').length;
  const inProgress = rows.filter((r) => r.status === 'IN_PROGRESS').length;
  const implemented = rows.filter((r) => r.status === 'IMPLEMENTED').length;
  const inReview = rows.filter((r) => r.status === 'IN_REVIEW').length;
  const complete = rows.filter((r) => r.status === 'COMPLETE').length;
  const failed = rows.filter((r) => r.status === 'FAILED').length;
  const blockedCancelled = rows.filter(
    (r) => r.status === 'BLOCKED' || r.status === 'CANCELLED'
  ).length;

  const concurrency = options.concurrency ?? '3';
  const interval = options.interval ?? '10m';
  const mode = options['dry-run'] ? 'dry-run' : 'all';

  console.log('');
  console.log('SUPERVISOR STARTING');
  console.log('-------------------');
  console.log(`Total tasks in registry: ${rows.length}`);
  console.log(`Ready for build (CREATED): ${created}`);
  console.log(`Building (IN_PROGRESS): ${inProgress}`);
  console.log(`Ready for review (IMPLEMENTED): ${implemented}`);
  console.log(`Reviewing (IN_REVIEW): ${inReview}`);
  console.log(`Complete: ${complete}`);
  console.log(`Failed: ${failed}`);
  console.log(`Blocked/Cancelled: ${blockedCancelled}`);
  console.log(`Concurrency limit: ${concurrency}`);
  console.log(`Monitoring interval: ${interval}`);
  console.log(`Mode: ${mode}`);
  console.log('');
}

function displayDryRun(rows: RegistryRow[]): void {
  console.log('DRY RUN -- Execution Plan');
  console.log('========================');
  console.log('');

  const readyForBuild = rows.filter((r) => r.status === 'CREATED');
  const building = rows.filter((r) => r.status === 'IN_PROGRESS');
  const readyForReview = rows.filter((r) => r.status === 'IMPLEMENTED');
  const reviewing = rows.filter((r) => r.status === 'IN_REVIEW');

  console.log('Task Classification:');
  for (const t of readyForBuild) {
    console.log(`  ${t.id} (${t.type}) -- READY_FOR_BUILD`);
  }
  for (const t of building) {
    console.log(`  ${t.id} (${t.type}) -- BUILDING`);
  }
  for (const t of readyForReview) {
    console.log(`  ${t.id} (${t.type}) -- READY_FOR_REVIEW`);
  }
  for (const t of reviewing) {
    console.log(`  ${t.id} (${t.type}) -- REVIEWING`);
  }

  console.log('');
  console.log('Execution Order:');

  let wave = 1;
  if (readyForReview.length > 0 || reviewing.length > 0) {
    console.log(`  Wave ${wave} (immediate):`);
    for (const t of readyForReview) {
      console.log(`    Review: ${t.id} (${t.type}, ${t.description}) -- Review Worker`);
    }
    for (const t of reviewing) {
      console.log(`    Review: ${t.id} (${t.type}, ${t.description}) -- Review Worker (resume)`);
    }
    wave++;
  }

  if (readyForBuild.length > 0 || building.length > 0) {
    console.log(`  Wave ${wave} (${wave === 1 ? 'immediate' : 'concurrent'}):`);
    for (const t of readyForBuild) {
      console.log(`    Build:  ${t.id} (${t.type}, ${t.description}) -- Build Worker`);
    }
    for (const t of building) {
      console.log(`    Build:  ${t.id} (${t.type}, ${t.description}) -- Build Worker (resume)`);
    }
  }

  console.log('');
  console.log('No workers spawned (dry run).');
}

function validateBatchOptions(options: RunFlags): string | null {
  if (options.concurrency !== undefined && !/^[1-9]\d*$/.test(options.concurrency)) {
    return `Invalid --concurrency value "${options.concurrency}". Must be a positive integer (>= 1).`;
  }
  if (options.retries !== undefined && !/^\d+$/.test(options.retries)) {
    return `Invalid --retries value "${options.retries}". Must be a non-negative integer.`;
  }
  if (options.interval !== undefined && !/^\d+[msh]$/.test(options.interval)) {
    return `Invalid --interval value "${options.interval}". Expected format: <number><unit> (e.g., 5m, 30s, 1h).`;
  }
  return null;
}

function buildAutoPilotArgs(options: RunFlags): string[] {
  const parts: string[] = [];

  if (options.concurrency !== undefined) {
    parts.push('--concurrency', options.concurrency);
  }

  if (options.interval !== undefined) {
    parts.push('--interval', options.interval);
  }

  if (options.retries !== undefined) {
    parts.push('--retries', options.retries);
  }

  return parts;
}

async function startDashboardService(cwd: string): Promise<ChildProcess | null> {
  const entryScript = findEntryScript();
  if (entryScript === null) {
    console.log('Dashboard service not found (skipping). Build dashboard-service to enable.');
    return null;
  }

  const taskTrackingDir = resolve(cwd, 'task-tracking');
  const { portFilePath } = dashboardFilePaths(taskTrackingDir);

  // Check if already running
  const existingPort = await checkExistingService(portFilePath);
  if (existingPort !== null) {
    console.log(`Dashboard already running at http://localhost:${existingPort}`);
    return null;
  }

  const args = [entryScript, '--task-tracking-dir', taskTrackingDir, '--port', String(DEFAULT_PORT)];

  const antiPatternsPath = resolve(cwd, '.claude/anti-patterns.md');
  if (existsSync(antiPatternsPath)) {
    args.push('--anti-patterns', antiPatternsPath);
  }

  const reviewLessonsDir = resolve(cwd, '.claude/review-lessons');
  if (existsSync(reviewLessonsDir)) {
    args.push('--review-lessons', reviewLessonsDir);
  }

  const child = spawn(process.execPath, args, {
    stdio: 'ignore',
    cwd,
    detached: false,
  });

  const actualPort = await pollForPortFile(portFilePath, STARTUP_TIMEOUT_MS);
  if (actualPort !== null) {
    console.log(`Dashboard available at http://localhost:${actualPort}`);
  } else {
    console.warn('Warning: Dashboard service did not start within timeout.');
  }

  return child;
}

function spawnSupervisor(cwd: string, options: RunFlags): void {
  const autoPilotParts = buildAutoPilotArgs(options);
  const autoPilotPrompt = ['/auto-pilot', ...autoPilotParts].join(' ');

  spawnClaude({
    cwd,
    args: ['--dangerously-skip-permissions', '-p', autoPilotPrompt],
    label: 'Supervisor',
  });
}

function spawnOrchestrate(cwd: string, taskId: string): void {
  spawnClaude({
    cwd,
    args: ['--dangerously-skip-permissions', '-p', `/orchestrate ${taskId}`],
    label: 'Orchestrator',
  });
}

function resolveTaskId(positional: string | undefined, shorthand: string | undefined): string | undefined {
  if (positional !== undefined) {
    return positional;
  }
  if (shorthand !== undefined) {
    const year = new Date().getFullYear();
    const padded = shorthand.padStart(3, '0');
    return `TASK_${year}_${padded}`;
  }
  return undefined;
}

export default class Run extends BaseCommand {
  public static override description = 'Start the Supervisor loop, or orchestrate a single task inline';

  public static override args = {
    taskId: Args.string({ description: 'Task ID to orchestrate (e.g. TASK_2026_010)', required: false }),
  };

  public static override flags = {
    task: Flags.string({ description: 'Task number shorthand (e.g. 043 → TASK_<current-year>_043)' }),
    'dry-run': Flags.boolean({ description: 'Show execution plan without spawning workers (batch mode only)', default: false }),
    concurrency: Flags.string({ description: 'Max simultaneous workers (default: 3) — batch mode only' }),
    interval: Flags.string({ description: 'Monitoring interval e.g. 5m (default: 10m) — batch mode only' }),
    retries: Flags.string({ description: 'Max retries per task (default: 2) — batch mode only' }),
    'skip-connectivity': Flags.boolean({ description: 'Skip MCP connectivity check (batch mode only)', default: false }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const opts: RunFlags = flags;
    const cwd = process.cwd();

    // Validate --task shorthand format before expanding
    if (opts.task !== undefined && !/^\d{1,3}$/.test(opts.task)) {
      console.error(`Error: Invalid --task value "${opts.task}". Expected a 1-3 digit number (e.g., 43 or 043).`);
      process.exitCode = 1;
      return;
    }

    const taskId = resolveTaskId(args.taskId, opts.task);

    if (taskId !== undefined) {
      // Single-task mode: spawn Claude with /orchestrate TASK_ID (inline, no MCP workers)

      // Reject batch-only options — they are silently ignored in this path otherwise
      const batchOnlyUsed: string[] = [];
      if (opts['dry-run']) batchOnlyUsed.push('--dry-run');
      if (opts.concurrency !== undefined) batchOnlyUsed.push('--concurrency');
      if (opts.interval !== undefined) batchOnlyUsed.push('--interval');
      if (opts.retries !== undefined) batchOnlyUsed.push('--retries');
      if (opts['skip-connectivity']) batchOnlyUsed.push('--skip-connectivity');
      if (batchOnlyUsed.length > 0) {
        const plural = batchOnlyUsed.length === 1 ? 'is a batch-only option' : 'are batch-only options';
        console.error(`Error: ${batchOnlyUsed.join(', ')} ${plural} and cannot be used with a task ID.`);
        console.error('Remove the option(s) to run a single task, or omit the task ID for batch mode.');
        process.exitCode = 1;
        return;
      }

      // Basic workspace + Claude CLI check (no MCP needed — /orchestrate runs inline)
      if (!basicPreflightChecks(cwd)) {
        process.exitCode = 1;
        return;
      }

      const registryPath = resolve(cwd, 'task-tracking/registry.md');
      if (!existsSync(registryPath)) {
        console.error('Error: task-tracking/registry.md not found.');
        console.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
        process.exitCode = 1;
        return;
      }

      const taskIdPattern = /^TASK_\d{4}_\d{3}$/;
      if (!taskIdPattern.test(taskId)) {
        console.error(`Error: Invalid task ID format "${taskId}".`);
        console.error('Expected format: TASK_YYYY_NNN (e.g., TASK_2026_010)');
        process.exitCode = 1;
        return;
      }

      const rows = parseRegistry(cwd);
      const task = rows.find((r) => r.id === taskId);
      if (task === undefined) {
        console.error(`Error: Task ${taskId} not found in registry.`);
        process.exitCode = 1;
        return;
      }

      if (task.status === 'BLOCKED' || task.status === 'CANCELLED' || task.status === 'FAILED') {
        console.error(`Error: Task ${taskId} is ${task.status} and cannot be processed.`);
        process.exitCode = 1;
        return;
      }

      if (task.status === 'COMPLETE') {
        console.warn(`Warning: Task ${taskId} is already COMPLETE.`);
        process.exitCode = 1;
        return;
      }

      console.log('');
      console.log('ORCHESTRATING SINGLE TASK');
      console.log('-------------------------');
      console.log(`Task: ${taskId}`);
      console.log('');

      spawnOrchestrate(cwd, taskId);
      return;
    }

    // Batch mode: full Supervisor loop
    const result = preflightChecks(cwd, undefined);
    if (result === null) {
      process.exitCode = 1;
      return;
    }

    const validationError = validateBatchOptions(opts);
    if (validationError !== null) {
      console.error(`Error: ${validationError}`);
      process.exitCode = 1;
      return;
    }

    const { rows } = result;

    displaySummary(rows, opts);

    if (opts['dry-run']) {
      displayDryRun(rows);
      return;
    }

    // Provider config pre-flight (fail fast if enabled provider has empty credentials)
    const providerIssues = checkProviderConfig(cwd);
    if (providerIssues.length > 0) {
      for (const issue of providerIssues) {
        console.error(`Error: Provider ${issue.provider} — ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }

    if (!opts['skip-connectivity']) {
      console.log('Verifying MCP session-orchestrator connectivity...');
      const connectivity = testMcpConnectivity(result.mcpConfig);
      if (connectivity.status !== 'ok') {
        console.error(`Error: ${connectivity.message}`);
        console.error('');
        console.error('Use --skip-connectivity to bypass this check.');
        process.exitCode = 1;
        return;
      }
      console.log(connectivity.message);
      console.log('');
    }

    // Start dashboard service in the background so it's available during the run.
    // Failures are non-fatal — the Supervisor must start regardless.
    let dashboardProcess: ChildProcess | null = null;
    try {
      dashboardProcess = await startDashboardService(cwd);
    } catch (err: unknown) {
      console.warn(`Warning: Dashboard service failed to start: ${String(err)}`);
    }

    if (dashboardProcess !== null) {
      // Use process.on('exit') only — spawnClaude already registers SIGINT/SIGTERM
      // handlers that forward to the Claude child. When Claude exits, Node drains
      // naturally, triggering 'exit', which sends SIGTERM to the dashboard child.
      process.on('exit', () => {
        if (dashboardProcess!.pid !== undefined) {
          try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
        }
      });
    }

    spawnSupervisor(cwd, opts);
  }
}
