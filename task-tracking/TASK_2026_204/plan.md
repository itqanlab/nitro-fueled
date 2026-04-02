# Implementation Plan — TASK_2026_204: Refactor Supervisor to Multi-Session Architecture

## Codebase Investigation Summary

### Files Analyzed
- `apps/dashboard-api/src/auto-pilot/supervisor.service.ts` — singleton supervisor (567 lines, gets replaced)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` — shared types (137 lines)
- `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts` — DB service (427 lines, stays as-is)
- `apps/dashboard-api/src/auto-pilot/worker-manager.service.ts` — worker spawn/kill (301 lines, stays as-is)
- `apps/dashboard-api/src/auto-pilot/prompt-builder.service.ts` — prompt construction (stays as-is)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` — REST endpoints (230 lines, rewritten)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` — facade (76 lines, rewritten)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` — DTOs (80 lines, rewritten)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` — module wiring (20 lines, updated)

### Patterns Identified
- **NestJS Injectable Services**: All services use `@Injectable()` with constructor DI (`supervisor-db.service.ts:114`, `worker-manager.service.ts:43`)
- **OnModuleDestroy**: Services that hold resources implement `OnModuleDestroy` (`supervisor.service.ts:30`, `worker-manager.service.ts:43`)
- **Logger pattern**: `private readonly logger = new Logger(ClassName.name)` used consistently
- **Event emission**: Currently a no-op logger.debug call (`supervisor.service.ts:551-566`) — kept as-is
- **Config merging**: `{ ...DEFAULT_SUPERVISOR_CONFIG, ...config }` pattern (`supervisor.service.ts:74`)
- **Guard pattern**: `this.isProcessing` boolean prevents overlapping ticks (`supervisor.service.ts:35`)

### Key Dependencies (Shared, Not Modified)
- `SupervisorDbService` — singleton, thread-safe via WAL mode, all DB operations
- `WorkerManagerService` — singleton, manages child processes, spawn/kill
- `PromptBuilderService` — singleton, constructs worker prompts

---

## Architecture Overview

```
Before (singleton):
  SupervisorService (@Injectable, one state, one timer)
    └── state: SupervisorState | null
    └── loopTimer: single setInterval

After (multi-session):
  SessionManagerService (@Injectable, NestJS singleton)
    └── runners: Map<string, SessionRunner>
    └── create/stop/list/get lifecycle methods

  SessionRunner (plain class, one per session)
    ├── sessionId: string
    ├── config: SupervisorConfig (mutable)
    ├── loopTimer: own setInterval
    ├── loopStatus: LoopStatus
    ├── isProcessing: boolean (tick guard)
    ├── retryCounters: Record<string, number>
    ├── stuckCounters: Record<string, number>
    ├── tasksCompleted / tasksFailed: number
    ├── startedAt: string
    └── references to shared services (supervisorDb, workerManager, promptBuilder)
```

The logic currently inside `SupervisorService` methods (`tick`, `processWorkerHealth`, `handleWorkerCompletion`, `handleWorkerFailure`, `handleStuckWorker`, `selectSpawnCandidates`, `applyPriorityStrategy`, `spawnForCandidate`, `checkTermination`, `stopLoop`) moves 1:1 into `SessionRunner`. The `SessionManagerService` is a thin orchestrator that creates/destroys runners and delegates operations by sessionId.

---

## Component 1: SessionRunner (plain class)

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts` (CREATE)

**Pattern source**: Extracted from `supervisor.service.ts:30-567`

### Constructor

```typescript
export class SessionRunner {
  constructor(
    readonly sessionId: string,
    private config: SupervisorConfig,
    private readonly supervisorDb: SupervisorDbService,
    private readonly workerManager: WorkerManagerService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}
}
```

The runner receives shared service references via constructor (not DI — this is a plain class). The `SessionManagerService` passes its own injected singletons when instantiating each runner.

### Internal State (instance fields)

