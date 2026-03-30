# Handoff — TASK_2026_172

## Files Changed
- apps/dashboard/src/app/models/project-queue.model.ts (modified, +1)
- apps/dashboard/src/app/models/dashboard.model.ts (modified, +3)
- apps/dashboard/src/app/services/api.service.ts (modified, +1)
- apps/dashboard/src/app/views/project/project.component.ts (modified, +4)
- apps/dashboard/src/app/views/dashboard/dashboard.component.ts (modified, +2)
- apps/dashboard/src/app/views/dashboard/dashboard.component.html (modified, +4)
- apps/dashboard/src/app/views/dashboard/dashboard.component.scss (modified, +4)
- apps/dashboard/src/app/views/project/project.component.scss (modified, +2)
- apps/cli/src/utils/cortex-sync-tasks.ts (modified, +1)
- apps/cli/src/utils/cortex-db-init.ts (modified, +1)
- packages/mcp-cortex/src/tools/context.ts (modified, +1)
- packages/mcp-cortex/src/index.ts (modified, +1)
- apps/cli/src/utils/claude-md.ts (modified, +2)
- apps/dashboard/src/app/models/dashboard.model.spec.ts (modified, +6)
- apps/dashboard/src/app/services/mock-data.constants.ts (modified, +1)
- task-tracking/TASK_2026_172/tasks.md (overwritten)
- task-tracking/TASK_2026_172/handoff.md (overwritten)

## Commits
- (pending)

## Decisions
- CANCELLED was already present in all canonical type definitions (schema.ts, api.types.ts, dashboard.types.ts, task.enums.ts, registry.ts). The gaps were in consumer-side lists, lookup tables, and UI components — specifically kanban columns and filter dropdown in project.component.ts.
- FIXING was the primary missing status — absent from 9 locations across dashboard frontend, CLI, and MCP cortex tools. Added it to all status unions, SQL CHECK constraints, allowlists, kanban columns, filter dropdowns, status maps, CSS classes, and documentation.
- FIXING uses the same `--warning` color token as IN_REVIEW in SCSS since both represent work-in-progress states.

## Known Risks
- The cortex-db-init.ts SQL CHECK constraint change only affects new databases; existing databases need an ALTER TABLE or migration to add FIXING to the CHECK constraint.
- The pre-existing TS error in packages/mcp-cortex/src/index.ts:92 (Expected 2 arguments, but got 3) is unrelated to this task.
