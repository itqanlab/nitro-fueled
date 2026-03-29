# Code Logic Review — TASK_2026_145

## Score: 6/10

## Summary

The happy path is solid. DB opens readonly per-call with proper try/finally close, graceful 503 on missing DB, 404 vs 503 distinction is present and mostly correct. The structure is clean. However, there are three bugs that produce wrong results or incorrect HTTP responses in real usage: a parameter binding error in the analytics query, an unreachable 404 in the trace endpoint, and a TOCTOU race in the 503/404 disambiguation. The polling lifecycle and basic SQL are otherwise correct.

---

## Findings

### Critical

#### 1. `queryModelPerformance` — parameter binding order is wrong

**File**: `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts` lines 157–168

**What happens**: When both `model` and `taskType` filters are supplied together, the params array is built in the wrong order. The SQL CTE needs bindings in the order: `(model_phase, taskType_phase, model_review, taskType_review)`. The code pushes them as `(model, model, taskType, taskType)` — interleaving by filter rather than by clause.

Concrete walk-through when `model="claude"` and `taskType="feature"` are both set:

- SQL slot 1 (`p.model = ?`) expects `"claude"` — gets `"claude"` (correct)
- SQL slot 2 (`t.type = ?` in phase_data) expects `"feature"` — gets `"claude"` (wrong)
- SQL slot 3 (`r.model_that_reviewed = ?`) expects `"claude"` — gets `"feature"` (wrong)
- SQL slot 4 (`t.type = ?` in review_data) expects `"feature"` — gets `"feature"` (correct)

Result: the analytics endpoint returns silently wrong data — filtered by model in the wrong CTE and by task type in the wrong CTE. No error is thrown; the query executes and returns plausible-looking garbage.

**Impact**: `GET /api/v1/cortex/analytics/model-performance?model=X&taskType=Y` always returns wrong data when both params are present. Silent data corruption.

---

#### 2. `getCortexTaskTrace` — 404 branch is unreachable; empty trace returned for unknown task IDs

**File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts` lines 328–337 and `cortex-queries-worker.ts` lines 98–148

`queryTaskTrace()` never returns null. It always returns `{ task_id: taskId, workers: [], phases: [], reviews: [], fix_cycles: [], events: [] }` regardless of whether the task exists in the DB. `CortexService.getTaskTrace()` therefore returns a non-null object for every taskId, including invented ones. The controller checks `result === null` — that condition is never true.

Effect: `GET /api/v1/cortex/tasks/TASK_9999_999/trace` on a non-existent task returns HTTP 200 with an empty trace object instead of 404. The `isCortexAvailable()` and 404 throw on lines 330–336 are dead code.

**Impact**: Clients can not detect "task does not exist" vs "task exists but has no trace data yet". All unknown task IDs silently return empty collections.

---

### Serious

#### 3. `isCortexAvailable()` is a TOCTOU race and opens the DB a second time per "not found" request

**File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts` lines 312–318 and 429–436

For `getCortexTask` and `getCortexSession`, when the service returns null the controller calls `isCortexAvailable()` to disambiguate "DB absent" from "record not found". This check:

- Opens the DB a second time (an extra `existsSync` + `new Database()` + `close()`) on every miss.
- Introduces a race: the DB file could be deleted between the first call and the probe, causing a real "not found" (404) to be reported as "DB unavailable" (503), or vice versa.
- `isCortexAvailable()` probes via `getEventsSince(Number.MAX_SAFE_INTEGER)` which is correct in intent but unnecessarily executes a SQL query just to check file presence. `existsSync(this.dbPath)` would be cheaper and sufficient.

**Impact**: Under rapid cortex startup/shutdown, clients receive the wrong status code. Two DB open/close cycles per miss adds latency for every 404 request.

---

#### 4. `lastCortexEventId` resets to 0 on server restart — replays entire event history

