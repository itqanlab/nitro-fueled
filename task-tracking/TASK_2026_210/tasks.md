# Development Tasks - TASK_2026_210
# Migrate Dashboard Frontend to Session-Centric API

**Total Tasks**: 10 | **Batches**: 5 (with 3a/3b parallel) | **Status**: 0/5 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `getSessionHistory()` / `getSessionHistoryDetail()` actively consumed by sessions-list and session-detail — verified (plan lines 26–28)
- `drainSession()` already calls correct endpoint `PATCH /api/sessions/:id/stop` — verified (plan line 48)
- `sessions-panel.component.ts` calls `getActiveSessionsEnhanced()`, NOT `getSessionHistory()` — verified (plan line 44)
- Backend endpoints already implemented (TASK_2026_204) — plan states no backend changes needed
- WebSocket event types (`sessions:changed`, `session:update`) already present in `websocket.service.ts` — plan line 482

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Batch 2 renames break Batch 3 callers — build will fail between commits | HIGH | Batch 3 must be assigned immediately after Batch 2 is committed; do not leave an intermediate broken state |
| `getAutoSession()` name collision — plan renames `getSessionHistoryDetail()` to `getAutoSession()` AND adds a new `getAutoSession()` method | HIGH | Task 2.1 note: resolve by naming the detail-fetch alias `getAutoSessionById()` or confirm both map to the same implementation |
| `SessionStatusResponse.lastHeartbeat` field assumed present — used by `heartbeatStatusMap` in sessions-panel | MED | Developer must verify field exists in backend `SessionStatusResponse` type at `auto-pilot.types.ts:159-178` |
| LocalStorage `SecurityError` in private browsing | LOW | Wrap all localStorage calls in try/catch per quality requirements |

---

## Batch 1: Type Foundation - IMPLEMENTED

**Developer**: nitro-frontend-developer
**Tasks**: 1 | **Dependencies**: None

### Task 1.1: Add new session types and remove obsolete auto-pilot types in api.types.ts - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/models/api.types.ts`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 1 (lines 74–131), Batch 1 (lines 407–413)

**Pattern to Follow**: Existing `readonly` interface convention throughout `api.types.ts`. All interfaces use explicit `readonly` fields and explicit `export` keywords.

**Quality Requirements**:
- All new types sourced from backend `auto-pilot.model.ts` and `auto-pilot.types.ts` — field names must match wire format exactly
- `SupervisorConfig` uses snake_case fields (matches `SessionStatusResponse.config` wire format)
- `CreateSessionRequest` / `UpdateSessionConfigRequest` use camelCase (matches HTTP DTO layer)
- No `any` types

**Validation Notes**:
- The name collision risk between `getAutoSession()` and `getAutoSessionById()` originates here as a type concern — ensure `SessionStatusResponse` is flexible enough to serve both list and detail views
- Verify `SessionStatusResponse` contains `lastHeartbeat` field when reading `auto-pilot.types.ts:159-178`

**Implementation Details**:

Add these types (in this order, grouped logically):
```
ProviderType = 'claude' | 'glm' | 'opencode' | 'codex'
PriorityStrategy = 'build-first' | 'review-first' | 'balanced'
LoopStatus = 'running' | 'paused' | 'stopped'
SupervisorConfig (snake_case fields — from auto-pilot.types.ts:17-32)
CreateSessionRequest (camelCase — from auto-pilot.model.ts:18-31)
CreateSessionResponse { readonly sessionId: string; readonly status: 'starting'; }
UpdateSessionConfigRequest (camelCase — from auto-pilot.model.ts:43-56)
UpdateSessionConfigResponse { readonly sessionId: string; readonly config: SupervisorConfig; }
SessionStatusResponse (from auto-pilot.types.ts:159-178)
SessionActionResponse { readonly sessionId: string; readonly action: 'stopped' | 'paused' | 'resumed' | 'draining'; }
ListSessionsResponse { readonly sessions: ReadonlyArray<SessionStatusResponse>; }
```

Remove these types:
```
StartAutoPilotRequest
StartAutoPilotResponse
StopAutoPilotRequest
StopAutoPilotResponse
AutoPilotStatusResponse
```

Keep (do NOT remove):
```
SessionHistoryListItem
SessionHistoryDetail
SessionEndStatus
```

