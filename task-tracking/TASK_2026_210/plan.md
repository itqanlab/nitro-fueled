# Implementation Plan — TASK_2026_210
# Migrate Dashboard Frontend to Session-Centric API

## Codebase Investigation Summary

### Files Investigated

| File | Purpose |
|------|---------|
| `apps/dashboard/src/app/services/api.service.ts` | HTTP client service — all backend calls live here |
| `apps/dashboard/src/app/models/api.types.ts` | Shared type definitions — 770 lines covering all API shapes |
| `apps/dashboard/src/app/views/project/project.component.ts` | Task Queue view — currently owns the `startAutoPilot` / polling flow |
| `apps/dashboard/src/app/views/project/project.component.html` | Template — renders the single Auto-Pilot button |
| `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts` | Side panel — displays `ActiveSessionSummary[]` from `getActiveSessionsEnhanced()` |
| `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html` | Template — read-only session cards, no per-session controls |
| `apps/dashboard/src/app/models/sessions-panel.model.ts` | `ActiveSessionSummary` model used by the panel |
| `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts` | Sessions history view — calls `getSessionHistory()` |
| `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts` | Session detail view — calls `getSessionHistoryDetail()` and `drainSession()` |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` | Backend — confirmed routes, all verified |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` | Backend DTOs — source of truth for request/response shapes |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` | Backend domain types — `SupervisorConfig`, `SessionStatusResponse`, `LoopStatus`, etc. |

### Critical Findings

**1. `getSessionHistory()` and `getSessionHistoryDetail()` are actively consumed.**
- `sessions-list.component.ts:46` calls `api.getSessionHistory()` and types the result as `SessionHistoryListItem[]`
- `session-detail.component.ts:94` calls `api.getSessionHistoryDetail(id)` and types the result as `SessionHistoryDetail`
- Both of these call `/api/sessions` and `/api/sessions/:id` — the exact same routes now owned by the new `AutoPilotController`

**2. The new backend returns `ListSessionsResponse` / `SessionStatusResponse` — structurally incompatible with `SessionHistoryListItem` / `SessionHistoryDetail`.**
- `SessionHistoryListItem` has fields like `endStatus`, `durationMinutes`, `tasksCompleted`, `totalCost` — historical/completed session data
- `SessionStatusResponse` has fields like `loopStatus`, `config`, `workers`, `tasks`, `uptimeMinutes`, `drainRequested` — live supervisor session data
- The sessions-list and session-detail views must be updated to work with the new live-session shapes

**3. `project.component.ts` owns `startAutoPilot()` and status polling.**
- Signal: `autoPilotState: signal<'idle' | 'starting' | 'running'>` (line 71)
- Signal: `autoPilotSessionId: signal<string | null>` (line 72)
- Method: `onStartAutoPilot()` at line 843 — calls `apiService.startAutoPilot()`
- Polling: `startPolling()` at line 926 — polls `getAutoPilotStatus(sessionId)` every 1500ms, stops when `status === 'running'`
- Template: single button at `project.component.html:16–36`

**4. `sessions-panel.component.ts` uses `getActiveSessionsEnhanced()` — a DIFFERENT endpoint.**
- It does NOT call `getSessionHistory()` — it calls `/api/sessions/active/enhanced`
- It shows `ActiveSessionSummary[]` from `sessions-panel.model.ts`
- This component needs new input/action wiring but its data-loading mechanism is independent

**5. No `drainSession()` in `sessions-panel` — only in `session-detail.component.ts`.**
- `session-detail.component.ts:151` calls `api.drainSession(sessionId)` — this already maps to `PATCH /api/sessions/:id/stop` which is unchanged in the new controller
- After the rename in `api.service.ts`, `drainSession()` stays structurally the same but should return `SessionActionResponse`

**6. Old auto-pilot endpoints to remove from `api.service.ts`:**
- `startAutoPilot()` → `POST /api/auto-pilot/start` (line 333) — endpoint gone
- `stopAutoPilot()` → `POST /api/auto-pilot/stop` (line 337) — endpoint gone
- `getAutoPilotStatus()` → `GET /api/auto-pilot/status/:id` (line 341) — endpoint gone

**7. `LocalStorage` for last-used session config — not yet present anywhere.** This is new functionality.

**8. `SupervisorConfig` has snake_case fields (`prep_provider`, `implement_model`, etc.) while `CreateSessionRequest` / `UpdateSessionConfigRequest` use camelCase.** The frontend form must use camelCase field names to match the HTTP API DTOs, not the internal `SupervisorConfig` shape.

---

## Architecture Design

### Design Philosophy

**Chosen Approach**: Direct replacement of the old auto-pilot API surface with new session-centric methods. No compatibility layer. No parallel implementations.

The `api.service.ts` will gain 7 new session-centric methods and lose 3 old ones. Type aliases in `api.types.ts` will add the new shapes and remove the old `StartAutoPilotRequest/Response`, `StopAutoPilotRequest/Response`, and `AutoPilotStatusResponse` types. The project component will shift from a single-session "start and poll" model to a multi-session "create and list" model. The sessions-list and session-detail views will be updated to operate on live `SessionStatusResponse` data instead of historical `SessionHistoryListItem` / `SessionHistoryDetail` data.

---

## Component Specifications

### Component 1 — `api.types.ts` (MODIFY)

**File**: `apps/dashboard/src/app/models/api.types.ts`

**Purpose**: Add types mirroring the backend session API DTOs. Remove obsolete auto-pilot types.

**Evidence of pattern**: All types in this file follow `readonly` interface convention with explicit exports. Line 244 onwards shows the current auto-pilot types being removed.

**Responsibilities**:
- Add `ProviderType`, `PriorityStrategy`, `LoopStatus` union type aliases
- Add `SupervisorConfig` interface (camelCase field names matching the HTTP response, since the frontend receives the config from the backend's `SessionStatusResponse.config`)
- Add `CreateSessionRequest` / `CreateSessionResponse` interfaces
- Add `UpdateSessionConfigRequest` / `UpdateSessionConfigResponse` interfaces
- Add `SessionStatusResponse` interface (the full live-session shape)
- Add `SessionActionResponse` interface
- Add `ListSessionsResponse` interface
- Remove `StartAutoPilotRequest`, `StartAutoPilotResponse`, `StopAutoPilotRequest`, `StopAutoPilotResponse`, `AutoPilotStatusResponse`
- Keep `SessionHistoryListItem`, `SessionHistoryDetail`, `SessionEndStatus` — they represent historical cortex sessions and will be repurposed for the sessions-list and session-detail views (see Component 4 below)

**SupervisorConfig shape note**: The backend returns `SupervisorConfig` with snake_case keys in `SessionStatusResponse.config`. The frontend should define `SupervisorConfig` with the same snake_case keys to match exact wire format. The `CreateSessionRequest` / `UpdateSessionConfigRequest` use camelCase (matching the HTTP DTO layer in `auto-pilot.model.ts`). Both shapes are needed in `api.types.ts`.

**Type definitions to add** (sourced from `auto-pilot.model.ts` and `auto-pilot.types.ts`):

```typescript
// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:9-11
export type ProviderType = 'claude' | 'glm' | 'opencode' | 'codex';
export type PriorityStrategy = 'build-first' | 'review-first' | 'balanced';
export type LoopStatus = 'running' | 'paused' | 'stopped';

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:17-32
// SupervisorConfig with snake_case fields (wire format in SessionStatusResponse.config)
export interface SupervisorConfig { ... }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts:18-31
export interface CreateSessionRequest { ... }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts:43-56
export interface UpdateSessionConfigRequest { ... }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:159-178
export interface SessionStatusResponse { ... }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts:33-36
export interface CreateSessionResponse { readonly sessionId: string; readonly status: 'starting'; }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts:58-61
export interface UpdateSessionConfigResponse { readonly sessionId: string; readonly config: SupervisorConfig; }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts:68-70
export interface SessionActionResponse { readonly sessionId: string; readonly action: 'stopped' | 'paused' | 'resumed' | 'draining'; }

