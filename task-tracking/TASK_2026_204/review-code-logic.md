# Code Logic Review — TASK_2026_204

## Summary

| Metric              | Value                                |
|---------------------|--------------------------------------|
| Overall Score       | 7/10                                 |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 2                                    |
| Serious Issues      | 3                                    |
| Moderate Issues     | 4                                    |
| Failure Modes Found | 9                                    |

The multi-session architecture is structurally correct. `SessionRunner` is a proper plain class with isolated per-session state. `SessionManagerService` correctly manages the `Map<sessionId, SessionRunner>`. Module wiring is clean, `SupervisorService` is removed, no stubs or TODOs exist. The happy path works.

What fails: `taskIds` accepted in the request body is silently discarded after validation; two sessions created in the same second collide on primary key; `checkTermination` uses global task counts across all sessions; the drain `return` bypasses `isProcessing = false` in the same tick it calls `stopLoop`; and `pauseSession` / `resumeSession` can throw unhandled exceptions that bubble to the controller as 500s instead of 409s.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`taskIds` is validated in `parseCreateBody` (controller line 211–224) and passed into `CreateSessionRequest`, but `AutoPilotService.createSession` never reads it. The caller sends `{ "taskIds": ["TASK_2026_001"] }` expecting a filtered session; the supervisor ignores the filter and runs every ready task in the DB. No error, no log, no acknowledgment.

### 2. What user action causes unexpected behavior?

Rapid double-click on "Create Session" from the dashboard, or an API client that retries on timeout: two `POST /api/sessions` arrive within the same wall-clock second. Both call `supervisorDb.createSession()` → `buildSessionId()` which is timestamp-only (seconds resolution). The second `INSERT` into `sessions` will fail with a SQLite `UNIQUE constraint failed: sessions.id` error. This propagates as an unhandled exception from `SessionManagerService.createSession`, which the controller catches and converts to a 400. The first session is in the `runners` Map. The second request gets a 400, but the body will say something like "UNIQUE constraint failed" — raw DB internals exposed to the caller.

### 3. What data makes this produce wrong results?

`checkTermination` (session-runner.ts:482–494) calls `getTaskCountsByStatus()` which is a global count across ALL tasks in the DB — it does not filter by `session_claimed = this.sessionId`. In a multi-session setup with two concurrent sessions (the whole point of this refactor), Session A can trigger "All tasks processed" and stop itself even when Session B has just claimed and enqueued more tasks. Each session fires this termination check against the global task table; if any session finishes first and tasks briefly show zero remaining between ticks, the other session self-terminates prematurely.

### 4. What happens when dependencies fail?

`pauseSession` calls `runner.pause()` which throws `Error: Session X is not running (status: Y)` if the session is already paused or stopped. The same for `resumeSession`. `SessionManagerService.pauseSession` does not catch these exceptions — it returns `false` only for "runner not found in Map", not for "runner exists but is in wrong state". The exception propagates through `AutoPilotService.pauseSession` into `AutoPilotController.pauseSession`, which has no try/catch, causing NestJS to return an unhandled 500 instead of a 409 Conflict.

### 5. What's missing that the requirements didn't mention?

The task spec defines `POST /api/sessions/:id/stop` for hard stop and implies `PATCH /api/sessions/:id/stop` is not needed — but the controller implements `PATCH :id/stop` as the drain endpoint (line 175). The drain action also keeps the runner in the `runners` Map after draining completes (the runner calls `stopLoop` internally which sets `loopStatus = 'stopped'` but `SessionManagerService.stopSession` is never called). A drained session remains in `listSessions()` forever — there is no self-removal from the Map when the runner stops itself.

---

## Failure Mode Analysis

### Failure Mode 1: taskIds silently ignored

