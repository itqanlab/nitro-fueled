# Task: Dashboard UI: Subtask Tree Display in Task Detail


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

Add subtask visualization to the Angular dashboard task detail view. When viewing a task that has subtasks, show them in an expandable tree with per-subtask status, model, complexity, and progress.

UI requirements:
1. **Subtasks section**: Show a "Subtasks" section in task detail when subtasks array is non-empty. Each row: order number, title, status badge (color-coded via nz-tag), complexity tag, model used.
2. **Parent rollup**: Show aggregated progress -- e.g., "3/4 subtasks complete" with nz-progress bar.
3. **Expandable/collapsible**: Use nz-collapse for the subtask list. Expanded by default in detail view.
4. **Click-through**: Clicking a subtask navigates to its detail (reuse existing task detail with subtask context).

Use NG-ZORRO components: nz-collapse, nz-tag, nz-progress, nz-list.

## Dependencies

- TASK_2026_268 -- provides subtask data in API response

## Acceptance Criteria

- [ ] Task detail page shows Subtasks section with per-subtask status badge, complexity, model, and order number
- [ ] Parent task shows rollup progress bar when it has subtasks
- [ ] Subtask list is expandable/collapsible using nz-collapse

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/dashboard/dashboard.component.ts (modified)
- apps/dashboard/src/app/views/dashboard/dashboard.component.html (modified)
- apps/dashboard/src/app/services/mock-data.constants.ts (modified -- add mock subtask data)


## Parallelism

Can run in parallel with orchestration tasks (264-267). Depends on API task (268). No file overlap with other subtask tasks.
