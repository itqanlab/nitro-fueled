import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgClass, DecimalPipe, SlicePipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, catchError, switchMap } from 'rxjs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { ApiService } from '../../services/api.service';
import type {
  FullTaskData,
  CortexTaskTrace,
  CortexTaskContext,
  PipelineData,
} from '../../models/api.types';
import { adaptTaskDetail } from './task-detail.adapters';
import type { TaskDetailViewModel } from './task-detail.model';

type TaskDataBundle = {
  taskData: FullTaskData | null;
  traceData: CortexTaskTrace | null;
  contextData: CortexTaskContext | null;
  pipelineData: PipelineData | null;
} | null;

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe,
    SlicePipe,
    DatePipe,
    NzTagModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzStatisticModule,
    NzTableModule,
    NzToolTipModule,
    NzDividerModule,
    NzSpinModule,
    NzButtonModule,
  ],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly taskId$ = this.route.paramMap.pipe(
    switchMap(params => of(params.get('taskId'))),
  );

  public readonly taskId = signal<string | null>(null);

  private readonly dataSignal = toSignal(
    this.taskId$.pipe(
      switchMap(id => {
        if (!id) return of(null);
        this.taskId.set(id);
        return forkJoin({
          taskData: this.api.getTask(id).pipe(catchError(() => of(null as FullTaskData | null))),
          traceData: this.api.getCortexTaskTrace(id).pipe(catchError(() => of(null as CortexTaskTrace | null))),
          contextData: this.api.getCortexTaskContext(id).pipe(catchError(() => of(null as CortexTaskContext | null))),
          pipelineData: this.api.getTaskPipeline(id).pipe(catchError(() => of(null as PipelineData | null))),
        });
      }),
    ),
    { initialValue: null as TaskDataBundle },
  );

  private readonly viewModelComputed = computed<TaskDetailViewModel | null>(() => {
    const data = this.dataSignal();
    const id = this.taskId();
    if (!data || !id) return null;
    return adaptTaskDetail(id, data.taskData, data.traceData, data.contextData, data.pipelineData);
  });

  public vm: TaskDetailViewModel | null = null;
  public loading = true;

  public readonly statusColorMap: Record<string, string> = {
    CREATED: 'default',
    IN_PROGRESS: 'processing',
    IMPLEMENTED: 'blue',
    IN_REVIEW: 'orange',
    FIXING: 'warning',
    COMPLETE: 'success',
    FAILED: 'error',
    BLOCKED: 'red',
    CANCELLED: 'default',
  };

  public readonly priorityColorMap: Record<string, string> = {
    'P0-Critical': 'red',
    'P1-High': 'orange',
    'P2-Medium': 'blue',
    'P3-Low': 'default',
  };

  constructor() {
    effect(() => {
      const data = this.dataSignal();
      if (data !== null) {
        this.loading = false;
      }
      this.vm = this.viewModelComputed();
    });
  }

  public goBack(): void {
    void this.router.navigate(['/project']);
  }

  public navigateToTask(taskId: string): void {
    void this.router.navigate(['/project/task', taskId]);
  }

  public formatTokens(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }

  public maxPhaseDuration(): number {
    if (!this.vm) return 1;
    const max = this.vm.phases.reduce(
      (acc, p) => Math.max(acc, p.durationMinutes ?? 0),
      0,
    );
    return max || 1;
  }

  public phaseBarWidth(durationMinutes: number | null): number {
    if (durationMinutes === null) return 0;
    return (durationMinutes / this.maxPhaseDuration()) * 100;
  }
}
