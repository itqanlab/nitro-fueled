/**
 * SessionManagerService — NestJS singleton that manages SessionRunner instances.
 *
 * Creates, tracks, and destroys per-session runners. Shared services
 * (SupervisorDbService, WorkerManagerService, PromptBuilderService) are
 * injected once and passed to each SessionRunner via constructor.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SupervisorDbService } from './supervisor-db.service';
import { WorkerManagerService } from './worker-manager.service';
import { PromptBuilderService } from './prompt-builder.service';
import { SessionRunner } from './session-runner';
import type {
  SupervisorConfig,
  SessionStatusResponse,
  UpdateConfigRequest,
} from './auto-pilot.types';
import { DEFAULT_SUPERVISOR_CONFIG } from './auto-pilot.types';

@Injectable()
export class SessionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly runners = new Map<string, SessionRunner>();

  public constructor(
    private readonly supervisorDb: SupervisorDbService,
    private readonly workerManager: WorkerManagerService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  public onModuleDestroy(): void {
    for (const [id, runner] of this.runners) {
      this.logger.log(`Stopping session ${id} — server shutting down`);
      runner.stop('Server shutting down');
    }
    this.runners.clear();
  }

  // ============================================================
  // Session lifecycle
  // ============================================================

  public createSession(config: Partial<SupervisorConfig> = {}): string {
    if (!this.supervisorDb.isAvailable()) {
      throw new Error('Cortex DB not available. Run a task first to initialize the database.');
    }

    const mergedConfig: SupervisorConfig = { ...DEFAULT_SUPERVISOR_CONFIG, ...config };
    mergedConfig.working_directory = mergedConfig.working_directory || process.cwd();

    const sessionId = this.supervisorDb.createSession(
      'dashboard-supervisor',
      mergedConfig as unknown as Record<string, unknown>,
      mergedConfig.limit,
    );

    const runner = new SessionRunner(
      sessionId,
      mergedConfig,
      this.supervisorDb,
      this.workerManager,
      this.promptBuilder,
    );

    runner.start();
    this.runners.set(sessionId, runner);
    this.logger.log(`Created session ${sessionId}`);

    return sessionId;
  }

  public stopSession(sessionId: string): boolean {
    const runner = this.runners.get(sessionId);
    if (!runner) return false;

    runner.stop();
    this.runners.delete(sessionId);
    return true;
  }

  public pauseSession(sessionId: string): boolean {
    const runner = this.runners.get(sessionId);
    if (!runner) return false;

    runner.pause();
    return true;
  }

  public resumeSession(sessionId: string): boolean {
    const runner = this.runners.get(sessionId);
    if (!runner) return false;

    runner.resume();
    return true;
  }

  public updateSessionConfig(sessionId: string, patch: UpdateConfigRequest): boolean {
    const runner = this.runners.get(sessionId);
    if (!runner) return false;

    runner.updateConfig(patch);
    return true;
  }

  // ============================================================
  // Query methods
  // ============================================================

  public getSessionStatus(sessionId: string): SessionStatusResponse | null {
    const runner = this.runners.get(sessionId);
    if (!runner) return null;

    return runner.getStatus();
  }

  public listSessions(): SessionStatusResponse[] {
    return Array.from(this.runners.values()).map(runner => runner.getStatus());
  }

  public getRunner(sessionId: string): SessionRunner | undefined {
    return this.runners.get(sessionId);
  }

  public hasActiveSession(): boolean {
    for (const runner of this.runners.values()) {
      const status = runner.getLoopStatus();
      if (status === 'running' || status === 'paused') return true;
    }
    return false;
  }
}
