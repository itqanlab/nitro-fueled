# Implementation Plan — TASK_2026_244
# Wire Supervisor Events to WebSocket Gateway

---

## Codebase Investigation Summary

### Files Analyzed

| File | Key Finding |
|------|-------------|
| `apps/dashboard-api/src/auto-pilot/session-runner.ts` | Plain class, `emitEvent` logs only (line 540-549). All call sites present, no broadcast. |
| `apps/dashboard-api/src/auto-pilot/session-manager.service.ts` | Creates `SessionRunner` at line 64. `onStopped` callback pattern already established (line 70). |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` | Does NOT import `DashboardModule`. `DashboardGateway` is invisible to `AutoPilotModule`. |
| `apps/dashboard-api/src/dashboard/dashboard.module.ts` | Provides `DashboardGateway` but does NOT export it (line 49). |
| `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` | Has `server: Server` (private, line 27). Has `broadcastEvent` (private, line 117). No room support. No supervisor event method. |
| `apps/dashboard-api/src/dashboard/dashboard.types.ts` | `DashboardEventType` union (line 238). Does NOT include supervisor event types. |
| `apps/dashboard-api/src/app/app.module.ts` | Imports both `DashboardModule` and `AutoPilotModule` as siblings (line 11). |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` | `SupervisorConfig` (line 17), `DEFAULT_SUPERVISOR_CONFIG` (line 43), `SupervisorEvent` (line 184). Missing `supervisor_model`. |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` | `CreateSessionRequest` (line 18), `UpdateSessionConfigRequest` (line 42). Missing `supervisorModel`. |

### Critical Cross-Module Dependency Problem

`DashboardModule` does not export `DashboardGateway`. `AutoPilotModule` does not import `DashboardModule`. Both are siblings under `AppModule`. To share `DashboardGateway` with `AutoPilotModule`, two changes are required:

1. Export `DashboardGateway` from `DashboardModule`
2. Import `DashboardModule` into `AutoPilotModule`

### Existing Callback Pattern (Evidence for Option A)

`SessionManagerService` already passes an `onStopped` callback to `SessionRunner`:

```
session-manager.service.ts:70 — (id) => this.runners.delete(id)
session-runner.ts:43 — onStopped?: (sessionId: string) => void
```

This is the exact pattern to follow for the broadcast callback.

### `emitEvent` Current State (Evidence for Gap)

`session-runner.ts:540-549` — `emitEvent` builds a complete `SupervisorEvent` object but only logs it. The broadcast call is missing. All event type call sites are present and correct.

### `DashboardEvent` Type Constraint

`dashboard.types.ts:238` — `DashboardEventType` is a closed union. Adding supervisor events requires extending this union OR using a separate WebSocket event name. Architecture decision: use a **separate event name** (`supervisor-event`) to avoid coupling the dashboard event pipeline to supervisor internals.

---

## Architecture Design

### Design Philosophy

**Callback injection** (Option A from task context). `SessionRunner` stays a plain class with zero NestJS dependency beyond `Logger`. `SessionManagerService` builds a broadcast callback from the injected `DashboardGateway` and passes it into the runner constructor.

**Room-scoped delivery**. Each session has a dedicated Socket.IO room named by `sessionId`. Clients join the room to receive events for that session. Global broadcast is not used for supervisor events (only the existing `dashboard-event` channel uses global broadcast).

**Separate WebSocket event name**. Supervisor events travel as `supervisor-event` on the socket, distinct from `dashboard-event`. This prevents type pollution of `DashboardEventType` and allows clients to independently subscribe to supervisor state.

---

## Component Specifications

---

### Component 1: `SupervisorConfig` — Add `supervisor_model`

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`

**Purpose**: Add the optional supervisor orchestration model field to config so it flows through the full session lifecycle.

**Evidence**: `auto-pilot.types.ts:17` — `SupervisorConfig` interface. `auto-pilot.types.ts:43` — `DEFAULT_SUPERVISOR_CONFIG`.

**Changes**:

Add `supervisor_model` field to `SupervisorConfig` interface after `review_model`:

```typescript
supervisor_model: string;
```

Add default value to `DEFAULT_SUPERVISOR_CONFIG`:

```typescript
supervisor_model: 'claude-haiku-4-5-20251001',
```

**Files Affected**:
- `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` (MODIFY)

---

