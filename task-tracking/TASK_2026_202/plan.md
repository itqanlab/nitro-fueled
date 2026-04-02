# Implementation Plan — TASK_2026_202
# Graceful Session Termination

## Architecture Overview

The drain flow spans three layers:

```
Frontend (Angular)
  └─ ApiService.drainSession(id) ──PATCH /api/sessions/:id/stop──▶
         Dashboard-API (NestJS)
           └─ AutoPilotController → AutoPilotService → SessionManagerService
                └─ SupervisorDbService.setDrainRequested(sessionId)
                     └─ sessions.drain_requested = 1 (SQLite)
                          ▲ polled every tick by SessionRunner

SessionRunner.tick() — every 30s
  1. processWorkerHealth() — allows active workers to finish normally
  2. CHECK drain_requested (NEW) — if true, skip spawn, check if 0 active
  3. If drain + 0 active → stopLoop('Drained by user')
     → loop_status = 'stopped'

Frontend polling (manual refresh or future polling)
  └─ endStatus: 'stopped' → amber badge "Session ended by user"
```

## Key Decisions

### D1: drain_requested stored in DB, read per tick
Rationale: The runner already reads from DB on every tick (heartbeat,
getActiveWorkers, getTaskCandidates). One additional `SELECT drain_requested
FROM sessions WHERE id = ?` per 30s tick is negligible. Avoids in-memory
state divergence if the DB is updated externally (e.g. MCP tools).

### D2: PATCH /api/sessions/:id/stop is a NEW endpoint, not a replacement
The existing `POST /api/sessions/:id/stop` does a hard-kill (removes runner,
immediately terminates). The new `PATCH` endpoint only sets the DB flag; the
runner drains naturally. Both co-exist for different use cases (emergency kill
vs graceful drain). The task spec explicitly asks for `PATCH`.

### D3: endStatus 'stopped' distinguishes drained from natural completion
`loop_status = 'stopped'` occurs both for natural completion (queue empty) and
drain. We distinguish by `drain_requested`:
- `stopped` + `drain_requested = true`  → `endStatus: 'stopped'` (amber, "ended by user")
- `stopped` + `drain_requested = false` → `endStatus: 'completed'` (green, unchanged)

### D4: drain_requested added via SESSION_MIGRATIONS (ALTER TABLE), not schema rebuild
Consistent with all other column additions in the codebase (see `SESSION_MIGRATIONS`
array in `schema.ts`). Safe to run on existing DB.

### D5: Active worker count in draining UI comes from SessionHistoryDetail
Rather than polling the live sessions API, the drain UI reads from the history
endpoint which already returns workers. Count `workers.filter(w => w.status === 'active').length`
to show countdown. For real-time countdown a future enhancement would add polling —
this task does a one-shot optimistic update (user must refresh for live count).

### D6: Confirmation dialog uses Angular CDK or inline logic (no new dependency)
Use a boolean signal `showConfirmDialog` in the component. No NzModal or CDK import
needed — a simple inline `@if (showConfirmDialog)` block in the template is
sufficient and avoids adding dependencies.

## Implementation Batches

### Batch 1 — DB Schema Migration
**Scope**: `packages/mcp-cortex/src/db/schema.ts`

Add to `SESSION_MIGRATIONS`:
```typescript
{ column: 'drain_requested', ddl: "ALTER TABLE sessions ADD COLUMN drain_requested INTEGER NOT NULL DEFAULT 0" }
```

This runs at server start via `applyMigrations(db, 'sessions', SESSION_MIGRATIONS)`.

### Batch 2 — Backend Infrastructure
**Scope**:
- `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts`
- `apps/dashboard-api/src/auto-pilot/session-runner.ts`
- `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts`
- `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts`
- `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts`

#### 2a. SupervisorDbService — new methods

```typescript
// Set drain_requested = 1 for session
public setDrainRequested(sessionId: string): void {
  this.db.prepare('UPDATE sessions SET drain_requested = 1, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), sessionId);
}

// Read drain_requested for session (returns false if column missing / row missing)
public getDrainRequested(sessionId: string): boolean {
  const row = this.db.prepare('SELECT drain_requested FROM sessions WHERE id = ?')
    .get(sessionId) as { drain_requested: number } | undefined;
  return row?.drain_requested === 1;
}
```

