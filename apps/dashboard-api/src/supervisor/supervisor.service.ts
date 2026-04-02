import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface StartSessionConfig {
  concurrency?: number;
  intervalMs?: number;
}

export interface SessionStartResult {
  ok: true;
  session_id: string;
  message: string;
}

export interface SessionActionResult {
  ok: true;
  session_id: string;
  status: string;
  message: string;
}

export interface SessionStatusResult {
  session_id: string;
  status: string;
  workers_active: number;
  tasks_running: number;
}

/** Minimum interface a supervised engine must satisfy. */
export interface IEngine {
  start(): void;
  stop(): void;
  pause?(): void;
  resume?(): void;
  getStats?(): { workers_active: number; tasks_running: number };
}

/** Factory injected at startSession time to create the engine instance. */
export type EngineFactory = (config: StartSessionConfig) => IEngine;

type SessionState = 'running' | 'paused' | 'stopped';

interface EngineEntry {
  engine: IEngine;
  state: SessionState;
  sessionId: string;
}

@Injectable()
export class SupervisorService implements OnModuleDestroy {
  private readonly logger = new Logger(SupervisorService.name);

  /** Active engine entries indexed by sessionId. */
  private readonly sessions = new Map<string, EngineEntry>();

  /**
   * Optional engine factory. When set via setEngineFactory(), startSession()
   * will use it to create real engine instances. When not set, a no-op stub
   * engine is used (allows the service to start even before TASK_2026_338 wires
   * the real SupervisorEngine).
   */
  private engineFactory: EngineFactory | null = null;

  public onModuleDestroy(): void {
    for (const [id] of this.sessions) {
      this.logger.log(`Module destroy — stopping session ${id}`);
      this._doStop(id);
    }
  }

  // ── Engine wiring ───────────────────────────────────────────────────────────

  /**
   * Inject the engine factory at runtime. Called by the module that wires the
   * real SupervisorEngine (e.g. AutoPilotModule or a future EngineModule).
   */
  public setEngineFactory(factory: EngineFactory): void {
    this.engineFactory = factory;
  }

  // ── Session lifecycle ───────────────────────────────────────────────────────

  /**
   * Creates a new engine session.
   * Returns a SessionStartResult with the generated session ID.
   */
  public startSession(config: StartSessionConfig): SessionStartResult {
    const sessionId = `SESSION_${new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '')}`;

    const engine = this.engineFactory
      ? this.engineFactory(config)
      : this._stubEngine();

    engine.start();
    this.sessions.set(sessionId, { engine, state: 'running', sessionId });
    this.logger.log(`Session ${sessionId} started`);

    return { ok: true, session_id: sessionId, message: 'Supervisor session started' };
  }

  /**
   * Pauses an active session.
   * Returns null if the session does not exist.
   * Throws if the session is not in 'running' state.
   */
  public pauseSession(id: string): SessionActionResult | null {
    const entry = this.sessions.get(id);
    if (!entry) return null;

    if (entry.state !== 'running') {
      throw new Error(`Cannot pause session in state '${entry.state}'`);
    }

    if (typeof entry.engine.pause === 'function') {
      entry.engine.pause();
    } else {
      entry.engine.stop();
    }

    entry.state = 'paused';
    this.logger.log(`Session ${id} paused`);

    return { ok: true, session_id: id, status: 'paused', message: 'Session paused' };
  }

  /**
   * Resumes a paused session.
   * Returns null if the session does not exist.
   * Throws if the session is not in 'paused' state.
   */
  public resumeSession(id: string): SessionActionResult | null {
    const entry = this.sessions.get(id);
    if (!entry) return null;

    if (entry.state !== 'paused') {
      throw new Error(`Cannot resume session in state '${entry.state}'`);
    }

    if (typeof entry.engine.resume === 'function') {
      entry.engine.resume();
    } else {
      entry.engine.start();
    }

    entry.state = 'running';
    this.logger.log(`Session ${id} resumed`);

    return { ok: true, session_id: id, status: 'running', message: 'Session resumed' };
  }

  /**
   * Stops and removes a session.
   * Returns null if the session does not exist.
   */
  public stopSession(id: string): SessionActionResult | null {
    const entry = this.sessions.get(id);
    if (!entry) return null;

    this._doStop(id);
    return { ok: true, session_id: id, status: 'stopped', message: 'Session stopped' };
  }

  /**
   * Returns session status or null if not found.
   */
  public getSessionStatus(id: string): SessionStatusResult | null {
    const entry = this.sessions.get(id);
    if (!entry) return null;

    const stats = typeof entry.engine.getStats === 'function'
      ? entry.engine.getStats()
      : { workers_active: 0, tasks_running: 0 };

    return {
      session_id: id,
      status: entry.state,
      workers_active: stats.workers_active,
      tasks_running: stats.tasks_running,
    };
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _doStop(id: string): void {
    const entry = this.sessions.get(id);
    if (!entry) return;
    try { entry.engine.stop(); } catch (err) {
      this.logger.error(`Error stopping engine for session ${id}`, err);
    }
    this.sessions.delete(id);
  }

  /** No-op engine used when no factory is registered. */
  private _stubEngine(): IEngine {
    return {
      start: () => { /* no-op stub — real engine wired via setEngineFactory() */ },
      stop: () => { /* no-op stub */ },
      getStats: () => ({ workers_active: 0, tasks_running: 0 }),
    };
  }
}