- **Trigger**: Client calls `POST /api/sessions` with `{ "taskIds": [...] }` to scope a session to specific tasks
- **Symptoms**: Session runs all ready tasks in the DB, not the requested subset. No error returned.
- **Impact**: High — feature advertised by the `StartRequest` type (auto-pilot.types.ts:128) and accepted+validated by the controller, but never enacted. Users assume filtering works.
- **Current Handling**: `parseCreateBody` validates and includes `taskIds` in the result object. `AutoPilotService.createSession` maps fields to `SupervisorConfig` keys but `taskIds` has no corresponding key in `SupervisorConfig`. It is dropped on the floor.
- **Recommendation**: Either add `task_filter: string[]` to `SupervisorConfig` and pass it to the `getTaskCandidates` query, or remove `taskIds` from the accepted request body entirely and document that filtering is not yet supported.

### Failure Mode 2: Session ID collision on concurrent creation

- **Trigger**: Two `POST /api/sessions` requests within the same second (rapid UI clicks, client retries)
- **Symptoms**: Second request returns a 400 with a raw SQLite error message. First session starts normally.
- **Impact**: Moderate — crashes gracefully as a 400, but exposes DB internals. Under load (automated pipelines), collisions are likely.
- **Current Handling**: `buildSessionId()` uses seconds resolution. No uniqueness suffix.
- **Recommendation**: Append a 4-digit millisecond component or a short random suffix: `SESSION_YYYY-MM-DDTHH-MM-SS-mmm` or `SESSION_...-XXXX`. Validate regex in controller accordingly.

### Failure Mode 3: Global task count causes premature session termination in multi-session mode

- **Trigger**: Two concurrent sessions running simultaneously; one finishes its tasks
- **Symptoms**: Session A processes its last task, tick fires. `getTaskCountsByStatus()` returns global counts. If Session B has tasks `IN_PROGRESS` (status is not `CREATED` or `IMPLEMENTED`), the remaining count is 0. Session A terminates with "All tasks processed" — correct. BUT if Session B is between ticks (no active workers yet, all its tasks still `CREATED`), global `CREATED` count is > 0, so Session A waits. The real risk is the reverse: Session B has all tasks `IN_PROGRESS`, Session A's own tasks are `COMPLETE`. Session A's candidates are empty, active workers are 0. `checkTermination` sees `remaining = IN_PROGRESS count > 0` — Session A hangs forever waiting for tasks it did not claim.
- **Impact**: Serious — sessions can deadlock waiting for tasks claimed by sibling sessions when the global count includes `IN_PROGRESS` tasks it cannot process.
- **Current Handling**: `checkTermination` does not filter by `session_claimed = this.sessionId`.
- **Recommendation**: The termination check should also consider whether there are any tasks this session can actually process: no active workers + no claimable candidates = done, regardless of global counts.

### Failure Mode 4: Drain leaves runner in Map indefinitely

- **Trigger**: `PATCH /api/sessions/:id/stop` (drain) followed by workers completing naturally
- **Symptoms**: `stopLoop('Drained by user')` is called from inside `tick()`. The runner sets `loopStatus = 'stopped'` and clears the timer. But `SessionManagerService.stopSession` is never called — the runner stays in `this.runners`. `listSessions()` continues to return it with `loopStatus: 'stopped'`. Memory is not freed until server restart.
- **Impact**: Moderate — stopped sessions accumulate in memory. In long-running deployments with many sessions, this leaks. More practically, `hasActiveSession()` returns false correctly, but `listSessions()` pollutes the UI with stopped entries.
- **Current Handling**: None. The runner has no callback to notify the manager of self-termination.
- **Recommendation**: Add an `onStopped?: (sessionId: string) => void` callback on `SessionRunner` constructor, called from `stopLoop`. `SessionManagerService` registers a cleanup callback that calls `this.runners.delete(sessionId)`.

### Failure Mode 5: pause/resume on wrong-state session returns 500

- **Trigger**: `POST /api/sessions/:id/pause` when session is already paused or stopped
- **Symptoms**: `runner.pause()` throws `Error: Session X is not running`. Exception propagates through the call stack; NestJS default exception filter returns `{ statusCode: 500, message: "Internal server error" }`.
- **Impact**: Serious — any idempotent client (UI polling pause state) can trigger 500s. Correct response is 409 Conflict.
- **Current Handling**: `SessionManagerService.pauseSession` only handles "not found" (returns false). State-conflict errors are unhandled.
- **Recommendation**: Wrap `runner.pause()` / `runner.resume()` in try/catch in `SessionManagerService` and re-throw as a typed error that the service or controller can map to 409.

