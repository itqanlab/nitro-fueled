import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Observable, catchError, filter, finalize, map, merge, of, switchMap, take } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { ApiService } from '../../../services/api.service';
import { WebSocketService } from '../../../services/websocket.service';
import type {
  SessionHistoryDetail,
  SessionEndStatus,
  SessionHistoryTaskResult,
  SessionHistoryWorker,
  SessionHistoryTimelineEvent,
  SessionStatusResponse,
  SessionActionResponse,
  CostBreakdown,
} from '../../../models/api.types';

interface EnrichedDetail {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly statusColor: string;
  readonly statusLabel: SessionEndStatus;
  readonly formattedDuration: string;
  readonly formattedCost: string;
  readonly mode: string;
  readonly supervisorModel: string;
  readonly workerCount: number;
  readonly drainRequested: boolean;
  readonly taskResults: readonly SessionHistoryTaskResult[];
  readonly workers: readonly SessionHistoryWorker[];
  readonly timeline: readonly SessionHistoryTimelineEvent[];
  readonly logContent: string | null;
  readonly costBreakdown: CostBreakdown | null;
}

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, NzTagModule, NzSkeletonModule, NzTableModule, NzButtonModule],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly ws = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly detailRaw = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id') ?? '';
        return id
          ? this.api.getSessionHistoryDetail(id).pipe(
              catchError(() => of(null as SessionHistoryDetail | null)),
            )
          : of(null as SessionHistoryDetail | null);
      }),
    ),
  );

  public readonly liveStatus = signal<SessionStatusResponse | null>(null);
  public readonly actionInFlight = signal(false);
  public readonly actionError = signal<string | null>(null);

  public readonly loading = computed(() => this.detailRaw() === undefined);
  public readonly unavailable = computed(() => this.detailRaw() === null);

  public readonly detail = computed<EnrichedDetail | null>(() => {
    const raw = this.detailRaw();
    if (!raw) return null;
    return {
      id: raw.id,
      source: raw.source,
      startedAt: raw.startedAt,
      endedAt: raw.endedAt,
      statusColor: this.statusColor(raw.endStatus),
      statusLabel: raw.endStatus,
      formattedDuration: raw.durationMinutes !== null ? `${raw.durationMinutes}m` : '—',
      formattedCost: raw.totalCost > 0 ? `$${raw.totalCost.toFixed(4)}` : '—',
      mode: raw.mode || '—',
      supervisorModel: raw.supervisorModel || '—',
      workerCount: raw.workerCount,
      drainRequested: raw.drainRequested,
      taskResults: raw.taskResults,
      workers: raw.workers,
      timeline: raw.timeline,
      logContent: raw.logContent,
      costBreakdown: raw.costBreakdown ?? null,
    };
  });

  public readonly isActiveSession = computed(() => this.detail()?.statusLabel === 'running');

  public readonly canPause = computed(() => {
    const ls = this.liveStatus();
    return ls !== null && ls.loopStatus === 'running' && !ls.drainRequested;
  });

  public readonly canResume = computed(() => {
    const ls = this.liveStatus();
    return ls !== null && ls.loopStatus === 'paused';
  });

  public readonly canStop = computed(() => {
    const ls = this.liveStatus();
    return ls !== null && (ls.loopStatus === 'running' || ls.loopStatus === 'paused');
  });

  public readonly canDrain = computed(() => {
    const ls = this.liveStatus();
    return ls !== null && ls.loopStatus === 'running' && !ls.drainRequested;
  });

  constructor() {
    const sessionId$ = this.route.paramMap.pipe(map(p => p.get('id') ?? ''));

    const wsRefresh$ = this.ws.events$.pipe(
      filter(e => e.type === 'session:updated' || e.type === 'sessions:changed' || e.type === 'session:update'),
      switchMap(() => sessionId$.pipe(take(1))),
    );

    merge(sessionId$, wsRefresh$).pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(id => {
        if (!id) return of(null as SessionStatusResponse | null);
        return this.api.getAutoSession(id).pipe(
          catchError(() => of(null as SessionStatusResponse | null)),
        );
      }),
    ).subscribe(status => {
      this.liveStatus.set(status);
    });
  }

  public pause(): void {
    this.runAction(id => this.api.pauseAutoSession(id));
  }

  public resume(): void {
    this.runAction(id => this.api.resumeAutoSession(id));
  }

  public stop(): void {
    this.runAction(id => this.api.stopAutoSession(id));
  }

  public drain(): void {
    this.runAction(id => this.api.drainSession(id));
  }

  private runAction(action: (id: string) => Observable<SessionActionResponse>): void {
    const id = this.detail()?.id;
    if (!id || this.actionInFlight()) return;
    this.actionInFlight.set(true);
    this.actionError.set(null);
    action(id).pipe(
      catchError((err: unknown) => {
        const msg = err instanceof Error ? err.message :
          (typeof err === 'object' && err !== null && 'error' in err &&
            typeof (err as Record<string, unknown>)['error'] === 'object' &&
            (err as { error: Record<string, unknown> }).error !== null &&
            typeof (err as { error: Record<string, unknown> }).error['message'] === 'string')
          ? (err as { error: { message: string } }).error.message
          : 'Action failed';
        this.actionError.set(msg);
        return of(null);
      }),
      finalize(() => {
        this.actionInFlight.set(false);
        // Refresh live status after action
        if (id) {
          this.api.getAutoSession(id).pipe(
            catchError(() => of(null as SessionStatusResponse | null)),
          ).subscribe(s => this.liveStatus.set(s));
        }
      }),
    ).subscribe();
  }

  public costBreakdownEntries(breakdown: CostBreakdown): Array<{ model: string; cost: number }> {
    return Object.entries(breakdown.worker_cost_by_model).map(([model, cost]) => ({ model, cost }));
  }

  private statusColor(status: SessionEndStatus): string {
    switch (status) {
      case 'running': return 'green';
      case 'completed': return 'blue';
      case 'stopped': return 'gold';
      case 'crashed': return 'red';
      case 'killed': return 'orange';
      default: return 'default';
    }
  }
}
