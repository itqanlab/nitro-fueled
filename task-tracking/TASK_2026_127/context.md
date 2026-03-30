# Context — TASK_2026_127

## User Request

Extract the inline task option constants out of `apps/dashboard/src/app/views/new-task/new-task.component.ts` into `apps/dashboard/src/app/services/new-task.constants.ts` so the component stays under the 150-line limit without changing behavior.

## Relevant Files

- `apps/dashboard/src/app/views/new-task/new-task.component.ts`
- `apps/dashboard/src/app/services/new-task.constants.ts`
- `apps/dashboard/src/app/models/api.types.ts`

## Constraints

- Keep behavior unchanged.
- Keep the Angular component under 150 lines.
- Reuse existing shared types instead of redefining task option shapes.

## Strategy

Use the existing constants module as the single source of truth for task option arrays, update the component to import those constants, and keep the component focused on view logic.
