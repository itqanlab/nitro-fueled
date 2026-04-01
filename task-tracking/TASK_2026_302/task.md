# Task: Remove all remaining mock data constants and dead imports


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | REFACTORING |
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

Final cleanup task — after all screens are wired to real API, remove all mock data files and constants that are no longer referenced.

## Files to clean up
- apps/dashboard/src/app/services/mock-data.constants.ts (MOCK_PROJECTS, MOCK_SIDEBAR_SECTIONS, MOCK_MCP_*, MOCK_AGENTS, etc.)
- apps/dashboard/src/app/views/project/project.constants.ts (MOCK_QUEUE_TASKS)
- apps/dashboard/src/app/services/model-assignment.constants.ts (MOCK_MODEL_ASSIGNMENTS_DATA)
- apps/dashboard/src/app/services/provider-hub.constants.ts (MOCK_PROVIDER_HUB_DATA)
- apps/dashboard/src/app/services/session-mock.constants.ts (SESSION_VIEWER_SCRIPT)
- apps/dashboard/src/app/services/session-mock.service.ts
- apps/dashboard/src/app/services/mock-data.service.ts
- Any remaining FALLBACK_* constants in telemetry views

## What to do
1. Verify each file is no longer imported anywhere (grep)
2. Delete unused mock files
3. Remove unused MockDataService
4. Fix any TypeScript compilation errors
5. Run build to confirm clean compile

## Acceptance Criteria
- No mock-data.constants.ts imports anywhere
- No MOCK_* or FALLBACK_* constants referenced in production code
- Build compiles cleanly
- No TypeScript errors

## Dependencies

- TASK_2026_297
- TASK_2026_298
- TASK_2026_299
- TASK_2026_300
- TASK_2026_301
- TASK_2026_302
- TASK_2026_303
- TASK_2026_304
- TASK_2026_305
- TASK_2026_306
- TASK_2026_307
- TASK_2026_308
- TASK_2026_309

## Acceptance Criteria

- [ ] All mock constant files deleted
- [ ] No MOCK_* imports anywhere in production code
- [ ] MockDataService and SessionMockService removed
- [ ] Build compiles cleanly

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/services/mock-data.constants.ts
- apps/dashboard/src/app/services/mock-data.service.ts
- apps/dashboard/src/app/services/session-mock.service.ts


## Parallelism

Must run last — depends on all other tasks completing.
