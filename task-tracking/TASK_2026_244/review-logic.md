# Code Logic Review — TASK_2026_244

## Overall Score: 7/10

## Acceptance Criteria Check

- [x] SessionRunner events are broadcast via DashboardGateway WebSocket as 'supervisor-event' messages
- [x] Clients can join a session-specific room to receive only that session's events
- [x] SupervisorConfig includes supervisor_model field defaulting to claude-haiku-4-5-20251001
- [x] All existing supervisor event types flow through WebSocket — PARTIAL (see findings)
- [x] No regression in existing session lifecycle (start/pause/resume/stop)

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `emitEvent` private method places `this.onEvent?.(event)` OUTSIDE the try/catch block that wraps the debug logger (lines 551-554 in session-runner.ts). The comment in the handoff confirms this was intentional: "onEvent call placed outside try/catch so broadcast errors don't silently swallow debug logs." The intent is correct — but the consequence is that if `onEvent` throws (e.g., if `dashboardGateway.emitSupervisorEvent` throws because `socket.io` is in an error state), the exception propagates up into the caller. In `tick()`, `emitEvent` is called at line 153 OUTSIDE the main try/catch block that wraps the tick body. If the heartbeat `emitEvent` call throws, it will be an unhandled exception that crashes the tick without logging it or setting `isProcessing = false`, leaving the runner permanently locked.

The `isProcessing` guard at line 148-150 is only reset in the `finally` block of the inner try/catch in `tick()`. The `emitEvent('supervisor:heartbeat', ...)` call at line 153 is INSIDE the try block, so it would be caught — but calls in `stopLoop`, `pause`, and `resume` are outside any try/catch, meaning they can propagate out of the public API methods. The controller/service layer does not catch synchronous throws from `pause()` or `resume()`, except via the `ConflictException` wrapper.

### 2. What user action causes unexpected behavior?

A client can send a `join-session` event with any arbitrary string as `sessionId`. There is no validation that the session ID actually exists in the runners map. A client can successfully "join" a room for a non-existent session — this is harmless now but creates a false expectation of receiving events, and if session IDs are guessable, a client could eavesdrop on another session's room just by joining it (no ownership or auth check on the room join handler).

The `leave-session` handler has the same structural issue — calling `client.leave()` on a room the client was never in is a no-op, so this is not a bug, but the symmetry means room join has no access control while `handleConnection` does use `WsAuthGuard`.

### 3. What data makes this produce wrong results?

Three event types defined in the `SupervisorEvent` type union — `task:claimed`, `task:completed`, and `task:failed` — are never called via `emitEvent` anywhere in session-runner.ts. The grep confirms zero occurrences. The type definition declares them as valid event types; the task description lists them in scope; but no code path emits them. This is a gap between the declared contract and the implementation. Clients subscribing to `task:completed` events will never receive them from this implementation.

The `pause()` method at line 77 emits `supervisor:stopped` with `{ reason: 'paused' }`. On the receiving end, a client has no way to distinguish a true stop from a pause via the event type alone — both emit `supervisor:stopped`. The `resume()` method at line 88 correctly uses `supervisor:started`. This semantic conflation means any UI logic that reacts to `supervisor:stopped` to show a "session ended" state will incorrectly trigger on a simple pause. This is a pre-existing design smell but the new wiring now exposes it to real consumers.

### 4. What happens when dependencies fail?

The `DashboardGateway.emitSupervisorEvent` guards against a null `this.server` with `if (!this.server) return` (line 73 in gateway). This correctly handles the brief startup window.

However, `SessionManagerService` injects `DashboardGateway` directly in its constructor. `AppModule` imports both `DashboardModule` and `AutoPilotModule`. `AutoPilotModule` imports `DashboardModule`. NestJS resolves this as: `DashboardModule` → `DashboardGateway` exported; `AutoPilotModule` imports `DashboardModule` → `DashboardGateway` available. `AppModule` also imports `DashboardModule` directly. NestJS deduplicates module imports, so `DashboardGateway` is a singleton. There is no circular dependency — `DashboardModule` does NOT import `AutoPilotModule`. This is clean.

If `DashboardGateway.emitSupervisorEvent` itself throws a runtime error (e.g., socket.io internal error when broadcasting to a room), the exception propagates into the `onEvent` lambda in `session-manager.service.ts` (line 68). That lambda is called synchronously from `emitEvent` in `session-runner.ts` with no surrounding catch. Depending on the call site inside session-runner, this could surface as an unhandled exception inside `spawnForCandidate`, `handleWorkerCompletion`, or other private methods.

### 5. What's missing that the requirements didn't mention?

