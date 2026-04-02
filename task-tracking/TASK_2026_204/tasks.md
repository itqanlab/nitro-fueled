# Development Tasks - TASK_2026_204

**Total Tasks**: 9 | **Batches**: 3 | **Status**: 3/3 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- SupervisorDbService methods (`createSession`, `logEvent`, `updateSessionStatus`, `updateHeartbeat`, `getActiveWorkers`, `getTaskCandidates`, `claimTask`, `getWorkerCounts`, `getTaskCountsByStatus`, `updateTaskStatus`, `updateSessionTerminalCount`, `getTaskStatus`, `isAvailable`) all exist and are called with correct signatures: Verified against supervisor-db.service.ts
- WorkerManagerService (`spawnWorker`, `killWorker`) and PromptBuilderService (`buildWorkerPrompt`, `reviewWorkerPrompt`) exist: Verified
- SessionRunner as plain class receiving shared services via constructor (not DI) is architecturally sound: Verified - NestJS singletons can be passed as plain references
- WAL mode in SQLite handles concurrent reads/writes from multiple SessionRunners: Verified via supervisor-db.service.ts

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| None identified | - | - |

---

## Batch 1: Foundation (Types + New Files) IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 3 | **Dependencies**: None

### Task 1.1: Add UpdateConfigRequest type to auto-pilot.types.ts IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`
**Spec Reference**: plan.md: Component 3 (lines 222-248)
**Pattern to Follow**: Existing type definitions in auto-pilot.types.ts

**Quality Requirements**:
- Use `Partial<Pick<SupervisorConfig, ...>>` pattern for type safety
- Exclude `working_directory` from mutable fields
- Keep all existing types unchanged

**Implementation Details**:
- Add `UpdateConfigRequest` type after the existing `StartRequest` interface (around line 103)
- Type is `Partial<Pick<SupervisorConfig, 'concurrency' | 'limit' | 'build_provider' | 'build_model' | 'review_provider' | 'review_model' | 'priority' | 'retries' | 'poll_interval_ms'>>`
- No imports needed - `SupervisorConfig` is in the same file

---

### Task 1.2: Create SessionRunner class IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts` (CREATE)
**Spec Reference**: plan.md: Component 1 (lines 62-147)
**Pattern to Follow**: `apps/dashboard-api/src/auto-pilot/supervisor.service.ts` (lines 30-567 — extract all logic)

**Quality Requirements**:
- Plain class, NOT `@Injectable()` — no NestJS decorators
- Constructor takes `sessionId`, `config`, and three shared service references
- All instance state is direct fields (no nullable `this.state` pattern)
- All private methods from `supervisor.service.ts` transfer 1:1 with `this.state.xxx` replaced by `this.xxx`
- `tick()` must remain async with try/catch/finally and `isProcessing` guard
- `updateConfig()` must restart timer if `poll_interval_ms` changes while running
- Timer cleanup in `stop()` and module destroy scenarios
- Logger name includes sessionId: `new Logger(\`SessionRunner[\${sessionId}]\`)`
- No `if (!this.state) return;` guards — the runner instance IS the state

**Implementation Details**:
- Imports: `Logger` from `@nestjs/common`, all types from `./auto-pilot.types`, service types from `./supervisor-db.service`, `./worker-manager.service`, `./prompt-builder.service`
- Public methods: `start()`, `pause()`, `resume()`, `stop(reason?)`, `updateConfig(patch)`, `getStatus()`, `getLoopStatus()`, `getConfig()`
- Private methods (moved from supervisor.service.ts): `tick()`, `processWorkerHealth()`, `handleWorkerCompletion()`, `handleWorkerFailure()`, `handleStuckWorker()`, `selectSpawnCandidates()`, `applyPriorityStrategy()`, `spawnForCandidate()`, `checkTermination()`, `stopLoop()`, `clearTimer()`, `emitEvent()`
- Instance fields: `loopTimer`, `isProcessing`, `loopStatus`, `retryCounters`, `stuckCounters`, `tasksCompleted`, `tasksFailed`, `startedAt`
- `start()` logs SESSION_STARTED event, starts setInterval, runs first tick immediately
- `getStatus()` reads worker/task counts from DB (same logic as current `SupervisorService.getStatus()`)

---

### Task 1.3: Create SessionManagerService IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/session-manager.service.ts` (CREATE)
**Spec Reference**: plan.md: Component 2 (lines 150-216)
**Pattern to Follow**: NestJS injectable pattern from `supervisor.service.ts:29-30`, `worker-manager.service.ts:43`

**Quality Requirements**:
- `@Injectable()` with NestJS constructor DI
- Implements `OnModuleDestroy` — stops all runners on shutdown
- Uses `Map<string, SessionRunner>` for runner tracking
- `createSession()` validates DB availability, merges config with defaults, creates DB row, instantiates SessionRunner, starts it
- `stopSession()` removes runner from Map after stopping
- All methods that take sessionId return `false`/`null` for not-found (no silent success)
- `hasActiveSession()` checks if any runner has loopStatus 'running' or 'paused'