### Component 2: `CreateSessionRequest` and `UpdateSessionConfigRequest` — Add `supervisorModel`

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts`

**Purpose**: Expose `supervisor_model` as an optional camelCase API field consistent with all other config fields in this file.

**Evidence**: `auto-pilot.model.ts:18` — `CreateSessionRequest`. `auto-pilot.model.ts:42` — `UpdateSessionConfigRequest`. Both follow the camelCase convention for HTTP API layer.

**Changes to `CreateSessionRequest`**:

Add after `retries?: number`:

```typescript
readonly supervisorModel?: string;
```

**Changes to `UpdateSessionConfigRequest`**:

Add after `retries?: number`:

```typescript
readonly supervisorModel?: string;
```

**Files Affected**:
- `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` (MODIFY)

---

### Component 3: `AutoPilotService` — Map `supervisorModel` to config

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts`

**Purpose**: The facade that maps HTTP model fields to `SupervisorConfig` snake_case keys. Must map `supervisorModel` → `supervisor_model` in both create and update paths.

**Investigation required**: Read `auto-pilot.service.ts` to find the mapping code. The mapping is expected to follow the same pattern as existing fields (e.g., `prepProvider` → `prep_provider`).

**Pattern to apply**:

```typescript
if (req.supervisorModel !== undefined) config.supervisor_model = req.supervisorModel;
```

**Files Affected**:
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` (MODIFY)

---

### Component 4: `DashboardGateway` — Add Room Support and `emitSupervisorEvent`

**File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts`

**Purpose**: Add two capabilities:
1. `handleJoinSession` — message handler for `join-session` client event; adds the socket to a room
2. `handleLeaveSession` — message handler for `leave-session` client event; removes the socket from a room
3. `emitSupervisorEvent(event: SupervisorEvent)` — public method that broadcasts to the session room

**Evidence**:
- `dashboard.gateway.ts:27` — `server: Server` (Socket.IO server instance, used via `this.server.emit`)
- `dashboard.gateway.ts:117` — `broadcastEvent` pattern: `this.server.emit('dashboard-event', event)`
- Room API from Socket.IO: `this.server.to(roomName).emit(eventName, data)` and `client.join(roomName)`

**New imports required**:

```typescript
import { SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import type { SupervisorEvent } from '../auto-pilot/auto-pilot.types';
```

**New method: `handleJoinSession`**:

```typescript
@UseGuards(WsAuthGuard)
@SubscribeMessage('join-session')
public handleJoinSession(
  @MessageBody() data: { sessionId: string },
  @ConnectedSocket() client: Socket,
): void {
  void client.join(data.sessionId);
  this.logger.debug(`Client ${client.id} joined session room: ${data.sessionId}`);
}
```

**New method: `handleLeaveSession`**:

```typescript
@UseGuards(WsAuthGuard)
@SubscribeMessage('leave-session')
public handleLeaveSession(
  @MessageBody() data: { sessionId: string },
  @ConnectedSocket() client: Socket,
): void {
  void client.leave(data.sessionId);
  this.logger.debug(`Client ${client.id} left session room: ${data.sessionId}`);
}
```

**New method: `emitSupervisorEvent`**:

```typescript
public emitSupervisorEvent(event: SupervisorEvent): void {
  if (!this.server) {
    this.logger.warn('Server not initialized, skipping supervisor event broadcast');
    return;
  }
  this.server.to(event.sessionId).emit('supervisor-event', event);
  this.logger.debug(`supervisor-event: ${event.type} → room ${event.sessionId}`);
}
```

**Note**: `broadcastEvent` at line 117 remains private (internal dashboard events only). `emitSupervisorEvent` is a separate public method — no cross-contamination of event pipelines.

**Files Affected**:
- `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` (MODIFY)

---

### Component 5: `DashboardModule` — Export `DashboardGateway`

**File**: `apps/dashboard-api/src/dashboard/dashboard.module.ts`

**Purpose**: Make `DashboardGateway` available for injection in modules that import `DashboardModule`.

**Evidence**: `dashboard.module.ts:49` — current exports list does NOT include `DashboardGateway` (line 49). The gateway is provided (line 35) but not exported.

**Change**: Add `DashboardGateway` to the `exports` array.

**Files Affected**:
- `apps/dashboard-api/src/dashboard/dashboard.module.ts` (MODIFY)

---

