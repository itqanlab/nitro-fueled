# Code Style Review — TASK_2026_204

## Summary

This refactor introduces a multi-session supervisor architecture across 7 files. The
overall structure is sound: clear layer separation (Runner → Manager → Service → Controller),
consistent NestJS patterns, and explicit access modifiers throughout. However several issues
warrant attention before this can be considered clean: a dead event-emission path in
`SessionRunner`, a destructive `as unknown as` cast in `SessionManagerService`, a name
collision between the two `SESSION_ID_RE`-pattern files, unexposed error propagation in
pause/resume actions, validation duplication between `parseCreateBody` and
`parseUpdateConfigBody`, and a file that already exceeds the 300-line anti-pattern limit.

The review is structured below by severity.

---

## Findings

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| 1 | BLOCKING | `session-runner.ts` | 534–543 | `emitEvent()` only logs to debug — WebSocket emission is never wired. Events are silently lost. |
| 2 | BLOCKING | `session-manager.service.ts` | 52–54 | `mergedConfig as unknown as Record<string, unknown>` double-cast bypasses type safety for DB write. |
| 3 | SERIOUS | `session-runner.ts` | 140–181 | `tick()` is async but drain-guard `return` (line 157) skips `isProcessing = false` — `finally` block handles it, but the early return inside `try` misses any code after the drain check. Silent lock held unnecessarily when workers are still active and drain is requested. |
| 4 | SERIOUS | `auto-pilot.controller.ts` | 134–156 | `pauseSession` and `resumeSession` return 404 when session exists but is in the wrong state. `SessionRunner.pause()`/`resume()` throw if state is wrong — those exceptions bubble to NestJS as 500, not 400. The controller does not catch the error from the runner. |
| 5 | SERIOUS | `auto-pilot.controller.ts` | 203–287 / 289–363 | `parseCreateBody` and `parseUpdateConfigBody` are nearly identical (~150 lines of duplicated validation). All shared field checks (providers, models, priority, retries, concurrency, limit) are copy-pasted verbatim. |
| 6 | SERIOUS | `session-runner.ts` | 1–545 | File is 545 lines — exceeds the 300-line anti-pattern limit. `spawnForCandidate` (lines 359–474) alone is 116 lines and handles routing, custom flow resolution, claiming, and spawning — four distinct concerns. |
| 7 | SERIOUS | `auto-pilot.controller.ts` | 36–39 | `TASK_ID_RE` and `MAX_TASK_IDS` are defined and used in `parseCreateBody` for `taskIds` validation, but `CreateSessionRequest` (in `auto-pilot.model.ts`) has no `taskIds` field. The parsed `taskIds` value is silently dropped when `result` is cast to `CreateSessionRequest`. |
| 8 | SERIOUS | `auto-pilot.service.ts` | 109–112 | After `updateSessionConfig` succeeds, the method calls `getRunner()` a second time. Between the two calls the runner could have been stopped and removed from the map, producing a `null` runner and returning `null` on an otherwise successful update. |
| 9 | MINOR | `auto-pilot.types.ts` | 143–157 | `UpdateConfigRequest` is defined as `Partial<Pick<SupervisorConfig, ...>>`. It omits `working_directory` deliberately (undocumented). A comment explaining the omission would prevent a future developer from assuming it was forgotten. |
| 10 | MINOR | `session-manager.service.ts` | 31–37 | `onModuleDestroy` iterates `this.runners` and calls `runner.stop()`, then `this.runners.clear()`. Stopping a runner that is already in state `stopped` will throw ("Session X is not running"). Should check `runner.getLoopStatus()` before calling stop, or use a no-op guard. |
| 11 | MINOR | `session-manager.service.ts` | 43 | `createSession` method signature: `config: Partial<SupervisorConfig> = {}`. Callers pass a camelCase `CreateSessionRequest` that was mapped to snake_case in `AutoPilotService`. The mapping is correct but the fact that `createSession` accepts the full `SupervisorConfig` shape (including `working_directory`) while callers never pass it is undocumented. |
| 12 | MINOR | `auto-pilot.controller.ts` | 37 | `TASK_ID_RE = /^TASK_\d{4}_\d{3}$/` — the real task ID format uses 3-digit suffixes (`TASK_2026_204`). This matches correctly for 3-digit IDs but would reject any future 4-digit IDs (`TASK_2026_1000`). The regex is too narrow. |
| 13 | MINOR | `session-runner.ts` | 259–276 | `handleStuckWorker` increments `stuckCounters[workerId]` on every tick. The counter is deleted after the kill (line 265). But if `killWorker` throws, the counter is not cleaned up and the deletion is skipped — the kill will not be retried on the next tick because `stuckCount` resets to 0 from scratch. |
| 14 | MINOR | `auto-pilot.module.ts` | 18 | `SessionManagerService` is exported from the module. Nothing outside `AutoPilotModule` should call `SessionManagerService` directly — the intended public surface is `AutoPilotService`. Exporting the manager leaks the internal implementation. |
| 15 | MINOR | `session-runner.ts` | 397–398 | `safeName` sanitizes `customFlow.name` by replacing `\r\n` (two-character literal) with a space and slicing to 80 chars. The intent is to strip CR and LF characters but `\r\n` as a string literal matches the literal two-character sequence `\r\n`, not individual carriage returns and newlines. The regex should be `/[\r\n]/g`. |