**Implementation Details**:
- Imports: `Injectable`, `Logger`, `OnModuleDestroy` from `@nestjs/common`; `SupervisorDbService`, `WorkerManagerService`, `PromptBuilderService`; `SessionRunner` from `./session-runner`; types from `./auto-pilot.types`
- Constructor DI: `supervisorDb`, `workerManager`, `promptBuilder`
- Public methods: `createSession(config)`, `stopSession(sessionId)`, `pauseSession(sessionId)`, `resumeSession(sessionId)`, `updateSessionConfig(sessionId, patch)`, `getSessionStatus(sessionId)`, `listSessions()`, `getRunner(sessionId)`, `hasActiveSession()`
- `createSession` flow: validate DB -> merge config -> `supervisorDb.createSession()` -> `new SessionRunner(...)` -> `runner.start()` -> add to Map -> return sessionId
- `stopSession` flow: get runner -> `runner.stop()` -> delete from Map -> return true

---

**Batch 1 Verification**:
- All files exist at paths
- `auto-pilot.types.ts` has `UpdateConfigRequest` type
- `session-runner.ts` is a plain class with all methods from supervisor.service.ts
- `session-manager.service.ts` is `@Injectable()` with `OnModuleDestroy`
- Build passes: `npx nx build dashboard-api`
- nitro-code-logic-reviewer approved

---

## Batch 2: DTOs and Facade IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 2 | **Dependencies**: Batch 1

### Task 2.1: Rewrite auto-pilot.model.ts with session-centric DTOs IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` (REWRITE)
**Spec Reference**: plan.md: Component 4 (lines 250-307)
**Pattern to Follow**: Existing DTO style in `auto-pilot.model.ts` (readonly fields, interface-based)

**Quality Requirements**:
- Replace all old DTOs with new session-centric ones
- Use `readonly` on all fields
- Import types from `auto-pilot.types.ts` (`ProviderType`, `PriorityStrategy`, `SupervisorConfig`, `SessionStatusResponse`)
- Use `ReadonlyArray` for array fields

**Implementation Details**:
- New interfaces: `CreateSessionRequest`, `CreateSessionResponse`, `UpdateSessionConfigRequest`, `UpdateSessionConfigResponse`, `SessionActionResponse`, `ListSessionsResponse`
- `CreateSessionRequest`: optional fields for concurrency, limit, buildProvider, buildModel, reviewProvider, reviewModel, priority, retries (camelCase, matching API convention)
- `CreateSessionResponse`: `{ sessionId: string; status: 'starting' }`
- `UpdateSessionConfigRequest`: same fields as CreateSessionRequest plus `pollIntervalMs`
- `UpdateSessionConfigResponse`: `{ sessionId: string; config: SupervisorConfig }`
- `SessionActionResponse`: `{ sessionId: string; action: 'stopped' | 'paused' | 'resumed' }`
- `ListSessionsResponse`: `{ sessions: ReadonlyArray<SessionStatusResponse> }`
- Remove old interfaces: `StartAutoPilotRequest`, `StartAutoPilotResponse`, `StopAutoPilotRequest`, `StopAutoPilotResponse`, `PauseAutoPilotRequest`, `PauseAutoPilotResponse`, `ResumeAutoPilotRequest`, `ResumeAutoPilotResponse`, `AutoPilotStatusResponse`

---

### Task 2.2: Rewrite auto-pilot.service.ts facade IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` (REWRITE)
**Spec Reference**: plan.md: Component 5 (lines 312-331)
**Pattern to Follow**: Current facade pattern in `auto-pilot.service.ts`

**Quality Requirements**:
- Inject `SessionManagerService` instead of `SupervisorService`
- All methods take explicit `sessionId` parameter (no implicit "current session")
- camelCase-to-snake_case field mapping happens here (DTO -> SupervisorConfig)
- Keep `@Injectable()` decorator
- Return types use new DTOs from auto-pilot.model.ts

**Implementation Details**:
- Imports: `SessionManagerService` from `./session-manager.service`; new DTOs from `./auto-pilot.model`; `UpdateConfigRequest` from `./auto-pilot.types`
- Constructor: `private readonly sessionManager: SessionManagerService`
- `createSession(request: CreateSessionRequest)`: map camelCase fields to snake_case SupervisorConfig keys, call `sessionManager.createSession(config)`, return `CreateSessionResponse`
- `stopSession(sessionId)`: call `sessionManager.stopSession(sessionId)`, return `SessionActionResponse | null`
- `pauseSession(sessionId)`: call `sessionManager.pauseSession(sessionId)`, return `SessionActionResponse | null`
- `resumeSession(sessionId)`: call `sessionManager.resumeSession(sessionId)`, return `SessionActionResponse | null`
- `updateSessionConfig(sessionId, request)`: map camelCase to snake_case, call `sessionManager.updateSessionConfig()`, return `UpdateSessionConfigResponse | null`
- `getSessionStatus(sessionId)`: delegate to `sessionManager.getSessionStatus(sessionId)`
- `listSessions()`: delegate to `sessionManager.listSessions()`

