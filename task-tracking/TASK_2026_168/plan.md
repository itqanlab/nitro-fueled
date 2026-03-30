# Implementation Plan: Enhanced Project Tasks List with Search and Filtering

## Executive Summary

This plan outlines the implementation of comprehensive search and rich filtering capabilities for the project tasks list page. The enhancement follows a **Frontend-First** approach to deliver immediate value, with optional Backend integration to support large-scale datasets.

### Key Requirements Addressed
1. ✅ Full-Text Search (ID, title, description) with 300ms debounce
2. ✅ Multi-Select Status Filter (OR logic)
3. ✅ Multi-Select Type Filter (OR logic)
4. ✅ Multi-Select Priority Filter (P0-P3)
5. ✅ Date Range Filter (start/end date)
6. ✅ Model Filter (deferred if model field unavailable)
7. ✅ Sort Options (ID, status, priority, creation date, type)
8. ✅ Active Filter Chips (removable chips with clear all)
9. ✅ URL Query Parameter Persistence (state restoration)
10. ✅ Result Count Display (X of Y tasks)

---

## Architecture Approach

### Design Principles
- **Frontend-First**: Implement client-side filtering immediately for fast iteration
- **Angular Signals**: Use reactive signals for all filter state
- **RxJS Debounce**: Apply 300ms debounce to search input
- **URL Persistence**: Sync filter state with ActivatedRoute query params
- **Type Safety**: Leverage TypeScript enums and interfaces
- **Accessibility**: WCAG 2.1 AA compliance with ARIA attributes
- **Performance**: Filter operations under 100ms for up to 500 tasks

### State Management Pattern
```typescript
// Filter State Structure (signals)
searchQuery: Signal<string>
selectedStatuses: Signal<Set<QueueTaskStatus>>
selectedTypes: Signal<Set<QueueTaskType>>
selectedPriorities: Signal<Set<QueueTaskPriority>>
selectedModels: Signal<Set<string>>
dateRange: Signal<{start: string | null, end: string | null}>
sortConfig: Signal<{field: SortField, direction: 'asc' | 'desc'}>

// Derived State (computed)
filteredTasks: ComputedSignal<QueueTask[]>
activeFilterChips: ComputedSignal<FilterChip[]>
resultCount: ComputedSignal<{filtered: number, total: number}>
```

### URL Query Parameter Schema
```
?search=task+keyword
&status=IN_PROGRESS,CREATED
&type=FEATURE,BUGFIX
&priority=P0-Critical,P1-High
&model=claude-3.5-sonnet,gpt-4
&startDate=2024-01-01
&endDate=2024-12-31
&sort=createdAt
&direction=desc
```

---

## Implementation Steps

### Phase 1: Data Model Extensions

#### 1.1 Extend `project-queue.model.ts`

**File**: `apps/dashboard/src/app/models/project-queue.model.ts`

**Changes**:
- Add `QueueTask` extension with optional fields
- Add filter-related type definitions
- Add sort configuration types

```typescript
// Add to existing file
export interface QueueTaskExtended extends QueueTask {
  readonly description?: string;
  readonly created?: string; // ISO 8601 date string
  readonly model?: string;
}

export type SortField =
  | 'id'
  | 'status'
  | 'priority'
  | 'createdAt'
  | 'type';

export interface SortConfig {
  readonly field: SortField;
  readonly direction: 'asc' | 'desc';
}

export interface FilterChips {
  readonly key: string;
  readonly label: string;
  readonly value: string | readonly string[];
  readonly onRemove: () => void;
}

export interface DateRange {
  readonly start: string | null;
  readonly end: string | null;
}
```

**Rationale**: Maintains backward compatibility while adding required fields for filtering.

---

### Phase 2: Component State and Logic

#### 2.1 Update `project.component.ts`

**File**: `apps/dashboard/src/app/views/project/project.component.ts`

**Key Changes**:

1. **Add Imports**:
   - `ActivatedRoute`, `Router` from `@angular/router`
   - `debounceTime`, `distinctUntilChanged` from `rxjs/operators`
   - `Subject` from 'rxjs'
   - Filter types from extended model

