import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { NgClass, DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { ApiService } from '../../services/api.service';
import type {
  CortexTask,
  CortexTaskTrace,
} from '../../../../../dashboard-api/src/dashboard/cortex.types';
import {
  adaptTaskTrace,
  TaskTraceViewModel,
} from './task-trace.adapters';

@Component({
  selector: 'app-task-trace',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe,
    SlicePipe,
    FormsModule,
    NzTableModule,
    NzSelectModule,
    NzTagModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzStatisticModule,
  ],
  templateUrl: './task-trace.component.html',
  styleUrl: './task-trace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskTraceComponent {
  private readonly api = inject(ApiService);

  private readonly tasksSignal = toSignal(
    this.api
      .getCortexTasks()
      .pipe(catchError(() => of(null as CortexTask[] | null))),
    { initialValue: null as CortexTask[] | null },
  );

  public readonly taskOptions = computed<Array<{ value: string; label: string }>>(() => {
    const tasks = this.tasksSignal();
    if (!tasks) return [];
    return tasks.map(t => ({ value: t.id, label: `${t.id} — ${t.title}` }));
  });

  private readonly selectedTaskId$ = new BehaviorSubject<string | null>(null);

  private readonly traceSignal = toSignal(
    this.selectedTaskId$.pipe(
      switchMap(id =>
        id
          ? this.api
              .getCortexTaskTrace(id)
              .pipe(catchError(() => of(null as CortexTaskTrace | null)))
          : of(null as CortexTaskTrace | null),
      ),
    ),
    { initialValue: null as CortexTaskTrace | null },
  );

  private readonly viewModelComputed = computed<TaskTraceViewModel | null>(() =>
    adaptTaskTrace(this.traceSignal()),
  );

  public selectedTaskId: string | null = null;
  public viewModel: TaskTraceViewModel | null = null;
  public traceLoading = false;

  constructor() {
    effect(() => {
      this.viewModel = this.viewModelComputed();
      this.traceLoading = this.selectedTaskId !== null && this.traceSignal() === null;
    });
  }

  public onTaskSelect(id: string | null): void {
    this.selectedTaskId = id;
    this.selectedTaskId$.next(id);
  }

  public totalCost(): number {
    if (!this.viewModel) return 0;
    return this.viewModel.workers.reduce((acc, w) => acc + w.cost, 0);
  }

  public totalTokens(): number {
    if (!this.viewModel) return 0;
    return this.viewModel.workers.reduce(
      (acc, w) => acc + w.inputTokens + w.outputTokens,
      0,
    );
  }

  public timelineTypeClass(type: string): string {
    const map: Record<string, string> = {
      worker: 'tl-dot--worker',
      phase: 'tl-dot--phase',
      review: 'tl-dot--review',
      fix: 'tl-dot--fix',
      event: 'tl-dot--event',
    };
    return map[type] ?? '';
  }
}
