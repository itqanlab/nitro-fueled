# Task: Server Restart Recovery — Reconstruct Active Sessions from DB


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

On NestJS server startup (OnModuleInit), the SessionManagerService should detect active sessions from the cortex DB and recover them. Currently, if the NestJS server restarts, all in-memory SessionRunner instances are lost and sessions silently die.

Recovery steps on startup:
1. Query cortex DB for sessions with loop_status='running' or loop_status='paused'
2. For each active session, check worker heartbeat freshness (last_heartbeat timestamp from workers table)
3. Workers with stale heartbeats (>5 min since last heartbeat) are marked as dead — run reconciliation (reset their tasks to CREATED for retry or BLOCKED if retries exhausted)
4. Workers with fresh heartbeats are assumed still running — their PIDs may be stale (different process tree after restart) but heartbeat proves liveness
5. For 'running' sessions: restart the tick loop (or SessionRunner) with the session's stored config
6. For 'paused' sessions: register them in the runners Map but do not start the loop
7. Log all recovery actions as events in cortex DB

This uses heartbeat-based liveness detection rather than PID checks, which makes it work correctly across server restarts where PIDs are no longer valid.

## Dependencies

- TASK_2026_244 -- provides the supervisor event wiring that recovered sessions need

## Acceptance Criteria

- [ ] SessionManagerService implements OnModuleInit with recovery logic
- [ ] Active sessions (running/paused) are detected from cortex DB on startup
- [ ] Workers with stale heartbeats (>5 min) are marked dead and tasks reconciled
- [ ] Running sessions resume their tick/polling loop with stored config
- [ ] All recovery actions logged as events in cortex DB for observability

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (add OnModuleInit recovery)
- apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts (add recovery queries)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (recovery types if needed)


## Parallelism

Depends on TASK_2026_244. Can run in parallel with tick scheduler and frontend tasks. Wave 2.