#### 2b. SessionRunner.tick() — drain check

Insert after `processWorkerHealth()`, before spawn section:

```typescript
// Drain check: if drain requested, skip spawning and wait for active workers
const drainRequested = this.supervisorDb.getDrainRequested(this.sessionId);
if (drainRequested) {
  const drainActive = this.supervisorDb.getActiveWorkers(this.sessionId);
  if (drainActive.length === 0) {
    this.stopLoop('Drained by user');
  }
  // Don't fall through to spawn logic
  return; // exits finally block via normal flow
}
```

**Note**: The `return` inside `try` still executes `finally { this.isProcessing = false; }`.

#### 2c. SessionStatusResponse — add drainRequested field

```typescript
export interface SessionStatusResponse {
  // ... existing fields ...
  drainRequested: boolean;
}
```

Update `SessionRunner.getStatus()` to populate it:
```typescript
drainRequested: this.supervisorDb.getDrainRequested(this.sessionId),
```

#### 2d. AutoPilotService — drainSession()

```typescript
public drainSession(sessionId: string): SessionActionResponse | null {
  const runner = this.sessionManager.getRunner(sessionId);
  if (!runner) return null;
  this.sessionManager.drainSession(sessionId);
  return { sessionId, action: 'draining' };
}
```

Update `SessionActionResponse.action` type to include `'draining'`.

#### 2e. SessionManagerService — drainSession()

```typescript
public drainSession(sessionId: string): boolean {
  const runner = this.runners.get(sessionId);
  if (!runner) return false;
  this.supervisorDb.setDrainRequested(sessionId);
  return true;
}
```

#### 2f. AutoPilotController — PATCH /api/sessions/:id/stop

```typescript
@Patch(':id/stop')
@HttpCode(HttpStatus.OK)
public drainSession(@Param('id') id: string): SessionActionResponse {
  this.validateSessionId(id);
  const response = this.autoPilotService.drainSession(id);
  if (!response) throw new NotFoundException(`Session ${id} not found`);
  return response;
}
```

### Batch 3 — Cortex Types & History Service
**Scope**:
- `apps/dashboard-api/src/dashboard/cortex.types.ts`
- `apps/dashboard-api/src/dashboard/sessions-history.service.ts`

#### 3a. cortex.types.ts — add drain_requested to CortexSession and RawSession

```typescript
export interface CortexSession {
  // ... existing fields ...
  drain_requested: boolean;
}

export interface RawSession {
  // ... existing fields ...
  drain_requested: number;  // SQLite 0/1
}
```

#### 3b. sessions-history.service.ts — update deriveEndStatus

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

Also need to verify `cortex.service.ts` maps `drain_requested` from DB row to
`CortexSession`. Check `getSessions()` mapper — add `drain_requested: row.drain_requested === 1`.

### Batch 4 — Frontend
**Scope**:
- `apps/dashboard/src/app/models/api.types.ts`
- `apps/dashboard/src/app/services/api.service.ts`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts`
- `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html`
- `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts`

#### 4a. api.types.ts — extend SessionEndStatus and SessionHistoryDetail

```typescript
// Add 'stopped' to SessionEndStatus
export type SessionEndStatus = 'completed' | 'killed' | 'crashed' | 'running' | 'stopped';

// Add drainRequested to SessionHistoryDetail
export interface SessionHistoryDetail {
  // ... existing fields ...
  readonly drainRequested: boolean;
}
```

Also update `CortexSession` (in api.types.ts) to add `drain_requested: boolean`.

#### 4b. api.service.ts — add drainSession()

```typescript
public drainSession(sessionId: string): Observable<{ sessionId: string; action: string }> {
  return this.http.patch<{ sessionId: string; action: string }>(
    `${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/stop`,
    {},
  );
}
```

#### 4c. session-detail.component.ts — drain state + confirmation dialog

Add signals:
```typescript
public readonly showConfirmDialog = signal(false);
public readonly isDraining = signal(false);
public readonly drainError = signal<string | null>(null);
```

Add methods:
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
  this.api.drainSession(sessionId).pipe(
    catchError(err => {
      this.isDraining.set(false);
      this.drainError.set('Failed to request session drain');
      return of(null);
    }),
  ).subscribe(() => {
    // isDraining stays true — user sees "Stopping..." until refresh
  });
}
```

