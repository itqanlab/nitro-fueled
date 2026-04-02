# Task: Dashboard UI: Skill Usage Bubble Chart (D3 Circle Pack)


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

Build a skill usage bubble chart component in the Angular dashboard using D3.js circle pack layout. The component fetches data from GET /api/analytics/skill-usage, renders a D3 circle pack visualization where each bubble represents a skill, bubble size is proportional to invocation count, and bubble color encodes avg duration (cool=fast, warm=slow). Import only d3-hierarchy and d3-selection (~12KB). Features: hover tooltip showing skill name, count, and avg duration. Click navigates to skill detail. Responsive — redraws on container resize. Period selector (7d/30d/90d/all) that refetches data. Add the component to the dashboard overview page.

## Dependencies

- TASK_2026_293

## Acceptance Criteria

- [ ] D3 circle pack renders with bubble size proportional to skill invocation count
- [ ] Hover tooltip shows skill name, count, avg duration
- [ ] Period selector (7d/30d/90d/all) filters data via API
- [ ] Responsive layout — redraws on container resize

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/components/skill-usage-bubble/ (new)
- apps/dashboard/src/app/pages/overview/


## Parallelism

🚫 Do NOT run in parallel with TASK_2026_293 — depends on API endpoint.
