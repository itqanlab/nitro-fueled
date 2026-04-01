# Task: Audit and fix Telemetry screens (phase-timing, task-trace)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Phase Timing and Task Trace telemetry screens have not been audited. Session Comparison and Model Performance are handled in TASK_2026_300.

## Screens
- /telemetry/phase-timing — PhaseTimingComponent
- /telemetry/task-trace — TaskTraceComponent

## What to do
1. Read PhaseTimingComponent — verify getCortexPhaseTimings() wiring
2. Read TaskTraceComponent — verify getCortexTaskTrace() wiring
3. Check for mock/fallback data
4. Ensure filter controls work
5. Ensure charts/tables render correctly with real data
6. Fix any broken wiring

## Acceptance Criteria
- Phase Timing uses getCortexPhaseTimings() correctly
- Task Trace uses getCortexTaskTrace() correctly
- No mock or fallback data
- Filters work against real API

## Dependencies

- TASK_2026_300

## Acceptance Criteria

- [ ] Phase Timing wired to real API
- [ ] Task Trace wired to real API
- [ ] No mock data
- [ ] Filters functional

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/telemetry/phase-timing/
- apps/dashboard/src/app/views/telemetry/task-trace/
- apps/dashboard-api/src/dashboard/dashboard.controller.ts


## Parallelism

Independent. Can run in parallel with TASK_2026_308 (analytics).
