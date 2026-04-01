import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { ApiService } from '../../../services/api.service';
import type { SessionHistoryListItem, SessionEndStatus } from '../../../models/api.types';

interface EnrichedSession {
  readonly id: string;
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
  readonly models: readonly string[];
}

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [DatePipe, RouterLink, NzTableModule, NzTagModule, NzEmptyModule, NzSkeletonModule, NzButtonModule],
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
  );

  private readonly stoppingIds = signal<ReadonlySet<string>>(new Set());

  public readonly loading = computed(() => this.sessionsRaw() === undefined);
  public readonly unavailable = computed(() => this.sessionsRaw() === null);

  public readonly enriched = computed<EnrichedSession[]>(() => {
    const raw = this.sessionsRaw();
    if (!raw) return [];
    return raw.map(s => ({
      id: s.id,
      startedAt: s.startedAt,
      statusColor: this.statusColor(s.endStatus),
      statusLabel: s.endStatus,
      formattedDuration: s.durationMinutes !== null ? `${s.durationMinutes}m` : '—',
      formattedCost: s.totalCost > 0 ? `$${s.totalCost.toFixed(4)}` : '—',
      tasksCompleted: s.tasksCompleted,
      tasksFailed: s.tasksFailed,
      tasksBlocked: s.tasksBlocked,
      totalTasks: s.totalTasks,
      supervisorModel: s.supervisorModel || '—',
      models: s.models,
    }));
  });

  public isStopping(id: string): boolean {
    return this.stoppingIds().has(id);
  }

  public stopSession(id: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.stoppingIds().has(id)) return;
    this.stoppingIds.update(s => new Set([...s, id]));
    this.api.stopAutoSession(id).pipe(
      catchError(() => of(null)),
      finalize(() => {
        this.stoppingIds.update(s => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }),
    ).subscribe();
  }

  private statusColor(status: SessionEndStatus): string {
    switch (status) {
      case 'running': return 'green';
      case 'stopped': return 'gold';
      case 'completed': return 'blue';
      case 'crashed': return 'red';
      case 'killed': return 'orange';
      default: return 'default';
    }
  }
}
