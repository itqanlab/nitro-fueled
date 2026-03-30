# Task: Orchestration Flow Visualization & Templates

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

Part 1 of 2 — Orchestration Flow Manager (original request: Orchestration Flow Manager UI).

Build a page in the dashboard that visualizes all built-in orchestration flows as interactive pipeline diagrams. Each flow (FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, OPS, CREATIVE, CONTENT, SOCIAL, DESIGN) should be rendered as a visual pipeline showing the sequence of agents/phases (e.g., PM → Architect → Team-Leader → QA).

This page is read-only for built-in flows — editing comes in Part 2 (TASK_2026_170).

Features:
1. **Flow List** — Sidebar or card grid listing all available flow types
2. **Pipeline Diagram** — Visual representation of each flow's agent sequence with connecting arrows
3. **Phase Details** — Click a phase node to see details (agent name, description, what it produces)
4. **Flow Metadata** — Show which task types use each flow, when it was last used, success rate
5. **Clone to Custom** — Button to clone a built-in flow as a starting point for customization (creates the entry, editing in Part 2)

Data source: Parse flow definitions from orchestration SKILL.md Workflow Selection Matrix, or expose via a new API endpoint.

## Dependencies

- None

## Acceptance Criteria

- [ ] All 11 built-in orchestration flows are displayed as visual pipelines
- [ ] Each phase node shows agent name and is clickable for details
- [ ] Flow metadata (task type mapping, usage stats) is visible
- [ ] Clone button creates a custom flow entry (stub for Part 2)

## Parallelism

✅ Can run in parallel — new orchestration page, no overlap with existing CREATED tasks.

## References

- Orchestration SKILL.md: `.claude/skills/orchestration/SKILL.md`
- Workflow Selection Matrix in SKILL.md
- Dashboard app: `apps/dashboard/`

## File Scope

- apps/dashboard/src/app/pages/orchestration/ (new page directory)
- apps/dashboard-api/src/dashboard/ (flow data endpoint)
