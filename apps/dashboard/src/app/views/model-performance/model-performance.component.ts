import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../services/api.service';
import type { CortexModelPerformance } from '../../models/api.types';
import {
  adaptModelPerformance,
  FALLBACK_MODEL_PERF_ROWS,
  ModelPerfRow,
} from './model-performance.adapters';

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    NzTableModule,
    NzSelectModule,
    NzTagModule,
    NzEmptyModule,
    NzSkeletonModule,
  ],
  templateUrl: './model-performance.component.html',
  styleUrl: './model-performance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelPerformanceComponent {
  private readonly api = inject(ApiService);

  private readonly modelPerfSignal = toSignal(
    this.api
      .getCortexModelPerformance()
      .pipe(catchError(() => of(null as CortexModelPerformance[] | null))),
    { initialValue: null as CortexModelPerformance[] | null },
  );

  /** Single adapted signal — shared by rowsComputed and taskTypeOptions to avoid double execution. */
  private readonly adaptedSignal = computed<ModelPerfRow[]>(() =>
    adaptModelPerformance(this.modelPerfSignal()),
  );

  private readonly rowsComputed = computed<ModelPerfRow[]>(() => {
    const adapted = this.adaptedSignal();
    let filtered = adapted;
    if (this.selectedTaskType !== 'all') {
      filtered = filtered.filter(r => r.taskType === this.selectedTaskType);
    }
    if (this.selectedComplexity !== 'all') {
      filtered = filtered.filter(r => r.complexity === this.selectedComplexity);
    }
    if (this.dateFrom) {
      filtered = filtered.filter(r => r.lastRun !== null && r.lastRun >= this.dateFrom);
    }
    if (this.dateTo) {
      filtered = filtered.filter(r => r.lastRun !== null && r.lastRun <= this.dateTo);
    }
    return filtered;
  });

  public readonly taskTypeOptions = computed<string[]>(() => {
    const types = new Set(this.adaptedSignal().map(r => r.taskType));
    return Array.from(types).sort();
  });

  public readonly complexityOptions = computed<string[]>(() => {
    const values = new Set(
      this.adaptedSignal()
        .map(r => r.complexity)
        .filter((c): c is string => c !== null),
    );
    return Array.from(values).sort();
  });

  public selectedTaskType: string = 'all';
  public selectedComplexity: string = 'all';
  public dateFrom: string = '';
  public dateTo: string = '';
  public sortColumn: keyof ModelPerfRow | '' = '';
  public sortDirection: 'asc' | 'desc' = 'asc';
  public rows: ModelPerfRow[] = [];
  /** True while the initial HTTP request has not yet emitted any value. */
  public loading = true;
  public unavailable = false;

  constructor() {
    effect(() => {
      const raw = this.modelPerfSignal();
      if (raw === null) {
        // Only set unavailable once loading has completed (i.e. a real null response).
        if (!this.loading) {
          this.unavailable = true;
          this.rows = FALLBACK_MODEL_PERF_ROWS;
        }
      } else {
        this.loading = false;
        this.unavailable = false;
        this.rows = this.rowsComputed();
      }
    });
  }

  public sortBy(col: keyof ModelPerfRow): void {
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

  public onFilterChange(): void {
    this.rows = this.rowsComputed();
  }

  public scoreColor(scoreClass: string): string {
    if (scoreClass === 'score-high') return 'green';
    if (scoreClass === 'score-mid') return 'orange';
    return 'red';
  }
}
