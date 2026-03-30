# Development Tasks - TASK_2026_146

**Total Tasks**: 21 | **Batches**: 6 | **Status**: 6/6 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `CortexTask`, `CortexSession`, `CortexWorker`, `CortexPhaseTiming`, `CortexModelPerformance`, `CortexTaskTrace`, `CortexTaskContext`, `CortexSessionSummary`: All verified as exported from `apps/dashboard-api/src/dashboard/cortex.types.ts`
- API base path `${environment.apiUrl}/api/v1` for cortex methods verified — does not collide with existing `this.base` which points to `/api`
- Route registration pattern (lazy `loadComponent`) verified in `apps/dashboard/src/app/app.routes.ts:21-39`
- Sidebar `MOCK_SIDEBAR_SECTIONS` icon pattern uses `\u{...}` escape sequences — plan's raw emoji literals must be converted. Mitigation in Task 6.2.
- `CortexSession` has no `duration_hours` field — `SessionRow.durationHours` must be computed from `started_at`/`ended_at` in the adapter. Derivable. Documented in Task 4.1.

### Risks Identified

| Risk | Severity | Mitigation |
|---|---|---|
| `toSignal` + `switchMap` for `traceSignal` in TaskTrace requires a `BehaviorSubject` or `signal`-derived observable to react to `selectedTaskId` changes | MED | Task 5.1 Validation Note: use `BehaviorSubject<string \| null>` + `switchMap` piped into `toSignal` |
| Sidebar icon literals must be `\u{...}` escape sequences, not raw emoji | LOW | Task 6.2 explicitly requires Unicode escape format matching lines 185-189 of mock-data.constants.ts |
| NG-ZORRO `nz-select` requires `FormsModule` for `[(ngModel)]` binding | LOW | Each component that uses `nz-select` must include `FormsModule` in `imports[]` |

---

## Batch 1: API Layer COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 1 | **Dependencies**: None

### Task 1.1: Add 8 cortex methods to ApiService COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/api.service.ts`
**Spec Reference**: plan.md:297-317
**Pattern to Follow**: `api.service.ts:97-111` (existing analytics methods)

**Quality Requirements**:
- Add `private readonly cortexBase = \`${environment.apiUrl}/api/v1\`` field to the class
- All 8 methods must be `public` and return `Observable<T>` with proper generic types
- Import all 8 cortex types via `import type { ... } from '../../../../dashboard-api/src/dashboard/cortex.types'`
- `getCortexTasks` and `getCortexWorkers` accept optional `params` object; serialize to `HttpParams` or append as query string
- Use `encodeURIComponent(id)` for path parameters (matching line 54 pattern)
- Do NOT modify the existing `this.base` field — add new `cortexBase` alongside it

**Implementation Details**:
- Imports: `CortexTask`, `CortexTaskContext`, `CortexTaskTrace`, `CortexSession`, `CortexSessionSummary`, `CortexWorker`, `CortexModelPerformance`, `CortexPhaseTiming` from `../../../../dashboard-api/src/dashboard/cortex.types`
- Also import `HttpParams` from `@angular/common/http` for optional query params
- Methods: `getCortexTasks`, `getCortexTask`, `getCortexTaskTrace`, `getCortexSessions`, `getCortexSession`, `getCortexWorkers`, `getCortexModelPerformance`, `getCortexPhaseTiming`
- cortexBase path: `${environment.apiUrl}/api/v1`

---

**Batch 1 Verification**:
- File exists at path and compiles (no TypeScript errors)
- All 8 method signatures match the plan specification
- nitro-code-logic-reviewer approved

---

## Batch 2: Model Performance View COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: Batch 1 (needs API methods)

