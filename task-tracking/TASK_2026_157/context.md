# Context — TASK_2026_157

- Type: FEATURE
- Priority: P1-High
- Complexity: Medium
- Dependency: `TASK_2026_155` is `COMPLETE`
- Target surface: `apps/dashboard`

## Goal

Add a lazy-loaded `/session/:sessionId` route that shows a live, chat-like session viewer with a mock streaming source.

## Constraints

- Follow Angular standalone component patterns already used in `apps/dashboard`
- Use `ChangeDetectionStrategy.OnPush`
- Sanitize markdown before rendering HTML
- Keep the implementation mock-driven and self-contained until real session APIs exist

## Existing References

- `apps/dashboard/src/app/app.routes.ts`
- `apps/dashboard/src/app/services/websocket.service.ts`
- `apps/dashboard/src/app/services/project.constants.ts`
- `apps/dashboard/src/app/views/project/project.component.ts`