// Source: apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts:76-78
export interface ListSessionsResponse { readonly sessions: ReadonlyArray<SessionStatusResponse>; }
```

**Files Affected**:
- `apps/dashboard/src/app/models/api.types.ts` (MODIFY)

---

### Component 2 — `api.service.ts` (MODIFY)

**File**: `apps/dashboard/src/app/services/api.service.ts`

**Purpose**: Replace old auto-pilot HTTP methods with new session-centric methods. Update the session history methods to return the new live-session types.

**Evidence of pattern**: Every method in this file follows `public methodName(params): Observable<ReturnType>` with `this.http.verb<Type>(url)`. All URL building uses `${this.base}/path`. Encoding via `encodeURIComponent()` for path params (lines 128, 178, 405, 411). The `drainSession()` method at line 411 already calls the correct `PATCH /api/sessions/:id/stop` endpoint.

**Responsibilities**:

**Add these methods:**
- `createAutoSession(req: CreateSessionRequest = {}): Observable<CreateSessionResponse>` → `POST /api/sessions`
- `listAutoSessions(): Observable<ListSessionsResponse>` → `GET /api/sessions`
- `getAutoSession(id: string): Observable<SessionStatusResponse>` → `GET /api/sessions/:id`
- `pauseAutoSession(id: string): Observable<SessionActionResponse>` → `POST /api/sessions/:id/pause`
- `resumeAutoSession(id: string): Observable<SessionActionResponse>` → `POST /api/sessions/:id/resume`
- `stopAutoSession(id: string): Observable<SessionActionResponse>` → `POST /api/sessions/:id/stop`
- `updateAutoSessionConfig(id: string, req: UpdateSessionConfigRequest): Observable<UpdateSessionConfigResponse>` → `PATCH /api/sessions/:id/config`

**Remove these methods:**
- `startAutoPilot()` (line 332) — callers: `project.component.ts:851`
- `stopAutoPilot()` (line 336) — callers: none found in investigation
- `getAutoPilotStatus()` (line 340) — callers: `project.component.ts:928`

**Update these methods:**
- `getSessionHistory()` (line 401) → rename to `getAutoSessions()`, return type changes from `Observable<SessionHistoryListItem[]>` to `Observable<SessionStatusResponse[]>`. Internally: call `listAutoSessions()` and unwrap `.sessions`, or call the endpoint directly and map the response.
  - **Alternative (cleaner)**: Rename to `getAutoSessions()` and call `listAutoSessions()` — but since `listAutoSessions()` returns `ListSessionsResponse` (an object), `getAutoSessions()` must unwrap `.sessions` and return `Observable<SessionStatusResponse[]>`.
- `getSessionHistoryDetail()` (line 405) → rename to `getAutoSession()`, return type changes from `Observable<SessionHistoryDetail>` to `Observable<SessionStatusResponse>`. URL stays `/api/sessions/:id`.
- `drainSession()` (line 411) → update return type to `Observable<SessionActionResponse>` (was `Observable<{ readonly sessionId: string; readonly action: string }>`). URL and HTTP verb stay the same.

**Import changes in `api.service.ts`**: Remove `StartAutoPilotRequest`, `StartAutoPilotResponse`, `StopAutoPilotRequest`, `StopAutoPilotResponse`, `AutoPilotStatusResponse`, `SessionHistoryListItem`, `SessionHistoryDetail` from the import block at lines 15–65. Add `CreateSessionRequest`, `CreateSessionResponse`, `ListSessionsResponse`, `SessionStatusResponse`, `SessionActionResponse`, `UpdateSessionConfigRequest`, `UpdateSessionConfigResponse`.

**Files Affected**:
- `apps/dashboard/src/app/services/api.service.ts` (MODIFY)

---

### Component 3 — `project.component.ts` + `project.component.html` (MODIFY)

**File**: `apps/dashboard/src/app/views/project/project.component.ts`

**Purpose**: Replace single-session "Start Auto-Pilot" button flow with a multi-session creation form. Add LocalStorage persistence for last-used config.

**Evidence of pattern**: All state is managed as Angular signals (`signal<T>()`). Computed values use `computed(() => ...)`. Subscriptions are cleaned up via `destroyRef.onDestroy()` and `Subscription.unsubscribe()`. Form values are read via event targets (e.g., `(event.target as HTMLInputElement).value`).

**State changes:**

Remove these signals:
- `autoPilotState = signal<'idle' | 'starting' | 'running'>('idle')` (line 71)
- `autoPilotSessionId = signal<string | null>(null)` (line 72)
- `autoPilotError = signal<string | null>(null)` (line 73)
- `isAutoPilotBusy = computed(() => this.autoPilotState() !== 'idle')` (line 275)

Add these signals:
- `createSessionPending = signal(false)` — true while the POST is in flight
- `createSessionError = signal<string | null>(null)` — last error message
- `sessionFormOpen = signal(false)` — controls the config form panel visibility
- `sessionConfig = signal<CreateSessionRequest>(this.loadSavedConfig())` — the form model, initialised from LocalStorage
- `activeSessions = signal<SessionStatusResponse[]>([])` — the live list from polling
- `sessionsLoading = signal(false)` — skeleton state while sessions load

Remove these methods:
- `onStartAutoPilot()` (line 843)
- `startPolling()` (line 926) — was single-session polling
- `stopPolling()` (line 944)
- `private pollSubscription` field
- `private startSubscription` field

Add these methods:
- `openSessionForm()` — sets `sessionFormOpen(true)`
- `closeSessionForm()` — sets `sessionFormOpen(false)`
- `onCreateSession()` — calls `apiService.createAutoSession(this.sessionConfig())`, on success: saves config to LocalStorage, closes form, refreshes session list
- `onPauseSession(id: string)` — calls `apiService.pauseAutoSession(id)`, refreshes list on success
- `onResumeSession(id: string)` — calls `apiService.resumeAutoSession(id)`, refreshes list on success
- `onStopSession(id: string)` — calls `apiService.stopAutoSession(id)`, refreshes list on success
- `onDrainSession(id: string)` — calls `apiService.drainSession(id)`, refreshes list on success
- `onUpdateConfig(id: string, req: UpdateSessionConfigRequest)` — calls `apiService.updateAutoSessionConfig(id, req)`, refreshes list on success
- `private loadSessions()` — calls `apiService.listAutoSessions()`, populates `activeSessions`
- `private saveConfig(config: CreateSessionRequest): void` — writes to `localStorage.setItem('nitro-session-config', JSON.stringify(config))`
- `private loadSavedConfig(): CreateSessionRequest` — reads and parses `localStorage.getItem('nitro-session-config')`, returns empty object on failure/absent

**Polling strategy**: On `ngOnInit`, call `loadSessions()` once. Subscribe to WebSocket `sessions:changed` / `session:update` events (same pattern used in `sessions-panel.component.ts:190`) to refresh `activeSessions` reactively without a timer-based poll. Timer poll at 15s interval is a fallback if WebSocket is not delivering.

**Template changes** (`project.component.html`):

The header area (lines 14–37) changes from:
- Single "Start Auto-Pilot" button → "New Session" button that opens the config form panel

Replace the `autoPilotState`-driven button with:
- A "New Session" button that calls `openSessionForm()`
- An inline collapsible form panel (using Angular `@if (sessionFormOpen())`) with fields for `concurrency`, `limit`, `priority`, `implementProvider`, `implementModel`, `implementFallbackProvider`, `implementFallbackModel`, `reviewProvider`, `reviewModel`
- The form has "Create Session" submit and "Cancel" buttons
- Fields have sensible defaults drawn from `DEFAULT_SUPERVISOR_CONFIG` (sourced from `auto-pilot.types.ts:43–58`): concurrency=2, limit=10, priority='build-first', etc.

The session status note block (lines 39–45) is removed (replaced by the live session list in `sessions-panel`).

`SessionsPanelComponent` already receives session control events via `@Output` emitters (to be wired in Component 4). The `project.component.html` passes action handlers down to `<app-sessions-panel>`.

**Files Affected**:
- `apps/dashboard/src/app/views/project/project.component.ts` (MODIFY)
- `apps/dashboard/src/app/views/project/project.component.html` (MODIFY)

---

### Component 4 — `sessions-panel.component.ts` + template (MODIFY)

**File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts`

