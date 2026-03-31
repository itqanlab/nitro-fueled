# Handoff — TASK_2026_219

## Files Changed
- apps/dashboard/src/app/views/project/project.component.ts (modified, +9)
- apps/dashboard/src/app/views/project/project.component.html (modified, +38)
- apps/dashboard/src/app/views/project/project.component.scss (modified, +72)

## Commits
- (pending — implementation commit)

## Decisions
- Added `queueProcessed` computed: true when allTasks.length > 0 AND every task is in COMPLETE/FAILED/CANCELLED. This correctly excludes the filter-empty-state scenario.
- Banner is shown above (not replacing) list/kanban views so users can still see the task history.
- Failed and Cancelled stats are conditionally rendered (shown only when count > 0) to keep the banner clean when there are no failures.
- "Launch New Session" CTA opens the existing session form modal (reuses openSessionForm()).

## Known Risks
- `allTasks` is currently seeded from `MOCK_QUEUE_TASKS` (static). Once wired to a real API, the `queueProcessed` computed will respond reactively.