Update `detail` computed to include active worker count:
```typescript
activeWorkerCount: raw.workers.filter(w => w.status === 'active' || w.status === 'running').length,
drainRequested: raw.drainRequested,
```

Update `statusColor()` in component to add `'stopped'` → `'gold'` (amber).

#### 4d. session-detail.component.html — End Session button + drain UI

In the `meta-card` section, after the status tag:
```html
@if (d.statusLabel === 'running' && !isDraining()) {
  <button class="end-session-btn" (click)="requestDrain()">End Session</button>
}
@if (isDraining() || d.statusLabel === 'stopped') {
  @if (isDraining()) {
    <span class="draining-badge">
      Stopping after current workers finish...
      @if (d.activeWorkerCount > 0) {
        ({{ d.activeWorkerCount }} remaining)
      }
    </span>
  }
}
```

Confirmation dialog:
```html
@if (showConfirmDialog()) {
  <div class="confirm-overlay">
    <div class="confirm-dialog">
      <p>End this session? Active workers will finish their current task before stopping.</p>
      <div class="confirm-actions">
        <button class="btn-confirm" (click)="confirmDrain(d.id)">End Session</button>
        <button class="btn-cancel" (click)="cancelDrain()">Cancel</button>
      </div>
    </div>
  </div>
}
```

`'stopped'` status rendering: handled by `statusColor()` returning `'gold'` → amber tag.
Add label: when `d.statusLabel === 'stopped'`, show "Session ended by user" text.

#### 4e. sessions-list.component.ts — add 'stopped' color

```typescript
private statusColor(status: SessionEndStatus): string {
  switch (status) {
    case 'completed': return 'green';
    case 'running': return 'blue';
    case 'stopped': return 'gold';    // NEW — amber, distinct from killed
    case 'killed': return 'orange';
    case 'crashed': return 'red';
    default: return 'default';
  }
}
```

## File Touch Summary

| File | Action | Batch |
|------|--------|-------|
| `packages/mcp-cortex/src/db/schema.ts` | add migration entry | 1 |
| `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts` | add 2 methods | 2 |
| `apps/dashboard-api/src/auto-pilot/session-runner.ts` | drain check in tick() | 2 |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` | drainRequested field | 2 |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` | drainSession() | 2 |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` | DrainSessionResponse | 2 |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` | PATCH endpoint | 2 |
| `apps/dashboard-api/src/dashboard/cortex.types.ts` | drain_requested in CortexSession/RawSession | 3 |
| `apps/dashboard-api/src/dashboard/cortex.service.ts` | map drain_requested in getSessions() | 3 |
| `apps/dashboard-api/src/dashboard/sessions-history.service.ts` | deriveEndStatus update | 3 |
| `apps/dashboard/src/app/models/api.types.ts` | SessionEndStatus + SessionHistoryDetail | 4 |
| `apps/dashboard/src/app/services/api.service.ts` | drainSession() | 4 |
| `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts` | drain state + actions | 4 |
| `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html` | button + dialog + badge | 4 |
| `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts` | 'stopped' color | 4 |

## Risk Areas

- `cortex.service.ts` getSessions() mapper must be checked — if it doesn't explicitly
  map `drain_requested`, the column may be omitted even after migration.
- The `RawSession` interface in `cortex.types.ts` needs `drain_requested: number` (SQLite
  INTEGER returns as number, not boolean).
- `session-detail` currently uses the history endpoint (completed sessions) — the "End
  Session" button works because sessions in `running` state appear in history too.
- The existing `POST /api/sessions/:id/stop` and new `PATCH /api/sessions/:id/stop` must
  coexist on the same route pattern — NestJS differentiates by HTTP method, this is fine.