---

**Batch 1 Verification**:
- File exists at `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/models/api.types.ts`
- All 11 new types exported
- All 5 obsolete types removed
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 2: Service Layer - IMPLEMENTED

**Developer**: nitro-frontend-developer
**Tasks**: 1 | **Dependencies**: Batch 1 must be COMPLETE

### Task 2.1: Update api.service.ts — add new session methods, rename and remove old methods - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/api.service.ts`
**Status**: PENDING
**Spec Reference**: plan.md — Component 2 (lines 134–168), Batch 2 (lines 417–427)

**Pattern to Follow**: Every method follows `public methodName(params): Observable<ReturnType>` with `this.http.verb<Type>(url)`. URL building via `${this.base}/path`. `encodeURIComponent()` for path params (see lines 128, 178, 405, 411 in existing file).

**Quality Requirements**:
- No `/api/auto-pilot/*` calls anywhere after this task
- All 7 new methods have correct HTTP verb and URL
- All return types explicitly typed (no `any`)
- Import block updated — remove old types, add new types from Batch 1

**Validation Notes**:
- NAME COLLISION RISK: Plan renames `getSessionHistoryDetail()` to `getAutoSession()` AND adds a new raw `getAutoSession()` method. Resolve this by:
  - The renamed detail-fetch method should be `getAutoSessionById()` (or match the new method if they are truly the same implementation — both call `GET /api/sessions/:id` returning `Observable<SessionStatusResponse>`)
  - Confirm: if they are identical, just keep one `getAutoSession(id)` and remove `getSessionHistoryDetail()`. Do NOT create two methods with the same name.
- `getAutoSessions()` must unwrap `listAutoSessions().sessions` to return `Observable<SessionStatusResponse[]>`

**Implementation Details**:

Import block changes:
- Remove: `StartAutoPilotRequest`, `StartAutoPilotResponse`, `StopAutoPilotRequest`, `StopAutoPilotResponse`, `AutoPilotStatusResponse`, `SessionHistoryListItem`, `SessionHistoryDetail`
- Add: `CreateSessionRequest`, `CreateSessionResponse`, `ListSessionsResponse`, `SessionStatusResponse`, `SessionActionResponse`, `UpdateSessionConfigRequest`, `UpdateSessionConfigResponse`

Methods to ADD:
```
createAutoSession(req: CreateSessionRequest = {}): Observable<CreateSessionResponse>
  → POST ${this.base}/sessions

listAutoSessions(): Observable<ListSessionsResponse>
  → GET ${this.base}/sessions

getAutoSession(id: string): Observable<SessionStatusResponse>
  → GET ${this.base}/sessions/${encodeURIComponent(id)}

pauseAutoSession(id: string): Observable<SessionActionResponse>
  → POST ${this.base}/sessions/${encodeURIComponent(id)}/pause

resumeAutoSession(id: string): Observable<SessionActionResponse>
  → POST ${this.base}/sessions/${encodeURIComponent(id)}/resume

stopAutoSession(id: string): Observable<SessionActionResponse>
  → POST ${this.base}/sessions/${encodeURIComponent(id)}/stop

updateAutoSessionConfig(id: string, req: UpdateSessionConfigRequest): Observable<UpdateSessionConfigResponse>
  → PATCH ${this.base}/sessions/${encodeURIComponent(id)}/config
```

Methods to UPDATE:
```
getSessionHistory() → rename to getAutoSessions()
  return type: Observable<SessionStatusResponse[]>
  implementation: call listAutoSessions() and map(r => r.sessions), or call GET /api/sessions directly and map

getSessionHistoryDetail(id) → rename to getAutoSession(id) IF no collision, else getAutoSessionById(id)
  return type: Observable<SessionStatusResponse>
  URL unchanged: GET /api/sessions/:id

drainSession(id) → update return type to Observable<SessionActionResponse>
  URL and verb unchanged: PATCH /api/sessions/:id/stop
```

Methods to REMOVE:
```
startAutoPilot() (line ~332)
stopAutoPilot() (line ~336)
getAutoPilotStatus() (line ~340)
```

---

