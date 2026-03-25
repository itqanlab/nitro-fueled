# Task: Dashboard Historical Analytics — Cross-Session Trends

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P2-Medium   |
| Complexity | Medium      |

## Description

Add a Historical Analytics view to the dashboard that aggregates data across all past sessions. The current Cost Dashboard (TASK_2026_023) shows data for the selected session only. This task adds cross-session trend analysis.

### Analytics view

**Cost trends**:
- Line chart: cumulative cost over time (x-axis: sessions, y-axis: dollars)
- Bar chart: cost per session broken down by model (Opus vs Sonnet stacked)
- Pie chart: total spend by model
- Cost-per-task average trending over sessions (are we getting more efficient?)

**Efficiency metrics**:
- Average time per task (by type: FEATURE, BUGFIX, etc.)
- Average tokens per task (trending — are tasks getting leaner?)
- Retry/failure rate per session (trending — are workers getting more reliable?)
- Review score averages (initial scores before fixes — is code quality improving?)

**Model routing analysis** (once TASK_2026_020 + TASK_2026_035 ship):
- Model usage distribution: how much of each model is used
- Cost savings from model routing: actual cost vs "if everything was Opus"
- Quality comparison: do Sonnet-reviewed tasks have more post-review issues?

**Session comparison table**:

| Session | Date | Tasks | Duration | Cost | Failures | Avg Review Score |
|---------|------|-------|----------|------|----------|-----------------|
| SESSION_2026-03-25_10-00 | Mar 25 | 5 | 45m | $12.30 | 0 | 7.2/10 |
| SESSION_2026-03-24_22-00 | Mar 24 | 14 | 2h30m | $45.80 | 2 | 6.5/10 |
| SESSION_2026-03-24_18-00 | Mar 24 | 2 | 29m | $8.50 | 2 | 6.0/10 |

### Data requirements

**Data Service**:
1. `GET /api/analytics/cost` — cost trends across sessions
2. `GET /api/analytics/efficiency` — time/token/retry trends
3. `GET /api/analytics/models` — model usage and routing analysis
4. `GET /api/analytics/sessions` — session comparison table data

Data is aggregated from:
- `task-tracking/sessions/*/state.md` — per-session worker stats, cost
- `task-tracking/sessions/*/analytics.md` — per-session summary (from TASK_2026_032)
- `task-tracking/orchestrator-history.md` — historical session summaries
- `task-tracking/registry.md` — task completion status

**Caching**: Analytics queries scan multiple session directories. The data service should cache aggregated results and invalidate when a new session completes.

### Chart library

Use a lightweight charting library compatible with React:
- **Recharts** — simple, React-native, good for line/bar/pie
- Or **Chart.js** via react-chartjs-2

Recommend Recharts — lighter, more React-idiomatic.

## Dependencies

- TASK_2026_023 — Dashboard Web Client (base dashboard)
- TASK_2026_034 — Session-Scoped State Directories (provides session history to aggregate)
- TASK_2026_026 — Supervisor Cost Tracking (provides cost data per session)

## Acceptance Criteria

- [ ] Cost trend chart across sessions (cumulative and per-session)
- [ ] Cost breakdown by model per session (stacked bar)
- [ ] Efficiency metrics: avg time/tokens/retries per task trending over sessions
- [ ] Session comparison table with sortable columns
- [ ] Model routing analysis: actual vs hypothetical all-Opus cost
- [ ] Charts handle gracefully when only 1 session exists (no empty charts)
- [ ] Data cached and updated when new sessions complete
- [ ] Responsive chart sizing (works on different screen widths)

## References

- `TASK_2026_023` — Base dashboard (Cost Dashboard view to extend)
- `TASK_2026_034` — Session directories
- `TASK_2026_026` — Cost tracking data
- `TASK_2026_032` — Per-session analytics.md
- Recharts: https://recharts.org/
