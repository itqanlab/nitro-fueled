# Task: Rich Task Detail Page

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Complex        |
| Preferred Tier        | heavy          |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Build a comprehensive task detail page in the dashboard that displays ALL data related to a task in one view. This is the single source of truth for understanding everything about a task's lifecycle.

The detail page must include:

1. **Core Metadata** — Task ID, type, priority, complexity, model, preferred tier, status, created date
2. **Status Timeline** — Visual timeline showing every status transition (CREATED → IN_PROGRESS → IMPLEMENTED → IN_REVIEW → COMPLETE) with exact timestamps and durations between transitions
3. **Relations & Dependencies** — Which tasks this depends on, which tasks depend on this, linked with navigation
4. **Reviews** — All review results (code logic, code style, security) with scores, findings count, pass/fail status
5. **Model & Provider Info** — Which model was used, which provider, token counts (input/output), cost per phase
6. **Launcher Info** — Which launcher spawned the worker (claude, glm, opencode), session ID
7. **Phase Timing** — Duration of each orchestration phase (PM, Architect, Dev, QA, Review, Test) with a timing breakdown chart
8. **Score & Quality** — Overall task score, review scores breakdown, test results summary
9. **Worker Activity** — Worker ID, spawn time, completion time, compaction count, retry count
10. **Acceptance Criteria** — Checklist with verification status from QA
11. **File Scope** — Files created/modified by this task
12. **Handoff Artifact** — Build worker's handoff summary if available
13. **Event Log** — Chronological log of all events emitted during this task's lifecycle

Data sources: cortex MCP (tasks table, events table, handoffs table), task-tracking files (task.md, status, handoff.md, reviews).

## Dependencies

- None

## Acceptance Criteria

- [ ] Task detail page accessible from project task list by clicking a task row
- [ ] All 13 data sections listed above are displayed when data is available
- [ ] Status timeline renders as a visual horizontal timeline with dates and durations
- [ ] Missing data sections show graceful empty states (not errors)
- [ ] Phase timing shows a stacked bar or breakdown chart

## Parallelism

✅ Can run in parallel — touches new task detail page components, no overlap with existing CREATED tasks.

## References

- Dashboard app: `apps/dashboard/`
- Dashboard API: `apps/dashboard-api/`
- Cortex MCP tools: `packages/mcp-cortex/`
- Existing task views: `apps/dashboard/src/app/pages/project/`

## File Scope

- apps/dashboard/src/app/pages/project/task-detail/ (new component directory)
- apps/dashboard-api/src/dashboard/ (new endpoint for full task data)
