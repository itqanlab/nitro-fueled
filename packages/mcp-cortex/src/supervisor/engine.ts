/**
 * SupervisorEngine — Core Event Loop, Worker Orchestration & Prompt Builder
 *
 * Part 1: SupervisorEngine class — deterministic setInterval loop that wires
 * the 4 Wave 1 modules (resolver, router, budget, health) into a full
 * worker orchestration engine.
 *
 * Part 2: Prompt Builder — complexity-aware worker prompt selection so that
 * Simple tasks skip the PM and Architect phases, reducing token cost by ~50%.
 *
 * @see TASK_2026_338 for Part 1, earlier task for Part 2.
 */

import { EventEmitter } from 'node:events';
import type Database from 'better-sqlite3';

import { resolveUnblockedTasks } from './resolver.js';
import { routeModel } from './router.js';
import { checkBudget } from './budget.js';
import {
  checkWorkerHealth,
  reconcileWorkerExit,
  recoverStaleSession,
} from './health.js';
import type { ResolverTask } from './resolver.js';
import type { TaskMeta, Provider } from './router.js';
import type { WorkerRecord, SessionRecord, Handoff } from './types.js';
import type { WorkerType, TaskStatus } from '../db/schema.js';
import { killWorkerProcess } from '../process/spawn.js';

// ===========================================================================
// Part 1 — SupervisorEngine
// ===========================================================================

export interface SpawnParams {
  sessionId: string;
  taskId: string;
  workerType: WorkerType;
  model: string;
  provider: string;
  launcher: string;
  label: string;
  prompt: string;
}

export interface SpawnOutcome {
  ok: boolean;
  workerId?: string;
  reason?: string;
}

/**
 * Spawn function injected by the caller. Responsible for creating the worker
 * DB row and starting the child process with the resolved model/provider.
 */
export type SpawnFn = (params: SpawnParams) => SpawnOutcome;

export interface EngineConfig {
  /** Session ID under which workers are spawned. */
  sessionId: string;
  /** Absolute path to the project root. */
  workingDirectory: string;
  /** Maximum concurrent workers. Default: 3. */
  concurrencyLimit?: number;
  /** Loop interval in ms. Default: 15_000. */
  intervalMs?: number;
  /** Available providers for model routing. */
  providers?: Provider[];
  /** Budget/session config forwarded to the budget module. */
  sessionConfig?: Record<string, unknown>;
  /**
   * Builds the prompt for a spawned worker.
   * Default: minimal "Start or continue <taskId>" instruction.
   */
  promptTemplate?: (taskId: string, workerType: WorkerType) => string;
  /**
   * Process-spawning implementation. Required — keeps the engine testable
   * without launching real subprocesses.
   */
  spawnFn: SpawnFn;
}

export interface CycleStats {
  spawned: number;
  killed: number;
  transitioned: number;
}

function defaultEnginePrompt(taskId: string): string {
  return (
    `Start or continue ${taskId},\n` +
    `Do not stop for approval,\n` +
    `Finish -> Commit -> report.`
  );
}

