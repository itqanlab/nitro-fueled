import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import type { SessionEndStatus, SessionHistoryListItem } from '../../../models/api.types';

interface EnrichedSession {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly statusColor: string;
  readonly statusLabel: string;
  readonly formattedDuration: string;
  readonly formattedCost: string;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly tasksBlocked: number;
  readonly totalTasks: number;
  readonly supervisorModel: string;
  readonly mode: string;
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
    this.api.getSessionHistory().pipe(
      catchError(() => of(null as SessionHistoryListItem[] | null)),
    ),
    { initialValue: null as SessionHistoryListItem[] | null },
  );

  public loading = true;
  public unavailable = false;

  public readonly enriched = computed<EnrichedSession[]>(() => {
    const raw = this.sessionsRaw();
    if (!raw) return [];
    return raw.map(s => ({
      id: s.id,
      source: s.source,
      startedAt: s.startedAt,
      statusColor: this.statusColor(s.endStatus),
      statusLabel: s.endStatus,
      formattedDuration: s.durationMinutes !== null ? `${s.durationMinutes}m` : '—',
      formattedCost: `$${s.totalCost.toFixed(2)}`,
      tasksCompleted: s.tasksCompleted,
      tasksFailed: s.tasksFailed,
      tasksBlocked: s.tasksBlocked,
      totalTasks: s.totalTasks,
      supervisorModel: s.supervisorModel,
      mode: s.mode,
    }));
  });

  public constructor() {
    effect(() => {
      const raw = this.sessionsRaw();
      if (raw !== null) {
        this.loading = false;
        this.unavailable = false;
      } else if (!this.loading) {
        this.unavailable = true;
      }
    });
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
}
