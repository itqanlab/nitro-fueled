# Handoff — TASK_2026_243

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified, +7 lines: preferred_provider, worker_mode TASK_MIGRATIONS)
- packages/mcp-cortex/src/tools/tasks.ts (modified, +2 entries: UPDATABLE_COLUMNS)
- apps/dashboard-api/src/dashboard/cortex.types.ts (modified, +8 lines: RawTask + CortexTaskContext new fields)
- apps/dashboard-api/src/dashboard/cortex-queries-task.ts (modified, +5 lines: TASK_COLS + mapTaskContext)
- apps/dashboard-api/src/dashboard/cortex.service.ts (modified, +23 lines: updateTask write-mode method)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (modified, +47 lines: PATCH /cortex/tasks/:id endpoint)
- apps/dashboard/src/app/models/api.types.ts (modified, +3 lines: CortexTaskContext model/provider/worker_mode)
- apps/dashboard/src/app/services/api.service.ts (modified, +10 lines: updateCortexTask method)
- apps/dashboard/src/app/views/task-detail/task-detail.component.ts (modified, +55 lines: editing signals + handlers)
- apps/dashboard/src/app/views/task-detail/task-detail.component.html (modified, +55 lines: inline dropdowns)
- apps/dashboard/src/app/views/task-detail/task-detail.component.scss (modified, +28 lines: meta-select styles)
- apps/dashboard/src/app/views/project/project.component.ts (modified, +85 lines: bulk edit signals + methods)
- apps/dashboard/src/app/views/project/project.component.html (modified, +62 lines: bulk edit panel + checkboxes)
- apps/dashboard/src/app/views/project/project.component.scss (modified, +75 lines: bulk edit CSS + grid update)

## Commits
- (committed below)

## Decisions
- Used PATCH /cortex/tasks/:id endpoint in dashboard-api (not direct MCP tool call) to keep frontend-API boundary clean
- Provider and worker_mode values validated server-side against allowlists for security
- model field is free-text to allow future models without frontend changes
- Bulk edit fires parallel PATCH calls (one per task), signals completion when all settle
- Checkbox uses stopPropagation to prevent row navigation when selecting

## Known Risks
- Bulk edit fires parallel requests — no server-side transaction; partial failures are reported but not rolled back
- Task list still uses MOCK_QUEUE_TASKS (static data), so checkbox state is ephemeral; context task fetching is real-API driven
- Pre-existing TS2769 error in task-detail.component.ts:88 (initialValue type mismatch) is unrelated to this task
