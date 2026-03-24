import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import type { RegistryRow } from '../utils/registry.js';
import { preflightChecks } from '../utils/preflight.js';

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

function spawnSupervisor(cwd: string, taskId: string | undefined, options: RunOptions): void {
  const autoPilotParts = buildAutoPilotArgs(taskId, options);
  const prompt = ['/auto-pilot', ...autoPilotParts].join(' ');

  console.log(`Starting Supervisor: claude --dangerously-skip-permissions -p "${prompt}"`);
  console.log('');

  const child = spawn(
    'claude',
    ['--dangerously-skip-permissions', '-p', prompt],
    {
      cwd,
      stdio: 'inherit',
    }
  );

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`Supervisor exited with code ${String(code ?? 'unknown')}`);
      process.exitCode = 1;
    }
  });

  child.on('error', (err) => {
    console.error(`Failed to start Supervisor: ${err.message}`);
    process.exitCode = 1;
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
    .action((taskId: string | undefined, opts: RunOptions) => {
      const cwd = process.cwd();

      const rows = preflightChecks(cwd, taskId);
      if (rows === null) {
        process.exitCode = 1;
        return;
      }

      displaySummary(rows, taskId, opts);

      if (opts.dryRun) {
        displayDryRun(rows);
        return;
      }

      spawnSupervisor(cwd, taskId, opts);
    });
}
