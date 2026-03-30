# Implementation Plan — TASK_2026_146
# Dashboard Telemetry Views

## Codebase Investigation Summary

### Libraries Verified
- **NG-ZORRO**: Already provisioned via `provideNzConfig` and `provideNzI18n` in `apps/dashboard/src/app/app.config.ts:5-29`. Icons configured via `provideNzIcons`.
- **Angular signals + toSignal**: Established pattern in `analytics.component.ts:26-37` — all async data loaded via `toSignal()` + `catchError(() => of(null))`.
- **HttpClient**: Injected via `inject(HttpClient)` in `api.service.ts:8`. Base URL from `environment.apiUrl`.
- **ChangeDetectionStrategy.OnPush**: Mandatory pattern — see `analytics.component.ts:19`.

### Patterns Identified
- **Component pattern**: Standalone components with `ChangeDetectionStrategy.OnPush`, signals for async data, `computed()` for derived state, `effect()` to push into class properties for template binding. Evidence: `apps/dashboard/src/app/views/analytics/analytics.component.ts`.
- **Adapter pattern**: Raw API types converted to view-model types in a dedicated `*.adapters.ts` sibling file. Evidence: `apps/dashboard/src/app/views/analytics/analytics.adapters.ts:1`.
- **Route registration**: Lazy-loaded via `loadComponent` in `apps/dashboard/src/app/app.routes.ts:21-39`. All views are children of `LayoutComponent`.
- **Sidebar nav**: Data-driven via `MOCK_SIDEBAR_SECTIONS` constant in `apps/dashboard/src/app/services/mock-data.constants.ts:170`. The sidebar component reads from this array and renders via `@for`. New nav items are added by extending this constant.
- **API service methods**: All HTTP calls live in `apps/dashboard/src/app/services/api.service.ts`. Each method returns `Observable<T>` with typed return shapes imported from `dashboard-api/src/dashboard/dashboard.types.ts`.
- **CSS variables**: Dark theme via CSS custom properties (`var(--text-primary)`, `var(--bg-secondary)`, `var(--accent)`, `var(--border)`, `var(--radius)` etc.). All views must use these only — no hardcoded colors.
- **Page layout**: Flex-column container with `padding: 24px`, `max-width: 1280px`, `gap: 24px`. Evidence: `analytics.component.scss:1-8`.
- **Empty state**: The FALLBACK constant pattern (return empty arrays/zeros) is used when API data is `null`. Evidence: `analytics.adapters.ts:9-18`.

### Available Cortex API Endpoints (TASK_2026_145 — Verified in controller)
All endpoints are under `/api/v1/cortex/` (versioned). Base path in service: `${this.base}/api` = `${environment.apiUrl}/api/v1`.

| Endpoint | Method | Params | Returns |
|---|---|---|---|
| `GET /cortex/tasks` | GET | `?status`, `?type` | `CortexTask[]` |
| `GET /cortex/tasks/:id` | GET | — | `CortexTaskContext` |
| `GET /cortex/tasks/:id/trace` | GET | — | `CortexTaskTrace` |
| `GET /cortex/sessions` | GET | — | `CortexSession[]` |
| `GET /cortex/sessions/:id` | GET | — | `CortexSessionSummary` |
| `GET /cortex/workers` | GET | `?sessionId`, `?status` | `CortexWorker[]` |
| `GET /cortex/analytics/model-performance` | GET | `?taskType`, `?model` | `CortexModelPerformance[]` |
| `GET /cortex/analytics/phase-timing` | GET | — | `CortexPhaseTiming[]` |

All return types verified in `apps/dashboard-api/src/dashboard/cortex.types.ts`.

### API Base Path Clarification
The existing `api.service.ts` uses `${environment.apiUrl}/api` as `this.base`, then appends paths like `/registry`, `/sessions/active`. The NestJS controller is versioned (`version: '1'`), so the actual URL prefix is `/api/v1/...`. New cortex methods must use `${this.base}/v1/cortex/...` to match — confirmed by observing that existing endpoints match the controller's `@Controller({ path: 'api', version: '1' })` + versioning prefix `/v1/`.