```typescript
private readonly logger = new Logger(`SessionRunner[${sessionId}]`);
private loopTimer: ReturnType<typeof setInterval> | null = null;
private isProcessing = false;
private loopStatus: LoopStatus = 'running';
private retryCounters: Record<string, number> = {};
private stuckCounters: Record<string, number> = {};
private tasksCompleted = 0;
private tasksFailed = 0;
private readonly startedAt: string = new Date().toISOString();
```

### Public Methods

| Method | Signature | Behavior |
|--------|-----------|----------|
| `start()` | `start(): void` | Logs SESSION_STARTED event, starts setInterval, runs first tick immediately |
| `pause()` | `pause(): void` | Sets loopStatus='paused', clears timer, updates DB status |
| `resume()` | `resume(): void` | Sets loopStatus='running', restarts timer, runs immediate tick |
| `stop(reason?)` | `stop(reason?: string): void` | Clears timer, sets loopStatus='stopped', writes terminal count to DB |
| `updateConfig(patch)` | `updateConfig(patch: Partial<SupervisorConfig>): void` | Merges patch into `this.config`. If `poll_interval_ms` changed, clears and restarts timer with new interval |
| `getStatus()` | `getStatus(): SessionStatusResponse` | Reads worker/task counts from DB, returns status object |
| `getLoopStatus()` | `getLoopStatus(): LoopStatus` | Returns current loop status (for quick checks without DB hit) |
| `getConfig()` | `getConfig(): SupervisorConfig` | Returns current config (for API responses) |

### Private Methods (moved from supervisor.service.ts)

All private methods transfer directly with minimal changes — replace `this.state.xxx` with `this.xxx` (direct instance fields instead of nullable state object):

- `tick()` — the core loop body (lines 166-206 of supervisor.service.ts)
- `processWorkerHealth(activeWorkers)` — lines 212-223
- `handleWorkerCompletion(worker)` — lines 225-257
- `handleWorkerFailure(worker, reason)` — lines 259-292
- `handleStuckWorker(worker)` — lines 294-317
- `selectSpawnCandidates(candidates, slots, activeWorkers)` — lines 323-345
- `applyPriorityStrategy(build, review, slots, strategy)` — lines 347-403
- `spawnForCandidate(candidate)` — lines 410-485
- `checkTermination(activeWorkers, candidates)` — lines 491-508
- `stopLoop(reason)` — lines 514-538
- `clearTimer()` — lines 540-545
- `emitEvent(type, payload)` — lines 551-566

### Key Difference from SupervisorService

The `SupervisorService` uses a nullable `this.state: SupervisorState | null` pattern with null guards everywhere (`if (!this.state) return`). The `SessionRunner` eliminates this — the runner only exists while the session exists, so all state is direct instance fields. No null checks needed inside tick/spawn/health methods.

### updateConfig Behavior

```typescript
public updateConfig(patch: Partial<SupervisorConfig>): void {
  const oldPollInterval = this.config.poll_interval_ms;
  Object.assign(this.config, patch);

  // If poll interval changed while running, restart the timer
  if (patch.poll_interval_ms && patch.poll_interval_ms !== oldPollInterval && this.loopStatus === 'running') {
    this.clearTimer();
    this.loopTimer = setInterval(() => this.tick(), this.config.poll_interval_ms);
  }
}
```

Since `tick()` reads `this.config` on every invocation, changes to model/provider/concurrency/priority take effect on the next tick without timer restart.

---

## Component 2: SessionManagerService (NestJS singleton)

**File**: `apps/dashboard-api/src/auto-pilot/session-manager.service.ts` (CREATE)

**Pattern source**: NestJS injectable pattern from `supervisor.service.ts:29-30`, `worker-manager.service.ts:43`

### Class Structure

```typescript
@Injectable()
export class SessionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly runners = new Map<string, SessionRunner>();

  constructor(
    private readonly supervisorDb: SupervisorDbService,
    private readonly workerManager: WorkerManagerService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  onModuleDestroy(): void {
    // Stop all runners on server shutdown
    for (const [, runner] of this.runners) {
      runner.stop('Server shutting down');
    }
    this.runners.clear();
  }
}
```

