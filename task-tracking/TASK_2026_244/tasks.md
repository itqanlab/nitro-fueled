# Development Tasks — TASK_2026_244
# Wire Supervisor Events to WebSocket Gateway

**Total Tasks**: 9 | **Batches**: 3 | **Status**: 0/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED WITH RISKS

### Assumptions Verified

- `SupervisorConfig` interface at `auto-pilot.types.ts:17` — VERIFIED
- `DEFAULT_SUPERVISOR_CONFIG` at `auto-pilot.types.ts:43` — VERIFIED
- `CreateSessionRequest` and `UpdateSessionConfigRequest` in `auto-pilot.model.ts` — VERIFIED; `retries` is the last field in both
- `UpdateConfigRequest` Partial Pick at `auto-pilot.types.ts:143` — VERIFIED; must include `supervisor_model` in the Pick keys (plan type summary confirms this)
- `DashboardGateway` provided but NOT exported from `DashboardModule` — VERIFIED at `dashboard.module.ts:49`
- `AutoPilotModule` has no `imports` array — VERIFIED at `auto-pilot.module.ts:9`
- `SessionRunner` constructor uses `onStopped` callback pattern — VERIFIED at `session-runner.ts:37-47`
- `emitEvent` builds full `SupervisorEvent` but only logs — VERIFIED at `session-runner.ts:540-549`
- `tick()` calls `supervisorDb.updateHeartbeat` at line 149 — VERIFIED
- `DashboardGateway` has `server: Server` (private) and `broadcastEvent` (private) — VERIFIED at `dashboard.gateway.ts:27,117`
- `auto-pilot.service.ts` mapping pattern for `reviewModel` → `review_model` — VERIFIED at lines 45 and 101
- `auto-pilot.controller.ts` string validation pattern for model fields — VERIFIED at `parseCreateBody` line 254-261

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Orchestrator summary omitted `auto-pilot.service.ts` (Component 3 from plan) | HIGH | Included as Task 2.3 — maps `supervisorModel` → `supervisor_model` in both create and update paths |
| `UpdateConfigRequest` Pick type must also include `supervisor_model` | MED | Task 1.1 explicitly includes the `UpdateConfigRequest` Pick extension per plan type summary |
| `emitSupervisorEvent` receives only `event: SupervisorEvent` (plan spec) but architect summary added `sessionId: string` as second param | LOW | Follow plan spec — `event.sessionId` is already present on the event object; no second param needed |

---

## Batch 1: Foundation Types and Module Wiring IN PROGRESS

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: None

### Task 1.1: Add `supervisor_model` to `SupervisorConfig`, `DEFAULT_SUPERVISOR_CONFIG`, and `UpdateConfigRequest` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`
**Spec Reference**: plan.md — Component 1, Type Changes Summary
**Pattern to Follow**: `review_model` field at line 27 / `review_model` default at line 53

**Quality Requirements**:
- Add `supervisor_model: string` to `SupervisorConfig` after `review_model` (line 27)
- Add `supervisor_model: 'claude-haiku-4-5-20251001'` to `DEFAULT_SUPERVISOR_CONFIG` after `review_model` default
- Add `| 'supervisor_model'` to the `UpdateConfigRequest` Partial Pick union at line 143 (after `'review_model'`)
- No other changes — `SupervisorEvent` interface at line 184 is already correct

**Implementation Details**:
- `SupervisorConfig` is a plain `interface` — add field directly
- `DEFAULT_SUPERVISOR_CONFIG` is a `const` object — add key-value entry
- `UpdateConfigRequest` uses `Partial<Pick<SupervisorConfig, ...>>` — add the string literal to the union

---

### Task 1.2: Add `supervisorModel` to `CreateSessionRequest` and `UpdateSessionConfigRequest` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts`
**Spec Reference**: plan.md — Component 2
**Pattern to Follow**: `reviewModel?: string` at line 30 / line 53

**Quality Requirements**:
- Add `readonly supervisorModel?: string;` to `CreateSessionRequest` after `retries?: number` (line 30)
- Add `readonly supervisorModel?: string;` to `UpdateSessionConfigRequest` after `retries?: number` (line 54)
- All fields are `readonly` — maintain the convention

**Implementation Details**:
- Both interfaces use camelCase for HTTP API layer — `supervisorModel` matches the pattern
- No imports needed — `string` is a primitive

---

### Task 1.3: Export `DashboardGateway` from `DashboardModule` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/dashboard.module.ts`
**Spec Reference**: plan.md — Component 5, Module Wiring section
**Pattern to Follow**: Existing exports array at line 49

