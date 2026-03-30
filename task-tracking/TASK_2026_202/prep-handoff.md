# Prep Handoff — TASK_2026_202

## Implementation Plan Summary

This task adds graceful session termination ("drain") to the auto-pilot supervisor.
The drain flow: user clicks "End Session" → `PATCH /api/sessions/:id/stop` sets
`drain_requested = true` in the DB → supervisor tick loop reads the flag, skips new
worker spawns, and calls `stopLoop('Drained by user')` when active workers finish →
`loop_status` becomes `'stopped'` → frontend shows amber "Session ended by user" badge.

**Four implementation batches** in dependency order:
1. **DB migration** — add `drain_requested` column (ALTER TABLE, non-destructive)
2. **Backend drain logic** — db service methods + tick guard + new PATCH endpoint
3. **Cortex types & history service** — add drain_requested to CortexSession, update endStatus derivation
4. **Frontend** — api types, api service, session-detail component, sessions-list

The existing `POST /api/sessions/:id/stop` (hard-kill) is NOT modified.

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| `packages/mcp-cortex/src/db/schema.ts` | modify | Add `drain_requested` to `SESSION_MIGRATIONS` array |
| `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts` | modify | Add `setDrainRequested()` and `getDrainRequested()` methods |
| `apps/dashboard-api/src/auto-pilot/session-runner.ts` | modify | Add drain guard in `tick()`, populate `drainRequested` in `getStatus()` |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts` | modify | Add `drainRequested: boolean` to `SessionStatusResponse` |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` | modify | Add `drainSession()` method |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts` | modify | Add `'draining'` to `SessionActionResponse.action` union |
| `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` | modify | Add `@Patch(':id/stop')` endpoint |
| `apps/dashboard-api/src/auto-pilot/session-manager.service.ts` | modify | Add `drainSession()` method |
| `apps/dashboard-api/src/dashboard/cortex.types.ts` | modify | Add `drain_requested` to `CortexSession` and `RawSession` |
| `apps/dashboard-api/src/dashboard/cortex.service.ts` | modify | Map `drain_requested` column in `getSessions()` |
| `apps/dashboard-api/src/dashboard/sessions-history.service.ts` | modify | Add `'stopped'` to `SessionEndStatus`, update `deriveEndStatus()` |
| `apps/dashboard/src/app/models/api.types.ts` | modify | Add `'stopped'` to `SessionEndStatus`, `drainRequested` to `SessionHistoryDetail` |
| `apps/dashboard/src/app/services/api.service.ts` | modify | Add `drainSession()` PATCH method |
| `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts` | modify | Drain signals, `requestDrain/confirmDrain/cancelDrain`, statusColor update |
| `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html` | modify | End Session button, confirmation dialog, draining badge |
| `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts` | modify | Add `'stopped'` → amber in `statusColor()` |

## Batches

- **Batch 1**: DB Schema Migration — add `drain_requested` to `SESSION_MIGRATIONS` in `schema.ts`
- **Batch 2**: Backend Drain Infrastructure — `supervisor-db.service.ts`, `session-runner.ts`, `auto-pilot.types.ts`, `auto-pilot.service.ts`, `auto-pilot.model.ts`, `auto-pilot.controller.ts`, `session-manager.service.ts`
- **Batch 3**: Cortex Types & History Service — `cortex.types.ts`, `cortex.service.ts`, `sessions-history.service.ts` (can run parallel with Batch 2)
- **Batch 4**: Frontend — `api.types.ts`, `api.service.ts`, `session-detail.component.ts/.html`, `sessions-list.component.ts` (after Batches 2+3)

## Key Decisions

- **PATCH vs POST**: New `PATCH /api/sessions/:id/stop` sets drain flag only. Existing `POST /api/sessions/:id/stop` hard-kills. NestJS routes by HTTP method — no conflict.
- **DB read per tick**: `getDrainRequested()` does a SELECT on every 30s tick. Negligible overhead. Avoids in-memory state divergence.
- **endStatus 'stopped' = drained**: `(loop_status='stopped' && drain_requested=1)` → `endStatus: 'stopped'`. Natural completion keeps `endStatus: 'completed'`.
- **No websocket/polling for drain state**: The draining UI is optimistic (button click sets `isDraining` signal). User refreshes to see final stopped state. Real-time drain progress is a future enhancement.
- **Confirmation dialog uses signals**: No NzModal or CDK import — `showConfirmDialog` signal + inline `@if` block in template.

## Gotchas

- `cortex.service.ts` getSessions() uses a raw DB mapper. **Must add** `drain_requested: row.drain_requested === 1` there or `CortexSession.drain_requested` will always be `undefined`, breaking `deriveEndStatus()`.
- `RawSession` interface (cortex.types.ts) needs `drain_requested: number` (not boolean) — SQLite returns INTEGER.
- The drain guard `return` in `tick()` is inside a `try` block — the `finally { this.isProcessing = false; }` still executes. This is correct behavior.
- `session-detail.component.ts` currently models sessions as `SessionHistoryDetail` (history view). A running session appears here with `endStatus: 'running'`. The End Session button condition must be `d.statusLabel === 'running'` not `d.loopStatus === 'running'`.
- The `EnrichedDetail` interface needs `id: string` and `activeWorkerCount: number` added — these are new fields not currently in the interface.
- `sessions-history.service.ts` is currently untracked (new file). Be careful not to conflict with other in-progress work if the file is also modified by TASK_2026_200 (check git status before editing).
- The frontend `api.types.ts` has TWO places where `CortexSession` type is defined — one in `api.types.ts` (frontend copy) and one in `cortex.types.ts` (backend). Update BOTH.
