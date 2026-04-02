# Task: NestJS SupervisorService — Engine Lifecycle Manager


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

Create a NestJS injectable service at `apps/dashboard-api/src/supervisor/supervisor.service.ts` that wraps SupervisorEngine instances. The service manages a Map<sessionId, engine> with lifecycle methods: startSession(config), pauseSession(id), resumeSession(id), stopSession(id), getStatus(id). Also create the companion module file that registers the service and controller.

## Dependencies

- TASK_2026_336 — SupervisorEngine Recovery & Guards

## Acceptance Criteria

- [ ] Service creates and manages SupervisorEngine instances per session
- [ ] Lifecycle methods (start/pause/resume/stop) delegate to engine correctly
- [ ] Module registers service and controller for dependency injection

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/supervisor/supervisor.service.ts (new)
- apps/dashboard-api/src/supervisor/supervisor.module.ts (new)


## Parallelism

Wave 3 — parallel with CLI Mode.
