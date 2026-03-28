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

| Field                     | Consumer(s)                             | How It's Used                                                    |
|---------------------------|-----------------------------------------|------------------------------------------------------------------|
| **Type**                  | Orchestrator (Workflow Selection Matrix) | Selects agent sequence — FEATURE gets full pipeline, BUGFIX skips PM |
| **Priority**              | Auto-pilot loop                         | Queue ordering — P0 tasks run before P3                          |
| **Complexity**            | Orchestrator (Strategy Selection)       | Weighting factor in strategy confidence scoring                  |
| **Description**           | PM Agent                                | Primary input for requirements generation                        |
| **Dependencies**          | Auto-pilot (dependency graph)           | Determines which tasks are unblocked and ready to run            |
| **Acceptance Criteria**   | PM Agent + QA Reviewers                 | PM uses as requirements input; QA uses as verification checklist |
| **References**            | Architect + Developer                   | Codebase evidence for design decisions and implementation        |
| **Poll Interval**         | Auto-pilot (Step 5a-jit)                | Event poll interval for this task's worker (default 30s)         |
| **Health Check Interval** | Auto-pilot (Step 5a-jit)                | Stuck/health check interval for this task's worker (default 5m)  |
| **Max Retries**           | Auto-pilot (Step 5a-jit)                | Retry limit for this task (default 2, max 5)                     |

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

## When to Use Custom Timing Values

The timing fields (Poll Interval, Health Check Interval, Max Retries) are optional overrides for the auto-pilot's monitoring behavior. Use them when a task has characteristics that differ significantly from typical tasks.

### Poll Interval

Override the poll interval when a task's worker is expected to produce events at a different rate:

- **Increase** (e.g., `2m`, `5m`) for tasks with long-running operations such as:
  - Complex builds that take several minutes
  - Large test suites that run sequentially
  - Tasks that process large datasets

- **Keep default** (`30s`) for typical development tasks that make incremental progress

Increasing the poll interval reduces overhead when frequent status checks are unnecessary.

### Health Check Interval

Override the health check interval when a task's worker is expected to go longer periods without state changes:

- **Increase** (e.g., `10m`, `15m`) for tasks with extended processing phases such as:
  - Complex refactoring across many files
  - Multi-step integration work
  - Tasks involving external service calls with high latency

- **Keep default** (`5m`) for tasks that should show regular progress

Increasing the health check interval prevents false-positive "stuck" detection for tasks that legitimately take longer between state updates.

### Max Retries

Override the retry limit based on task failure characteristics:

- **Increase** (e.g., `3`, `4`, `5`) for tasks prone to transient failures such as:
  - Network-dependent operations (API calls, external service integrations)
  - Tasks that interact with flaky external resources
  - Environment-sensitive operations that may fail on first attempt

- **Decrease** (e.g., `0`, `1`) for tasks that should fail fast such as:
  - Critical operations where failure indicates a fundamental problem
  - Tasks with expensive retry costs
  - Operations where idempotency is a concern

Values above 5 are automatically clamped to 5 with a warning logged.

### Fallback Behavior

All timing fields support a `default` sentinel value (or can be omitted entirely):

- If a field is absent or set to `default`, the auto-pilot uses global configuration values
- Invalid duration strings (e.g., malformed format, out-of-range values) trigger a warning log and fall back to global defaults — they do NOT block task spawning
- This ensures backward compatibility with existing tasks that do not specify timing overrides

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
- **Design doc**: `docs/nitro-fueled-design.md` — Auto-pilot loop, CLI commands, overall architecture
- **Create task command**: `.claude/commands/create-task.md` — Scaffolds new tasks from the template