### Task 2.1: Model Performance Adapter COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/model-performance/model-performance.adapters.ts`
**Spec Reference**: plan.md:104-119
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.adapters.ts:9-18`

**Quality Requirements**:
- Export `interface ModelPerfRow` with all fields from plan (including derived `qualityPerDollar`, `scoreClass`)
- Export `FALLBACK_MODEL_PERF_ROWS: ModelPerfRow[]` = `[]`
- Export `function adaptModelPerformance(raw: CortexModelPerformance[] | null): ModelPerfRow[]`
- `scoreClass` logic: `'score-high'` if `avgReviewScore >= 4`, `'score-mid'` if `>= 3`, else `'score-low'`
- `qualityPerDollar`: compute as `avgReviewScore / estimatedCost` — estimated cost = `(totalInputTokens / 1_000_000 * 3) + (totalOutputTokens / 1_000_000 * 15)` (Sonnet pricing). Return `null` if cost is 0 or score is null.
- When `raw` is `null`, return `FALLBACK_MODEL_PERF_ROWS`

**Implementation Details**:
- Imports: `CortexModelPerformance` from `'../../../../../dashboard-api/src/dashboard/cortex.types'`
- The `task_type` field in `CortexModelPerformance` is `string | null` — map to `taskType: string` defaulting to `'unknown'`

### Task 2.2: Model Performance Component TypeScript COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/model-performance/model-performance.component.ts`
**Spec Reference**: plan.md:121-136
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.ts:1-22` (imports + decorator)

**Quality Requirements**:
- `@Component` with `selector: 'app-model-performance'`, `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
- `imports[]`: `NgClass`, `NzTableModule`, `NzSelectModule`, `NzTagModule`, `NzEmptyModule`, `NzSkeletonModule`, `FormsModule`
- `modelPerfSignal` via `toSignal` + `catchError(() => of(null))`
- `tasksSignal` via `toSignal` + `catchError(() => of(null))` for filter options
- `rowsComputed = computed(...)` applies `adaptModelPerformance` then filters by `selectedTaskType`
- `taskTypeOptions = computed(...)` derives unique task type strings from `tasksSignal()`
- `selectedTaskType: string = 'all'` as mutable property
- `sortColumn: string = ''` and `sortDirection: 'asc' | 'desc' = 'asc'`
- `rows: ModelPerfRow[] = []` pushed via `effect()`
- `sortBy(col: string)` method toggles sort direction and resets column

**Implementation Details**:
- Imports: `ChangeDetectionStrategy`, `Component`, `computed`, `effect`, `inject` from `@angular/core`
- `catchError`, `of` from `rxjs`; `toSignal` from `@angular/core/rxjs-interop`
- `FormsModule` from `@angular/forms`
- `NzTableModule` from `ng-zorro-antd/table`, `NzSelectModule` from `ng-zorro-antd/select`, etc.

