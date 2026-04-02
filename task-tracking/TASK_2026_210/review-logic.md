# Code Logic Review — TASK_2026_210

## Overall Score: 6/10

## Assessment

The session migration is structurally complete. The happy path — create a session, list sessions, pause/resume/stop — is wired correctly. HTTP verbs match the backend controller. Type shapes are an exact copy of the backend DTOs. However, three failure modes are present that will cause silent breakage or incorrect runtime behavior in production: a same-URL type collision between two `GET /api/sessions` methods, a wrong HTTP verb on `drainSession`, and absent error handling on all four per-session action calls in the project component.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`onPauseSession`, `onResumeSession`, `onStopSession`, and `onDrainSession` in `project.component.ts` (lines 909–923) subscribe with `{ next: () => this.loadSessions() }` only — there is no `error` handler. If any action call fails (network error, 404 because the session was stopped by another client, 409 conflict), the button click appears to do nothing. The user has no indication the action failed and cannot retry with awareness. The `sessionsLoading` signal is also never set to `false` after a failed `loadSessions()` — wait, actually `loadSessions()` does handle `error` properly. But the action calls themselves silently swallow failures.

### 2. What user action causes unexpected behavior?

A user who clicks Stop on a session that was already stopped by another browser tab gets a 404 from the backend. The frontend's subscribe `error` is undefined so the Observable error propagates as an uncaught exception in the Angular error handler. The session list does not refresh. The stopped session remains visible until the 15s timer fires. The user is left wondering if stop worked.

### 3. What data makes this produce wrong results?

Any caller using the pre-existing `getSessions()` method (line 168) expects `SessionSummary[]` back from `GET /api/sessions`. But the new backend returns `{ sessions: SessionStatusResponse[] }`. If any component still calls `getSessions()`, it will silently get an object, not an array, and Angular's template will render nothing or throw. The same collision exists for `getSession(id)` (line 176) which expects `SessionData` while `getAutoSession(id)` (line 393) now correctly expects `SessionStatusResponse` from the same URL — the old method is still present and callers who accidentally use `getSession()` get the wrong type.

### 4. What happens when dependencies fail?

- If the WebSocket disconnects and the 15s interval fires, `loadSessions()` is called but `getAutoSessions()` calls `listAutoSessions()` which does a GET. If the backend is down, `sessionsLoading` is set back to `false` with no user-visible error — the session panel shows a stale list with no indication it is stale.
- The `loadSavedConfig()` method successfully guards against localStorage `SecurityError` and JSON parse errors. That path is safe.
- `saveConfig()` catch block is a no-op. The only consequence is the next session launch uses the previous config. Acceptable and documented.

### 5. What's missing that the requirements didn't mention?

- No inline config update (PATCH) flow from the session panel. The task requires "Config can be updated mid-flight via PATCH" and `updateAutoSessionConfig` exists in the service, but there is no UI in `sessions-panel.component.html` or anywhere else that invokes it. This acceptance criterion is NOT met.
- No `editConfig` `@Output` on `SessionsPanelComponent`. Even if a parent wanted to wire PATCH editing, there is no event or callback surface.
- No optimistic update or loading state on action buttons. A user can click Pause, then immediately click Stop before the API responds. Two in-flight requests with inconsistent outcomes.

---

## Failure Mode Analysis

### Failure Mode 1: Dual `GET /api/sessions` with incompatible return types

- **Trigger**: Any component that calls `getSessions()` (line 168) after this migration, or any component that calls `getSession(id)` (line 176) for a live session.
- **Symptoms**: Component receives `{ sessions: [...] }` object when it expects `SessionSummary[]`. Template renders nothing or explodes. TypeScript compiler cannot catch this because both methods are typed to different interfaces that happen to target the same URL.
- **Impact**: Silent data breakage. Any component still relying on the old `getSessions()` will silently show empty or broken data.
- **Current Handling**: Not handled. The old methods were not removed — they coexist with the new ones.
- **Recommendation**: Remove or deprecate `getSessions()` (line 168) and `getSession(id)` (line 176) if they are no longer used, or rename the old ones to make it unambiguous which API contract they serve. Audit all callers first.

### Failure Mode 2: `drainSession` uses PATCH but old invocations may expect correct verb semantics

