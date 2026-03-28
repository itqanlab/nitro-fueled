# Task: Analytics & Insights view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the Analytics & Insights view at route `/analytics` matching the N.Gine mockup. Filter bar: period selector buttons (7 days, 30 days active, This month, Custom), Client dropdown, Team dropdown, Project dropdown. Summary stat cards (5): Total Cost $847.32 (+12%), Tasks Completed 48 (+8%), Tokens Used 2.4M (-5%), Avg Task Duration 4.2 min (-15%), Active Agents 12 of 14 — each with up/down trend arrow and percentage change. Cost by Provider: horizontal bar chart (Anthropic 62%, OpenAI 23%, Google 11%, Local/CLI 4%). Cost by Client: stacked bar chart with budget lines per client (Acme Corp, TechStart, Internal). Agent Performance table: columns Agent, Tasks, Avg Duration, Tokens/Task, Cost/Task, Success Rate (colored dot indicators). Daily Cost Trend: 30-day bar chart with $50 budget line overlay, labeled axes. Team breakdown cards (3): Engineering $520/32 tasks/8 agents, Design $210/12 tasks/3 agents, Marketing $117/4 tasks/2 agents — each with budget progress bar. Use NG-ZORRO charts or Chart.js/ng2-charts for all visualizations. All data from MockDataService.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Filter bar renders with all 4 controls; active period button highlighted
- [ ] 5 summary stat cards render with trend indicators (colored arrows + percentage)
- [ ] Cost by Provider and Cost by Client charts render with correct proportional data
- [ ] Agent Performance table renders all columns with success rate color-coded dots
- [ ] Daily Cost Trend chart renders 30-day bars with budget line and labeled axes
- [ ] 3 team breakdown cards render with budget progress bars

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/analytics.html

## File Scope

- apps/dashboard/src/app/views/analytics/analytics.component.ts
- apps/dashboard/src/app/views/analytics/analytics.component.html
- apps/dashboard/src/app/views/analytics/analytics.component.scss
- apps/dashboard/src/app/views/analytics/cost-chart/cost-chart.component.ts
- apps/dashboard/src/app/views/analytics/agent-table/agent-table.component.ts