### Task 2.3: Model Performance Template COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/model-performance/model-performance.component.html`
**Spec Reference**: plan.md:133-136
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.html:153-189`

**Quality Requirements**:
- Page header `<h1>` + `<p class="subtitle">`
- Filter bar: `<nz-select [(ngModel)]="selectedTaskType">` with `<nz-option>` for `'all'` plus each `taskTypeOption`
- `<nz-skeleton [nzActive]="true" *ngIf="!rows.length && !unavailable">` for loading state (before data arrives)
- `<nz-table [nzData]="rows">` with columns: Model, Task Type, Phases, Reviews, Avg Duration, Avg Review Score, Tokens In, Tokens Out
- Score cell: `<nz-tag [nzColor]="row.scoreClass === 'score-high' ? 'green' : row.scoreClass === 'score-mid' ? 'orange' : 'red'">`
- `@if (rows.length === 0 && !loading)` block renders `<nz-empty>`
- 503 banner: `@if (unavailable)` block renders `<div class="unavailable-banner">Cortex DB unavailable</div>`
- Use `@for` control flow syntax (Angular 17+), not `*ngFor`

### Task 2.4: Model Performance Styles COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/model-performance/model-performance.component.scss`
**Spec Reference**: plan.md:18-19
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.scss:1-8`

**Quality Requirements**:
- Host container: `display: flex; flex-direction: column; padding: 24px; max-width: 1280px; gap: 24px`
- All colors via CSS variables: `var(--text-primary)`, `var(--bg-secondary)`, `var(--accent)`, `var(--border)`
- `.unavailable-banner`: `background: var(--bg-secondary); border: 1px solid var(--accent); border-radius: var(--radius); padding: 12px 16px; color: var(--text-primary)`
- `.filter-bar`: `display: flex; gap: 12px; align-items: center`
- NO hardcoded hex colors

---

**Batch 2 Verification**:
- All 4 files exist at their paths
- Component renders without compile errors
- `adaptModelPerformance(null)` returns `[]` (no crash)
- nitro-code-logic-reviewer approved

---

## Batch 3: Phase Timing View COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: Batch 1

### Task 3.1: Phase Timing Adapter COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/phase-timing/phase-timing.adapters.ts`
**Spec Reference**: plan.md:153-167
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.adapters.ts:9-18`

**Quality Requirements**:
- Export `interface PhaseTimingRow` with all fields from plan including derived `barHeightPercent`, `outlierThreshold`, `rangeWidth`, `phaseLabel`
- Export `FALLBACK_PHASE_TIMING_ROWS: PhaseTimingRow[]` = `[]`
- Export `function adaptPhaseTiming(raw: CortexPhaseTiming[] | null): PhaseTimingRow[]`
- `barHeightPercent`: `avgMin / globalMax * 100` — globalMax = `Math.max(...rows.map(r => r.avgMin ?? 0))`
- `rangeWidth`: CSS percentage string: `((maxMin - minMin) / globalMax * 100).toFixed(1) + '%'`
- `phaseLabel`: map known phase keys to readable labels (e.g., `'pm'` -> `'PM Planning'`, `'architect'` -> `'Architecture'`, `'dev'` -> `'Development'`, `'qa'` -> `'QA Review'`); unknown keys get title-cased
- When `raw` is `null`, return `FALLBACK_PHASE_TIMING_ROWS`

**Implementation Details**:
- Imports: `CortexPhaseTiming` from `'../../../../../dashboard-api/src/dashboard/cortex.types'`
- Guard against `avg_duration_minutes` being `null` — treat as 0 for bar height calculation

### Task 3.2: Phase Timing Component TypeScript COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/phase-timing/phase-timing.component.ts`
**Spec Reference**: plan.md:169-174
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.ts`

**Quality Requirements**:
- `@Component` with `selector: 'app-phase-timing'`, `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
- `imports[]`: `NgClass`, `NzTableModule`, `NzTagModule`, `NzEmptyModule`, `NzSkeletonModule`
- `phaseTimingSignal` via `toSignal` + `catchError(() => of(null))`
- `rowsComputed = computed(() => adaptPhaseTiming(this.phaseTimingSignal()))`
- `rows: PhaseTimingRow[] = []` pushed via `effect()`
- `unavailable = false` boolean, set to `true` when signal resolves to `null`

