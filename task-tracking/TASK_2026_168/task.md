# Task: Project Tasks List — Search & Filters

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Enhance the project tasks list page with search and rich filtering capabilities. Currently the task list shows all tasks but lacks the ability to quickly find specific tasks or filter by criteria.

Required capabilities:

1. **Search Bar** — Full-text search across task ID, title, and description. Debounced input, instant results
2. **Status Filter** — Multi-select filter for task status (CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, FAILED, BLOCKED, CANCELLED)
3. **Type Filter** — Multi-select filter for task type (FEATURE, BUGFIX, REFACTORING, etc.)
4. **Priority Filter** — Filter by priority level (P0-P3)
5. **Date Range Filter** — Filter tasks by creation date range
6. **Model Filter** — Filter by assigned model
7. **Sort Options** — Sort by ID, status, priority, creation date, type
8. **Active Filter Chips** — Show active filters as removable chips above the list
9. **URL Persistence** — Filter state persisted in query params so filtered views are shareable/bookmarkable
10. **Result Count** — Show total matching tasks count

## Dependencies

- None

## Acceptance Criteria

- [ ] Search bar filters tasks by ID, title, and description with debounced input
- [ ] Status, type, priority, and date filters work independently and in combination
- [ ] Active filters shown as removable chips
- [ ] Filter state reflected in URL query params
- [ ] Sort by all available columns works correctly

## Parallelism

✅ Can run in parallel — modifies existing project task list components, no overlap with other CREATED tasks.

## References

- Project page: `apps/dashboard/src/app/pages/project/`
- NG-ZORRO table/filter components
- Dashboard API task endpoints

## File Scope

- apps/dashboard/src/app/pages/project/ (enhance existing task list component)
- apps/dashboard-api/src/dashboard/ (add query params to task list endpoint)
