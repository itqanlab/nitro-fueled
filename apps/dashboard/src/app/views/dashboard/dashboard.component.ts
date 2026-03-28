import { Component, computed, effect, inject } from '@angular/core';
import { catchError, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { TaskCardComponent } from '../../shared/task-card/task-card.component';
import { Agent } from '../../models/agent.model';
import { Task } from '../../models/task.model';
import { Project } from '../../models/project.model';
import { AnalyticsSummary } from '../../models/analytics-summary.model';
import type { TaskRecord, DashboardStats } from '../../../../dashboard-api/src/dashboard/dashboard.types';
import {
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  taskRecordToTask,
  statsToAnalyticsSummary,
} from './dashboard.adapters';

interface QuickAction {
  readonly icon: string;
  readonly label: string;
  readonly color: string;
}

interface TeamGroup {
  readonly team: string;
  readonly members: readonly Agent[];
}

const STATIC_PROJECT: Project = {
  id: 'nitro-fueled',
  name: 'nitro-fueled',
  status: 'active',
  taskCount: 0,
  client: 'local',
  stackTags: ['Angular 19', 'NestJS', 'Node.js', 'Nx'],
  teams: ['Engineering'],
};

const FALLBACK_ANALYTICS: AnalyticsSummary = {
  activeTasks: 0,
  activeBreakdown: '0 running',
  completedTasks: 0,
  completedPeriod: 'all time',
  budgetUsed: 0,
  budgetTotal: 100,
  budgetAlertPercent: 80,
  tokensUsed: '0M',
  tokensPeriod: 'all time',
  totalCost: 0,
  clientCost: 0,
  internalCost: 0,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatCardComponent, TaskCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly api = inject(ApiService);

  private readonly registry = toSignal(
    this.api.getRegistry().pipe(catchError(() => of([] as TaskRecord[]))),
    { initialValue: [] as TaskRecord[] },
  );

  private readonly statsSignal = toSignal(
    this.api.getStats().pipe(catchError(() => of(null as DashboardStats | null))),
    { initialValue: null as DashboardStats | null },
  );

  private readonly activeTasksSignal = computed<readonly Task[]>(() =>
    this.registry()
      .filter(r => (ACTIVE_STATUSES as readonly string[]).includes(r.status))
      .map(taskRecordToTask),
  );

  private readonly completedTasksSignal = computed<readonly Task[]>(() =>
    this.registry()
      .filter(r => (COMPLETED_STATUSES as readonly string[]).includes(r.status))
      .map(taskRecordToTask),
  );

  private readonly analyticsSignal = computed<AnalyticsSummary>(() => {
    const s = this.statsSignal();
    if (!s) return FALLBACK_ANALYTICS;
    return statsToAnalyticsSummary(s);
  });

  public readonly project: Project = STATIC_PROJECT;
  public readonly agents: readonly Agent[] = [];
  public readonly activity: readonly never[] = [];

  public readonly quickActions: readonly QuickAction[] = [
    { icon: '+', label: 'New Task', color: 'blue' },
    { icon: '\u25B6', label: 'Run Command', color: 'green' },
    { icon: '\uD83D\uDD0D', label: 'Review Code', color: 'orange' },
    { icon: '\uD83D\uDCC4', label: 'Generate Docs', color: 'purple' },
    { icon: '\uD83D\uDCCA', label: 'View Client Report', color: 'red' },
    { icon: '\uD83D\uDD0E', label: 'Search Learnings', color: 'teal' },
  ];

  public activeTasks: readonly Task[] = [];
  public completedTasks: readonly Task[] = [];
  public analytics: AnalyticsSummary = FALLBACK_ANALYTICS;
  public budgetPercent = 0;
  public teamGroups: readonly TeamGroup[] = [];

  constructor() {
    effect(() => {
      this.activeTasks = this.activeTasksSignal();
      this.completedTasks = this.completedTasksSignal();
      this.analytics = this.analyticsSignal();
      this.budgetPercent =
        this.analytics.budgetTotal > 0
          ? (this.analytics.budgetUsed / this.analytics.budgetTotal) * 100
          : 0;
    });
  }
}
