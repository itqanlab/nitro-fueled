# Task: Worker Heartbeat Verification in Supervisor Tick Loop


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

Add heartbeat freshness checking to the SessionRunner.tick() method. On each tick, after checking worker health status, verify each active worker's last_heartbeat timestamp from the cortex DB. If a worker's last heartbeat is older than 5 minutes (configurable via STALE_HEARTBEAT_THRESHOLD_MS in auto-pilot.types.ts), mark it as dead: kill the process if PID is still alive, update worker status to 'failed', and reset the task to CREATED (for retry) or BLOCKED (if retries exhausted).

This replaces PID-based stuck detection as the primary liveness check and works correctly across server restarts where PIDs may be recycled. The existing health status check ('stuck', 'finished') remains as a secondary signal. Log heartbeat failures as WORKER_HEARTBEAT_STALE events.

## Dependencies

- TASK_2026_244 -- provides the supervisor event wiring for broadcasting heartbeat failures

## Acceptance Criteria

- [ ] SessionRunner.tick() checks last_heartbeat for each active worker via supervisorDb
- [ ] Workers with stale heartbeats (>5 min) are killed and tasks reconciled
- [ ] STALE_HEARTBEAT_THRESHOLD_MS is configurable in auto-pilot.types.ts (default 300000)
- [ ] Heartbeat failures logged as WORKER_HEARTBEAT_STALE events in cortex DB

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/session-runner.ts (add heartbeat check to tick)


## Parallelism

Depends on TASK_2026_244. Can run in parallel with tick scheduler and frontend tasks. Wave 2.