### Component 6: `AutoPilotModule` — Import `DashboardModule`

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts`

**Purpose**: Give `AutoPilotModule` access to `DashboardGateway` via NestJS DI.

**Evidence**: `auto-pilot.module.ts:9` — no `imports` array exists currently. `app.module.ts:11` — both modules are siblings under `AppModule`, so circular dependency is not a concern.

**Change**: Add `imports: [DashboardModule]` to the `@Module` decorator.

**Files Affected**:
- `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` (MODIFY)

---

### Component 7: `SessionManagerService` — Inject Gateway and Build Broadcast Callback

**File**: `apps/dashboard-api/src/auto-pilot/session-manager.service.ts`

**Purpose**: Inject `DashboardGateway`, build a broadcast callback, and pass it to each `SessionRunner` at construction time.

**Evidence**:
- `session-manager.service.ts:27` — constructor currently takes 3 injected services
- `session-manager.service.ts:64-71` — `SessionRunner` constructor call with `onStopped` callback pattern
- `session-runner.ts:43` — `onStopped?: (sessionId: string) => void` — proves callback pattern is already wired

**Constructor change**:

```typescript
public constructor(
  private readonly supervisorDb: SupervisorDbService,
  private readonly workerManager: WorkerManagerService,
  private readonly promptBuilder: PromptBuilderService,
  private readonly dashboardGateway: DashboardGateway,
) {}
```

**Broadcast callback built in `createSession`**:

```typescript
const onEvent = (event: SupervisorEvent): void => {
  this.dashboardGateway.emitSupervisorEvent(event);
};

const runner = new SessionRunner(
  sessionId,
  mergedConfig,
  this.supervisorDb,
  this.workerManager,
  this.promptBuilder,
  (id) => this.runners.delete(id),
  onEvent,
);
```

**New import required**:

```typescript
import { DashboardGateway } from '../dashboard/dashboard.gateway';
import type { SupervisorEvent } from './auto-pilot.types';
```

**Files Affected**:
- `apps/dashboard-api/src/auto-pilot/session-manager.service.ts` (MODIFY)

---

### Component 8: `SessionRunner` — Wire Broadcast Callback into `emitEvent`

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts`

**Purpose**: Accept the broadcast callback and call it in `emitEvent` so all existing emit call sites broadcast automatically without any changes to those call sites.

**Evidence**:
- `session-runner.ts:37-47` — constructor with `onStopped` pattern
- `session-runner.ts:540-549` — `emitEvent` method currently only logs
- All 8 `emitEvent` call sites are already correct and complete — no changes needed to call sites

**Constructor change** — add `onEvent` as an optional final parameter:

```typescript
public constructor(
  public readonly sessionId: string,
  private config: SupervisorConfig,
  private readonly supervisorDb: SupervisorDbService,
  private readonly workerManager: WorkerManagerService,
  private readonly promptBuilder: PromptBuilderService,
  onStopped?: (sessionId: string) => void,
  onEvent?: (event: SupervisorEvent) => void,
) {
  this.logger = new Logger(`SessionRunner[${sessionId}]`);
  this.onStopped = onStopped;
  this.onEvent = onEvent;
}
```

**New private field**:

```typescript
private readonly onEvent?: (event: SupervisorEvent) => void;
```

**Updated `emitEvent`**:

```typescript
private emitEvent(type: SupervisorEvent['type'], payload: Record<string, unknown>): void {
  const event: SupervisorEvent = {
    type,
    sessionId: this.sessionId,
    timestamp: new Date().toISOString(),
    payload,
  };
  try {
    this.logger.debug(`Event: ${event.type} — ${JSON.stringify(payload)}`);
  } catch { /* best effort */ }
  this.onEvent?.(event);
}
```

**Add heartbeat emit in `tick()`**:

The `tick()` method calls `supervisorDb.updateHeartbeat` (line 149) but never emits `supervisor:heartbeat`. Add after the `updateHeartbeat` call:

```typescript
this.emitEvent('supervisor:heartbeat', { loopStatus: this.loopStatus });
```

**Files Affected**:
- `apps/dashboard-api/src/auto-pilot/session-runner.ts` (MODIFY)

---

## Batch Decomposition

### Wave 1 — Independent (can execute in parallel)

These changes have no dependencies on each other:

