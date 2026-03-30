# Development Tasks — TASK_2026_202

## Batch 1: DB Schema Migration — PENDING

**Developer**: nitro-backend-developer

### Task 1.1: Add drain_requested migration to SESSION_MIGRATIONS

**File**: `packages/mcp-cortex/src/db/schema.ts`
**Status**: PENDING

Add to `SESSION_MIGRATIONS` array (after the `last_heartbeat` entry):

```typescript
{ column: 'drain_requested', ddl: "ALTER TABLE sessions ADD COLUMN drain_requested INTEGER NOT NULL DEFAULT 0" },
```

This follows the existing pattern. `applyMigrations(db, 'sessions', SESSION_MIGRATIONS)` at
the bottom of `initDatabase()` will execute the ALTER TABLE once on first startup after deploy.

**Acceptance**: `SESSION_MIGRATIONS` array includes `drain_requested` entry.

---

## Batch 2: Backend Drain Infrastructure — PENDING

**Developer**: nitro-backend-developer
**Depends on**: Batch 1

### Task 2.1: SupervisorDbService — add setDrainRequested and getDrainRequested

**File**: `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts`
**Status**: PENDING

Add two public methods to `SupervisorDbService`:

```typescript
public setDrainRequested(sessionId: string): void {
  this.db.prepare(
    'UPDATE sessions SET drain_requested = 1, updated_at = ? WHERE id = ?'
  ).run(new Date().toISOString(), sessionId);
}

public getDrainRequested(sessionId: string): boolean {
  const row = this.db.prepare(
    'SELECT drain_requested FROM sessions WHERE id = ?'
  ).get(sessionId) as { drain_requested: number } | undefined;
  return row?.drain_requested === 1;
}
```

Note: `updated_at` is included so polling clients see a changed timestamp.

**Acceptance**: Methods exist on `SupervisorDbService` and can be called.

---

### Task 2.2: SessionRunner — drain guard in tick()

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts`
**Status**: PENDING

In `tick()`, insert after `processWorkerHealth(activeWorkers)` and before the
`getTaskCandidates()` call:

```typescript
// Drain guard: if drain requested, skip spawning; stop when all workers done
if (this.supervisorDb.getDrainRequested(this.sessionId)) {
  const drainActive = this.supervisorDb.getActiveWorkers(this.sessionId);
  if (drainActive.length === 0) {
    this.stopLoop('Drained by user');
  }
  return;
}
```

The `return` inside the `try` block still executes `finally { this.isProcessing = false; }`.

**Acceptance**: When `drain_requested = 1`, no new workers are spawned; when last
active worker finishes, `stopLoop('Drained by user')` is called → `loop_status = 'stopped'`.

---

### Task 2.3: auto-pilot.types.ts — add drainRequested to SessionStatusResponse

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`
**Status**: PENDING

Add `drainRequested: boolean` field to `SessionStatusResponse`:

```typescript
export interface SessionStatusResponse {
  sessionId: string;
  loopStatus: LoopStatus;
  config: SupervisorConfig;
  workers: { active: number; completed: number; failed: number; };
  tasks: { completed: number; failed: number; inProgress: number; remaining: number; };
  startedAt: string;
  uptimeMinutes: number;
  lastHeartbeat: string;
  drainRequested: boolean;   // NEW
}
```

Also extend `SessionActionResponse.action` type in the same file or in `auto-pilot.model.ts`
to include `'draining'`.

**Acceptance**: `drainRequested` field is present on `SessionStatusResponse`.

---

### Task 2.4: SessionRunner.getStatus() — populate drainRequested

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts`
**Status**: PENDING

In `getStatus()`, add `drainRequested` to the returned object:

```typescript
public getStatus(): SessionStatusResponse {
  // ... existing code ...
  return {
    // ... existing fields ...
    drainRequested: this.supervisorDb.getDrainRequested(this.sessionId),
  };
}
```

**Acceptance**: `GET /api/sessions/:id` response includes `drainRequested`.

---

### Task 2.5: SessionManagerService — drainSession()

**File**: `apps/dashboard-api/src/auto-pilot/session-manager.service.ts`
**Status**: PENDING

Add `drainSession()` method:

```typescript
public drainSession(sessionId: string): boolean {
  const runner = this.runners.get(sessionId);
  if (!runner) return false;
  this.supervisorDb.setDrainRequested(sessionId);
  return true;
}
```

**Acceptance**: `drainSession()` sets the DB flag and returns true when session exists.

---

### Task 2.6: AutoPilotService — drainSession()

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts`
**Status**: PENDING

Add `drainSession()` method:

```typescript
public drainSession(sessionId: string): SessionActionResponse | null {
  const drained = this.sessionManager.drainSession(sessionId);
  if (!drained) return null;
  return { sessionId, action: 'draining' };
}
```

Note: `SessionActionResponse.action` needs `'draining'` added to its union type.

**Acceptance**: `drainSession()` delegates to sessionManager and returns action response.

---