- **Trigger**: Any client that calls `drainSession(sessionId)`.
- **Symptoms**: The backend controller at `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` line 188 defines drain as `@Patch(':id/stop')`. The frontend `drainSession` at api.service.ts line 431 uses `this.http.patch(...)` — this matches. However, `stopAutoSession` at line 413 uses `POST /api/sessions/:id/stop` which is the hard stop. So the verb distinction is correct. This is NOT a bug, but it is a trap: the method is named `drainSession` but targets `:id/stop` with PATCH, while `stopAutoSession` also targets `:id/stop` with POST. Two different verbs on the same path segment. A developer reading the code who calls `drainSession` expecting a stop will get a drain. The naming is misleading enough to cause future caller confusion.
- **Impact**: Moderate. No current breakage, but high chance of future misuse.
- **Current Handling**: Accidentally correct.
- **Recommendation**: Rename or add a JSDoc comment clarifying the PATCH vs POST distinction on `:id/stop`.

### Failure Mode 3: Per-session action calls have no error handler

- **Trigger**: Network failure, 404 (session already stopped), 409 (conflict — session already paused) during `onPauseSession`, `onResumeSession`, `onStopSession`, `onDrainSession`.
- **Symptoms**: Error is swallowed. Button appears to do nothing. `loadSessions()` is never called so the UI does not refresh. User retries. Duplicate API calls.
- **Impact**: Serious. User-visible broken behavior on any transient failure or race condition.
- **Current Handling**: `subscribe({ next: () => this.loadSessions() })` — no `error` callback.
- **Recommendation**: Add `error: () => { /* show error signal */ this.loadSessions(); }` to each action subscribe, analogous to `onCreateSession` which does handle the error properly.

### Failure Mode 4: PATCH config mid-flight has no UI surface

- **Trigger**: User wants to change concurrency or priority on a running session.
- **Symptoms**: There is no button, form, or modal in `sessions-panel.component.html` or `project.component.html` that invokes `updateAutoSessionConfig`. The `updateAutoSessionConfig` method exists and is correctly wired, but is dead code from a UI perspective.
- **Impact**: Acceptance criterion "Config can be updated mid-flight via PATCH" is not met.
- **Current Handling**: Not implemented in the UI layer.
- **Recommendation**: Either add a config edit button/modal to `SessionsPanelComponent` (with a new `editConfig` `@Output`), or acknowledge this as deferred and remove it from acceptance criteria.

### Failure Mode 5: `loadSavedConfig` parses localStorage without field-level validation

- **Trigger**: A previously saved config from an older version of the app has fields that no longer match `CreateSessionRequest` (e.g., an old `provider` field instead of `implementProvider`).
- **Symptoms**: The malformed config object is cast to `CreateSessionRequest` without validation at line 951: `(typeof parsed === 'object' && parsed !== null) ? parsed as CreateSessionRequest : {}`. If the saved config has a field like `provider: 'claude'` instead of `implementProvider`, the backend will silently ignore the unknown field or throw a validation error, and the form will appear pre-filled but send a broken payload.
- **Impact**: Moderate. Only affects users who had a session config saved before the migration.
- **Current Handling**: Object shape is not validated, only `typeof` checked.
- **Recommendation**: Validate known fields before casting or reset to `{}` if any unrecognized keys are present.

---

## Critical Issues

### Issue 1: Old `getSessions()` and `getSession(id)` coexist with new methods on same URLs

- **File**: `apps/dashboard/src/app/services/api.service.ts:168–179`
- **Scenario**: Any component (existing or future) that calls `getSessions()` or `getSession(id)` gets wrong data silently. The backend now returns `ListSessionsResponse` (an object with a `sessions` array) from `GET /api/sessions`, not a `SessionSummary[]` array. The TypeScript types describe different shapes for the same endpoint.
- **Impact**: Silent wrong-type data at runtime. Components that still use the old methods will render nothing or crash.
- **Evidence**:
  ```ts
  // line 168 — old, returns SessionSummary[] from GET /api/sessions
  public getSessions(): Observable<SessionSummary[]> {
    return this.http.get<SessionSummary[]>(`${this.base}/sessions`);
  }
  // line 389 — new, returns ListSessionsResponse from GET /api/sessions (same URL!)
  public listAutoSessions(): Observable<ListSessionsResponse> {
    return this.http.get<ListSessionsResponse>(`${this.base}/sessions`);
  }
  ```
