import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import { WebSocketService } from '../../../services/websocket.service';
import type {
  ActiveSessionSummary,
  SessionPhase,
  SessionStatus,
} from '../../../models/sessions-panel.model';

const MAX_ACTIVITY_LENGTH = 40;

@Component({
  selector: 'app-sessions-panel',
  standalone: true,
  imports: [NgClass],
  templateUrl: './sessions-panel.component.html',
  styleUrl: './sessions-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsPanelComponent {
  private readonly apiService = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly webSocketService = inject(WebSocketService);

  public readonly sessions = signal<ActiveSessionSummary[]>([]);
  public readonly recentSessions = signal<ActiveSessionSummary[]>([]);
  public readonly loading = signal(true);

  public readonly statusClassMap: Record<SessionStatus, string> = {
    running: 'status-running',
    idle: 'status-idle',
    completed: 'status-completed',
    failed: 'status-failed',
  };

  public readonly phaseClassMap: Record<SessionPhase, string> = {
    PM: 'phase-pm',
    Architect: 'phase-architect',
    'Team-Leader': 'phase-team-leader',
    Dev: 'phase-dev',
    QA: 'phase-qa',
  };

  public constructor() {
    this.loadSessions();
    this.subscribeToSessionUpdates();
  }

  public onSessionClick(session: ActiveSessionSummary): void {
    void this.router.navigate(['/session', session.sessionId]);
  }

  public truncatedActivities = computed(() => {
    const active = this.sessions();
    const recent = this.recentSessions();
    const all = [...active, ...recent];
    const map = new Map<string, string>();
    for (const session of all) {
      const activity = session.lastActivity;
      const truncated = activity.length <= MAX_ACTIVITY_LENGTH
        ? activity
        : activity.slice(0, MAX_ACTIVITY_LENGTH) + '...';
      map.set(session.sessionId, truncated);
    }
    return map;
  });

  private loadSessions(): void {
    this.apiService.getActiveSessionsEnhanced().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        if (data.length > 0) {
          const running = data.filter(s => s.status === 'running');
          const recent = data.filter(s => s.status !== 'running');
          this.sessions.set(running);
          this.recentSessions.set(recent);
        } else {
          this.loadMockData();
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadMockData();
        this.loading.set(false);
      },
    });
  }

  private loadMockData(): void {
    const mockSessions: ActiveSessionSummary[] = [
      {
        sessionId: 'SESSION_2026-03-30_12-00-00',
        taskId: 'TASK_2026_158',
        taskTitle: 'Session Monitor — Active Sessions List',
        startedAt: new Date(Date.now() - 180000).toISOString(),
        currentPhase: 'PM',
        status: 'running',
        lastActivity: 'Creating sessions panel component...',
        duration: '3m 0s',
      },
      {
        sessionId: 'SESSION_2026-03-30_11-45-00',
        taskId: 'TASK_2026_157',
        taskTitle: 'Live Session Chat UI',
        startedAt: new Date(Date.now() - 900000).toISOString(),
        currentPhase: 'Dev',
        status: 'running',
        lastActivity: 'Generating mock session messages...',
        duration: '15m 0s',
      },
      {
        sessionId: 'SESSION_2026-03-29_16-30-00',
        taskId: 'TASK_2026_156',
        taskTitle: 'Auto-Pilot Trigger',
        startedAt: new Date(Date.now() - 72000000).toISOString(),
        currentPhase: 'QA',
        status: 'completed',
        lastActivity: 'Auto-pilot testing complete',
        duration: '20h 0m',
      },
    ];
    const running = mockSessions.filter(s => s.status === 'running');
    const recent = mockSessions.filter(s => s.status !== 'running');
    this.sessions.set(running);
    this.recentSessions.set(recent);
  }

  private subscribeToSessionUpdates(): void {
    this.webSocketService.events$.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (event) => {
        if (event.type === 'sessions:changed' || event.type === 'session:update') {
          this.loadSessions();
        }
      },
    });
  }
}
