# Handoff — TASK_2026_217

## Files Changed

- apps/dashboard/src/app/models/api.types.ts (modified, +40 lines — 6 new analytics interfaces)
- apps/dashboard/src/app/services/api.service.ts (modified, +20 lines — 4 new API methods)
- apps/dashboard/src/app/views/analytics/model-performance/model-perf-analytics.adapters.ts (new, 113 lines)
- apps/dashboard/src/app/views/analytics/model-performance/model-perf-analytics.component.ts (new, 187 lines)
- apps/dashboard/src/app/views/analytics/model-performance/model-perf-analytics.component.html (new, 192 lines)
- apps/dashboard/src/app/views/analytics/model-performance/model-perf-analytics.component.scss (new, 429 lines)
- apps/dashboard/src/app/app.routes.ts (modified, +7 lines — analytics/model-performance route)
- apps/dashboard/src/app/services/mock-data.constants.ts (modified, +1 line — sidebar nav entry)

## Decisions

- Used HTML `<table>` for the heatmap (no charting library in the project) — CSS background-color drives the heat cells
- Three separate `toSignal()` streams for perf/launchers/recommendations — each can fail independently without breaking the others
- `filteredTasks` loaded on-demand when a cell is selected (not upfront) to avoid loading all task types at once
- `buildHeatMatrix()` uses `Map<model, Map<taskType, HeatCell>>` for O(1) cell lookups during rendering
- Route placed at `analytics/model-performance` (under analytics parent path, matching task spec)

## Known Risks

- `filteredTasks` uses `getCortexTasks({ type: taskType })` — if the API returns large task lists the task panel could be slow to render (max-height + overflow-y caps visual impact)
- `perfUnavailable` / `launchersUnavailable` / `recUnavailable` flags use mutable class properties (not signals) — change detection relies on effects setting them, which works with OnPush only because effects trigger markForCheck internally
