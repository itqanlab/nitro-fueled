import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgClass, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of, catchError, switchMap } from 'rxjs';
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
import type { TaskDetailViewModel, PhaseBarEntry, TaskDataBundle } from './task-detail.model';

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
  private readonly destroyRef = inject(DestroyRef);

  private readonly paramMap = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  public readonly taskId = computed(() => this.paramMap().get('taskId'));

  private readonly dataSignal = toSignal(
    this.route.paramMap.pipe(
      map(params => params.get('taskId')),
      switchMap(id => {
        if (!id) return of(null);
        return forkJoin({
          taskData: this.api.getTask(id).pipe(catchError(() => of(null as FullTaskData | null))),
          traceData: this.api.getCortexTaskTrace(id).pipe(catchError(() => of(null as CortexTaskTrace | null))),
          contextData: this.api.getCortexTaskContext(id).pipe(catchError(() => of(null as CortexTaskContext | null))),
          pipelineData: this.api.getTaskPipeline(id).pipe(catchError(() => of(null as PipelineData | null))),
        });
      }),
    ),
    { initialValue: null as TaskDataBundle | null },
  );

  public readonly loading = computed(() => this.dataSignal() === null);

  public readonly vm = computed<TaskDetailViewModel | null>(() => {
    const data = this.dataSignal();
    const id = this.taskId();
    if (!data || !id) return null;
    if (!data) return null;
    return adaptTaskDetail(id, data.taskData, data.traceData, data.contextData, data.pipelineData);
  });

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

  // ── Model / provider / worker_mode editing ────────────────────────────────
  public readonly editModel = signal<string>('');
  public readonly editProvider = signal<string>('');
  public readonly editWorkerMode = signal<string>('');
  public readonly fieldSaving = signal<string | null>(null);
  public readonly fieldSaveError = signal<string | null>(null);

  public readonly PROVIDER_OPTIONS = ['claude', 'glm', 'opencode', 'codex'] as const;
  public readonly WORKER_MODE_OPTIONS = ['single', 'split'] as const;
  public readonly MODEL_OPTIONS = [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'glm-4.7',
  ] as const;

  public saveTaskField(field: 'model' | 'preferred_provider' | 'worker_mode', value: string | null): void {
    const taskId = this.taskId();
    if (!taskId) return;
    this.fieldSaving.set(field);
    this.fieldSaveError.set(null);
    this.api.updateCortexTask(taskId, { [field]: value || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.fieldSaving.set(null),
        error: () => {
          this.fieldSaving.set(null);
          this.fieldSaveError.set(`Failed to save ${field}`);
        },
      });
  }

  public onModelChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.editModel.set(value);
    this.saveTaskField('model', value);
  }

  public onProviderChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.editProvider.set(value);
    this.saveTaskField('preferred_provider', value);
  }

  public onWorkerModeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.editWorkerMode.set(value);
    this.saveTaskField('worker_mode', value);
  }

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

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    return model.statusTransitions.map(t => {
      const safeStatus = Object.keys(this.statusColorMap).includes(t.to) ? t.to : 'unknown';
      return {
        ...t,
        statusClass: 'tl-status--' + safeStatus.toLowerCase().replace(/_/g, '-'),
        formattedTime: t.timestamp ?? '',
      };
    });
  });

  constructor() {
    // Load custom flows for the override dropdown
    this.api.getCustomFlows().pipe(
      catchError(() => of([] as CustomFlow[])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(flows => this.customFlows.set(flows));

    // Initialize editing fields and flow override from context data
    effect(() => {
      const context = this.dataSignal()?.contextData;
      if (context) {
        this.selectedFlowOverrideId.set(context.custom_flow_id ?? null);
        this.editModel.set(context.model ?? '');
        this.editProvider.set(context.preferred_provider ?? '');
        this.editWorkerMode.set(context.worker_mode ?? '');
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
