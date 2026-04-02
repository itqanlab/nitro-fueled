# Code Logic Review — TASK_2026_183

| Verdict | NEEDS_REVISION |
|---------|----------------|

| Metric              | Value          |
| ------------------- | -------------- |
| Overall Score       | 5/10           |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 2              |
| Serious Issues      | 4              |
| Moderate Issues     | 4              |
| Failure Modes Found | 6              |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `getProgressCenter()` calls `getEventsSince(0)` — fetches ALL events in the DB with no upper-bound limit. On a mature project with thousands of events, this silently loads an unbounded result set into memory and then discards all but the last 40 in `buildActivity()`. The filter-after-fetch pattern hides both the performance cliff and its origin.
- `collectSessionTaskIds` accepts `workers` that are **already pre-filtered** to the session before being passed in (`sessionWorkers`), but the `events` array it receives is the **entire unfiltered event list**. The filter `event.session_id === sessionId` is therefore the only guard, and if `session_id` is absent on any event row (e.g., a global system event), the task ID is silently skipped or included depending on which side of the conditional it falls on.
- `buildPhaseAverages` maps a cortex `phase === 'Review'` row to **both** `QA` and `Review` UI keys, discarding `'Completion'` mapping into `Review` with a separate branch. If cortex emits a phase named `'QA'` directly (which is plausible given the DB schema stores free-form strings), the averages for QA remain at the hardcoded 10-minute default with no log or indication of the mismatch.
- `isWorkerStuck` uses `session.last_heartbeat` as the staleness proxy for a worker — but a session heartbeat is updated by the Supervisor, not by individual workers. A worker can be genuinely stuck while the Supervisor keeps heartbeating, causing `isWorkerStuck` to return `false` silently and the health dashboard to show "0 stuck" when workers are in fact hung.

### 2. What user action causes unexpected behavior?

- Opening the progress center with no active sessions shows the `EmptyStateComponent` (correct). But if the API returns HTTP 503 (`catchError(() => of(null))`), the snapshot becomes `null`, `hasData()` returns `false`, and the user sees the same empty-state with no distinction between "nothing running" and "backend unavailable". There is no error banner.
- A rapid page reload or navigation away and back while a WebSocket event fires will trigger `refresh$.next()` inside the `debounceTime(400)` window. `switchMap` cancels the in-flight HTTP call, which is correct, but if the component is destroyed mid-flight the subscription cleanup via `destroyRef.onDestroy` correctly unsubscribes, so this is safe. However — the `notificationSub` listens on `cortexEvents$` independently and calls `maybeNotify` without any reference to whether the snapshot has loaded. A `complete` event from the previous session can fire a browser notification the moment the user navigates to the page, before any data is displayed.
- The `healthToneClass` computed signal defaults to `'health-pill--healthy'` when `health()` is `null` (i.e., loading or error). The header will render a green "healthy" pill while the page is in a 503 error state, misleading the user.

### 3. What data makes this produce wrong results?