| Batch | File | Change |
|-------|------|--------|
| 1A | `auto-pilot.types.ts` | Add `supervisor_model` to `SupervisorConfig` and `DEFAULT_SUPERVISOR_CONFIG` |
| 1B | `auto-pilot.model.ts` | Add `supervisorModel` to `CreateSessionRequest` and `UpdateSessionConfigRequest` |
| 1C | `dashboard.gateway.ts` | Add `handleJoinSession`, `handleLeaveSession`, `emitSupervisorEvent` |
| 1D | `dashboard.module.ts` | Export `DashboardGateway` |

### Wave 2 — Depends on Wave 1

| Batch | File | Dependency | Change |
|-------|------|-----------|--------|
| 2A | `auto-pilot.module.ts` | 1D (gateway must be exported first) | Import `DashboardModule` |
| 2B | `session-runner.ts` | 1C (needs `SupervisorEvent` type is already present; needs `onEvent` field) | Add `onEvent` parameter, wire into `emitEvent`, add heartbeat emit |
| 2C | `auto-pilot.service.ts` | 1A (needs `supervisor_model` field) | Map `supervisorModel` → `supervisor_model` |

### Wave 3 — Depends on Wave 2

| Batch | File | Dependency | Change |
|-------|------|-----------|--------|
| 3A | `session-manager.service.ts` | 2A (module wiring), 1C (gateway method), 2B (runner accepts callback) | Inject gateway, pass `onEvent` callback to runner |

---

## Module Wiring — Exact Changes

### `dashboard.module.ts` exports array

Current:

```typescript
exports: [DiffService, WorkerTreeService, PipelineService, SessionsService, AnalyticsService, WatcherService, CortexService, SessionsHistoryService, ReportsService, OrchestrationFlowsService, LogsService, ProgressCenterService, CommandConsoleService],
```

Add `DashboardGateway` to the exports array.

### `auto-pilot.module.ts`

Current (no imports array):

```typescript
@Module({
  controllers: [AutoPilotController],
  providers: [...],
  exports: [...],
})
```

Add:

```typescript
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [DashboardModule],
  controllers: [AutoPilotController],
  providers: [...],
  exports: [...],
})
```

---

## Room Protocol — WebSocket Event Specification

### Client → Server Events

| Event Name | Payload | Description |
|------------|---------|-------------|
| `join-session` | `{ sessionId: string }` | Subscribe to a session's supervisor events |
| `leave-session` | `{ sessionId: string }` | Unsubscribe from a session's supervisor events |

### Server → Client Events

| Event Name | Payload Type | Trigger | Recipients |
|------------|-------------|---------|-----------|
| `supervisor-event` | `SupervisorEvent` | Any `emitEvent` call in `SessionRunner` | Clients in room `sessionId` |
| `dashboard-event` | `DashboardEvent` | File changes, analytics refresh | ALL connected clients (unchanged) |
| `cortex-event` | cortex event | Cortex polling | ALL connected clients (unchanged) |

### `SupervisorEvent` Types Delivered via `supervisor-event`

All types from `auto-pilot.types.ts:185-188`:

- `supervisor:started` — session start / resume
- `supervisor:stopped` — session stop / pause / drain complete
- `supervisor:heartbeat` — every tick (new)
- `worker:spawned` — worker process started
- `worker:completed` — worker finished successfully
- `worker:failed` — worker failed (includes `willRetry`, `retryCount`)
- `worker:killed` — stuck worker terminated
- `task:claimed` — task claimed (already in type union, no call site yet)
- `task:completed` — task reached terminal complete state (already in type union, no call site yet)
- `task:failed` — task reached terminal failed state (already in type union, no call site yet)
- `task:blocked` — task retry exhausted

### Room Naming Convention

Room name = `sessionId` (string UUID). This is already the session identifier used throughout the system.

---

## Type Changes Summary

### `SupervisorConfig` (auto-pilot.types.ts)

Add field:

```typescript
supervisor_model: string;
```

### `DEFAULT_SUPERVISOR_CONFIG` (auto-pilot.types.ts)

Add entry:

```typescript
supervisor_model: 'claude-haiku-4-5-20251001',
```

### `CreateSessionRequest` (auto-pilot.model.ts)

Add field:

```typescript
readonly supervisorModel?: string;
```

### `UpdateSessionConfigRequest` (auto-pilot.model.ts)

Add field:

```typescript
readonly supervisorModel?: string;
```

### `UpdateConfigRequest` (auto-pilot.types.ts — the Partial Pick type at line 143)

Add `'supervisor_model'` to the `Pick` keys so runtime patch updates can include it:

