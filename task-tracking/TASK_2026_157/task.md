# Task: Live Session Chat UI — Real-Time Session Viewer

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

Part 3 of 4 — original request: Web-based Auto-Pilot Control Center.

Build a chat-like UI component that displays a running Claude Code session in real-time. This is the core viewer where users watch what auto-pilot is doing — what Claude outputs, what tools it calls, what files it edits.

**What to build:**

1. **Session viewer route** — `/session/:sessionId` route, lazy-loaded.

2. **Chat-like message stream** — Scrollable container showing session output as a message stream:
   - **Assistant messages** — Claude's text output, rendered with markdown support
   - **Tool calls** — Distinct visual treatment: tool name, parameters (collapsible), colored border
   - **Tool results** — Collapsible result blocks (file contents, command output)
   - **Status events** — Phase transitions (PM started, Architect started, etc.), task status changes
   - Each message has a timestamp

3. **Auto-scroll** — Automatically scrolls to the latest message. User can scroll up to review history; auto-scroll resumes when they scroll back to bottom.

4. **Session header** — Shows: session ID, associated task ID + title, current phase, duration, status (running/completed/failed).

5. **WebSocket streaming** — Subscribe to session events via WebSocket. For now: mock WebSocket that emits fake messages on an interval simulating a Claude session (text output, tool calls, phase changes).

6. **Mock message generator** — Service that generates realistic mock session messages: "Reading task.md...", tool call to Read, architect output, etc. Emits messages every 1-3 seconds to simulate a live session.

## Dependencies

- TASK_2026_155 — Project Page (navigation source for clicking into sessions)

## Acceptance Criteria

- [ ] `/session/:sessionId` route loads the session viewer
- [ ] Chat stream renders assistant messages with markdown
- [ ] Tool calls show distinctly with tool name and collapsible params/results
- [ ] Phase transition events display as status badges in the stream
- [ ] Auto-scroll follows new messages, pauses when user scrolls up
- [ ] Session header shows task info, phase, duration, status
- [ ] Mock message generator simulates a realistic Claude session stream

## References

- WebSocket service: `apps/dashboard/src/app/services/websocket.service.ts`
- Session model: `apps/dashboard/src/app/models/session.model.ts`
- Routes: `apps/dashboard/src/app/app.routes.ts`

## File Scope

- `apps/dashboard/src/app/views/session-viewer/session-viewer.component.ts` (new)
- `apps/dashboard/src/app/views/session-viewer/session-viewer.component.html` (new)
- `apps/dashboard/src/app/views/session-viewer/session-viewer.component.scss` (new)
- `apps/dashboard/src/app/models/session-viewer.model.ts` (new)
- `apps/dashboard/src/app/services/session-mock.constants.ts` (new — scripted mock session payloads)
- `apps/dashboard/src/app/services/session-mock.service.ts` (new — mock message generator)
- `apps/dashboard/src/app/app.routes.ts` (modified — add /session/:id route)
- `apps/dashboard/src/app/models/analytics.model.ts` (modified — restore exported analytics view-model type needed for dashboard build verification)

## Parallelism

✅ Can run in parallel with TASK_2026_155 — no overlapping files except `app.routes.ts` (minimal 1-line addition each). Can safely run in Wave 1 alongside TASK_2026_155.
