/**
 * SessionRunner — one instance per supervisor session.
 *
 * Plain class (not @Injectable). Holds all per-session state and runs
 * the supervisor tick loop. Shared NestJS services are passed via
 * constructor by SessionManagerService.
 */
import { Logger } from '@nestjs/common';
import { SupervisorDbService } from './supervisor-db.service';
import { WorkerManagerService } from './worker-manager.service';
import { PromptBuilderService } from './prompt-builder.service';
import type {
  SupervisorConfig,
  TaskCandidate,
  ActiveWorkerInfo,
  PriorityStrategy,
  ProviderType,
  LoopStatus,
  SupervisorEvent,
  SessionStatusResponse,
  UpdateConfigRequest,
  CustomFlow,
} from './auto-pilot.types';

export class SessionRunner {
  private readonly logger: Logger;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private loopStatus: LoopStatus = 'running';
  private retryCounters: Record<string, number> = {};
  private stuckCounters: Record<string, number> = {};
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private readonly startedAt: string = new Date().toISOString();
  private readonly onStopped?: (sessionId: string) => void;
  private readonly onEvent?: (event: SupervisorEvent) => void;

  public constructor(
    public readonly sessionId: string,
    private config: SupervisorConfig,
    private readonly supervisorDb: SupervisorDbService,
    private readonly workerManager: WorkerManagerService,
    private readonly promptBuilder: PromptBuilderService,
    onStopped?: (sessionId: string) => void,
    onEvent?: (event: SupervisorEvent) => void,
  ) {
    this.logger = new Logger(`SessionRunner[${sessionId}]`);
    this.onStopped = onStopped;
    this.onEvent = onEvent;
  }

  // ============================================================
  // Public API
  // ============================================================

  public start(): void {
    this.supervisorDb.logEvent(this.sessionId, null, 'supervisor', 'SESSION_STARTED', {
      config: this.config,
      source: 'dashboard-supervisor',
    });

    this.emitEvent('supervisor:started', { config: this.config });

    this.loopTimer = setInterval(() => this.tick(), this.config.poll_interval_ms);
    this.logger.log(`Session started — polling every ${this.config.poll_interval_ms}ms`);

    this.tick();
  }

  public pause(): void {
    if (this.loopStatus !== 'running') {
      throw new Error(`Session ${this.sessionId} is not running (status: ${this.loopStatus})`);
    }
    this.loopStatus = 'paused';
    this.supervisorDb.updateSessionStatus(this.sessionId, 'paused', 'Paused by user');
    this.clearTimer();
    this.emitEvent('supervisor:paused', {});
    this.logger.log('Session paused — workers continue running');
  }

  public resume(): void {
    if (this.loopStatus !== 'paused') {
      throw new Error(`Session ${this.sessionId} is not paused (status: ${this.loopStatus})`);
    }
    this.loopStatus = 'running';
    this.supervisorDb.updateSessionStatus(this.sessionId, 'running');
    this.loopTimer = setInterval(() => this.tick(), this.config.poll_interval_ms);
    this.emitEvent('supervisor:resumed', {});
    this.logger.log('Session resumed');
    this.tick();
  }

  public stop(reason?: string): void {
    this.stopLoop(reason ?? 'Stopped by user');
  }

  public updateConfig(patch: UpdateConfigRequest): void {
    const oldPollInterval = this.config.poll_interval_ms;
    Object.assign(this.config, patch);

    if (
      patch.poll_interval_ms !== undefined
      && patch.poll_interval_ms !== oldPollInterval
      && this.loopStatus === 'running'
    ) {
      this.clearTimer();
      this.loopTimer = setInterval(() => this.tick(), this.config.poll_interval_ms);
      this.logger.log(`Poll interval changed to ${this.config.poll_interval_ms}ms`);
    }
  }