### Task 2.7: auto-pilot.model.ts — add 'draining' to SessionActionResponse

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts`
**Status**: PENDING

Update `SessionActionResponse.action` to include `'draining'`:

```typescript
export interface SessionActionResponse {
  readonly sessionId: string;
  readonly action: 'stopped' | 'paused' | 'resumed' | 'draining';  // add 'draining'
}
```

**Acceptance**: TypeScript compiles without error after adding `'draining'` action.

---

### Task 2.8: AutoPilotController — PATCH /api/sessions/:id/stop endpoint

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts`
**Status**: PENDING

Add new `@Patch(':id/stop')` method:

```typescript
@Patch(':id/stop')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Request graceful drain — active workers finish, no new spawns' })
@ApiParam({ name: 'id', description: 'Session ID (SESSION_YYYY-MM-DDTHH-MM-SS)' })
@ApiResponse({ status: 200, description: 'Drain requested' })
@ApiResponse({ status: 400, description: 'Invalid session ID format' })
@ApiResponse({ status: 404, description: 'Session not found' })
public drainSession(@Param('id') id: string): SessionActionResponse {
  this.validateSessionId(id);
  const response = this.autoPilotService.drainSession(id);
  if (!response) {
    throw new NotFoundException(`Session ${id} not found`);
  }
  return response;
}
```

Note: NestJS differentiates `@Patch(':id/stop')` from `@Post(':id/stop')` by HTTP method.
No conflict with existing `POST` endpoint.

**Acceptance**: `PATCH /api/sessions/:id/stop` returns 200 `{ sessionId, action: 'draining' }`.

---

## Batch 3: Cortex Types & History Service — PENDING

**Developer**: nitro-backend-developer
**Depends on**: Batch 1

### Task 3.1: cortex.types.ts — add drain_requested to CortexSession and RawSession

**File**: `apps/dashboard-api/src/dashboard/cortex.types.ts`
**Status**: PENDING

Update `CortexSession`:
```typescript
export interface CortexSession {
  // ... existing fields ...
  drain_requested: boolean;
}
```

Update `RawSession`:
```typescript
export interface RawSession {
  // ... existing fields ...
  drain_requested: number;  // SQLite INTEGER 0/1
}
```

**Acceptance**: Both interfaces include `drain_requested`.

---

### Task 3.2: cortex.service.ts — map drain_requested in getSessions()

**File**: `apps/dashboard-api/src/dashboard/cortex.service.ts`
**Status**: PENDING

Find the `getSessions()` method (or the raw-to-CortexSession mapper) and add:
```typescript
drain_requested: row.drain_requested === 1,
```

This converts the SQLite INTEGER to a TypeScript boolean.

**Acceptance**: `CortexSession.drain_requested` is `true` when DB value is `1`.

---

### Task 3.3: sessions-history.service.ts — deriveEndStatus for 'stopped'

**File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts`
**Status**: PENDING

Update `SessionEndStatus` type to include `'stopped'`:
```typescript
export type SessionEndStatus = 'completed' | 'killed' | 'crashed' | 'running' | 'stopped';
```

Update `deriveEndStatus()`:
```typescript
private deriveEndStatus(session: CortexSession): SessionEndStatus {
  if (session.loop_status === 'running') return 'running';
  if (session.ended_at === null) return 'running';
  if (session.loop_status === 'stopped' && session.drain_requested) return 'stopped';
  if (session.loop_status === 'stopped') return 'completed';
  if (session.loop_status === 'crashed') return 'crashed';
  return 'completed';
}
```

**Acceptance**: Sessions with `drain_requested = true` + `loop_status = 'stopped'` return
`endStatus: 'stopped'`. Naturally completed sessions still return `endStatus: 'completed'`.

---

## Batch 4: Frontend — PENDING

**Developer**: nitro-frontend-developer
**Depends on**: Batch 2 (PATCH endpoint), Batch 3 (endStatus 'stopped')

### Task 4.1: api.types.ts — add 'stopped' to SessionEndStatus, drainRequested to detail

**File**: `apps/dashboard/src/app/models/api.types.ts`
**Status**: PENDING

1. Update `SessionEndStatus`:
```typescript
export type SessionEndStatus = 'completed' | 'killed' | 'crashed' | 'running' | 'stopped';
```

2. Add `drainRequested` to `SessionHistoryDetail`:
```typescript
export interface SessionHistoryDetail {
  // ... existing fields ...
  readonly drainRequested: boolean;
}
```

3. Add `drain_requested` to `CortexSession` in api.types.ts (mirror of backend):
```typescript
export interface CortexSession {
  // ... existing fields ...
  readonly drain_requested: boolean;
}
```

**Acceptance**: TypeScript compiles; `'stopped'` is a valid `SessionEndStatus`.

---

### Task 4.2: api.service.ts — add drainSession()

**File**: `apps/dashboard/src/app/services/api.service.ts`
**Status**: PENDING

Add method after `stopSession()` or near session lifecycle methods:
```typescript
public drainSession(sessionId: string): Observable<{ sessionId: string; action: string }> {
  return this.http.patch<{ sessionId: string; action: string }>(
    `${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stop`,
    {},
  );
}
```

**Acceptance**: `drainSession()` sends `PATCH /api/sessions/{id}/stop`.

---

### Task 4.3: session-detail.component.ts — End Session button + drain state

**File**: `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts`
**Status**: PENDING

1. Add import: `catchError, of` from `rxjs` (already imported).

2. Add signals:
```typescript
public readonly showConfirmDialog = signal(false);
public readonly isDraining = signal(false);
public readonly drainError = signal<string | null>(null);
```

3. Add to `EnrichedDetail`:
```typescript
interface EnrichedDetail {
  // ... existing fields ...
  readonly activeWorkerCount: number;
  readonly drainRequested: boolean;
  readonly id: string;  // session ID needed for PATCH call
}
```

4. Update `detail` computed to include new fields:
```typescript
id: raw.id,
activeWorkerCount: raw.workers.filter(w => w.status === 'active' || w.status === 'running').length,
drainRequested: raw.drainRequested,
```

5. Add drain methods:
```typescript
public requestDrain(): void {
  this.showConfirmDialog.set(true);
}