/** Deterministic supervisor event loop. Extends EventEmitter. */
export class SupervisorEngine extends EventEmitter {
  private readonly db: Database.Database;
  private readonly cfg: {
    sessionId: string;
    workingDirectory: string;
    concurrencyLimit: number;
    intervalMs: number;
    providers: Provider[];
    sessionConfig: Record<string, unknown> | undefined;
    promptTemplate: (taskId: string, workerType: WorkerType) => string;
    spawnFn: SpawnFn;
  };
  private strikeMap = new Map<string, number>();
  private reconciledWorkers = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(db: Database.Database, config: EngineConfig) {
    super();
    this.db = db;
    this.cfg = {
      sessionId: config.sessionId,
      workingDirectory: config.workingDirectory,
      concurrencyLimit: config.concurrencyLimit ?? 3,
      intervalMs: config.intervalMs ?? 15_000,
      providers: config.providers ?? [],
      sessionConfig: config.sessionConfig,
      promptTemplate: config.promptTemplate ?? defaultEnginePrompt,
      spawnFn: config.spawnFn,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Run startup recovery, execute the first cycle, then start the interval. */
  start(): void {
    this._runStartupRecovery();
    this._runCycle();
    this.timer = setInterval(() => this._runCycle(), this.cfg.intervalMs);
  }

  /** Stop the interval and run the orphan guard. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._runOrphanGuard();
  }

  // ── Main cycle ─────────────────────────────────────────────────────────────

  private _runCycle(): void {
    this.emit('cycle:start');
    let spawned = 0;
    let killed = 0;
    let transitioned = 0;

    try {
      // 1. Health + budget checks on active workers
      for (const worker of this._queryActiveWorkers()) {
        const health = checkWorkerHealth(worker, this.strikeMap);
        if (health.action === 'kill') {
          this._killWorker(worker.id, worker.task_id, `health: ${health.reason}`);
          killed++;
          continue;
        }

        if (worker.task_id) {
          const complexity = this._getTaskComplexity(worker.task_id);
          const budget = checkBudget(worker.cost_json, complexity, this.cfg.sessionConfig);
          if (budget.exceeded) {
            this._killWorker(
              worker.id,
              worker.task_id,
              `budget: $${budget.current.toFixed(2)} > $${budget.limit.toFixed(2)}`,
            );
            killed++;
          }
        }
      }

      // 2. Reconcile workers that exited
      for (const worker of this._queryExitedWorkersNeedingReconciliation()) {
        if (!worker.task_id) continue;
        if (this.reconciledWorkers.has(worker.id)) continue;

        const handoff = this._getHandoff(worker.task_id);
        const result = reconcileWorkerExit(worker, handoff);
        const prevStatus = this._getTaskStatus(worker.task_id);

        this._setTaskStatus(worker.task_id, result.newStatus);
        this.reconciledWorkers.add(worker.id);
        transitioned++;

        this.emit('task:transitioned', {
          taskId: worker.task_id,
          from: prevStatus,
          to: result.newStatus as string,
        });
      }

      // 3. Spawn candidates up to concurrency limit
      const unblocked = resolveUnblockedTasks(this._queryAllActiveTasks());
      const slots = this.cfg.concurrencyLimit - this._queryActiveWorkers().length;

      for (let i = 0; i < Math.min(slots, unblocked.length); i++) {
        const task = unblocked[i]!;
        const meta = this._buildTaskMeta(task.id);
        const selection = routeModel(meta, 'build', this.cfg.providers, []);
        const prompt = this.cfg.promptTemplate(task.id, 'build');

        // Claim before spawning — prevents double-spawn across cycles
        if (!this._claimTask(task.id)) continue;

        const outcome = this.cfg.spawnFn({
          sessionId: this.cfg.sessionId,
          taskId: task.id,
          workerType: 'build',
          model: selection.model,
          provider: selection.provider,
          launcher: selection.launcher,
          label: `Build Worker - ${task.id}`,
          prompt,
        });

        if (outcome.ok) {
          spawned++;
          this.emit('worker:spawned', {
            taskId: task.id,
            workerId: outcome.workerId ?? 'unknown',
            model: selection.model,
            provider: selection.provider,
          });
        } else {
          // Release the claim so the task can be retried next cycle
          this._setTaskStatus(task.id, 'CREATED');
        }
      }
    } catch (err) {
      this.emit('engine:error', {
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }

    this.emit('cycle:end', { spawned, killed, transitioned } as CycleStats);
  }

  // ── Startup recovery ───────────────────────────────────────────────────────

  private _runStartupRecovery(): void {
    const session: SessionRecord = { id: this.cfg.sessionId, loop_status: 'running' };
    const plan = recoverStaleSession(session, this._queryActiveWorkers());

    for (const wid of plan.workersToKill) {
      this._killWorker(wid, null, 'startup: stale worker');
    }
    for (const tid of plan.tasksToRelease) {
      this._setTaskStatus(tid, 'CREATED');
    }
  }

  // ── Orphan guard (pre-exit) ────────────────────────────────────────────────

  private _runOrphanGuard(): void {
    for (const worker of this._queryActiveWorkers()) {
      if (!worker.task_id) {
        this._killWorker(worker.id, null, 'orphan guard: no task');
        continue;
      }
      const status = this._getTaskStatus(worker.task_id);
      if (status !== 'IN_PROGRESS') {
        this._killWorker(worker.id, worker.task_id, `orphan guard: task is ${status}`);
      }
    }
  }

  // ── DB helpers ─────────────────────────────────────────────────────────────

  private _queryActiveWorkers(): WorkerRecord[] {
    return this.db.prepare(`
      SELECT id, session_id, task_id, worker_type, label, status,
             pid, spawn_time, progress_json, tokens_json, cost_json
      FROM workers
      WHERE session_id = ? AND status = 'active'
    `).all(this.cfg.sessionId) as WorkerRecord[];
  }

  private _queryExitedWorkersNeedingReconciliation(): WorkerRecord[] {
    return this.db.prepare(`
      SELECT w.id, w.session_id, w.task_id, w.worker_type, w.label, w.status,
             w.pid, w.spawn_time, w.progress_json, w.tokens_json, w.cost_json
      FROM workers w
      JOIN tasks t ON w.task_id = t.id
      WHERE w.session_id = ?
        AND w.status IN ('completed', 'failed', 'killed')
        AND t.status = 'IN_PROGRESS'
    `).all(this.cfg.sessionId) as WorkerRecord[];
  }

  private _queryAllActiveTasks(): ResolverTask[] {
    // Include COMPLETE and CANCELLED tasks so the resolver can evaluate
    // dependency statuses (a CREATED task with a COMPLETE dep should be unblocked).
    return this.db.prepare(`
      SELECT id,
             status,
             COALESCE(priority, 'P2-Medium') AS priority,
             COALESCE(dependencies, '[]') AS dependencies
      FROM tasks
      WHERE status != 'ARCHIVE'
    `).all() as ResolverTask[];
  }

  private _getTaskComplexity(taskId: string): string {
    const row = this.db
      .prepare('SELECT complexity FROM tasks WHERE id = ?')
      .get(taskId) as { complexity: string | null } | undefined;
    return row?.complexity ?? 'Medium';
  }

  private _getTaskStatus(taskId: string): string {
    const row = this.db
      .prepare('SELECT status FROM tasks WHERE id = ?')
      .get(taskId) as { status: string } | undefined;
    return row?.status ?? 'UNKNOWN';
  }

  private _buildTaskMeta(taskId: string): TaskMeta {
    const row = this.db
      .prepare('SELECT model, type FROM tasks WHERE id = ?')
      .get(taskId) as { model: string | null; type: string | null } | undefined;
    return {
      type: row?.type ?? 'FEATURE',
      model: row?.model ?? undefined,
    };
  }

  private _getHandoff(taskId: string): Handoff | null {
    const row = this.db.prepare(`
      SELECT id, task_id, worker_type, files_changed, commits, decisions, risks, created_at
      FROM handoffs
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(taskId) as {
      id: number;
      task_id: string;
      worker_type: WorkerType;
      files_changed: string;
      commits: string;
      decisions: string;
      risks: string;
      created_at: string;
    } | undefined;

    if (!row) return null;

    try {
      return {
        id: row.id,
        task_id: row.task_id,
        worker_type: row.worker_type,
        files_changed: JSON.parse(row.files_changed) as Handoff['files_changed'],
        commits: JSON.parse(row.commits) as string[],
        decisions: JSON.parse(row.decisions) as string[],
        risks: JSON.parse(row.risks) as string[],
        created_at: row.created_at,
      };
    } catch {
      return null;
    }
  }

  /** Atomically claim: CREATED + unclaimed → IN_PROGRESS. Returns false if already taken. */
  private _claimTask(taskId: string): boolean {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE tasks
      SET status = 'IN_PROGRESS',
          session_claimed = ?,
          claimed_at = ?,
          updated_at = ?
      WHERE id = ?
        AND status = 'CREATED'
        AND session_claimed IS NULL
    `).run(this.cfg.sessionId, now, now, taskId);
    return result.changes > 0;
  }

  private _setTaskStatus(taskId: string, status: TaskStatus | string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE tasks SET status = ?, session_claimed = NULL, claimed_at = NULL, updated_at = ? WHERE id = ?')
      .run(status, now, taskId);
  }

  private _killWorker(workerId: string, taskId: string | null, reason: string): void {
    const row = this.db
      .prepare('SELECT pid FROM workers WHERE id = ?')
      .get(workerId) as { pid: number | null } | undefined;

    if (row?.pid !== null && row?.pid !== undefined) {
      try { killWorkerProcess(row.pid); } catch { /* process already gone */ }
    }

    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE workers SET status = 'killed', updated_at = ? WHERE id = ?")
      .run(now, workerId);

    this.emit('worker:killed', { workerId, taskId, reason });
  }
}

// ===========================================================================
// Part 2 — Prompt Builder (complexity-aware pipeline skip)
// ===========================================================================

/**
 * Original purpose of this file.
 * Provides complexity-aware worker prompt selection so that Simple tasks skip
 * the PM and Architect phases, reducing token cost by ~50%.
 *
 * Pipeline matrix:
 *  - Simple   → Team-Leader MODE 2 + Developer  (PM and Architect skipped)
 *  - Medium   → PM → Architect → Team-Leader + Developer
 *  - Complex  → PM → Architect → Team-Leader + Developer
 *
 * The full SupervisorEngine class (event loop, worker management) will be
 * added to this file by TASK_2026_338. This module is a standalone utility
 * that can be imported and tested independently.
 */

/** Worker types that receive a dynamically built prompt. */
export type PromptWorkerType = 'build' | 'prep' | 'implement' | 'review' | 'cleanup';

/** Context injected into every worker prompt. */
export interface PromptContext {
  taskId: string;
  workerId: string;
  sessionId: string;
  complexity: 'Simple' | 'Medium' | 'Complex' | string;
  priority: string;
  provider: string;
  model: string;
  retryCount: number;
  maxRetries: number;
  projectRoot: string;
}

/** Phases that a build worker will execute, derived from complexity. */
export interface BuildPipelineConfig {
  runPM: boolean;
  runArchitect: boolean;
  skippedPhases: string[];
}

/**
 * Returns the build pipeline configuration for a given complexity level.
 *
 * Simple tasks skip PM and Architect — they go directly to Team-Leader MODE 2
 * (tasks.md already exists from manual task creation) or the developer.
 * Medium and Complex tasks run the full PM → Architect → Team-Leader pipeline.
 */
export function getBuildPipelineConfig(complexity: string): BuildPipelineConfig {
  if (complexity === 'Simple') {
    return {
      runPM: false,
      runArchitect: false,
      skippedPhases: ['PM', 'Architect'],
    };
  }
  return {
    runPM: true,
    runArchitect: true,
    skippedPhases: [],
  };
}

/**
 * Build the orchestration instruction block for a Build Worker prompt.
 *
 * Returns the phase instruction paragraph that is injected into the
 * worker prompt template. For Simple tasks the PM and Architect instructions
 * are replaced with a direct jump to the dev loop.
 */
export function buildOrchestrationInstructions(complexity: string): string {
  const config = getBuildPipelineConfig(complexity);

  if (!config.runPM && !config.runArchitect) {
    return [
      '3. Run the orchestration flow: Team-Leader → Dev.',
      '   Phases SKIPPED for Simple complexity: PM, Architect.',
      '   The task description and plan are already defined in task.md.',
      '   Go directly to Team-Leader MODE 1 (if tasks.md is missing) or',
      '   MODE 2 (if tasks.md already exists with PENDING batches).',
      '   Complete ALL batches until tasks.md shows all tasks COMPLETE.',
    ].join('\n');
  }

  return [
    '3. Run the orchestration flow: PM -> Architect -> Team-Leader -> Dev.',
    '   Complete ALL batches until tasks.md shows all tasks COMPLETE.',
  ].join('\n');
}

/**
 * Build the phase telemetry annotation appended to each commit footer.
 *
 * Lists which phases were skipped so that cost analytics can attribute
 * savings to the complexity-aware skip logic.
 */
export function buildPhaseTelemetry(complexity: string): string {
  const config = getBuildPipelineConfig(complexity);
  if (config.skippedPhases.length === 0) return '';
  return `Skipped-Phases: ${config.skippedPhases.join(', ')}`;
}

/**
 * Render the full Build Worker prompt for the given context.
 *
 * This is the single entry point for prompt generation. It reads the
 * complexity from the context and injects the correct pipeline instructions.
 */
export function buildWorkerPrompt(ctx: PromptContext): string {
  const orchestrationInstructions = buildOrchestrationInstructions(ctx.complexity);
  const phaseTelemetry = buildPhaseTelemetry(ctx.complexity);
  const metaFooter = [
    `Task: ${ctx.taskId}`,
    `Agent: {agent-value}`,
    `Phase: implementation`,
    `Worker: build-worker`,
    `Session: ${ctx.sessionId}`,
    `Provider: ${ctx.provider}`,
    `Model: ${ctx.model}`,
    `Retry: ${ctx.retryCount}/${ctx.maxRetries}`,
    `Complexity: ${ctx.complexity}`,
    `Priority: ${ctx.priority}`,
    phaseTelemetry,
    `Generated-By: nitro-fueled v0.1.0 (https://github.com/itqanlab/nitro-fueled)`,
  ]
    .filter(Boolean)
    .join('\n');

  return `Run /orchestrate ${ctx.taskId}

BUILD WORKER — AUTONOMOUS MODE
WORKER_ID: ${ctx.workerId}

You are a Build Worker. Your job is to take this task from CREATED
through implementation. Follow these rules strictly:

1. FIRST: Write task-tracking/${ctx.taskId}/status with the single word
   IN_PROGRESS (no trailing newline). This signals the Supervisor that work has begun.

2. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. There is no human at this terminal.

${orchestrationInstructions}

4. After ALL development is complete (all batches COMPLETE in tasks.md):
   a. Write task-tracking/${ctx.taskId}/handoff.md — MANDATORY before committing
   b. Create a git commit with all implementation code AND handoff.md
   c. Write task-tracking/${ctx.taskId}/status with the single word IMPLEMENTED
   d. Commit the status file

5. Before developers write any code, they MUST read:
   - .claude/review-lessons/*.md (all lesson files)
   - .claude/anti-patterns.md

6. EXIT GATE — verify all tasks in tasks.md COMPLETE, handoff.md written, code committed.

7. You do NOT run reviews. You do NOT write completion-report.md. Stop after IMPLEMENTED.

## Commit Metadata (REQUIRED for all commits)

${metaFooter}

Working directory: ${ctx.projectRoot}
Task folder: task-tracking/${ctx.taskId}/`;
}