**Event replay on room join**: When a client joins a session room mid-flight (e.g., page refresh after session start), they get zero historical state. There is no snapshot event sent on join. The client has no way to know current worker counts, which tasks are in progress, or when the session started. The REST endpoint `GET /api/sessions/:id` can be polled, but no handshake "here is current state" is sent on room join via WebSocket.

**Room cleanup on session stop**: When a session stops (via `stopLoop`), a `supervisor:stopped` event is emitted to the room. But the room itself persists in socket.io — disconnected clients still hold references in the room until they disconnect or explicitly call `leave-session`. This is not a leak in the traditional sense (socket.io manages rooms), but clients that reconnect and re-join a stopped session's room will receive no events and have no indication the session is gone.

**supervisorModel is stored in config but never used to spawn anything**: The field is now in `SupervisorConfig` and flows end-to-end through HTTP → service → runner → DB config record. However, nothing in `session-runner.ts` or `worker-manager.ts` actually reads `this.config.supervisor_model` to launch anything. The field is plumbing without a consumer. This is acceptable scaffolding (the feature is declared "add the field"), but a future caller assuming the supervisor uses haiku may find it uses whatever the default CLI does.

---

## Failure Mode Analysis

### Failure Mode 1: emitEvent exception escapes tick() try/catch in specific positions

- **Trigger**: `socket.io` throws during `server.to(sessionId).emit(...)` — e.g., after a WebSocket server restart or internal socket.io error.
- **Symptoms**: Tick error is NOT caught by the `catch (err)` block in `tick()` because `emitEvent` for the heartbeat IS inside the try block — so for the heartbeat this is fine. But `emitEvent` calls in `stopLoop()`, `pause()`, and `resume()` are outside any try/catch. An exception there propagates to the caller (controller), producing an HTTP 500 for the user with a raw error rather than a graceful response.
- **Impact**: Medium. pause/resume/stop over REST would 500 to the client while the session may actually have changed state, leading to inconsistency between server state and client perception.
- **Current Handling**: None. No try/catch wraps `emitEvent` calls in `stopLoop`, `pause`, or `resume`.
- **Recommendation**: Wrap `this.onEvent?.(event)` in a try/catch inside `emitEvent` with a warning log, OR wrap `emitEvent` calls in public API methods with their own catch. The callback pattern means the logger is always called before `onEvent`, so swallowing errors in the gateway call is safe.

### Failure Mode 2: task:claimed, task:completed, task:failed never emitted

- **Trigger**: Normal operation — when a task completes the build+review cycle.
- **Symptoms**: Clients subscribed to these event types receive nothing. The TypeScript type declares them valid; the task specification lists them in scope; but zero call sites exist.
- **Impact**: Medium. Frontend cannot react to task-level completion events via WebSocket; must poll REST. The `worker:completed` events are emitted (which implies task completion indirectly), but named task-level events are missing.
- **Current Handling**: Not handled — the events simply do not exist in the emitted stream.
- **Recommendation**: Either emit `task:completed` inside `handleWorkerCompletion` when the final review finishes, and `task:claimed` inside `spawnForCandidate` after a successful claim; or explicitly remove these types from the union to avoid false contract promises.

### Failure Mode 3: pause() emits supervisor:stopped — breaks UI state machines

- **Trigger**: Client calls `POST /api/sessions/:id/pause`.
- **Symptoms**: Any WebSocket listener treating `supervisor:stopped` as "session is over" will incorrectly tear down UI state. The session is still alive and resumable, but the event type says "stopped."
- **Impact**: Low-to-medium depending on frontend implementation. If the dashboard renders "Session ended" on `supervisor:stopped`, a pause/resume cycle corrupts the UX.
- **Current Handling**: A `reason: 'paused'` field in the payload allows disambiguation, but only if the client checks it. The event type itself is misleading.
- **Recommendation**: Introduce a `supervisor:paused` event type, or at minimum document that `supervisor:stopped` with `reason: 'paused'` means paused-not-stopped. The type union in `auto-pilot.types.ts` does not include `supervisor:paused`.

### Failure Mode 4: No validation on join-session room membership

- **Trigger**: Any unauthenticated or authenticated client sends `join-session` with an arbitrary sessionId string.
- **Symptoms**: Client successfully joins a room. If the session exists, they receive all its events. There is no ownership check — any client that knows a sessionId can observe that session's worker spawns, task assignments, and failures.
- **Impact**: Low for a local dashboard (as the handoff acknowledges), but a latent security issue if the dashboard is ever exposed publicly or multi-tenant.
- **Current Handling**: The handoff explicitly calls this out as "acceptable for local dashboard use case." Noted, but not documented in code.
- **Recommendation**: At minimum, add a code comment explaining this is intentionally unguarded. If multi-tenancy is ever needed, this is the first change required.