**Purpose**: Upgrade from read-only display to per-session control panel with pause/resume/stop/drain actions. Change data source from `getActiveSessionsEnhanced()` to accept `SessionStatusResponse[]` as an `@Input`.

**Evidence of pattern**: Component currently uses `inject(ApiService)` and loads data internally via `loadSessions()`. For actions, it makes the most sense to accept action callbacks as `@Input` from the parent, since the parent (`project.component.ts`) already owns the `activeSessions` signal and orchestrates API calls. This avoids having two components independently calling the same service methods.

**Architectural decision — data ownership**: The parent `ProjectComponent` owns the `activeSessions` signal and is responsible for loading and refreshing sessions. The `SessionsPanelComponent` becomes a pure display component with action outputs. This is the established Angular pattern — the component that owns state manages it; child components display and emit events.

**Responsibilities**:

Remove:
- `private readonly apiService = inject(ApiService)` — injected only for `getActiveSessionsEnhanced()` and `getCortexSessions()`, both of which will no longer be called from here
- `private loadSessions()` method
- `private cortexSessions = signal<CortexSession[]>([])` signal
- The `getCortexSessions()` call — heartbeat data will come from `SessionStatusResponse.lastHeartbeat` directly

Add:
- `@Input() sessions: SessionStatusResponse[] = []` — replaces the internal `sessions` signal
- `@Output() pauseSession = new EventEmitter<string>()` — emits sessionId
- `@Output() resumeSession = new EventEmitter<string>()` — emits sessionId
- `@Output() stopSession = new EventEmitter<string>()` — emits sessionId
- `@Output() drainSession = new EventEmitter<string>()` — emits sessionId

