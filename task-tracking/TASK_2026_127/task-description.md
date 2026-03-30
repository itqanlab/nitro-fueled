# Task Description — TASK_2026_127

## Goal

Move the inline task-type, priority, and complexity option arrays out of `new-task.component.ts` into `new-task.constants.ts`.

## Requirements

- Extract the component-level task option constants into the shared constants file.
- Update the component to import the shared constants.
- Keep the component below the 150-line review limit.
- Preserve all existing task creation behavior.

## Acceptance Criteria

- `TASK_TYPES`, `TASK_PRIORITIES`, and `TASK_COMPLEXITIES` are exported from `apps/dashboard/src/app/services/new-task.constants.ts`.
- `apps/dashboard/src/app/views/new-task/new-task.component.ts` imports and uses those constants.
- `apps/dashboard/src/app/views/new-task/new-task.component.ts` is under 150 lines.
- Dashboard task creation behavior is unchanged.
