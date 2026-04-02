# Task: Supervisor: Subtask-Aware Scheduling


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Update the tick-mode Supervisor to schedule subtasks independently when a parent task has been decomposed. This is the core scheduling change that makes subtasks actually execute.

Current behavior: Supervisor picks next task from queue, spawns one implement worker.
New behavior: When a task has subtasks, Supervisor spawns implement workers per subtask instead of for the parent.

Scheduling logic:
1. When picking next work unit, check if the task has subtasks (via get_subtasks MCP call)
2. If subtasks exist: schedule individual subtasks respecting their ordering/dependencies
3. Subtasks with no intra-parent dependencies can run in parallel (same as top-level parallel scheduling)
4. Subtasks with dependencies run sequentially (subtask N waits for subtask N-1 to COMPLETE)
5. If a subtask FAILS: retry just that subtask (not the whole parent). Respect max_retries from parent task.
6. Parent status rollup: after each subtask completion, check get_parent_status_rollup. When all subtasks COMPLETE, advance parent to IMPLEMENTED and trigger the review phase.
7. If any subtask is FAILED after retries exhausted, mark parent as BLOCKED.

The Supervisor tick loop must treat subtasks as first-class schedulable units -- they appear in the work queue alongside top-level tasks but are filtered/grouped by parent.

Parent-level dependencies still work as before: if parent TASK_A depends on parent TASK_B, TASK_A's subtasks cannot start until TASK_B is COMPLETE.

## Dependencies

- TASK_2026_263 -- provides subtask schema and query tools
- TASK_2026_264 -- provides prep worker decomposition (creates the subtasks to schedule)

## Acceptance Criteria

- [ ] Supervisor detects decomposed tasks and schedules subtasks individually instead of spawning a single implement worker for the parent
- [ ] Parallel subtasks (no intra-parent deps) are spawned concurrently; sequential subtasks wait for predecessors
- [ ] Failed subtask triggers retry of just that subtask, not the entire parent task
- [ ] Parent status advances to IMPLEMENTED when all subtasks reach COMPLETE
- [ ] Parent marked BLOCKED if any subtask exhausts retries and remains FAILED

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/session-runner.ts (modified -- subtask scheduling in tick loop)
- apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts (modified -- subtask queries)
- .claude/skills/auto-pilot/SKILL.md (modified -- subtask scheduling instructions)


## Parallelism

Cannot run in parallel with TASK_2026_263 or TASK_2026_264 (depends on both). Touches session-runner.ts which may overlap with other Phase 16 supervisor tasks.
