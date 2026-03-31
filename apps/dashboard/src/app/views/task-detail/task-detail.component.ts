import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgClass, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  CustomFlow,
} from '../../models/api.types';
import { adaptTaskDetail } from './task-detail.adapters';
import type { TaskDetailViewModel, PhaseBarEntry } from './task-detail.model';

type TaskDataBundle = {
  taskData: FullTaskData | null;
  traceData: CortexTaskTrace | null;
  contextData: CortexTaskContext | null;
  pipelineData: PipelineData | null;
} | null;

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe,
    DatePipe,
    FormsModule,
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

  public readonly vm = signal<TaskDetailViewModel | null>(null);
  public readonly loading = signal(true);

  public readonly statusColorMap: Readonly<Record<string, string>> = {
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

  public readonly priorityColorMap: Readonly<Record<string, string>> = {
    'P0-Critical': 'red',
    'P1-High': 'orange',
    'P2-Medium': 'blue',
    'P3-Low': 'default',
  };

  public readonly formattedInputTokens = computed(() => {
    const model = this.vm();
    return model ? formatTokenCount(model.totalInputTokens) : '0';
  });

  public readonly formattedOutputTokens = computed(() => {
    const model = this.vm();
    return model ? formatTokenCount(model.totalOutputTokens) : '0';
  });

  public readonly phaseBars = computed<readonly PhaseBarEntry[]>(() => {
    const model = this.vm();
    if (!model || model.phases.length === 0) return [];
    const maxDuration = model.phases.reduce(
      (acc, p) => Math.max(acc, p.durationMinutes ?? 0),
      0,
    ) || 1;
    return model.phases
      .filter(p => p.durationMinutes !== null)
      .map(p => ({
        phase: p.phase,
        durationMinutes: p.durationMinutes!,
        widthPercent: (p.durationMinutes! / maxDuration) * 100,
      }));
  });

  // ── Flow override ─────────────────────────────────────────────────────────
  public readonly customFlows = signal<CustomFlow[]>([]);
  public readonly selectedFlowOverrideId = signal<string | null>(null);
  public readonly overrideSaving = signal(false);

  public handleFlowOverrideChange(event: Event): void {
    const flowId = (event.target as HTMLSelectElement).value;
    const taskId = this.taskId();
    if (!taskId) return;

    this.overrideSaving.set(true);
    const request$ = flowId
      ? this.api.setTaskFlowOverride(taskId, flowId)
      : this.api.clearTaskFlowOverride(taskId);

    request$.subscribe({
      next: () => {
        this.selectedFlowOverrideId.set(flowId || null);
        this.overrideSaving.set(false);
      },
      error: (err: unknown) => {
        console.warn('[TaskDetail] flow override update failed:', err);
        this.overrideSaving.set(false);
      },
    });
  }

  public readonly selectedFlowOverrideName = computed<string | null>(() => {
    const id = this.selectedFlowOverrideId();
    if (!id) return null;
    return this.customFlows().find(f => f.id === id)?.name ?? null;
  });

  public readonly workerRows = computed(() => {
    const model = this.vm();
    if (!model) return [];
    return model.workers.map(w => ({
      ...w,
      idTruncated: w.id.length > 12 ? w.id.slice(0, 12) + '\u2026' : w.id,
      sessionIdTruncated: w.sessionId.length > 24 ? w.sessionId.slice(0, 24) + '\u2026' : w.sessionId,
    }));
  });

  public readonly transitionNodes = computed(() => {
    const model = this.vm();
    if (!model) return [];
    return model.statusTransitions.map(t => ({
      ...t,
      statusClass: 'tl-status--' + t.to.toLowerCase().replace(/_/g, '-'),
      formattedTime: t.timestamp ? new Date(t.timestamp).toLocaleString() : '',
    }));
  });

  constructor() {
    effect(() => {
      const data = this.dataSignal();
      if (data !== null) {
        this.loading.set(false);
      }
      this.vm.set(this.viewModelComputed());
    });

    // Load custom flows for the override dropdown
    this.api.getCustomFlows().pipe(
      catchError(() => of([] as CustomFlow[])),
    ).subscribe(flows => this.customFlows.set(flows));

    // Initialize the selected override from context data
    effect(() => {
      const context = this.dataSignal()?.contextData;
      if (context && 'custom_flow_id' in context) {
        this.selectedFlowOverrideId.set((context as { custom_flow_id?: string | null }).custom_flow_id ?? null);
      }
    });
  }

  public goBack(): void {
    void this.router.navigate(['/project']);
  }

  public navigateToTask(taskId: string): void {
    void this.router.navigate(['/project/task', taskId]);
  }
}
