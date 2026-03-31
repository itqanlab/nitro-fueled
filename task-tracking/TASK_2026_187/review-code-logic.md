# Code Logic Review — TASK_2026_187

## Review Summary

| Metric              | Value                                           |
| ------------------- | ----------------------------------------------- |
| Overall Score       | 5/10                                            |
| Assessment          | NEEDS_REVISION                                  |
| Critical Issues     | 3                                               |
| Serious Issues      | 3                                               |
| Moderate Issues     | 4                                               |
| Failure Modes Found | 6                                               |
| Verdict             | FAIL                                            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `getSessionDetail` backend method calls `getSessions()`, then `getWorkers()`, then `loadSessionEvents()` (which calls `getEventsSince(0)`), and then `gatherTaskTraces()` in a loop, each of which opens and closes a separate SQLite connection. If any intermediate call returns `null` after the initial null-check passes (e.g., `getWorkers` returns null because the DB became temporarily busy), the code swaps in an empty array via `?? []` and returns a result with silently empty workers, events, and task results. The caller sees `200 OK` with a valid-looking object but with no task data — the user has no idea the data is incomplete.

The `loadSessionEvents` method calls `getEventsSince(0)` which loads ALL events ever recorded from the cortex DB, then filters by session ID in memory. On a large project with 10,000+ events across 50 sessions, this scans the entire events table every time any user opens a session detail page. There is no error surfaced to the user if the events table is huge and causes a memory spike — the filter just silently runs to completion with whatever fits.

### 2. What user action causes unexpected behavior?

**Clicking "End Session" on a past (non-running) session detail page** produces a silent `404` or `405` error. The `confirmDrain()` method calls `api.drainSession(sessionId)` which sends `PATCH /api/sessions/:id/stop`. This endpoint does not exist anywhere in the backend controller — not in `dashboard.controller.ts` or any other controller. The `catchError` in `confirmDrain()` catches the HTTP error and shows `"Failed to request session stop."`, but only after the user has already committed to stopping the session. The "End Session" button itself renders for ALL sessions with `statusLabel === 'running'`, but `running` can appear for live active sessions that are not this feature's intended target (past sessions in cortex with `loop_status = 'running'` because they were never formally ended).

**Loading the sessions list** when cortex returns an empty array is handled correctly, but **loading when the HTTP request itself fails** (network timeout, server 500) has a state bug. `toSignal` initializes to `null`. The `catchError` maps any error to `of(null)`. The effect sets `loading = false` and `unavailable = true` only when `!this.loading`. On first error (initial load error), `loading` is still `true` when `raw` first becomes `null`, so the condition `else if (!this.loading)` is false — `unavailable` never becomes `true` and the skeleton spinner shows forever.

### 3. What data makes this produce wrong results?

**Task count double-counting**: `mapToListItem` builds `completedCount` by collecting unique task IDs where any worker has `status === 'completed' || outcome === 'COMPLETE'`. A single task that went through multiple workers (Build Worker retried, then succeeded) will have a worker with `status = 'failed'` and another with `outcome = 'COMPLETE'`. The same `task_id` enters both `completedCount` (via outcome) and `failedCount` (via status). Because both use `Set` on `task_id`, the task ID appears in both sets simultaneously. The totals displayed to the user — "3 completed / 2 failed" — are both counting the same task.

**Cost rounding for small values**: `Math.round(data.cost * 10000) / 10000` rounds to 4 decimal places. The frontend then formats with `.toFixed(2)`, showing 2 decimal places. A task that cost `$0.00001` displays as `$0.00` — the user sees zero cost for a task that did cost something. This is minor in isolation but misleads cost analysis.

**`totalTasks` fallback to `session.tasks_terminal`**: When no workers are found for a session (workers were not recorded or the workers table is empty), the total task count falls back to `session.tasks_terminal`, but `completedCount`, `failedCount`, and `blockedCount` remain at zero because they were derived from the empty workers array. The summary row shows "0 / 5 tasks" with 0 completed — which may be accurate but is more commonly a sign of data gap rather than reality, and the user cannot distinguish.

### 4. What happens when dependencies fail?

