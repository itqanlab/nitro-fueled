# Task: Session Comparison View -- Side-by-Side Model Cost/Performance


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P2-Medium |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Build the session comparison view that displays two sessions side-by-side. The comparison shows: supervisor model used, total cost, cost per task, average task duration, success rate, and worker model breakdown. Data comes from the existing session summary and cost breakdown APIs (TASK_2026_246 provides cost data, existing get_session_summary provides the rest). The route /sessions/compare reads session IDs from query params. Uses NG-ZORRO grid and statistic components for the layout.

## Dependencies

- TASK_2026_246 -- provides cost breakdown data per session
- TASK_2026_248 -- provides the sessions list compare button that navigates here

## Acceptance Criteria

- [ ] Route /sessions/compare renders comparison view reading a and b query params
- [ ] Side-by-side layout shows supervisor model, total cost, cost/task, avg duration, success rate per session
- [ ] Worker model breakdown shown per session (which models used, cost per model)
- [ ] View handles sessions with different task counts gracefully
- [ ] Back navigation returns to sessions list

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/sessions/session-comparison/session-comparison.component.ts
- apps/dashboard/src/app/views/sessions/session-comparison/session-comparison.component.html
- apps/dashboard/src/app/views/sessions/session-comparison/session-comparison.component.scss
- apps/dashboard/src/app/app.routes.ts (comparison route if not exists)


## Parallelism

Must run after TASK_2026_246 and TASK_2026_248. Wave 4.
