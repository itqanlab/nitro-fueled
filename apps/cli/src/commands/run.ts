import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { logger } from '../utils/logger.js';
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
import { initCortexDatabase } from '../utils/cortex-db-init.js';
import type DatabaseType from 'better-sqlite3';
import { SupervisorEngine } from '@itqanlab/nitro-cortex/supervisor';
import type { SpawnParams, SpawnOutcome, EngineConfig } from '@itqanlab/nitro-cortex/supervisor';
import { spawnWorkerProcess, resolveGlmApiKey } from '@itqanlab/nitro-cortex/process/spawn';
import { attachEngineOutput, printSessionSummary } from '../utils/engine-output.js';

interface RunFlags {
  task: string | undefined;
  'dry-run': boolean;
  concurrency: string | undefined;
  interval: string | undefined;
  retries: string | undefined;
  'skip-connectivity': boolean;
  engine: boolean;
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
  const interval = options.interval ?? '15s';
  const mode = options['dry-run'] ? 'dry-run' : options.engine ? 'engine' : 'all';

  logger.log('');
  logger.log('SUPERVISOR STARTING');
  logger.log('-------------------');
  logger.log(`Total tasks in registry: ${rows.length}`);
  logger.log(`Ready for build (CREATED): ${created}`);
  logger.log(`Building (IN_PROGRESS): ${inProgress}`);
  logger.log(`Ready for review (IMPLEMENTED): ${implemented}`);
  logger.log(`Reviewing (IN_REVIEW): ${inReview}`);
  logger.log(`Complete: ${complete}`);
  logger.log(`Failed: ${failed}`);
  logger.log(`Blocked/Cancelled: ${blockedCancelled}`);
  logger.log(`Concurrency limit: ${concurrency}`);
  logger.log(`Monitoring interval: ${interval}`);
  logger.log(`Mode: ${mode}`);
  logger.log('');
}

function displayDryRun(rows: RegistryRow[]): void {
  logger.log('DRY RUN -- Execution Plan');
  logger.log('========================');
  logger.log('');

  const readyForBuild = rows.filter((r) => r.status === 'CREATED');
  const building = rows.filter((r) => r.status === 'IN_PROGRESS');
  const readyForReview = rows.filter((r) => r.status === 'IMPLEMENTED');
  const reviewing = rows.filter((r) => r.status === 'IN_REVIEW');

  logger.log('Task Classification:');
  for (const t of readyForBuild) {
    logger.log(`  ${t.id} (${t.type}) -- READY_FOR_BUILD`);
  }
  for (const t of building) {
    logger.log(`  ${t.id} (${t.type}) -- BUILDING`);
  }
  for (const t of readyForReview) {
    logger.log(`  ${t.id} (${t.type}) -- READY_FOR_REVIEW`);
  }
  for (const t of reviewing) {
    logger.log(`  ${t.id} (${t.type}) -- REVIEWING`);
  }

  logger.log('');
  logger.log('Execution Order:');

  let wave = 1;
  if (readyForReview.length > 0 || reviewing.length > 0) {
    logger.log(`  Wave ${wave} (immediate):`);
    for (const t of readyForReview) {
      logger.log(`    Review: ${t.id} (${t.type}, ${t.description}) -- Review Worker`);
    }
    for (const t of reviewing) {
      logger.log(`    Review: ${t.id} (${t.type}, ${t.description}) -- Review Worker (resume)`);
    }
    wave++;
  }

  if (readyForBuild.length > 0 || building.length > 0) {
    logger.log(`  Wave ${wave} (${wave === 1 ? 'immediate' : 'concurrent'}):`);
    for (const t of readyForBuild) {
      logger.log(`    Build:  ${t.id} (${t.type}, ${t.description}) -- Build Worker`);
    }
    for (const t of building) {
      logger.log(`    Build:  ${t.id} (${t.type}, ${t.description}) -- Build Worker (resume)`);
    }
  }

  logger.log('');
  logger.log('No workers spawned (dry run).');
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
    logger.log('Dashboard service not found (skipping). Install @nitro-fueled/dashboard-service to enable the dashboard.');
    return null;
  }

  const taskTrackingDir = resolve(cwd, 'task-tracking');
  const { portFilePath } = dashboardFilePaths(taskTrackingDir);

  const existingPort = await checkExistingService(portFilePath);
  if (existingPort !== null) {
    logger.log(`Dashboard already running at http://localhost:${existingPort}`);
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
    logger.log(`Dashboard available at http://localhost:${actualPort}`);
  } else {
    logger.warn('Warning: Dashboard service did not start within timeout.');
  }

  return child;
}