**Cortex DB opens 3–N+2 connections per `getSessionDetail` call**: `getSessions()` opens and closes one connection. `getWorkers()` opens and closes another. `getEventsSince(0)` opens and closes another. `gatherTaskTraces()` loops over every unique task ID and calls `getTaskTrace(taskId)` per task — each call opens and closes its own connection. For a session with 20 tasks, this is 23+ sequential SQLite connections on a single HTTP request. On a busy system where the cortex DB is being written to continuously, this is 23 opportunities for `SQLITE_BUSY`. Each one returns `null` and is silently converted to an empty array.

**The `PATCH /api/sessions/:id/stop` endpoint is missing entirely from the backend.** The frontend calls `api.drainSession()` which sends `PATCH /api/sessions/{id}/stop`. There is no such route handler registered in the NestJS controller. The request will receive `404 Not Found`, which the `catchError` block catches and turns into a user-visible error message. The drain feature is non-functional. This is a critical incomplete requirement.

**Log file path resolution uses `process.cwd()`**: The NestJS API starts with a working directory that is wherever `nx serve dashboard-api` was launched. In dev, this is typically the repo root. In production deployments (pm2, Docker), `process.cwd()` may be different. The two candidate paths `task-tracking/sessions/:id/log.md` and `.nitro/sessions/:id/log.md` are only correct relative to the project root. If the API is started from a different directory, log reads silently return `null` and the user sees "No log content available" for sessions that do have logs.

### 5. What's missing that the requirements didn't mention?

**Pagination on the backend is entirely absent.** The task requirement says "paginated list" for `GET /api/sessions`, but the backend `getSessionsList()` loads and returns all sessions in one shot. The frontend uses NestJS table pagination controls client-side (shows pagination when `length > 20`), which is fine for small datasets but not scalable. If cortex has 500 sessions, the API returns all 500, the frontend loads them all into memory, and the table renders 500 rows in the DOM. This is a stated requirement that was not met on the backend.

**The `models` field in `SessionHistoryListItem` is populated by the backend** (an array of unique model names used by workers in the session) **but is never rendered in the sessions-list template.** The task requirement specifies "model(s) used" as a column. The Supervisor column shows `supervisorModel` instead. The distinct set of all models used by workers in the session — which is the more useful value — is computed and sent but thrown away by the frontend.

**No refresh mechanism on either component.** The sessions list loads once on route activation and is never refreshed. If a session ends while the user has the list open, they see stale status. There is no polling, no WebSocket subscription, and no manual reload button. Active sessions in the list (status `running`) will show stale data indefinitely.

---

## Failure Mode Analysis

### Failure Mode 1: Permanent Loading Spinner on Initial HTTP Error

- **Trigger**: First HTTP call to `GET /api/sessions` fails (503, network timeout, server crash).
- **Symptoms**: `toSignal` initializes with `null`. `catchError` maps the error back to `of(null)`. The effect condition `else if (!this.loading)` is false because `loading` is still `true` when the first `null` arrives. The effect sets nothing. The skeleton never stops. The user sees an infinite spinner.
- **Impact**: User cannot distinguish "loading" from "API is down". No actionable message.
- **Current Handling**: The `unavailable` path only triggers on a second null (after loading has been set to false by a prior success). First-load failure never reaches the unavailable state.
- **Recommendation**: Change the condition to check whether the signal has emitted at all (use a separate `hasEmitted` boolean) rather than relying on `!this.loading`. Or initialize `loading` to `true` and set it to `false` unconditionally whenever `raw` resolves, whether to a value or `null`.

### Failure Mode 2: `drainSession` Calls a Non-Existent Endpoint

- **Trigger**: User clicks "End Session" on a running session detail page.
- **Symptoms**: HTTP `404` or `405 Method Not Allowed` from NestJS (no PATCH handler registered for `/api/sessions/:id/stop`). The `catchError` block catches the error, `isDraining` is reset, `drainError` shows "Failed to request session stop."
- **Impact**: The "End Session" feature is completely non-functional. The accept criterion is partially unfulfilled (drain/stop was added to the UI but the backend route that makes it work was never implemented).
- **Current Handling**: Error is caught and surfaced to the user.
- **Recommendation**: Implement the `PATCH /api/sessions/:id/stop` handler in the controller and the corresponding method in `CortexService` that sets `drain_requested = 1` on the session row, or remove the drain UI if out of scope for this task.

### Failure Mode 3: Task Count Double-Counting Across Workers

