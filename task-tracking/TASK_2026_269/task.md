# Task: Dashboard API: Subtask Data in Task Response


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Extend the dashboard-api task endpoints to include subtask data in the task response. When fetching a task that has subtasks, the response should include a `subtasks` array ordered by subtask_order.

Changes to the dashboard-api module:
1. Update `cortex-queries-task.ts` to call `get_subtasks` when fetching a task, including subtask results in the response
2. Update `cortex.types.ts` to define the subtask type, extending the task response type with a subtasks array

The subtask data per entry: id, title, status, complexity, model, subtask_order, file_scope. Tasks without subtasks return an empty subtasks array.

## Dependencies

- TASK_2026_263 -- provides get_subtasks tool

## Acceptance Criteria

- [ ] Task response includes subtasks array (ordered by subtask_order) when a task has children
- [ ] Subtask entries include id, title, status, complexity, model, subtask_order, file_scope
- [ ] Tasks without subtasks return empty subtasks array

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/dashboard/cortex-queries-task.ts (modified)
- apps/dashboard-api/src/dashboard/cortex.types.ts (modified)


## Parallelism

Can run in parallel with TASK_2026_264-267. Only depends on schema task.