---

## Architecture Design

### Design Philosophy
**Chosen Approach**: Extend the established analytics component pattern. Each new view follows the exact structure of `AnalyticsComponent`: standalone + OnPush + `toSignal` for data loading + adapter file for mapping + `effect()` for derived state.

No new framework, no chart library. All visualizations use CSS bar charts and HTML tables exactly as the existing analytics view does — this keeps bundle size zero and maintains the dark theme without any NG-ZORRO chart integration complexity.

NG-ZORRO components to use:
- `nz-select` — filter dropdowns (already in the ng-zorro bundle)
- `nz-table` — data tables (replaces hand-rolled `<table>`)
- `nz-tag` — status badges
- `nz-empty` — empty state (built-in NG-ZORRO empty state component)
- `nz-skeleton` — loading skeleton
- `nz-statistic` — stat cards (replaces hand-rolled `.stat-card` divs)

All `nz-*` components require adding their module imports to the component's `imports[]` array (standalone mode) — e.g., `NzTableModule`, `NzSelectModule`, `NzTagModule`, `NzEmptyModule`, `NzSkeletonModule`, `NzStatisticModule`.

### Component Structure

```
apps/dashboard/src/app/
  services/
    api.service.ts              MODIFY — add 8 new cortex methods
  views/
    model-performance/
      model-performance.component.ts    CREATE
      model-performance.component.html  CREATE
      model-performance.component.scss  CREATE
      model-performance.adapters.ts     CREATE
    phase-timing/
      phase-timing.component.ts         CREATE
      phase-timing.component.html       CREATE
      phase-timing.component.scss       CREATE
      phase-timing.adapters.ts          CREATE
    session-comparison/
      session-comparison.component.ts   CREATE
      session-comparison.component.html CREATE
      session-comparison.component.scss CREATE
      session-comparison.adapters.ts    CREATE
    task-trace/
      task-trace.component.ts           CREATE
      task-trace.component.html         CREATE
      task-trace.component.scss         CREATE
      task-trace.adapters.ts            CREATE
  app.routes.ts                         MODIFY — 4 new lazy routes
  services/mock-data.constants.ts       MODIFY — add Telemetry section to MOCK_SIDEBAR_SECTIONS
```

---

## Component Specifications

### Component 1: Model Performance View
**Route**: `/telemetry/model-performance`
**Purpose**: Ranked table of model+launcher combos showing quality score, cost, failure rate, duration.
**Evidence pattern**: `analytics.component.ts:26-37` (toSignal + computed), `analytics.adapters.ts` (adapter file), `analytics.component.html:153-189` (HTML table pattern).

**Data sources**:
- `getCortexModelPerformance(?taskType, ?model)` → `CortexModelPerformance[]`
- `getCortexTasks()` → `CortexTask[]` (to populate task type filter options)

**View model** (`model-performance.adapters.ts`):
```typescript
interface ModelPerfRow {
  model: string;
  taskType: string;
  phaseCount: number;
  reviewCount: number;
  avgDurationMin: number | null;
  avgReviewScore: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  // derived
  qualityPerDollar: number | null;  // avgReviewScore / estimated cost
  scoreClass: string;               // 'score-high' | 'score-mid' | 'score-low'
}
```

**Component responsibilities**:
- Signal: `modelPerfSignal` = `toSignal(api.getCortexModelPerformance())` with null fallback
- Signal: `tasksSignal` = `toSignal(api.getCortexTasks())` for filter option extraction
- Computed: `rowsComputed` = maps raw data through adapter, applies `selectedTaskType` filter
- Filter state: `selectedTaskType: string = 'all'`
- Sort state: `sortColumn: string`, `sortDirection: 'asc' | 'desc'`
- Empty state: show `nz-empty` when rows array is length 0
- 503 state: show banner "Cortex DB unavailable" when API returns null