2. **Add Filter Signals**:
```typescript
private readonly searchSubject = new Subject<string>();
public readonly searchQuery = signal('');
public readonly selectedStatuses = signal<Set<QueueTaskStatus>>(new Set());
public readonly selectedTypes = signal<Set<QueueTaskType>>(new Set());
public readonly selectedPriorities = signal<Set<QueueTaskPriority>>(new Set());
public readonly selectedModels = signal<Set<string>>(new Set());
public readonly dateRange = signal<DateRange>({ start: null, end: null });
public readonly sortConfig = signal<SortConfig>({ field: 'createdAt', direction: 'desc' });
```

3. **Implement Computed Signals**:
```typescript
public readonly filteredTasks = computed(() => {
  const tasks = this.allTasks;
  const query = this.searchQuery().trim().toLowerCase();
  const statuses = this.selectedStatuses();
  const types = this.selectedTypes();
  const priorities = this.selectedPriorities();
  const models = this.selectedModels();
  const range = this.dateRange();
  const sort = this.sortConfig();

  return this.applyFiltersAndSort(tasks, query, statuses, types, priorities, models, range, sort);
});

public readonly resultCount = computed(() => ({
  filtered: this.filteredTasks().length,
  total: this.allTasks.length,
}));

public readonly activeFilterChips = computed(() => {
  const chips: FilterChips[] = [];
  const query = this.searchQuery().trim();
  const statuses = this.selectedStatuses();
  const types = this.selectedTypes();
  const priorities = this.selectedPriorities();
  const models = this.selectedModels();
  const range = this.dateRange();

  if (query) {
    chips.push({
      key: 'search',
      label: 'Search',
      value: query,
      onRemove: () => this.clearSearch()
    });
  }

  if (statuses.size > 0) {
    chips.push({
      key: 'status',
      label: 'Status',
      value: Array.from(statuses),
      onRemove: () => this.clearStatuses()
    });
  }

  // Similar for types, priorities, models, dateRange
  return chips;
});
```

4. **Add Filter Logic Methods**:
```typescript
private applyFiltersAndSort(
  tasks: readonly QueueTask[],
  query: string,
  statuses: Set<QueueTaskStatus>,
  types: Set<QueueTaskType>,
  priorities: Set<QueueTaskPriority>,
  models: Set<string>,
  range: DateRange,
  sort: SortConfig
): QueueTask[] {
  let result = [...tasks];

  // Search filter
  if (query) {
    result = result.filter(task =>
      task.id.toLowerCase().includes(query) ||
      task.title.toLowerCase().includes(query) ||
      (task as QueueTaskExtended).description?.toLowerCase().includes(query)
    );
  }

  // Status filter (OR logic)
  if (statuses.size > 0) {
    result = result.filter(task => statuses.has(task.status));
  }

  // Type filter (OR logic)
  if (types.size > 0) {
    result = result.filter(task => types.has(task.type));
  }

  // Priority filter (OR logic)
  if (priorities.size > 0) {
    result = result.filter(task => priorities.has(task.priority));
  }

  // Model filter (OR logic) - deferred if model unavailable
  if (models.size > 0) {
    result = result.filter(task => {
      const taskModel = (task as QueueTaskExtended).model;
      return taskModel ? models.has(taskModel) : false;
    });
  }

  // Date range filter
  if (range.start || range.end) {
    result = result.filter(task => {
      const created = (task as QueueTaskExtended).created;
      if (!created) return true; // If no date, include unless filtered out by other criteria
      const taskDate = new Date(created);
      if (range.start && taskDate < new Date(range.start)) return false;
      if (range.end && taskDate > new Date(range.end)) return false;
      return true;
    });
  }

  // Sorting
  result.sort((a, b) => this.compareTasks(a, b, sort.field, sort.direction));

  return result;
}

private compareTasks(a: QueueTask, b: QueueTask, field: SortField, direction: 'asc' | 'desc'): number {
  let comparison = 0;

  switch (field) {
    case 'id':
      comparison = a.id.localeCompare(b.id);
      break;
    case 'status':
      const statusOrder = ['CREATED', 'IN_PROGRESS', 'IMPLEMENTED', 'IN_REVIEW', 'FIXING', 'COMPLETE', 'FAILED', 'BLOCKED', 'CANCELLED'];
      comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      break;
    case 'priority':
      const priorityOrder = ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'];
      comparison = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      break;
    case 'createdAt':
      const aDate = new Date((a as QueueTaskExtended).created || '');
      const bDate = new Date((b as QueueTaskExtended).created || '');
      comparison = aDate.getTime() - bDate.getTime();
      break;
    case 'type':
      comparison = a.type.localeCompare(b.type);
      break;
  }

  return direction === 'desc' ? -comparison : comparison;
}
```

