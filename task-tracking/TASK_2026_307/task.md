# Task: Audit and fix Progress Center screen


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

ProgressCenterComponent (/progress) is a lazy-loaded view that has not been audited. ApiService.getProgressCenter() exists.

## What to do
1. Read apps/dashboard/src/app/views/progress-center/ (all files)
2. Identify mock data, broken API wiring, hardcoded data
3. Verify getProgressCenter() call works end to end
4. Verify WebSocket/real-time updates if any
5. Fix any issues found

## Acceptance Criteria
- Progress Center loads real data from API
- No mock data used
- Real-time updates work if applicable

## Dependencies

- TASK_2026_306

## Acceptance Criteria

- [ ] Progress Center uses getProgressCenter() API
- [ ] No mock data
- [ ] Real-time updates functional

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/progress-center/


## Parallelism

Independent. Can run in parallel with other P1 audit tasks.
