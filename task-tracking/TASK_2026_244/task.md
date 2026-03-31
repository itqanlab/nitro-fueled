# Task: Dashboard API: Wire Supervisor Events to WebSocket Gateway


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P0-Critical |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | split |


## Description

The SessionRunner already runs a tick-based supervisor loop via setInterval inside the NestJS process. However, the emitEvent method only logs to debug -- supervisor events (worker:spawned, worker:completed, worker:failed, worker:killed, task:claimed, task:completed, task:blocked, supervisor:started, supervisor:stopped, supervisor:heartbeat) are never broadcast to the frontend via WebSocket.

Wire SessionRunner events through the existing DashboardGateway WebSocket server. Add an EventEmitter2 or direct injection pattern so SessionRunner (which is NOT injectable -- it is a plain class instantiated by SessionManagerService) can push events to the gateway. The gateway should emit these as 'supervisor-event' messages on a per-session room (clients join a room matching the sessionId). This enables the frontend to show real-time worker spawns, completions, failures, and health without polling.

Also add the supervisor_model field to SupervisorConfig (haiku default) so the session creation can specify which model the supervisor process uses when spawning workers.

## Dependencies

- None

## Acceptance Criteria

- [ ] SessionRunner events are broadcast via DashboardGateway WebSocket as 'supervisor-event' messages
- [ ] Clients can join a session-specific room to receive only that session's events
- [ ] SupervisorConfig includes supervisor_model field defaulting to claude-haiku-4-5-20251001
- [ ] All existing supervisor event types (worker:spawned, worker:completed, etc.) flow through WebSocket
- [ ] No regression in existing session lifecycle (start/pause/resume/stop)

## References

- apps/dashboard-api/src/auto-pilot/session-runner.ts (emitEvent method)
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts (existing WebSocket gateway)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (SupervisorEvent type)

## File Scope

- apps/dashboard-api/src/auto-pilot/session-runner.ts (wire emitEvent to gateway)
- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (pass event emitter)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (add supervisor_model to config)
- apps/dashboard-api/src/dashboard/dashboard.gateway.ts (add supervisor-event emission + rooms)
- apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts (EventEmitter2 wiring if needed)


## Parallelism

Can run in parallel with TASK_2026_222, TASK_2026_229, TASK_2026_247. No file overlap with schema tasks. Wave 1.
