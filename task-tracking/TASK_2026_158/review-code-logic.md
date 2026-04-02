# Code Logic Review — TASK_2026_158

## Review Summary

| Metric              | Value                                           |
|---------------------|-------------------------------------------------|
| Overall Score       | 5/10                                            |
| Assessment          | NEEDS_REVISION                                  |
| Critical Issues     | 3                                               |
| Serious Issues      | 5                                               |
| Moderate Issues     | 4                                               |
| Failure Modes Found | 9                                               |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `getCortexSessions()` error handler is a bare `/* best-effort — silently ignore */` with no
  logging. The heartbeat status map depends on this data; if the call fails, every "running"
  session shows "No heartbeat / heartbeat-stale" with no indication that the data source itself is
  unavailable. The user reads the red badge as a real problem.
- `loadSessions()` calls `getActiveSessionsEnhanced()`. When the response is an empty array
  (`data.length === 0`), the component silently falls back to mock data. This means a healthy but
  idle backend (zero real sessions) always shows the same three fabricated sessions, giving
  operators the false impression the system is busy. The fallback condition is also applied to what
  should be the normal "no active sessions" state.
- The close-stale-session background interval (`catchError(() => EMPTY)`) fires every five minutes
  and discards all errors without logging. A `503` from the backend (Cortex DB unavailable) is
  indistinguishable from success.
- `getActiveSessionsEnhanced()` on the backend uses `Math.random()` to pick `currentPhase` on
  every HTTP call. Two rapid back-to-back calls for the same session produce different phases. The
  frontend has no way to detect this — it simply renders whatever the last call returned.

### 2. What user action causes unexpected behavior?

- **Clicking a session card while the backend is unavailable** — `onSessionClick` calls
  `router.navigate(['/session', session.sessionId])` unconditionally. It navigates regardless of
  whether the session data came from mock fallback or real API. The session viewer (TASK_2026_157)
  then issues `GET /api/sessions/:id` with a fabricated SESSION ID (e.g., `SESSION_2026-03-30_12-00-00`)
  that does not exist in any real data store. The user sees a 404 error in the viewer with no
  explanation.
- **Opening the panel immediately after page load** — `loadSessions()` fires two HTTP calls in
  parallel: `getActiveSessionsEnhanced()` and `getCortexSessions()`. The component sets
  `loading.set(false)` when the first call resolves, but the cortex call may still be in flight.
  The heartbeat map is computed before cortex data is available, so the first render always shows
  stale heartbeat state for a brief window (could be several seconds on a slow connection).
- **WebSocket reconnection flood** — Every `sessions:changed` or `session:update` event fires a
  fresh `loadSessions()`, which issues two concurrent HTTP calls. If the WebSocket reconnects after
  a brief outage and replays buffered events, the panel fires N pairs of HTTP calls simultaneously.
  The anti-pattern rule about debouncing event-driven refreshes applies directly here and the
  handoff notes it as a known risk but does not fix it.

### 3. What data makes this produce wrong results?

- **`session.startedAt` is an empty string** — `sessions-panel.component.html` line 37 calls
  `session.startedAt.slice(11, 16)` directly in the template. This is a method call on a template
  expression (violates Angular anti-pattern rule: "String.prototype.slice() in templates is a
  method call"). Worse, if `startedAt` is `''` (which `SessionsService.setSessionLog()` sets when
  creating a stub summary), `slice(11, 16)` returns `''` silently — no display, no error.
- **`session.started` is an invalid date string** — `new Date('').getTime()` returns `NaN`.
  `SessionsService.formatDuration()` receives `NaN` milliseconds and returns `NaN` in the formatted
  string (e.g., `"NaNh NaNm"`). This propagates to the panel without any guard.
