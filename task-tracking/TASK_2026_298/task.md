# Task: Validate and fix Sessions List and Session Detail real API wiring


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | BUGFIX |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

SessionsListComponent (/sessions) and SessionDetailComponent (/sessions/:id) are already wired to real API but both files are modified in git — they may have bugs or incomplete implementations.

## Context
- sessions-list.component.ts — uses ApiService.getSessionHistory()
- session-detail.component.ts — uses ApiService.getSessionHistoryDetail(id)
- Both modified in current git working tree
- session-comparison.component.html and model-performance.component.html also modified

## What to do
1. Review current state of sessions-list component — ensure it displays correctly
2. Review session-detail component — ensure all sections (tasks, workers, timeline, logs) render
3. Validate session-comparison (/telemetry/session-comparison) works end to end
4. Validate model-performance (/telemetry/model-performance) works end to end
5. Remove any remaining fallback mock rows (FALLBACK_SESSION_ROWS, FALLBACK_MODEL_PERF_ROWS) if API is reliable
6. Ensure error states are handled gracefully

## Acceptance Criteria
- Sessions list loads and displays real sessions
- Session detail page renders all sections with real data
- Session comparison telemetry view works
- Model performance telemetry view works
- No fallback mock data in production paths

## Dependencies

- TASK_2026_297

## Acceptance Criteria

- [ ] Sessions list shows real session data
- [ ] Session detail renders tasks, workers, timeline, logs
- [ ] Session comparison telemetry works
- [ ] Model performance telemetry works
- [ ] No mock fallback data in normal flow

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html
- apps/dashboard/src/app/views/session-comparison/session-comparison.component.html
- apps/dashboard/src/app/views/model-performance/model-performance.component.html


## Parallelism

Can run in parallel with TASK_2026_299 (project view). Independent of workspace/sidebar.
