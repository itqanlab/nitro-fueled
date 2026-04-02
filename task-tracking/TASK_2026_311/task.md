# Task: Audit and fix Task Detail screen


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

TaskDetailComponent (/project/task/:taskId) is a lazy-loaded view. API methods exist: getTask(), getTaskReviews(), getTaskPipeline().

## What to do
1. Read apps/dashboard/src/app/views/task-detail/ (all files)
2. Identify mock data, hardcoded data, broken API wiring
3. Verify getTask(id) loads task definition + registry record + completion report
4. Verify getTaskPipeline(id) loads pipeline view
5. Verify getTaskReviews(id) loads reviews tab
6. Fix any issues

## Acceptance Criteria
- Task detail loads from getTask() API
- Pipeline tab works
- Reviews tab works
- No mock data used

## Dependencies

- TASK_2026_310

## Acceptance Criteria

- [ ] Task detail loads from real API
- [ ] Pipeline tab functional
- [ ] Reviews tab functional
- [ ] No mock data

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/task-detail/


## Parallelism

Independent. Can run in parallel with other P1 audit tasks.
