import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MOCK_QUEUE_TASKS } from './project.constants';
import type { SessionViewerHeader, SessionViewerStep } from '../models/session-viewer.model';
import {
  DEFAULT_TASK_ID,
  DEFAULT_TASK_TITLE,
  SESSION_ID_RE,
  buildStartedAtFromSession,
  buildTimestampedScript,
  deriveHeaderPhase,
} from './session-mock.constants';

@Injectable({ providedIn: 'root' })
export class SessionMockService {
  public isValidSessionId(sessionId: string): boolean {
    return SESSION_ID_RE.test(sessionId);
  }

  public createHeader(sessionId: string): SessionViewerHeader {
    const linkedTask = MOCK_QUEUE_TASKS.find(task => task.sessionId === sessionId);

    return {
      sessionId,
      taskId: linkedTask?.id ?? DEFAULT_TASK_ID,
      taskTitle: linkedTask?.title ?? DEFAULT_TASK_TITLE,
      startedAt: this.buildStartedAt(sessionId),
      currentPhase: deriveHeaderPhase(linkedTask?.phase ?? null, linkedTask?.status ?? 'CREATED'),
      status: 'running',
    };
  }

  public streamSession(sessionId: string): Observable<SessionViewerStep> {
    return new Observable<SessionViewerStep>(subscriber => {
      const steps = this.buildScript(sessionId);
      let currentIndex = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const emitNext = (): void => {
        if (currentIndex >= steps.length) {
          subscriber.complete();
          return;
        }

        const step = steps[currentIndex];
        subscriber.next(step);
        currentIndex += 1;

        if (currentIndex >= steps.length) {
          subscriber.complete();
          return;
        }

        timer = setTimeout(emitNext, steps[currentIndex].delayMs);
      };

      timer = setTimeout(emitNext, steps[0]?.delayMs ?? 0);

      return () => {
        if (timer !== null) {
          clearTimeout(timer);
        }
      };
    });
  }

  private buildScript(sessionId: string): readonly SessionViewerStep[] {
    return buildTimestampedScript(this.buildStartedAt(sessionId));
  }

  private buildStartedAt(sessionId: string): string {
    const linkedTask = MOCK_QUEUE_TASKS.find(task => task.sessionId === sessionId);
    if (linkedTask?.sessionId) {
      return buildStartedAtFromSession(linkedTask.sessionId);
    }

    return '2026-03-30T04:52:28.000Z';
  }
}