  public getStatus(): SessionStatusResponse {
    const workerCounts = this.supervisorDb.getWorkerCounts(this.sessionId);
    const taskCounts = this.supervisorDb.getTaskCountsByStatus();

    return {
      sessionId: this.sessionId,
      loopStatus: this.loopStatus,
      config: this.config,
      workers: workerCounts,
      tasks: {
        completed: taskCounts['COMPLETE'] ?? 0,
        failed: (taskCounts['FAILED'] ?? 0) + (taskCounts['BLOCKED'] ?? 0),
        inProgress: (taskCounts['IN_PROGRESS'] ?? 0) + (taskCounts['IN_REVIEW'] ?? 0) + (taskCounts['IMPLEMENTED'] ?? 0),
        remaining: taskCounts['CREATED'] ?? 0,
      },
      startedAt: this.startedAt,
      uptimeMinutes: Math.round((Date.now() - new Date(this.startedAt).getTime()) / 60_000),
      lastHeartbeat: new Date().toISOString(),
      drainRequested: this.supervisorDb.getDrainRequested(this.sessionId),
    };
  }

  public getLoopStatus(): LoopStatus {
    return this.loopStatus;
  }

  public getConfig(): SupervisorConfig {
    return this.config;
  }

  // ============================================================
  // Core loop
  // ============================================================