**Batch 2 Verification**:
- File exists and compiles
- No `auto-pilot` in any URL string in the service
- All 7 new methods present
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 3a: Sessions List View - IMPLEMENTED

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batch 2 must be COMPLETE | **Parallel With**: Batch 3b, Batch 4

### Task 3a.1: Update sessions-list.component.ts to use SessionStatusResponse - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts`
**Status**: PENDING
**Spec Reference**: plan.md — Component 5 (lines 294–315), Batch 3a (lines 433–435)

**Pattern to Follow**: Component uses `toSignal()` with `catchError()` (line 45). `EnrichedSession` interface built from raw API type. Display logic in `computed()` via `enriched` signal.

**Quality Requirements**:
- `EnrichedSession` interface updated to reflect new field mappings
- `statusColor()` maps `LoopStatus` values (`running`, `paused`, `stopped`) not the old `SessionEndStatus`
- No references to `SessionHistoryListItem` or `getSessionHistory()` remain

**Implementation Details**:

Field mapping changes:
```
s.id          → s.sessionId
s.endStatus   → s.loopStatus (type: LoopStatus)
s.durationMinutes → s.uptimeMinutes
s.totalCost   → display '—' (not present in SessionStatusResponse)
s.tasksCompleted  → s.tasks.completed
s.tasksFailed     → s.tasks.failed
s.supervisorModel → s.config.prep_model or display '—'
```

Import changes:
- Remove: `SessionHistoryListItem`
- Add: `SessionStatusResponse`, `LoopStatus`
- Call `api.getAutoSessions()` instead of `api.getSessionHistory()`

### Task 3a.2: Update sessions-list.component.html column bindings - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html`
**Status**: PENDING
**Spec Reference**: plan.md — Component 5 (lines 314–315), Batch 3a (line 435)

**Pattern to Follow**: Existing column headers and `@for` binding patterns in the template.

**Quality Requirements**:
- Column headers updated to reflect live session concepts (e.g., "Status" shows loopStatus)
- All bindings use enriched field names from Task 3a.1's updated `EnrichedSession`
- Cost column shows `—` where `totalCost` is absent

---

**Batch 3a Verification**:
- Both files exist and compile
- No references to `getSessionHistory()` or `SessionHistoryListItem`
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 3b: Session Detail View - PENDING

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batch 2 must be COMPLETE | **Parallel With**: Batch 3a, Batch 4

### Task 3b.1: Update session-detail.component.ts to use SessionStatusResponse - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 6 (lines 319–343), Batch 3b (lines 437–438)

**Pattern to Follow**: Component uses `toSignal()` with `switchMap()` over `route.paramMap` (line 90). `confirmDrain()` at line 144 calls `api.drainSession(sessionId)` using `raw.id` — update to `raw.sessionId`.

**Quality Requirements**:
- `EnrichedDetail` simplified to only fields available in `SessionStatusResponse`
- `EnrichedTask`, `EnrichedEvent`, `EnrichedWorker` interfaces removed
- `confirmDrain()` uses `raw.sessionId`
- No references to `getSessionHistoryDetail()` or `SessionHistoryDetail` remain

**Implementation Details**:

Field mapping changes:
```
raw.id             → raw.sessionId
raw.endStatus      → raw.loopStatus
raw.durationMinutes → raw.uptimeMinutes
raw.totalCost      → not available; display '—'
raw.taskResults    → replaced by raw.tasks (counts: completed, failed, inProgress, remaining)
raw.timeline       → remove timeline section
raw.workers        → raw.workers (counts: active, completed, failed)
raw.logContent     → remove log panel
raw.drainRequested → raw.drainRequested (kept)
raw.workerCount    → derive: raw.workers.active + raw.workers.completed + raw.workers.failed
```

Call `api.getAutoSession(id)` instead of `api.getSessionHistoryDetail(id)`.

Import changes:
- Remove: `SessionHistoryDetail`
- Add: `SessionStatusResponse`

### Task 3b.2: Update session-detail.component.html — remove timeline/log, update bindings - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 6 (lines 343), Batch 3b (line 438)

**Quality Requirements**:
- Timeline tab/section removed
- Log panel removed
- All bindings use updated `EnrichedDetail` fields from Task 3b.1
- `drainRequested` state correctly reflected in UI

---

