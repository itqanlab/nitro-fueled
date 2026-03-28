# Context — TASK_2026_079

## User Intent
Implement the Analytics & Insights view matching the N.Gine mockup at `/analytics`.

## Strategy
FEATURE — full pipeline: PM -> Architect -> Team-Leader -> QA

## Analysis
- An analytics feature already exists at `apps/renderer/src/app/features/analytics/` with 14 components
- The existing implementation uses ngx-charts (line charts, doughnut, bar), NgRx signal stores, IPC backend
- The mockup requires significant visual changes: different chart types, different layout, different data presentation
- This is a **rework** of the existing analytics to match the new N.Gine mockup design

## Key Differences (Existing vs Mockup)
1. **Filter bar**: Existing has dropdown period selector + date range picker; mockup wants button group (7d/30d/This month/Custom)
2. **Summary cards**: Existing has 6 cards (incl. Success Rate, Savings Estimate); mockup wants 5 specific cards with trend arrows
3. **Charts**: Existing has line chart + doughnut; mockup wants horizontal bar (Provider) + stacked bar with budget lines (Client)
4. **Agent table**: Existing columns differ; mockup wants Tasks, Avg Duration, Tokens/Task, Cost/Task, Success Rate with dot indicators
5. **Daily trend**: Not present in existing; mockup has 30-day bar chart with budget line
6. **Team breakdown**: Not present in existing; mockup has 3 team cards with budget progress bars
7. **Removed in mockup**: Model comparison, model leaderboard, performance recommendations

## File Path Correction
- Task.md references `apps/dashboard/src/app/views/analytics/` — actual path is `apps/renderer/src/app/features/analytics/`
