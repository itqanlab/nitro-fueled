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
import { Subject, interval, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { MOCK_QUEUE_TASKS } from '../../services/project.constants';
import { SessionsPanelComponent } from './sessions-panel/sessions-panel.component';
import {
  CreateSessionRequest,
  SessionStatusResponse,
} from '../../models/api.types';
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
  private readonly wsService = inject(WebSocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
  public readonly createSessionPending = signal(false);
  public readonly createSessionError = signal<string | null>(null);
  public readonly sessionFormOpen = signal(false);
  public readonly sessionConfig = signal<CreateSessionRequest>(this.loadSavedConfig());
  public readonly activeSessions = signal<SessionStatusResponse[]>([]);
  public readonly sessionsLoading = signal(false);
  
  // Dropdown open/close signals
  public readonly statusDropdownOpen = signal(false);
  public readonly typeDropdownOpen = signal(false);
  public readonly priorityDropdownOpen = signal(false);
  public readonly modelDropdownOpen = signal(false);

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

    // Pre-compute filter functions for better performance
    const filterFunctions: ((task: QueueTask) => boolean)[] = [];

    // Search filter (OR logic across id, title, description)
    if (query) {
      const searchFilters = [
        (task: QueueTask) => task.id.toLowerCase().includes(query),
        (task: QueueTask) => task.title.toLowerCase().includes(query),
        (task: QueueTask) => (task.description?.toLowerCase().includes(query) || false)
      ];
      filterFunctions.push((task: QueueTask) => searchFilters.some(filter => filter(task)));
    }

    // Status filter (OR logic)
    if (statuses.length > 0) {
      const statusSet = new Set(statuses);
      filterFunctions.push((task: QueueTask) => statusSet.has(task.status));
    }

    // Type filter (OR logic)
    if (types.length > 0) {
      const typeSet = new Set(types);
      filterFunctions.push((task: QueueTask) => typeSet.has(task.type));
    }

    // Priority filter (OR logic)
    if (priorities.length > 0) {
      const prioritySet = new Set(priorities);
      filterFunctions.push((task: QueueTask) => prioritySet.has(task.priority));
    }

    // Model filter (OR logic)
    if (models.length > 0) {
      const modelSet = new Set(models);
      filterFunctions.push((task: QueueTask) => {
        const taskModel = task.model;
        return taskModel ? modelSet.has(taskModel) : false;
      });
    }

    // Date range filter (AND logic)
    if (start || end) {
      const startDate = start ? new Date(start).getTime() : -Infinity;
      const endDate = end ? new Date(end).getTime() + 86400000 : Infinity; // Add one day to include end date
      
      filterFunctions.push((task: QueueTask) => {
        const taskDate = new Date(task.createdAt).getTime();
        return taskDate >= startDate && taskDate <= endDate;
      });
    }

    // Apply filters efficiently
    const results = tasks.filter(task => filterFunctions.every(filter => filter(task)));

    // Apply sorting
    const sortedResults = this.sortTasks(results, field, dir);
    
    return sortedResults;
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
      this.destroy$.next();
      this.destroy$.complete();
    });

    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.updateURL();
    });

    // Subscribe to WebSocket session events for reactive refresh
    this.wsService.events$.pipe(
      filter(event => event.type === 'sessions:changed' || event.type === 'session:update'),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loadSessions());

    // 15s interval fallback for session refresh
    interval(15_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadSessions());
  }

  public ngOnInit(): void {
    this.initializeFromURL();
    this.loadSessions();
  }

  // Dropdown toggle methods
  public toggleStatusDropdown(): void {
    this.statusDropdownOpen.set(!this.statusDropdownOpen());
  }

  public toggleTypeDropdown(): void {
    this.typeDropdownOpen.set(!this.typeDropdownOpen());
  }

  public togglePriorityDropdown(): void {
    this.priorityDropdownOpen.set(!this.priorityDropdownOpen());
  }

  // Sort change handler
  public onSortChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      const lastDash = value.lastIndexOf('-');
      if (lastDash === -1) return;
      const field = value.slice(0, lastDash);
      const direction = value.slice(lastDash + 1);
      const validFields = new Set<string>(Object.values(SortField));
      if (!validFields.has(field) || (direction !== 'asc' && direction !== 'desc')) return;
      this.sortField.set(field as SortField);
      this.sortDirection.set(direction as SortDirection);
      this.updateURL();
    }
  }

  // Selected count methods
  public statusSelectedCount(): number {
    return this.selectedStatuses().length;
  }

  public typeSelectedCount(): number {
    return this.selectedTypes().length;
  }

  public prioritySelectedCount(): number {
    return this.selectedPriorities().length;
  }

  public setViewMode(mode: QueueViewMode): void {
    this.viewMode.set(mode);
    this.updateURL();
  }

  public onSearchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchInput$.next(event.target.value);
    }
  }

  public toggleStatus(status: QueueTaskStatus): void {
    const current = new Set(this.selectedStatuses());
    if (current.has(status)) {
      current.delete(status);
      this.announceFilterChange('Status', `deselected ${status}`);
    } else {
      current.add(status);
      this.announceFilterChange('Status', `selected ${status}`);
    }
    this.selectedStatuses.set(Array.from(current));
    this.updateURL();
  }

  public toggleType(type: QueueTaskType): void {
    const current = new Set(this.selectedTypes());
    if (current.has(type)) {
      current.delete(type);
      this.announceFilterChange('Type', `deselected ${type}`);
    } else {
      current.add(type);
      this.announceFilterChange('Type', `selected ${type}`);
    }
    this.selectedTypes.set(Array.from(current));
    this.updateURL();
  }

  public togglePriority(priority: QueueTaskPriority): void {
    const current = new Set(this.selectedPriorities());
    if (current.has(priority)) {
      current.delete(priority);
      this.announceFilterChange('Priority', `deselected ${priority}`);
    } else {
      current.add(priority);
      this.announceFilterChange('Priority', `selected ${priority}`);
    }
    this.selectedPriorities.set(Array.from(current));
    this.updateURL();
  }

  public toggleModel(model: string): void {
    const current = new Set(this.selectedModels());
    if (current.has(model)) {
      current.delete(model);
      this.announceFilterChange('Model', `deselected ${model}`);
    } else {
      current.add(model);
      this.announceFilterChange('Model', `selected ${model}`);
    }
    this.selectedModels.set(Array.from(current));
    this.updateURL();
  }

  public onStartDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.startDate.set(val || null);
    this.updateURL();
  }

  public onEndDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.endDate.set(val || null);
    this.updateURL();
  }

  public setSortField(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
    this.updateURL();
  }

  public clearSearch(): void {
    this.searchQuery.set('');
    this.updateURL();
  }

  public clearStatusFilter(): void {
    this.selectedStatuses.set([]);
    this.updateURL();
  }

  public clearTypeFilter(): void {
    this.selectedTypes.set([]);
    this.updateURL();
  }

  public clearPriorityFilter(): void {
    this.selectedPriorities.set([]);
    this.updateURL();
  }

  public clearModelFilter(): void {
    this.selectedModels.set([]);
    this.updateURL();
  }

  public clearDateRange(): void {
    this.startDate.set(null);
    this.endDate.set(null);
    this.updateURL();
  }

  public setDateRange(start: string | null, end: string | null): void {
    this.startDate.set(start);
    this.endDate.set(end);
    this.updateURL();
  }

  public setSort(field: SortField, direction: SortDirection): void {
    this.sortField.set(field);
    this.sortDirection.set(direction);
    this.updateURL();
  }

  public clearAllFilters(): void {
    this.clearSearch();
    this.clearStatusFilter();
    this.clearTypeFilter();
    this.clearPriorityFilter();
    this.clearModelFilter();
    this.clearDateRange();
    this.updateURL();
  }

  // Accessibility helper methods
  public announceFilterChange(filterType: string, action: string): void {
    const message = `${filterType} filter ${action}`;
    this.announceToScreenReader(message);
  }

  private announceToScreenReader(message: string): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.textContent = message;
    document.body.appendChild(announcement);

    const timerId = setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearTimeout(timerId));
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
    this.updateURL();
  }

  public onTaskClick(task: QueueTask): void {
    void this.router.navigate(['/project/task', task.id]);
  }

  public openSessionForm(): void {
    this.sessionFormOpen.set(true);
  }

  public closeSessionForm(): void {
    this.sessionFormOpen.set(false);
  }

  public onConcurrencyChange(event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    this.sessionConfig.set({ ...this.sessionConfig(), concurrency: val });
  }

  public onLimitChange(event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    this.sessionConfig.set({ ...this.sessionConfig(), limit: val });
  }

  private readonly VALID_PRIORITIES = ['build-first', 'review-first', 'balanced'] as const;
  private readonly VALID_PROVIDERS = ['claude', 'glm', 'opencode', 'codex'] as const;

  public onPriorityChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (!(this.VALID_PRIORITIES as readonly string[]).includes(val)) return;
    this.sessionConfig.update(c => ({ ...c, priority: val as typeof this.VALID_PRIORITIES[number] }));
  }

  public onImplementProviderChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (!(this.VALID_PROVIDERS as readonly string[]).includes(val)) return;
    this.sessionConfig.update(c => ({ ...c, implementProvider: val as typeof this.VALID_PROVIDERS[number] }));
  }

  public onReviewProviderChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (!(this.VALID_PROVIDERS as readonly string[]).includes(val)) return;
    this.sessionConfig.update(c => ({ ...c, reviewProvider: val as typeof this.VALID_PROVIDERS[number] }));
  }

  public onCreateSession(): void {
    this.createSessionPending.set(true);
    this.createSessionError.set(null);
    this.apiService.createAutoSession(this.sessionConfig()).subscribe({
      next: () => {
        this.saveConfig(this.sessionConfig());
        this.closeSessionForm();
        this.createSessionPending.set(false);
        this.loadSessions();
      },
      error: () => {
        this.createSessionPending.set(false);
        this.createSessionError.set('Failed to create session. Please try again.');
      },
    });
  }

  public onPauseSession(id: string): void {
    this.apiService.pauseAutoSession(id).subscribe({
      next: () => this.loadSessions(),
      error: () => this.loadSessions(),
    });
  }

  public onResumeSession(id: string): void {
    this.apiService.resumeAutoSession(id).subscribe({
      next: () => this.loadSessions(),
      error: () => this.loadSessions(),
    });
  }

  public onStopSession(id: string): void {
    this.apiService.stopAutoSession(id).subscribe({
      next: () => this.loadSessions(),
      error: () => this.loadSessions(),
    });
  }

  public onDrainSession(id: string): void {
    this.apiService.drainSession(id).subscribe({
      next: () => this.loadSessions(),
      error: () => this.loadSessions(),
    });
  }

  private loadSessions(): void {
    this.sessionsLoading.set(true);
    this.apiService.getAutoSessions().subscribe({
      next: (sessions) => {
        this.activeSessions.set(sessions);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsLoading.set(false);
      },
    });
  }

  private saveConfig(config: CreateSessionRequest): void {
    try {
      localStorage.setItem('nitro-session-config', JSON.stringify(config));
    } catch {
      // SecurityError in private browsing — ignore
    }
  }

  private loadSavedConfig(): CreateSessionRequest {
    try {
      const raw = localStorage.getItem('nitro-session-config');
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
      const obj = parsed as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      if (typeof obj['concurrency'] === 'number') result['concurrency'] = obj['concurrency'];
      if (typeof obj['limit'] === 'number') result['limit'] = obj['limit'];
      if (typeof obj['retries'] === 'number') result['retries'] = obj['retries'];
      const validPriorities = ['build-first', 'review-first', 'balanced'] as const;
      if (
        typeof obj['priority'] === 'string' &&
        (validPriorities as readonly string[]).includes(obj['priority'])
      ) {
        result['priority'] = obj['priority'];
      }
      const validProviders = ['claude', 'glm', 'opencode', 'codex'] as const;
      for (const key of ['implementProvider', 'implementFallbackProvider', 'reviewProvider', 'prepProvider']) {
        if (
          typeof obj[key] === 'string' &&
          (validProviders as readonly string[]).includes(obj[key] as string)
        ) {
          result[key] = obj[key];
        }
      }
      for (const key of ['implementModel', 'implementFallbackModel', 'reviewModel', 'prepModel']) {
        if (typeof obj[key] === 'string') {
          result[key] = obj[key];
        }
      }
      return result as CreateSessionRequest;
    } catch {
      return {};
    }
  }

  private updateURL(): void {
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

  private initializeFromURL(): void {
    const params = this.route.snapshot.queryParamMap;
    if (params.has('q')) this.searchQuery.set(params.get('q')!);
    if (params.has('status')) {
      const validStatuses = new Set<string>(this.allStatuses);
      const parsed = params.get('status')!.split(',').filter(s => validStatuses.has(s)) as QueueTaskStatus[];
      if (parsed.length > 0) this.selectedStatuses.set(parsed);
    }
    if (params.has('type')) {
      const validTypes = new Set<string>(this.allTypes);
      const parsed = params.get('type')!.split(',').filter(t => validTypes.has(t)) as QueueTaskType[];
      if (parsed.length > 0) this.selectedTypes.set(parsed);
    }
    if (params.has('priority')) {
      const validPriorities = new Set<string>(this.allPriorities);
      const parsed = params.get('priority')!.split(',').filter(p => validPriorities.has(p)) as QueueTaskPriority[];
      if (parsed.length > 0) this.selectedPriorities.set(parsed);
    }
    if (params.has('model')) {
      this.selectedModels.set(params.get('model')!.split(','));
    }
    if (params.has('startDate')) this.startDate.set(params.get('startDate'));
    if (params.has('endDate')) this.endDate.set(params.get('endDate'));
    if (params.has('sort')) {
      const validSortFields = new Set<string>(Object.values(SortField));
      const sort = params.get('sort')!;
      if (validSortFields.has(sort)) this.sortField.set(sort as SortField);
    }
    if (params.has('dir')) {
      const dir = params.get('dir')!;
      if (dir === 'asc' || dir === 'desc') this.sortDirection.set(dir);
    }
    if (params.has('view')) {
      const view = params.get('view')!;
      if (view === 'list' || view === 'kanban') this.viewMode.set(view);
    }
  }

}