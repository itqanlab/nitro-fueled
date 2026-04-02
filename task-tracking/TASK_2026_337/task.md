# Task: Supervisor REST Controller — Session Control Endpoints


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

Create a NestJS REST controller at `apps/dashboard-api/src/supervisor/supervisor.controller.ts` that exposes HTTP endpoints for dashboard session control.

Endpoints: POST /api/supervisor/sessions (start new session with config body), POST /api/supervisor/sessions/:id/pause, POST /api/supervisor/sessions/:id/resume, POST /api/supervisor/sessions/:id/stop, GET /api/supervisor/sessions/:id/status. Delegates to SupervisorService. Uses existing auth guard pattern from other controllers.

References: Existing controllers in `apps/dashboard-api/src/dashboard/` for patterns. SupervisorService from companion task.

## Dependencies

- TASK_2026_338 — NestJS SupervisorService

## Acceptance Criteria

- [ ] All 5 REST endpoints respond correctly with proper HTTP status codes
- [ ] Controller delegates to SupervisorService for all operations
- [ ] Auth guard applied to all endpoints

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/supervisor/supervisor.controller.ts (new)


## Parallelism

Wave 3 — sequential after SupervisorService.