- **Trigger**: Any session where a task was retried — a Build Worker failed on the first attempt and a second Build Worker was spawned for the same task ID.
- **Symptoms**: The same `task_id` matches the `failedCount` predicate (via the first worker's `status = 'failed'`) AND the `completedCount` predicate (via the second worker's `outcome = 'COMPLETE'`). Both counts are non-zero for the same task.
- **Impact**: Summary shows misleading task statistics, e.g., a session with 10 tasks that had 2 retries shows "10 completed, 2 failed" (12 total outcomes for 10 tasks). The task requirement specifies accurate outcome counts.
- **Current Handling**: No deduplication logic. The last-writer-wins approach in `buildTaskResults` deduplicates workers per task for cost aggregation, but `mapToListItem` is independent and does not deduplicate by latest worker.
- **Recommendation**: For each task ID, use only the latest worker's outcome (sort by `spawn_time` descending, take first). The current `completedCount`/`failedCount` logic must be driven by the final outcome per task, not any worker's status.

### Failure Mode 4: N+2 SQLite Connections Per Session Detail Request

- **Trigger**: Any call to `GET /api/sessions/:id`.
- **Symptoms**: `getSessions()` + `getWorkers()` + `getEventsSince(0)` + one `getTaskTrace()` per unique task in the session. A session with 30 tasks opens 33 database connections in sequence. Under write pressure from a running session, any `getTaskTrace()` call in the loop can return `null` (SQLITE_BUSY or similar), causing that task's trace to silently disappear from the response.
- **Impact**: Silent data loss in the Task Results section. High DB connection churn under load.
- **Current Handling**: Each method opens, queries, and closes its own connection. Errors log a warning and return null, which is converted to empty array / absent trace.
- **Recommendation**: `getSessionDetail` should accept a single open `Database` handle and delegate to query-level functions instead of calling service-level methods that each manage their own connection lifecycle.

### Failure Mode 5: `getEventsSince(0)` Full Table Scan

- **Trigger**: Any call to `GET /api/sessions/:id` on a project with significant history.
- **Symptoms**: All cortex events ever recorded are loaded into memory, then filtered in JS. For a project like this one (55+ tasks, dozens of sessions, potentially tens of thousands of events), this is a large allocation on every page view.
- **Impact**: High memory usage on the API server. Slow response times on session detail. Risk of OOM on large projects.
- **Current Handling**: No filtering at the query level — all events fetched, then filtered by `session_id` in `loadSessionEvents`.
- **Recommendation**: Pass `sessionId` as a filter to `getEventsSince` or introduce a `getEventsBySession(sessionId)` method that queries `WHERE session_id = ?`.

### Failure Mode 6: `drainRequested` Missing from Backend Response

- **Trigger**: Any call to `GET /api/sessions/:id`.
- **Symptoms**: The frontend `SessionHistoryDetail` interface declares `readonly drainRequested: boolean`. The backend `SessionHistoryDetail` interface (in `sessions-history.service.ts`) does NOT include `drainRequested` — the field is absent from both the interface definition and the returned object literal in `getSessionDetail()`. TypeScript does not catch this mismatch because the frontend type is defined independently. At runtime, `raw.drainRequested` in the detail component evaluates to `undefined`, which TypeScript's `boolean` type treats as falsy.
- **Impact**: The "End Session" button logic is permanently broken even for truly running sessions. `d.drainRequested` is always `undefined` (coerces to `false`), so the drain state is never reflected in the UI from the server's perspective.
- **Current Handling**: The frontend signal `isDraining` is managed locally and would not survive a page reload. After a reload, `drainRequested` would show `false` (undefined) even if the server had already marked the session for drain.
- **Recommendation**: Add `drainRequested: session.drain_requested` to the returned object in `getSessionDetail()` and add it to the backend's `SessionHistoryDetail` interface.

---

## Critical Issues

### Issue 1: `PATCH /api/sessions/:id/stop` endpoint does not exist

- **Files**: `apps/dashboard/src/app/services/api.service.ts:411`, `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:151`
- **Scenario**: User clicks "End Session" on a running session detail page.
- **Impact**: HTTP 404/405 on every drain attempt. Feature is completely non-functional. An accept criterion ("Clicking a session opens session detail") implies drain capability for active sessions.
- **Fix**: Implement `@Patch('sessions/:id/stop')` in `dashboard.controller.ts` delegating to a `requestDrain(sessionId)` method on `CortexService` that sets `drain_requested = 1` in the SQLite sessions table.