Keep:
- `webSocketService` subscription pattern for real-time refresh (the parent should subscribe and refresh `activeSessions`; alternatively, the panel can emit a `requestRefresh` output and let the parent handle it)
- `heartbeatStatusMap` computed — but sourced from `sessions` input's `lastHeartbeat` field (from `SessionStatusResponse.lastHeartbeat`) rather than a separate cortex API call
- `startedAtLabels` computed
- `now` signal and interval update
- `onSessionClick()` navigation

**Session card per-session controls** (template changes):

Each session card gains a controls row at the bottom with:
- Pause button (shown when `session.loopStatus === 'running'`)
- Resume button (shown when `session.loopStatus === 'paused'`)
- Drain button (shown when `!session.drainRequested && session.loopStatus !== 'stopped'`)
- Stop button (shown when `session.loopStatus !== 'stopped'`)

Session card status badge shows `session.loopStatus` (running/paused/stopped) from the new `LoopStatus` type.

Worker/task counts displayed in card body:
- `session.workers.active` active workers
- `session.tasks.inProgress` tasks in progress
- `session.tasks.remaining` tasks remaining

**`sessions-panel.model.ts` changes**: The `ActiveSessionSummary` interface and `SessionPhase` type are removed. They are replaced by direct use of `SessionStatusResponse` from `api.types.ts`. The file may be deleted or left empty.