```typescript
export type UpdateConfigRequest = Partial<Pick<SupervisorConfig,
  | 'concurrency'
  | 'limit'
  | 'prep_provider'
  | 'prep_model'
  | 'implement_provider'
  | 'implement_model'
  | 'implement_fallback_provider'
  | 'implement_fallback_model'
  | 'review_provider'
  | 'review_model'
  | 'supervisor_model'
  | 'priority'
  | 'retries'
  | 'poll_interval_ms'
>>;
```

---

## Quality Requirements

### Correctness

- `SessionRunner` must remain a plain class — no `@Injectable`, no NestJS module references
- `emitEvent` must call `onEvent?.(event)` after the try/catch log block (not inside it) — avoids swallowing broadcast errors in the catch
- `handleJoinSession` and `handleLeaveSession` must use `@UseGuards(WsAuthGuard)` consistent with `handleConnection` at `dashboard.gateway.ts:53`

### Non-Regression

- `broadcastEvent` (private, global broadcast) is untouched
- `cortexPollInterval` and watcher subscription are untouched
- All existing `emitEvent` call sites in `session-runner.ts` are untouched (8 call sites)
- `onStopped` callback wiring in `session-manager.service.ts` is untouched

### Guard on Server Initialization

`emitSupervisorEvent` must guard `if (!this.server)` before calling `this.server.to(...)` — consistent with `broadcastEvent` at `dashboard.gateway.ts:118`.

### Heartbeat Emit

`supervisor:heartbeat` is emitted once per `tick()` execution (after `updateHeartbeat` DB call). This is scoped by the same `if (this.loopStatus !== 'running') return` guard at line 144, so heartbeats are suppressed when paused or stopped.

---

## Files Affected Summary

**MODIFY**:
1. `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`
2. `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts`
3. `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts`
4. `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts`
5. `apps/dashboard-api/src/auto-pilot/session-manager.service.ts`
6. `apps/dashboard-api/src/auto-pilot/session-runner.ts`
7. `apps/dashboard-api/src/dashboard/dashboard.gateway.ts`
8. `apps/dashboard-api/src/dashboard/dashboard.module.ts`

**CREATE**: none

**REWRITE**: none

---

## Team-Leader Handoff

### Developer Type Recommendation

**nitro-backend-developer** — all changes are NestJS service wiring, TypeScript type additions, and WebSocket handler methods. No frontend work.

### Complexity Assessment

**LOW-MEDIUM** — 8 files, all changes are additive (no rewrites). The largest single change is `session-runner.ts` (add one field, expand one method, add one line in `tick`). Module wiring is mechanical. No data migrations. No new dependencies.

**Estimated Effort**: 1-2 hours

### Execution Order for Team Leader (Atomic Tasks)

Wave 1 (parallel):
- Task A: Add `supervisor_model` to types and defaults (`auto-pilot.types.ts`)
- Task B: Add `supervisorModel` to request models (`auto-pilot.model.ts`)
- Task C: Add room handlers and `emitSupervisorEvent` to gateway (`dashboard.gateway.ts`)
- Task D: Export `DashboardGateway` from `DashboardModule` (`dashboard.module.ts`)

Wave 2 (after Wave 1 complete, parallel):
- Task E: Import `DashboardModule` into `AutoPilotModule` (`auto-pilot.module.ts`)
- Task F: Wire `onEvent` callback into `SessionRunner` including heartbeat (`session-runner.ts`)
- Task G: Map `supervisorModel` → `supervisor_model` in service (`auto-pilot.service.ts`)

Wave 3 (after Wave 2 complete):
- Task H: Inject gateway into `SessionManagerService`, build and pass `onEvent` callback (`session-manager.service.ts`)

### Architecture Delivery Checklist

- [x] All components specified with evidence (file:line citations)
- [x] All patterns verified from codebase (callback pattern, gateway method pattern)
- [x] All imports/classes verified as existing (`DashboardGateway`, `SupervisorEvent`, `Socket`)
- [x] Quality requirements defined (guard on server, UseGuards, no regression)
- [x] Integration points documented (module wiring, room protocol)
- [x] Files affected list complete (8 files, all MODIFY)
- [x] Developer type recommended (nitro-backend-developer)
- [x] Complexity assessed (LOW-MEDIUM, 1-2 hours)
- [x] No step-by-step implementation (decomposition is Team Leader's job)
- [x] No backward compatibility layers
- [x] No parallel implementations
