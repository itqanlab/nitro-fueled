# Plan — TASK_2026_157

## Approach

1. Add a dedicated session viewer model to keep route state, header data, and stream message unions typed.
2. Implement a mock session stream service that derives session metadata from existing mock task data and emits a scripted event sequence on a timer.
3. Add a standalone `SessionViewerComponent` that:
   - reads and validates `sessionId` from the route,
   - subscribes to the mock stream,
   - renders assistant markdown safely,
   - manages auto-scroll pause/resume behavior.
4. Register the new lazy route in `app.routes.ts`.
5. Verify with an Angular build.

## Risks

- Markdown rendering must stay sanitized.
- Auto-scroll should not fight the user when reviewing older messages.
- Mock session metadata should still render useful task context for unknown session IDs.
