# Task: Remove all dead mock data constants and files


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

Final cleanup after all screens are wired. Remove all mock data files and constants no longer referenced.

## Files to delete
- apps/dashboard/src/app/services/mock-data.constants.ts
- apps/dashboard/src/app/views/project/project.constants.ts
- apps/dashboard/src/app/services/model-assignment.constants.ts
- apps/dashboard/src/app/services/provider-hub.constants.ts
- apps/dashboard/src/app/services/session-mock.constants.ts
- apps/dashboard/src/app/services/session-mock.service.ts
- apps/dashboard/src/app/services/mock-data.service.ts

## What to do
1. Grep each file to confirm zero imports remain
2. Delete confirmed-dead files
3. Fix any TypeScript compilation errors
4. Run build to confirm clean compile

## Acceptance Criteria
- All listed mock files deleted
- No MOCK_* or FALLBACK_* in production code
- Build compiles cleanly

## Dependencies

- TASK_2026_313

## Acceptance Criteria

- [ ] All mock constant files deleted
- [ ] No MOCK_* imports in production code
- [ ] Build compiles cleanly

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/services/mock-data.constants.ts
- apps/dashboard/src/app/services/mock-data.service.ts
- apps/dashboard/src/app/services/session-mock.service.ts


## Parallelism

Must run last — depends on all other tasks.
