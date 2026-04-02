# Code Style Review — TASK_2026_244

## Overall Score: 7/10

## Assessment

The implementation is functionally sound and the design decision to use a callback pattern
(matching `onStopped`) rather than direct gateway injection into `SessionRunner` is correct.
Module wiring is complete, NestJS decorators are used properly, and the `supervisor_model` field
threads cleanly through types → model → controller → service. The score is held at 7 rather than
higher by two overlapping concerns: a pre-existing file size violation that this task grew further,
a duplicated validation block that will drift, and a null-guard placement that deserves scrutiny.
None of these are blocking but the duplication is serious.

---

## Findings

### [SERIOUS] auto-pilot.controller.ts — `parseCreateBody` and `parseUpdateConfigBody` are nearly
identical; adding `supervisorModel` to both doubled the maintenance surface

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:216–362`
- **Problem**: The two private parse methods share ~120 lines of identical logic (provider
  validation, model string validation, priority validation, retries validation). The only
  difference is that `parseUpdateConfigBody` also validates `pollIntervalMs`. Adding
  `supervisorModel` to both methods in this task means there are now three places in the file
  that list the string-model fields (`prepModel`, `implementModel`, `implementFallbackModel`,
  `reviewModel`, `supervisorModel`) — lines 254, 324, and the const-array at the top of the
  controller. If a new model field is added in the future, all three must be updated in sync.
  The existing codebase already defined a `VALID_PROVIDERS` set and `VALID_PRIORITIES` set at
  module scope; the string-model key list should follow the same pattern.
- **Impact**: Six-month risk — the next provider/model addition will likely update one parse
  method but miss the other.
- **Fix**: Extract the shared validation logic into a single private `parseSharedConfigFields`
  helper and call it from both parse methods. The shared constant for model keys should also
  live at module scope next to `VALID_PROVIDERS`.

---

### [SERIOUS] auto-pilot.controller.ts — file is 363 lines, exceeds the 300-line service limit

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:1–363`
- **Problem**: The project anti-patterns rule states files over 300 lines signal a missing
  abstraction. Controllers are expected to stay leaner than services; the 363-line count is
  almost entirely the two parse methods and their duplicated validation logic. This task
  added ~10 lines but the underlying structural problem already existed. Noting it because
  the `supervisorModel` addition is a forcing function for the split.
- **Impact**: Continued growth on every new config field will push this file further past limits.
- **Fix**: Extract `parseCreateBody` and `parseUpdateConfigBody` into a dedicated
  `session-config.parser.ts` util. The controller becomes a thin HTTP adapter.

---

### [MINOR] session-runner.ts — `onEvent` is placed outside the try/catch in `emitEvent`,
but the decision is undocumented inline

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:551–554`
- **Problem**: The handoff.md correctly explains the rationale ("broadcast errors don't silently
  swallow debug logs"), but there is no comment at the call site. The only code comment in
  `emitEvent` is `/* best effort */` on the logger stringify, which is unrelated. A future
  developer seeing `this.onEvent?.(event)` outside the try/catch will not know whether this is
  intentional or a copy/paste error.
- **Impact**: Low immediate risk. Medium future-maintenance confusion.
- **Fix**: Add a one-line comment above `this.onEvent?.(event)`: `// Intentionally outside
  try/catch — onEvent errors must not suppress the preceding log.`

---

### [MINOR] dashboard.gateway.ts — `handleJoinSession` and `handleLeaveSession` silently
ignore malformed payloads; no log, no response

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:83–112`
- **Problem**: Both handlers validate `data` with an `if` block. If the payload is missing or
  malformed, the handlers return without joining/leaving the room AND without any log or
  acknowledgment to the client. The client has no way to know the join failed, which could
  cause it to wait for `supervisor-event` messages that will never arrive on a session room.
- **Impact**: Debugging session connectivity issues will be difficult because there is no signal
  on either side.
- **Fix**: Add an `else` branch that logs a warning and, optionally, emits an error
  acknowledgment back to the client (`client.emit('error', { message: '...' })`).

---

### [MINOR] dashboard.gateway.ts — `@UseGuards(WsAuthGuard)` on `join-session`/`leave-session`
is inconsistent with the known local-only use case documented in the handoff

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:78, 96`
- **Problem**: The handoff explicitly notes "WsAuthGuard on handleConnection but not on
  join-session/leave-session handlers — clients can join rooms without authentication
  (acceptable for local dashboard use case)." The implemented code actually DOES apply
  `@UseGuards(WsAuthGuard)` to both handlers. This is inconsistent with the handoff's decision
  record. It may be intentional (the author changed their mind) but is undocumented in the
  code.
- **Impact**: Minor — if the guard is permissive for local use it has no user-visible effect;
  if the auth requirement tightens later, the discrepancy will cause confusion about whether
  auth was always required for room joins.
- **Fix**: Update the handoff decision record to reflect the final implementation, or remove the
  guards if the original intent was to allow unauthenticated room joins.

---

### [MINOR] session-runner.ts — file is 556 lines, well above the 300-line anti-pattern limit

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:1–556`
- **Problem**: This is a pre-existing condition; this task added approximately 15 lines
  (onEvent field, parameter, heartbeat emit). The file has clear section delimiters (Public API,
  Core loop, Worker health, Candidate selection, Spawn workers, Termination, Shutdown, Event
  emission) which are a signal that extraction is already possible per the general review
  lessons rule. Not blocking for this task since the additions are minimal, but the structural
  debt grows.
