# Task: Supervisor REST API + WebSocket Events

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | required    |
| Worker Mode           | single      |

## Description

Build the API layer for the server-mode supervisor. Clients (dashboard, CLI, external tools) control and observe the supervisor through these endpoints.

**REST endpoints:**

1. `POST /api/supervisor/start` — start processing task queue with config (concurrency, launcher preference, priority filter, retry limit)
2. `POST /api/supervisor/stop` — stop processing, optionally kill running workers
3. `POST /api/supervisor/pause` — pause queue processing, keep running workers alive
4. `POST /api/supervisor/resume` — resume queue processing
5. `GET /api/supervisor/status` — current state (running/paused/stopped), active workers, queue depth
6. `POST /api/supervisor/direction` — send new direction mid-run (reprioritize, skip task, change config)

**WebSocket gateway:**

- `supervisor:state` — broadcast supervisor state changes
- `supervisor:worker-spawned` — new worker started
- `supervisor:worker-completed` — worker finished (with outcome)
- `supervisor:worker-failed` — worker failed/killed
- `supervisor:task-completed` — task finished all phases
- `supervisor:queue-updated` — queue changed (new task, dependency resolved)

Clients subscribe on connect and receive real-time events. Multiple clients can subscribe simultaneously.

## Dependencies

- TASK_2026_224 — Supervisor Service

## Acceptance Criteria

- [ ] All 6 REST endpoints implemented with proper DTOs and validation
- [ ] WebSocket gateway broadcasts all supervisor events
- [ ] Multiple clients can subscribe to events simultaneously
- [ ] Direction endpoint can modify supervisor behavior mid-run
- [ ] API documented with NestJS Swagger decorators

## References

- Supervisor service: TASK_2026_224
- Existing API patterns: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts`

## File Scope

- `apps/dashboard-api/src/supervisor/supervisor.controller.ts` (new)
- `apps/dashboard-api/src/supervisor/supervisor.gateway.ts` (new)
- `apps/dashboard-api/src/supervisor/dto/` (new)

## Parallelism

Can run in parallel with other tasks — new files only. Depends on TASK_2026_224.