### Task 3.3: Phase Timing Template COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/phase-timing/phase-timing.component.html`
**Spec Reference**: plan.md:176-181
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.html:192-229`

**Quality Requirements**:
- Page header `<h1>` + subtitle
- Horizontal bar chart section: `@for (row of rows)` — each row renders `.bar-row` with a `.bar-fill` whose `[style.width.%]="row.barHeightPercent"` and a nested `.range-overlay` whose `[style.width]="row.rangeWidth"`
- Bar chart labels: phase label on left, avg duration value on right
- `<nz-table [nzData]="rows">` with columns: Phase, Count, Avg (min), Min, Max, Outlier
- Outlier column: `<nz-tag nzColor="red">Outlier</nz-tag>` when `row.maxMin > row.outlierThreshold`
- `@if (rows.length === 0)` block renders `<nz-empty>`

### Task 3.4: Phase Timing Styles COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/phase-timing/phase-timing.component.scss`
**Spec Reference**: plan.md:18-19
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.scss`

**Quality Requirements**:
- Host container: flex-column, `padding: 24px`, `max-width: 1280px`, `gap: 24px`
- `.bar-chart`: `display: flex; flex-direction: column; gap: 8px`
- `.bar-row`: `display: flex; align-items: center; gap: 12px`
- `.bar-track`: `flex: 1; height: 20px; background: var(--bg-secondary); border-radius: 4px; position: relative; overflow: hidden`
- `.bar-fill`: `height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.3s ease`
- `.range-overlay`: `position: absolute; top: 0; height: 100%; background: rgba(255,255,255,0.2)`
- All colors via CSS variables only

---

**Batch 3 Verification**:
- All 4 files exist at their paths
- Bar chart renders with correct `[style.width.%]` binding
- `adaptPhaseTiming(null)` returns `[]`
- nitro-code-logic-reviewer approved

---

## Batch 4: Session Comparison View COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: Batch 1

### Task 4.1: Session Comparison Adapter COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/session-comparison/session-comparison.adapters.ts`
**Spec Reference**: plan.md:198-217
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.adapters.ts`

**Quality Requirements**:
- Export `interface SessionRow` with all fields from plan including derived `costPerTask`, `statusClass`, `isSelected`
- Export `FALLBACK_SESSION_ROWS: SessionRow[]` = `[]`
- Export `function adaptSessions(raw: CortexSession[] | null): SessionRow[]`
- **ASSUMPTION**: `CortexSession` has no `duration_hours` field — compute `durationHours` from `(Date.parse(ended_at) - Date.parse(started_at)) / 3_600_000`; return `null` if `ended_at` is `null`
- `costPerTask`: `total_cost / tasks_terminal`; return `null` if `tasks_terminal === 0`
- `statusClass`: `'status-active'` if `loop_status === 'running'`, `'status-done'` if `loop_status === 'complete'`, `'status-failed'` if `loop_status === 'failed'`, else `'status-unknown'`
- `isSelected`: always `false` on construction (toggled in component)
- Map snake_case API fields to camelCase view model fields
- When `raw` is `null`, return `FALLBACK_SESSION_ROWS`

**Implementation Details**:
- Imports: `CortexSession` from `'../../../../../dashboard-api/src/dashboard/cortex.types'`
- `supervisorModel` <- `supervisor_model`, `supervisorLauncher` <- `supervisor_launcher`, etc.

### Task 4.2: Session Comparison Component TypeScript COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts`
**Spec Reference**: plan.md:219-224
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.ts`

**Quality Requirements**:
- `@Component` with `selector: 'app-session-comparison'`, `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
- `imports[]`: `NgClass`, `NzTableModule`, `NzTagModule`, `NzEmptyModule`, `NzSkeletonModule`
- `sessionsSignal` via `toSignal` + `catchError(() => of(null))`
- `rowsComputed = computed(() => adaptSessions(this.sessionsSignal()))`
- `rows: SessionRow[] = []` pushed via `effect()`
- `sortColumn: string = ''` and `sortDirection: 'asc' | 'desc' = 'asc'`
- `sortBy(col: string)` method
- `toggleSelect(row: SessionRow)` method: flips `row.isSelected` (mutates in-place on the `rows` array property)
- `unavailable = false`

### Task 4.3: Session Comparison Template COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/session-comparison/session-comparison.component.html`
**Spec Reference**: plan.md:225-230
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.html:153-189`

**Quality Requirements**:
- Page header `<h1>` + subtitle
- `<nz-table [nzData]="rows">` with columns: Session ID, Started, Duration (h), Cost ($), Tasks, Cost/Task, Model, Mode, Status
- Status column: `<nz-tag>` with color bound to `row.statusClass`
- Row click: `(click)="toggleSelect(row)"`, add `[class.row-selected]="row.isSelected"` to `<tr>`
- `@if (rows.length === 0)` renders `<nz-empty>`
- Format cost cells with `| number:'1.4-4'` pipe

### Task 4.4: Session Comparison Styles COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/session-comparison/session-comparison.component.scss`
**Spec Reference**: plan.md:18-19

**Quality Requirements**:
- Host container: flex-column, `padding: 24px`, `max-width: 1280px`, `gap: 24px`
- `.row-selected`: `background: var(--bg-secondary); outline: 1px solid var(--accent)`
- All colors via CSS variables only

---

**Batch 4 Verification**:
- All 4 files exist
- `adaptSessions(null)` returns `[]`
- Row selection toggle works
- nitro-code-logic-reviewer approved

---

## Batch 5: Task Trace View COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 4 | **Dependencies**: Batch 1