### Failure Mode 6: `getActiveWorkers` called twice in drain path, with state change between calls

- **Trigger**: Drain requested; tick fires; between the two `getActiveWorkers` calls (lines 148 and 152), a worker finishes
- **Symptoms**: First call at line 148 sees 1 active worker. `processWorkerHealth` marks it finished and calls `handleWorkerCompletion`, which updates DB state. Second call at line 152 sees 0 active workers. `stopLoop` fires. This is actually the correct outcome — but the first `processWorkerHealth` call already mutated state (set task to BLOCKED or CREATED). The drain stop fires before any retry logic from the next tick can re-queue the task.
- **Impact**: Moderate — a task that failed in the last moment before drain may be left in `BLOCKED` state rather than retried, even if retries remain.
- **Current Handling**: No second chance for retry after drain-triggered stop.

### Failure Mode 7: `retryCounters` keyed by `taskId` but `stuckCounters` keyed by `workerId` — asymmetry in cleanup

- **Trigger**: A task is retried (worker killed for being stuck). Retry counter increments for `taskId`. Stuck counter is deleted for `workerId` (line 265). On next spawn, a new `workerId` is assigned. If the new worker also gets stuck, `stuckCounters[newWorkerId]` starts at 0 — it gets two more "stuck" ticks before being killed again. This is correct by design. But `retryCounters[taskId]` keeps incrementing across multiple workers. When the task finally succeeds (worker health = 'finished', status = 'IMPLEMENTED'), `handleWorkerCompletion` calls `tasksCompleted++` but does NOT clear `retryCounters[taskId]`. If the task somehow re-enters the queue (status reset to CREATED by a separate process), the retry counter will be inflated from the previous run.
- **Impact**: Minor in current design (tasks only re-enter CREATED once), but a latent correctness issue.

### Failure Mode 8: `emitEvent` does not actually emit — it only logs

- **Trigger**: Any event (worker:spawned, task:blocked, supervisor:stopped, etc.)
- **Symptoms**: `emitEvent` (lines 534–544) builds a `SupervisorEvent` object and then only calls `this.logger.debug`. There is no WebSocket gateway, SSE stream, or event bus wired. The events are structurally complete but go nowhere.
- **Impact**: Moderate — the dashboard cannot receive real-time updates about session state. The `SupervisorEvent` type definition implies WebSocket delivery ("Events emitted via WebSocket" comment in types). This is a silent gap between the stated architecture and the implementation.
- **Current Handling**: Events are logged to DB via `supervisorDb.logEvent` (separate from `emitEvent`) and debug-logged only.
- **Recommendation**: This is likely intentional deferral (WebSocket layer not yet built), but callers relying on events will see nothing. The gap should be documented.

### Failure Mode 9: `updateConfig` allows concurrency to be reduced below active worker count

- **Trigger**: `PATCH /api/sessions/:id/config` with `{ "concurrency": 1 }` while 3 workers are active
- **Symptoms**: Config is updated immediately via `Object.assign`. Next tick: `availableSlots = 1 - 3 = -2`. No new spawns (correct). But workers already active continue running — no enforcement that the active count is reduced. This is acceptable semantically (workers in flight complete), but the config now says concurrency=1 while 3 workers run. `getStatus()` will report `workers.active = 3` against `config.concurrency = 1`, which may confuse the UI.
- **Impact**: Minor — no correctness error, just a potentially confusing status display.

---

## Critical Issues

### Issue 1: `taskIds` accepted and validated but permanently discarded

- **File**: `auto-pilot.controller.ts:211–224`, `auto-pilot.service.ts:33–52`
- **Scenario**: Any request to `POST /api/sessions` that includes `taskIds`
- **Impact**: Feature silently does not work. Users get no error; the filter is never applied. All eligible tasks are processed.
- **Evidence**: `AutoPilotService.createSession` maps every `CreateSessionRequest` field to `SupervisorConfig` keys — there is no `task_filter` or equivalent key in `SupervisorConfig`. `taskIds` disappears after the controller validates it.
- **Fix**: Either implement the filter (add `task_filter?: string[]` to `SupervisorConfig`, filter candidates in `getTaskCandidates`) or remove `taskIds` from the accepted body and throw a `BadRequestException('taskIds filter not yet supported')` if it arrives.

