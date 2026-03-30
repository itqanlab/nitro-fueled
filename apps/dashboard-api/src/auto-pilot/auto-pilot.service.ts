import { Injectable } from '@nestjs/common';
import {
  AutoPilotStatusResponse,
  MockAutoPilotSession,
  StartAutoPilotRequest,
  StartAutoPilotResponse,
  StopAutoPilotResponse,
} from './auto-pilot.model';

@Injectable()
export class AutoPilotService {
  private readonly sessions = new Map<string, MockAutoPilotSession>();
  private sessionCounter = 0;

  public start(request: StartAutoPilotRequest): StartAutoPilotResponse {
    const sessionId = this.createSessionId();
    this.sessions.set(sessionId, {
      sessionId,
      taskIds: request.taskIds ?? [],
      dryRun: request.options?.dryRun ?? false,
      createdAt: new Date().toISOString(),
      pollCount: 0,
      stopped: false,
    });
    return { sessionId, status: 'starting' };
  }

  public stop(sessionId: string): StopAutoPilotResponse | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    this.sessions.set(sessionId, { ...session, stopped: true });
    return { sessionId, stopped: true };
  }

  public getStatus(sessionId: string): AutoPilotStatusResponse | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    const nextPollCount = session.pollCount + 1;
    const status = session.stopped ? 'stopped' : nextPollCount >= 2 ? 'running' : 'starting';
    this.sessions.set(sessionId, { ...session, pollCount: nextPollCount });
    return {
      sessionId,
      status,
      updatedAt: new Date().toISOString(),
    };
  }

  private createSessionId(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.sessionCounter += 1;
    return `SESSION_${stamp}_${this.sessionCounter}`;
  }
}
