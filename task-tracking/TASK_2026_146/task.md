# Task: Dashboard telemetry views — model performance, phase timing, session analytics

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | FEATURE              |
| Priority              | P2-Medium            |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Add telemetry visualization views to the Angular dashboard that display the data collected by cortex (phases, reviews, fix_cycles, worker_runs). These views let the user see which model+launcher combo works best for each task type.

**New views:**

1. **Model Performance view** — Table/chart showing quality/cost/failure rate per model+launcher+task_type+complexity. The core decision-making view. Includes:
   - Quality per dollar ranking
   - Failure rate by model
   - Average duration by model+complexity
   - Filter by date range, task type, complexity

2. **Phase Timing view** — Breakdown of how long each phase takes (PM, Architect, Dev, Review, Fix). Helps identify bottlenecks:
   - Average duration per phase per complexity
   - Phase duration trends over time
   - Outlier detection (phases that took 3x+ average)

3. **Session Comparison view** — Compare supervisor sessions side-by-side:
   - Cost per task across sessions
   - Tasks completed per hour
   - Model mix used per session
   - Sequential vs parallel session efficiency

4. **Task Trace view** — Deep dive into a single task showing the full chain:
   - Session → Worker Runs → Phases → Reviews → Fixes
   - Timeline visualization
   - Token usage per phase
   - Model used at each step

**Integration:**
- All views consume data from dashboard-api REST endpoints (TASK_2026_145)
- Add navigation items to existing sidebar
- Use NG-ZORRO components (Table, Charts via ngx-charts or similar)
- Dark theme consistent with existing dashboard

## Dependencies

- TASK_2026_145 — dashboard-api must serve telemetry endpoints first

## Acceptance Criteria

- [ ] Model Performance view shows quality/cost/failure matrix with filters
- [ ] Phase Timing view shows average duration per phase per complexity
- [ ] Session Comparison view compares sessions by cost/tasks/efficiency
- [ ] Task Trace view shows full chain for a selected task
- [ ] All views use NG-ZORRO components and match existing dark theme
- [ ] Navigation sidebar updated with new view links
- [ ] Views handle empty state gracefully (no telemetry data yet)

## References

- Angular dashboard: `apps/dashboard/`
- Dashboard API endpoints: TASK_2026_145
- NG-ZORRO docs: https://ng.ant.design/

## File Scope

- `apps/dashboard/src/app/pages/` (new view components)
- `apps/dashboard/src/app/services/` (new API service methods)
- `apps/dashboard/src/app/app.routes.ts` (add routes)
- `apps/dashboard/src/app/layout/` (sidebar nav updates)

## Parallelism

- Do NOT run in parallel with TASK_2026_115, 127, 128 (dashboard component files)
- Can run in parallel with cortex and skill tasks