### Task 5.1: Task Trace Adapter COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts`
**Spec Reference**: plan.md:249-268
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.adapters.ts`

**Quality Requirements**:
- Export interfaces: `TaskTraceViewModel`, `WorkerRow`, `PhaseRow`, `ReviewRow`, `FixCycleRow`, `TimelineEvent`
- Export `function adaptTaskTrace(raw: CortexTaskTrace | null): TaskTraceViewModel | null` — returns `null` when `raw` is `null`
- Timeline: merge workers (by `spawn_time`), phases (by `start_time`), reviews (no timestamp — append after phases), fix cycles (no timestamp — append after reviews), events (by `created_at`). Sort by time ascending.
- `TimelineEvent.type` values: `'worker'`, `'phase'`, `'review'`, `'fix'`, `'event'`
- Workers -> `WorkerRow`: map `CortexWorker` fields to camelCase + add `durationMin: number | null` (not in raw type — set to `null`)
- Phases -> `PhaseRow`: map `CortexPhase` fields to camelCase
- Reviews -> `ReviewRow`: map `CortexReview` fields to camelCase
- Fix cycles -> `FixCycleRow`: map `CortexFixCycle` fields to camelCase

**Validation Notes**:
- `CortexReview` and `CortexFixCycle` have no timestamp fields — place them after timed events in the timeline, ordered by their `id`

### Task 5.2: Task Trace Component TypeScript COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/task-trace/task-trace.component.ts`
**Spec Reference**: plan.md:271-276
**Pattern to Follow**: `apps/dashboard/src/app/views/analytics/analytics.component.ts`

**Quality Requirements**:
- `@Component` with `selector: 'app-task-trace'`, `standalone: true`, `changeDetection: ChangeDetectionStrategy.OnPush`
- `imports[]`: `NgClass`, `NzTableModule`, `NzSelectModule`, `NzTagModule`, `NzEmptyModule`, `NzSkeletonModule`, `NzStatisticModule`, `FormsModule`
- `tasksSignal` via `toSignal` + `catchError(() => of(null))`
- `taskOptions = computed(...)` maps `tasksSignal()` to `Array<{value: string, label: string}>`
- **RISK**: `traceSignal` — use a `BehaviorSubject<string | null>` named `selectedTaskId$`, call `.next(id)` in `onTaskSelect(id)`. Wire: `traceSignal = toSignal(this.selectedTaskId$.pipe(switchMap(id => id ? this.api.getCortexTaskTrace(id).pipe(catchError(() => of(null))) : of(null))), { initialValue: null })`
- `selectedTaskId: string | null = null` — component property bound to `nz-select`
- `onTaskSelect(id: string | null)` method: sets `this.selectedTaskId = id` and calls `this.selectedTaskId$.next(id)`
- `viewModelComputed = computed(() => adaptTaskTrace(this.traceSignal()))`
- `viewModel: TaskTraceViewModel | null = null` pushed via `effect()`

**Implementation Details**:
- `BehaviorSubject` from `rxjs`; `switchMap` from `rxjs/operators`
- `inject(DestroyRef)` NOT needed — `toSignal` handles subscription cleanup automatically

### Task 5.3: Task Trace Template COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/task-trace/task-trace.component.html`
**Spec Reference**: plan.md:278-287

**Quality Requirements**:
- Page header `<h1>` + subtitle
- Task selector: `<nz-select [nzShowSearch]="true" [(ngModel)]="selectedTaskId" (ngModelChange)="onTaskSelect($event)">`
- `@if (!selectedTaskId)` block: `<nz-empty nzNotFoundContent="Select a task to view its trace">`
- `@if (selectedTaskId && viewModel)` block:
  - Summary stat row: 4 `<nz-statistic>` cards (total cost, total tokens, worker count, phase count)
  - Timeline section: vertical timeline CSS — `@for (event of viewModel.timelineEvents)` renders `.timeline-item` with `.tl-dot`, `.tl-time`, `.tl-label`, `.tl-detail`
  - Workers `<nz-table>`: Worker ID, Type, Model, Launcher, Status, Cost, Tokens
  - Phases `<nz-table>`: Phase, Model, Duration (min), Input Tokens, Output Tokens, Outcome
  - Reviews `<nz-table>`: Type, Score, Findings, Critical, Built By, Reviewed By
  - Fix Cycles `<nz-table>`: Fixes Applied, Fixes Skipped, Manual Required, Fixed By
