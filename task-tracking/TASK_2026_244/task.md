# Task: Dashboard API: Spawn Session Endpoint with Supervisor Model


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

Extend the existing POST /api/sessions endpoint to accept a supervisor_model field in the CreateSessionRequest body. Valid values: claude-haiku-4-5-20251001 (default), claude-sonnet-4-6, claude-opus-4-6. The session-runner should pass this model when spawning the supervisor Claude Code process (the --model flag on the claude CLI invocation). Workers continue to use per-task model settings from the task metadata, independent of the supervisor model. Update SupervisorConfig type to include supervisor_model field. Update DEFAULT_SUPERVISOR_CONFIG to default to claude-haiku-4-5-20251001. Update session creation validation to accept the new field. The key insight is that the supervisor loop is a state machine (query tasks, check health, spawn workers, route completions) that does not need an expensive model -- Haiku can run it for pennies while workers use the right model per task.

## Dependencies

- TASK_2026_243

## Acceptance Criteria

- [ ] SupervisorConfig type includes supervisor_model field with type string
- [ ] DEFAULT_SUPERVISOR_CONFIG defaults supervisor_model to claude-haiku-4-5-20251001
- [ ] POST /api/sessions accepts supervisor_model in request body with validation (only claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-6 accepted)
- [ ] SessionRunner passes supervisor_model as --model flag when spawning the supervisor Claude Code process
- [ ] Worker spawn continues to use per-task model from task metadata, not supervisor_model

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (SupervisorConfig update)
- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (CreateSessionRequest update)
- apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts (validation update)
- apps/dashboard-api/src/auto-pilot/session-runner.ts (pass model flag at spawn)
- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (pass config through)


## Parallelism

Can run in parallel with TASK_2026_243, TASK_2026_222, TASK_2026_229. No file overlap with dashboard frontend tasks. Wave 1.