- **`currentPhase` logic is inverted.** In `progress-center.helpers.ts` line 63–66, phases are detected from `trace.phases` by checking whether a phase has ever been *seen* at all, then falling back through Dev → Architect → PM. This means a task that has completed Dev and is now in QA will be reported as `'Dev'` because `seen.has('Dev')` is true. The function only correctly identifies the *first* phase that was ever logged, not the *current* one.
- **ETA for session-level is the max across tasks**, not the remaining time for the session as a whole. If one task has a 45-minute ETA and two others are already complete, the session ETA shows 45 minutes — accurate only if tasks are sequential. In parallel sessions (the normal case for auto-pilot), the session ETA should be the max among *in-progress* tasks, not all tasks. Completed tasks return `null` ETA from `remainingEta` because `phases.reduce` returns `0` and the null guard at line 95 returns `null`. So the bug is masked — `maxEta` filters `null` values, meaning completed tasks do not inflate the ETA. But tasks where `isTerminalTaskStatus` returns `true` still go through `progressPercent(phases, status)` which returns `100`, and `remainingEta(phases, phaseAverages)` returns `null`. This is actually correct. Revised: the max-ETA approach is semantically wrong for true parallelism but arithmetically happens to work. **Minor logical concern, not a critical bug.**
- **`totalTasks` formula is non-deterministic.** `Math.max(taskSnapshots.length, completedTasks + new Set(sessionWorkers.map(w => w.task_id)).size, 1)` — if workers include empty `task_id` strings (which `collectSessionTaskIds` guards against with `!== ''` but the Set here does not), the Set size includes the empty string, overcounting total tasks by one.
- **`currentPhase` defaults to `'PM'` when no phases have been logged.** For a brand-new task with no trace phases yet, this is correct. But `phaseStates` will show PM as active and Architect/Dev/QA/Review as pending even if the worker is already executing Dev work (it just hasn't written a phase row yet). The UI phase strip misleads the user into thinking the task hasn't started.

### 4. What happens when dependencies fail?

- **`getSnapshot()` makes 5 separate DB connections** (sessions, workers, tasks, phaseTiming, events — each via `cortexService.*` which opens and closes a connection per call). If the DB file is locked between calls, the method returns `null` for one call, triggering 503. But worse: all 5 calls are made regardless of whether the first already returned `null`. There is no short-circuit — if `getSessions()` returns null, all four remaining DB opens still occur and the results are thrown away.
- **`buildTaskSnapshot` makes one additional `getTaskTrace` call per task inside the hot `getSnapshot()` path.** For a session with 20 tasks, this is 5 (outer) + 20 (traces) = 25 DB open/close cycles per HTTP request. Each `getTaskTrace` call opens a new `better-sqlite3` connection. This is a synchronous N+1 DB query pattern. Under load or with many tasks, this causes cumulative lock contention on the SQLite file.
- **WebSocket disconnect is not reflected in the UI.** If the Socket.IO connection drops (e.g., network blip), `cortexEvents$` simply stops emitting. `debounceTime(400)` stops triggering refreshes. The snapshot becomes stale with no visual indicator to the user that live updates have stopped. The last-updated timestamp will freeze — a subtle stale-data signal — but there is no "disconnected" banner.

### 5. What's missing that the requirements didn't mention?

- **No nav entry.** The route `/progress` is registered and the component exists, but there is no mention of a navigation link being added to `LayoutComponent` or the nav sidebar. Users cannot discover the page unless they know the URL.
- **No polling fallback.** If WebSocket is unavailable (Safari WS restrictions, corporate proxy), the page loads the initial snapshot and then never refreshes. There is no polling interval as a fallback.
- **No manual refresh button.** The UI has no affordance for the user to trigger a refresh themselves.
- **Notifications fire on stale events.** The `maybeNotify` handler fires on every `cortexEvent$` emission, including events that were emitted before the user opened the page (because Socket.IO replays events on connection). Depending on gateway seeding behavior, a user could receive a burst of browser notifications for events that happened hours ago.

---

## Findings

### [CRITICAL] `currentPhase` logic is inverted — reports first-logged phase, not current phase

- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts`
- **Line**: 57–67
- **Severity**: critical
- **Issue**: The function checks `seen.has('Dev')`, `seen.has('Architect')`, `seen.has('PM')` in that order from most-advanced to least-advanced. Because it uses `has()` on a completed-phases set, a task that has passed through PM, Architect, and Dev will have all three in `seen`. The condition `if (seen.has('Dev')) return 'Dev'` fires first and returns Dev — even if the task is now in QA or Review. The result is that phase detection is effectively frozen at the first advanced phase logged, never advancing beyond Dev unless the task reaches IN_REVIEW or COMPLETE status.
- **Suggestion**: Track the *latest* phase row by start_time or ordering in `trace.phases`, not set membership. The last element in `trace.phases` (sorted by time) represents the furthest phase logged. Use `trace.phases[trace.phases.length - 1]?.phase` as the basis for mapping to `ProgressCenterPhaseKey`.

---

### [CRITICAL] Unbounded `getEventsSince(0)` on every HTTP request

- **File**: `apps/dashboard-api/src/dashboard/progress-center.service.ts`
- **Line**: 44
- **Severity**: critical
- **Issue**: `this.cortexService.getEventsSince(0)` fetches every event ever written to the cortex DB. `buildActivity()` then filters to active sessions and slices the last 40. All other rows are loaded into memory and discarded. On a long-running project this query can return tens of thousands of rows per request, imposing unbounded memory and latency cost. This call is made synchronously on the HTTP thread (better-sqlite3 is synchronous), blocking the NestJS event loop.
- **Suggestion**: Add a `limit` or `sinceId` parameter to `getEventsSince` at the service boundary, or add a newer `getRecentEvents(limit, sessionIds)` query that filters at the DB layer with a `WHERE session_id IN (...)` clause and an `ORDER BY id DESC LIMIT 40`.

---

### [SERIOUS] N+1 SQLite connections per snapshot request

- **File**: `apps/dashboard-api/src/dashboard/progress-center.service.ts`
- **Line**: 109
- **Severity**: major
- **Issue**: `buildTaskSnapshot` calls `this.cortexService.getTaskTrace(taskId)` once per task. Each call opens a new `better-sqlite3` `Database` connection and closes it. For a session with N tasks, the snapshot endpoint opens 5 + N total DB connections synchronously per request. Under concurrent requests or busy DB writes, this creates lock-contention windows and adds observable latency per task.
- **Suggestion**: Batch all task trace queries into a single DB open that fetches traces for the full set of task IDs at once. Add a `getTaskTracesBulk(taskIds: string[]): Map<string, CortexTaskTrace> | null` method to `CortexService` that wraps a single connection.

---

### [SERIOUS] `isWorkerStuck` proxies session heartbeat instead of worker heartbeat

- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts`
- **Line**: 111–115
- **Severity**: major
- **Issue**: `isWorkerStuck` compares `Date.now()` to `session.last_heartbeat`, not to a per-worker heartbeat. The Supervisor updates the session heartbeat on every iteration of its loop, so as long as the Supervisor itself is alive, no worker will ever be flagged as stuck regardless of how long a worker has been idle. Workers that are genuinely hung inside a long-running Claude invocation will not be detected.
- **Suggestion**: Use a worker-level field for staleness detection (e.g., `worker.spawn_time` plus an expected-max-duration threshold, or a dedicated `worker.last_heartbeat` column if available). Document the limitation if worker-level heartbeat is not yet available in the DB schema.

---

### [SERIOUS] `totalTasks` Set includes workers with empty `task_id`

- **File**: `apps/dashboard-api/src/dashboard/progress-center.service.ts`
- **Line**: 78
- **Severity**: major
- **Issue**: `new Set(sessionWorkers.map((worker) => worker.task_id)).size` — `CortexWorker.task_id` is typed as `string` (not `string | null`), but workers without a task assignment appear to have an empty string (`''`). `collectSessionTaskIds` guards `!== ''` when building task IDs, but this `Set` has no such guard. If any worker has `task_id === ''`, the Set size is inflated by one, making `totalTasks` one higher than the actual task count and permanently holding `progressPercent` below 100% even when all real tasks complete.
- **Suggestion**: Filter empty strings: `new Set(sessionWorkers.map(w => w.task_id).filter(id => id !== ''))`.

---

### [SERIOUS] HTTP 503 and no-sessions both show identical empty state — no error feedback

- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts`
- **Line**: 41
- **Severity**: major
- **Issue**: `catchError(() => of(null))` collapses all HTTP errors (503, 500, network timeout) into `null`. The component then shows the same `EmptyStateComponent` as it shows when there genuinely are no active sessions. The user cannot distinguish between "nothing running" and "backend unavailable". Additionally, `healthToneClass` defaults to `'health-pill--healthy'` when `health()` is `null`, showing a green healthy badge while the backend is down.
- **Suggestion**: Distinguish error from empty: use a separate signal (e.g., `loadError = signal<boolean>(false)`) and set it in `catchError`. Render a different empty-state message or banner when `loadError()` is true. Fix `healthToneClass` to not default to `healthy` when the value is null.

---

### [MODERATE] `buildPhaseAverages` silently conflates cortex `'Review'` phase with both `QA` and `Review` UI phases

- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts`
- **Line**: 33–37
- **Severity**: minor
- **Issue**: The cortex DB uses `'Review'` as a phase name. The helper maps it to the UI's `QA` slot and derives the `Review` UI slot as `Math.max(2, Math.round(avg / 2))`. This is an undocumented heuristic. If cortex ever starts logging phases with names `'QA'` or `'Review-Lead'`, the mapping falls through to defaults silently. The comment explaining this intentional mismatch is absent.
- **Suggestion**: Add an inline comment documenting the mapping intention. Consider a lookup table for the cortex-phase-to-UI-phase mapping to make the relationship explicit and auditable.

---

### [MODERATE] Notification fires on replayed historical events at connection time

- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts`
- **Line**: 56
- **Severity**: minor
- **Issue**: `notificationSub` subscribes to `cortexEvents$` immediately. The Socket.IO gateway seeds the client with recent events on connection (see `dashboard.gateway.ts` line 44). If any seeded event contains `'complete'` or `'fail'` in its `event_type`, `maybeNotify` will fire a browser notification for that historical event the moment the user opens the progress center, even if the event happened hours ago.
- **Suggestion**: Track `component init time` and skip notifications for events whose `created_at` is before it. Alternatively, skip notification for the initial seed batch by adding a flag that gates `maybeNotify` until after the first snapshot loads.

---

### [MODERATE] `CortexTask.status` is typed as bare `string`, enabling invisible typos

- **File**: `apps/dashboard-api/src/dashboard/cortex.types.ts`
- **Line**: 15
- **Severity**: minor
- **Issue**: `status: string` on `CortexTask` means `isTerminalTaskStatus` and `currentPhase` compare against string literals (`'COMPLETE'`, `'FAILED'`, etc.) with no compiler protection. A new status value (e.g., `'CANCELLING'`) added to the DB schema will silently fall through all comparisons and behave as an in-progress task. The same applies to `CortexWorker.status` and `CortexSession.loop_status`.
- **Suggestion**: Define typed unions (e.g., `type CortexTaskStatus = 'CREATED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'IN_REVIEW' | 'FIXING' | 'COMPLETE' | 'FAILED' | 'BLOCKED' | 'CANCELLED'`) per the anti-patterns rule: "Use typed string unions / enums for status fields — not bare `string`."

---

### [MODERATE] No navigation entry for `/progress` route

- **File**: `apps/dashboard/src/app/app.routes.ts`
- **Line**: 18
- **Severity**: minor
- **Issue**: The route `/progress` is registered and the component is implemented, but no nav link was added to the layout sidebar or main navigation. The feature is reachable only by direct URL. The task requirements include building the feature for user use, and inaccessible-by-nav features are incomplete by UX standards.
- **Suggestion**: Add a nav link to the layout component's sidebar (e.g., alongside Dashboard and Analytics) pointing to `/progress` with an appropriate label ("Progress Center" or "Mission Control").

---

## Data Flow Analysis

```
HTTP GET /api/progress-center
  -> ProgressCenterService.getSnapshot()
     -> CortexService.getSessions()          [DB open/close #1]
     -> CortexService.getWorkers({})         [DB open/close #2]
     -> CortexService.getTasks({})           [DB open/close #3]
     -> CortexService.getPhaseTiming()       [DB open/close #4]
     -> CortexService.getEventsSince(0)      [DB open/close #5] *** UNBOUNDED ***
     -> for each active session:
        -> for each task in session:
           -> CortexService.getTaskTrace(id) [DB open/close #6..N] *** N+1 ***
     -> buildActivity(events, activeSessions)
        filters events to active session IDs
        .slice(-40)   ← only AFTER full load
        .reverse()
  <- ProgressCenterSnapshot JSON

WebSocket (cortex-event) fires
  -> debounceTime(400)
  -> switchMap -> HTTP GET /api/progress-center (entire flow above repeats)
```

Gap points:
1. `getEventsSince(0)` loads entire event history on every WS-triggered refresh (potentially every few seconds during active sessions)
2. Per-task `getTaskTrace` creates N additional synchronous DB connections per request
3. No circuit breaker or rate limiting on the HTTP endpoint — rapid WS events can queue multiple snapshot fetches

---

## Requirements Fulfillment

| Requirement                   | Status   | Concern                                              |
| ----------------------------- | -------- | ---------------------------------------------------- |
| Session Progress (progress bar per session) | COMPLETE | Correct progress bar, but `totalTasks` can be overcounted |
| Task Progress (per-task phase indicator)    | PARTIAL  | Phase indicator implemented but `currentPhase` logic returns first-ever phase, not current |
| Health Dashboard (color-coded)              | COMPLETE | Correct tone logic; stuck-worker detection is misleading (see Serious #2) |
| Live Activity Feed (WebSocket)              | COMPLETE | Functional; historical event notification leak is a UX bug |
| ETA Estimation                              | COMPLETE | Heuristic-based, acceptable given stated known risk |
| Browser Notifications                       | PARTIAL  | Functional but fires on replayed historical events at load |

### Implicit Requirements NOT Addressed:
1. Navigation link to reach the page — users cannot find `/progress` without direct URL knowledge
2. Visual error state distinguishing backend failure from empty data
3. WebSocket disconnect indicator — stale data with no warning

---

## Edge Case Analysis

| Edge Case                       | Handled | How                              | Concern                                      |
| ------------------------------- | ------- | -------------------------------- | -------------------------------------------- |
| No active sessions              | YES     | Empty state component            | Indistinguishable from API error             |
| All tasks complete              | YES     | Terminal status -> 100% progress | `totalTasks` Set bug may prevent exact 100%  |
| Worker with empty task_id       | PARTIAL | `collectSessionTaskIds` guards it | `totalTasks` Set calculation does not guard  |
| Invalid/malformed event data    | YES     | `activitySummary` uses `typeof` checks | Handles gracefully                      |
| Notification permission denied  | YES     | `Notification.permission` check  | OK                                           |
| Notification API unavailable    | YES     | `typeof Notification === 'undefined'` | OK                                      |
| DB unavailable                  | YES     | Returns 503                      | OK                                           |
| Very large event history        | NO      | Loads all into memory            | Critical performance risk                    |
| Many tasks in session (N+1)     | NO      | One DB open per task             | Serious performance risk under load          |

---

## Integration Risk Assessment

| Integration                          | Failure Probability | Impact                    | Mitigation                          |
| ------------------------------------ | ------------------- | ------------------------- | ----------------------------------- |
| CortexService.getEventsSince(0)      | MED (grows over time) | Memory spike + slow response | Add limit/filter at DB layer      |
| Per-task getTaskTrace (N+1)          | MED (many-task sessions) | SQLite lock contention   | Batch query                         |
| WS disconnect → stale snapshot       | MED                 | User sees outdated data silently | Add reconnect indicator          |
| HTTP error → null snapshot           | LOW                 | Silent empty state         | Add error signal                    |
| session.last_heartbeat as stuck proxy | HIGH (design flaw) | Stuck workers never detected | Use worker-level staleness metric  |

---

## Summary

The implementation is structurally sound: the backend/frontend contract is clean, signals/computed are used correctly, WebSocket integration is properly subscribed and unsubscribed, no stubs or TODOs exist, and the overall architecture is appropriate for a snapshot-based live view.

However, two logic bugs are critical. The `currentPhase` helper reports the *first* phase ever logged for a task rather than the current one, meaning the phase strip and phase label will be frozen and incorrect for any task past its opening phase. The unbounded `getEventsSince(0)` call on every HTTP request (and every WebSocket-triggered re-fetch, which can be several times per minute) will degrade in direct proportion to DB size and poses a blocking-loop risk since better-sqlite3 is synchronous.

The remaining serious issues — N+1 DB connections per request, a stuck-worker detection proxy that can never fire, `totalTasks` overcounting due to unguarded empty strings, and the silent error/empty-state conflation — each represent a failure mode that will surface in real use and require targeted fixes before the page is reliable in production.