**Quality Requirements**:
- Add `DashboardGateway` to the `exports` array at line 49
- `DashboardGateway` is already in `providers` (line 35) — no new provider entry needed
- No new imports needed — `DashboardGateway` is already imported at line 10

**Implementation Details**:
- Append `DashboardGateway` to the existing exports array
- This is a one-character change conceptually — add the symbol to the array

---

### Task 1.4: Add `DashboardModule` import to `AutoPilotModule` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts`
**Spec Reference**: plan.md — Component 6, Module Wiring section
**Pattern to Follow**: plan.md exact change block

**Quality Requirements**:
- Add `import { DashboardModule } from '../dashboard/dashboard.module';` at the top of the file
- Add `imports: [DashboardModule],` to the `@Module` decorator before `controllers`
- No circular dependency risk — both modules are siblings under `AppModule`

**Implementation Details**:
- `AutoPilotModule` currently has no `imports` key — add it as the first key in the `@Module({})` options object

---

**Batch 1 Verification**:
- All 4 files exist and modified correctly
- `npx nx build dashboard-api` passes with no TypeScript errors
- nitro-code-logic-reviewer approved

---

## Batch 2: Core Logic — Runner, Gateway, Service PENDING

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: Batch 1 complete

### Task 2.1: Wire `onEvent` callback into `SessionRunner` and add heartbeat emit IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/session-runner.ts`
**Spec Reference**: plan.md — Component 8
**Pattern to Follow**: `onStopped` callback pattern at `session-runner.ts:35-47`

**Quality Requirements**:
- Add private field `private readonly onEvent?: (event: SupervisorEvent) => void;` after `onStopped` field (line 35)
- Add `onEvent?: (event: SupervisorEvent) => void` as 7th (final) optional parameter to constructor
- Assign `this.onEvent = onEvent;` in constructor body after `this.onStopped = onStopped;`
- Update `emitEvent` (line 540): add `this.onEvent?.(event);` AFTER the try/catch block — NOT inside it
- Add `this.emitEvent('supervisor:heartbeat', { loopStatus: this.loopStatus });` in `tick()` after `this.supervisorDb.updateHeartbeat(this.sessionId);` (line 149)
- `SessionRunner` must remain a plain class — no `@Injectable`, no NestJS module references

**Validation Notes**:
- `SupervisorEvent` type is already imported at line 19 — no new import needed
- The `onEvent` call must be outside the try/catch to avoid swallowing broadcast errors

**Implementation Details**:
- Constructor signature: `onStopped` stays as 6th param; `onEvent` is 7th
- `emitEvent` current structure: builds event, try/catch logs it, then falls through — add `this.onEvent?.(event)` at the end
- Heartbeat is guarded by `if (this.loopStatus !== 'running') return;` at line 144 — no additional guard needed

---

### Task 2.2: Add `emitSupervisorEvent`, `handleJoinSession`, `handleLeaveSession` to `DashboardGateway` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/dashboard.gateway.ts`
**Spec Reference**: plan.md — Component 4
**Pattern to Follow**: `broadcastEvent` at `dashboard.gateway.ts:117-123`; `handleConnection` with `@UseGuards(WsAuthGuard)` at line 53

**Quality Requirements**:
- Add `SubscribeMessage`, `MessageBody`, `ConnectedSocket` to NestJS websockets imports
- Add `import type { SupervisorEvent } from '../auto-pilot/auto-pilot.types';`
- Add `handleJoinSession` decorated with `@UseGuards(WsAuthGuard)` and `@SubscribeMessage('join-session')`
- Add `handleLeaveSession` decorated with `@UseGuards(WsAuthGuard)` and `@SubscribeMessage('leave-session')`
- Add `emitSupervisorEvent(event: SupervisorEvent): void` public method that guards `if (!this.server)` before `this.server.to(event.sessionId).emit('supervisor-event', event)`
- `broadcastEvent` remains private — no changes to existing methods

**Validation Notes**:
- `Socket` is already imported from `socket.io` at line 9
- `UseGuards` and `WsAuthGuard` are already imported at lines 8 and 15
- Room API: `client.join(roomName)` returns a Promise — use `void client.join(...)` to suppress the floating promise

**Implementation Details**:
- `emitSupervisorEvent` signature: `public emitSupervisorEvent(event: SupervisorEvent): void`
- No second `sessionId` param — `event.sessionId` is on the event object
- Log format: `supervisor-event: ${event.type} → room ${event.sessionId}`

---