public cancelDrain(): void {
  this.showConfirmDialog.set(false);
}

public confirmDrain(sessionId: string): void {
  this.showConfirmDialog.set(false);
  this.isDraining.set(true);
  this.drainError.set(null);
  this.api.drainSession(sessionId).pipe(
    catchError(() => {
      this.isDraining.set(false);
      this.drainError.set('Failed to request session stop. Please try again.');
      return of(null);
    }),
  ).subscribe();
}
```

6. Update `statusColor()`:
```typescript
private statusColor(status: SessionEndStatus): string {
  switch (status) {
    case 'completed': return 'green';
    case 'running': return 'blue';
    case 'stopped': return 'gold';   // amber — distinct from killed
    case 'killed': return 'orange';
    case 'crashed': return 'red';
    default: return 'default';
  }
}
```

**Acceptance**: Component compiles; draining signals update correctly; `statusColor('stopped')` returns `'gold'`.

---

### Task 4.4: session-detail.component.html — End Session button + drain UI

**File**: `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html`
**Status**: PENDING

In the `meta-card` div, after the status tag row, add drain controls:

```html
@if (detail(); as d) {
  <!-- End Session button — only when running and not yet draining -->
  @if (d.statusLabel === 'running' && !isDraining()) {
    <div class="session-actions">
      <button class="btn-end-session" (click)="requestDrain()">End Session</button>
    </div>
  }

  <!-- Draining state badge -->
  @if (isDraining()) {
    <div class="draining-state">
      <span class="draining-spinner">⏳</span>
      <span>Stopping after current workers finish...</span>
      @if (d.activeWorkerCount > 0) {
        <span class="worker-count">({{ d.activeWorkerCount }} remaining)</span>
      }
    </div>
  }

  <!-- Drain error -->
  @if (drainError()) {
    <div class="drain-error" role="alert">{{ drainError() }}</div>
  }

  <!-- Confirmation dialog overlay -->
  @if (showConfirmDialog()) {
    <div class="confirm-overlay">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <p class="confirm-message">
          End this session? Active workers will finish their current task before stopping.
        </p>
        <div class="confirm-actions">
          <button class="btn-confirm-end" (click)="confirmDrain(d.id)">End Session</button>
          <button class="btn-cancel" (click)="cancelDrain()">Cancel</button>
        </div>
      </div>
    </div>
  }
}
```

For the `'stopped'` status label, in the meta tag area, add a label override:
When `d.statusLabel === 'stopped'`, show `nz-tag [nzColor]="'gold'"` with text "Session ended by user".

**Acceptance**: End Session button appears for running sessions; confirmation dialog renders; 'stopped' shows amber tag with correct label.

---

### Task 4.5: sessions-list.component.ts — 'stopped' status color

**File**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts`
**Status**: PENDING

Update `statusColor()`:
```typescript
private statusColor(status: SessionEndStatus): string {
  switch (status) {
    case 'completed': return 'green';
    case 'running': return 'blue';
    case 'stopped': return 'gold';    // amber
    case 'killed': return 'orange';
    case 'crashed': return 'red';
    default: return 'default';
  }
}
```

**Acceptance**: Sessions list shows amber badge for `'stopped'` sessions.

---

## Summary

| Batch | Tasks | Files | Notes |
|-------|-------|-------|-------|
| 1 — DB Migration | 1 | 1 | Can run first, independent |
| 2 — Backend Drain | 7 | 5 | Depends on Batch 1 |
| 3 — Types & History | 3 | 3 | Depends on Batch 1 |
| 4 — Frontend | 5 | 5 | Depends on Batches 2 & 3 |

Batches 2 and 3 can run in parallel after Batch 1.
Batch 4 can start after Batches 2 and 3 complete.
