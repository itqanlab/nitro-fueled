/**
 * AutoPilotService — facade over the SupervisorService.
 *
 * Translates REST API requests into supervisor operations. Keeps the
 * controller thin and the supervisor logic decoupled from HTTP concerns.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupervisorService } from './supervisor.service';
import type {
  StartAutoPilotRequest,
  StartAutoPilotResponse,
  StopAutoPilotResponse,
  PauseAutoPilotResponse,
  ResumeAutoPilotResponse,
  AutoPilotStatusResponse,
} from './auto-pilot.model';

@Injectable()
export class AutoPilotService {
  private readonly logger = new Logger(AutoPilotService.name);

  public constructor(private readonly supervisor: SupervisorService) {}

  public start(request: StartAutoPilotRequest): StartAutoPilotResponse {
    const sessionId = this.supervisor.start({
      concurrency: request.concurrency,
      limit: request.limit,
      build_provider: request.buildProvider,
      build_model: request.buildModel,
      review_provider: request.reviewProvider,
      review_model: request.reviewModel,
      priority: request.priority,
      retries: request.retries,
    });

    return { sessionId, status: 'starting' };
  }

  public stop(sessionId: string): StopAutoPilotResponse | null {
    const currentSession = this.supervisor.getSessionId();
    if (!currentSession || currentSession !== sessionId) {
      return null;
    }
    this.supervisor.stop();
    return { sessionId, stopped: true };
  }

  public pause(sessionId: string): PauseAutoPilotResponse | null {
    const currentSession = this.supervisor.getSessionId();
    if (!currentSession || currentSession !== sessionId) {
      return null;
    }
    this.supervisor.pause();
    return { sessionId, paused: true };
  }

  public resume(sessionId: string): ResumeAutoPilotResponse | null {
    const currentSession = this.supervisor.getSessionId();
    if (!currentSession || currentSession !== sessionId) {
      return null;
    }
    this.supervisor.resume();
    return { sessionId, resumed: true };
  }

  public getStatus(sessionId?: string): AutoPilotStatusResponse | null {
    const status = this.supervisor.getStatus();
    if (!status) return null;
    if (sessionId && status.sessionId !== sessionId) return null;
    return status;
  }

  public isRunning(): boolean {
    return this.supervisor.isRunning();
  }
}