**Batch 3b Verification**:
- Both files exist and compile
- No references to `getSessionHistoryDetail()` or `SessionHistoryDetail`
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 4: Sessions Panel Rewrite - IMPLEMENTED

**Developer**: nitro-frontend-developer
**Tasks**: 3 | **Dependencies**: Batch 2 must be COMPLETE | **Parallel With**: Batch 3a, Batch 3b

### Task 4.1: Rewrite sessions-panel.component.ts as presentational component - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 4 (lines 238–287), Batch 4 (lines 444–447)

**Pattern to Follow**: Parent-owns-state Angular pattern. Child receives data via `@Input`, emits actions via `@Output`. Existing `heartbeatStatusMap`, `startedAtLabels`, `now`, and `onSessionClick()` patterns are preserved.

**Quality Requirements**:
- `ApiService` injection removed — component no longer fetches data independently
- `cortexSessions` signal removed
- `@Input() sessions: SessionStatusResponse[] = []` replaces internal sessions signal
- All 4 `@Output` emitters present and correctly typed
- `heartbeatStatusMap` computed from `sessions` input's `lastHeartbeat` field
- No duplicate API calls from this component

**Validation Notes**:
- Verify `SessionStatusResponse.lastHeartbeat` field exists before using it in `heartbeatStatusMap`. If absent, developer must adapt the heartbeat logic or use a substitute field.

**Implementation Details**:

Remove:
```
private readonly apiService = inject(ApiService)
private loadSessions() method
private cortexSessions = signal<CortexSession[]>([])
getCortexSessions() call
```

Add:
```
@Input() sessions: SessionStatusResponse[] = []
@Output() pauseSession = new EventEmitter<string>()
@Output() resumeSession = new EventEmitter<string>()
@Output() stopSession = new EventEmitter<string>()
@Output() drainSession = new EventEmitter<string>()
```

Keep and adapt:
```
heartbeatStatusMap — computed from sessions input lastHeartbeat
startedAtLabels — computed
now — signal with interval update
onSessionClick() — navigation unchanged
```

### Task 4.2: Rewrite sessions-panel.component.html with per-session action controls - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 4 (lines 270–285)

**Quality Requirements**:
- Each session card has a controls row at the bottom
- Pause button: shown when `session.loopStatus === 'running'`
- Resume button: shown when `session.loopStatus === 'paused'`
- Drain button: shown when `!session.drainRequested && session.loopStatus !== 'stopped'`
- Stop button: shown when `session.loopStatus !== 'stopped'`
- Status badge shows `session.loopStatus` (LoopStatus type)
- Worker/task counts: `session.workers.active`, `session.tasks.inProgress`, `session.tasks.remaining`

### Task 4.3: Update or clear sessions-panel.model.ts - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/models/sessions-panel.model.ts`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 4 (lines 285–286)

**Quality Requirements**:
- `ActiveSessionSummary` interface removed
- `SessionPhase` type removed
- `SessionStatus` type removed
- File may be left empty (with a comment noting it is kept for future use) or deleted if no other imports depend on it
- If deleted, verify no remaining imports reference this file

---

**Batch 4 Verification**:
- All 3 files updated
- `sessions-panel.component.ts` has no `ApiService` injection
- 4 `@Output` emitters present
- `@Input() sessions` present
- `sessions-panel.model.ts` no longer exports `ActiveSessionSummary`
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Batch 5: Project Component - IMPLEMENTED

**Developer**: nitro-frontend-developer
**Tasks**: 2 | **Dependencies**: Batch 2 AND Batch 4 must be COMPLETE

### Task 5.1: Update project.component.ts — replace auto-pilot flow with session management - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/project/project.component.ts`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 3 (lines 171–235), Batch 5 (lines 453–461)

**Pattern to Follow**: All state as Angular `signal<T>()`. Computed values via `computed(() => ...)`. Subscriptions cleaned up via `destroyRef.onDestroy()` or `takeUntilDestroyed`. Form values read via event targets. WebSocket subscription pattern from `sessions-panel.component.ts:190`.