  private async tick(): Promise<void> {
    if (this.loopStatus !== 'running') return;
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.supervisorDb.updateHeartbeat(this.sessionId);
      this.emitEvent('supervisor:heartbeat', { loopStatus: this.loopStatus });

      const activeWorkers = this.supervisorDb.getActiveWorkers(this.sessionId);
      this.processWorkerHealth(activeWorkers);

      if (this.supervisorDb.getDrainRequested(this.sessionId)) {
        const drainActive = this.supervisorDb.getActiveWorkers(this.sessionId);
        if (drainActive.length === 0) {
          this.stopLoop('Drained by user');
        }
        return;
      }

      const candidates = this.supervisorDb.getTaskCandidates();

      const currentActive = this.supervisorDb.getActiveWorkers(this.sessionId);
      const availableSlots = this.config.concurrency - currentActive.length;

      if (availableSlots > 0 && candidates.length > 0) {
        const toSpawn = this.selectSpawnCandidates(candidates, availableSlots, currentActive);
        for (const candidate of toSpawn) {
          this.spawnForCandidate(candidate);
        }
      }

      this.checkTermination(currentActive, candidates);
    } catch (err) {
      this.logger.error(`Tick error: ${err}`);
      this.supervisorDb.logEvent(
        this.sessionId, null, 'supervisor', 'TICK_ERROR',
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
    for (const worker of activeWorkers) {
      if (worker.health === 'finished') {
        this.handleWorkerCompletion(worker);
      } else if (worker.health === 'stuck') {
        this.handleStuckWorker(worker);
      }
    }
  }

  private static isSubtaskId(taskId: string): boolean {
    return /^TASK_\d{4}_\d{3}\.\d+$/.test(taskId);
  }

  private handleSubtaskParentRollup(subtaskId: string): void {
    const parentId = subtaskId.substring(0, subtaskId.lastIndexOf('.'));
    const rollup = this.supervisorDb.getParentStatusRollup(parentId);

    if (rollup.allImplemented) {
      // All subtasks have finished building — promote parent to IMPLEMENTED for holistic review
      this.logger.log(`All subtasks implemented for ${parentId} — promoting to IMPLEMENTED`);
      this.supervisorDb.updateTaskStatus(parentId, 'IMPLEMENTED');
      this.supervisorDb.logEvent(
        this.sessionId, parentId, 'supervisor', 'PARENT_AUTO_PROMOTED',
        { subtaskId, newStatus: 'IMPLEMENTED' },
      );
      this.emitEvent('task:subtask-parent-promoted', {
        parentId,
        subtaskId,
        newStatus: 'IMPLEMENTED',
      });
    } else if (rollup.anyFailed) {
      this.logger.warn(`Subtask ${subtaskId} failed — blocking parent ${parentId}`);
      this.supervisorDb.updateTaskStatus(parentId, 'BLOCKED');
      this.supervisorDb.logEvent(
        this.sessionId, parentId, 'supervisor', 'PARENT_BLOCKED_BY_SUBTASK',
        { subtaskId },
      );
      this.emitEvent('task:blocked', {
        taskId: parentId,
        reason: `subtask ${subtaskId} exhausted retries`,
      });
    }
  }

  private handleWorkerCompletion(worker: ActiveWorkerInfo): void {
    const taskStatus = this.supervisorDb.getTaskStatus(worker.taskId);

    if (worker.workerType === 'build') {
      if (taskStatus === 'IMPLEMENTED') {
        this.logger.log(`Build complete: ${worker.taskId} -> IMPLEMENTED`);
        this.tasksCompleted++;
        this.supervisorDb.logEvent(
          this.sessionId, worker.taskId, 'supervisor', 'BUILD_COMPLETE',
          { workerId: worker.workerId, provider: worker.provider },
        );
        this.emitEvent('worker:completed', { taskId: worker.taskId, workerType: 'build' });

        // Subtask: after build completes, check if all siblings are IMPLEMENTED
        // → promote parent to IMPLEMENTED for holistic review
        if (SessionRunner.isSubtaskId(worker.taskId)) {
          this.handleSubtaskParentRollup(worker.taskId);
        }
      } else {
        this.handleWorkerFailure(worker, `Task status is ${taskStatus} (expected IMPLEMENTED)`);
      }
    } else if (worker.workerType === 'review') {
      if (taskStatus === 'COMPLETE') {
        this.logger.log(`Review complete: ${worker.taskId} -> COMPLETE`);
        this.tasksCompleted++;
        this.supervisorDb.logEvent(
          this.sessionId, worker.taskId, 'supervisor', 'REVIEW_COMPLETE',
          { workerId: worker.workerId, provider: worker.provider },
        );
        this.supervisorDb.updateWorkerReviewOutcome(worker.workerId, 'COMPLETE', 0);
        this.emitEvent('worker:completed', { taskId: worker.taskId, workerType: 'review' });
        this.emitEvent('task:completed', { taskId: worker.taskId });
        // Note: subtask parent promotion is triggered from the build branch (when all subtasks
        // reach IMPLEMENTED). Subtasks do not get individual review workers.
      } else {
        this.handleWorkerFailure(worker, `Task status is ${taskStatus} (expected COMPLETE)`);
      }
    }
  }

  private handleWorkerFailure(worker: ActiveWorkerInfo, reason: string): void {
    const retryCount = (this.retryCounters[worker.taskId] ?? 0) + 1;
    this.retryCounters[worker.taskId] = retryCount;

    if (retryCount <= this.config.retries) {
      this.logger.warn(
        `Worker failed for ${worker.taskId}: ${reason}. Retry ${retryCount}/${this.config.retries}`,
      );
      this.supervisorDb.logEvent(
        this.sessionId, worker.taskId, 'supervisor', 'WORKER_RETRY',
        { retryCount, maxRetries: this.config.retries, reason },
      );
      this.supervisorDb.updateTaskStatus(worker.taskId, 'CREATED');
      this.emitEvent('worker:failed', {
        taskId: worker.taskId,
        reason,
        retryCount,
        willRetry: true,
      });
    } else {
      this.logger.error(`Worker exhausted retries for ${worker.taskId}: ${reason}`);
      this.tasksFailed++;
      this.supervisorDb.updateTaskStatus(worker.taskId, 'BLOCKED');
      this.supervisorDb.logEvent(
        this.sessionId, worker.taskId, 'supervisor', 'RETRY_EXHAUSTED',
        { retryCount, reason },
      );
      this.emitEvent('task:failed', { taskId: worker.taskId, reason, retryCount });
      this.emitEvent('task:blocked', { taskId: worker.taskId, reason });

      // Subtask: propagate terminal failure to parent
      if (SessionRunner.isSubtaskId(worker.taskId)) {
        this.handleSubtaskParentRollup(worker.taskId);
      }
    }
  }

  private handleStuckWorker(worker: ActiveWorkerInfo): void {
    const stuckCount = (this.stuckCounters[worker.workerId] ?? 0) + 1;
    this.stuckCounters[worker.workerId] = stuckCount;

    if (stuckCount >= 2) {
      this.logger.warn(`Killing stuck worker ${worker.label} (PID ${worker.pid})`);
      this.workerManager.killWorker(worker.pid, worker.workerId);
      delete this.stuckCounters[worker.workerId];

      this.supervisorDb.logEvent(
        this.sessionId, worker.taskId, 'supervisor', 'WORKER_KILLED_STUCK',
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
    const activeTasks = new Set(activeWorkers.map(w => w.taskId));
    const available = candidates.filter(c => !activeTasks.has(c.id));

    const buildCandidates = available.filter(c => c.status === 'CREATED' || c.status === 'PREPPED');
    // Subtasks (TASK_YYYY_NNN.M) never get individual review workers — only the parent is reviewed
    // holistically after all subtasks reach IMPLEMENTED.
    const reviewCandidates = available.filter(
      c => c.status === 'IMPLEMENTED' && !SessionRunner.isSubtaskId(c.id),
    );

    return this.applyPriorityStrategy(buildCandidates, reviewCandidates, slots, this.config.priority);
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

  /**
   * Resolve provider + model for a subtask in the implement (PREPPED) phase.
   *
   * Routing rules (in precedence order):
   *  1. Explicit `model` field on the subtask — use that, provider: claude
   *  2. Subtask's own complexity — Simple→Haiku, Medium→Sonnet, Complex→Opus
   *  3. If subtask has no explicit complexity, inherit from parent task
   */
  private resolveSubtaskImplementModel(candidate: TaskCandidate): { provider: ProviderType; model: string } {
    // Rule 1: explicit model override
    if (candidate.model) {
      return { provider: 'claude', model: candidate.model };
    }

    // Determine effective complexity: subtask's own (if set) or parent's
    let complexity = candidate.rawComplexity;
    if (!complexity && candidate.parentTaskId) {
      complexity = this.supervisorDb.getTaskComplexity(candidate.parentTaskId);
    }
    // Final fallback if neither subtask nor parent has complexity
    complexity = complexity ?? 'Medium';

    // Rule 2 / 3: map complexity to model
    switch (complexity) {
      case 'Simple':
        return { provider: 'claude', model: 'claude-haiku-4-5-20251001' };
      case 'Complex':
        return { provider: 'claude', model: 'claude-opus-4-6' };
      default:
        // Medium (and any unknown value) → Sonnet
        return { provider: 'claude', model: 'claude-sonnet-4-6' };
    }
  }

  private spawnForCandidate(candidate: TaskCandidate): void {
    const isBuild = candidate.status === 'CREATED' || candidate.status === 'PREPPED';
    const workerType = isBuild ? 'build' : 'review';
    const retryNumber = this.retryCounters[candidate.id] ?? 0;

    // NOTE: config.supervisor_model is not yet used for spawning — it is reserved
    // for a future mode where the supervisor itself runs as a Claude worker.

    // 3-phase routing: CREATED → prep, PREPPED → implement, IMPLEMENTED → review
    let provider: ProviderType;
    let model: string;
    if (candidate.status === 'CREATED') {
      provider = this.config.prep_provider;
      model = this.config.prep_model;
    } else if (candidate.status === 'PREPPED') {
      if (candidate.parentTaskId !== null) {
        // Subtask implement phase: route by the subtask's own complexity (or explicit model).
        // Subtasks are always run with Claude (not GLM) since they are already small units.
        const resolved = this.resolveSubtaskImplementModel(candidate);
        provider = resolved.provider;
        model = resolved.model;
      } else if (retryNumber > 0) {
        // Top-level task: use fallback on retries (GLM failed, switch to claude)
        provider = this.config.implement_fallback_provider;
        model = this.config.implement_fallback_model;
      } else {
        provider = this.config.implement_provider;
        model = this.config.implement_model;
      }
    } else {
      provider = this.config.review_provider;
      model = this.config.review_model;
    }

    // Resolve custom flow for build workers (review workers follow fixed review logic)
    let customFlow: CustomFlow | null = null;
    if (isBuild && candidate.customFlowId) {
      customFlow = this.supervisorDb.getCustomFlow(candidate.customFlowId);
      if (customFlow && customFlow.steps.length === 0) {
        this.logger.warn(`Custom flow ${customFlow.id} has no steps for ${candidate.id} — using built-in flow`);
        this.supervisorDb.logEvent(
          this.sessionId, candidate.id, 'supervisor', 'CUSTOM_FLOW_FALLBACK',
          { flowId: customFlow.id, reason: 'flow has zero steps' },
        );
        customFlow = null;
      }
      if (customFlow) {
        const safeName = customFlow.name.replace(/[\r\n]/g, ' ').slice(0, 80);
        this.logger.log(`Custom flow '${safeName}' (${customFlow.id}) assigned to ${candidate.id}`);
        this.supervisorDb.logEvent(
          this.sessionId, candidate.id, 'supervisor', 'CUSTOM_FLOW_APPLIED',
          { flowId: customFlow.id, flowName: safeName, stepCount: customFlow.steps.length },
        );
      } else {
        this.logger.warn(`Custom flow ${candidate.customFlowId} not found for ${candidate.id} — using built-in flow`);
        this.supervisorDb.logEvent(
          this.sessionId, candidate.id, 'supervisor', 'CUSTOM_FLOW_FALLBACK',
          { flowId: candidate.customFlowId, reason: 'flow not found in DB' },
        );
      }
    }

    const claimed = this.supervisorDb.claimTask(candidate.id, this.sessionId);
    if (!claimed) {
      this.logger.warn(`Failed to claim ${candidate.id} — already claimed by another session`);
      return;
    }
    this.emitEvent('task:claimed', { taskId: candidate.id, workerType });

    const label = retryNumber > 0
      ? `${workerType}-${candidate.id}-retry${retryNumber}`
      : `${workerType}-${candidate.id}`;

    const prompt = isBuild
      ? this.promptBuilder.buildWorkerPrompt({
          taskId: candidate.id,
          sessionId: this.sessionId,
          provider,
          model,
          retryNumber,
          maxRetries: this.config.retries,
          complexity: candidate.complexity,
          priority: candidate.priority,
          workingDirectory: this.config.working_directory,
          customFlow,
        })
      : this.promptBuilder.reviewWorkerPrompt({
          taskId: candidate.id,
          sessionId: this.sessionId,
          provider,
          model,
          workingDirectory: this.config.working_directory,
        });

    const workflowPhase = isBuild ? 'implementation' : 'review';

    try {
      const result = this.workerManager.spawnWorker({
        sessionId: this.sessionId,
        taskId: candidate.id,
        workerType,
        prompt,
        workingDirectory: this.config.working_directory,
        label,
        model,
        provider,
        retryNumber,
        workflowPhase,
      });

      this.supervisorDb.logEvent(
        this.sessionId, candidate.id, 'supervisor', 'WORKER_SPAWNED',
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
        this.sessionId, candidate.id, 'supervisor', 'SPAWN_FAILED',
        { error: String(err), provider, model },
      );
    }
  }

  // ============================================================
  // Termination check
  // ============================================================

  private checkTermination(activeWorkers: ActiveWorkerInfo[], candidates: TaskCandidate[]): void {
    if (this.tasksCompleted + this.tasksFailed >= this.config.limit) {
      this.stopLoop(`Task limit reached (${this.config.limit})`);
      return;
    }

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
    this.clearTimer();
    this.loopStatus = 'stopped';

    this.supervisorDb.updateSessionStatus(this.sessionId, 'stopped', reason);
    this.supervisorDb.updateSessionTerminalCount(
      this.sessionId,
      this.tasksCompleted + this.tasksFailed,
    );

    this.supervisorDb.logEvent(
      this.sessionId, null, 'supervisor', 'SESSION_STOPPED',
      { reason, tasksCompleted: this.tasksCompleted, tasksFailed: this.tasksFailed },
    );
    this.emitEvent('supervisor:stopped', {
      reason,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
    });

    this.logger.log(`Session stopped: ${reason}`);

    // Notify manager so self-terminated sessions are removed from the Map
    this.onStopped?.(this.sessionId);
  }

  private clearTimer(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  // ============================================================
  // Event emission
  // ============================================================

  private emitEvent(type: SupervisorEvent['type'], payload: Record<string, unknown>): void {
    const event: SupervisorEvent = {
      type,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      payload,
    };
    try {
      this.logger.debug(`Event: ${event.type} — ${JSON.stringify(payload)}`);
      // onEvent is inside try/catch so gateway errors do not propagate to callers
      this.onEvent?.(event);
    } catch { /* best effort */ }
  }
}