function spawnSupervisorClaude(cwd: string, options: RunFlags): void {
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

/** Parse interval string like "10m", "30s", "1h" into milliseconds. */
function parseIntervalMs(interval: string): number {
  const match = /^(\d+)([msh])$/.exec(interval);
  if (!match) return 15_000;
  const value = Number(match[1]);
  switch (match[2]) {
    case 's': return value * 1000;
    case 'm': return value * 60_000;
    case 'h': return value * 3_600_000;
    default:  return 15_000;
  }
}

/** Return true when there is nothing left to process. */
function isQueueDone(db: DatabaseType.Database, targetTaskId: string | undefined): boolean {
  if (targetTaskId !== undefined) {
    const row = db
      .prepare('SELECT status FROM tasks WHERE id = ?')
      .get(targetTaskId) as { status: string } | undefined;
    const status = row?.status ?? '';
    // Done when task leaves the active build states
    return !['CREATED', 'IN_PROGRESS'].includes(status);
  }
  // Batch: done when no tasks remain in active build states
  const row = db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE status IN ('CREATED', 'IN_PROGRESS')
  `).get() as { cnt: number };
  return row.cnt === 0;
}

/** Insert a session row and return its ID. Non-fatal on DB errors. */
function ensureSession(db: DatabaseType.Database): string {
  const sessionId = `SESSION_CLI_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try {
    db.prepare(`
      INSERT OR IGNORE INTO sessions (id, source, loop_status)
      VALUES (?, 'cli-run', 'running')
    `).run(sessionId);
  } catch {
    // older DBs without sessions table — non-fatal
  }
  return sessionId;
}

/** Mark the session as stopped. Non-fatal on DB errors. */
function closeSession(db: DatabaseType.Database, sessionId: string): void {
  try {
    db.prepare(`
      UPDATE sessions SET loop_status = 'stopped', ended_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), sessionId);
  } catch {
    // non-fatal
  }
}

/**
 * Build a SpawnFn compatible with SupervisorEngine.
 * Inserts a worker DB row, spawns the worker process, and wires the exit
 * callback back into the DB.
 */
function buildSpawnFn(
  db: DatabaseType.Database,
  cwd: string,
): (params: SpawnParams) => SpawnOutcome {
  const glmApiKey = resolveGlmApiKey(cwd);
  const validProviders = new Set(['claude', 'glm', 'opencode', 'codex']);

  return (params: SpawnParams): SpawnOutcome => {
    const workerId = `WID_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO workers
          (id, session_id, task_id, worker_type, label, status,
           working_directory, model, provider, launcher, spawn_time)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
      `).run(
        workerId,
        params.sessionId,
        params.taskId,
        params.workerType,
        params.label,
        cwd,
        params.model,
        params.provider,
        params.launcher,
        now,
      );
    } catch (err) {
      return { ok: false, reason: `DB insert failed: ${String(err)}` };
    }

    const provider = validProviders.has(params.provider)
      ? (params.provider as 'claude' | 'glm' | 'opencode' | 'codex')
      : 'claude';

    try {
      const result = spawnWorkerProcess({
        prompt: params.prompt,
        workingDirectory: cwd,
        label: params.label,
        model: params.model,
        provider,
        glmApiKey,
        onExit: (code: number | null) => {
          const current = db
            .prepare('SELECT status FROM workers WHERE id = ?')
            .get(workerId) as { status: string } | undefined;
          if (current?.status === 'killed') return;
          const newStatus = code === 0 ? 'completed' : 'failed';
          db.prepare('UPDATE workers SET status = ?, updated_at = ? WHERE id = ?')
            .run(newStatus, new Date().toISOString(), workerId);
        },
      });

      db.prepare('UPDATE workers SET pid = ? WHERE id = ?').run(result.pid, workerId);
      return { ok: true, workerId };
    } catch (err) {
      db.prepare("UPDATE workers SET status = 'failed' WHERE id = ?").run(workerId);
      return { ok: false, reason: `Spawn failed: ${String(err)}` };
    }
  };
}

/**
 * Run the SupervisorEngine in-process. Resolves when the queue is empty
 * (batch) or the target task leaves an active build state (single-task).
 * Handles SIGINT/SIGTERM with a graceful engine.stop() + orphan guard.
 */
async function runWithEngine(
  cwd: string,
  options: RunFlags,
  targetTaskId: string | undefined,
): Promise<void> {
  const dbPath = resolve(cwd, '.nitro', 'cortex.db');
  const { db } = initCortexDatabase(dbPath);
  const sessionId = ensureSession(db);

  const concurrencyLimit = options.concurrency !== undefined ? Number(options.concurrency) : 3;
  const intervalMs = options.interval !== undefined
    ? parseIntervalMs(options.interval)
    : 15_000;

  const cfg: EngineConfig = {
    sessionId,
    workingDirectory: cwd,
    concurrencyLimit,
    intervalMs,
    spawnFn: buildSpawnFn(db, cwd),
  };

  const engine = new SupervisorEngine(db, cfg);
  const summary = attachEngineOutput(engine);

  let stopped = false;

  const shutdown = (signal: string): void => {
    if (stopped) return;
    stopped = true;
    logger.log(`\nReceived ${signal} — stopping engine and running orphan guard...`);
    engine.stop();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  engine.start();

  await new Promise<void>((resolve) => {
    const pollInterval = setInterval(() => {
      if (stopped || isQueueDone(db, targetTaskId)) {
        clearInterval(pollInterval);
        if (!stopped) engine.stop();
        resolve();
      }
    }, 5_000);

    engine.on('task:transitioned', () => {
      if (stopped || isQueueDone(db, targetTaskId)) {
        clearInterval(pollInterval);
        if (!stopped) engine.stop();
        resolve();
      }
    });
  });

  closeSession(db, sessionId);
  db.close();

  printSessionSummary(summary);
}

export default class Run extends BaseCommand {
  public static override description = 'Start the Supervisor loop, or orchestrate a single task inline';

  public static override args = {
    taskId: Args.string({ description: 'Task ID to orchestrate (e.g. TASK_2026_010)', required: false }),
  };

  public static override flags = {
    task: Flags.string({ description: 'Task number shorthand (e.g. 043 → TASK_<current-year>_043)' }),
    'dry-run': Flags.boolean({ description: 'Show execution plan without spawning workers (batch mode only)', default: false }),
    concurrency: Flags.string({ description: 'Max simultaneous workers (default: 3)' }),
    interval: Flags.string({ description: 'Engine/monitoring interval e.g. 5m, 30s (default: 15s for engine, 10m for AI supervisor)' }),
    retries: Flags.string({ description: 'Max retries per task (default: 2) — AI supervisor only' }),
    'skip-connectivity': Flags.boolean({ description: 'Skip MCP connectivity check (AI supervisor batch mode only)', default: false }),
    engine: Flags.boolean({ description: 'Use SupervisorEngine in-process (no AI supervisor session spawned)', default: false }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);
    const opts: RunFlags = flags;
    const cwd = process.cwd();

    // Validate --task shorthand format before expanding
    if (opts.task !== undefined && !/^\d{1,3}$/.test(opts.task)) {
      logger.error(`Error: Invalid --task value "${opts.task}". Expected a 1-3 digit number (e.g., 43 or 043).`);
      process.exitCode = 1;
      return;
    }

    const taskId = resolveTaskId(args.taskId, opts.task);

    if (taskId !== undefined) {
      // ── Single-task mode ──────────────────────────────────────────────────

      const batchOnlyUsed: string[] = [];
      if (opts['dry-run']) batchOnlyUsed.push('--dry-run');
      if (opts['skip-connectivity']) batchOnlyUsed.push('--skip-connectivity');
      if (batchOnlyUsed.length > 0) {
        const plural = batchOnlyUsed.length === 1 ? 'is a batch-only option' : 'are batch-only options';
        logger.error(`Error: ${batchOnlyUsed.join(', ')} ${plural} and cannot be used with a task ID.`);
        logger.error('Remove the option(s) to run a single task, or omit the task ID for batch mode.');
        process.exitCode = 1;
        return;
      }

      if (!basicPreflightChecks(cwd)) {
        process.exitCode = 1;
        return;
      }

      const registryPath = resolve(cwd, 'task-tracking/registry.md');
      if (!existsSync(registryPath)) {
        logger.error('Error: task-tracking/registry.md not found.');
        logger.error('Run `npx nitro-fueled init` to scaffold the workspace first.');
        process.exitCode = 1;
        return;
      }

      const taskIdPattern = /^TASK_\d{4}_\d{3}$/;
      if (!taskIdPattern.test(taskId)) {
        logger.error(`Error: Invalid task ID format "${taskId}".`);
        logger.error('Expected format: TASK_YYYY_NNN (e.g., TASK_2026_010)');
        process.exitCode = 1;
        return;
      }

      const rows = parseRegistry(cwd);
      const task = rows.find((r) => r.id === taskId);
      if (task === undefined) {
        logger.error(`Error: Task ${taskId} not found in registry.`);
        process.exitCode = 1;
        return;
      }

      if (task.status === 'BLOCKED' || task.status === 'CANCELLED' || task.status === 'FAILED') {
        logger.error(`Error: Task ${taskId} is ${task.status} and cannot be processed.`);
        process.exitCode = 1;
        return;
      }

      if (task.status === 'COMPLETE') {
        logger.warn(`Warning: Task ${taskId} is already COMPLETE.`);
        process.exitCode = 1;
        return;
      }

      logger.log('');

      if (opts.engine) {
        logger.log('RUNNING SINGLE TASK (engine mode)');
        logger.log('---------------------------------');
        logger.log(`Task: ${taskId}`);
        logger.log('');
        await runWithEngine(cwd, opts, taskId);
        return;
      }

      // Default single-task: spawn Claude with /orchestrate (interactive)
      logger.log('ORCHESTRATING SINGLE TASK');
      logger.log('-------------------------');
      logger.log(`Task: ${taskId}`);
      logger.log('');

      spawnOrchestrate(cwd, taskId);
      return;
    }

    // ── Batch mode ──────────────────────────────────────────────────────────
    const result = preflightChecks(cwd, undefined);
    if (result === null) {
      process.exitCode = 1;
      return;
    }

    const validationError = validateBatchOptions(opts);
    if (validationError !== null) {
      logger.error(`Error: ${validationError}`);
      process.exitCode = 1;
      return;
    }

    const { rows } = result;

    displaySummary(rows, opts);

    if (opts['dry-run']) {
      displayDryRun(rows);
      return;
    }

    const providerIssues = checkProviderConfig(cwd);
    if (providerIssues.length > 0) {
      for (const issue of providerIssues) {
        logger.error(`Error: Provider ${issue.provider} — ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }

    if (opts.engine) {
      // Engine mode: use SupervisorEngine in-process for batch
      logger.log('Starting batch engine mode...');
      logger.log('');
      await runWithEngine(cwd, opts, undefined);
      return;
    }

    // Default batch: spawn Claude AI supervisor session
    if (!opts['skip-connectivity']) {
      logger.log('Verifying MCP nitro-cortex connectivity...');
      const connectivity = testMcpConnectivity(result.mcpConfig);
      if (connectivity.status !== 'ok') {
        logger.error(`Error: ${connectivity.message}`);
        logger.error('');
        logger.error('Use --skip-connectivity to bypass this check.');
        process.exitCode = 1;
        return;
      }
      logger.log(connectivity.message);
      logger.log('');
    }

    let dashboardProcess: ChildProcess | null = null;
    try {
      dashboardProcess = await startDashboardService(cwd);
    } catch (err: unknown) {
      logger.warn(`Warning: Dashboard service failed to start: ${String(err)}`);
    }

    if (dashboardProcess !== null) {
      process.on('exit', () => {
        if (dashboardProcess!.pid !== undefined) {
          try { process.kill(dashboardProcess!.pid, 'SIGTERM'); } catch { /* already exited */ }
        }
      });
    }

    spawnSupervisorClaude(cwd, opts);
  }
}