**Files Affected**:
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts` (REWRITE)
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html` (REWRITE)
- `apps/dashboard/src/app/models/sessions-panel.model.ts` (REWRITE — remove `ActiveSessionSummary`, add nothing; or delete)

---

### Component 5 — `sessions-list.component.ts` (MODIFY)

**File**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts`

**Purpose**: Update to call `getAutoSessions()` and display `SessionStatusResponse[]` instead of `SessionHistoryListItem[]`.

**Evidence of pattern**: Component uses `toSignal()` with `catchError()` at line 45. The `EnrichedSession` interface is built from the raw API type. All display logic is in `computed()` via the `enriched` signal.

**Impact**: The component currently maps `SessionHistoryListItem` fields:
- `s.id` → becomes `s.sessionId`
- `s.endStatus` → becomes `s.loopStatus` (type changes from `SessionEndStatus` to `LoopStatus`)
- `s.durationMinutes` → becomes `s.uptimeMinutes`
- `s.totalCost` → NOT present in `SessionStatusResponse` (live sessions don't track cost yet); display as `—`
- `s.tasksCompleted` → becomes `s.tasks.completed`
- `s.tasksFailed` → becomes `s.tasks.failed`
- `s.supervisorModel` → becomes `s.config.prep_model` or display `—`

The `EnrichedSession` interface stays but its field mapping changes. The `statusColor()` private method changes to map `LoopStatus` instead of `SessionEndStatus`.

**Files Affected**:
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts` (MODIFY)
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html` (MODIFY — update column headers and bindings)

---

### Component 6 — `session-detail.component.ts` (MODIFY)

**File**: `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts`

**Purpose**: Update to call `getAutoSession(id)` and display `SessionStatusResponse` instead of `SessionHistoryDetail`.

**Evidence of pattern**: Component uses `toSignal()` with `switchMap()` over `route.paramMap` at line 90. The `confirmDrain()` method at line 144 already calls `api.drainSession(sessionId)` using `raw.id` — after rename, it will use `raw.sessionId`.

**Impact**:
- `raw.id` → `raw.sessionId`
- `raw.endStatus` → `raw.loopStatus`
- `raw.durationMinutes` → `raw.uptimeMinutes`
- `raw.totalCost` → not available; display `—`
- `raw.taskResults` → not present; replaced with `raw.tasks` (counts only, no per-task detail in live view)
- `raw.timeline` → not present in `SessionStatusResponse`; remove timeline tab
- `raw.workers` → becomes `raw.workers` (counts only: `active`, `completed`, `failed`)
- `raw.logContent` → not present; remove log panel
- `raw.drainRequested` → present, kept
- `raw.workerCount` → derive from `raw.workers.active + raw.workers.completed + raw.workers.failed`

The `EnrichedDetail` interface and enrichment methods are simplified to match the available fields. `EnrichedTask`, `EnrichedEvent`, `EnrichedWorker` interfaces are removed since `SessionStatusResponse` does not contain per-task or per-worker detail arrays.

**Files Affected**:
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts` (MODIFY)
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html` (MODIFY)

---

## Data Flow

```
ProjectComponent (owns activeSessions signal)
  │
  ├── ngOnInit → loadSessions() → apiService.listAutoSessions() → activeSessions.set(...)
  │
  ├── WebSocket events (sessions:changed / session:update) → loadSessions()
  │
  ├── [New Session button] → sessionFormOpen.set(true) → form with CreateSessionRequest fields
  │                        → onCreateSession() → apiService.createAutoSession()
  │                        → on success: saveConfig(), closeSessionForm(), loadSessions()
  │
  └── <app-sessions-panel [sessions]="activeSessions()"
          (pauseSession)="onPauseSession($event)"
          (resumeSession)="onResumeSession($event)"
          (stopSession)="onStopSession($event)"
          (drainSession)="onDrainSession($event)">
        │
        └── Per-session card:
              - Status badge: session.loopStatus
              - Worker counts: session.workers.active
              - Task counts: session.tasks.remaining
              - Action buttons → emit events to parent
