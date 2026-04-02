# Task: Sessions List: Checkbox Selection and Compare Button


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

Add checkbox selection to the sessions list page and a 'Compare' button that enables when exactly 2 sessions are selected. Clicking Compare navigates to the session comparison route with the two session IDs as query params. This is the entry point for the session comparison feature used to validate the Haiku-as-supervisor hypothesis.

## Dependencies

- TASK_2026_246

## Acceptance Criteria

- [ ] Sessions list rows have checkboxes for selection
- [ ] Compare button appears in list header, disabled by default
- [ ] Compare button enables when exactly 2 sessions are selected
- [ ] Clicking Compare navigates to /sessions/compare?a=SESSION_ID_1&b=SESSION_ID_2
- [ ] Selection state is preserved on navigation back from comparison view

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.scss


## Parallelism

Can run in parallel with all other tasks. No dependencies. Wave 1.