### Issue 2: Self-terminated sessions (drain, limit, all-done) are never removed from Map

- **File**: `session-manager.service.ts:23`, `session-runner.ts:500–521`
- **Scenario**: Any session that stops itself via `stopLoop` (drain complete, limit reached, all tasks done)
- **Impact**: Sessions accumulate in `runners` Map and `listSessions()` indefinitely. Memory leak in long-running deployments. UI gets stale entries with `loopStatus: 'stopped'`.
- **Evidence**: `stopLoop` (session-runner.ts:500) updates DB and clears timer, but has no mechanism to call `this.runners.delete(sessionId)` in `SessionManagerService`. Only `stopSession` (manager line 72–79) does the delete.
- **Fix**: Add an `onStopped` callback to `SessionRunner` constructor. Call it from `stopLoop`. `SessionManagerService.createSession` registers `(id) => this.runners.delete(id)` as the callback.

---

## Serious Issues

### Issue 3: `pause()` / `resume()` state-conflict throws 500 instead of 409

- **File**: `session-runner.ts:65–85`, `session-manager.service.ts:81–95`, `auto-pilot.controller.ts:134–157`
- **Scenario**: Client calls `POST /api/sessions/:id/pause` on an already-paused or stopped session
- **Impact**: NestJS returns 500 with "Internal server error". Client receives no semantic information.
- **Fix**: Catch `Error` from `runner.pause()` / `runner.resume()` in `SessionManagerService` or in the controller, and throw `ConflictException` (HTTP 409).

### Issue 4: Session ID collision at second granularity

- **File**: `supervisor-db.service.ts:465–469`
- **Scenario**: Two `POST /api/sessions` calls within the same second
- **Impact**: Second session creation fails with a raw SQLite UNIQUE constraint error propagated as 400 with internal DB message.
- **Fix**: Append milliseconds or a random 4-char suffix to `buildSessionId()`. Update `SESSION_ID_RE` in the controller accordingly.

### Issue 5: `checkTermination` uses global task counts — sessions can stall in multi-session mode

- **File**: `session-runner.ts:481–494`, `supervisor-db.service.ts:300–306`
- **Scenario**: Two concurrent sessions; Session B has tasks `IN_PROGRESS` (not visible as candidates), Session A runs out of candidates
- **Impact**: Session A has 0 candidates and 0 active workers, but `getTaskCountsByStatus()` returns non-zero for `CREATED` or `IMPLEMENTED` from Session B's context. Session A correctly avoids false termination in this case — but if Session B holds all remaining tasks in `IN_PROGRESS`, Session A will spin indefinitely on empty ticks until Session B finishes.
- **Fix**: The termination condition should be: `activeWorkers === 0 AND candidates_claimable_by_this_session === 0`. Since `getTaskCandidates()` already filters out tasks claimed by other sessions (implicitly, because claimed tasks become `IN_PROGRESS` and are excluded from the `WHERE status IN ('CREATED', 'IMPLEMENTED')` query), the `candidates.length === 0` check is already session-scoped. The deeper issue is only the global `getTaskCountsByStatus()` second check — if this returns `CREATED > 0` but all those tasks are blocked by dependencies not yet complete, the session also hangs. Document this explicitly or add a "no progress for N ticks" termination escape.

---

## Moderate Issues

### Issue 6: `emitEvent` is a no-op for real-time delivery

- **File**: `session-runner.ts:534–544`
- **Scenario**: Dashboard expects real-time session events (worker spawned, task blocked, session stopped)
- **Impact**: No real-time updates reach the frontend. The `SupervisorEvent` type and event names are fully designed but the delivery pipe is missing.
- **Fix**: Wire to a NestJS EventEmitter or WebSocket gateway when that layer is built. Until then, add a comment noting this is intentionally deferred.

