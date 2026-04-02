# Implementation Plan — TASK_2026_169

## Current State

The codebase already contains the first pass of the logs slice:

- Backend log endpoints exist in `apps/dashboard-api/src/dashboard/logs.service.ts` and `logs.controller.ts`.
- Frontend routing, sidebar entry, API client methods, and a `LogsComponent` view already exist under `apps/dashboard/src/app/views/logs/`.

This prep plan assumes the implement worker will finish and harden that slice rather than starting from scratch.

## Architecture Summary

Use the existing dashboard split:

- NestJS `LogsService` remains the aggregation layer for Cortex events, worker-derived log context, session summaries, and search.
- `LogsController` remains a thin HTTP wrapper around that service.
- Angular `LogsComponent` remains the single route-level page, using signals and existing shared navigation/components.
- Real-time behavior continues to flow through the existing dashboard WebSocket/event stream rather than a second live-transport path.

## Gaps To Close

### Backend data fidelity

- Worker logs currently derive mostly from task trace events/phases, not true worker output artifacts.
- Search currently appears event-only and should be verified against the full acceptance criteria.
- Time-range filtering needs to be explicit and consistently supported where required.
- Null/unavailable/not-found behavior in controller/service should distinguish missing resources from service unavailability.

### Frontend product completeness

- The page exists, but the implement worker should verify each tab against the task acceptance criteria instead of assuming the current pass is final.
- Worker and session views need to make investigation efficient, not just technically present.
- Live mode should merge streamed events cleanly with the baseline event list and avoid confusing duplicate or stale-only views.

### Contract alignment

- Dashboard API models and client methods must stay in sync with backend responses.
- Any added filters or richer payloads must be reflected in shared frontend types before wiring the UI.

## Implementation Approach

### Backend first

Stabilize the response contract before editing the UI. Confirm what data is already available from `CortexService`, extend `LogsService` only where acceptance criteria are not met, and keep controller logic minimal.

### Frontend second

Refine the existing logs route rather than replacing it. Keep the current single-page/tabbed structure unless a focused extraction is clearly needed for readability.

### Real-time last

Once the static browsing flows are correct, tighten the live-event behavior so active sessions get incremental updates without breaking filter/search expectations.

## File Strategy

### Expected backend files

- `apps/dashboard-api/src/dashboard/logs.service.ts`
- `apps/dashboard-api/src/dashboard/logs.controller.ts`
- `apps/dashboard-api/src/dashboard/cortex.service.ts`
- `apps/dashboard-api/src/dashboard/dashboard.module.ts`

### Expected frontend files

- `apps/dashboard/src/app/views/logs/logs.component.ts`
- `apps/dashboard/src/app/views/logs/logs.component.html`
- `apps/dashboard/src/app/views/logs/logs.component.scss`
- `apps/dashboard/src/app/services/api.service.ts`
- `apps/dashboard/src/app/models/api.types.ts`

## Verification Expectations

- Backend endpoints return stable, typed responses for events, worker detail, session detail, and search.
- `/logs` renders cleanly in desktop and mobile dashboard layouts.
- Live updates are observable for active event streams and do not regress non-live browsing.
- Build/test validation should include the affected dashboard frontend and API projects.
