import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../../services/api.service';
import type { LoopStatus, SessionStatusResponse } from '../../../models/api.types';

interface EnrichedSession {
  readonly id: string;
  readonly startedAt: string;
  readonly statusColor: string;
  readonly statusLabel: string;
  readonly formattedDuration: string;
  readonly formattedCost: string;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly tasksInProgress: number;
  readonly tasksRemaining: number;
  readonly totalTasks: number;
  readonly supervisorModel: string;
}

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [DatePipe, RouterLink, NzTableModule, NzTagModule, NzEmptyModule, NzSkeletonModule],
  templateUrl: './sessions-list.component.html',
  styleUrl: './sessions-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsListComponent {
  private readonly api = inject(ApiService);

  private readonly sessionsRaw = toSignal(
    this.api.getAutoSessions().pipe(
      catchError(() => of(null as SessionStatusResponse[] | null)),
    ),
  );

  public readonly loading = computed(() => this.sessionsRaw() === undefined);
  public readonly unavailable = computed(() => this.sessionsRaw() === null);

  public readonly enriched = computed<EnrichedSession[]>(() => {
    const raw = this.sessionsRaw();
    if (!raw) return [];
    return raw.map(s => ({
      id: s.sessionId,
      startedAt: s.startedAt,
      statusColor: this.statusColor(s.loopStatus),
      statusLabel: s.loopStatus,
      formattedDuration: s.uptimeMinutes !== null ? `${s.uptimeMinutes}m` : '—',
      formattedCost: '—',
      tasksCompleted: s.tasks.completed,
      tasksFailed: s.tasks.failed,
      tasksInProgress: s.tasks.inProgress,
      tasksRemaining: s.tasks.remaining,
      totalTasks: s.tasks.completed + s.tasks.failed + s.tasks.inProgress + s.tasks.remaining,
      supervisorModel: s.config.prep_model || '—',
    }));
  });

  private statusColor(status: LoopStatus): string {
    switch (status) {
      case 'running': return 'green';
      case 'paused': return 'gold';
      case 'stopped': return 'default';
      default: return 'default';
    }
  }
}