5. **Add Search Debounce**:
```typescript
public constructor() {
  // ... existing constructor code

  // Setup search debounce
  this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged()
  ).subscribe(query => {
    this.searchQuery.set(query);
    this.updateURL();
  });

  // Initialize from URL
  this.initializeFromURL();
}

public onSearchInput(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    this.searchSubject.next(event.target.value);
  }
}
```

6. **Add Filter State Management**:
```typescript
public toggleStatus(status: QueueTaskStatus): void {
  const current = new Set(this.selectedStatuses());
  if (current.has(status)) {
    current.delete(status);
  } else {
    current.add(status);
  }
  this.selectedStatuses.set(current);
  this.updateURL();
}

public toggleType(type: QueueTaskType): void {
  const current = new Set(this.selectedTypes());
  if (current.has(type)) {
    current.delete(type);
  } else {
    current.add(type);
  }
  this.selectedTypes.set(current);
  this.updateURL();
}

public togglePriority(priority: QueueTaskPriority): void {
  const current = new Set(this.selectedPriorities());
  if (current.has(priority)) {
    current.delete(priority);
  } else {
    current.add(priority);
  }
  this.selectedPriorities.set(current);
  this.updateURL();
}

public setDateRange(start: string | null, end: string | null): void {
  this.dateRange.set({ start, end });
  this.updateURL();
}

public setSort(field: SortField, direction: 'asc' | 'desc'): void {
  this.sortConfig.set({ field, direction });
  this.updateURL();
}

public clearAllFilters(): void {
  this.selectedStatuses.set(new Set());
  this.selectedTypes.set(new Set());
  this.selectedPriorities.set(new Set());
  this.selectedModels.set(new Set());
  this.dateRange.set({ start: null, end: null });
  this.searchQuery.set('');
  this.updateURL();
}

public clearSearch(): void {
  this.searchQuery.set('');
  this.updateURL();
}

public clearStatuses(): void {
  this.selectedStatuses.set(new Set());
  this.updateURL();
}
```

7. **Add URL Persistence**:
```typescript
private initializeFromURL(): void {
  const params = this.activatedRoute.snapshot.queryParams;

  if (params['search']) {
    this.searchQuery.set(params['search']);
  }

  if (params['status']) {
    const statuses = Array.isArray(params['status'])
      ? params['status']
      : (params['status'] as string).split(',');
    this.selectedStatuses.set(new Set(statuses as QueueTaskStatus[]));
  }

  if (params['type']) {
    const types = Array.isArray(params['type'])
      ? params['type']
      : (params['type'] as string).split(',');
    this.selectedTypes.set(new Set(types as QueueTaskType[]));
  }

  if (params['priority']) {
    const priorities = Array.isArray(params['priority'])
      ? params['priority']
      : (params['priority'] as string).split(',');
    this.selectedPriorities.set(new Set(priorities as QueueTaskPriority[]));
  }

  if (params['model']) {
    const models = Array.isArray(params['model'])
      ? params['model']
      : (params['model'] as string).split(',');
    this.selectedModels.set(new Set(models));
  }

  if (params['startDate'] || params['endDate']) {
    this.dateRange.set({
      start: params['startDate'] || null,
      end: params['endDate'] || null
    });
  }

  if (params['sort']) {
    this.sortConfig.set({
      field: params['sort'] as SortField,
      direction: params['direction'] === 'asc' ? 'asc' : 'desc'
    });
  }
}

private updateURL(): void {
  const queryParams: Record<string, string | string[]> = {};

  const query = this.searchQuery().trim();
  if (query) queryParams['search'] = query;

  const statuses = Array.from(this.selectedStatuses());
  if (statuses.length > 0) queryParams['status'] = statuses;

  const types = Array.from(this.selectedTypes());
  if (types.length > 0) queryParams['type'] = types;

  const priorities = Array.from(this.selectedPriorities());
  if (priorities.length > 0) queryParams['priority'] = priorities;

  const models = Array.from(this.selectedModels());
  if (models.length > 0) queryParams['model'] = models;

  const range = this.dateRange();
  if (range.start) queryParams['startDate'] = range.start;
  if (range.end) queryParams['endDate'] = range.end;

  const sort = this.sortConfig();
  queryParams['sort'] = sort.field;
  queryParams['direction'] = sort.direction;

  this.router.navigate([], {
    relativeTo: this.activatedRoute,
    queryParams,
    queryParamsHandling: 'merge',
    replaceUrl: true
  });
}
```

