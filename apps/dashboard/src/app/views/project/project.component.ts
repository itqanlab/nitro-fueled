import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, Subject, switchMap, timer, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { MOCK_QUEUE_TASKS } from '../../services/project.constants';
import { SessionsPanelComponent } from './sessions-panel/sessions-panel.component';
import {
  QueueTask,
  QueueTaskPriority,
  QueueTaskStatus,
  QueueTaskType,
  QueueViewMode,
  SortField,
  SortDirection,
} from '../../models/project-queue.model';

const KANBAN_COLUMNS: readonly QueueTaskStatus[] = [
  'CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED',
];

const PRIORITY_ORDER: Record<QueueTaskPriority, number> = {
  'P0-Critical': 0,
  'P1-High': 1,
  'P2-Medium': 2,
  'P3-Low': 3,
};

const STATUS_ORDER: Record<QueueTaskStatus, number> = {
  CREATED: 0, IN_PROGRESS: 1, IMPLEMENTED: 2, IN_REVIEW: 3, FIXING: 4, COMPLETE: 5, FAILED: 6, BLOCKED: 7, CANCELLED: 8,
};

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [FormsModule, NgClass, SessionsPanelComponent],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectComponent implements OnInit {
  private readonly apiService = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private pollSubscription: Subscription | null = null;
  private startSubscription: Subscription | null = null;
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  public readonly allTasks: readonly QueueTask[] = MOCK_QUEUE_TASKS;
  public readonly viewMode = signal<QueueViewMode>('list');
  public readonly searchQuery = signal('');
  public readonly selectedStatuses = signal<readonly QueueTaskStatus[]>([]);
  public readonly selectedTypes = signal<readonly QueueTaskType[]>([]);
  public readonly selectedPriorities = signal<readonly QueueTaskPriority[]>([]);
  public readonly selectedModels = signal<readonly string[]>([]);
  public readonly startDate = signal<string | null>(null);
  public readonly endDate = signal<string | null>(null);
  public readonly sortField = signal<SortField>(SortField.ID);
  public readonly sortDirection = signal<SortDirection>('asc');
  public readonly autoPilotState = signal<'idle' | 'starting' | 'running'>('idle');
  public readonly autoPilotSessionId = signal<string | null>(null);
  public readonly autoPilotError = signal<string | null>(null);

  public readonly allStatuses: readonly QueueTaskStatus[] = KANBAN_COLUMNS;
  public readonly allTypes: readonly QueueTaskType[] = ['FEATURE', 'BUGFIX', 'REFACTOR', 'DOCS', 'TEST', 'CHORE'];
  public readonly allPriorities: readonly QueueTaskPriority[] = ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'];
  public readonly availableModels = computed(() => {
    const models = new Set<string>();
    for (const task of this.allTasks) {
      if (task.model) models.add(task.model);
    }
    return Array.from(models).sort();
  });

  public applyFiltersAndSort(tasks: readonly QueueTask[]): QueueTask[] {
    const query = this.searchQuery().trim().toLowerCase();
    const statuses = this.selectedStatuses();
    const types = this.selectedTypes();
    const priorities = this.selectedPriorities();
    const models = this.selectedModels();
    const start = this.startDate();
    const end = this.endDate();
    const field = this.sortField();
    const dir = this.sortDirection();

    // Apply filters with OR logic for multi-select filters
    const results = tasks.filter(task => {
      // Search filter (OR logic across id, title, description)
      if (query) {
        const matchesId = task.id.toLowerCase().includes(query);
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query) || false;
        if (!matchesId && !matchesTitle && !matchesDesc) return false;
      }

      // Status filter (OR logic)
      if (statuses.length > 0 && !statuses.includes(task.status)) return false;

      // Type filter (OR logic)
      if (types.length > 0 && !types.includes(task.type)) return false;

      // Priority filter (OR logic)
      if (priorities.length > 0 && !priorities.includes(task.priority)) return false;

      // Model filter (OR logic)
      if (models.length > 0 && (task.model === null || !models.includes(task.model))) return false;

      // Date range filter (AND logic)
      if (start) {
        const taskDate = new Date(task.createdAt).getTime();
        const startDate = new Date(start).getTime();
        if (taskDate < startDate) return false;
      }

      if (end) {
        const taskDate = new Date(task.createdAt).getTime();
        const endDate = new Date(end).getTime() + 86400000; // Add one day to include end date
        if (taskDate > endDate) return false;
      }

      return true;
    });

    // Apply sorting
    return this.sortTasks(results, field, dir);
  }

  public compareTasks(a: QueueTask, b: QueueTask, field: SortField, direction: SortDirection): number {
    let cmp = 0;
    
    switch (field) {
      case SortField.ID:
        cmp = a.id.localeCompare(b.id);
        break;
      case SortField.STATUS:
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        break;
      case SortField.PRIORITY:
        cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        break;
      case SortField.CREATED_AT:
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case SortField.TYPE:
        cmp = a.type.localeCompare(b.type);
        break;
    }

    return direction === 'asc' ? cmp : -cmp;
  }

  public sortTasks(tasks: readonly QueueTask[], field: SortField, direction: SortDirection): QueueTask[] {
    return [...tasks].sort((a, b) => this.compareTasks(a, b, field, direction));
  }

  public readonly filteredTasks = computed(() => {
    return this.applyFiltersAndSort(this.allTasks);
  });

  public readonly resultCountText = computed(() => {
    const total = this.allTasks.length;
    const filtered = this.filteredTasks().length;
    const query = this.searchQuery().trim();
    if (filtered === total && !query && this.activeFilterCount() === 0) {
      return `Showing all ${total} tasks`;
    }
    if (query) {
      return `Showing ${filtered} tasks matching '${query}'`;
    }
    return `Showing ${filtered} of ${total} tasks`;
  });

  public readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.searchQuery().trim()) count++;
    if (this.selectedStatuses().length > 0) count++;
    if (this.selectedTypes().length > 0) count++;
    if (this.selectedPriorities().length > 0) count++;
    if (this.selectedModels().length > 0) count++;
    if (this.startDate()) count++;
    if (this.endDate()) count++;
    return count;
  });

  public readonly activeFilterChips = computed(() => {
    const chips: { type: string; label: string; clear: () => void }[] = [];
    const statuses = this.selectedStatuses();
    if (statuses.length > 0) {
      chips.push({
        type: 'Status',
        label: statuses.map(s => this.statusLabelMap[s]).join(', '),
        clear: () => this.selectedStatuses.set([]),
      });
    }
    const types = this.selectedTypes();
    if (types.length > 0) {
      chips.push({
        type: 'Type',
        label: types.join(', '),
        clear: () => this.selectedTypes.set([]),
      });
    }
    const priorities = this.selectedPriorities();
    if (priorities.length > 0) {
      chips.push({
        type: 'Priority',
        label: priorities.join(', '),
        clear: () => this.selectedPriorities.set([]),
      });
    }
    const models = this.selectedModels();
    if (models.length > 0) {
      chips.push({
        type: 'Model',
        label: models.join(', '),
        clear: () => this.selectedModels.set([]),
      });
    }
    if (this.startDate()) {
      chips.push({
        type: 'From',
        label: this.startDate()!,
        clear: () => this.startDate.set(null),
      });
    }
    if (this.endDate()) {
      chips.push({
        type: 'Until',
        label: this.endDate()!,
        clear: () => this.endDate.set(null),
      });
    }
    return chips;
  });

  public readonly runningCount = computed(() => this.allTasks.filter(task => task.status === 'IN_PROGRESS').length);
  public readonly kanbanColumns = computed(() =>
    KANBAN_COLUMNS.map(status => ({ status, tasks: this.filteredTasks().filter(task => task.status === status) }))
  );
  public readonly isAutoPilotBusy = computed(() => this.autoPilotState() !== 'idle');

  public readonly statusClassMap: Record<QueueTaskStatus, string> = {
    CREATED: 'status-created', IN_PROGRESS: 'status-in-progress', IMPLEMENTED: 'status-implemented', IN_REVIEW: 'status-in-review',
    FIXING: 'status-fixing', COMPLETE: 'status-complete', FAILED: 'status-failed', BLOCKED: 'status-blocked', CANCELLED: 'status-cancelled',
  };
  public readonly priorityClassMap: Record<QueueTaskPriority, string> = {
    'P0-Critical': 'priority-critical', 'P1-High': 'priority-high', 'P2-Medium': 'priority-medium', 'P3-Low': 'priority-low',
  };
  public readonly statusLabelMap: Record<QueueTaskStatus, string> = {
    CREATED: 'Created', IN_PROGRESS: 'In Progress', IMPLEMENTED: 'Implemented', IN_REVIEW: 'In Review',
    FIXING: 'Fixing', COMPLETE: 'Complete', FAILED: 'Failed', BLOCKED: 'Blocked', CANCELLED: 'Cancelled',
  };

  public sortFieldOptions: readonly { value: SortField; label: string }[] = [
    { value: SortField.ID, label: 'ID' },
    { value: SortField.STATUS, label: 'Status' },
    { value: SortField.PRIORITY, label: 'Priority' },
    { value: SortField.CREATED_AT, label: 'Created' },
    { value: SortField.TYPE, label: 'Type' },
  ];

  public constructor() {
    this.destroyRef.onDestroy(() => {
      this.startSubscription?.unsubscribe();
      this.stopPolling();
      this.destroy$.next();
      this.destroy$.complete();
    });

    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.syncUrlParams();
    });
  }

  public ngOnInit(): void {
    this.restoreFromUrlParams();
  }

  public setViewMode(mode: QueueViewMode): void {
    this.viewMode.set(mode);
    this.syncUrlParams();
  }

  public onSearchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchInput$.next(event.target.value);
    }
  }

  public toggleStatus(status: QueueTaskStatus): void {
    const current = [...this.selectedStatuses()];
    const idx = current.indexOf(status);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(status);
    }
    this.selectedStatuses.set(current);
    this.syncUrlParams();
  }

  public toggleType(type: QueueTaskType): void {
    const current = [...this.selectedTypes()];
    const idx = current.indexOf(type);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(type);
    }
    this.selectedTypes.set(current);
    this.syncUrlParams();
  }

  public togglePriority(priority: QueueTaskPriority): void {
    const current = [...this.selectedPriorities()];
    const idx = current.indexOf(priority);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(priority);
    }
    this.selectedPriorities.set(current);
    this.syncUrlParams();
  }

  public toggleModel(model: string): void {
    const current = [...this.selectedModels()];
    const idx = current.indexOf(model);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(model);
    }
    this.selectedModels.set(current);
    this.syncUrlParams();
  }

  public onStartDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.startDate.set(val || null);
    this.syncUrlParams();
  }

  public onEndDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.endDate.set(val || null);
    this.syncUrlParams();
  }

  public setSortField(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.syncUrlParams();
  }

  public clearSearch(): void {
    this.searchQuery.set('');
    this.syncUrlParams();
  }

  public clearStatusFilter(): void {
    this.selectedStatuses.set([]);
    this.syncUrlParams();
  }

  public clearTypeFilter(): void {
    this.selectedTypes.set([]);
    this.syncUrlParams();
  }

  public clearPriorityFilter(): void {
    this.selectedPriorities.set([]);
    this.syncUrlParams();
  }

  public clearModelFilter(): void {
    this.selectedModels.set([]);
    this.syncUrlParams();
  }

  public clearDateRange(): void {
    this.startDate.set(null);
    this.endDate.set(null);
    this.syncUrlParams();
  }

  public setDateRange(start: string | null, end: string | null): void {
    this.startDate.set(start);
    this.endDate.set(end);
    this.syncUrlParams();
  }

  public setSort(field: SortField, direction: SortDirection): void {
    this.sortField.set(field);
    this.sortDirection.set(direction);
    this.syncUrlParams();
  }

  public clearAllFilters(): void {
    this.clearSearch();
    this.clearStatusFilter();
    this.clearTypeFilter();
    this.clearPriorityFilter();
    this.clearModelFilter();
    this.clearDateRange();
    this.syncUrlParams();
  }

  public isStatusSelected(status: QueueTaskStatus): boolean {
    return this.selectedStatuses().includes(status);
  }

  public isTypeSelected(type: QueueTaskType): boolean {
    return this.selectedTypes().includes(type);
  }

  public isPrioritySelected(priority: QueueTaskPriority): boolean {
    return this.selectedPriorities().includes(priority);
  }

  public isModelSelected(model: string): boolean {
    return this.selectedModels().includes(model);
  }

  public removeChip(chip: { clear: () => void }): void {
    chip.clear();
    this.syncUrlParams();
  }

  public onTaskClick(task: QueueTask): void {
    void this.router.navigate(['/project/task', task.id]);
  }

  public onStartAutoPilot(): void {
    if (this.isAutoPilotBusy()) {
      return;
    }
    this.autoPilotError.set(null);
    this.autoPilotState.set('starting');
    this.startSubscription?.unsubscribe();
    this.startSubscription = this.apiService.startAutoPilot().subscribe({
      next: ({ sessionId }) => {
        this.autoPilotSessionId.set(sessionId);
        this.startPolling(sessionId);
      },
      error: () => {
        this.autoPilotState.set('idle');
        this.autoPilotSessionId.set(null);
        this.autoPilotError.set('Unable to start Auto-Pilot right now.');
      },
    });
  }

  private syncUrlParams(): void {
    const params: Record<string, string> = {};
    const q = this.searchQuery().trim();
    if (q) params['q'] = q;
    const statuses = this.selectedStatuses();
    if (statuses.length > 0) params['status'] = statuses.join(',');
    const types = this.selectedTypes();
    if (types.length > 0) params['type'] = types.join(',');
    const priorities = this.selectedPriorities();
    if (priorities.length > 0) params['priority'] = priorities.join(',');
    const models = this.selectedModels();
    if (models.length > 0) params['model'] = models.join(',');
    if (this.startDate()) params['startDate'] = this.startDate()!;
    if (this.endDate()) params['endDate'] = this.endDate()!;
    if (this.sortField() !== 'id') params['sort'] = this.sortField();
    if (this.sortDirection() !== 'asc') params['dir'] = this.sortDirection();
    if (this.viewMode() !== 'list') params['view'] = this.viewMode();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true,
    });
  }

  private restoreFromUrlParams(): void {
    const params = this.route.snapshot.queryParamMap;
    if (params.has('q')) this.searchQuery.set(params.get('q')!);
    if (params.has('status')) {
      this.selectedStatuses.set(params.get('status')!.split(',') as QueueTaskStatus[]);
    }
    if (params.has('type')) {
      this.selectedTypes.set(params.get('type')!.split(',') as QueueTaskType[]);
    }
    if (params.has('priority')) {
      this.selectedPriorities.set(params.get('priority')!.split(',') as QueueTaskPriority[]);
    }
    if (params.has('model')) {
      this.selectedModels.set(params.get('model')!.split(','));
    }
    if (params.has('startDate')) this.startDate.set(params.get('startDate'));
    if (params.has('endDate')) this.endDate.set(params.get('endDate'));
    if (params.has('sort')) this.sortField.set(params.get('sort') as SortField);
    if (params.has('dir')) this.sortDirection.set(params.get('dir') as SortDirection);
    if (params.has('view')) this.viewMode.set(params.get('view') as QueueViewMode);
  }

  private startPolling(sessionId: string): void {
    this.stopPolling();
    this.pollSubscription = timer(0, 1500).pipe(switchMap(() => this.apiService.getAutoPilotStatus(sessionId))).subscribe({
      next: ({ status }) => {
        this.autoPilotState.set(status === 'running' ? 'running' : 'starting');
        if (status === 'running') {
          this.stopPolling();
        }
      },
      error: () => {
        this.autoPilotState.set('idle');
        this.autoPilotSessionId.set(null);
        this.autoPilotError.set('Auto-Pilot status polling failed.');
        this.stopPolling();
      },
    });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