### Issue 2: `drainRequested` field absent from backend response

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:100–133` (return object), `apps/dashboard/src/app/models/api.types.ts:768`
- **Scenario**: Session detail page loads any session.
- **Impact**: `raw.drainRequested` is always `undefined` at runtime. The drain status is never correctly reflected from server state. Frontend `EnrichedDetail.drainRequested` is always falsy.
- **Fix**: Add `drainRequested: session.drain_requested` to the `getSessionDetail` return statement and to the backend `SessionHistoryDetail` interface.

### Issue 3: Permanent spinner on first-load HTTP error (`loading` state machine bug)

- **Files**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts:76–86`, `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:160–169`
- **Scenario**: API returns 503 or network times out on initial page load.
- **Impact**: The `unavailable` banner never renders. The skeleton spinner runs forever. User sees no error message and cannot act.
- **Fix**: Set `loading = false` whenever the signal emits any value (including the error-mapped `null`), then separately set `unavailable = true` when `raw === null`. Remove the `!this.loading` guard from the `unavailable` branch.

---

## Serious Issues

### Issue 4: Task outcome double-counting on retried tasks

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:140–148`
- **Scenario**: Session contains any task that was retried (two workers for the same task ID where first has `status = 'failed'` and second has `outcome = 'COMPLETE'`).
- **Impact**: Task appears in both `completedCount` and `failedCount`. Displayed summary is factually wrong. Accuracy is an explicit acceptance criterion.
- **Fix**: For each unique task ID, select only the final worker (highest `spawn_time` or the one with a terminal outcome) before computing counts.

### Issue 5: `GET /api/sessions` returns all sessions — backend pagination absent

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:79–86`
- **Scenario**: Project accumulates hundreds of sessions over time.
- **Impact**: Full sessions table loaded and serialized per request. Frontend renders all rows. Memory and response time grow unbounded. Task requirement explicitly says "paginated list."
- **Fix**: Add `limit`/`offset` or `page`/`pageSize` query params to `GET /api/sessions`, pass them through to `getSessionsList()`, and implement SQL `LIMIT/OFFSET` in the Cortex query.

### Issue 6: `getEventsSince(0)` loads all events for session detail

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:188–191`
- **Scenario**: Any `GET /api/sessions/:id` call on a mature project with thousands of events.
- **Impact**: Full events table loaded into memory on every session detail page open. Server memory spike. Slow responses.
- **Fix**: Add a `getEventsBySession(sessionId: string)` method to `CortexService` that queries `WHERE session_id = ?`, or extend `getEventsSince` to accept an optional session ID filter.

---

## Moderate Issues

### Issue 7: `getSessions()` API method naming conflict

- **Files**: `apps/dashboard/src/app/services/api.service.ts:168` and `:401`
- **Scenario**: Developer calls `api.getSessions()` expecting the old `SessionSummary[]` return type, but `api.getSessionHistory()` also hits the same `GET /api/sessions` endpoint and returns `SessionHistoryListItem[]`. The backend now returns `SessionHistoryListItem[]` from that endpoint; `getSessions()` declares `SessionSummary[]` as its return type, which is now a type lie.
- **Impact**: Any consumer of the old `getSessions()` method (e.g., any active-sessions panel that polls `/api/sessions`) will silently receive `SessionHistoryListItem[]` shaped data while TypeScript believes it is `SessionSummary[]`. Runtime field access will return `undefined` for fields that exist on one shape but not the other.
- **Fix**: Audit all callers of `api.getSessions()`. If `/api/sessions` now returns history items, either rename `getSessions()` to match the new contract or restore the old behavior behind a separate endpoint.

### Issue 8: `models` field computed but never displayed

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:150`, `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html`
- **Scenario**: Sessions list loads successfully.
- **Impact**: Task requirement says "model(s) used" should appear per row. The backend computes `models: [...uniqueModels]` and the frontend type includes it, but the `EnrichedSession` interface drops it and the template never renders it. The "Supervisor" column shows only the supervisor model, not the full set of models used by all workers.
- **Fix**: Add `models` to `EnrichedSession`, format as comma-joined string, and add a "Models" column to the template.