**Template structure**:
- Page header + subtitle
- Filter bar: `nz-select` for task type filter
- `nz-table` with columns: Model, Task Type, Phases, Reviews, Avg Duration, Avg Review Score, Tokens (in/out)
- Score badge via `nz-tag` with color bound to `scoreClass`
- Empty state via `nz-empty`

**Files affected**:
- `apps/dashboard/src/app/views/model-performance/model-performance.component.ts` (CREATE)
- `apps/dashboard/src/app/views/model-performance/model-performance.component.html` (CREATE)
- `apps/dashboard/src/app/views/model-performance/model-performance.component.scss` (CREATE)
- `apps/dashboard/src/app/views/model-performance/model-performance.adapters.ts` (CREATE)

---

### Component 2: Phase Timing View
**Route**: `/telemetry/phase-timing`
**Purpose**: Bar chart + table showing average/min/max duration per phase. Highlights outliers.
**Evidence pattern**: `analytics.component.html:192-229` (CSS bar chart pattern with `[style.height.%]`).

**Data source**:
- `getCortexPhaseTiming()` → `CortexPhaseTiming[]`

**View model** (`phase-timing.adapters.ts`):
```typescript
interface PhaseTimingRow {
  phase: string;
  count: number;
  avgMin: number | null;
  minMin: number | null;
  maxMin: number | null;
  // derived
  barHeightPercent: number;    // avgMin / globalMax * 100
  outlierThreshold: number;    // avgMin * 3
  rangeWidth: string;          // CSS width % for min-max range bar
  phaseLabel: string;          // human label e.g. 'PM Planning'
}
```

**Component responsibilities**:
- Signal: `phaseTimingSignal` = `toSignal(api.getCortexPhaseTiming())` with null fallback
- Computed: `rowsComputed` derives bar heights by finding global max avg duration
- Empty state: `nz-empty` when no phases recorded
- Table shows phase, count, avg, min, max with outlier flag (badge) when max > avg * 3

**Template structure**:
- Page header
- Horizontal bar chart (CSS, same technique as `analytics.component.html:192-229`)
  - Each phase gets a bar sized to `avgMin / globalMax * 100%`
  - Min-max range overlay as a nested element
- `nz-table` below the chart: Phase | Count | Avg (min) | Min | Max | Outlier flag

**Files affected**:
- `apps/dashboard/src/app/views/phase-timing/phase-timing.component.ts` (CREATE)
- `apps/dashboard/src/app/views/phase-timing/phase-timing.component.html` (CREATE)
- `apps/dashboard/src/app/views/phase-timing/phase-timing.component.scss` (CREATE)
- `apps/dashboard/src/app/views/phase-timing/phase-timing.adapters.ts` (CREATE)

---

### Component 3: Session Comparison View
**Route**: `/telemetry/session-comparison`
**Purpose**: Side-by-side table comparing all cortex sessions. Sortable by cost/tasks/efficiency.
**Evidence pattern**: `analytics.component.html:153-189` (agent table with badges).

**Data source**:
- `getCortexSessions()` → `CortexSession[]`

**View model** (`session-comparison.adapters.ts`):
```typescript
interface SessionRow {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationHours: number | null;
  totalCost: number;
  tasksTerminal: number;
  supervisorModel: string;
  supervisorLauncher: string;
  mode: string;
  loopStatus: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  // derived
  costPerTask: number | null;    // totalCost / tasksTerminal
  statusClass: string;           // 'status-active' | 'status-done' | 'status-failed'
  isSelected: boolean;           // for multi-select comparison highlight
}
```

**Component responsibilities**:
- Signal: `sessionsSignal` = `toSignal(api.getCortexSessions())` with null fallback
- Computed: `rowsComputed` maps raw sessions through adapter
- Sort state: click column header to sort rows
- Empty state: `nz-empty`

**Template structure**:
- Page header
- `nz-table` with columns: Session ID, Started, Duration, Cost, Tasks, Cost/Task, Model, Mode, Status
- Status badge via `nz-tag` (`loop_status` field)
- Row click highlights the session for future drill-down (UX detail, no routing needed yet)

