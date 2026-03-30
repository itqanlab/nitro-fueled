# Handoff — TASK_2026_169

## Files Changed
- apps/dashboard-api/src/dashboard/logs.service.ts (modified, +4 -3)
- apps/dashboard-api/src/dashboard/logs.controller.ts (modified, +8 -3)
- apps/dashboard/src/app/views/logs/logs.component.ts (modified, full rewrite)
- apps/dashboard/src/app/views/logs/logs.component.html (modified, full rewrite)
- apps/dashboard/src/app/views/logs/logs.component.scss (modified, +15)

## Commits
- TBD: feat(logs): harden API contracts and complete logs dashboard UX for TASK_2026_169

## Decisions

- `getWorkerLogs` now returns `null | undefined | WorkerLogEntry` to distinguish DB-unavailable (503) from worker-not-found (404). This required updating the return type and controller handler.
- Template method calls eliminated by introducing enriched computed signal arrays (`displayEvents`, `enrichedWorkers`, `enrichedWorkerDetail`, `enrichedSessionDetail`, `enrichedSearchResults`). Each enriched item carries precomputed `typeClass` and `formattedData` — no method calls remain in the template.
- Live events now flow through the same filter pipeline as historical events via `displayEvents`. The separate unfiltered live branch is removed — the live banner shows count but display uses unified filtered view.
- Search effect extended to track `searchSessionFilter`, `searchTaskFilter`, `searchStartTime`, `searchEndTime` changes so any filter change re-triggers the search automatically.
- Added `debounceTime(200)` to the search pipeline to avoid per-keystroke API calls.
- Worker events search added within the worker detail panel (`workerSearchQuery` signal + `filteredEvents` in enriched worker detail).
- Time range inputs (datetime-local) added to the search tab for start/end time filtering.
- `EventFilters` interface and `LogTab` type kept at module scope in component file (component-only concern).

## Known Risks
- The build has pre-existing TypeScript errors in other components (orchestration, model-performance, etc.) unrelated to this task. The logs component itself compiles cleanly.
- `getSessionLogs` still returns an empty summary for unknown session IDs rather than 404. Returning an empty summary is acceptable UX (no events for that ID), so this is left as-is.
- Worker phases use `worker_run_id` filter which falls back to task-level events if no worker-scoped phases exist — this is the existing behavior.