---

## Detail on Blocking Issues

### Issue 1 — `emitEvent()` is dead code (session-runner.ts:534–543)

The `emitEvent` method constructs a `SupervisorEvent` object and then only calls
`this.logger.debug(...)`. There is no WebSocket gateway, no EventEmitter, and no callback
injected into the runner. Every `emitEvent` call throughout the file — `supervisor:started`,
`worker:spawned`, `task:blocked`, etc. — produces no observable output outside the log. If
the dashboard relies on WebSocket events to display session status, this is a functional gap
masquerading as a style issue.

If event emission is deferred to a future task, the method should be documented as a stub
(with a TODO and task reference) rather than silently discarding the constructed event.

### Issue 2 — Double cast in `createSession` (session-manager.service.ts:52–54)

```typescript
this.supervisorDb.createSession(
  'dashboard-supervisor',
  mergedConfig as unknown as Record<string, unknown>,
  mergedConfig.limit,
);
```

`as unknown as X` is the TypeScript equivalent of a C-style reinterpret cast — it tells the
compiler "I know better, stop checking". If `SupervisorDbService.createSession` expects a
`Record<string, unknown>` parameter, `mergedConfig` should be directly assignable since all
`SupervisorConfig` values are primitives. Either the method signature is wrong and should
accept `SupervisorConfig | Record<string, unknown>`, or the cast is hiding a real type
mismatch. In either case this should not be left as `as unknown as`.

---

## Detail on Serious Issues

### Issue 3 — Drain guard early return holds `isProcessing` lock (session-runner.ts:140–181)

Inside `tick()` the drain path at line 151–157 calls `return` inside the `try` block. The
`isProcessing = false` is correctly reset in `finally`, so there is no actual lock leak.
However the pattern is fragile: any future extraction of the drain block into a helper that
does not share the `finally` scope would reintroduce the bug. The guard flag and drain check
deserve a comment explaining this dependency.

### Issue 4 — Wrong HTTP status for invalid state transitions (auto-pilot.controller.ts:134–156)

`pauseSession` delegates to `autoPilotService.pauseSession()` → `sessionManager.pauseSession()`
→ `runner.pause()`. `runner.pause()` throws `Error("Session X is not running")` when
`loopStatus !== 'running'`. This exception is not caught in the controller, so NestJS returns
HTTP 500 with an unformatted stack. A client calling `PATCH /api/sessions/:id/pause` on an
already-paused session receives a 500 instead of a 409 Conflict or 400 Bad Request. Same
applies to `resumeSession`.

### Issue 5 — Validation duplication (auto-pilot.controller.ts)

`parseCreateBody` (lines 203–287) and `parseUpdateConfigBody` (lines 289–363) share 6 of 7
validation blocks verbatim. The only difference is that `parseUpdateConfigBody` omits
`taskIds` and adds `pollIntervalMs`. The duplication is approximately 120 lines. A shared
`parseSharedConfigFields(body, result)` helper would eliminate the drift risk.

### Issue 6 — session-runner.ts exceeds file size limit

At 545 lines the file violates the 300-line rule in `.claude/anti-patterns.md`. The natural
split is `spawnForCandidate` (routing, custom-flow resolution, claiming, spawning) into a
`WorkerSpawner` helper class, and `applyPriorityStrategy` into a pure `candidateSelector`
utility. The handoff notes this as a known risk but it should be treated as a code debt item,
not a deferral.

### Issue 7 — `taskIds` parsed but silently dropped (auto-pilot.controller.ts:211–225)

`parseCreateBody` validates and populates `result['taskIds']`. The result is cast to
`CreateSessionRequest`. `CreateSessionRequest` (auto-pilot.model.ts line 18–31) has no
`taskIds` field. The parsed value is therefore cast away and never reaches
`SessionManagerService`. Either `CreateSessionRequest` is missing the field, or the
validation block should be removed.

### Issue 8 — TOCTOU in `updateSessionConfig` (auto-pilot.service.ts:109–112)

