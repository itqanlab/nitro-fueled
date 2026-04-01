# Task: Audit and fix Reports screen


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

ReportsComponent (/reports) is a lazy-loaded view that has not been audited. ApiService.getReportsOverview() exists.

## What to do
1. Read apps/dashboard/src/app/views/reports/ (all files)
2. Identify mock data, hardcoded data, broken API wiring
3. Verify getReportsOverview(params) call works with date range params
4. Fix any issues found

## Acceptance Criteria
- Reports screen loads real data from API
- Date range filter works
- No mock data used

## Dependencies

- TASK_2026_307

## Acceptance Criteria

- [ ] Reports screen uses getReportsOverview() API
- [ ] Date range filter works
- [ ] No mock data

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/reports/


## Parallelism

Independent. Can run in parallel with other P1 audit tasks.
