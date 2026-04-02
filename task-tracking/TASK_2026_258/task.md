# Task: Dashboard UI: Live Session Monitor via WebSocket


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Update the dashboard frontend to subscribe to real-time supervisor events via WebSocket instead of polling. When the user views a session, the component should join the session-specific WebSocket room and display live updates for:

- Worker spawned/completed/failed/killed events
- Task state transitions (claimed, completed, blocked)
- Supervisor heartbeats with tick health
- Session lifecycle events (started, paused, stopped)

Replace the current polling-based session monitoring in the session chat/monitor views with WebSocket subscriptions. Show a real-time worker status timeline, task progress indicators, and tick health (last tick time, tick count, consecutive failures). Add a connection status indicator showing WebSocket health.

This builds on the existing DashboardGateway WebSocket infrastructure and the new 'supervisor-event' messages added by TASK_2026_244.

## Dependencies

- TASK_2026_244 -- provides the WebSocket supervisor-event messages this subscribes to

## Acceptance Criteria

- [ ] Session view subscribes to WebSocket 'supervisor-event' messages for the active session
- [ ] Worker spawn/complete/fail events update the UI in real-time without polling
- [ ] Task state transitions shown as they happen (claimed, completed, blocked)
- [ ] Connection status indicator shows WebSocket health (connected/disconnected/reconnecting)
- [ ] Existing session monitoring functionality preserved (fallback to polling if WS unavailable)

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/services/websocket.service.ts (add supervisor-event subscription)
- apps/dashboard/src/app/views/sessions/ (update session monitor components)
- apps/dashboard/src/app/models/api.types.ts (supervisor event types)


## Parallelism

Depends on TASK_2026_244. Can run in parallel with backend Wave 2 tasks. Wave 2.
