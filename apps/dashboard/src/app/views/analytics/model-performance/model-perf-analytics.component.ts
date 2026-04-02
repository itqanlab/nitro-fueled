import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import type {
  AnalyticsModelPerfRow,
  CortexTask,
} from '../../../models/api.types';
import {
  buildHeatMatrix,
  uniqueModels,
  uniqueTaskTypes,
  adaptLauncherCards,
  adaptRecommendationCards,
  type HeatCell,
  type LauncherCard,
  type RecommendationCard,
} from './model-perf-analytics.adapters';

@Component({
  selector: 'app-model-perf-analytics',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './model-perf-analytics.component.html',
  styleUrl: './model-perf-analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelPerfAnalyticsComponent {
  private readonly api = inject(ApiService);

  // ── Data signals ────────────────────────────────────────────────────────────

  private readonly perfRaw = toSignal(
    this.api
      .getAnalyticsModelPerformance()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  private readonly launchersRaw = toSignal(
    this.api
      .getAnalyticsLaunchers()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  private readonly recommendationsRaw = toSignal(
    this.api
      .getAnalyticsRoutingRecommendations()
      .pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  // ── Derived state ───────────────────────────────────────────────────────────

  private readonly perfRows = computed<readonly AnalyticsModelPerfRow[]>(
    () => this.perfRaw()?.data ?? [],
  );

  public readonly models = computed(() => uniqueModels(this.perfRows()));
  public readonly taskTypes = computed(() => uniqueTaskTypes(this.perfRows()));

  private readonly heatMatrix = computed(() =>
    buildHeatMatrix(this.perfRows()),
  );

  public readonly launcherCards = computed<LauncherCard[]>(() =>
    adaptLauncherCards(this.launchersRaw()?.data ?? []),
  );

  public readonly recommendationCards = computed<RecommendationCard[]>(() =>
    adaptRecommendationCards(this.recommendationsRaw()?.recommendations ?? []),
  );

  // ── Selection state ─────────────────────────────────────────────────────────

  public readonly selectedModel = signal<string | null>(null);
  public readonly selectedTaskType = signal<string | null>(null);

  public readonly selectedRows = computed<readonly AnalyticsModelPerfRow[]>(() => {
    const model = this.selectedModel();
    const taskType = this.selectedTaskType();
    if (!model) return [];
    return this.perfRows().filter(
      r => r.model === model && (taskType === null || (r.taskType ?? 'unknown') === taskType),
    );
  });

  private readonly filteredTasksSignal = signal<CortexTask[] | null>(null);
  public readonly filteredTasksLoading = signal(false);

  public get filteredTasks(): CortexTask[] | null {
    return this.filteredTasksSignal();
  }

  // ── Loading / error state ───────────────────────────────────────────────────

  public perfUnavailable = false;
  public perfLoading = true;
  public launchersUnavailable = false;
  public recUnavailable = false;

  constructor() {
    effect(() => {
      const raw = this.perfRaw();
      if (raw !== null) {
        this.perfLoading = false;
        this.perfUnavailable = false;
      } else if (!this.perfLoading) {
        this.perfUnavailable = true;
      }
    });

    effect(() => {
      const raw = this.launchersRaw();
      this.launchersUnavailable = raw === null && !this.perfLoading;
    });

    effect(() => {
      const raw = this.recommendationsRaw();
      this.recUnavailable = raw === null && !this.perfLoading;
    });
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  public getCell(model: string, taskType: string): HeatCell | null {
    return this.heatMatrix().get(model)?.get(taskType) ?? null;
  }

  public selectCell(model: string, taskType: string): void {
    if (this.selectedModel() === model && this.selectedTaskType() === taskType) {
      this.clearSelection();
      return;
    }
    this.selectedModel.set(model);
    this.selectedTaskType.set(taskType);
    this.loadFilteredTasks(taskType);
  }

  public clearSelection(): void {
    this.selectedModel.set(null);
    this.selectedTaskType.set(null);
    this.filteredTasksSignal.set(null);
    this.filteredTasksLoading.set(false);
  }

  private loadFilteredTasks(taskType: string): void {
    this.filteredTasksLoading.set(true);
    this.filteredTasksSignal.set(null);
    this.api
      .getCortexTasks({ type: taskType })
      .pipe(catchError(() => of(null)))
      .subscribe(tasks => {
        this.filteredTasksSignal.set(tasks);
        this.filteredTasksLoading.set(false);
      });
  }

  public trackByModel(_i: number, model: string): string {
    return model;
  }

  public trackByTaskType(_i: number, tt: string): string {
    return tt;
  }

  public trackByLauncher(_i: number, card: LauncherCard): string {
    return card.launcher;
  }

  public trackByTaskType2(_i: number, card: RecommendationCard): string {
    return card.taskType;
  }

  public trackByTaskId(_i: number, task: CortexTask): string {
    return task.id;
  }
}
