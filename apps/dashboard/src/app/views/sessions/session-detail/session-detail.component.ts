import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../../services/api.service';
import type {
  SessionEndStatus,
  SessionHistoryDetail,
  SessionHistoryTaskResult,
  SessionHistoryTimelineEvent,
  SessionHistoryWorker,
} from '../../../models/api.types';

interface EnrichedTask {
  readonly taskId: string;
  readonly outcome: string;
  readonly formattedCost: string;
  readonly formattedDuration: string;
  readonly model: string;
  readonly formattedScore: string;
  readonly scoreColor: string;
}

interface EnrichedEvent {
  readonly formattedTime: string;
  readonly type: string;
  readonly source: string;
  readonly description: string;
  readonly typeClass: string;
}

interface EnrichedWorker {
  readonly id: string;
  readonly taskId: string;
  readonly workerType: string;
  readonly status: string;
  readonly statusColor: string;
  readonly model: string;
  readonly provider: string;
  readonly formattedCost: string;
  readonly formattedTokens: string;
}

interface EnrichedDetail {
  readonly source: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly statusColor: string;
  readonly statusLabel: string;
  readonly formattedDuration: string;
  readonly formattedCost: string;
  readonly mode: string;
  readonly supervisorModel: string;
  readonly workerCount: number;
  readonly taskResults: readonly EnrichedTask[];
  readonly timeline: readonly EnrichedEvent[];
  readonly workers: readonly EnrichedWorker[];
  readonly hasLog: boolean;
  readonly logContent: string;
  readonly activeWorkerCount: number;
  readonly drainRequested: boolean;
  readonly id: string;
}

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, NzTableModule, NzTagModule, NzEmptyModule, NzSkeletonModule],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

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
    { initialValue: null as SessionHistoryDetail | null },
  );

  public loading = true;
  public unavailable = false;
  public readonly logExpanded = signal(false);

  public readonly detail = computed<EnrichedDetail | null>(() => {
    const raw = this.detailRaw();
    if (!raw) return null;
    return {
      source: raw.source,
      startedAt: raw.startedAt,
      endedAt: raw.endedAt ?? '—',
      statusColor: this.statusColor(raw.endStatus),
      statusLabel: raw.endStatus,
      formattedDuration: raw.durationMinutes !== null ? `${raw.durationMinutes}m` : '—',
      formattedCost: `$${raw.totalCost.toFixed(2)}`,
      mode: raw.mode,
      supervisorModel: raw.supervisorModel,
      workerCount: raw.workerCount,
      taskResults: raw.taskResults.map(t => this.enrichTask(t)),
      timeline: raw.timeline.map(e => this.enrichEvent(e)),
      workers: raw.workers.map(w => this.enrichWorker(w)),
      hasLog: raw.logContent !== null && raw.logContent.length > 0,
      logContent: raw.logContent ?? '',
      activeWorkerCount: raw.workers.filter(w => w.status === 'active' || w.status === 'running').length,
      drainRequested: raw.drainRequested,
      id: raw.id,
    };
  });

  public readonly showConfirmDialog = signal(false);
  public readonly isDraining = signal(false);
  public readonly drainError = signal<string | null>(null);

  public requestDrain(): void {
    this.showConfirmDialog.set(true);
  }

  public cancelDrain(): void {
    this.showConfirmDialog.set(false);
  }

  public confirmDrain(): void {
    const raw = this.detailRaw();
    if (!raw) return;
    const sessionId = raw.id;
    this.showConfirmDialog.set(false);
    this.isDraining.set(true);
    this.drainError.set(null);
    this.api.drainSession(sessionId).pipe(
      catchError(() => {
        this.isDraining.set(false);
        this.drainError.set('Failed to request session stop. Please try again.');
        return of(null);
      }),
    ).subscribe();
  }

  public constructor() {
    effect(() => {
      const raw = this.detailRaw();
      if (raw !== null) {
        this.loading = false;
        this.unavailable = false;
      } else if (!this.loading) {
        this.unavailable = true;
      }
    });
  }

  public toggleLog(): void {
    this.logExpanded.update(v => !v);
  }

  private statusColor(status: SessionEndStatus): string {
    switch (status) {
      case 'completed': return 'green';
      case 'running': return 'blue';
      case 'stopped': return 'gold';
      case 'killed': return 'orange';
      case 'crashed': return 'red';
      default: return 'default';
    }
  }

  private workerStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'blue';
      case 'completed': return 'green';
      case 'failed': return 'red';
      default: return 'default';
    }
  }

  private enrichTask(t: SessionHistoryTaskResult): EnrichedTask {
    return {
      taskId: t.taskId,
      outcome: t.outcome,
      formattedCost: `$${t.cost.toFixed(2)}`,
      formattedDuration: t.durationMinutes !== null ? `${t.durationMinutes}m` : '—',
      model: t.model,
      formattedScore: t.reviewScore !== null ? t.reviewScore.toFixed(1) : '—',
      scoreColor: t.reviewScore !== null
        ? t.reviewScore >= 8 ? 'green' : t.reviewScore >= 5 ? 'orange' : 'red'
        : 'default',
    };
  }

  private enrichEvent(e: SessionHistoryTimelineEvent): EnrichedEvent {
    const lower = e.type.toLowerCase();
    let typeClass = 'event-type--default';
    if (lower.includes('fail') || lower.includes('error')) typeClass = 'event-type--error';
    else if (lower.includes('warn')) typeClass = 'event-type--warning';
    else if (lower.includes('complete') || lower.includes('success')) typeClass = 'event-type--success';
    else if (lower.includes('spawn') || lower.includes('start')) typeClass = 'event-type--info';
    return {
      formattedTime: e.timestamp,
      type: e.type,
      source: e.source,
      description: e.description,
      typeClass,
    };
  }

  private enrichWorker(w: SessionHistoryWorker): EnrichedWorker {
    return {
      id: w.id,
      taskId: w.taskId,
      workerType: w.workerType,
      status: w.status,
      statusColor: this.workerStatusColor(w.status),
      model: w.model,
      provider: w.provider,
      formattedCost: `$${w.cost.toFixed(2)}`,
      formattedTokens: `${w.inputTokens.toLocaleString()} / ${w.outputTokens.toLocaleString()}`,
    };
  }
}