- **Fix**: Audit all callers of `getSessions()` and `getSession(id)`. Remove or mark as removed the old methods. If any component still uses them, migrate it.

---

## Serious Issues

### Issue 2: Per-session action handlers swallow errors silently

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:909–923`
- **Scenario**: Network timeout, 404 for a session stopped by another tab, or backend 409 conflict on an already-paused session.
- **Impact**: Button click produces no feedback. User retries, creating duplicate requests. Session list never refreshes after an action failure.
- **Evidence**:
  ```ts
  public onPauseSession(id: string): void {
    this.apiService.pauseAutoSession(id).subscribe({ next: () => this.loadSessions() });
    // no error handler
  }
  ```
- **Fix**: Add `error` callbacks analogous to `onCreateSession`.

### Issue 3: PATCH config update has no UI surface — acceptance criterion not met

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html` and `sessions-panel.component.ts`
- **Scenario**: User wants to change concurrency on a running session.
- **Impact**: AC "Config can be updated mid-flight via PATCH" is unmet. `updateAutoSessionConfig` is dead code from a UX perspective.
- **Fix**: Add a config edit control to the session card, or explicitly mark this AC as deferred with a follow-up task.

---

## Moderate Issues

### Issue 4: `loadSavedConfig` does no field-level validation

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:946–954`
- **Scenario**: User had a session config saved before migration. Old keys like `provider` or `model` instead of `implementProvider`/`implementModel` survive in localStorage.
- **Impact**: Form pre-fills from stale data; API call may succeed but with missing/wrong fields.
- **Fix**: Validate that only known `CreateSessionRequest` keys are present, or compare against the current interface shape.

### Issue 5: Double-read of same signal in `sessions-panel.component.ts` computed properties

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:49–87`
- **Scenario**: `heartbeatStatusMap` and `startedAtLabels` both iterate `this.sessions` in separate computed calls. `this.sessions` is a plain `@Input()` array, not a signal, so neither computed actually tracks it reactively. When `sessions` changes (via parent signal push), Angular's change detection with `OnPush` will re-render because the `@Input` reference changes — but the computed signals themselves are not invalidated because they depend on `this.sessions` (a plain property) not on a signal accessor.
- **Impact**: The heartbeat labels and start-time labels may be stale until the `now` signal (30s interval) forces recomputation of `heartbeatStatusMap`. `startedAtLabels` has no time dependency and will not recompute at all after initial render if the sessions array reference is the same object.
- **Fix**: Convert `@Input() sessions` to a signal input (`input<SessionStatusResponse[]>([])`) so computed properties properly track it, or derive the labels inside the template instead of a computed map.

---

## Data Flow Analysis

```
User opens /project
  -> ProjectComponent.ngOnInit() -> loadSessions()
  -> ApiService.getAutoSessions()
  -> ApiService.listAutoSessions()  [GET /api/sessions]
  -> Backend: AutoPilotController.listSessions()
  -> Returns ListSessionsResponse { sessions: SessionStatusResponse[] }
  -> pipe(map(r => [...r.sessions]))   [unwraps correctly]
  -> activeSessions.set(sessions)
  -> <app-sessions-panel [sessions]="activeSessions()">

Gap 1: getSessions() (line 168) also hits GET /api/sessions but expects SessionSummary[] 
        — any leftover caller gets wrong type silently.

User clicks Pause:
  -> sessions-panel emits pauseSession EventEmitter
  -> project.component.ts onPauseSession(id)
  -> ApiService.pauseAutoSession(id)  [POST /api/sessions/:id/pause]
  -> Backend returns SessionActionResponse
  -> subscribe({ next: () => loadSessions() })

Gap 2: No error callback — failure is swallowed.
Gap 3: No optimistic update — UI freezes until loadSessions() responds.

User clicks Drain:
  -> onDrainSession(id)
  -> ApiService.drainSession(id)  [PATCH /api/sessions/:id/stop]  <- correct verb
  -> Backend: AutoPilotController.drainSession()

Session-Detail view:
  -> SessionDetailComponent.confirmDrain()
  -> ApiService.drainSession(sessionId)  [PATCH /api/sessions/:id/stop]
  -> After drain: isDraining remains true forever — no .next() handler, 
     only catchError. The isDraining signal is never set back to false on success.
     (sessions-detail uses takeUntilDestroyed but no next() callback)

Gap 4: session-detail confirmDrain() never sets isDraining(false) on success.
```