**Files affected**:
- `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts` (CREATE)
- `apps/dashboard/src/app/views/session-comparison/session-comparison.component.html` (CREATE)
- `apps/dashboard/src/app/views/session-comparison/session-comparison.component.scss` (CREATE)
- `apps/dashboard/src/app/views/session-comparison/session-comparison.adapters.ts` (CREATE)

---

### Component 4: Task Trace View
**Route**: `/telemetry/task-trace`
**Purpose**: Full chain view for a selected task: workers → phases → reviews → fix cycles → events.
**Evidence pattern**: `analytics.component.ts` (signal + computed pattern). `dashboard.controller.ts:330` (`GET /cortex/tasks/:id/trace` → `CortexTaskTrace`).

**Data sources**:
- `getCortexTasks()` → `CortexTask[]` (populate task selector dropdown)
- `getCortexTaskTrace(taskId)` → `CortexTaskTrace` (on task selection)

**View model** (`task-trace.adapters.ts`):
```typescript
interface TaskTraceViewModel {
  taskId: string;
  workers: WorkerRow[];
  phases: PhaseRow[];
  reviews: ReviewRow[];
  fixCycles: FixCycleRow[];
  timelineEvents: TimelineEvent[];   // merged + sorted by timestamp
}

interface TimelineEvent {
  time: string;
  label: string;           // e.g. 'Worker spawned', 'Phase: PM', 'Review: logic'
  type: 'worker' | 'phase' | 'review' | 'fix' | 'event';
  detail: string;
  cost?: number;
  tokens?: number;
}
```

**Component responsibilities**:
- Signal: `tasksSignal` = `toSignal(api.getCortexTasks())` — to populate task selector
- `selectedTaskId: string | null = null` — component state
- `traceSignal`: constructed via `switchMap` on `selectedTaskId` changes → `api.getCortexTaskTrace(id)`. Use `toSignal` with `switchMap` inside the pipe.
- Computed: `viewModelComputed` builds timeline + section arrays from raw trace
- Empty state before selection: prompt "Select a task to view its trace"
- Empty state after selection with no data: `nz-empty`

**Template structure**:
- Page header
- Task selector: `nz-select` with search, bound to `selectedTaskId`
- When task selected:
  - Summary stat cards (total cost, total tokens, worker count, phase count)
  - Timeline section: vertical timeline using CSS (each event is a row with dot, time, label, detail)
  - Workers table: Worker ID | Type | Model | Launcher | Status | Cost | Tokens
  - Phases table: Phase | Model | Duration | Tokens (in/out) | Outcome
  - Reviews table: Type | Score | Findings | Critical | Built by | Reviewed by
  - Fix Cycles table: Fixes Applied | Fixes Skipped | Manual Required | Fixed by

**Files affected**:
- `apps/dashboard/src/app/views/task-trace/task-trace.component.ts` (CREATE)
- `apps/dashboard/src/app/views/task-trace/task-trace.component.html` (CREATE)
- `apps/dashboard/src/app/views/task-trace/task-trace.component.scss` (CREATE)
- `apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts` (CREATE)

---

## API Service Methods — New Additions

**File**: `apps/dashboard/src/app/services/api.service.ts` (MODIFY)

Add these 8 new methods. All use the same `inject(HttpClient)` pattern. The cortex endpoints are versioned — the base path is `${environment.apiUrl}/api/v1`.

```typescript
// New private base for versioned cortex endpoints
private readonly cortexBase = `${environment.apiUrl}/api/v1`;

getCortexTasks(params?: { status?: string; type?: string }): Observable<CortexTask[]>
getCortexTask(id: string): Observable<CortexTaskContext>
getCortexTaskTrace(id: string): Observable<CortexTaskTrace>
getCortexSessions(): Observable<CortexSession[]>
getCortexSession(id: string): Observable<CortexSessionSummary>
getCortexWorkers(params?: { sessionId?: string; status?: string }): Observable<CortexWorker[]>
getCortexModelPerformance(params?: { taskType?: string; model?: string }): Observable<CortexModelPerformance[]>
getCortexPhaseTiming(): Observable<CortexPhaseTiming[]>
```

