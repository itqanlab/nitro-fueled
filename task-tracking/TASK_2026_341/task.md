# Task: Angular WebSocket Service for Live Supervisor Events


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

Create an Angular injectable service at `apps/dashboard/src/app/services/websocket.service.ts` that maintains a WebSocket connection and exposes typed RxJS Observable streams for real-time supervisor events (worker lifecycle, task state changes). Includes auto-reconnect with exponential backoff and connection status tracking.

## Dependencies

- TASK_2026_340 — NestJS SupervisorService

## Acceptance Criteria

- [ ] Service exposes typed Observable streams for supervisor events
- [ ] Auto-reconnect with exponential backoff on disconnect
- [ ] Connection status observable available for UI indicators

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/services/websocket.service.ts (new)


## Parallelism

Wave 4 — after Wave 3.
