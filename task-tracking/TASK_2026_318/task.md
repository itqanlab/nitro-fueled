# Task: Add ARCHIVE status to dashboard frontend and API


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

Surface the ARCHIVE task status in the dashboard after it is added to cortex in TASK_2026_317.

## What to change
- Add ARCHIVE to TaskStatus type in dashboard
- Add muted gray badge style for ARCHIVE (visually distinct from CANCELLED)
- Exclude ARCHIVE from default task list in Project view
- Add 'Show archived' toggle filter in Project view
- Dashboard API: exclude ARCHIVE from GET /api/cortex/tasks by default, support ?status=ARCHIVE filter

## Acceptance Criteria
- ARCHIVE badge has distinct muted style
- Project view hides ARCHIVE tasks by default
- 'Show archived' filter toggle reveals them
- API excludes ARCHIVE unless explicitly requested

## Dependencies

- TASK_2026_317

## Acceptance Criteria

- [ ] ARCHIVE badge style is muted/distinct
- [ ] Project view excludes ARCHIVE by default
- [ ] Show archived toggle works
- [ ] API supports ?status=ARCHIVE filter

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/project/project.component.ts
- apps/dashboard-api/src/dashboard/dashboard.controller.ts


## Parallelism

Depends on TASK_2026_317 (cortex schema).
