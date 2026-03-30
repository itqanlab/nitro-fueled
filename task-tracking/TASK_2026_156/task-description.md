# Task Description — TASK_2026_156

## Summary

Add a mock auto-pilot control flow that lets the dashboard project page start a session, poll its status, and reflect the running state in the UI.

## Requirements

- Add `POST /api/auto-pilot/start` that accepts optional `{ taskIds?: string[], options?: { dryRun?: boolean } }` and returns a mock `{ sessionId, status: 'starting' }` payload.
- Add `POST /api/auto-pilot/stop` that accepts `{ sessionId: string }` and returns a mock success payload.
- Add `GET /api/auto-pilot/status/:sessionId` that returns a mock lifecycle progressing from `starting` to `running`.
- Extend the Angular API service with `startAutoPilot()`, `stopAutoPilot()`, and status polling support.
- Replace the placeholder project-page button handler with a real start flow, disable the action while the request is in flight, and transition to a running state after polling confirms it.

## Constraints

- Keep the backend mocked; do not invoke real MCP tools or spawn CLI processes.
- Preserve the current project-page structure from `TASK_2026_155` and make the smallest safe wiring change.
- Keep validation explicit at API boundaries and return human-readable errors.

## Acceptance Criteria

- `POST /api/auto-pilot/start` exists and returns a mock session id.
- `POST /api/auto-pilot/stop` exists and returns mock success.
- `GET /api/auto-pilot/status/:sessionId` exists and returns mock status data.
- `ApiService` exposes typed auto-pilot methods.
- Clicking the project-page button starts the flow, shows a loading state, and settles into a running state.
