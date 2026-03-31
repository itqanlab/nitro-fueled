# Handoff — TASK_2026_202

## Files Changed

- apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts (modified, +20 lines — added PATCH :id/stop drain endpoint)
- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (modified, +1 line — added 'draining' to SessionActionResponse.action union)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (modified, +8 lines — added drainSession() facade method)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (modified, +1 line — added drainRequested to SessionStatusResponse)
- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (modified, +7 lines — added drainSession() method)
- apps/dashboard-api/src/auto-pilot/session-runner.ts (modified, +1 line — populated drainRequested in getStatus())
- apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts (modified, +16 lines — added setDrainRequested/getDrainRequested)
- apps/dashboard-api/src/dashboard/cortex.types.ts (modified, +2 lines — added drain_requested to CortexSession and RawSession)
- apps/dashboard-api/src/dashboard/cortex-queries-task.ts (modified, +2 lines — added drain_requested to SESSION_COLS, mapSession mapping)
- apps/dashboard-api/src/dashboard/sessions-history.service.ts (modified, +4 lines — added 'stopped' to SessionEndStatus, updated deriveEndStatus)
- packages/mcp-cortex/src/db/schema.ts (modified, +1 line — added drain_requested to SESSION_MIGRATIONS)
- apps/dashboard/src/app/models/api.types.ts (modified, +3 lines — added 'stopped' to SessionEndStatus, drainRequested to SessionHistoryDetail, CortexSession)
- apps/dashboard/src/app/services/api.service.ts (modified, +6 lines — added drainSession() PATCH method)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts (modified, +4 lines — added drain signals, drain methods, statusColor 'stopped')
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html (modified, +50 lines — added End Session button, confirmation dialog  draining badge)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts (modified, +1 line — added 'stopped' to statusColor)

## Commits

- (pending): feat(auto-pilot): implement graceful session drain — TASK_2026_202

## Decisions

- Used `drain_requested` as the column name (INTEGER 0/1) matching existing `drain_requested` column already present in the schema from prior work
- `PATCH /api/sessions/:id/stop` triggers graceful drain; existing `POST /api/sessions/:id/stop` hard-kills unchanged
- `deriveEndStatus` distinguishes `drain_requested=1 && loop_status=stopped` as `'stopped'` vs natural `'completed'`
- Frontend uses optimistic `isDraining` signal — user sees draining state immediately after click
- Used inline confirmation dialog with `showConfirmDialog` signal (no NzModal dependency)

## Known Risks

- No real-time websocket/polling for drain state — user must refresh to see final stopped state
- `drain_requested` column was added via migration but existing sessions will have `0` (not drained), which is correct behavior
- The `session-detail.component.html` drain UI has not been styled yet — CSS classes need to be added to the component's SCSS
- `orchestration.component.ts` has pre-existing compilation errors unrelated to this task
