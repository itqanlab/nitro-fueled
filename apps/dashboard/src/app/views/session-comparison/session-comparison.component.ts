import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { NgClass, DecimalPipe, DatePipe, SlicePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../services/api.service';
import type { CortexSession } from '../../../../../dashboard-api/src/dashboard/cortex.types';
import {
  adaptSessions,
  FALLBACK_SESSION_ROWS,
  SessionRow,
} from './session-comparison.adapters';

@Component({
  selector: 'app-session-comparison',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe,
    DatePipe,
    SlicePipe,
    NzTableModule,
    NzTagModule,
    NzEmptyModule,
    NzSkeletonModule,
  ],
  templateUrl: './session-comparison.component.html',
  styleUrl: './session-comparison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionComparisonComponent {
  private readonly api = inject(ApiService);

  private readonly sessionsSignal = toSignal(
    this.api
      .getCortexSessions(200)
      .pipe(catchError(() => of(null as CortexSession[] | null))),
    { initialValue: null as CortexSession[] | null },
  );

  private readonly rowsComputed = computed<SessionRow[]>(() =>
    adaptSessions(this.sessionsSignal()),
  );

  public rows: SessionRow[] = [];
  /** True while the initial HTTP request has not yet emitted any value. */
  public loading = true;
  public unavailable = false;
  public sortColumn: keyof SessionRow | '' = '';
  public sortDirection: 'asc' | 'desc' = 'asc';

  constructor() {
    effect(() => {
      const raw = this.sessionsSignal();
      if (raw === null) {
        // Only mark unavailable once the request has completed (loading = false).
        if (!this.loading) {
          this.unavailable = true;
          this.rows = FALLBACK_SESSION_ROWS;
        }
      } else {
        this.loading = false;
        this.unavailable = false;
        this.rows = this.rowsComputed();
      }
    });
  }

  public sortBy(col: keyof SessionRow): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }
    this.rows = [...this.rowsComputed()].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  public toggleSelect(row: SessionRow): void {
    const index = this.rows.indexOf(row);
    if (index !== -1) {
      this.rows[index] = { ...row, isSelected: !row.isSelected };
    }
  }

  public statusColor(statusClass: string): string {
    if (statusClass === 'status-active') return 'blue';
    if (statusClass === 'status-done') return 'green';
    if (statusClass === 'status-failed') return 'red';
    return 'default';
  }
}