### Public Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `createSession(config)` | `createSession(config: Partial<SupervisorConfig>): string` | Merges config with defaults, creates DB session row, instantiates SessionRunner, calls runner.start(), adds to Map, returns sessionId |
| `stopSession(sessionId)` | `stopSession(sessionId: string): boolean` | Calls runner.stop(), removes from Map. Returns false if sessionId not found |
| `pauseSession(sessionId)` | `pauseSession(sessionId: string): boolean` | Calls runner.pause(). Runner stays in Map (can be resumed) |
| `resumeSession(sessionId)` | `resumeSession(sessionId: string): boolean` | Calls runner.resume() |
| `updateSessionConfig(sessionId, patch)` | `updateSessionConfig(sessionId: string, patch: Partial<SupervisorConfig>): boolean` | Calls runner.updateConfig(patch) |
| `getSessionStatus(sessionId)` | `getSessionStatus(sessionId: string): SessionStatusResponse \| null` | Delegates to runner.getStatus() |
| `listSessions()` | `listSessions(): SessionStatusResponse[]` | Maps over all runners, calls getStatus() on each |
| `getRunner(sessionId)` | `getRunner(sessionId: string): SessionRunner \| undefined` | Direct Map access (for internal use) |
| `hasActiveSession()` | `hasActiveSession(): boolean` | Returns true if any runner has loopStatus 'running' or 'paused' |

### createSession Flow

```
1. Validate DB is available (supervisorDb.isAvailable())
2. Merge config: { ...DEFAULT_SUPERVISOR_CONFIG, ...config }
3. Create DB row: supervisorDb.createSession(...)  → sessionId
4. Instantiate: new SessionRunner(sessionId, mergedConfig, supervisorDb, workerManager, promptBuilder)
5. runner.start()
6. this.runners.set(sessionId, runner)
7. Return sessionId
```

### stopSession Flow

```
1. Get runner from Map
2. If not found → return false
3. runner.stop(reason)
4. this.runners.delete(sessionId)
5. Return true
```

Note: stopped runners are removed from the Map. Their data persists in the DB (sessions/workers/events tables). The dashboard can query historical sessions via the DB.

---

## Component 3: Type Changes

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` (MODIFY)

### Changes

1. **Keep all existing types** — `SupervisorConfig`, `SupervisorState`, `TaskCandidate`, `ActiveWorkerInfo`, `SessionStatusResponse`, `SupervisorEvent`, `DEFAULT_SUPERVISOR_CONFIG` all stay as-is. The `SessionRunner` uses them internally.

2. **Add `UpdateConfigRequest` type** for the PATCH endpoint:

```typescript
export type UpdateConfigRequest = Partial<Pick<SupervisorConfig,
  | 'concurrency'
  | 'limit'
  | 'build_provider'
  | 'build_model'
  | 'review_provider'
  | 'review_model'
  | 'priority'
  | 'retries'
  | 'poll_interval_ms'
>>;
```

Note: `working_directory` is intentionally excluded — it cannot be changed mid-session.

3. **No breaking changes** to existing types. The `SupervisorState` interface stays for internal SessionRunner use.

---

## Component 4: DTO Changes

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` (REWRITE)

### New DTOs