```

---

## LocalStorage Persistence Architecture

The last-used session config is stored under the key `'nitro-session-config'` in `localStorage`.

- **Shape**: `CreateSessionRequest` (camelCase, all fields optional)
- **Write**: on successful `createAutoSession()` call, save `sessionConfig()` to localStorage
- **Read**: in `loadSavedConfig()` called during signal initialization — parse JSON, validate it is an object, return it or `{}` on any failure
- **No migration needed**: the type is a flat optional-fields interface; missing or extra fields are safe to ignore

---

## Quality Requirements

### Functional Requirements
- All 8 backend endpoints have corresponding service methods in `api.service.ts`
- No call to `/api/auto-pilot/*` remains anywhere in the frontend codebase after this task
- `sessions-list` and `session-detail` views display live session data without errors
- Per-session pause/resume/stop/drain buttons work and refresh the session list
- Session creation form pre-fills with last-used config from LocalStorage
- LocalStorage write happens only on successful session creation (not on form open)

### Non-Functional Requirements
- **No backward compatibility layers**: old `startAutoPilot()`, `stopAutoPilot()`, `getAutoPilotStatus()` are fully removed, not aliased
- **Type safety**: no `any` or unguarded `unknown` in new code; all response types are explicitly typed
- **Signal-based state**: no new imperative subscriptions stored as class fields (use `takeUntilDestroyed` or `toSignal` patterns established in existing code)
- **LocalStorage access isolated**: wrapped in try/catch to handle `SecurityError` (private browsing) without crashing
- **No duplicate API calls**: `SessionsPanelComponent` no longer independently fetches sessions — parent owns and passes data down

---

## Batch Decomposition (Parallel-Safe Batches for Team-Leader)

### Batch 1 — Type Foundation (no component dependencies)
**Can run in parallel with nothing else, but must complete before Batch 2.**

1. **B1-T1**: Add new session types to `api.types.ts` (`ProviderType`, `PriorityStrategy`, `LoopStatus`, `SupervisorConfig`, `CreateSessionRequest`, `CreateSessionResponse`, `UpdateSessionConfigRequest`, `UpdateSessionConfigResponse`, `SessionStatusResponse`, `SessionActionResponse`, `ListSessionsResponse`)
2. **B1-T2**: Remove `StartAutoPilotRequest`, `StartAutoPilotResponse`, `StopAutoPilotRequest`, `StopAutoPilotResponse`, `AutoPilotStatusResponse` from `api.types.ts`

These two sub-tasks touch the same file — they must be done in one atomic edit to avoid a broken intermediate state. Treat B1 as a single task.

---

### Batch 2 — Service Layer (depends on Batch 1)
**Single task. After Batch 1 completes.**

1. **B2-T1**: Update `api.service.ts`:
   - Update import block (remove old types, add new types from Batch 1)
   - Add `createAutoSession()`, `listAutoSessions()`, `getAutoSession()`, `pauseAutoSession()`, `resumeAutoSession()`, `stopAutoSession()`, `updateAutoSessionConfig()`
   - Rename `getSessionHistory()` → `getAutoSessions()` returning `Observable<SessionStatusResponse[]>`
   - Rename `getSessionHistoryDetail()` → `getAutoSession()` returning `Observable<SessionStatusResponse>`
   - Update `drainSession()` return type to `Observable<SessionActionResponse>`
   - Remove `startAutoPilot()`, `stopAutoPilot()`, `getAutoPilotStatus()`

---

### Batch 3 — Sessions Views (depends on Batch 2; Batch 3a and 3b can run in parallel)

**Batch 3a — Sessions List View**:
1. Update `sessions-list.component.ts`: replace `getSessionHistory()` call with `getAutoSessions()`, update `SessionHistoryListItem` import to `SessionStatusResponse`, update `EnrichedSession` mapping
2. Update `sessions-list.component.html`: update column bindings to match new field names

**Batch 3b — Session Detail View**:
1. Update `session-detail.component.ts`: replace `getSessionHistoryDetail()` call with `getAutoSession()`, update `SessionHistoryDetail` import to `SessionStatusResponse`, simplify `EnrichedDetail`, remove `EnrichedTask`/`EnrichedEvent`/`EnrichedWorker`, update `confirmDrain()` to use `raw.sessionId`
2. Update `session-detail.component.html`: remove timeline and log sections, update bindings

---

### Batch 4 — Sessions Panel Rewrite (depends on Batch 2; can run in parallel with Batch 3)

1. **B4-T1**: Rewrite `sessions-panel.component.ts`: convert to presentational component with `@Input() sessions: SessionStatusResponse[]` and `@Output()` emitters for each action; remove direct API injection; update `heartbeatStatusMap` to use `session.lastHeartbeat`; remove `cortexSessions` signal
2. **B4-T2**: Rewrite `sessions-panel.component.html`: add per-session action buttons (pause/resume/stop/drain), update status badge to use `loopStatus`, add worker/task count display
3. **B4-T3**: Update or delete `sessions-panel.model.ts` (remove `ActiveSessionSummary`, `SessionPhase`, `SessionStatus`)

---

### Batch 5 — Project Component (depends on Batch 2 and Batch 4)

1. **B5-T1**: Update `project.component.ts`:
   - Remove old auto-pilot signals, computed, and methods
   - Add `activeSessions`, `createSessionPending`, `createSessionError`, `sessionFormOpen`, `sessionConfig` signals
   - Add `loadSessions()`, `onCreateSession()`, `onPauseSession()`, `onResumeSession()`, `onStopSession()`, `onDrainSession()`, `onUpdateConfig()`, `saveConfig()`, `loadSavedConfig()` methods
   - Wire WebSocket subscription for `sessions:changed` / `session:update` events to call `loadSessions()`
   - Call `loadSessions()` in `ngOnInit`
2. **B5-T2**: Update `project.component.html`:
   - Replace single Auto-Pilot button with "New Session" button + collapsible config form
   - Remove auto-pilot status note block
   - Pass `[sessions]="activeSessions()"` and action event bindings to `<app-sessions-panel>`

---

## Files Affected Summary

**MODIFY**:
- `apps/dashboard/src/app/models/api.types.ts`
- `apps/dashboard/src/app/services/api.service.ts`
- `apps/dashboard/src/app/views/project/project.component.ts`
- `apps/dashboard/src/app/views/project/project.component.html`
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts`
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html`

**REWRITE**:
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts`
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html`
- `apps/dashboard/src/app/models/sessions-panel.model.ts`

**NO CHANGES NEEDED**:
- `apps/dashboard-api/` — backend is already implemented (TASK_2026_204)
- `apps/dashboard/src/app/services/websocket.service.ts` — existing event types cover what's needed

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-frontend-developer

**Rationale**: All changes are Angular component/service/type work. No backend changes. Pattern is established — modify existing Angular signals, HTTP service methods, and templates.

### Complexity Assessment
**Complexity**: MEDIUM

**Estimated Effort**: 3–5 hours

**Key risk**: The `sessions-list` and `session-detail` views call `getSessionHistory()` / `getSessionHistoryDetail()` with `SessionHistoryListItem` / `SessionHistoryDetail` types. After the rename, those views must be updated in the same batch (Batch 3) or the build will fail. The team-leader must ensure Batch 2 and Batch 3 are committed together or Batch 3 immediately follows Batch 2 before any intermediate build.

### Architecture Delivery Checklist
- [x] All components specified with evidence
- [x] All patterns verified from codebase
- [x] All imports/classes verified as existing
- [x] Quality requirements defined
- [x] Integration points documented
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No backward compatibility layers
- [x] No parallel/legacy implementations
- [x] Batch decomposition with parallelism analysis