**Quality Requirements**:
- No `autoPilotState`, `autoPilotSessionId`, `autoPilotError`, `isAutoPilotBusy` signals remain
- No `onStartAutoPilot()`, `startPolling()`, `stopPolling()` methods remain
- No `pollSubscription` or `startSubscription` class fields remain
- LocalStorage access wrapped in try/catch
- `loadSessions()` called in `ngOnInit`
- WebSocket events `sessions:changed` / `session:update` trigger `loadSessions()`
- 15s timer poll as fallback if WebSocket not delivering

**Implementation Details**:

Signals to REMOVE:
```
autoPilotState = signal<'idle' | 'starting' | 'running'>('idle')
autoPilotSessionId = signal<string | null>(null)
autoPilotError = signal<string | null>(null)
isAutoPilotBusy = computed(...)
```

Signals to ADD:
```
createSessionPending = signal(false)
createSessionError = signal<string | null>(null)
sessionFormOpen = signal(false)
sessionConfig = signal<CreateSessionRequest>(this.loadSavedConfig())
activeSessions = signal<SessionStatusResponse[]>([])
sessionsLoading = signal(false)
```

Methods to REMOVE:
```
onStartAutoPilot()
startPolling()
stopPolling()
```

Methods to ADD:
```
openSessionForm()        → sessionFormOpen.set(true)
closeSessionForm()       → sessionFormOpen.set(false)
onCreateSession()        → apiService.createAutoSession(sessionConfig()), on success: saveConfig(), closeSessionForm(), loadSessions()
onPauseSession(id)       → apiService.pauseAutoSession(id), refresh list on success
onResumeSession(id)      → apiService.resumeAutoSession(id), refresh list on success
onStopSession(id)        → apiService.stopAutoSession(id), refresh list on success
onDrainSession(id)       → apiService.drainSession(id), refresh list on success
onUpdateConfig(id, req)  → apiService.updateAutoSessionConfig(id, req), refresh list on success
private loadSessions()   → apiService.listAutoSessions(), populate activeSessions
private saveConfig(config: CreateSessionRequest): void  → localStorage.setItem('nitro-session-config', JSON.stringify(config))
private loadSavedConfig(): CreateSessionRequest         → parse localStorage, return {} on any failure
```

Default form values (from `DEFAULT_SUPERVISOR_CONFIG` in `auto-pilot.types.ts:43-58`):
```
concurrency=2, limit=10, priority='build-first'
```

### Task 5.2: Update project.component.html — new session form and sessions-panel wiring - IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/project/project.component.html`
**Status**: IMPLEMENTED
**Spec Reference**: plan.md — Component 3 (lines 218–230), Batch 5 (lines 457–461)

**Quality Requirements**:
- Single "Start Auto-Pilot" button at lines 16–36 replaced with "New Session" button
- Auto-pilot status note block (lines 39–45) removed
- Collapsible form panel rendered via `@if (sessionFormOpen())`
- Form fields: `concurrency`, `limit`, `priority`, `implementProvider`, `implementModel`, `implementFallbackProvider`, `implementFallbackModel`, `reviewProvider`, `reviewModel`
- Form has "Create Session" submit button calling `onCreateSession()` and "Cancel" button calling `closeSessionForm()`
- `<app-sessions-panel>` receives `[sessions]="activeSessions()"` input
- `<app-sessions-panel>` has `(pauseSession)`, `(resumeSession)`, `(stopSession)`, `(drainSession)` output bindings wired to parent handler methods

---

**Batch 5 Verification**:
- Both files exist and compile
- No `/api/auto-pilot/` calls anywhere in the codebase
- `<app-sessions-panel>` wired with all inputs and outputs
- Session creation form renders and pre-fills from LocalStorage
- Build passes: `npx nx build dashboard`
- nitro-code-logic-reviewer approved

---

## Final Completion Checklist

- [x] Batch 1: Type Foundation — IMPLEMENTED
- [x] Batch 2: Service Layer — IMPLEMENTED
- [x] Batch 3a: Sessions List View — IMPLEMENTED
- [ ] Batch 3b: Session Detail View — COMPLETE
- [ ] Batch 4: Sessions Panel Rewrite — COMPLETE
- [ ] Batch 5: Project Component — COMPLETE
- [ ] No `auto-pilot` URLs remain in frontend codebase
- [ ] No `any` types in new code
- [ ] Build passes end-to-end: `npx nx build dashboard`
- [ ] All git commits verified