All return types imported from `apps/dashboard-api/src/dashboard/cortex.types.ts` — verified as exported from that file.

---

## Route Registration

**File**: `apps/dashboard/src/app/app.routes.ts` (MODIFY)

Add 4 lazy-loaded routes as children of the existing `LayoutComponent` route, following the established `loadComponent` pattern (evidence: `app.routes.ts:21-38`):

```typescript
{ path: 'telemetry/model-performance', loadComponent: () => import('./views/model-performance/model-performance.component').then(m => m.ModelPerformanceComponent) },
{ path: 'telemetry/phase-timing',      loadComponent: () => import('./views/phase-timing/phase-timing.component').then(m => m.PhaseTimingComponent) },
{ path: 'telemetry/session-comparison',loadComponent: () => import('./views/session-comparison/session-comparison.component').then(m => m.SessionComparisonComponent) },
{ path: 'telemetry/task-trace',        loadComponent: () => import('./views/task-trace/task-trace.component').then(m => m.TaskTraceComponent) },
```

---

## Sidebar Navigation Update

**File**: `apps/dashboard/src/app/services/mock-data.constants.ts` (MODIFY)

Add a new `SidebarSection` with `type: 'management'` before the existing `Providers` section:

```typescript
{
  title: 'Telemetry',
  type: 'management',
  items: [
    { label: 'Model Performance', icon: '★', route: '/telemetry/model-performance' },
    { label: 'Phase Timing',      icon: '⏱', route: '/telemetry/phase-timing' },
    { label: 'Session Comparison',icon: '⇌', route: '/telemetry/session-comparison' },
    { label: 'Task Trace',        icon: '🔍', route: '/telemetry/task-trace' },
  ],
},
```

Note: icon strings are arbitrary Unicode characters matching the existing icon approach (evidence: `mock-data.constants.ts:185-189` uses emoji code points). Use text symbols or `\u` escapes, not emoji literals.

---

## NG-ZORRO Component Integration

Each new view component must add to its `imports[]` array only the NG-ZORRO modules it actually uses. Do not import entire `NgZorroAntdModule`. Use granular imports:

- `NzTableModule` — from `ng-zorro-antd/table`
- `NzSelectModule` — from `ng-zorro-antd/select`
- `NzTagModule` — from `ng-zorro-antd/tag`
- `NzEmptyModule` — from `ng-zorro-antd/empty`
- `NzSkeletonModule` — from `ng-zorro-antd/skeleton`
- `NzStatisticModule` — from `ng-zorro-antd/statistic`
- `FormsModule` — from `@angular/forms` (needed for `[(ngModel)]` on `nz-select`)

`nz-table` in standalone components requires `NzTableModule` added to component `imports[]`. Evidence: NG-ZORRO is already configured globally in `app.config.ts:5-9`, so no provider setup is needed — only the module import in each component.

---

## Empty State and Error Handling Pattern

All four views follow the same null-guard pattern from `analytics.adapters.ts:9-18`:

1. `toSignal` initialized with `null` as initial value
2. `catchError(() => of(null))` in the pipe
3. Adapter returns empty arrays / zero values when input is `null`
4. Template: `@if (rows.length === 0) { <nz-empty .../> }` wraps the table
5. 503 case: adapter returns `{ unavailable: true }` discriminant — template shows a "Cortex DB unavailable" info banner above the empty table

---

## Implementation Batches

### Batch 1 — API Layer (no UI)
**Files**:
- `apps/dashboard/src/app/services/api.service.ts` — add 8 cortex methods with type imports

**Rationale**: All view components depend on these methods. Do this first so the TypeScript compiler validates imports immediately.

