# Handoff — TASK_2026_263

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified — added parent_task_id + subtask_order to TASK_MIGRATIONS, 2 indexes)
- packages/mcp-cortex/src/tools/subtask-tools.ts (new — handleCreateSubtask, handleBulkCreateSubtasks, handleGetSubtasks, handleGetParentStatusRollup)
- packages/mcp-cortex/src/index.ts (modified — import + 4 tool registrations)

## Commits
- (committed below alongside this file)

## Decisions
- parent_task_id and subtask_order added via TASK_MIGRATIONS (ALTER TABLE) rather than recreating tasks table — no constraint change needed
- Subtask ID `TASK_YYYY_NNN.M` stored as TEXT in existing `id` column — no schema change to the column itself
- Nesting rejection enforced at tool level: create_subtask queries parent.parent_task_id and errors if non-null
- Subtask task.md written with simplified template (no full template dependency since task-template.md path assumed in projectRoot)
- rmSync used for cleanup in create_subtask error path — imported at top

## Known Risks
- Subtask directories use dot in name (TASK_YYYY_NNN.M) — valid on all target OS but uncommon; existing TASK_ID_RE in task-creation.ts won't match these IDs (intentional — they are not created via create_task)
- No git commit from bulk_create_subtasks or create_subtask — callers must commit if desired (consistent with write-once tools like write_handoff)
- get_parent_status_rollup is a query helper — does NOT update the parent task status in DB; callers must call update_task separately