- **`taskId` extraction in `getActiveSessionsEnhanced()`** — the backend derives task ID by slicing
  fixed character positions out of the session ID string:
  `\`TASK_${session.sessionId.slice(8, 12)}_${session.sessionId.slice(13, 16)}\``.
  For a session ID like `SESSION_2026-03-30_12-00-00`, `slice(8, 12)` = `2026` and
  `slice(13, 16)` = `03-` (includes the dash). The generated value `TASK_2026_03-` is not a valid
  task ID. Since there is no real association between session and task, every displayed task ID is
  wrong.
- **`lastHeartbeat` is optional on `ActiveSessionSummary`** — the backend
  `getActiveSessionsEnhanced()` return type does not include `lastHeartbeat`. The frontend model
  declares it `readonly lastHeartbeat?: string | null`. The backend never populates this field.
  Every card therefore falls through to `cortexHbMap.get(session.sessionId)`, which will also be
  absent unless the session IDs happen to match between the two data sources. Heartbeat display is
  permanently absent for all sessions returned by the enhanced endpoint.

### 4. What happens when dependencies fail?

| Integration | Failure Mode | Current Handling | Assessment |
|---|---|---|---|
| `GET /api/sessions/active/enhanced` | 5xx / network down | Falls back to mock data silently | CONCERN: Mock hides the failure |
| `GET /api/cortex/sessions` | 503 (Cortex DB unavailable) | Silent ignore, no log | CONCERN: Heartbeat map shows stale data |
| WebSocket disconnect | Events stop arriving | `takeUntilDestroyed` cleans up but no reconnect handling | MODERATE: Panel goes stale indefinitely |
| `POST /api/sessions/close-stale` | 503 / network error | `catchError(() => EMPTY)` | CONCERN: No log, no feedback |
| `GET /api/sessions/:id` (in viewer) | 404 for mock session IDs | Handled in TASK_2026_157 | OUT OF SCOPE but triggered by this task |
| Backend random phase/status | Phase changes on every reload | Not handled | CONCERN: Rapid flicker on WebSocket events |

### 5. What's missing that the requirements didn't mention?

- **Session ID input validation on `GET /api/sessions/:id`** — the endpoint accepts any string.
  No format check is applied (unlike `/api/tasks/:id` which validates `TASK_ID_RE`). A path like
  `../../../etc/passwd` would be forwarded to `sessionsHistoryService.getSessionDetail()`. The
  downstream behavior depends on that service's implementation, but the controller adds no
  guard.
- **Duration is computed once and not updated** — `duration` is a static string baked in at fetch
  time. The panel refreshes on WebSocket events, but between events a running session's displayed
  duration is frozen. The `now` signal updates every 30 seconds for the heartbeat label, but
  duration does not recalculate from `startedAt` — it stays stale until the next `loadSessions()`
  call.
- **Loading state is visible for zero time** — `loading` is set `true` in field initializer but
  the template never renders a loading state (`@if (sessions().length === 0 && recentSessions().length === 0)` renders
  "No active sessions", not a spinner). The `sessions-loading` CSS class exists but is never
  applied to any element. The requirement of showing "status indicator" is partially met but the
  loading/fetching state is invisible to the user.
- **Scroll position preservation is explicitly not implemented** — the task requires "switching
  sessions preserves scroll position of previous session." The handoff documents this as a known
  gap. This is a stated acceptance criterion that is not met.

---

## Failure Mode Analysis

### Failure Mode 1: Mock data permanently masks empty backend

- **Trigger**: Backend is running with zero active sessions (legitimate state after all sessions
  complete).
- **Symptoms**: Panel always shows two "running" fabricated sessions. Operator believes work is in
  progress when it is not.
- **Impact**: Operators cannot distinguish "nothing running" from "backend is down" from "real
  sessions I should monitor."
- **Current Handling**: `if (data.length > 0)` gates real data; `else` unconditionally loads mock.
- **Recommendation**: Remove the `data.length > 0` guard. Set `sessions` and `recentSessions`
  directly from the response even when empty. Reserve mock fallback for the error path only, with a
  visible "using demo data" banner.

### Failure Mode 2: Backend `getActiveSessionsEnhanced()` produces non-deterministic phase on every call

