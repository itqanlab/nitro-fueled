---
title: Task Format
description: The task file format and frontmatter schema used by Nitro-Fueled.
---

`task.md` is the single input file that drives the entire Nitro-Fueled pipeline. Every field has a specific consumer. A well-written task runs end-to-end without the worker stopping to ask clarifying questions. A poorly-written task produces vague requirements and wastes worker context.

---

## Field Reference

| Field | Consumer | How It's Used |
|-------|---------|--------------|
| **Type** | Orchestrator (Workflow Selection Matrix) | Selects which agent pipeline runs — `FEATURE` gets the full sequence, `BUGFIX` skips PM scoping |
| **Priority** | Supervisor (queue ordering) | P0 tasks run before P3; used to order the ready queue |
| **Complexity** | Orchestrator (strategy weighting) | Influences how much investigation the Architect performs |
| **Description** | Project Manager | Primary input for writing requirements (`task-description.md`) |
| **Dependencies** | Supervisor (dependency graph) | Determines which tasks are unblocked and ready to spawn |
| **Acceptance Criteria** | PM + QA Reviewers | PM uses these as requirements input; QA uses them as a verification checklist |
| **References** | Architect + Developer | Codebase files and docs the implementation should be grounded in |

---

## Type → Agent Pipeline

| Type | Agent Flow |
|------|-----------|
| `FEATURE` | PM → Architect → Team-Leader → Developer → Review Lead + Test Lead |
| `BUGFIX` | Team-Leader → Developer → Review Lead + Test Lead |
| `REFACTORING` | Architect → Team-Leader → Developer → Review Lead + Test Lead |
| `DOCUMENTATION` | PM → Developer → Style Reviewer |
| `RESEARCH` | Researcher → conditional implementation |
| `DEVOPS` | PM → Architect → DevOps Engineer → QA |
| `CREATIVE` | UI/UX Designer → Content Writer → Frontend Developer |

---

## Priority Levels

| Value | Label | When to Use |
|-------|-------|-------------|
| `P0-Critical` | Critical | Blocker — nothing else should run until this is done |
| `P1-High` | High | Core feature for the current milestone |
| `P2-Medium` | Medium | Standard development work |
| `P3-Low` | Low | Nice-to-have; runs when the queue is otherwise idle |

---

## Complexity Impact

Complexity affects how thoroughly the Architect investigates the codebase before producing the implementation plan:

- **Simple** — small, well-defined change with a clear pattern to follow
- **Medium** — multi-file change with some integration work
- **Complex** — spans multiple architectural layers or introduces new patterns

For the task sizing limits, see the sizing rules below.

---

## Task Sizing Limits

The Planner and `/create-task` enforce these limits before a task enters the Supervisor queue:

| Dimension | Maximum |
|-----------|---------|
| Files created or significantly modified | 7 |
| Top-level acceptance criteria groups | 5 |
| Description non-blank line count | ~150 lines |
| `Complex` task spanning multiple layers | Flagged for review |

Tasks that exceed these limits are split into multiple smaller tasks with explicit dependencies.

---

## Good Task vs Bad Task

**Bad task — too vague:**

```markdown
# Task: Improve the dashboard

## Metadata
| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P1-High  |
| Complexity | Complex  |

## Description

Make the dashboard better. Add charts and fix performance.

## Acceptance Criteria

- [ ] Dashboard is improved
```

**Good task — specific and bounded:**

```markdown
# Task: Add weekly activity chart to dashboard

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P2-Medium |
| Complexity | Medium   |

## Description

Add a weekly activity bar chart to the dashboard overview panel. The chart
should display the count of completed tasks per day for the last 7 days.
Use the existing chart library already in the project. Data is available
from the `/api/tasks/stats` endpoint added in TASK_2026_008.

## Dependencies

- TASK_2026_008 — stats endpoint must exist before the chart can fetch data

## Acceptance Criteria

- [ ] Bar chart renders in the dashboard overview panel
- [ ] Chart shows 7 days of completed task counts
- [ ] Chart data refreshes on page load
- [ ] Chart is accessible (ARIA labels on bar elements)

## References

- Existing chart usage: src/components/analytics/MonthlyChart.tsx
- Stats endpoint: src/api/tasks/stats.ts
- Dashboard panel: src/components/dashboard/OverviewPanel.tsx
```

---

## Full Annotated FEATURE Example

```markdown
# Task: Add project settings panel

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |         ← Full pipeline: PM → Arch → TL → Dev → QA
| Priority   | P1-High  |         ← Second in queue, after P0
| Complexity | Medium   |         ← Multi-file, some integration work

## Description

Add a settings panel accessible from the main navigation that allows users to
configure project-level preferences: default branch, auto-save interval, and
theme override. Settings should persist in the database and sync to the UI
layer via the existing tRPC data transport.

## Dependencies

- TASK_2026_003 — project database schema must be finalized first
                   ↑ Supervisor will block this task until TASK_2026_003 is COMPLETE

## Acceptance Criteria

- [ ] Settings panel opens from navigation gear icon
- [ ] Three settings are configurable: default branch, auto-save interval, theme override
- [ ] Settings persist across app restarts
- [ ] Settings changes reflect immediately in the UI without restart
- [ ] Settings panel is keyboard navigable

## References

- Existing settings pattern: src/database/repositories/settings.repository.ts
- tRPC transport: src/shared/channels.ts
- Navigation component: src/components/sidebar/
```

---

## Creating Tasks

**Interactive scaffolder (recommended):**

```bash
npx nitro-fueled create
```

The `create` command prompts you through each field, validates the values, and writes the `task.md` file with the correct format.

**Discussion-based creation:**

```
/plan
```

The Planner agent discusses your requirements, reads the codebase to check feasibility, and proposes a set of right-sized tasks for your approval before writing any files.

**Manual creation:**

Copy the template from `task-tracking/task-template.md` and fill in the fields.

---

## See Also

- [Tasks Concept](../concepts/tasks/) — State machine, registry, lifecycle
- [Auto-Pilot Guide](../auto-pilot/) — How the Supervisor uses task fields
- [Commands Reference](../commands/) — `/create-task`, `/plan`, `npx nitro-fueled create`
