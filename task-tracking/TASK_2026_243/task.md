# Task: Per-Task Model/Provider Editor in Dashboard


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
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

Add inline editing capability for model, provider, and worker_mode fields on the task detail page. When a user clicks on a task in the project task list, the detail view should allow editing these three fields via dropdowns populated from cortex DB (available models from get_available_providers, worker_mode: single/split). Changes are saved via the existing update_task MCP tool. Additionally, add bulk edit support: selecting multiple tasks via checkboxes in the task list and applying model/provider/worker_mode changes to all selected tasks in one action. This enables the Product Owner to configure per-task execution strategy before launching a session.

## Dependencies

- TASK_2026_166 -- provides the Rich Task Detail Page this builds on

## Acceptance Criteria

- [ ] Task detail page shows editable dropdowns for model, provider, and worker_mode fields
- [ ] Dropdown options are populated dynamically from cortex DB (get_available_providers for providers, hardcoded model list per provider)
- [ ] Changes saved via update_task MCP tool with success/error feedback
- [ ] Bulk edit: checkbox selection in task list + apply model/provider/worker_mode to all selected
- [ ] Existing task detail functionality is not broken

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/project/task-detail/ (existing detail component)
- apps/dashboard/src/app/views/project/project.component.ts (task list checkboxes)
- apps/dashboard/src/app/views/project/project.component.html (bulk edit UI)
- apps/dashboard/src/app/services/api.service.ts (update_task call)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (PATCH endpoint if needed)


## Parallelism

Can run in parallel with TASK_2026_218 and TASK_2026_219. No file overlap. Wave: after TASK_2026_166 (IMPLEMENTED).
