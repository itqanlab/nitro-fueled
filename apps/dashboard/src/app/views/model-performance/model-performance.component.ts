import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { ApiService } from '../../services/api.service';
import type { CortexModelPerformance } from '../../../../../dashboard-api/src/dashboard/cortex.types';
import {
  adaptModelPerformance,
  FALLBACK_MODEL_PERF_ROWS,
  ModelPerfRow,
} from './model-performance.adapters';

@Component({
  selector: 'app-model-performance',
  standalone: true,
  imports: [
    NgClass,
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

  private readonly rowsComputed = computed<ModelPerfRow[]>(() => {
    const adapted = adaptModelPerformance(this.modelPerfSignal());
    if (this.selectedTaskType === 'all') return adapted;
    return adapted.filter(r => r.taskType === this.selectedTaskType);
  });

  public readonly taskTypeOptions = computed<string[]>(() => {
    const raw = adaptModelPerformance(this.modelPerfSignal());
    const types = new Set(raw.map(r => r.taskType));
    return Array.from(types).sort();
  });

  public selectedTaskType: string = 'all';
  public sortColumn: string = '';
  public sortDirection: 'asc' | 'desc' = 'asc';
  public rows: ModelPerfRow[] = [];
  public loading = true;
  public unavailable = false;

  constructor() {
    effect(() => {
      const raw = this.modelPerfSignal();
      this.loading = raw === null && !this.unavailable;
      if (raw === null) {
        this.unavailable = true;
        this.rows = FALLBACK_MODEL_PERF_ROWS;
      } else {
        this.unavailable = false;
        this.rows = this.rowsComputed();
      }
    });
  }

  public sortBy(col: string): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }
    this.rows = [...this.rowsComputed()].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[col];
      const bVal = (b as Record<string, unknown>)[col];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortDirection === 'asc' ? result : -result;
    });
  }

  public onTaskTypeChange(): void {
    this.rows = this.rowsComputed();
  }

  public scoreColor(scoreClass: string): string {
    if (scoreClass === 'score-high') return 'green';
    if (scoreClass === 'score-mid') return 'orange';
    return 'red';
  }
}
