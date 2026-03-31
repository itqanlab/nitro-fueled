import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../../services/api.service';
import type { LoopStatus, SessionStatusResponse } from '../../../models/api.types';

interface EnrichedDetail {
  readonly sessionId: string;
  readonly source: string;
  readonly startedAt: string;
  readonly statusColor: string;
  readonly statusLabel: LoopStatus;
  readonly formattedDuration: string;
  readonly concurrency: number;
  readonly workerCount: number;
  readonly activeWorkerCount: number;
  readonly workersCompleted: number;
  readonly workersFailed: number;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly tasksInProgress: number;
  readonly tasksRemaining: number;
  readonly drainRequested: boolean;
}

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [RouterLink, NzTagModule, NzSkeletonModule],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly detailRaw = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id') ?? '';
        return id
          ? this.api.getAutoSession(id).pipe(
              catchError(() => of(null as SessionStatusResponse | null)),
            )
          : of(null as SessionStatusResponse | null);
      }),
    ),
  );

  public readonly loading = computed(() => this.detailRaw() === undefined);
  public readonly unavailable = computed(() => this.detailRaw() === null);

  public readonly detail = computed<EnrichedDetail | null>(() => {
    const raw = this.detailRaw();
    if (!raw) return null;
    const workerCount = raw.workers.active + raw.workers.completed + raw.workers.failed;
    return {
      sessionId: raw.sessionId,
      source: raw.config.working_directory,
      startedAt: raw.startedAt,
      statusColor: this.statusColor(raw.loopStatus),
      statusLabel: raw.loopStatus,
      formattedDuration: `${raw.uptimeMinutes}m`,
      concurrency: raw.config.concurrency,
      workerCount,
      activeWorkerCount: raw.workers.active,
      workersCompleted: raw.workers.completed,
      workersFailed: raw.workers.failed,
      tasksCompleted: raw.tasks.completed,
      tasksFailed: raw.tasks.failed,
      tasksInProgress: raw.tasks.inProgress,
      tasksRemaining: raw.tasks.remaining,
      drainRequested: raw.drainRequested,
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
    const sessionId = raw.sessionId;
    this.showConfirmDialog.set(false);
    this.isDraining.set(true);
    this.drainError.set(null);
    this.api.drainSession(sessionId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.isDraining.set(false);
      },
      error: () => {
        this.isDraining.set(false);
        this.drainError.set('Failed to request session stop. Please try again.');
      },
    });
  }

  private statusColor(status: LoopStatus): string {
    switch (status) {
      case 'running': return 'blue';
      case 'paused': return 'gold';
      case 'stopped': return 'default';
      default: return 'default';
    }
  }
}
