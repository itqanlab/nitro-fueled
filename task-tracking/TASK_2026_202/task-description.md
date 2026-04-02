# Task Description — TASK_2026_202
# Graceful Session Termination

## Problem Statement

Users cannot gracefully stop a running auto-pilot session. The existing
`POST /api/sessions/:id/stop` hard-kills the runner immediately — it does
not allow active workers to finish their current task. This risks leaving
tasks in `IN_PROGRESS` / `PREPPED` states with no running worker, which
blocks future processing and requires manual recovery.

## Solution

Introduce a **drain-and-stop** flow:

1. User clicks "End Session" in the session detail view (visible only while
   session is running).
2. A confirmation dialog prevents accidental clicks.
3. On confirm, the frontend calls `PATCH /api/sessions/:id/stop` which sets
   `drain_requested = true` in the DB.
4. The supervisor loop detects `drain_requested` on the next tick, skips all
   new worker spawns, and waits for active workers to finish naturally.
5. When the last active worker completes, the supervisor calls `stopLoop()`
   → `loop_status` transitions to `'stopped'`.
6. The UI shows a neutral amber "Session ended by user" badge — distinct from
   a natural completion (green) or a kill/crash (red/orange).

## Scope

### Backend

| Component | Change |
|-----------|--------|
| `packages/mcp-cortex/src/db/schema.ts` | Add `drain_requested` column to `sessions` via `SESSION_MIGRATIONS` |
| `supervisor-db.service.ts` | Add `setDrainRequested(sessionId)` and `getDrainRequested(sessionId)` |
| `session-runner.ts` | Add drain-check guard in `tick()` — after health processing, before spawning |
| `auto-pilot.types.ts` | Add `drainRequested: boolean` to `SessionStatusResponse` |
| `auto-pilot.service.ts` | Add `drainSession(sessionId)` method |
| `auto-pilot.model.ts` | Add `DrainSessionResponse` DTO type |
| `auto-pilot.controller.ts` | Add `PATCH /api/sessions/:id/stop` endpoint |
| `cortex.types.ts` | Add `drain_requested: boolean` to `CortexSession` and `RawSession` |
| `sessions-history.service.ts` | Update `deriveEndStatus` to return `'stopped'` for drained sessions; add `drain_requested` propagation |

### Frontend

| Component | Change |
|-----------|--------|
| `api.types.ts` | Add `'stopped'` to `SessionEndStatus`; add `drainRequested` to `SessionHistoryDetail` |
| `api.service.ts` | Add `drainSession(sessionId)` method (PATCH to `/api/sessions/:id/stop`) |
| `session-detail.component.ts` | Add draining state signal, End Session button logic, confirmation dialog, active worker count |
| `session-detail.component.html` | Add End Session button (visible when `running`), draining badge + worker count |
| `sessions-list.component.ts` | Add amber color for `'stopped'` status |

## Acceptance Criteria

- [ ] `sessions` table has `drain_requested` column (migration only, non-destructive)
- [ ] `PATCH /api/sessions/:id/stop` sets `drain_requested = true`, returns 200 + updated session
- [ ] Supervisor loop skips spawning when `drain_requested = true`
- [ ] When drain active + no active workers → `loop_status = 'stopped'` (not `'failed'`)
- [ ] "End Session" button visible only when `endStatus === 'running'`
- [ ] Confirmation dialog shown before drain is triggered
- [ ] Draining UI: "Stopping..." badge + active worker count while drain in progress
- [ ] `'stopped'` renders in amber/neutral with "Session ended by user" label
- [ ] Naturally completed sessions (loop_status='stopped', drain_requested=false) still render as 'completed' (green)
- [ ] The existing `POST /api/sessions/:id/stop` hard-stop is NOT modified

## Out of Scope

- Polling/websocket mechanism to update drain state in real-time (the session
  detail page will need a manual refresh to see the final stopped state)
- Persisting `drain_requested` state per-session in the SessionRunner in-memory
  (reads from DB each tick — 30s interval, negligible overhead)
- Modifying the auto-pilot skill or task files to support drain
