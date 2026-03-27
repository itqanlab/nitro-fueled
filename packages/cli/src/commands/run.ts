import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';
import type { Command } from 'commander';
import type { RegistryRow } from '../utils/registry.js';
import { preflightChecks } from '../utils/preflight.js';
import { testMcpConnectivity } from '../utils/mcp-connectivity.js';
import { spawnClaude } from '../utils/spawn-claude.js';

const PORT_FILE_NAME = '.dashboard-port';
const DASHBOARD_STARTUP_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 100;

interface RunOptions {
  dryRun: boolean;
  concurrency: string | undefined;
  interval: string | undefined;
  retries: string | undefined;
}

function displaySummary(rows: RegistryRow[], taskId: string | undefined, options: RunOptions): void {
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

  let mode = 'all';
  if (options.dryRun) {
    mode = 'dry-run';
  } else if (taskId !== undefined) {
    mode = `single-task ${taskId}`;
  }

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

function validateOptions(options: RunOptions): string | null {
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

function buildAutoPilotArgs(taskId: string | undefined, options: RunOptions): string[] {
  const parts: string[] = [];

  if (taskId !== undefined) {
    parts.push(taskId);
  }

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

function findDashboardEntryScript(): string | null {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(thisDir, '../../node_modules/@nitro-fueled/dashboard-service/dist/cli-entry.js'),
    resolve(thisDir, '../../../dashboard-service/dist/cli-entry.js'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

async function pollForPortFile(portFilePath: string, timeoutMs: number): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(portFilePath)) {
      const raw = readFileSync(portFilePath, 'utf-8').trim();
      const port = parseInt(raw, 10);
      if (!Number.isNaN(port) && port > 0) return port;
    }
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return null;
}

async function startDashboardService(cwd: string): Promise<ChildProcess | null> {
  const entryScript = findDashboardEntryScript();
  if (!entryScript) {
    console.log('Dashboard service not found (skipping). Build dashboard-service to enable.');
    return null;
  }

  const taskTrackingDir = resolve(cwd, 'task-tracking');
  const portFilePath = join(taskTrackingDir, PORT_FILE_NAME);

  // Check if already running
  if (existsSync(portFilePath)) {
    const raw = readFileSync(portFilePath, 'utf-8').trim();
    const existingPort = parseInt(raw, 10);
    if (!Number.isNaN(existingPort) && existingPort > 0) {
      try {
        const resp = await fetch(`http://localhost:${existingPort}/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (resp.ok) {
          console.log(`Dashboard already running at http://localhost:${existingPort}`);
          return null;
        }
      } catch {
        // stale port file, proceed to start
      }
    }
  }

  const args = [entryScript, '--task-tracking-dir', taskTrackingDir, '--port', '0'];

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

  const actualPort = await pollForPortFile(portFilePath, DASHBOARD_STARTUP_TIMEOUT_MS);
  if (actualPort !== null) {
    console.log(`Dashboard available at http://localhost:${actualPort}`);
  } else {
    console.warn('Warning: Dashboard service did not start within timeout.');
  }

  return child;
}

function spawnSupervisor(cwd: string, taskId: string | undefined, options: RunOptions): void {
  const autoPilotParts = buildAutoPilotArgs(taskId, options);
  const prompt = ['/auto-pilot', ...autoPilotParts].join(' ');

  spawnClaude({
    cwd,
    args: ['--dangerously-skip-permissions', '-p', prompt],
    label: 'Supervisor',
  });
}

export function registerRunCommand(program: Command): void {
  program
    .command('run [taskId]')
    .description('Start the Supervisor loop to process tasks autonomously')
    .option('--dry-run', 'Show execution plan without spawning workers', false)
    .option('--concurrency <n>', 'Max simultaneous workers (default: 3)')
    .option('--interval <duration>', 'Monitoring interval e.g. 5m (default: 10m)')
    .option('--retries <n>', 'Max retries per task (default: 2)')
    .option('--skip-connectivity', 'Skip MCP connectivity check', false)
    .action(async (taskId: string | undefined, opts: RunOptions & { skipConnectivity: boolean }) => {
      const cwd = process.cwd();

      const result = preflightChecks(cwd, taskId);
      if (result === null) {
        process.exitCode = 1;
        return;
      }

      const validationError = validateOptions(opts);
      if (validationError !== null) {
        console.error(`Error: ${validationError}`);
        process.exitCode = 1;
        return;
      }

      const { rows } = result;

      displaySummary(rows, taskId, opts);

      if (opts.dryRun) {
        displayDryRun(rows);
        return;
      }

      if (!opts.skipConnectivity) {
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

      // Start dashboard service in the background so it's available during the run
      const dashboardProcess = await startDashboardService(cwd);

      if (dashboardProcess !== null) {
        const shutdownDashboard = (): void => {
          if (dashboardProcess.pid !== undefined) {
            try {
              process.kill(dashboardProcess.pid, 'SIGTERM');
            } catch {
              // already exited
            }
          }
        };
        process.on('exit', shutdownDashboard);
        process.on('SIGINT', () => { shutdownDashboard(); process.exit(0); });
        process.on('SIGTERM', () => { shutdownDashboard(); process.exit(0); });
      }

      spawnSupervisor(cwd, taskId, opts);
    });
}