### Issue 9: N+2 SQLite connections per session detail request

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:88–133`
- **Scenario**: `GET /api/sessions/:id` for a session with many tasks.
- **Impact**: High connection churn. Under write pressure, intermediate calls can silently return `null` and produce an incomplete response. Described in detail in Failure Mode 4.
- **Fix**: Pass a single `Database` instance through `getSessionDetail` and its sub-methods, or use a transaction that keeps a single connection alive for the duration of the request.

### Issue 10: Log path resolution depends on `process.cwd()` at API startup

- **Files**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:257–271`
- **Scenario**: Dashboard API started from a directory other than the project root (CI, Docker, pm2 with a custom cwd).
- **Impact**: Log files exist at `task-tracking/sessions/:id/log.md` relative to the project root, but `readLogContent` constructs the path relative to `process.cwd()`. Silently returns `null` and shows "No log content available."
- **Fix**: Store the project root as a configurable service parameter (injected from the module or from an environment variable), not derived from `process.cwd()` at request time.

---

## Data Flow Analysis

```
GET /api/sessions
  └─ DashboardController.getSessions()
      └─ SessionsHistoryService.getSessionsList()
          ├─ CortexService.getSessions()        → opens DB #1, closes
          │     returns CortexSession[] | null
          └─ CortexService.getWorkers()         → opens DB #2, closes
                returns CortexWorker[] | null (silently [] on failure)
                │
                └─ mapToListItem() per session
                    ├─ completedCount: ANY worker for task with status/outcome COMPLETE
                    ├─ failedCount: ANY worker for task with status/outcome FAILED
                    │     ISSUE: same task_id can appear in BOTH sets (retried tasks)
                    └─ returns SessionHistoryListItem[]

GET /api/sessions/:id
  └─ DashboardController.getSession()
      ├─ SESSION_ID_RE format validation (correct)
      └─ SessionsHistoryService.getSessionDetail()
          ├─ CortexService.getSessions()        → opens DB #1, closes
          ├─ CortexService.getWorkers({sessionId}) → opens DB #2, closes
          ├─ loadSessionEvents()
          │    └─ CortexService.getEventsSince(0) → opens DB #3, closes
          │         ISSUE: loads ALL events, filters in memory
          ├─ gatherTaskTraces()
          │    └─ per task_id: CortexService.getTaskTrace(id) → opens DB #N, closes
          │         ISSUE: N = number of unique tasks in session
          └─ readLogContent()
               └─ fs.readFile(process.cwd()/task-tracking/sessions/:id/log.md)
                    ISSUE: cwd may not be project root in all deployments

               MISSING: drainRequested field never added to return object

Frontend (SessionDetailComponent)
  └─ route.paramMap → switchMap → api.getSessionHistoryDetail(:id)
      ├─ toSignal(initialValue: null) — loading/unavailable state bug on first error
      ├─ computed detail() reads raw.drainRequested → undefined (field missing from API)
      └─ confirmDrain()
           └─ api.drainSession(sessionId) → PATCH /api/sessions/:id/stop → 404
```

Gap points:
1. `drainRequested` missing from backend response object
2. `PATCH /sessions/:id/stop` route handler absent
3. Task counts double-count retried task IDs
4. Loading state machine does not handle first-load errors

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| `/sessions` route renders paginated session list | PARTIAL | Client-side only; backend not paginated |
| Paginated list with summary stats | PARTIAL | Stats present but task count accuracy is broken for retried tasks |
| Session ID, source, start/end time, duration | COMPLETE | All fields present and mapped |
| Summary counts (completed/failed/blocked/total) | PARTIAL | Double-counts retried tasks |
| Total cost, model(s) used | PARTIAL | Cost present; models computed but not rendered |
| Status badge, clickable rows | COMPLETE | Both present |
| `/sessions/:id` with task results, timeline, log, workers | COMPLETE | All four sections present and populated |
| Session detail header metadata | COMPLETE | Present |
| Task Results table with outcome, cost, duration, model, review score | COMPLETE | All fields present |
| Timeline from cortex events | COMPLETE | Present |
| Session Log collapsible | COMPLETE | Present |
| Workers table | COMPLETE | Present |
| `GET /api/sessions` real data from cortex | COMPLETE | Real data, no mocks |
| `GET /api/sessions/:id` real data from cortex | COMPLETE | Real data, no mocks |
| Active session endpoints preserved | COMPLETE | `GET /active` and `GET /active/enhanced` unchanged |
| Sessions link in sidebar nav | COMPLETE | Added at correct position |
| `GET /api/sessions` paginated | MISSING | Requirement stated; not implemented |

### Implicit Requirements NOT Addressed