### Issue 7: `getActiveWorkers` queried twice in drain path without reuse

- **File**: `session-runner.ts:148–156`
- **Scenario**: Every tick when drain is active
- **Impact**: Two redundant DB reads per tick. The first result (line 148) is immediately available and already reflects post-health-processing state. The second call (line 152) is a re-fetch.
- **Fix**: Reuse the `activeWorkers` variable from line 148 after `processWorkerHealth` completes, since `processWorkerHealth` updates DB status but the in-memory list from line 148 still reflects the original active set (some may have been health-processed to finished, but the DB-based re-query is authoritative). The re-query is defensively correct but redundant.

### Issue 8: `retryCounters` not cleared on successful task completion

- **File**: `session-runner.ts:197–225`
- **Scenario**: Task succeeds after one or more retries
- **Impact**: Counter entry persists in memory for the session lifetime. If a task's `taskId` is reused (unlikely in this system, but possible if `updateTaskStatus(..., 'CREATED')` is called externally), retry budget is incorrect.
- **Fix**: `delete this.retryCounters[worker.taskId]` in `handleWorkerCompletion` on success paths (lines 204 and 220).

### Issue 9: `parseUpdateConfigBody` rejects `null` body but `parseCreateBody` allows it

- **File**: `auto-pilot.controller.ts:203–204`, `auto-pilot.controller.ts:289–291`
- **Scenario**: `PATCH /api/sessions/:id/config` called with no body (common during testing)
- **Impact**: `parseUpdateConfigBody` throws `BadRequestException('Request body must be a JSON object')` for a null body, while `parseCreateBody` returns `{}` for null. Inconsistent handling between the two endpoints.
- **Fix**: Either both should accept a null/empty body as an empty patch, or both should reject it. For PATCH, accepting null as "no changes" (returning 200 with current config) is the more REST-idiomatic behavior.

---

## Data Flow Analysis

```
POST /api/sessions
  → AutoPilotController.createSession()
      → parseCreateBody()                  [validates input; taskIds DROPPED here]
      → AutoPilotService.createSession()
          → maps camelCase → snake_case
          → SessionManagerService.createSession()
              → supervisorDb.isAvailable()
              → merges with DEFAULT_SUPERVISOR_CONFIG
              → supervisorDb.createSession()   [DB INSERT; COLLISION RISK at same-second]
              → new SessionRunner(...)
              → runner.start()
                  → supervisorDb.logEvent()
                  → setInterval(tick, poll_interval_ms)
                  → tick() [immediate]
              → runners.set(sessionId, runner)
              → returns sessionId
          → returns { sessionId, status: 'starting' }

tick() per session:
  → supervisorDb.updateHeartbeat(sessionId)
  → supervisorDb.getActiveWorkers(sessionId)  [session-scoped: SAFE]
  → processWorkerHealth()
      → handleWorkerCompletion() or handleStuckWorker()
  → supervisorDb.getDrainRequested(sessionId)
  → supervisorDb.getTaskCandidates()          [GLOBAL query, not session-scoped]
  → selectSpawnCandidates()
  → spawnForCandidate()
      → supervisorDb.claimTask(taskId, sessionId)  [atomic UPDATE with WHERE check: SAFE]
      → workerManager.spawnWorker()
  → checkTermination()
      → supervisorDb.getTaskCountsByStatus()   [GLOBAL: CROSS-SESSION BLEED]

stopLoop(reason):          [called from inside tick() for drain/limit/done]
  → sets loopStatus = 'stopped'
  → clears timer
  → supervisorDb.updateSessionStatus()
  → emitEvent()            [NO-OP: no delivery mechanism]
  → runners NOT removed    [LEAK: Map not updated]
```