```typescript
// === Create Session ===
export interface CreateSessionRequest {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly buildProvider?: ProviderType;
  readonly buildModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
}

export interface CreateSessionResponse {
  readonly sessionId: string;
  readonly status: 'starting';
}

// === Update Config ===
export interface UpdateSessionConfigRequest {
  readonly concurrency?: number;
  readonly limit?: number;
  readonly buildProvider?: ProviderType;
  readonly buildModel?: string;
  readonly reviewProvider?: ProviderType;
  readonly reviewModel?: string;
  readonly priority?: PriorityStrategy;
  readonly retries?: number;
  readonly pollIntervalMs?: number;
}

export interface UpdateSessionConfigResponse {
  readonly sessionId: string;
  readonly config: SupervisorConfig;
}

// === Stop / Pause / Resume (same shape, kept for clarity) ===
export interface SessionActionResponse {
  readonly sessionId: string;
  readonly action: 'stopped' | 'paused' | 'resumed';
}

// === List Sessions ===
export interface ListSessionsResponse {
  readonly sessions: ReadonlyArray<SessionStatusResponse>;
}

// === Session Status (re-export from types for API layer) ===
// Uses SessionStatusResponse from auto-pilot.types.ts directly
```

`StartAutoPilotRequest`/`StartAutoPilotResponse` and the separate `StopAutoPilotResponse`/`PauseAutoPilotResponse`/`ResumeAutoPilotResponse` are replaced. The model file becomes cleaner with `CreateSessionRequest`, `CreateSessionResponse`, `UpdateSessionConfigRequest`, `UpdateSessionConfigResponse`, `SessionActionResponse`, and `ListSessionsResponse`.

---

## Component 5: Facade Changes

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` (REWRITE)

The facade changes from wrapping `SupervisorService` to wrapping `SessionManagerService`. Every method now takes a `sessionId` parameter (no more implicit "current session" pattern).

### New Methods

| Method | Delegates To |
|--------|-------------|
| `createSession(request)` | `sessionManager.createSession(config)` — maps camelCase DTO fields to snake_case config |
| `stopSession(sessionId)` | `sessionManager.stopSession(sessionId)` |
| `pauseSession(sessionId)` | `sessionManager.pauseSession(sessionId)` |
| `resumeSession(sessionId)` | `sessionManager.resumeSession(sessionId)` |
| `updateSessionConfig(sessionId, request)` | `sessionManager.updateSessionConfig(sessionId, patch)` — maps camelCase to snake_case |
| `getSessionStatus(sessionId)` | `sessionManager.getSessionStatus(sessionId)` |
| `listSessions()` | `sessionManager.listSessions()` |

### Field Name Mapping

The DTO layer uses camelCase (`buildProvider`, `buildModel`, `pollIntervalMs`) while `SupervisorConfig` uses snake_case (`build_provider`, `build_model`, `poll_interval_ms`). The facade handles this mapping, keeping the controller and runner clean.

---

## Component 6: Controller Changes

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` (REWRITE)

### New REST API

