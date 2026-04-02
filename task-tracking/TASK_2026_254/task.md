# Task: MCP Cortex: Auto-Close Stale Sessions on Supervisor Startup


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | BUGFIX |
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

When a new supervisor session starts (create_session), automatically detect and close any stale sessions that have loop_status='running' but no active workers and no heartbeat in the last 10 minutes. SESSION_2026-03-31T04-03-16 was still showing loop_status='running' long after it finished because close_stale_sessions was never called. The close_stale_sessions tool exists but requires manual invocation. This should happen automatically at startup as part of the reconciliation phase.

## Dependencies

- TASK_2026_253

## Acceptance Criteria

- [ ] create_session calls close_stale_sessions logic internally before creating the new session
- [ ] Sessions with loop_status='running', 0 active workers, and last_heartbeat > 10 min ago are closed
- [ ] Closed sessions get loop_status='completed' and ended_at timestamp
- [ ] Number of auto-closed sessions returned in create_session response for observability
- [ ] Does not close sessions that still have active workers

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/tools/
- packages/mcp-cortex/src/db/


## Parallelism

✅ Can run in parallel — modifies create_session behavior, no conflicts
