# Plan — TASK_2026_183

## Architecture
- Add a backend progress-center aggregation service in `apps/dashboard-api/src/dashboard/` that composes cortex sessions, workers, task traces, phase timings, and recent events into a single snapshot payload.
- Expose the snapshot through a new `GET /api/progress-center` endpoint.
- Extend the frontend WebSocket service to expose the existing `cortex-event` stream.
- Add a standalone Angular `ProgressCenterComponent` route that fetches the snapshot once, refreshes on WebSocket events, renders progress/health/activity sections, and emits browser notifications for completion/failure events.

## Decisions
- Use WebSocket-triggered snapshot refreshes instead of introducing a second live transport format.
- Keep ETA estimation heuristic and history-based by mapping stored cortex phase averages into the UI phase sequence.
- Reuse shared UI primitives (`app-progress-bar`, `app-empty-state`) instead of creating new one-off controls.

## Risks
- ETA quality depends on available historical phase timing data.
- The Angular workspace currently has unrelated compile failures that block a full dashboard build verification.
