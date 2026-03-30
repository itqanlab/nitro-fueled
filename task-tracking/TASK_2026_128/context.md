# Context — TASK_2026_128

## User Request

Extract inline interfaces from the dashboard, analytics, and agent-editor Angular files into dedicated `*.model.ts` modules without changing behavior.

## Relevant Files

- `apps/dashboard/src/app/views/dashboard/dashboard.component.ts`
- `apps/dashboard/src/app/models/dashboard.model.ts`
- `apps/dashboard/src/app/views/analytics/analytics.component.ts`
- `apps/dashboard/src/app/models/analytics.model.ts`
- `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts`
- `apps/dashboard/src/app/models/agent-editor.model.ts`

## Constraints

- Keep behavior unchanged.
- Move view-layer interfaces to model files.
- Do not touch unrelated dashboard work already in progress.

## Strategy

Verify the current dashboard component state first, then keep the refactor minimal by preserving the dashboard implementation as-is where it already satisfies the task and only extracting the analytics and agent-editor shapes that still exist inline.
