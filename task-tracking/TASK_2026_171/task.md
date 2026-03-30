# Task: Analytics Reports — Session, Cost, Model & Quality Reports

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

Part 2 of 2 — Logs & Reports (original request: Logs & Reports Dashboard).

Build analytical reports from collected data to help users understand and improve their workflow. Each report includes charts/visualizations and data tables.

Reports:
1. **Session Report** — Per-session summary: tasks completed, failed, total duration, cost breakdown, model usage, worker efficiency (compactions, retries)
2. **Task Success Rate Report** — Success/failure rates by type, complexity, model, and time period. Identify which configurations produce best results
3. **Cost Analysis Report** — Token usage and cost trends over time, per-model cost comparison, cost per task type, cost optimization recommendations
4. **Model Performance Report** — Compare model effectiveness: completion rates, review scores, phase timings, cost efficiency by model
5. **Quality Trends Report** — Review scores over time, common finding categories, areas that consistently fail reviews

Reports should be exportable (CSV/PDF) and show meaningful trends with actionable insights.

## Dependencies

- None

## Acceptance Criteria

- [ ] At least 5 report types are implemented with charts and data tables
- [ ] Reports show meaningful trends and actionable insights
- [ ] Cost analysis shows per-model and per-type breakdowns
- [ ] Reports are exportable in at least one format
- [ ] Date range selector to scope report data

## Parallelism

✅ Can run in parallel — new reports page, no overlap with existing CREATED tasks or TASK_2026_169.

## References

- Cortex MCP: `packages/mcp-cortex/`
- Existing analytics view: `apps/dashboard/src/app/pages/analytics/`
- Session artifacts: `task-tracking/sessions/`

## File Scope

- apps/dashboard/src/app/pages/reports/ (new page directory)
- apps/dashboard-api/src/dashboard/ (report generation endpoints)
- apps/dashboard/src/app/views/reports/ (new reports page)
- apps/dashboard/src/app/models/reports.model.ts (shared frontend report contracts)
- apps/dashboard/src/app/services/api.service.ts (reports API client)
- apps/dashboard/src/app/app.routes.ts (reports route)
- apps/dashboard/src/app/services/mock-data.constants.ts (sidebar navigation)
- apps/dashboard-api/src/dashboard/reports.types.ts (report response contracts)
- apps/dashboard-api/src/dashboard/reports.helpers.ts (report aggregation helpers)
- apps/dashboard-api/src/dashboard/reports.service.ts (report assembly service)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (reports endpoint)
- apps/dashboard-api/src/dashboard/dashboard.module.ts (reports service wiring)
