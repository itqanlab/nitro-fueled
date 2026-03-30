# Task: Orchestration Flow Editor & Auto-Pilot Integration

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

Part 2 of 2 — Orchestration Flow Manager (original request: Orchestration Flow Manager UI).

Build the editing and customization layer on top of the flow visualization from TASK_2026_167. Users can create custom orchestration flows and the auto-pilot supervisor respects them.

Features:
1. **Flow Editor UI** — Drag-and-drop or add/remove/reorder pipeline steps. Each step selects from available agents (PM, Architect, Team-Leader, Researcher, DevOps Engineer, Content Writer, UI/UX Designer, Review Lead, Test Lead)
2. **Custom Flow Creation** — Create new flows from scratch by composing agents
3. **Flow Persistence** — Save custom flows to cortex DB or config file, load on dashboard startup
4. **Per-Task Flow Override** — From task detail or task list, assign a custom flow to a specific task instead of the default type-based flow
5. **Auto-Pilot Integration** — When auto-pilot spawns a worker for a task with a custom flow, it follows the custom pipeline instead of the built-in one

## Dependencies

- TASK_2026_167 — Flow visualization page must exist first

## Acceptance Criteria

- [ ] Users can add, remove, and reorder steps in a custom flow
- [ ] Custom flows are persisted and survive page reload
- [ ] Per-task flow override is assignable from the dashboard
- [ ] Auto-pilot spawns workers following the custom flow when assigned
- [ ] Built-in flows remain read-only (only clones are editable)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_167 — depends on its output (orchestration page components).

## References

- TASK_2026_167 (Part 1 — visualization)
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`

## File Scope

- apps/dashboard/src/app/pages/orchestration/ (extend from Part 1)
- apps/dashboard-api/src/dashboard/ (flow CRUD endpoints)
- .claude/skills/auto-pilot/ (custom flow routing logic)