- **Fix**: Track for next refactor: `SessionRunnerWorkerHandler`, `SessionRunnerScheduler`, and
  `SessionRunnerEventEmitter` are obvious extraction candidates.

---

### [MINOR] auto-pilot.types.ts — `SupervisorState` interface (lines 98–107) does not include
`supervisor_model` despite being a snapshot of `SupervisorConfig`

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:98–107`
- **Problem**: `SupervisorState` holds `config: SupervisorConfig`, so the field is transitively
  present. However, the interface was not updated when `supervisor_model` was added to
  `SupervisorConfig`. If `SupervisorState` is ever serialized independently (e.g., for
  persistence or debugging), the shape will be correct, but if a future refactor separates the
  flattened fields, the omission will cause a gap.
- **Impact**: Low — field is covered by the nested `config`. Document or ignore.
- **Fix**: No immediate change required, but add a comment: `// config field is the canonical
  source; flat fields here are a subset for convenience.`

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The duplicated validation blocks in `auto-pilot.controller.ts` are the clearest 6-month risk.
When a new model field (`coding_model`, `audit_model`) is added to `SupervisorConfig`, the
developer will add it to `parseCreateBody` and may not notice the identical block in
`parseUpdateConfigBody`. The resulting gap means users can set the field at session creation
but cannot update it live — a silent capability regression with no compile error. Location:
lines 254 and 324 of `auto-pilot.controller.ts`.

### 2. What would confuse a new team member?

The `onEvent` callback placement outside the try/catch in `session-runner.ts:554` will look
like a bug to anyone reading the file for the first time. Combined with the `/* best effort */`
comment on the logger (which IS in the try block), a reader will assume the outer placement is
accidental and "fix" it by moving it inside — introducing the bug the original author was
avoiding.

### 3. What's the hidden complexity cost?

`DashboardModule` is now imported in both `AppModule` and `AutoPilotModule`. NestJS deduplicates
module instances, so this is not a runtime problem. However, it creates an implicit dependency
graph where `AutoPilotModule` can use any provider exported by `DashboardModule`, not just
`DashboardGateway`. This makes the coupling harder to see. A future developer adding a service
to `DashboardModule`'s providers list (but not exports) will not understand why auto-pilot
injection suddenly fails.

### 4. What pattern inconsistencies exist?

`VALID_PROVIDERS` and `VALID_PRIORITIES` are module-scope constants in `auto-pilot.controller.ts`
(lines 38–39). The string-model field list used in the `for...of` loops (lines 254, 324) is an
inline `as const` array defined inside each method. These should follow the same extraction
pattern as the other constants. The inconsistency is small but becomes compounding when fields
are added.

### 5. What would I do differently?

Extract the shared parse logic from the two controller methods into a single
`parseSessionConfigFields(body)` helper that returns a `Partial<CreateSessionRequest>`. The
field key list becomes one module-scope constant. `parseCreateBody` and `parseUpdateConfigBody`
call the helper and then apply their own method-specific rules (`pollIntervalMs` only in
update). This removes the duplication in ~40 lines of code.

---

## Pattern Compliance

| Pattern                        | Status | Concern                                                    |
|-------------------------------|--------|------------------------------------------------------------|
| NestJS Injectable / decorators | PASS   | All services properly decorated                            |
| Module wiring                  | PASS   | DashboardModule imported, DashboardGateway exported        |
| WebSocket decorators           | PASS   | SubscribeMessage, ConnectedSocket, MessageBody used        |
| TypeScript — no `any`          | PASS   | `unknown` used at boundaries, type guards applied          |
| TypeScript — no `as` casts     | MINOR  | Lines 90, 110 in gateway use cast after guard; acceptable  |
| Explicit access modifiers      | PASS   | All members carry public/private                           |
| Error handling                 | MINOR  | Silent ignore on malformed join/leave payloads             |
| File size limits               | FAIL   | session-runner.ts (556), auto-pilot.controller.ts (363)    |
| Circular dependency avoidance  | PASS   | DashboardModule does not import AutoPilotModule            |
| Null guards                    | PASS   | `if (!this.server) return` guards emitSupervisorEvent      |
| Timer cleanup                  | PASS   | clearTimer in stopLoop, cortexPollInterval in onModuleDestroy |

---

## Technical Debt Assessment

**Introduced**: The `supervisorModel` addition to both parse methods grows the duplication
footprint. The controller is now 363 lines and will hit 400+ on the next config field addition.

**Mitigated**: None — this task added behavior without refactoring the existing duplication.

**Net Impact**: Slightly negative. The feature is correct, but the structural debt in the
controller accelerates.

---

## Verdict

**APPROVED_WITH_NOTES**

The implementation is correct, the design choices are sound, and there are no blocking issues.
The two serious findings (duplicated validation, file size) are pre-existing structural problems
that this task grew incrementally — they should be addressed in a dedicated refactor task before
the next config field is added, not as a prerequisite for merging this one.

The `onEvent` call-site comment (minor) should be added before merge since it costs one line
and prevents a future developer from introducing a regression.
