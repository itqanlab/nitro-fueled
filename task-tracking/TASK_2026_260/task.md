# Task: Dashboard UI: Tick Health Dashboard Card


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Simple |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add a tick health card to the session monitor view that shows supervisor tick metrics: last tick time, total tick count, consecutive tick failures, average tick duration, and tick interval configuration. This card provides observability into the supervisor's heartbeat — if ticks stop or start failing, the user can see it immediately.

Data sources:
- TICK_COMPLETED and TICK_FAILED events from cortex DB (via the existing cortex polling or WebSocket)
- Session config for tick interval
- Calculated metrics: success rate, average duration, time since last tick

The card should show a green/yellow/red health indicator based on: green (last tick <2x interval ago), yellow (last tick 2-5x interval), red (last tick >5x interval or 3+ consecutive failures).

## Dependencies

- TASK_2026_244 -- provides WebSocket events including tick events

## Acceptance Criteria

- [ ] Tick health card shows last tick time, tick count, consecutive failures
- [ ] Green/yellow/red health indicator based on tick freshness
- [ ] Average tick duration displayed
- [ ] Card updates in real-time via WebSocket events

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/sessions/ (tick health card component)
- apps/dashboard/src/app/models/api.types.ts (tick health types)


## Parallelism

Depends on TASK_2026_244. Can run in parallel with other dashboard UI tasks. Wave 3.
