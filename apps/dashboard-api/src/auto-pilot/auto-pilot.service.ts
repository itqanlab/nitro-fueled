/**
 * AutoPilotService — thin facade over SessionManagerService.
 *
 * Translates camelCase HTTP-layer DTOs into snake_case SupervisorConfig
 * keys and delegates all operations to SessionManagerService.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SessionManagerService } from './session-manager.service';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  UpdateSessionConfigRequest,
  UpdateSessionConfigResponse,
  SessionActionResponse,
  ListSessionsResponse,
} from './auto-pilot.model';
import type {
  SessionStatusResponse,
  SupervisorConfig,
  UpdateConfigRequest,
} from './auto-pilot.types';

@Injectable()
export class AutoPilotService {
  private readonly logger = new Logger(AutoPilotService.name);

  public constructor(private readonly sessionManager: SessionManagerService) {}

  // ============================================================
  // Session lifecycle
  // ============================================================

  public createSession(request: CreateSessionRequest): CreateSessionResponse {
    const config: Partial<SupervisorConfig> = {};

    if (request.concurrency !== undefined) config.concurrency = request.concurrency;
    if (request.limit !== undefined) config.limit = request.limit;
    if (request.prepProvider !== undefined) config.prep_provider = request.prepProvider;
    if (request.prepModel !== undefined) config.prep_model = request.prepModel;
    if (request.implementProvider !== undefined) config.implement_provider = request.implementProvider;
    if (request.implementModel !== undefined) config.implement_model = request.implementModel;
    if (request.implementFallbackProvider !== undefined) config.implement_fallback_provider = request.implementFallbackProvider;
    if (request.implementFallbackModel !== undefined) config.implement_fallback_model = request.implementFallbackModel;
    if (request.reviewProvider !== undefined) config.review_provider = request.reviewProvider;
    if (request.reviewModel !== undefined) config.review_model = request.reviewModel;
    if (request.priority !== undefined) config.priority = request.priority;
    if (request.retries !== undefined) config.retries = request.retries;

    const sessionId = this.sessionManager.createSession(config);

    return { sessionId, status: 'starting' };
  }

  public stopSession(sessionId: string): SessionActionResponse | null {
    const stopped = this.sessionManager.stopSession(sessionId);
    if (!stopped) return null;

    return { sessionId, action: 'stopped' };
  }

  public pauseSession(sessionId: string): SessionActionResponse | null {
    const paused = this.sessionManager.pauseSession(sessionId);
    if (!paused) return null;

    return { sessionId, action: 'paused' };
  }

  public resumeSession(sessionId: string): SessionActionResponse | null {
    const resumed = this.sessionManager.resumeSession(sessionId);
    if (!resumed) return null;

    return { sessionId, action: 'resumed' };
  }

  public drainSession(sessionId: string): SessionActionResponse | null {
    const drained = this.sessionManager.drainSession(sessionId);
    if (!drained) return null;

    return { sessionId, action: 'draining' };
  }

  // ============================================================
  // Config update
  // ============================================================

  public updateSessionConfig(
    sessionId: string,
    request: UpdateSessionConfigRequest,
  ): UpdateSessionConfigResponse | null {
    const patch: UpdateConfigRequest = {};

    if (request.concurrency !== undefined) patch.concurrency = request.concurrency;
    if (request.limit !== undefined) patch.limit = request.limit;
    if (request.prepProvider !== undefined) patch.prep_provider = request.prepProvider;
    if (request.prepModel !== undefined) patch.prep_model = request.prepModel;
    if (request.implementProvider !== undefined) patch.implement_provider = request.implementProvider;
    if (request.implementModel !== undefined) patch.implement_model = request.implementModel;
    if (request.implementFallbackProvider !== undefined) patch.implement_fallback_provider = request.implementFallbackProvider;
    if (request.implementFallbackModel !== undefined) patch.implement_fallback_model = request.implementFallbackModel;
    if (request.reviewProvider !== undefined) patch.review_provider = request.reviewProvider;
    if (request.reviewModel !== undefined) patch.review_model = request.reviewModel;
    if (request.priority !== undefined) patch.priority = request.priority;
    if (request.retries !== undefined) patch.retries = request.retries;
    if (request.pollIntervalMs !== undefined) patch.poll_interval_ms = request.pollIntervalMs;

    const updated = this.sessionManager.updateSessionConfig(sessionId, patch);
    if (!updated) return null;

    const runner = this.sessionManager.getRunner(sessionId);
    if (!runner) return null;

    return { sessionId, config: runner.getConfig() };
  }

  // ============================================================
  // Query
  // ============================================================

  public getSessionStatus(sessionId: string): SessionStatusResponse | null {
    return this.sessionManager.getSessionStatus(sessionId);
  }

  public listSessions(): ListSessionsResponse {
    const sessions = this.sessionManager.listSessions();
    return { sessions };
  }
}