8. **Update Constructor**:
```typescript
public constructor(
  private readonly router: Router,
  private readonly activatedRoute: ActivatedRoute,
  // ... existing dependencies
) {
  // ... existing code

  // Setup search debounce
  this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged()
  ).subscribe(query => {
    this.searchQuery.set(query);
    this.updateURL();
  });

  // Initialize from URL
  this.initializeFromURL();
}
```

---

### Phase 3: UI Implementation

#### 3.1 Update `project.component.html`

**File**: `apps/dashboard/src/app/views/project/project.component.html`

**Key Changes**:

1. **Add Result Count Display** (after page header):
```html
<!-- Result Count Display -->
<div class="result-count" role="status" aria-live="polite">
  @if (resultCount().filtered === 0) {
    <span class="result-count-empty">No tasks match your filters</span>
    <button class="btn-text" (click)="clearAllFilters()">Clear all filters</button>
  } @else if (resultCount().filtered === resultCount().total) {
    <span class="result-count-all">Showing all {{ resultCount().total }} tasks</span>
  } @else if (searchQuery()) {
    <span>Showing {{ resultCount().filtered }} task{{ resultCount().filtered !== 1 ? 's' : '' }} matching '{{ searchQuery() }}'</span>
  } @else {
    <span>Showing {{ resultCount().filtered }} of {{ resultCount().total }} tasks</span>
  }
</div>
```

2. **Add Active Filter Chips** (before task list):
```html
<!-- Active Filter Chips -->
@if (activeFilterChips().length > 0) {
  <div class="active-filters" role="region" aria-label="Active filters">
    <div class="filter-chips-list">
      @for (chip of activeFilterChips(); track chip.key) {
        <button
          class="filter-chip active"
          type="button"
          [attr.aria-label]="'Remove ' + chip.label + ' filter'"
          (click)="chip.onRemove()"
        >
          <span class="filter-chip-label">{{ chip.label }}:</span>
          <span class="filter-chip-value">{{ Array.isArray(chip.value) ? chip.value.join(', ') : chip.value }}</span>
          <span class="filter-chip-close" aria-hidden="true">&times;</span>
        </button>
      }
    </div>
    <button
      class="btn-text btn-text--small"
      type="button"
      (click)="clearAllFilters()"
    >
      Clear all
    </button>
  </div>
}
```