### Gap Points Identified:
1. `getSessions()` / `getSession()` type collision with same URLs as new methods.
2. Action error callbacks missing in project.component.ts.
3. `isDraining` signal in session-detail never reset to `false` on successful drain.
4. No UI surface for `updateAutoSessionConfig`.

---

## Acceptance Criteria Check

| Requirement | Status | Concern |
|---|---|---|
| All old `/api/auto-pilot/*` calls replaced | COMPLETE | No auto-pilot calls remain in changed files |
| Users can create sessions with config | COMPLETE | Create flow works with proper error signal |
| Session list shows all active sessions | COMPLETE | listAutoSessions + WebSocket + 15s interval |
| Per-session controls: pause, resume, stop | PARTIAL | Wired correctly but no error handling on actions |
| Config can be updated mid-flight via PATCH | MISSING | Service method exists, zero UI surface |
| TypeScript compiles clean | LIKELY | Known pre-existing TS2769 on task-detail; new code should be clean; old methods with conflicting return types could cause issues downstream |

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Empty session list | YES | Empty state in sessions-panel.html | OK |
| Session stopped by another client | NO | No 404 handling on action calls | Serious |
| LocalStorage unavailable (private browsing) | YES | try/catch in saveConfig/loadSavedConfig | OK |
| Malformed localStorage data | PARTIAL | JSON.parse errors caught, but no field validation | Moderate |
| Session ID with special characters in URL | YES | encodeURIComponent on all IDs | OK |
| Heartbeat timestamp NaN | YES | NaN check in heartbeatStatusMap | OK |
| Rapid double-click on action buttons | NO | No in-flight guard or debounce | Moderate |
| Component destroyed during loadSessions() subscribe | PARTIAL | takeUntilDestroyed on WebSocket/interval but not on explicit loadSessions() subscribes | Moderate |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| GET /api/sessions (getSessions vs listAutoSessions) | HIGH | Wrong data silently | Remove old method or audit callers |
| POST /api/sessions/:id/pause (no error handler) | MEDIUM | Silent failure UX | Add error callback |
| PATCH /api/sessions/:id/config (no UI) | N/A | AC unmet | Add UI or defer task |
| WebSocket session events | LOW | Falls back to 15s interval | Acceptable |
| localStorage config persistence | LOW | Stale keys silently sent | Field validation |

---

## Verdict

**Recommendation**: NEEDS_FIXES

**Confidence**: HIGH

**Top Risk**: The `getSessions()` / `getSession(id)` type collision on the same URLs as the new methods is the most dangerous issue. It is a silent runtime data corruption waiting for any component that still uses the old methods. It cannot be caught by the TypeScript compiler because the two methods are separately typed. All callers must be audited and the stale methods removed before this can ship.

The missing `updateAutoSessionConfig` UI is an unmet acceptance criterion and should either be implemented or explicitly deferred with a follow-up task before marking TASK_2026_210 complete.

## What Robust Implementation Would Include

- The old `getSessions()` (line 168) and `getSession(id)` (line 176) methods removed or explicitly renamed to `getLegacySessions()` with a deprecation note, after all callers are migrated.
- `error` callbacks on all four session action handlers in `project.component.ts`, matching the pattern already used by `onCreateSession`.
- `isDraining.set(false)` in `session-detail.confirmDrain()`'s `.subscribe({ next: () => { this.isDraining.set(false); } })`.
- Either a config edit button per session card (with a `configChange` `@Output`), or a note in the handoff that AC 5 is deferred.
- `@Input` sessions converted to Angular signal input on `SessionsPanelComponent` to ensure computed maps (`heartbeatStatusMap`, `startedAtLabels`) invalidate correctly when the parent signal changes.
- Field-level validation in `loadSavedConfig` to reject stale localStorage keys from pre-migration versions.