The controller moves from `/api/auto-pilot/*` action-based routes to `/api/sessions/*` resource-based routes.

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/api/sessions` | POST | `createSession(@Body)` | Create and start a new session |
| `/api/sessions` | GET | `listSessions()` | List all active sessions with status |
| `/api/sessions/:id` | GET | `getSession(@Param('id'))` | Get single session detail |
| `/api/sessions/:id/config` | PATCH | `updateConfig(@Param('id'), @Body)` | Update session config |
| `/api/sessions/:id/pause` | POST | `pauseSession(@Param('id'))` | Pause session loop |
| `/api/sessions/:id/resume` | POST | `resumeSession(@Param('id'))` | Resume paused session |
| `/api/sessions/:id/stop` | POST | `stopSession(@Param('id'))` | Stop session gracefully |

### Backward Compatibility Note

The old `/api/auto-pilot/*` routes are **removed** (no backward compat per mandate). The dashboard frontend will be updated in a separate task to use the new endpoints.

### Validation

Reuse the existing validation constants (`SESSION_ID_RE`, `TASK_ID_RE`, `VALID_PROVIDERS`, `VALID_PRIORITIES`) and validation logic from the current controller. The `parseStartBody` method becomes `parseCreateBody` with the same field validation. Add `parseUpdateConfigBody` with the same field validators plus `pollIntervalMs` (number, 5000-300000).

---

## Component 7: Module Wiring

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` (MODIFY)

```typescript
@Module({
  controllers: [AutoPilotController],
  providers: [
    AutoPilotService,
    SessionManagerService,    // replaces SupervisorService
    SupervisorDbService,
    WorkerManagerService,
    PromptBuilderService,
  ],
  exports: [AutoPilotService, SessionManagerService],  // replaces SupervisorService export
})
export class AutoPilotModule {}
```

---

## Migration Plan

This is a direct replacement refactor. The execution order matters to avoid broken imports:

### Step 1: Add types (non-breaking)
- Add `UpdateConfigRequest` to `auto-pilot.types.ts`

### Step 2: Create SessionRunner (new file, no imports yet)
- Create `session-runner.ts` by extracting logic from `supervisor.service.ts`
- All private methods move as-is with `this.state.xxx` replaced by `this.xxx`
- Remove the `@Injectable()` decorator and NestJS imports
- Constructor takes service references instead of DI

### Step 3: Create SessionManagerService (new file)
- Create `session-manager.service.ts` as NestJS `@Injectable()`
- Implements `OnModuleDestroy` for cleanup
- Delegates to SessionRunner instances

### Step 4: Rewrite DTOs (auto-pilot.model.ts)
- Replace old request/response interfaces with new session-centric ones

### Step 5: Rewrite facade (auto-pilot.service.ts)
- Change from `SupervisorService` dependency to `SessionManagerService`
- All methods become session-id-scoped

### Step 6: Rewrite controller (auto-pilot.controller.ts)
- Change route prefix from `api/auto-pilot` to `api/sessions`
- Add PATCH endpoint, session-centric GET/POST

### Step 7: Update module and delete old file
- Update `auto-pilot.module.ts` to wire `SessionManagerService` instead of `SupervisorService`
- Delete `supervisor.service.ts`

### Step 8: Compile check
- Run `npx nx build dashboard-api` to verify clean compilation
- Fix any import issues

---

## Files Affected Summary

### CREATE
- `apps/dashboard-api/src/auto-pilot/session-runner.ts` — SessionRunner plain class (~350 lines)
- `apps/dashboard-api/src/auto-pilot/session-manager.service.ts` — SessionManagerService NestJS singleton (~120 lines)

### REWRITE (Direct Replacement)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` — new session-centric routes
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` — new facade over SessionManagerService
- `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` — new DTOs

### MODIFY
- `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` — add `UpdateConfigRequest`
- `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` — swap provider wiring

### DELETE
- `apps/dashboard-api/src/auto-pilot/supervisor.service.ts` — replaced by session-runner + session-manager

### NOT MODIFIED
- `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts` — shared, stays as-is
- `apps/dashboard-api/src/auto-pilot/worker-manager.service.ts` — shared, stays as-is
- `apps/dashboard-api/src/auto-pilot/prompt-builder.service.ts` — shared, stays as-is

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: nitro-backend-developer
**Rationale**: Pure NestJS/TypeScript backend refactor — no frontend, no UI, no CSS. Requires understanding of NestJS DI, class extraction patterns, and REST API design.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 2-3 hours

The logic already exists and works. This is a mechanical extraction (SupervisorService -> SessionRunner) plus a thin new orchestrator (SessionManagerService). No new algorithms, no new DB schema, no new external integrations.

### Architecture Delivery Checklist
- [x] All components specified with evidence (file:line citations throughout)
- [x] All patterns verified from codebase (NestJS Injectable, OnModuleDestroy, Logger)
- [x] All imports/classes verified as existing (SupervisorDbService, WorkerManagerService, PromptBuilderService)
- [x] Quality requirements defined (TypeScript clean compile, concurrent sessions work independently)
- [x] Integration points documented (shared services passed via constructor)
- [x] Files affected list complete (3 create, 3 rewrite, 2 modify, 1 delete)
- [x] Developer type recommended (nitro-backend-developer)
- [x] Complexity assessed (MEDIUM, 2-3 hours)
- [x] No step-by-step implementation (team-leader decomposes into atomic tasks)