### Batch 2 — Model Performance View
**Files**:
- `apps/dashboard/src/app/views/model-performance/model-performance.adapters.ts`
- `apps/dashboard/src/app/views/model-performance/model-performance.component.ts`
- `apps/dashboard/src/app/views/model-performance/model-performance.component.html`
- `apps/dashboard/src/app/views/model-performance/model-performance.component.scss`

### Batch 3 — Phase Timing View
**Files**:
- `apps/dashboard/src/app/views/phase-timing/phase-timing.adapters.ts`
- `apps/dashboard/src/app/views/phase-timing/phase-timing.component.ts`
- `apps/dashboard/src/app/views/phase-timing/phase-timing.component.html`
- `apps/dashboard/src/app/views/phase-timing/phase-timing.component.scss`

### Batch 4 — Session Comparison View
**Files**:
- `apps/dashboard/src/app/views/session-comparison/session-comparison.adapters.ts`
- `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts`
- `apps/dashboard/src/app/views/session-comparison/session-comparison.component.html`
- `apps/dashboard/src/app/views/session-comparison/session-comparison.component.scss`

### Batch 5 — Task Trace View
**Files**:
- `apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts`
- `apps/dashboard/src/app/views/task-trace/task-trace.component.ts`
- `apps/dashboard/src/app/views/task-trace/task-trace.component.html`
- `apps/dashboard/src/app/views/task-trace/task-trace.component.scss`

### Batch 6 — Wiring (routes + nav)
**Files**:
- `apps/dashboard/src/app/app.routes.ts` — add 4 lazy routes
- `apps/dashboard/src/app/services/mock-data.constants.ts` — add Telemetry sidebar section

---

## Files Affected Summary

**CREATE** (16 files):
```
apps/dashboard/src/app/views/model-performance/model-performance.component.ts
apps/dashboard/src/app/views/model-performance/model-performance.component.html
apps/dashboard/src/app/views/model-performance/model-performance.component.scss
apps/dashboard/src/app/views/model-performance/model-performance.adapters.ts
apps/dashboard/src/app/views/phase-timing/phase-timing.component.ts
apps/dashboard/src/app/views/phase-timing/phase-timing.component.html
apps/dashboard/src/app/views/phase-timing/phase-timing.component.scss
apps/dashboard/src/app/views/phase-timing/phase-timing.adapters.ts
apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts
apps/dashboard/src/app/views/session-comparison/session-comparison.component.html
apps/dashboard/src/app/views/session-comparison/session-comparison.component.scss
apps/dashboard/src/app/views/session-comparison/session-comparison.adapters.ts
apps/dashboard/src/app/views/task-trace/task-trace.component.ts
apps/dashboard/src/app/views/task-trace/task-trace.component.html
apps/dashboard/src/app/views/task-trace/task-trace.component.scss
apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts
```

**MODIFY** (3 files):
```
apps/dashboard/src/app/services/api.service.ts
apps/dashboard/src/app/app.routes.ts
apps/dashboard/src/app/services/mock-data.constants.ts
```

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer
**Rationale**: Pure Angular frontend work — components, services, templates, SCSS. No backend changes required (TASK_2026_145 already delivered all API endpoints).

### Complexity Assessment
**Complexity**: Medium
**Estimated Effort**: 4-6 hours

### Architecture Delivery Checklist
- [x] All components specified with evidence citations
- [x] All patterns verified from codebase (analytics component, adapter pattern, lazy routes)
- [x] All imports/classes verified as existing (CortexTask, CortexSession etc. in cortex.types.ts)
- [x] Quality requirements defined (OnPush, null guards, empty state, dark theme CSS vars)
- [x] Integration points documented (8 new API methods, controller endpoints)
- [x] Files affected list complete (16 CREATE, 3 MODIFY)
- [x] Developer type recommended (nitro-frontend-developer)
- [x] Complexity assessed (Medium, 4-6h)
- [x] No step-by-step implementation (nitro-team-leader decomposes)