- `@if (selectedTaskId && !viewModel)` block: `<nz-skeleton [nzActive]="true">`

### Task 5.4: Task Trace Styles COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/task-trace/task-trace.component.scss`
**Spec Reference**: plan.md:18-19

**Quality Requirements**:
- Host container: flex-column, `padding: 24px`, `max-width: 1280px`, `gap: 24px`
- `.stat-row`: `display: flex; gap: 16px; flex-wrap: wrap`
- `.timeline`: `display: flex; flex-direction: column; gap: 0`
- `.timeline-item`: `display: flex; gap: 12px; align-items: flex-start; padding: 8px 0; border-left: 2px solid var(--border); padding-left: 16px; position: relative`
- `.tl-dot`: `width: 10px; height: 10px; border-radius: 50%; background: var(--accent); position: absolute; left: -6px; top: 10px`
- `.tl-time`: `color: var(--text-secondary); font-size: 12px; min-width: 80px`
- All colors via CSS variables only

---

**Batch 5 Verification**:
- All 4 files exist
- `traceSignal` correctly uses `BehaviorSubject` + `switchMap` pattern
- `adaptTaskTrace(null)` returns `null` (no crash)
- nitro-code-logic-reviewer approved

---

## Batch 6: Wiring (Routes + Sidebar) COMPLETE

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batches 2-5 (components must exist before routes reference them)

### Task 6.1: Add 4 Lazy Routes COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/app.routes.ts`
**Spec Reference**: plan.md:326-332
**Pattern to Follow**: `app.routes.ts:19-38`

**Quality Requirements**:
- Add 4 lazy-loaded routes inside the `LayoutComponent` children array, after the existing `'providers'` route entry
- Follow the exact `loadComponent: () => import(...).then(m => m.ComponentClass)` pattern
- Paths: `'telemetry/model-performance'`, `'telemetry/phase-timing'`, `'telemetry/session-comparison'`, `'telemetry/task-trace'`
- Import paths must be relative from `app.routes.ts` location: `'./views/model-performance/model-performance.component'`, etc.
- Do NOT change any existing routes

### Task 6.2: Add Telemetry Sidebar Section COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/mock-data.constants.ts`
**Spec Reference**: plan.md:338-353
**Pattern to Follow**: `mock-data.constants.ts:204-210` (Providers section)

**Quality Requirements**:
- Insert a new `SidebarSection` object with `title: 'Telemetry'`, `type: 'management'` BEFORE the existing `'Providers'` section (currently at line 204)
- Items: `Model Performance` (route `/telemetry/model-performance`), `Phase Timing` (route `/telemetry/phase-timing`), `Session Comparison` (route `/telemetry/session-comparison`), `Task Trace` (route `/telemetry/task-trace`)
- **RISK**: Icons must use `\u{...}` escape format — NOT raw emoji literals. Use: `'\u{1F4CA}'` (chart), `'\u23F1'` (timer), `'\u21C4'` (arrows), `'\u{1F50D}'` (magnifier)
- Do NOT modify any other sections in `MOCK_SIDEBAR_SECTIONS`

---

**Batch 6 Verification**:
- Both files exist and are modified
- 4 new routes present in `APP_ROUTES`
- Telemetry section present in `MOCK_SIDEBAR_SECTIONS` with correct Unicode escape icons
- nitro-code-logic-reviewer approved

---

## Commits Log

| Batch | SHA | Description |
|---|---|---|
| 1 | pending | API layer — 8 cortex methods |
| 2 | pending | Model Performance view (4 files) |
| 3 | pending | Phase Timing view (4 files) |
| 4 | pending | Session Comparison view (4 files) |
| 5 | pending | Task Trace view (4 files) |
| 6 | pending | Wiring — routes + sidebar |
