# Plan — TASK_2026_127

## Architecture

Keep the task option arrays in a dedicated constants module so the Angular component only owns state and submission logic.

## Implementation Steps

1. Add typed task option arrays to `apps/dashboard/src/app/services/new-task.constants.ts`.
2. Replace the component's inline arrays with imports from the shared constants module.
3. Ensure the component remains under the 150-line file limit.
4. Verify the dashboard app still type-checks.

## Notes

- The constants file already exists, so this stays a minimal refactor.
- The component should continue using the shared API union types for each option list.
