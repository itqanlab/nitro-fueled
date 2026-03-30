# Task Description — TASK_2026_157

## Problem

The dashboard can navigate to `/session/:sessionId`, but there is no session viewer route or UI to show what an active Claude session is doing.

## User-Facing Outcome

Users can open `/session/:sessionId` and watch a mock live stream of assistant output, tool calls, tool results, and orchestration phase changes in a chat-style viewer.

## Acceptance Criteria

- `/session/:sessionId` lazy-loads a session viewer component
- The stream renders assistant markdown safely
- Tool calls and tool results are visually distinct and collapsible
- Status events appear in the stream with phase/status context
- Auto-scroll follows new activity and pauses when the user scrolls away from the bottom
- The header shows session ID, task info, phase, duration, and status
- A mock session generator emits realistic messages over time