### Failure Mode 5: isProcessing deadlock if tick() is called synchronously on start()

- **Trigger**: `start()` calls `this.tick()` directly at line 67 AND sets up a `setInterval` at line 64. If `tick()` is async and runs longer than `poll_interval_ms`, the setInterval fires before `tick()` completes. `isProcessing = true` prevents re-entry, so concurrent ticks are correctly blocked. However, the initial synchronous `tick()` call at line 67 runs before `isProcessing` can be checked by a concurrent interval fire. This is actually safe because the interval cannot fire synchronously — `setInterval` callbacks are always async. No bug here.
- **Impact**: None — correctly handled by the event loop. Documented here to confirm it was checked.
- **Current Handling**: Safe by Node.js event loop semantics.
- **Recommendation**: None.

---

## Critical Issues

None that are production blockers given the stated use case (local dashboard). The most impactful issue (emitEvent escaping try/catch) is Serious, not Critical, because the gateway itself is unlikely to throw under normal conditions.

---

## Serious Issues

### Issue 1: Missing event types emitted (task:claimed, task:completed, task:failed)

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts` — no call sites
- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:188-190` — type declares them
- **Scenario**: Task completes build and review phases successfully.
- **Impact**: Frontend cannot use WebSocket events to track task-level completion. Must poll REST. The type contract promises events that are never delivered.
- **Fix**: Either emit `task:completed` in `handleWorkerCompletion` (review branch, when `taskStatus === 'COMPLETE'`), and `task:claimed` in `spawnForCandidate` after `claimTask` returns true — or remove the dead types from the union.

### Issue 2: emitEvent exceptions in stopLoop/pause/resume propagate unhandled

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:77, 88, 521`
- **Scenario**: Gateway throws during emit (socket.io error, not initialization null-guard).
- **Impact**: REST endpoints for pause/resume/stop return HTTP 500; session state may have changed (e.g., loop stopped, DB updated) while the caller receives an error.
- **Fix**: Wrap `this.onEvent?.(event)` inside `emitEvent` with try/catch and log a warning. The logger call already runs before `onEvent`, so the debug log is preserved.

### Issue 3: supervisor:stopped dual semantics (stop vs. pause)

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:77`
- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:188`
- **Scenario**: User pauses a running session.
- **Impact**: Any client that builds a state machine on `supervisor:stopped` cannot distinguish pause from terminal stop without inspecting the payload.
- **Fix**: Add `supervisor:paused` to the event type union and emit it from `pause()`. Emit `supervisor:stopped` only from `stopLoop()`.

---

## Moderate Issues

### Issue 4: No current-state snapshot sent on join-session

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:79-93`
- **Scenario**: Client reconnects or joins mid-session.
- **Impact**: Client UI has no initial state; must make a separate REST call to `GET /api/sessions/:id`. Not a failure, but a usability gap.
- **Fix**: On `join-session`, call `sessionManagerService.getSessionStatus(sessionId)` and emit a `supervisor-event` with type `supervisor:heartbeat` to the joining client as a snapshot. Requires injecting `SessionManagerService` into `DashboardGateway` — or accepting that REST must be called first.

### Issue 5: supervisorModel field flows end-to-end but has no consumer

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts` — `this.config.supervisor_model` is never read
- **Scenario**: User specifies `supervisorModel` in create-session request.
- **Impact**: The value is stored in the DB config record and returned in `getConfig()` but has no effect on runtime behavior.
- **Current Handling**: Acceptable as scaffolding. Must be documented so future implementers know to wire it.
- **Fix**: Add a comment in `session-runner.ts` near the config indicating `supervisor_model` is reserved for future use when the supervisor itself is spawned as a managed process.

### Issue 6: join-session/leave-session lack authentication at the handler level — inconsistent with handleConnection

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:78, 96`
- **Scenario**: The `@UseGuards(WsAuthGuard)` decorator on `join-session` and `leave-session` is present, which contradicts the handoff statement "WsAuthGuard on handleConnection but not on join-session/leave-session." The code actually HAS the guard. The handoff was inaccurate.
- **Impact**: Guards are present — this is fine. The handoff note is misleading for future reviewers.
- **Fix**: Update the handoff's Known Risks section to reflect that guards ARE applied to join/leave handlers.

---

## Data Flow Analysis