### Task 2.3: Map `supervisorModel` → `supervisor_model` in `AutoPilotService` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts`
**Spec Reference**: plan.md — Component 3
**Pattern to Follow**: `if (request.reviewModel !== undefined) config.review_model = request.reviewModel;` at line 45 / line 101

**Quality Requirements**:
- In `createSession`: add `if (request.supervisorModel !== undefined) config.supervisor_model = request.supervisorModel;` after the `reviewModel` mapping (line 45)
- In `updateSessionConfig`: add `if (request.supervisorModel !== undefined) patch.supervisor_model = request.supervisorModel;` after the `reviewModel` mapping (line 101)
- No new imports needed — types already available via existing imports

**Validation Notes**:
- `supervisor_model` is now valid on both `SupervisorConfig` (Task 1.1) and `UpdateConfigRequest` (Task 1.1 Pick extension) — Batch 1 must be complete first

**Implementation Details**:
- Two additions, one in each mapping block, each one line

---

**Batch 2 Verification**:
- All 3 files exist and modified correctly
- `npx nx build dashboard-api` passes with no TypeScript errors
- nitro-code-logic-reviewer approved

---

## Batch 3: Integration — SessionManager Wires Gateway to Runner PENDING

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: Batch 1 + Batch 2 complete

### Task 3.1: Inject `DashboardGateway` into `SessionManagerService` and pass `onEvent` callback IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/session-manager.service.ts`
**Spec Reference**: plan.md — Component 7
**Pattern to Follow**: `onStopped` callback at `session-manager.service.ts:70`; constructor injection at line 27

**Quality Requirements**:
- Add `import { DashboardGateway } from '../dashboard/dashboard.gateway';` to imports
- Add `import type { SupervisorEvent } from './auto-pilot.types';` to imports
- Add `private readonly dashboardGateway: DashboardGateway` as 4th constructor parameter
- In `createSession`: build `onEvent` callback before constructing `SessionRunner`
- Pass `onEvent` as 7th argument to `new SessionRunner(...)` after the `onStopped` lambda
- `onStopped` callback (`(id) => this.runners.delete(id)`) must remain unchanged as 6th argument

**Validation Notes**:
- `DashboardGateway` is now injectable because: (a) it is exported from `DashboardModule` (Task 1.3) and (b) `AutoPilotModule` imports `DashboardModule` (Task 1.4) — both Batch 1 tasks must be complete
- `SessionRunner` constructor now accepts `onEvent` as 7th param (Task 2.1) — Batch 2 must be complete

**Implementation Details**:
- Callback shape: `(event: SupervisorEvent): void => { this.dashboardGateway.emitSupervisorEvent(event); }`
- Constructor injection: NestJS will resolve `DashboardGateway` via the imported `DashboardModule`

---

### Task 3.2: Add `supervisorModel` validation to `auto-pilot.controller.ts` IMPLEMENTED

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts`
**Spec Reference**: plan.md — Component 2 (controller validation layer)
**Pattern to Follow**: `reviewModel` string validation block at `parseCreateBody:254-260`

**Quality Requirements**:
- In `parseCreateBody`: add `supervisorModel` to the model-string-validation loop at line 254 — add `'supervisorModel'` to the `for...of` array alongside `'reviewModel'`
- In `parseUpdateConfigBody`: apply the same addition to the parallel loop in that method
- Validation rule: must be a string (same as all other model fields — non-empty check is not enforced elsewhere, maintain consistency)

**Validation Notes**:
- Controller validation is the outermost guard; it must accept `supervisorModel` before the service can map it
- Adding to the existing `for...of` loop is safer than adding a separate `if` block — it reuses the same error message format

**Implementation Details**:
- One change per method: add `'supervisorModel'` to the existing model-field array in `parseCreateBody` and `parseUpdateConfigBody`

---

**Batch 3 Verification**:
- All 2 files exist and modified correctly
- `npx nx build dashboard-api` passes with no TypeScript errors
- End-to-end: `DashboardGateway` is resolvable in `SessionManagerService` via DI
- nitro-code-logic-reviewer approved

---

## File Index

| Task | File | Status |
|------|------|--------|
| 1.1 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` | IMPLEMENTED |
| 1.2 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` | IMPLEMENTED |
| 1.3 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/dashboard.module.ts` | IMPLEMENTED |
| 1.4 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` | IMPLEMENTED |
| 2.1 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/session-runner.ts` | IMPLEMENTED |
| 2.2 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/dashboard.gateway.ts` | IMPLEMENTED |
| 2.3 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` | IMPLEMENTED |
| 3.1 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/session-manager.service.ts` | IMPLEMENTED |
| 3.2 | `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` | IMPLEMENTED |