- **Trigger**: Every HTTP GET to `/api/sessions/active/enhanced`.
- **Symptoms**: Phase badge flickers on every WebSocket event. A session appears to jump from "PM"
  to "QA" to "Dev" with no actual workflow change. The random call is `Math.random()` inside
  `getActiveSessionsEnhanced()` on lines 162–163 of `sessions.service.ts`.
- **Impact**: Users cannot trust the phase indicator. Logging systems that track phase transitions
  generate phantom events.
- **Current Handling**: None. The handoff acknowledges it as "randomized backend data" but does not
  fix it.
- **Recommendation**: Derive phase from real session state (e.g., `loopStatus` or active worker
  role from Cortex). If unavailable, return `null` / `"Unknown"` rather than random.

### Failure Mode 3: Fabricated session IDs break the session viewer

- **Trigger**: User clicks any session card sourced from mock data.
- **Symptoms**: `router.navigate(['/session', 'SESSION_2026-03-30_12-00-00'])`. The session viewer
  calls `GET /api/sessions/SESSION_2026-03-30_12-00-00`, which returns 404. User sees an error
  screen.
- **Impact**: The core acceptance criterion "clicking a session navigates to the session viewer"
  technically works — navigation happens — but the destination renders an error state for all mock
  sessions.
- **Current Handling**: None. No guard before navigation, no disabled state on mock cards.
- **Recommendation**: Either disable click on mock session cards and display a tooltip ("demo data
  — no real session"), or ensure mock session IDs exist in the backend session store before allowing
  navigation.

### Failure Mode 4: Heartbeat map always blank for sessions from enhanced endpoint

- **Trigger**: Normal operation — all sessions loaded from `getActiveSessionsEnhanced()`.
- **Symptoms**: `@if (heartbeatStatusMap().get(session.sessionId); as hbStatus)` — the block
  renders only if the map has an entry. Since `lastHeartbeat` is never populated by the backend and
  cortex session IDs rarely match enhanced session IDs, the map is always empty. No heartbeat
  indicator is shown for any session.
- **Impact**: The heartbeat feature (a stated deliverable) is silently non-functional.
- **Current Handling**: Optional chain fallback exists in code but the data never arrives.
- **Recommendation**: Either populate `lastHeartbeat` from the backend enhanced endpoint or remove
  the feature from this task's scope and document it as a follow-up.

### Failure Mode 5: `startedAt.slice(11, 16)` in template — method call per change detection cycle

- **Trigger**: Any change detection cycle while the panel is visible.
- **Symptoms**: `session.startedAt.slice(11, 16)` fires on every CD cycle for every active session
  card. Violates the established review lesson: "String.prototype.slice() in templates is a method
  call — move to computed()." Silent performance degradation; worsens linearly with session count.
- **Impact**: Unnecessary computation; violates project convention.
- **Current Handling**: None.
- **Recommendation**: Add a `startTimeMap = computed(...)` alongside `truncatedActivities` that
  pre-slices the display time for each session.

### Failure Mode 6: `statusSelectedCount()`, `typeSelectedCount()`, `prioritySelectedCount()` are method calls exposed to the template

- **Trigger**: Every change detection cycle in `project.component.html`.
- **Symptoms**: These methods on `ProjectComponent` are called directly from the template (lines
  179, 219, 261). Each reads `signal()` internally — equivalent to a `get` accessor on a signal.
  Per the review lesson: "`get` accessors that read signals are equivalent to method calls in
  templates — use `computed()`." This is pre-existing (from TASK_2026_155) but surfaces because
  this task modifies and is responsible for the project component.
- **Impact**: Moderate performance cost; violates project conventions.
- **Recommendation**: Convert to `readonly` `computed()` signals.

### Failure Mode 7: `applyFiltersAndSort()` is a public method called from `filteredTasks = computed()`

- **Trigger**: Every `computed()` re-evaluation.
- **Symptoms**: Per the review lesson: "Template expressions must not call methods — use
  `computed()` signals." `applyFiltersAndSort` is a non-`computed` method called inside
  `filteredTasks`. The method itself is not reactive — it reads signals correctly — but exposing it
  as `public` allows external callers to invoke it with stale state. Also, `console.warn` inside a
  hot path (`applyFiltersAndSort`) leaks a developer diagnostic to production.
- **Impact**: Low — `filteredTasks` wraps it in `computed()`, so reactivity is correct. The concern
  is the `console.warn` and the public surface.
- **Recommendation**: Make `applyFiltersAndSort` private; remove the `console.warn`.

### Failure Mode 8: Close-stale-session background call swallows all errors silently

- **Trigger**: `POST /api/sessions/close-stale` fails with any error (503, network timeout).
- **Symptoms**: `catchError(() => EMPTY)` discards the error. No log entry is created. Stale
  sessions accumulate if the endpoint is broken.
- **Current Handling**: Anti-pattern rule is explicit: "NEVER swallow errors in fire-and-forget
  calls. At minimum, log them."
- **Recommendation**: Add `catchError((err) => { console.warn('[SessionsPanel] close-stale failed:', err); return EMPTY; })`.

### Failure Mode 9: Session ID not validated in `GET /api/sessions/:id`

- **Trigger**: Crafted request with `/../` or other special characters in the session ID path.
- **Symptoms**: String forwarded to `sessionsHistoryService.getSessionDetail(id)` without
  sanitization. Downstream behavior depends on that service's path handling.
- **Current Handling**: All other parameterized endpoints in the controller either validate with
  `TASK_ID_RE` or check Cortex availability first. The sessions endpoint has no format guard.
- **Recommendation**: Add a format validation regex (e.g., `/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/`) 
  mirroring the pattern already used in `SessionsService.extractSessionId()`.

---

## Critical Issues

### Issue 1: Mock fallback overwrites empty-but-valid backend response

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:127`
- **Scenario**: Backend returns `[]` because all sessions are complete.
- **Impact**: Operators are always shown fake sessions; no way to see a genuinely empty state.
- **Evidence**:
  ```typescript
  if (data.length > 0) {
    // real data
  } else {
    this.loadMockData(); // also fires when backend legitimately returns []
  }
  ```
- **Fix**: Only call `loadMockData()` in the `error` callback. Set `sessions([])` and
  `recentSessions([])` from the empty response in `next`.

### Issue 2: Backend `GET /api/sessions/:id` has no input validation

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:229`
- **Scenario**: Any string, including path-traversal sequences, is forwarded directly to the
  history service.
- **Impact**: Potential path traversal depending on downstream file system access. Inconsistency
  with the rest of the controller's defensive posture.
- **Evidence**:
  ```typescript
  @Get('sessions/:id')
  public async getSession(@Param('id') id: string) {
    const result = await this.sessionsHistoryService.getSessionDetail(id);
    // no format check on id
  ```
- **Fix**: Add `if (!/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(id)) throw new BadRequestException(...)`.

### Issue 3: Acceptance criterion "scroll position preservation" is not implemented

- **File**: `task-tracking/TASK_2026_158/handoff.md` (Known Risks)
- **Scenario**: User opens a session, returns to project page, opens a different session. Prior
  session scroll position is lost.
- **Impact**: Stated acceptance criterion ("switching sessions preserves scroll position") is
  explicitly not met.
- **Evidence**: Handoff states: "No scroll position preservation: Navigating to session viewer
  destroys project component. Would need router state service." This was not marked as descoped —
  it remains in the acceptance criteria.
- **Fix**: Implement scroll preservation via Angular `RouteReuseStrategy` or a lightweight
  `ScrollStateService` that saves and restores `window.scrollY` on navigation.

---

## Serious Issues

### Issue 4: `startedAt.slice(11, 16)` is a method call in the template

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html:37`
- **Scenario**: Normal rendering of any active session card.
- **Impact**: Fires on every change detection cycle; violates documented project rule from
  TASK_2026_203.
- **Fix**: Add `startTimeMap = computed(...)` alongside `truncatedActivities`.

### Issue 5: `catchError(() => EMPTY)` on close-stale call produces no log

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:64`
- **Scenario**: Stale-session close endpoint unavailable or returns error.
- **Impact**: Violates the project anti-pattern: "NEVER swallow errors in fire-and-forget calls."
- **Fix**: Log before returning EMPTY.

### Issue 6: `getCortexSessions()` error handler is a bare comment with no logging

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:147`
- **Scenario**: Cortex DB unavailable (503) or network failure on the cortex sessions call.
- **Impact**: Heartbeat map silently shows stale/absent data; operator has no indication cortex is
  down. Same anti-pattern violation as Issue 5.
- **Fix**: Add `console.warn('[SessionsPanel] getCortexSessions failed:', err)`.

### Issue 7: `getActiveSessionsEnhanced()` uses `Math.random()` for phase and status

- **File**: `apps/dashboard-api/src/dashboard/sessions.service.ts:162–163`
- **Scenario**: Every HTTP call to the enhanced endpoint.
- **Impact**: Phase and status badges flicker on every WebSocket event. Stated acceptance criterion
  "each session shows task ID, phase, duration, last activity, status" cannot be trusted.
- **Fix**: Map `loopStatus` ('RUNNING', 'PAUSED', 'STOPPED', etc.) to the frontend status enum
  deterministically. Remove phase randomization until real phase data is available; return `null`
  or `"Unknown"` instead.

### Issue 8: Fabricated task IDs produced by character slicing

- **File**: `apps/dashboard-api/src/dashboard/sessions.service.ts:159`
- **Scenario**: Every call to the enhanced endpoint.
- **Impact**: Task IDs like `TASK_2026_03-` (with trailing dash) are displayed to users and
  forwarded to the session viewer component.
- **Evidence**: `session.sessionId.slice(13, 16)` from `SESSION_2026-03-30_12-00-00` = `"03-"`.
- **Fix**: Either derive from a real task-to-session join (via Cortex), or return `null`/`"Unknown"`
  and display it gracefully.

---

## Moderate Issues

### Issue 9: `loading` signal is initialized but never rendered

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html`
- **Scenario**: Initial page load while HTTP calls are in flight.
- **Impact**: Users see "No active sessions" briefly before data arrives. No spinner/skeleton.
  The `.sessions-loading` CSS class exists but is unreachable.
- **Fix**: Add `@if (loading()) { <div class="sessions-loading">Loading…</div> }` before the
  empty-state block.

### Issue 10: WebSocket events trigger un-debounced dual HTTP calls

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:190`
- **Scenario**: High-frequency WebSocket events (file watcher, cortex polling at 3-second interval).
- **Impact**: N events = 2N HTTP calls. Under normal operation the gateway fires `sessions:changed`
  on every file-watcher event, which can be dozens per second during an active build.
- **Fix**: Add `debounceTime(500)` in `subscribeToSessionUpdates()` before calling `loadSessions()`.

### Issue 11: Hardcoded `rgba(23, 125, 220, 0.1)` in SCSS

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.scss:59`
- **Impact**: Violates project rule: "Never use hardcoded hex/rgba colors — use CSS variable tokens."
  The value `rgba(23, 125, 220, 0.1)` is a literal encoding of `--accent` with reduced opacity.
- **Fix**: Use a CSS custom property, e.g., `box-shadow: 0 2px 8px var(--accent-shadow, rgba(23, 125, 220, 0.1))`.
  Better: define `--accent-shadow` in the theme file and reference it here.

### Issue 12: `heartbeatStatusMap` iterates both `sessions()` and `recentSessions()` but `continue`s for non-running sessions

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:79–103`
- **Scenario**: Normal operation with a `recentSessions` array populated by non-running entries.
- **Impact**: `recentSessions` contains only non-running sessions by construction (split on line
  129). Spreading them into `allSessions` then immediately `continue`-ing at `status !== 'running'`
  wastes allocation on every `now` signal tick. This pattern is called out explicitly in the review
  lessons from TASK_2026_203.
- **Fix**: Iterate only `sessions()` (the running set) in `heartbeatStatusMap`.

---

## Data Flow Analysis

```
User opens project page
  → SessionsPanelComponent constructor fires
  → loadSessions() called
    → getActiveSessionsEnhanced() (HTTP)        ← [A] empty array → mock fallback (ISSUE 1)
    → getCortexSessions() (HTTP, parallel)       ← [B] error → silent swallow (ISSUE 6)
  → subscribeToSessionUpdates() called
    → WebSocket events$ filtered for sessions:changed / session:update
      → loadSessions() on each event            ← [C] no debounce (ISSUE 10)
  → interval(30s) → now.set(Date.now())
  → interval(5min) → closeStaleSession()        ← [D] error → silent swallow (ISSUE 5)

  ┌ getActiveSessionsEnhanced() response ─────────────────────────────────────────┐
  │  phase  = Math.random() pick                        ← [E] non-deterministic (ISSUE 7)  │
  │  taskId = session.sessionId.slice(8,12)_slice(13,16) ← [F] wrong format (ISSUE 8)     │
  │  lastHeartbeat = ABSENT                              ← heartbeat feature broken         │
  └───────────────────────────────────────────────────────────────────────────────┘

  ┌ Template rendering ────────────────────────────────────────────────────────────┐
  │  session.startedAt.slice(11, 16)                    ← [G] method call (ISSUE 4)       │
  │  heartbeatStatusMap().get(id)                       ← always empty (ISSUE 4 related)  │
  │  truncatedActivities().get(id)                      ← correct (computed)              │
  └───────────────────────────────────────────────────────────────────────────────┘

User clicks session card
  → router.navigate(['/session', session.sessionId])    ← no guard for mock IDs (ISSUE 3)
  → Session viewer issues GET /api/sessions/:id
    → controller: no ID format validation               ← [H] path traversal risk (ISSUE 2)
    → sessionsHistoryService.getSessionDetail(id)
    → 404 for any mock session ID
```

### Gap Points Identified

1. `lastHeartbeat` never populated by `getActiveSessionsEnhanced()` — heartbeat feature is dead on arrival.
2. Mock data returned in the happy path (empty real sessions) creates a persistent lie in the UI.
3. Session ID slicing produces syntactically invalid task IDs — downstream consumers silently receive garbage.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Active sessions panel — session ID, task ID+title, start time, duration, phase, last activity, status indicator | PARTIAL | Task IDs are malformed; phase is random; duration never updates live; start time is a template method call |
| Session switching — click to open session viewer | PARTIAL | Navigation works; viewer receives invalid/mock session IDs and renders 404 |
| GET /api/sessions/active | COMPLETE | Returns real sessions from the in-memory store |
| GET /api/sessions/:id | PARTIAL | Functional for real session IDs; no input validation; stub messages only |
| WebSocket session:update | PARTIAL | `sessions:changed` broadcast works; `session:update` event type matches but is only broadcast from watcher (not from cortex polling) |
| Real-time updates via WebSocket | PARTIAL | Works but no debounce — high event frequency floods HTTP |
| Integration with project page layout | COMPLETE | Panel embedded in sidebar, correctly imports component |
| Scroll position preservation | MISSING | Explicitly not implemented; documented as known gap |

### Implicit Requirements Not Addressed

1. Empty state when the system is genuinely idle (no mock fallback for legitimate zero-session state).
2. Loading/skeleton state during initial HTTP fetch.
3. User feedback when backend data is unavailable (currently silent fallback to demo data).
4. Duration field must update in real time (not only on reload).

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| `startedAt` is empty string | NO | `slice(11, 16)` returns `''` silently | Silent blank display |
| `started` is invalid date | NO | `formatDuration()` returns `NaN` string | NaN visible to user |
| Zero active sessions (valid) | NO | Falls back to mock data | Misleads operator |
| WebSocket burst events | NO | No debounce on `loadSessions()` | HTTP flood |
| Mock session IDs navigated | NO | Viewer receives 404 | Broken UX flow |
| Session ID with path traversal | NO | No validation on controller param | Security gap |
| Cortex DB unavailable | PARTIAL | Silent ignore on frontend | No observability |
| `lastHeartbeat` absent from API | NO | Heartbeat map empty forever | Feature non-functional |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| `GET /sessions/active/enhanced` → empty array | HIGH (normal state) | Mock data shown permanently | NONE — fix the fallback condition |
| WebSocket `sessions:changed` burst | MED (active build) | HTTP call flood | NONE — add debounce |
| `GET /cortex/sessions` failure | MED (Cortex DB optional) | Heartbeat silently absent | NONE — add log |
| `GET /sessions/:id` with mock ID | HIGH (mock fallback active) | Viewer 404 | NONE |
| `POST /sessions/close-stale` failure | LOW–MED | Stale sessions accumulate silently | NONE — add log |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The empty-array fallback to mock data is the most dangerous issue. It makes the panel non-functional as a monitoring tool: in the most common state (idle system), the panel shows false data. All session click interactions on that false data lead to 404 errors in the viewer. The component cannot fulfil its stated purpose until this is corrected, the task ID derivation is fixed, and the phase randomization is replaced with deterministic mapping.

---

## What Robust Implementation Would Include

- `loadSessions()` sets `sessions([])` from an empty API response; mock data only in the `error`
  handler, with a visible banner indicating demo mode.
- `getActiveSessionsEnhanced()` returns deterministic `status` (mapped from `loopStatus`) and
  either a real task ID from a Cortex join or `null`.
- `lastHeartbeat` populated in the enhanced endpoint response (or the feature is deferred and
  removed from this PR).
- `debounceTime(500)` on WebSocket event handler before calling `loadSessions()`.
- Session ID format validation on `GET /api/sessions/:id` matching the pattern in
  `extractSessionId()`.
- `startedAt` display moved to a `computed()` map alongside `truncatedActivities`.
- `heartbeatStatusMap` iterating only `sessions()` (running only), not both arrays.
- `catchError` handlers log before discarding.
- A loading skeleton rendered while the initial HTTP call is in flight.
- Scroll position preservation via a lightweight `ScrollStateService` or `RouteReuseStrategy`.

---

## Review Lessons — New Patterns Found

The following patterns were found in this task and are candidates for appending to the review-lessons files:

**Frontend** (`frontend.md`):
- **`catchError(() => EMPTY)` on background API calls must log before discarding, even when the call is "best-effort"** — a silent ignore for cortex sessions or stale-session cleanup means the operator has no observability into degraded states. Always add `console.warn('[ComponentName] call failed:', err)` before returning `EMPTY`. (TASK_2026_158)
- **Empty API response and error response must be handled separately** — a `data.length === 0` guard that falls back to mock data treats a legitimately empty server response the same as a network failure. Reserve mock/fallback data for the `error` callback only; render the empty state from the `next` callback. (TASK_2026_158)
- **Mock session data used as a development fallback must be clearly gated behind a failure path, not a content check** — using mock data when the response is empty silently misleads operators in production. (TASK_2026_158)

**Backend** (`backend.md`):
- **`GET /:id` endpoints must validate the ID format before forwarding to the service** — all other parameterized endpoints in the controller validate with a regex (`TASK_ID_RE`). Session ID endpoints that omit this check create an inconsistency and a potential path-traversal vector. Mirror the pattern from `extractSessionId()` as a request guard. (TASK_2026_158)
- **Computed fields with `Math.random()` must never be returned in a deterministic API** — `getActiveSessionsEnhanced()` returns random phase and status on every call. Any WebSocket-triggered refresh causes the UI to flicker with fabricated state changes. Use deterministic derivation from stored state or return `null`. (TASK_2026_158)

---

| Verdict | FAIL |
|---------|------|