### Gap Points:
1. `taskIds` dropped between controller parse and service dispatch
2. `getTaskCountsByStatus()` is global — cross-session contamination in `checkTermination`
3. Self-stopped sessions never removed from `runners` Map
4. `emitEvent` builds events but delivers to nowhere

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Multiple sessions can run concurrently with independent loops | COMPLETE | Architecturally correct |
| Each session's config can be changed via PATCH and takes effect on next tick | COMPLETE | `Object.assign` on `this.config` + timer restart for interval changes |
| Stopping one session does not affect other running sessions | COMPLETE | Per-session timers and counters are isolated |
| `GET /api/sessions` returns all active sessions with live status | PARTIAL | Returns sessions but includes stopped sessions that were self-terminated |
| TypeScript compiles clean with no regressions | ASSUMED | Not verified by this review |
| `supervisor.service.ts` deleted | COMPLETE | File is absent from the directory |
| Module wiring correct / `SupervisorService` removed | COMPLETE | `auto-pilot.module.ts` lists all correct providers |

### Implicit Requirements NOT Addressed:
1. `taskIds` filtering — accepted in the API contract but never implemented
2. Self-terminated sessions should auto-remove from the Map (drain, limit, all-done paths)
3. Pause/resume state conflict should return 409, not 500
4. Real-time event delivery (`emitEvent` is a no-op)

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Same-second session creation | NO | `buildSessionId` is seconds-only | SQLite UNIQUE error bubbles as 400 with raw message |
| Pause already-paused session | NO | `runner.pause()` throws, unhandled | 500 returned instead of 409 |
| Resume non-paused session | NO | `runner.resume()` throws, unhandled | 500 returned instead of 409 |
| Stop already-stopped session | PARTIAL | `runners.get()` returns runner but `stop()` is idempotent — `loopStatus` is already 'stopped', `clearTimer` is a no-op. No crash but no "not found" either. | Acceptable |
| Drain with zero active workers | HANDLED | `stopLoop` fires immediately | Correct |
| Worker spawn failure | HANDLED | Caught in `spawnForCandidate`, logged, task not marked failed | Task stays IN_PROGRESS in DB — could stall if spawn always fails |
| `taskIds` filter in create request | NOT HANDLED | Validated then dropped | Silent incorrect behavior |
| Concurrent sessions, shared task pool | PARTIAL | `claimTask` is atomic (WHERE clause). Candidate fetch is unscoped but claim is safe | Termination check uses global counts |
| Server shutdown with active sessions | HANDLED | `onModuleDestroy` stops all runners | Correct |
| Empty create body | HANDLED | Returns `{}`, merges with defaults | Correct |
| Empty PATCH config body | INCONSISTENT | Throws 400 (should return 200 no-op) | Minor |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| `sessionId` primary key collision | MED (concurrent API calls) | 400 with raw DB error | None — needs millisecond suffix |
| `pause()`/`resume()` state mismatch | MED (any retry or double-click) | 500 response | None — needs try/catch + 409 |
| `getTaskCountsByStatus()` cross-session | MED (multi-session deployment) | Premature termination or infinite idle | None — termination logic needs review |
| Self-terminated runner Map leak | HIGH (every non-manual stop) | Memory growth, stale `listSessions` | None — needs `onStopped` callback |
| `emitEvent` no-op | HIGH (always) | No real-time events | Intentional deferral — needs doc |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Self-terminated sessions (drain-complete, limit-reached, all-tasks-done) are never removed from the `runners` Map. In any real workload, every session that runs to completion leaks. Combined with `taskIds` being silently ignored (the only session-scoping mechanism in the API), users have no reliable way to run scoped sessions, and long-running servers accumulate stopped ghost sessions in memory.

## What Robust Implementation Would Include

- Session IDs with millisecond precision or a random suffix to prevent PK collisions
- `onStopped` callback from `SessionRunner` to trigger Map cleanup in `SessionManagerService`
- `pauseSession` / `resumeSession` in `SessionManagerService` wrapped in try/catch, re-thrown as typed errors mapped to HTTP 409
- `taskIds` filter either implemented end-to-end in `getTaskCandidates` or explicitly rejected at the controller with a clear error
- `checkTermination` documenting that its termination heuristic is per-session-candidates, not global, to prevent future confusion
- A note on `emitEvent` that WebSocket delivery is not yet wired
- `retryCounters[taskId]` cleared on successful task completion
- Consistent null-body handling between `parseCreateBody` and `parseUpdateConfigBody`
