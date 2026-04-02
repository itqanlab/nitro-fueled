# Prep Handoff — TASK_2026_169

## Implementation Plan Summary

The logs dashboard already exists as a first-pass vertical slice in both the NestJS API and Angular dashboard. The implementation worker should not rebuild it from scratch. Instead, treat the current logs backend and `/logs` view as the starting point, verify them against the task acceptance criteria, then harden the API contract, complete the UX, and finish the live-stream behavior.

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| apps/dashboard-api/src/dashboard/logs.service.ts | modify | Close gaps in events, worker detail, session detail, and search behavior |
| apps/dashboard-api/src/dashboard/logs.controller.ts | modify | Tighten query validation and response semantics |
| apps/dashboard-api/src/dashboard/cortex.service.ts | modify | Expose any extra Cortex data needed by the logs service |
| apps/dashboard/src/app/models/api.types.ts | modify | Keep frontend contracts aligned with backend payloads |
| apps/dashboard/src/app/services/api.service.ts | modify | Add or refine client request parameters for finalized logs APIs |
| apps/dashboard/src/app/views/logs/logs.component.ts | modify | Finish state management and live-update behavior |
| apps/dashboard/src/app/views/logs/logs.component.html | modify | Complete operator-facing event, worker, session, and search views |
| apps/dashboard/src/app/views/logs/logs.component.scss | modify | Support final layout and readability for dense log data |

## Batches

- Batch 1: Harden logs API contracts and backend data shaping — files: `apps/dashboard-api/src/dashboard/logs.service.ts`, `apps/dashboard-api/src/dashboard/logs.controller.ts`, `apps/dashboard-api/src/dashboard/cortex.service.ts`
- Batch 2: Align frontend contracts and complete logs dashboard UX — files: `apps/dashboard/src/app/models/api.types.ts`, `apps/dashboard/src/app/services/api.service.ts`, `apps/dashboard/src/app/views/logs/logs.component.ts`, `apps/dashboard/src/app/views/logs/logs.component.html`
- Batch 3: Finalize live updates and polish — files: `apps/dashboard/src/app/views/logs/logs.component.ts`, `apps/dashboard/src/app/views/logs/logs.component.scss`

## Key Decisions

- Keep the existing `LogsComponent` as the route-level shell instead of splitting into a new mini-module unless readability clearly demands it.
- Reuse the existing dashboard WebSocket event stream for live updates instead of introducing a dedicated logs socket channel.
- Prefer extending current backend contracts over adding a separate logs subsystem; the `LogsService` is the single aggregation layer.
- Treat the current code as partial implementation, not as proof that the task is already complete.

## Gotchas

- `logs.service.ts` and the `/logs` route already exist, so a naive “create logs page/service” implementation will waste time and likely conflict with current code.
- `getWorkerLogs` currently appears to derive worker detail from task-trace data, which may not satisfy the original “worker log output” intent without additional shaping.
- Controller methods currently use `null` both for unavailable data paths and not-found paths in places; verify semantics before wiring UI assumptions.
- Live events in the frontend are currently kept in a separate signal, so filtered browsing and live mode can drift unless merged deliberately.
