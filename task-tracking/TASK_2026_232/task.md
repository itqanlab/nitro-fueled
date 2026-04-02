# Task: Dashboard Reports Page

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | FEATURE     |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Build the frontend Reports page in the Angular dashboard. Consumes the reporting API from TASK_2026_231 to show visual, filterable reports.

**Page sections:**

1. **Session Summary** — select a session, see: tasks completed/failed, total cost, duration, launcher/model breakdown (pie charts or bar charts)

2. **Model Performance** — table/heatmap showing per-model metrics: success rate, avg cost, avg duration, review pass rate. Click a cell to filter task list.

3. **Launcher Comparison** — side-by-side cards comparing launchers: success %, cost per task, speed, task types handled. Highlights the "recommended" launcher per task type.

4. **Cost Trends** — line chart showing cost over time. Toggle: daily/weekly/monthly. Filter by launcher/model.

5. **Task History** — filterable, sortable table: status, type, priority, launcher, model, cost, duration, date. Pagination.

**Filters bar** at the top: date range, task type, launcher, model — applies to all sections.

Use existing dashboard styling patterns. Pure CSS charts where possible, or a lightweight charting library if needed.

## Dependencies

- TASK_2026_231 — Reporting API endpoints

## Acceptance Criteria

- [ ] Reports page accessible at /reports route
- [ ] All 5 sections render with data from API
- [ ] Filters bar applies across all sections
- [ ] Empty states shown when no data available
- [ ] Responsive layout (desktop and tablet)

## References

- Reporting API: TASK_2026_231
- Dashboard patterns: `apps/dashboard/src/app/views/`

## File Scope

- `apps/dashboard/src/app/views/reports/reports.component.ts` (new)
- `apps/dashboard/src/app/views/reports/reports.component.html` (new)
- `apps/dashboard/src/app/views/reports/reports.component.scss` (new)
- `apps/dashboard/src/app/app.routes.ts` (modified — add route)
- `apps/dashboard/src/app/services/api.service.ts` (modified — add report API calls)

## Parallelism

Can run in parallel — mostly new files. Minor overlap on app.routes.ts and api.service.ts with TASK_2026_210, TASK_2026_217 — schedule in a later wave.
