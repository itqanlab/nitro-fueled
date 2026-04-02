# Task: Audit and fix Phase Timing and Task Trace telemetry screens


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

PhaseTimingComponent (/telemetry/phase-timing) and TaskTraceComponent (/telemetry/task-trace) have not been audited.

## What to do
1. Read apps/dashboard/src/app/views/telemetry/phase-timing/ (all files)
2. Read apps/dashboard/src/app/views/telemetry/task-trace/ (all files)
3. Verify getCortexPhaseTimings() wiring in phase timing
4. Verify getCortexTaskTrace() wiring in task trace
5. Check for mock or fallback data
6. Fix any issues

## Acceptance Criteria
- Phase Timing uses getCortexPhaseTimings() correctly
- Task Trace uses getCortexTaskTrace() correctly
- No mock data
- Filters functional in both screens

## Dependencies

- TASK_2026_312

## Acceptance Criteria

- [ ] Phase Timing wired to real API
- [ ] Task Trace wired to real API
- [ ] No mock data
- [ ] Filters work

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/model-performance/
- apps/dashboard/src/app/views/session-comparison/


## Parallelism

Independent. Can run in parallel with TASK_2026_312 (analytics).
