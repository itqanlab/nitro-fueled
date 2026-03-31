# Task: Dashboard UI: Session Controls — Start/Pause/Resume/Stop


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add session lifecycle control buttons to the dashboard session view. The dashboard-api already exposes POST /api/auto-pilot/sessions/:id/pause, /resume, /stop, and /drain endpoints via the auto-pilot controller. The frontend needs UI controls that call these endpoints and reflect the session's current state.

Controls needed:
- Pause button (visible when session is 'running') -- calls POST /pause
- Resume button (visible when session is 'paused') -- calls POST /resume  
- Stop button (always visible for active sessions) -- calls POST /stop
- Drain button (stop after current workers finish) -- calls POST /drain

Buttons should be disabled while an action is in flight. State transitions update via the WebSocket supervisor-event stream (from TASK_2026_244) so the UI reflects changes immediately.

## Dependencies

- TASK_2026_244 -- provides WebSocket events for real-time state reflection

## Acceptance Criteria

- [ ] Pause/Resume/Stop/Drain buttons visible based on session loop_status
- [ ] Buttons call the correct dashboard-api endpoints
- [ ] UI reflects state changes via WebSocket events without manual refresh
- [ ] Buttons disabled while action is in-flight (prevent double-clicks)
- [ ] Error states shown if API calls fail

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/sessions/ (session control buttons)
- apps/dashboard/src/app/services/api.service.ts (pause/resume/stop/drain API calls)


## Parallelism

Depends on TASK_2026_244. Can run in parallel with other Wave 2 frontend tasks. Wave 2.
