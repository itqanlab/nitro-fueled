# Task: Audit and fix Logs screen


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

LogsComponent (/logs) is a lazy-loaded view. ApiService.getLogEvents() and searchLogs() exist.

## What to do
1. Read apps/dashboard/src/app/views/logs/ (all files)
2. Identify mock data, hardcoded data, broken API wiring
3. Verify getLogEvents(filters) works with all filter options
4. Verify searchLogs(query) works
5. Verify getWorkerLogs() and getSessionLogs() work
6. Fix any issues

## Acceptance Criteria
- Log events load from real API
- Search works
- Filters work
- No mock data used

## Dependencies

- TASK_2026_309

## Acceptance Criteria

- [ ] Log events load from getLogEvents() API
- [ ] Search works via searchLogs()
- [ ] Filters work
- [ ] No mock data

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/logs/


## Parallelism

Independent. Can run in parallel with other P1 audit tasks.
