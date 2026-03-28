# Task: Dashboard main view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the main dashboard view at route `/dashboard` matching the N.Gine mockup exactly. Page header: project title ("e-commerce-api"), client pill (Acme Corp), tech stack tags (Angular 19, NestJS 10, PostgreSQL, Nx), team pills (Engineering, Design), Settings and New Task buttons. Stats row: 5 metric cards (Active Tasks 2, Completed 47, Budget $47/$100 with progress bar, Tokens Used 1.2M, Cost $47.30). Task cards section: 2 active task cards each showing status indicator, priority dot, title, strategy badge, inline pipeline step strip (Scope → PM → Architect → Team Lead → Dev → QA with current step highlighted), progress percentage, agent name, duration, cost; 3 recently completed task cards with strategy badges (FEATURE, BUGFIX, REFACTOR). Quick actions grid: 6 action cards (New Task, Run Command, Review Code, Generate Docs, View Client Report, Search Learnings) with icons. Team card: 8 agents grouped by Engineering (6) and Design (2) each showing name and model. Activity log: timestamped entries (2m, 5m, 8m, 15m, 1h ago). All data from MockDataService.

## Dependencies

- TASK_2026_077 — provides the shell layout, routing, and MockDataService

## Acceptance Criteria

- [ ] Page header renders project title, client pill, tech stack tags, team pills, and action buttons matching mockup
- [ ] Stats row shows 5 cards with correct labels, values, and budget progress bar
- [ ] Active task cards show pipeline step strip with current step highlighted and progress percentage
- [ ] Recently completed tasks render with correct status/priority/strategy badge colors
- [ ] Quick actions grid renders 6 cards with icons and labels in correct layout
- [ ] Team card and activity log render with mock data

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/dashboard.html

## File Scope

- apps/dashboard/src/app/views/dashboard/dashboard.component.ts
- apps/dashboard/src/app/views/dashboard/dashboard.component.html
- apps/dashboard/src/app/views/dashboard/dashboard.component.scss
- apps/dashboard/src/app/shared/task-card/task-card.component.ts
- apps/dashboard/src/app/shared/stat-card/stat-card.component.ts
