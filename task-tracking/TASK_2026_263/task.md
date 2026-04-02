# Task: Cortex DB Schema: Subtask Support


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add subtask support to the Cortex MCP SQLite schema. This is the foundational data layer for the subtask system -- all other subtask tasks depend on this.

Schema changes to the existing `tasks` table:
1. **`parent_task_id`** column (TEXT, nullable FK to tasks.id) -- null means top-level task, non-null means subtask of that parent
2. **`subtask_order`** column (INTEGER, nullable) -- 1-indexed sequential ordering within a parent task

Subtask ID format: `TASK_YYYY_NNN.M` where M is 1-indexed (e.g., TASK_2026_261.1, TASK_2026_261.2). The dot notation is the subtask identifier -- M is sequential within the parent.

New MCP tools:
- **`create_subtask`** -- creates a single subtask under a parent task. Validates parent exists, parent is not itself a subtask (flat only -- no nesting), auto-assigns next M value. Creates task.md + status file on disk.
- **`bulk_create_subtasks`** -- creates multiple subtasks in one call with sequential ordering. Same validations.
- **`get_subtasks`** -- returns ordered subtasks for a given parent_task_id.

Parent status derivation logic (query helper, not auto-trigger):
- All subtasks COMPLETE -> parent can advance to IMPLEMENTED
- Any subtask FAILED -> parent should be flagged BLOCKED
- Expose as `get_parent_status_rollup(parent_task_id)` query tool

Key constraints:
- Subtasks are always flat -- reject create_subtask if parent_task_id itself has a non-null parent_task_id
- parent_task_id FK must reference an existing task
- subtask_order must be unique within a parent

## Dependencies

- TASK_2026_222 -- provides the extended cortex schema this task adds columns to

## Acceptance Criteria

- [ ] tasks table has parent_task_id (nullable TEXT FK) and subtask_order (nullable INTEGER) columns added via migration
- [ ] create_subtask MCP tool creates a subtask with TASK_YYYY_NNN.M format ID, validates no nesting, writes task.md + status file
- [ ] bulk_create_subtasks MCP tool creates multiple subtasks with sequential ordering in one call
- [ ] get_subtasks(parent_task_id) returns subtasks ordered by subtask_order
- [ ] Nesting rejection: create_subtask returns error if parent is itself a subtask

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/db/schema.ts (modified -- add columns + migration)
- packages/mcp-cortex/src/tools/subtask-tools.ts (new -- create_subtask, bulk_create_subtasks, get_subtasks, get_parent_status_rollup)
- packages/mcp-cortex/src/index.ts (modified -- register new tools)


## Parallelism

Cannot run in parallel with TASK_2026_222 (depends on it). Can run in parallel with all non-cortex-schema tasks.