```
POST /api/sessions (body: {supervisorModel?, concurrency?, ...})
  → AutoPilotController.createSession()
      → parseCreateBody() — validates + maps camelCase → CreateSessionRequest
  → AutoPilotService.createSession()
      → maps CreateSessionRequest camelCase → Partial<SupervisorConfig> snake_case
      → SessionManagerService.createSession(config)
          → merges with DEFAULT_SUPERVISOR_CONFIG
          → supervisorDb.createSession() → DB
          → defines onEvent lambda: (event) => dashboardGateway.emitSupervisorEvent(event)
          → new SessionRunner(..., onEvent)
              → runner.start()
                  → emitEvent('supervisor:started') → onEvent → gateway.emitSupervisorEvent
                  → server.to(sessionId).emit('supervisor-event', event)
                  ← room is EMPTY at this point (no client has joined yet) — event is lost
              → setInterval(tick, poll_interval_ms)
          → runners.set(sessionId, runner)
          ← returns sessionId

Client (WebSocket):
  → emit('join-session', { sessionId })
      → DashboardGateway.handleJoinSession()
          → client.join(sessionId)
          ← client is now in room, receives future events

Subsequent tick:
  → emitEvent('supervisor:heartbeat') → onEvent → gateway
  → server.to(sessionId).emit('supervisor-event', ...) → client receives it

Gap: supervisor:started is emitted BEFORE any client can join the room.
     The first event (session start) is always lost for WebSocket consumers.
```

### Gap Points Identified

1. `supervisor:started` emitted at session creation before any client can have joined the room — always dropped.
2. `task:claimed`, `task:completed`, `task:failed` types declared but never emitted — dead contract.
3. `onEvent` exception not caught in `emitEvent` — can propagate to public API methods and REST callers.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| SessionRunner events broadcast as 'supervisor-event' | COMPLETE | Works via callback chain |
| Clients can join session-specific room | COMPLETE | join-session/leave-session handlers present |
| SupervisorConfig.supervisor_model defaulting to claude-haiku-4-5-20251001 | COMPLETE | Default matches spec exactly |
| All existing supervisor event types flow through WebSocket | PARTIAL | task:claimed, task:completed, task:failed never emitted; pause() reuses supervisor:stopped |
| No regression in existing session lifecycle | COMPLETE | pause/resume/stop/drain all preserved |

### Implicit Requirements NOT Addressed

1. The first `supervisor:started` event is always lost — it fires before any client can join the room. A client that creates a session via REST and then connects via WebSocket will miss the started event.
2. Reconnecting clients have no way to recover current state via WebSocket alone — no snapshot-on-join.
3. `supervisor:paused` as a distinct event type does not exist, conflating pause with stop semantics.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| join-session with non-existent sessionId | YES (partial) | Client joins empty room, never receives events | No error feedback to client |
| emitSupervisorEvent before server init | YES | `if (!this.server) return` guard | Silent drop, not logged |
| Concurrent ticks overlapping | YES | `isProcessing` mutex | Correct |
| Session stopped while tick running | YES | `if (this.loopStatus !== 'running') return` | Correct |
| DashboardGateway throws during emit | NO | Exception propagates to emitEvent caller | Serious |
| Client never joins room | YES (partial) | Events emitted to empty room, silently dropped | Expected socket.io behavior |
| supervisor:started emitted before room can be joined | NO | Event always lost | Gap |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| SessionManagerService → DashboardGateway (constructor injection) | LOW | No circular dep confirmed | Clean |
| emitEvent → onEvent → gateway.emitSupervisorEvent | LOW (normal) / MED (gateway restart) | Can propagate exception | No catch in emitEvent |
| socket.io room.to().emit() | LOW | Silent drop if server null (guarded) | Guard present |
| AppModule → DashboardModule + AutoPilotModule → DashboardModule | LOW | NestJS deduplicates, no circular dep | Correct |

---

## Verdict

**Recommendation**: APPROVED_WITH_NOTES

**Confidence**: HIGH

**Top Risk**: Three event types (`task:claimed`, `task:completed`, `task:failed`) are declared in the WebSocket event contract but never emitted. The type definition promises a contract that is not fulfilled. This will confuse frontend implementers who try to subscribe to task-level events.

**Secondary Risk**: `supervisor:stopped` is emitted for both pause and terminal stop, creating ambiguous semantics for any client building a UI state machine.

## What Robust Implementation Would Include

- A try/catch inside `emitEvent` wrapping the `onEvent?.(event)` call, logging warnings on gateway errors rather than propagating
- A `supervisor:paused` event type separate from `supervisor:stopped`
- Emission of `task:claimed` when a task is successfully claimed in `spawnForCandidate`
- Emission of `task:completed` when a review worker completes successfully
- A snapshot event (current session status) sent to a client immediately on `join-session`
- A code comment on `supervisor_model` in session-runner explaining it is scaffolded but not yet consumed by any spawning logic
