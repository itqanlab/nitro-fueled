# Code Style Review — TASK_2026_116

**Reviewer**: nitro-code-style-reviewer
**Task**: Rename all `.claude/commands/` files to `nitro-*` prefix (Part 1 of 2)
**Commit reviewed**: `095bc86`
**Date**: 2026-03-28

---

## Verdict: FAIL

**7 blocking issues** — old command name references survive in 5 in-scope files.
**1 naming defect** — double-prefix in agent path reference.
**1 minor inconsistency** — partial name used without `nitro-` prefix.

---

## Blocking Issues

### Issue 1 — `nitro-auto-pilot.md:61` — Old command name in error string

**Rule**: Named concepts must use one term everywhere.

```
If missing: ERROR -- "Registry not found. Run /initialize-workspace first."
```

`/initialize-workspace` was renamed. The error string must use `/nitro-initialize-workspace`.

---

### Issue 2 — `nitro-auto-pilot.md:193` — Old command name in abort string

```
Display: "ABORT: Pre-flight validation failed. Fix the issues listed above and re-run /auto-pilot."
```

`/auto-pilot` was renamed. The display string must use `/nitro-auto-pilot`.

---

### Issue 3 — `nitro-create.md:34` — Old command name in Notes section

```
The existing `/plan` and `/nitro-create-task` commands remain available as power-user direct access.
```

`/plan` was renamed to `/nitro-plan`. Mixed naming: one command has the `nitro-` prefix, the other does not.

---

### Issue 4 — `nitro-plan.md:12` — Old command name in Usage block

```
/plan                          # Resume current planning context or start fresh
```

The Usage block lists `/plan` as an alternative invocation. The file was renamed to `nitro-plan.md`, making this old alias misleading. Should be `/nitro-plan`.

---

### Issue 5 — `nitro-plan.md:19` — Double prefix in agent path reference

```
Read `.claude/agents/nitro-nitro-planner.md` -- this contains the full Planner agent
```

The path `nitro-nitro-planner.md` is malformed — the `nitro-` prefix is duplicated. The canonical agent file is `.claude/agents/nitro-planner.md`.

This is directly contradicted by line 65 (`ALWAYS read nitro-planner.md first`) and line 74 (`Planner agent: .claude/agents/nitro-planner.md`) which use the correct single-prefix form.

---

### Issue 6 — `nitro-status.md:15` — Old-style name in prose reference

```
See the `project-status` command for the full report format.
```

`project-status` was renamed to `nitro-project-status`. The backtick-quoted reference implies the command name. Should be `nitro-project-status`.

---

### Issue 7 — `CLAUDE.md:22` — All command names in Project Structure block not updated

```
commands/                # /orchestrate, /plan, /auto-pilot, /review-*, /create-task, /initialize-workspace, /project-status, /orchestrate-help
```

This is an explicit acceptance criterion of the task that was not addressed. Every command listed uses the pre-rename name. Required update:

```
commands/                # /nitro-orchestrate, /nitro-plan, /nitro-auto-pilot, /nitro-review-*, /nitro-create-task, /nitro-initialize-workspace, /nitro-project-status, /nitro-orchestrate-help
```

---

### Issue 8 — `.claude/skills/orchestration/references/task-tracking.md:166–168, 215` — Old `/orchestrate` references in code blocks

**Lines 166–168:**
```
/orchestrate TASK_2026_XXX    -> Continuation mode
/orchestrate [description]    -> New task mode
```

**Line 215:**
```
User: /orchestrate TASK_2026_008
```

`/orchestrate` was renamed to `/nitro-orchestrate`. These three occurrences in code-block examples are old names. The review context notes "their current content does not contain old-style command name references (verified by grep)" — this is a false negative, likely because the grep was case-sensitive or missed code-block content. All three occurrences must be updated to `/nitro-orchestrate`.

---

## Out-of-Scope Observations (document only — do NOT fix)

- **`nitro-orchestrate-help.md:108–113`**: References `/validate-project-manager`, `/validate-architect`, `/validate-developer`, `/validate-tester`, `/validate-reviewer` — these do not exist as slash commands in `.claude/commands/`. These appear to be stale content from a prior iteration. Out of scope for this task.

- **`nitro-project-status.md`**: Contains project-specific paths (`docs/24-implementation-task-plan.md`, `packages/cli/src/commands/*.ts`) embedded in what is intended to be a project-agnostic scaffold file. These will produce incorrect instructions in target projects. Out of scope for TASK_2026_116; should be addressed in a separate genericization task.

---

## Summary Table

| # | File | Line(s) | Finding | Severity |
|---|------|---------|---------|----------|
| 1 | `nitro-auto-pilot.md` | 61 | Old name `/initialize-workspace` in error string | Blocking |
| 2 | `nitro-auto-pilot.md` | 193 | Old name `/auto-pilot` in abort display string | Blocking |
| 3 | `nitro-create.md` | 34 | Mixed naming: `/plan` beside `/nitro-create-task` | Blocking |
| 4 | `nitro-plan.md` | 12 | Old name `/plan` in Usage block | Blocking |
| 5 | `nitro-plan.md` | 19 | Double prefix `nitro-nitro-planner.md` | Blocking |
| 6 | `nitro-status.md` | 15 | Old name `project-status` in prose reference | Blocking |
| 7 | `CLAUDE.md` | 22 | All 8 command names in Project Structure block pre-rename | Blocking |
| 8 | `task-tracking.md` | 166–168, 215 | Old name `/orchestrate` in code-block examples (3 occurrences) | Blocking |

**Files with no issues**: `nitro-create-agent.md`, `nitro-create-skill.md`, `nitro-create-task.md`, `nitro-evaluate-agent.md`, `nitro-initialize-workspace.md`, `nitro-orchestrate-help.md` (in-scope content), `nitro-orchestrate.md`, `nitro-project-status.md` (command names), `nitro-retrospective.md`, `nitro-review-code.md`, `nitro-review-logic.md`, `nitro-review-security.md`, `nitro-run.md`, `checkpoints.md`