```typescript
const updated = this.sessionManager.updateSessionConfig(sessionId, patch);
if (!updated) return null;

const runner = this.sessionManager.getRunner(sessionId);  // second lookup
if (!runner) return null;
```

The runner is looked up twice. In a concurrent environment a `stopSession` call between the
two lookups leaves the config updated but returns null to the caller, who has no way to
retrieve the updated config. The `getRunner` call should be folded into `updateSessionConfig`
or the manager should return the updated config directly.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`emitEvent()` is a dead stub. When someone wires in the WebSocket gateway they will need to
find all 9 call sites in `session-runner.ts` and verify the event shapes are still correct.
The method signature accepts `Record<string, unknown>` which gives no type safety on the
payload — a payload key rename will not produce a compile error.

### 2. What would confuse a new team member?

`SupervisorConfig` uses `snake_case` field names (`prep_provider`, `poll_interval_ms`) while
all DTOs and request types use `camelCase`. The mapping is correctly handled in
`auto-pilot.service.ts` but the convention split is not documented. A developer who adds a
new config field to `SupervisorConfig` will not immediately know to add the mapping in
`createSession` and `updateSessionConfig` in `auto-pilot.service.ts` as well.

### 3. What's the hidden complexity cost?

No session limit is enforced. `createSession` has no guard on `this.runners.size`. A
misconfigured client or a buggy retry loop will create hundreds of `SessionRunner` instances,
each with its own `setInterval`. The anti-pattern file explicitly flags unbounded resource
accumulation. This is a concrete operational risk.

### 4. What pattern inconsistencies exist?

`SessionManagerService.stopSession()` does not check whether the runner is already stopped
before calling `runner.stop()`. `runner.stop()` delegates to `stopLoop()` which calls
`clearTimer()` — if the timer is already null this is safe. But `stopSession` also calls
`this.runners.delete(sessionId)` regardless of the runner's current state, which means a
session that was already stopped via internal termination is silently removed without the
caller receiving an informative response. The return value is `boolean` (found / not found),
not "was it running" vs "was already stopped".

### 5. What would I do differently?

- Extract `spawnForCandidate` routing logic into a `WorkerRoutingStrategy` class or a pure
  function module to bring `session-runner.ts` under 300 lines.
- Make `emitEvent` accept a typed callback/gateway interface at construction time rather than
  being a stub. Until the gateway exists, pass `null` and guard the call.
- Add a `MAX_SESSIONS` constant and throw in `createSession` when the limit is reached.
- Replace the `as unknown as Record<string, unknown>` cast with a proper overload or union
  type on `SupervisorDbService.createSession`.

---

## Pattern Compliance

| Pattern | Status | Concern |
|---------|--------|---------|
| Explicit access modifiers | PASS | All class members have `public`/`private`/`readonly` |
| No `any` types | PASS | No bare `any` found |
| No `as` type assertions | FAIL | `as unknown as Record<string, unknown>` in session-manager.service.ts:52 |
| NestJS decorators correct | PASS | `@Injectable`, `@Controller`, `@Module`, `OnModuleDestroy` all used correctly |
| File size limits | FAIL | session-runner.ts is 545 lines (limit: 300) |
| Error handling | PARTIAL | State-transition errors from runner bubble as 500; `emitEvent` catch block is `/* best effort */` which swallows |
| Logger usage | PASS | `Logger` instantiated with class/instance name consistently |
| Dead code | FAIL | `emitEvent` constructs event but never emits it |
| Import structure | PASS | NestJS → third-party → local, consistently |
| Validation at boundaries | PASS | Controller validates all inputs before delegating |

---

## Verdict

| Metric | Value |
|--------|-------|
| Overall Score | 5/10 |
| Blocking Issues | 2 |
| Serious Issues | 6 |
| Minor Issues | 7 |
| Files Reviewed | 7 |

| Verdict | FAIL |
|---------|------|

The architecture and NestJS layering are correct and the code is readable. The blocking issues
(dead event path, type-safety escape hatch) and the serious issues (wrong HTTP codes for state
errors, silent taskIds drop, file size breach, TOCTOU on config update) prevent this from
being production-ready without revision.

Priority fix order:
1. Issue 1 — either wire `emitEvent` or document it as a stub with a task reference.
2. Issue 2 — remove `as unknown as` cast.
3. Issue 4 — catch state-transition errors in the controller and return 409.
4. Issue 7 — add `taskIds` to `CreateSessionRequest` or remove the validation block.
5. Issue 5 — extract shared validation helper to eliminate duplication.
6. Issue 6 — split `session-runner.ts` to comply with the 300-line limit.
