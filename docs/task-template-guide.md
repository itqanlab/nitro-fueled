# Task Template Guide

How `task.md` drives the Nitro-Fueled orchestration pipeline — from defining work to autonomous execution.

---

## Overview

Every piece of work in Nitro-Fueled starts with a `task.md` file. It's the input that the orchestrator, auto-pilot, PM agent, and QA reviewers all consume. A well-written task.md is the difference between a smooth autonomous run and one that stalls asking for clarification.

The canonical template lives at `task-tracking/task-template.md`. Use `/create-task` to scaffold a new task from it.

---

## Task Lifecycle

```
User writes task.md (or uses /create-task)
  |
  v
/orchestrate TASK_YYYY_NNN
  |
  v
Orchestrator reads task.md
  -> Detects strategy from Type + keywords (Workflow Selection Matrix)
  -> Creates context.md (Phase 0)
  |
  v
PM Agent reads task.md
  -> Produces task-description.md (formal requirements + acceptance criteria)
  -> USER VALIDATES
  |
  v
Architect reads task-description.md + investigates codebase
  -> Produces implementation-plan.md (evidence-based design)
  -> USER VALIDATES
  |
  v
Team-Leader reads implementation-plan.md
  -> Produces tasks.md (atomic, batched tasks for developers)
  -> Assigns batches to developers
  |
  v
Developer implements batch
  -> Team-Leader verifies + commits
  -> Next batch assigned (loop)
  |
  v
QA Reviewers (user chooses: style / logic / security / all / skip)
  -> Produce review reports
  -> Developer fixes findings
  |
  v
Completion bookkeeping
  -> completion-report.md written
  -> registry.md updated to COMPLETE
```

---

## Field Reference

Every field in `task.md` has a specific consumer in the pipeline.

| Field             | Consumer(s)                             | How It's Used                                                    |
|-------------------|-----------------------------------------|------------------------------------------------------------------|
| **Type**          | Orchestrator (Workflow Selection Matrix) | Selects agent sequence — FEATURE gets full pipeline, BUGFIX skips PM |
| **Priority**      | Auto-pilot loop                         | Queue ordering — P0 tasks run before P3                          |
| **Complexity**    | Orchestrator (Strategy Selection)       | Weighting factor in strategy confidence scoring                  |
| **Description**   | PM Agent                                | Primary input for requirements generation                        |
| **Dependencies**  | Auto-pilot (dependency graph)           | Determines which tasks are unblocked and ready to run            |
| **Acceptance Criteria** | PM Agent + QA Reviewers           | PM uses as requirements input; QA uses as verification checklist |
| **References**    | Architect + Developer                   | Codebase evidence for design decisions and implementation        |

### Type → Agent Sequence Mapping

| Type          | Agent Flow                                                |
|---------------|-----------------------------------------------------------|
| FEATURE       | PM → [Research] → Architect → Team-Leader → QA         |
| BUGFIX        | [Research] → Team-Leader → QA                           |
| REFACTORING   | Architect → Team-Leader → QA                            |
| DOCUMENTATION | PM → Developer → Style Reviewer                         |
| RESEARCH      | Researcher → [conditional implementation]                |
| DEVOPS        | PM → Architect → DevOps Engineer → QA                   |
| CREATIVE      | [ui-ux-designer] → content-writer → frontend             |

---

## Auto-Pilot Integration

When auto-pilot is running, it uses task.md fields to make autonomous decisions:

1. **Read** `registry.md` + all `TASK_*/task.md` files → build dependency graph
2. **Find unblocked tasks** — all dependencies have status `COMPLETE`, own status is `CREATED`
3. **Order by Priority** — P0-Critical first, P3-Low last
4. **Pick next 1-2 tasks** to run concurrently
5. **Generate orchestration prompt** from task.md content (Type determines strategy)
6. **Spawn worker** via MCP session-orchestrator
7. **Monitor** every 10 minutes (health check, stuck detection)
8. **On completion**: verify deliverables, update registry, loop back to step 1

This is why structured metadata matters — the auto-pilot can't parse ambiguous free-text, but it can read a Type field and route to the right workflow.

---

## Examples

### Example 1: FEATURE Task

```markdown
# Task: Add project settings panel

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P1-High  |
| Complexity | Medium   |

## Description

Add a settings panel accessible from the main navigation that allows users to
configure project-level preferences: default branch, auto-save interval, and
theme override. Settings should persist in the database and sync to the UI
layer via the app's data transport (e.g., IPC, REST, tRPC).

## Dependencies

- TASK_2026_003 — Project database schema must be finalized first

## Acceptance Criteria

- [ ] Settings panel opens from navigation gear icon
- [ ] Three settings are configurable: default branch, auto-save interval, theme override
- [ ] Settings persist across app restarts
- [ ] Settings changes reflect immediately in the UI without restart

## References

- Existing settings pattern: src/database/repositories/settings.repository.ts
- Data transport conventions: src/shared/channels.ts
- UI navigation component: src/components/sidebar/
```

### Example 2: BUGFIX Task

```markdown
# Task: Fix sidebar collapse on narrow viewports

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | BUGFIX  |
| Priority   | P2-Medium |
| Complexity | Simple  |

## Description

When the app window is resized below 900px width, the sidebar collapse button
becomes unclickable because it overlaps with the bottom panel resize handle.
The sidebar should collapse automatically below 900px, or the button z-index
should be fixed.

## Dependencies

- None

## Acceptance Criteria

- [ ] Sidebar collapse button is clickable at all window widths down to 800px minimum
- [ ] No visual overlap between sidebar button and bottom panel handle
- [ ] Existing sidebar collapse/expand animation still works

## References

- Related issue: discussed in TASK_2026_007 review
- Sidebar component: src/components/sidebar/sidebar.component.ts
```

---

## Related Documentation

- **Orchestration skill**: `.claude/skills/orchestration/SKILL.md` — Workflow Selection Matrix, strategy detection
- **Task tracking reference**: `.claude/skills/orchestration/references/task-tracking.md` — Folder structure, registry format, phase detection
- **Design doc**: `docs/claude-orchestrate-package-design.md` — Auto-pilot loop, CLI commands, overall architecture
- **Create task command**: `.claude/commands/create-task.md` — Scaffolds new tasks from the template
