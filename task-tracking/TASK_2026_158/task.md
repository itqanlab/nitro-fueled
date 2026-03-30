# Task: Session Monitor — Active Sessions List + Switching

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Part 4 of 4 — original request: Web-based Auto-Pilot Control Center.

Build the session monitoring layer that ties the project page and session viewer together. Users can see all active sessions, switch between them, and get a high-level overview of what each session is doing.

**What to build:**

1. **Active sessions panel** — Sidebar or panel on the project page showing all active auto-pilot sessions:
   - Session ID, associated task ID + title
   - Start time, duration
   - Current phase (PM / Architect / Dev / QA)
   - Last activity line (truncated)
   - Status indicator (running, idle, completed, failed)

2. **Session switching** — Click any active session to open its viewer (reuses TASK_2026_157 component). Switching sessions preserves scroll position of previous session.

3. **Backend endpoints** — Dashboard-API:
   - `GET /api/sessions/active` — returns list of active sessions with metadata
   - `GET /api/sessions/:id` — returns session detail with recent messages
   - WebSocket event: `session:update` — pushes status changes for all active sessions
   - All mocked for now

4. **Real-time updates** — Active sessions panel updates via WebSocket as sessions change state. New sessions appear, completed sessions move to a "recent" section.

5. **Integration with project page** — The active sessions panel is embedded in the project page layout, alongside the task queue from TASK_2026_155.

## Dependencies

- TASK_2026_155 — Project Page (layout integration)
- TASK_2026_156 — Auto-Pilot Trigger (sessions to monitor come from here)
- TASK_2026_157 — Session Viewer (the viewer component this task navigates to)

## Acceptance Criteria

- [ ] Active sessions panel shows all running sessions with metadata
- [ ] Each session shows task ID, phase, duration, last activity, status
- [ ] Clicking a session navigates to the session viewer
- [ ] `GET /api/sessions/active` endpoint returns mock active sessions
- [ ] WebSocket pushes session status updates in real time
- [ ] Panel updates live as sessions start/stop/change phase

## References

- Project page: TASK_2026_155
- Session viewer: TASK_2026_157
- Auto-pilot trigger: TASK_2026_156
- WebSocket service: `apps/dashboard/src/app/services/websocket.service.ts`
- Dashboard API: `apps/dashboard-api/src/`

## File Scope

- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts` (new)
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html` (new)
- `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.scss` (new)
- `apps/dashboard-api/src/sessions/sessions.controller.ts` (new)
- `apps/dashboard-api/src/sessions/sessions.service.ts` (new)
- `apps/dashboard/src/app/views/project/project.component.ts` (modified — embed panel)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_155 or TASK_2026_156 — modifies `project.component.ts`. Run in Wave 3 after TASK_2026_155, 156, 157 are all complete.
