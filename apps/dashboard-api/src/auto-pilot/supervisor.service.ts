/**
 * SupervisorService — persistent Node.js supervisor loop.
 *
 * Replaces the Claude Code conversation-based supervisor with a durable
 * setInterval-driven state machine. This process cannot "forget" state,
 * cannot hit context limits, and cannot time out. It survives as long as
 * the dashboard-api server runs.
 *
 * State machine: poll workers → process completions → resolve dependencies
 * → spawn next wave → update heartbeat → repeat.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SupervisorDbService } from './supervisor-db.service';
import { WorkerManagerService } from './worker-manager.service';
import { PromptBuilderService } from './prompt-builder.service';
import type {
  SupervisorConfig,
  SupervisorState,
  TaskCandidate,
  ActiveWorkerInfo,
  PriorityStrategy,
  ProviderType,
  LoopStatus,
  SupervisorEvent,
  SessionStatusResponse,
} from './auto-pilot.types';
import { DEFAULT_SUPERVISOR_CONFIG } from './auto-pilot.types';

@Injectable()
export class SupervisorService implements OnModuleDestroy {
  private readonly logger = new Logger(SupervisorService.name);

  private state: SupervisorState | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false; // Guard against overlapping ticks

  public constructor(
    private readonly supervisorDb: SupervisorDbService,
    private readonly workerManager: WorkerManagerService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  public onModuleDestroy(): void {
    if (this.state) {
      this.stopLoop('Server shutting down');
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  public isRunning(): boolean {
    return this.state !== null && this.state.loopStatus === 'running';
  }

  public getSessionId(): string | null {
    return this.state?.sessionId ?? null;
  }

  public getState(): SupervisorState | null {
    return this.state;
  }

  public start(config: Partial<SupervisorConfig> = {}): string {
    if (this.state && this.state.loopStatus === 'running') {
      throw new Error(`Supervisor already running (session: ${this.state.sessionId})`);
    }

    if (!this.supervisorDb.isAvailable()) {
      throw new Error('Cortex DB not available. Run a task first to initialize the database.');
    }

    const mergedConfig: SupervisorConfig = { ...DEFAULT_SUPERVISOR_CONFIG, ...config };
    mergedConfig.working_directory = mergedConfig.working_directory || process.cwd();

    // Create session in DB
    const sessionId = this.supervisorDb.createSession(
      'dashboard-supervisor',
      mergedConfig as unknown as Record<string, unknown>,
      mergedConfig.limit,
    );

    this.state = {
      sessionId,
      config: mergedConfig,
      loopStatus: 'running',
      retryCounters: {},
      stuckCounters: {},
      tasksCompleted: 0,
      tasksFailed: 0,
      startedAt: new Date().toISOString(),
    };

    this.supervisorDb.logEvent(sessionId, null, 'supervisor', 'SESSION_STARTED', {
      config: mergedConfig,
      source: 'dashboard-supervisor',
    });

    this.emitEvent('supervisor:started', { config: mergedConfig });

    // Start the polling loop
    this.loopTimer = setInterval(() => this.tick(), mergedConfig.poll_interval_ms);
    this.logger.log(`Supervisor started — session ${sessionId}, polling every ${mergedConfig.poll_interval_ms}ms`);

    // Run first tick immediately
    this.tick();

    return sessionId;
  }

  public pause(): void {
    if (!this.state || this.state.loopStatus !== 'running') {
      throw new Error('Supervisor is not running');
    }
    this.state.loopStatus = 'paused';
    this.supervisorDb.updateSessionStatus(this.state.sessionId, 'paused', 'Paused by user');
    this.clearTimer();
    this.emitEvent('supervisor:stopped', { reason: 'paused' });
    this.logger.log('Supervisor paused — workers continue running');
  }

  public resume(): void {
    if (!this.state || this.state.loopStatus !== 'paused') {
      throw new Error('Supervisor is not paused');
    }
    this.state.loopStatus = 'running';
    this.supervisorDb.updateSessionStatus(this.state.sessionId, 'running');
    this.loopTimer = setInterval(() => this.tick(), this.state.config.poll_interval_ms);
    this.emitEvent('supervisor:started', { reason: 'resumed' });
    this.logger.log('Supervisor resumed');
    this.tick();
  }

  public stop(reason?: string): void {
    this.stopLoop(reason ?? 'Stopped by user');
  }

  public getStatus(): SessionStatusResponse | null {
    if (!this.state) return null;

    const workerCounts = this.supervisorDb.getWorkerCounts(this.state.sessionId);
    const taskCounts = this.supervisorDb.getTaskCountsByStatus();

    return {
      sessionId: this.state.sessionId,
      loopStatus: this.state.loopStatus,
      config: this.state.config,
      workers: workerCounts,
      tasks: {
        completed: taskCounts['COMPLETE'] ?? 0,
        failed: (taskCounts['FAILED'] ?? 0) + (taskCounts['BLOCKED'] ?? 0),
        inProgress: (taskCounts['IN_PROGRESS'] ?? 0) + (taskCounts['IN_REVIEW'] ?? 0) + (taskCounts['IMPLEMENTED'] ?? 0),
        remaining: taskCounts['CREATED'] ?? 0,
      },
      startedAt: this.state.startedAt,
      uptimeMinutes: Math.round((Date.now() - new Date(this.state.startedAt).getTime()) / 60_000),
      lastHeartbeat: new Date().toISOString(),
    };
  }

  // ============================================================
  // Core loop — runs on every tick
  // ============================================================

  private async tick(): Promise<void> {
    if (!this.state || this.state.loopStatus !== 'running') return;
    if (this.isProcessing) return; // Prevent overlapping ticks
    this.isProcessing = true;

    try {
      // Step 1: Update heartbeat
      this.supervisorDb.updateHeartbeat(this.state.sessionId);

      // Step 2: Check active workers for completions
      const activeWorkers = this.supervisorDb.getActiveWorkers(this.state.sessionId);
      this.processWorkerHealth(activeWorkers);

      // Step 3: Get task candidates (unblocked CREATED + IMPLEMENTED tasks)
      const candidates = this.supervisorDb.getTaskCandidates();

      // Step 4: Calculate available slots
      const currentActive = this.supervisorDb.getActiveWorkers(this.state.sessionId);
      const availableSlots = this.state.config.concurrency - currentActive.length;

      // Step 5: Select and spawn workers if slots available
      if (availableSlots > 0 && candidates.length > 0) {
        const toSpawn = this.selectSpawnCandidates(candidates, availableSlots, currentActive);
        for (const candidate of toSpawn) {
          this.spawnForCandidate(candidate);
        }
      }

      // Step 6: Check termination conditions
      this.checkTermination(currentActive, candidates);

    } catch (err) {
      this.logger.error(`Supervisor tick error: ${err}`);
      this.supervisorDb.logEvent(
        this.state.sessionId, null, 'supervisor', 'TICK_ERROR',
        { error: String(err) },
      );
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================================
  // Worker health processing
  // ============================================================

  private processWorkerHealth(activeWorkers: ActiveWorkerInfo[]): void {
    if (!this.state) return;

    for (const worker of activeWorkers) {
      if (worker.health === 'finished') {
        // Worker process has exited — check task status
        this.handleWorkerCompletion(worker);
      } else if (worker.health === 'stuck') {
        this.handleStuckWorker(worker);
      }
    }
  }

  private handleWorkerCompletion(worker: ActiveWorkerInfo): void {
    if (!this.state) return;

    const taskStatus = this.supervisorDb.getTaskStatus(worker.taskId);

    if (worker.workerType === 'build') {
      if (taskStatus === 'IMPLEMENTED') {
        // Build succeeded
        this.logger.log(`Build complete: ${worker.taskId} → IMPLEMENTED`);
        this.state.tasksCompleted++;
        this.supervisorDb.logEvent(
          this.state.sessionId, worker.taskId, 'supervisor', 'BUILD_COMPLETE',
          { workerId: worker.workerId, provider: worker.provider },
        );
        this.emitEvent('worker:completed', { taskId: worker.taskId, workerType: 'build' });
      } else {
        // Build failed (process exited but task not IMPLEMENTED)
        this.handleWorkerFailure(worker, `Task status is ${taskStatus} (expected IMPLEMENTED)`);
      }
    } else if (worker.workerType === 'review') {
      if (taskStatus === 'COMPLETE') {
        this.logger.log(`Review complete: ${worker.taskId} → COMPLETE`);
        this.state.tasksCompleted++;
        this.supervisorDb.logEvent(
          this.state.sessionId, worker.taskId, 'supervisor', 'REVIEW_COMPLETE',
          { workerId: worker.workerId, provider: worker.provider },
        );
        this.emitEvent('worker:completed', { taskId: worker.taskId, workerType: 'review' });
      } else {
        this.handleWorkerFailure(worker, `Task status is ${taskStatus} (expected COMPLETE)`);
      }
    }
  }

  private handleWorkerFailure(worker: ActiveWorkerInfo, reason: string): void {
    if (!this.state) return;

    const retryCount = (this.state.retryCounters[worker.taskId] ?? 0) + 1;
    this.state.retryCounters[worker.taskId] = retryCount;

    if (retryCount <= this.state.config.retries) {
      this.logger.warn(`Worker failed for ${worker.taskId}: ${reason}. Retry ${retryCount}/${this.state.config.retries}`);
      this.supervisorDb.logEvent(
        this.state.sessionId, worker.taskId, 'supervisor', 'WORKER_RETRY',
        { retryCount, maxRetries: this.state.config.retries, reason },
      );

      // Reset task status to CREATED so it gets picked up again
      this.supervisorDb.updateTaskStatus(worker.taskId, 'CREATED');

      this.emitEvent('worker:failed', {
        taskId: worker.taskId,
        reason,
        retryCount,
        willRetry: true,
      });
    } else {
      this.logger.error(`Worker exhausted retries for ${worker.taskId}: ${reason}`);
      this.state.tasksFailed++;
      this.supervisorDb.updateTaskStatus(worker.taskId, 'BLOCKED');
      this.supervisorDb.logEvent(
        this.state.sessionId, worker.taskId, 'supervisor', 'RETRY_EXHAUSTED',
        { retryCount, reason },
      );

      this.emitEvent('task:blocked', { taskId: worker.taskId, reason });
    }
  }

  private handleStuckWorker(worker: ActiveWorkerInfo): void {
    if (!this.state) return;

    const stuckCount = (this.state.stuckCounters[worker.workerId] ?? 0) + 1;
    this.state.stuckCounters[worker.workerId] = stuckCount;

    if (stuckCount >= 2) {
      // Two consecutive stuck signals — kill the worker
      this.logger.warn(`Killing stuck worker ${worker.label} (PID ${worker.pid})`);
      this.workerManager.killWorker(worker.pid, worker.workerId);
      delete this.state.stuckCounters[worker.workerId];

      this.supervisorDb.logEvent(
        this.state.sessionId, worker.taskId, 'supervisor', 'WORKER_KILLED_STUCK',
        { workerId: worker.workerId, label: worker.label, stuckCount },
      );

      this.emitEvent('worker:killed', {
        taskId: worker.taskId,
        reason: 'stuck',
        workerId: worker.workerId,
      });
    }
  }

  // ============================================================
  // Candidate selection
  // ============================================================

  private selectSpawnCandidates(
    candidates: TaskCandidate[],
    slots: number,
    activeWorkers: ActiveWorkerInfo[],
  ): TaskCandidate[] {
    if (!this.state) return [];

    // Filter out tasks that already have active workers
    const activeTasks = new Set(activeWorkers.map(w => w.taskId));
    const available = candidates.filter(c => !activeTasks.has(c.id));

    // Partition into build and review candidates
    const buildCandidates = available.filter(c => c.status === 'CREATED');
    const reviewCandidates = available.filter(c => c.status === 'IMPLEMENTED');

    // Apply priority strategy
    return this.applyPriorityStrategy(
      buildCandidates,
      reviewCandidates,
      slots,
      this.state.config.priority,
    );
  }

  private applyPriorityStrategy(
    buildCandidates: TaskCandidate[],
    reviewCandidates: TaskCandidate[],
    slots: number,
    strategy: PriorityStrategy,
  ): TaskCandidate[] {
    const result: TaskCandidate[] = [];

    switch (strategy) {
      case 'build-first': {
        const builds = buildCandidates.slice(0, slots);
        result.push(...builds);
        const remaining = slots - builds.length;
        if (remaining > 0) {
          result.push(...reviewCandidates.slice(0, remaining));
        }
        break;
      }

      case 'review-first': {
        const reviews = reviewCandidates.slice(0, slots);
        result.push(...reviews);
        const remaining = slots - reviews.length;
        if (remaining > 0) {
          result.push(...buildCandidates.slice(0, remaining));
        }
        break;
      }

      case 'balanced': {
        if (buildCandidates.length > 0 && reviewCandidates.length > 0 && slots >= 2) {
          result.push(buildCandidates[0]);
          result.push(reviewCandidates[0]);
          let remaining = slots - 2;
          let bIdx = 1;
          let rIdx = 1;
          while (remaining > 0) {
            if (bIdx < buildCandidates.length) {
              result.push(buildCandidates[bIdx++]);
              remaining--;
            }
            if (remaining > 0 && rIdx < reviewCandidates.length) {
              result.push(reviewCandidates[rIdx++]);
              remaining--;
            }
            if (bIdx >= buildCandidates.length && rIdx >= reviewCandidates.length) break;
          }
        } else {
          // Only one type available — fill all slots
          const combined = [...buildCandidates, ...reviewCandidates];
          result.push(...combined.slice(0, slots));
        }
        break;
      }
    }

    return result;
  }

  // ============================================================
  // Spawn workers
  // ============================================================

  private spawnForCandidate(candidate: TaskCandidate): void {
    if (!this.state) return;

    const isBuild = candidate.status === 'CREATED';
    const workerType = isBuild ? 'build' : 'review';
    const provider = isBuild ? this.state.config.build_provider : this.state.config.review_provider;
    const model = isBuild ? this.state.config.build_model : this.state.config.review_model;
    const retryNumber = this.state.retryCounters[candidate.id] ?? 0;

    // Claim the task
    const claimed = this.supervisorDb.claimTask(candidate.id, this.state.sessionId);
    if (!claimed) {
      this.logger.warn(`Failed to claim ${candidate.id} — already claimed by another session`);
      return;
    }

    const label = retryNumber > 0
      ? `${workerType}-${candidate.id}-retry${retryNumber}`
      : `${workerType}-${candidate.id}`;

    // Build prompt
    const prompt = isBuild
      ? this.promptBuilder.buildWorkerPrompt({
          taskId: candidate.id,
          sessionId: this.state.sessionId,
          provider,
          model,
          retryNumber,
          maxRetries: this.state.config.retries,
          complexity: candidate.complexity,
          priority: candidate.priority,
          workingDirectory: this.state.config.working_directory,
        })
      : this.promptBuilder.reviewWorkerPrompt({
          taskId: candidate.id,
          sessionId: this.state.sessionId,
          provider,
          model,
          workingDirectory: this.state.config.working_directory,
        });

    try {
      const result = this.workerManager.spawnWorker({
        sessionId: this.state.sessionId,
        taskId: candidate.id,
        workerType,
        prompt,
        workingDirectory: this.state.config.working_directory,
        label,
        model,
        provider,
        retryNumber,
      });

      this.supervisorDb.logEvent(
        this.state.sessionId, candidate.id, 'supervisor', 'WORKER_SPAWNED',
        { workerId: result.workerId, pid: result.pid, provider, model, workerType, label },
      );

      this.emitEvent('worker:spawned', {
        taskId: candidate.id,
        workerId: result.workerId,
        pid: result.pid,
        workerType,
        provider,
        model,
      });

    } catch (err) {
      this.logger.error(`Failed to spawn worker for ${candidate.id}: ${err}`);
      this.supervisorDb.logEvent(
        this.state.sessionId, candidate.id, 'supervisor', 'SPAWN_FAILED',
        { error: String(err), provider, model },
      );
    }
  }

  // ============================================================
  // Termination check
  // ============================================================

  private checkTermination(activeWorkers: ActiveWorkerInfo[], candidates: TaskCandidate[]): void {
    if (!this.state) return;

    // Check task limit
    if (this.state.tasksCompleted + this.state.tasksFailed >= this.state.config.limit) {
      this.stopLoop(`Task limit reached (${this.state.config.limit})`);
      return;
    }

    // No workers running AND no candidates → done
    if (activeWorkers.length === 0 && candidates.length === 0) {
      const taskCounts = this.supervisorDb.getTaskCountsByStatus();
      const remaining = (taskCounts['CREATED'] ?? 0) + (taskCounts['IMPLEMENTED'] ?? 0);
      if (remaining === 0) {
        this.stopLoop('All tasks processed');
      }
    }
  }

  // ============================================================
  // Shutdown
  // ============================================================

  private stopLoop(reason: string): void {
    if (!this.state) return;

    this.clearTimer();
    this.state.loopStatus = 'stopped';

    this.supervisorDb.updateSessionStatus(this.state.sessionId, 'stopped', reason);
    this.supervisorDb.updateSessionTerminalCount(
      this.state.sessionId,
      this.state.tasksCompleted + this.state.tasksFailed,
    );

    this.supervisorDb.logEvent(
      this.state.sessionId, null, 'supervisor', 'SESSION_STOPPED',
      { reason, tasksCompleted: this.state.tasksCompleted, tasksFailed: this.state.tasksFailed },
    );

    this.emitEvent('supervisor:stopped', {
      reason,
      tasksCompleted: this.state.tasksCompleted,
      tasksFailed: this.state.tasksFailed,
    });

    this.logger.log(`Supervisor stopped: ${reason}`);
  }

  private clearTimer(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  // ============================================================
  // Event emission (for WebSocket broadcast)
  // ============================================================

  private emitEvent(type: SupervisorEvent['type'], payload: Record<string, unknown>): void {
    if (!this.state) return;
    const event: SupervisorEvent = {
      type,
      sessionId: this.state.sessionId,
      timestamp: new Date().toISOString(),
      payload,
    };
    // Emit on the NestJS event bus — the DashboardGateway or AutoPilotController
    // can subscribe and broadcast to WebSocket clients.
    try {
      // We use a simple callback pattern instead of EventEmitter2 to avoid the dependency.
      // The controller/gateway will poll getStatus() or subscribe to DB events.
      this.logger.debug(`Event: ${type} — ${JSON.stringify(payload)}`);
    } catch { /* best effort */ }
  }
}