---

**Batch 2 Verification**:
- `auto-pilot.model.ts` has all new DTOs, no old DTOs
- `auto-pilot.service.ts` injects `SessionManagerService`, all methods session-scoped
- Build passes: `npx nx build dashboard-api`
- nitro-code-logic-reviewer approved

---

## Batch 3: Controller, Module Wiring, Cleanup IMPLEMENTED

**Developer**: nitro-backend-developer
**Tasks**: 4 | **Dependencies**: Batch 2

### Task 3.1: Rewrite auto-pilot.controller.ts with session-centric routes IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` (REWRITE)
**Spec Reference**: plan.md: Component 6 (lines 337-360)
**Pattern to Follow**: Current controller pattern in `auto-pilot.controller.ts` (validation, Swagger decorators, error handling)

**Quality Requirements**:
- Change route prefix from `api/auto-pilot` to `api/sessions`
- Add PATCH endpoint for config updates
- Keep validation constants (`SESSION_ID_RE`, `TASK_ID_RE`, `VALID_PROVIDERS`, `VALID_PRIORITIES`)
- Add `parseCreateBody` (replaces `parseStartBody`) with same field validators
- Add `parseUpdateConfigBody` with pollIntervalMs validation (number, 5000-300000)
- Proper error responses: 400 for bad input, 404 for session not found
- Swagger decorators on all endpoints

**Implementation Details**:
- Imports: `Body`, `Controller`, `Delete`, `Get`, `HttpCode`, `HttpStatus`, `NotFoundException`, `BadRequestException`, `Param`, `Patch`, `Post` from `@nestjs/common`; Swagger decorators; `AutoPilotService`; new DTOs from `./auto-pilot.model`
- Route prefix: `@Controller('api/sessions')`
- `@Post()` createSession — validates body with `parseCreateBody`, delegates to service
- `@Get()` listSessions — returns all sessions
- `@Get(':id')` getSession — validates sessionId format, returns single session or 404
- `@Patch(':id/config')` updateConfig — validates sessionId and body with `parseUpdateConfigBody`, delegates to service or 404
- `@Post(':id/pause')` pauseSession — validates sessionId, delegates or 404
- `@Post(':id/resume')` resumeSession — validates sessionId, delegates or 404
- `@Post(':id/stop')` stopSession — validates sessionId, delegates or 404
- `parseCreateBody`: same validation as current `parseStartBody` but returns `CreateSessionRequest`
- `parseUpdateConfigBody`: same field validators plus `pollIntervalMs` (number, 5000-300000)

---

### Task 3.2: Update auto-pilot.module.ts wiring IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` (MODIFY)
**Spec Reference**: plan.md: Component 7 (lines 365-379)
**Pattern to Follow**: Current module in `auto-pilot.module.ts`

**Quality Requirements**:
- Replace `SupervisorService` with `SessionManagerService` in providers
- Replace `SupervisorService` with `SessionManagerService` in exports
- Remove import of `SupervisorService`
- Add import of `SessionManagerService`

**Implementation Details**:
- Remove: `import { SupervisorService } from './supervisor.service';`
- Add: `import { SessionManagerService } from './session-manager.service';`
- Providers: replace `SupervisorService` with `SessionManagerService`
- Exports: replace `SupervisorService` with `SessionManagerService`
- Keep all other providers and controller unchanged

---

### Task 3.3: Delete supervisor.service.ts IMPLEMENTED

**File**: `apps/dashboard-api/src/auto-pilot/supervisor.service.ts` (DELETE)
**Spec Reference**: plan.md: Migration Plan Step 7 (line 415)

**Quality Requirements**:
- File must be deleted (not left as dead code)
- No other file in the project should import from `./supervisor.service`
- Verify no remaining references before deletion

**Implementation Details**:
- Delete the file using `rm`
- After deletion, grep for any remaining imports of `supervisor.service` to confirm clean removal

---

### Task 3.4: Build verification IMPLEMENTED

**File**: N/A (build check)
**Spec Reference**: plan.md: Migration Plan Step 8 (lines 418-419)

**Quality Requirements**:
- `npx nx build dashboard-api` completes with zero errors
- No TypeScript compilation errors
- No missing imports or references

**Implementation Details**:
- Run `npx nx build dashboard-api`
- Fix any import issues that surface
- This is a verification task, not a coding task

---

**Batch 3 Verification**:
- Controller uses `api/sessions` prefix with all 7 endpoints
- Module wires `SessionManagerService` instead of `SupervisorService`
- `supervisor.service.ts` is deleted
- No remaining imports of `supervisor.service` anywhere
- Build passes: `npx nx build dashboard-api`
- nitro-code-logic-reviewer approved