**File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` line 37

`lastCortexEventId` is an in-memory instance variable initialized to 0. Every time the dashboard-api process restarts, polling resumes from event ID 0, and every cortex event ever recorded is re-emitted to all connected WebSocket clients.

For a project with thousands of events, this produces a burst of stale events on reconnect. Clients that use these events to drive UI state will re-process historical completions, failures, and status changes as if they just happened.

**Impact**: After any dashboard-api restart (deploy, crash, config change), all WebSocket clients receive the full event history replayed as live events. Potential for duplicate UI updates or phantom state changes.

---

### Minor

#### 5. `parseJson` and `WORKER_COLS` duplicated across both query files

`parseJson<T>` is defined identically in both `cortex-queries-task.ts` (lines 32–39) and `cortex-queries-worker.ts` (lines 30–37). `WORKER_COLS` is defined in both files (lines 25–26 in task, lines 23–24 in worker). If the schema changes, both copies need updating.

**Impact**: Maintenance hazard — divergence when one copy is updated and the other is not.

---

#### 6. `getCortexTask` — task ID validation missing for cortex endpoints

**File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts` lines 310–319

The pre-existing task endpoints at `/api/v1/tasks/:id` validate the ID format against `TASK_ID_RE` and return 400 on invalid input. The cortex task endpoints (`/cortex/tasks/:id`, `/cortex/tasks/:id/trace`) accept any string as the task ID and pass it directly into `db.prepare(...).get(taskId)`. While parameterized queries prevent SQL injection, a client can pass a 10KB string as a task ID and it will hit the DB.

**Impact**: Minor — no injection risk due to parameterized queries, but no input sanitization. Inconsistent validation behavior between cortex and non-cortex task endpoints.

---

#### 7. Polling fires before WebSocket server is ready to accept connections

**File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` lines 49–53

`afterInit()` calls `startCortexPolling()` immediately. The first poll fires after 3 seconds. The guard `if (!this.server) continue` in `pollCortexEvents()` line 174 handles the server-not-ready case for individual event emissions, but only inside the per-event loop. If `events.length === 0`, the guard is never reached and no emit occurs — that path is safe. If events exist before any client connects, they are emitted to zero clients and `lastCortexEventId` advances, meaning those events are lost permanently for any client that connects after the first poll.

**Impact**: Events that arrive in the first 3 seconds after gateway init before any client connects are consumed and never re-sent. For a local dev tool this is low risk, but it means early-boot events vanish silently.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `queryModelPerformance` with both filters returns wrong data with no error or warning (Critical issue 1).
- `queryTaskTrace` returns empty collections for non-existent task IDs instead of surfacing the miss (Critical issue 2).
- `lastCortexEventId` advancing past historical events on first poll after restart means those events are dropped with only a DEBUG log line.

### 2. What user action causes unexpected behavior?

- Calling `GET /api/v1/cortex/analytics/model-performance?model=claude&taskType=feature` returns data filtered incorrectly — wrong model mapped to wrong task type bucket.
- Calling `GET /api/v1/cortex/tasks/NONEXISTENT/trace` returns 200 with empty arrays instead of 404.
- Restarting the dashboard-api while a session is in progress causes all WebSocket clients to receive a flood of replayed historical events.

### 3. What data makes this produce wrong results?

- Any invocation of the model-performance analytics query with both the `model` and `taskType` query parameters simultaneously.
- Any task ID that does not exist in the cortex DB passed to the trace endpoint.

### 4. What happens when dependencies fail?

- DB deleted mid-request: `openDb()` catches the `fileMustExist: true` error and returns null, service returns null, controller throws 503. This is handled correctly.
- DB locked by cortex writer: better-sqlite3 readonly mode can throw `SQLITE_BUSY`. This is caught by the try/catch in the service and returns null (503). Correct.
- DB corruption: better-sqlite3 throws on `prepare()` or `all()`, caught by the service, returns null (503). Correct.
- cortex event table grows very large: `queryEventsSince(0)` on restart reads the entire table into memory. No LIMIT on the query. With tens of thousands of events this allocates a large in-process array.

### 5. What's missing that the requirements didn't mention?

- No upper bound on events returned by `queryEventsSince` — a large events table could spike memory on restart replay.
- No mechanism for a newly connecting WebSocket client to request historical cortex events since a cursor — clients that connect after events have already been polled will never receive those events.
- `isCortexAvailable()` is used as a disambiguation probe but introduces a second DB open per miss; a cleaner design would have `openDb()` itself return a discriminated result or have the service distinguish "DB absent" from "DB open but record not found" at the return type level.