3. **Enhanced Toolbar** (replace existing toolbar):
```html
<!-- Enhanced Toolbar -->
<div class="toolbar">
  <div class="toolbar-left">
    <!-- Search input (debounced) -->
    <div class="search-wrapper">
      <span class="search-icon" aria-hidden="true">&#x2315;</span>
      <input
        class="search-input"
        type="search"
        placeholder="Search by ID, title, or description..."
        aria-label="Search tasks"
        [value]="searchQuery()"
        (input)="onSearchInput($event)"
      />
    </div>

    <!-- Filter dropdowns -->
    <div class="filter-dropdowns">
      <!-- Status filter -->
      <div class="filter-dropdown">
        <button
          class="filter-dropdown-trigger"
          type="button"
          [attr.aria-expanded]="false"
          aria-haspopup="listbox"
        >
          Status
          @if (selectedStatuses().size > 0) {
            <span class="filter-badge">{{ selectedStatuses().size }}</span>
          }
        </button>
        <!-- Status filter options dropdown (simplified) -->
        <div class="filter-options" role="listbox">
          @for (status of KANBAN_COLUMNS; track status) {
            <label class="filter-option">
              <input
                type="checkbox"
                [checked]="selectedStatuses().has(status)"
                (change)="toggleStatus(status)"
              />
              <span>{{ statusLabelMap[status] }}</span>
            </label>
          }
        </div>
      </div>

      <!-- Type filter -->
      <div class="filter-dropdown">
        <button class="filter-dropdown-trigger" type="button">
          Type
          @if (selectedTypes().size > 0) {
            <span class="filter-badge">{{ selectedTypes().size }}</span>
          }
        </button>
        <!-- Type filter options -->
        <div class="filter-options" role="listbox">
          @for (type of taskTypes; track type) {
            <label class="filter-option">
              <input
                type="checkbox"
                [checked]="selectedTypes().has(type)"
                (change)="toggleType(type)"
              />
              <span>{{ type }}</span>
            </label>
          }
        </div>
      </div>

      <!-- Priority filter -->
      <div class="filter-dropdown">
        <button class="filter-dropdown-trigger" type="button">
          Priority
          @if (selectedPriorities().size > 0) {
            <span class="filter-badge">{{ selectedPriorities().size }}</span>
          }
        </button>
        <!-- Priority filter options -->
        <div class="filter-options" role="listbox">
          @for (priority of priorities; track priority) {
            <label class="filter-option">
              <input
                type="checkbox"
                [checked]="selectedPriorities().has(priority)"
                (change)="togglePriority(priority)"
              />
              <span>{{ priority }}</span>
            </label>
          }
        </div>
      </div>

      <!-- Date range filter -->
      <div class="filter-dropdown">
        <button class="filter-dropdown-trigger" type="button">
          Date Range
          @if (dateRange().start || dateRange().end) {
            <span class="filter-badge">•</span>
          }
        </button>
        <!-- Date range options -->
        <div class="filter-options filter-options--date">
          <div class="date-range-inputs">
            <label>
              <span>From:</span>
              <input
                type="date"
                [value]="dateRange().start || ''"
                (change)="setDateRange($any($event.target).value, dateRange().end)"
              />
            </label>
            <label>
              <span>To:</span>
              <input
                type="date"
                [value]="dateRange().end || ''"
                (change)="setDateRange(dateRange().start, $any($event.target).value)"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="toolbar-right">
    <!-- Sort dropdown -->
    <div class="sort-dropdown">
      <select
        class="sort-select"
        [value]="sortConfig().field + '-' + sortConfig().direction"
        (change)="onSortChange($event)"
      >
        <option value="createdAt-desc">Date: Newest</option>
        <option value="createdAt-asc">Date: Oldest</option>
        <option value="id-asc">ID: A-Z</option>
        <option value="id-desc">ID: Z-A</option>
        <option value="status-asc">Status</option>
        <option value="priority-asc">Priority</option>
        <option value="type-asc">Type</option>
      </select>
    </div>

    <!-- View mode toggle (existing) -->
    <div class="view-toggle" role="group" aria-label="View mode">
      <button
        class="view-btn"
        type="button"
        [class.active]="viewMode() === 'list'"
        aria-label="List view"
        (click)="setViewMode('list')"
      >
        &#x2630;
      </button>
      <button
        class="view-btn"
        type="button"
        [class.active]="viewMode() === 'kanban'"
        aria-label="Kanban view"
        (click)="setViewMode('kanban')"
      >
        &#x2016;
      </button>
    </div>
  </div>
</div>
```

4. **Add Sort Change Handler** (to component):
```typescript
public onSortChange(event: Event): void {
  if (event.target instanceof HTMLSelectElement) {
    const [field, direction] = event.target.value.split('-');
    this.setSort(field as SortField, direction as 'asc' | 'desc');
  }
}

public readonly taskTypes: readonly QueueTaskType[] = ['FEATURE', 'BUGFIX', 'REFACTOR', 'DOCS', 'TEST', 'CHORE'];
public readonly priorities: readonly QueueTaskPriority[] = ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'];
```

---

#### 3.2 Update `project.component.scss`

**File**: `apps/dashboard/src/app/views/project/project.component.scss`

**Add Styles**:

```scss
/* Result Count Display */
.result-count {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--text-primary);

  .result-count-empty {
    color: var(--text-secondary);
  }

  .result-count-all {
    color: var(--text-primary);
  }
}

.btn-text {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;

  &:hover {
    color: var(--accent);
  }

  &--small {
    font-size: 11px;
  }
}

/* Active Filter Chips */
.active-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.filter-chips-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.filter-chip {
  &.active {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    background: var(--accent-bg);
    border-color: var(--accent);
    color: var(--accent);

    &:hover {
      background: var(--accent);
      color: var(--text-on-accent, #fff);
    }
  }

  .filter-chip-label {
    opacity: 0.7;
  }

  .filter-chip-value {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-chip-close {
    font-size: 16px;
    line-height: 1;
    margin-left: 2px;
  }
}

/* Filter Dropdowns */
.filter-dropdowns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-dropdown {
  position: relative;

  .filter-dropdown-trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .filter-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: var(--accent-bg);
      color: var(--accent);
      font-size: 10px;
      font-weight: 600;
    }
  }

  .filter-options {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 180px;
    max-height: 300px;
    overflow-y: auto;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 10;
    padding: 6px 0;

    .filter-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      transition: background 0.1s;

      &:hover {
        background: var(--bg-secondary);
      }

      input[type="checkbox"] {
        margin: 0;
      }

      span {
        font-size: 12px;
        color: var(--text-primary);
      }
    }

    &--date {
      padding: 12px;

      .date-range-inputs {
        display: flex;
        flex-direction: column;
        gap: 10px;

        label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 11px;
          color: var(--text-secondary);

          input[type="date"] {
            padding: 4px 8px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 12px;

            &:focus {
              outline: none;
              border-color: var(--accent);
            }
          }
        }
      }
    }
  }
}

/* Sort Dropdown */
.sort-dropdown {
  .sort-select {
    padding: 6px 32px 6px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;

    &:focus {
      outline: none;
      border-color: var(--accent);
    }
  }
}

/* Responsive Updates */
@media (max-width: 768px) {
  .filter-dropdowns {
    width: 100%;

    .filter-dropdown {
      flex: 1;
      min-width: 120px;
    }
  }

  .active-filters {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-chips-list {
    width: 100%;
  }
}
```

---

### Phase 4: Data Preparation

#### 4.1 Update Mock Data

**File**: `apps/dashboard/src/app/services/project.constants.ts`

**Changes**: Add optional fields to support filtering
```typescript
export const MOCK_QUEUE_TASKS: readonly (QueueTask & QueueTaskExtended)[] = [
  {
    id: 'TASK_2026_155',
    title: 'Project Page — Task Queue Board',
    status: 'IN_PROGRESS',
    type: 'FEATURE',
    priority: 'P1-High',
    phase: 'Dev',
    sessionId: 'SESSION_2026-03-30_04-52-28',
    lastActivity: '2 min ago',
    description: 'Implement task queue board with list and kanban views',
    created: '2024-03-28T10:30:00Z',
    model: 'claude-3.5-sonnet'
  },
  // ... add description, created, model to other tasks
];
```

---

### Phase 5: Testing Strategy

#### 5.1 Manual Testing Checklist

**Requirement 1 - Full-Text Search**:
- [ ] Type into search bar and observe 300ms delay before filtering
- [ ] Search by task ID (e.g., "TASK_2026")
- [ ] Search by title (e.g., "Task Queue")
- [ ] Search by description (e.g., "implement")
- [ ] Clear search returns all tasks
- [ ] Empty search state shows "No tasks match your filters"

**Requirement 2 - Multi-Select Status**:
- [ ] Select multiple statuses and verify OR logic
- [ ] Deselect a status and verify exclusion
- [ ] Clear all statuses shows all tasks
- [ ] Combine with other filters (AND logic)

**Requirement 3 - Multi-Select Type**:
- [ ] View all task types from QueueTaskType enum
- [ ] Select multiple types and verify OR logic
- [ ] Types without tasks are still displayed
- [ ] Combine with other filters

**Requirement 4 - Priority Filter**:
- [ ] Select "P0-Critical" shows only critical tasks
- [ ] Select multiple priorities works correctly
- [ ] Combine with other filters

**Requirement 5 - Date Range**:
- [ ] Select start date filters tasks on/after date
- [ ] Select end date filters tasks on/before date
- [ ] Both dates filters within range (inclusive)
- [ ] No dates shows all tasks

**Requirement 6 - Model Filter**:
- [ ] Dropdown shows available models
- [ ] Select model filters tasks by model
- [ ] Tasks without model are excluded when model selected
- [ ] If model field unavailable, verify this is deferred

**Requirement 7 - Sort Options**:
- [ ] Sort by ID (alphabetical)
- [ ] Sort by Status (KANBAN_COLUMNS order)
- [ ] Sort by Priority (P0 first, P3 last)
- [ ] Sort by Creation Date (newest/oldest)
- [ ] Sort by Type (alphabetical)
- [ ] Toggle direction reverses order
- [ ] Sorting works with filtered results

