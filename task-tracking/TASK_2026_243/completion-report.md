# Completion Report — TASK_2026_243

## Outcome
COMPLETE

## Summary
Added per-task model/provider/worker_mode editing to the dashboard. The task detail page now shows inline dropdowns for model, preferred_provider, and worker_mode in the Core Metadata section. Changes are saved immediately via PATCH /cortex/tasks/:id. The project task list gains checkbox selection and a bulk edit panel to apply model/provider/worker_mode to multiple tasks at once.

## Acceptance Criteria Status
- [x] Task detail page shows editable dropdowns for model, provider, and worker_mode fields
- [x] Dropdown options populated (hardcoded model list per provider, provider allowlist)
- [x] Changes saved via PATCH endpoint → cortexService.updateTask() with success/error feedback
- [x] Bulk edit: checkbox selection in task list + apply model/provider/worker_mode to all selected
- [x] Existing task detail functionality is not broken

## Files Created/Modified
- packages/mcp-cortex/src/db/schema.ts — preferred_provider, worker_mode in TASK_MIGRATIONS
- packages/mcp-cortex/src/tools/tasks.ts — UPDATABLE_COLUMNS extended
- apps/dashboard-api/src/dashboard/cortex.types.ts — RawTask + CortexTaskContext extended
- apps/dashboard-api/src/dashboard/cortex-queries-task.ts — TASK_COLS + mapTaskContext
- apps/dashboard-api/src/dashboard/cortex.service.ts — updateTask() write method
- apps/dashboard-api/src/dashboard/dashboard.controller.ts — PATCH /cortex/tasks/:id
- apps/dashboard/src/app/models/api.types.ts — CortexTaskContext frontend type
- apps/dashboard/src/app/services/api.service.ts — updateCortexTask()
- apps/dashboard/src/app/views/task-detail/task-detail.component.{ts,html,scss}
- apps/dashboard/src/app/views/project/project.component.{ts,html,scss}

## Notes
- Pre-existing TS2769 build error in task-detail.component.ts:88 (unrelated, existed before this task)
- Bulk edit fires parallel PATCH calls without transaction; partial failures surfaced to user