1. **Drain/stop endpoint**: The "End Session" button on a running session in the detail view implies backend support — no backend route exists.
2. **Staleness handling**: Running sessions in the history list will show stale status with no indication to the user.
3. **Per-task Task ID links**: Task IDs appear in the task results table as plain text. Users would reasonably expect clicking a task ID to navigate to the task detail page (e.g., `/project/task/:id`).

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Cortex DB unavailable | YES | Returns null → 503 | Correct |
| Session ID not found in DB | YES | Returns null → 404 | Correct |
| Invalid session ID format | YES | Regex → 400 | Correct |
| Empty workers list for a session | PARTIAL | Falls back to `tasks_terminal` for total | Counts show 0/N which is ambiguous |
| Session with no events | YES | Returns empty timeline array | Correct |
| HTTP failure on first load | NO | Spinner never stops | Bug in loading state machine |
| Task retried (multiple workers per task) | NO | Double-counts in completed/failed | Logic error |
| `totalCost` is zero (no workers recorded) | YES | Shows `$0.00` | Technically correct |
| Log file not found | YES | Returns null, UI shows empty state | Correct but path-dependent |
| Very large events table | NO | Loads all events in memory | Performance risk |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| SQLite `getSessions()` | LOW | High — null returns 503 | Handled with null check |
| SQLite `getWorkers()` | LOW-MED | Medium — silently empty on null | Uses `?? []` so no 503, empty data returned |
| SQLite `getEventsSince(0)` | MED | Medium — full scan, silent empty | No error surface on partial failure |
| SQLite `getTaskTrace()` per task | MED | Medium — N separate opens, any can fail silently | Each null drops that task's trace |
| `PATCH /api/sessions/:id/stop` | CERTAIN | Critical — endpoint missing | User sees error message only after clicking |
| Log file read via `readFile` | LOW-MED | Low — gracefully returns null | Correct |
| Frontend first-load HTTP error | LOW-MED | High — infinite spinner | Loading state machine bug |

---

## What a Robust Implementation Would Include

- A single `getSessionDetail` database transaction that queries sessions, workers, events, and traces with a single open connection using `BEGIN; SELECT...; SELECT...; COMMIT;` to avoid SQLITE_BUSY churn and ensure consistency.
- Server-side pagination on `GET /api/sessions` with `?page=1&pageSize=20` query parameters.
- A `GET /api/sessions?session_id=X&since_event_id=N` filtered events query instead of a full-table scan.
- A `PATCH /api/sessions/:id/stop` handler setting `drain_requested = 1` in SQLite.
- `drainRequested: session.drain_requested` included in the backend `getSessionDetail` return object.
- Deduplication of task outcomes by latest worker in `mapToListItem` (sort workers by `spawn_time`, take last per `task_id`).
- Loading state machine using a dedicated `{ status: 'pending' | 'loaded' | 'error' }` discriminated union, not a `loading: boolean` flag that causes race conditions on first-error.
- A project root path injected as a service config value (not `process.cwd()`).
- A "Models Used" column in the sessions list template consuming the already-computed `models` array.
- Optional WebSocket subscription for the active-session case so users see live status updates without a manual reload.

---

## New Lessons for Review Lessons Log

- **`else if (!this.loading)` as an "unavailable" gate fails on first-load errors** — if a `toSignal` always initializes to `null` and the first HTTP failure maps to `null`, the loading flag is still `true` when the condition runs. The `unavailable` branch is never reached. Always use a separate `hasEmitted` flag or a discriminated union state to distinguish "initial null" from "error null". (TASK_2026_187)
- **N independent service method calls that each open/close SQLite are N failure opportunities** — when a service method delegates to N sub-methods that each manage their own `Database` connection lifecycle, any sub-call returning `null` is silently converted to empty data. Prefer passing a single `db` handle through the call tree, or use a transaction scope. (TASK_2026_187)
- **Frontend types that add fields not present in backend response create silent `undefined` reads** — when the frontend `SessionHistoryDetail` interface declares `drainRequested: boolean` but the backend omits it from the serialized object, TypeScript gives no error (types are in separate codebases), and the field is silently `undefined` at runtime. Cross-layer types must be validated end-to-end, either by sharing a type package or by adding a runtime assertion on the response shape. (TASK_2026_187)
- **`getEventsSince(0)` as a session-scoped events loader is a full table scan** — passing `sinceId = 0` to an "events since" method loads the entire events table. Always pass a session ID filter at the query layer when only one session's events are needed. (TASK_2026_187)
