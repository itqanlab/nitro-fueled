# Task: SupervisorEngine — Recovery, Guards & Cost Enforcement


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
| Worker Mode           | [single | split]                                                              |







## Description

Extend the SupervisorEngine with startup recovery, pre-exit orphan guard, and cost budget enforcement.

Startup recovery: on engine.start(), detect stale sessions with orphaned workers (dead PID or stale heartbeat), release their tasks back to CREATED. Pre-exit orphan guard: before engine.stop(), check for IMPLEMENTED tasks with no running review worker and spawn one if slots available. Cost enforcement: each cycle calls budget.checkBudget() on active workers and kills any that exceed their complexity-based cost limit.

References: health.ts recoverStaleSession(), budget.ts checkBudget(). Engine from previous task.

## Dependencies

- TASK_2026_336 — SupervisorEngine Core Event Loop

## Acceptance Criteria

- [ ] Startup recovery detects and handles orphaned workers from crashed sessions
- [ ] Pre-exit orphan guard spawns review workers for IMPLEMENTED tasks before shutdown
- [ ] Over-budget workers are killed by circuit breaker during each cycle
- [ ] Unit tests cover: recovery with stale workers, orphan guard with/without slots, budget kill

## References

- task-tracking/task-template.md

## File Scope

- packages/mcp-cortex/src/supervisor/engine.ts (modify)
- packages/mcp-cortex/src/supervisor/engine.spec.ts (new)


## Parallelism

Wave 2 — sequential after SupervisorEngine Core.