**Requirement 8 - Active Filter Chips**:
- [ ] Chips appear for each active filter
- [ ] Clicking chip removes that filter
- [ ] "Clear All" button resets all filters
- [ ] No chips when no filters active
- [ ] Chips show type and value

**Requirement 9 - URL Persistence**:
- [ ] Applying filters updates URL query params
- [ ] Loading page with URL params restores filter state
- [ ] Multiple values use comma-separated format
- [ ] Navigate to task detail and back maintains filters
- [ ] Clear all filters removes query params

**Requirement 10 - Result Count**:
- [ ] Shows "Showing X of Y tasks" with filters
- [ ] Shows "Showing all Y tasks" without filters
- [ ] Shows "No tasks match your filters" with clear link
- [ ] Shows "Showing X tasks matching '{query}'" with search

**Performance**:
- [ ] Filter operations complete under 100ms (500 tasks)
- [ ] Search debounces properly (300ms)
- [ ] No visible delay on URL updates

**Accessibility**:
- [ ] All controls keyboard accessible (Tab, Enter, Space, Escape)
- [ ] ARIA attributes present (role, aria-pressed, aria-selected)
- [ ] Filter changes announced to screen readers
- [ ] Color independence in filter state indicators

**Responsive Design**:
- [ ] Filters work on 768px screens
- [ ] Dropdowns remain usable on mobile
- [ ] Filter chips wrap properly
- [ ] Search input expands on mobile

---

### Phase 6: Optional Backend Enhancement

#### 6.1 Backend API Enhancement (Future Phase)

**When to Implement**: When task count exceeds 500 or when server-side filtering is needed for performance.

