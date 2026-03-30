import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
} from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, merge, of, startWith, Subject, switchMap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { ProgressBarComponent } from '../../shared/progress-bar/progress-bar.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import type {
  CortexEvent,
  DashboardEvent,
} from '../../models/api.types';
import type {
  ProgressCenterActivity,
  ProgressCenterSnapshot,
} from '../../models/progress-center.model';

@Component({
  selector: 'app-progress-center',
  standalone: true,
  imports: [DatePipe, NgClass, ProgressBarComponent, EmptyStateComponent],
  templateUrl: './progress-center.component.html',
  styleUrl: './progress-center.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressCenterComponent {
  private readonly api = inject(ApiService);
  private readonly ws = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();

  public readonly snapshot = toSignal(
    this.refresh$.pipe(
      startWith(void 0),
      switchMap(() => this.api.getProgressCenter().pipe(catchError(() => of(null as ProgressCenterSnapshot | null)))),
    ),
    { initialValue: null as ProgressCenterSnapshot | null },
  );

  public readonly health = computed(() => this.snapshot()?.health ?? null);
  public readonly sessions = computed(() => this.snapshot()?.sessions ?? []);
  public readonly activity = computed(() => this.snapshot()?.activity ?? []);
  public readonly lastUpdated = computed(() => this.snapshot()?.generatedAt ?? null);
  public readonly hasData = computed(() => this.sessions().length > 0 || this.activity().length > 0);

  public constructor() {
    const refreshSub = merge(this.ws.events$, this.ws.cortexEvents$)
      .pipe(debounceTime(400))
      .subscribe(() => this.refresh$.next());
    const notificationSub = this.ws.cortexEvents$.subscribe((event) => this.maybeNotify(event));
    this.destroyRef.onDestroy(() => {
      refreshSub.unsubscribe();
      notificationSub.unsubscribe();
    });
    this.ensureNotificationPermission();
  }

  public readonly healthToneClass = computed(() => {
    const tone = this.health()?.tone;
    return tone ? `health-pill--${tone}` : 'health-pill--healthy';
  });

  public readonly activityToneMap: Record<ProgressCenterActivity['tone'], string> = {
    info: 'activity-item--info',
    success: 'activity-item--success',
    warning: 'activity-item--warning',
    error: 'activity-item--error',
  };

  public readonly sessionStatusMap: Record<string, string> = {
    running: 'session-status--running',
    warning: 'session-status--warning',
    stuck: 'session-status--stuck',
    completed: 'session-status--completed',
  };

  public trackBySession(_index: number, session: ProgressCenterSnapshot['sessions'][number]): string {
    return session.sessionId;
  }

  public trackByTask(_index: number, task: ProgressCenterSnapshot['sessions'][number]['tasks'][number]): string {
    return task.taskId;
  }

  public trackByActivity(_index: number, item: ProgressCenterActivity): number {
    return item.id;
  }

  private ensureNotificationPermission(): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }

  private maybeNotify(event: CortexEvent | DashboardEvent): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!('event_type' in event)) return;
    const lowered = event.event_type.toLowerCase();
    if (!lowered.includes('complete') && !lowered.includes('fail')) return;
    const label = event.task_id ?? event.session_id;
    const title = lowered.includes('fail') ? 'Task failure detected' : 'Task update completed';
    const body = `${label}: ${event.event_type}`;
    new Notification(title, { body, tag: `${event.session_id}:${event.id}` });
  }
}