**File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts`

**Changes**: Enhance `getCortexTasks` endpoint to accept additional filter parameters

```typescript
@ApiTags('cortex')
@ApiOperation({ summary: 'Get cortex tasks', description: 'Returns task list from the cortex SQLite DB with optional filtering' })
@ApiQuery({ name: 'status', required: false, description: 'Filter by task status (comma-separated for multiple)', isArray: true })
@ApiQuery({ name: 'type', required: false, description: 'Filter by task type (comma-separated for multiple)', isArray: true })
@ApiQuery({ name: 'priority', required: false, description: 'Filter by priority (comma-separated for multiple)', isArray: true })
@ApiQuery({ name: 'model', required: false, description: 'Filter by assigned model (comma-separated for multiple)', isArray: true })
@ApiQuery({ name: 'startDate', required: false, description: 'Filter tasks created on or after this date (ISO 8601)' })
@ApiQuery({ name: 'endDate', required: false, description: 'Filter tasks created on or before this date (ISO 8601)' })
@ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (id, status, priority, createdAt, type)' })
@ApiQuery({ name: 'sortDirection', required: false, description: 'Sort direction (asc or desc)' })
@ApiResponse({ status: 200, description: 'Cortex task list' })
@ApiResponse({ status: 503, description: 'Cortex DB unavailable' })
@Get('cortex/tasks')
public getCortexTasks(
  @Query('status') status?: string | string[],
  @Query('type') type?: string | string[],
  @Query('priority') priority?: string | string[],
  @Query('model') model?: string | string[],
  @Query('startDate') startDate?: string,
  @Query('endDate') endDate?: string,
  @Query('sortBy') sortBy?: string,
  @Query('sortDirection') sortDirection?: 'asc' | 'desc',
): ReturnType<CortexService['getTasks']> {
  const filters: TaskFilters = {};

  // Parse array parameters
  if (status) {
    filters.status = Array.isArray(status) ? status : status.split(',');
  }
  if (type) {
    filters.type = Array.isArray(type) ? type : type.split(',');
  }
  if (priority) {
    filters.priority = Array.isArray(priority) ? priority : priority.split(',');
  }
  if (model) {
    filters.model = Array.isArray(model) ? model : model.split(',');
  }
  if (startDate) {
    filters.startDate = startDate;
  }
  if (endDate) {
    filters.endDate = endDate;
  }
  if (sortBy) {
    filters.sortBy = sortBy as 'id' | 'status' | 'priority' | 'createdAt' | 'type';
  }
  if (sortDirection) {
    filters.sortDirection = sortDirection;
  }

  const result = this.cortexService.getTasks(filters);
  if (result === null) {
    throw new ServiceUnavailableException({ error: 'Cortex DB unavailable' });
  }
  return result;
}
```

**File**: `apps/dashboard/src/app/services/api.service.ts`

**Changes**: Update `getCortexTasks` method to accept new parameters

```typescript
public getCortexTasks(
  params?: {
    status?: string | string[];
    type?: string | string[];
    priority?: string | string[];
    model?: string | string[];
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  },
): Observable<CortexTask[]> {
  let httpParams = new HttpParams();

  if (params?.status) {
    const statuses = Array.isArray(params.status) ? params.status : params.status.split(',');
    statuses.forEach(s => {
      if (isValidTaskStatus(s)) {
        httpParams = httpParams.append('status', s);
      }
    });
  }

  if (params?.type) {
    const types = Array.isArray(params.type) ? params.type : params.type.split(',');
    types.forEach(t => {
      if (isValidTaskType(t)) {
        httpParams = httpParams.append('type', t);
      }
    });
  }

  // Similar for priority, model, startDate, endDate, sortBy, sortDirection

  return this.http.get<CortexTask[]>(
    `${this.cortexBase}/cortex/tasks`,
    { params: httpParams },
  );
}
```

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Performance degradation with large datasets | High | Medium | Implement client-side filtering first, add server-side filtering when needed |
| Browser compatibility issues | Low | Low | Angular 19+ has excellent browser support |
| URL parameter encoding issues | Medium | Low | Use Angular Router's built-in query param handling |
| Filter state desync on navigation | Medium | Low | Implement proper subscription management in destroyRef |

### UX Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Filter UI too complex | Medium | Medium | Use dropdowns for cleaner interface, provide clear labels |
| Mobile responsiveness issues | Medium | Medium | Test on 768px breakpoint, implement responsive styles |
| Accessibility issues | High | Low | Follow WCAG 2.1 AA guidelines, use ARIA attributes |
| Empty state confusion | Low | Medium | Provide clear messaging with "Clear all filters" action |

---

## Success Metrics

### Quantitative Metrics
- **Task Search Time**: Reduced from >30s to <5s for finding specific tasks
- **Filter Adoption**: 70% of users use at least one filter within first week
- **URL Sharing**: 40% of shared task links include filter parameters
- **User Satisfaction**: Post-implementation survey rating >4.2/5

### Qualitative Metrics
- Positive user feedback on reduced time spent searching for tasks
- Fewer support tickets related to finding specific tasks
- Evidence of teams using shared filtered URLs for collaboration
- Improved task discovery and navigation experience

---

## Files to Modify

### Frontend (Phase 1-4)
1. `apps/dashboard/src/app/models/project-queue.model.ts` - Add filter-related types
2. `apps/dashboard/src/app/views/project/project.component.ts` - Add filter logic and signals
3. `apps/dashboard/src/app/views/project/project.component.html` - Add filter UI
4. `apps/dashboard/src/app/views/project/project.component.scss` - Add filter styles
5. `apps/dashboard/src/app/services/project.constants.ts` - Add optional fields to mock data

### Backend (Phase 6 - Optional)
1. `apps/dashboard-api/src/dashboard/dashboard.controller.ts` - Enhance API endpoint
2. `apps/dashboard/src/app/services/api.service.ts` - Update service method

---

## Implementation Timeline

**Phase 1**: Data Model Extensions - 0.5 days
**Phase 2**: Component State and Logic - 1.5 days
**Phase 3**: UI Implementation - 2 days
**Phase 4**: Data Preparation - 0.5 days
**Phase 5**: Testing and Polish - 1 day
**Phase 6**: Backend Enhancement (Optional) - 1-2 days

**Total**: 5.5-6.5 days (excluding optional backend)

---

## Conclusion

This implementation plan provides a comprehensive, practical approach to enhancing the project tasks list with rich search and filtering capabilities. The frontend-first approach delivers immediate value while maintaining flexibility for future backend enhancements. The solution aligns with existing codebase patterns, leverages Angular 19's reactive signals, and ensures accessibility and performance requirements are met.

All 10 requirements from the task description are addressed with clear acceptance criteria and testing strategies. The plan includes detailed code examples for each phase, making implementation straightforward and maintainable.
