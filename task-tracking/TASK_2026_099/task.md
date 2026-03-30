# Task: Per-Task Supervisor Config + Blocked Dependency Guardrail

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | FEATURE |
| Priority   | P1-High |
| Complexity | Medium  |
| Model      | default |
| Testing    | skip    |

## Description

Two related changes to the Supervisor and orchestration system:

**Change 1 — Per-task timing and retries in task.md metadata:**

Add 3 optional fields to the task.md Metadata table that override global Supervisor defaults when present:

- `Poll Interval` — overrides the 30-second event poll interval (event-driven mode). Valid values: duration string (e.g., `30s`, `60s`, `2m`). Default: `30s`.
- `Health Check Interval` — overrides the 5-minute health/stuck check interval. Valid values: duration string (e.g., `5m`, `10m`, `15m`). Default: `5m`.
- `Max Retries` — overrides the global retry limit for this task. Valid values: integer 0–5 (clamped to 5). Default: `2`.

When absent or set to `default`, the global Supervisor flags (`--interval`, `--retries`) apply. The Supervisor extracts these in Step 5a-jit alongside Model/Complexity and passes them to the per-worker monitoring logic.

Rationale: Complex tasks may need more retries and longer health check windows. Simple tasks should stay tight. A one-size-fits-all global config forces compromises.

**Change 2 — Blocked dependency guardrail:**

Before spawning any work in both `/orchestrate` and `/auto-pilot`, the system must:

1. Scan the registry for tasks with status `BLOCKED`.
2. Walk the dependency graph to find all tasks that transitively depend on any BLOCKED task.
3. Surface a clear, non-dismissable warning listing each BLOCKED task and its downstream dependents.
4. **Hold** (do not spawn) any task whose dependency chain includes a BLOCKED task. These tasks are not failed or skipped — they are held until the blocker is resolved.
5. Log: `BLOCKED DEPENDENCY — TASK_X is BLOCKED and blocks TASK_Y, TASK_Z. These tasks will NOT be spawned until TASK_X is resolved.`

For `/orchestrate TASK_ID` specifically: if the user explicitly requests a task that depends on a BLOCKED task, warn them clearly and refuse to proceed. This prevents broken dev cycles where downstream work starts on an incomplete foundation, introducing bugs that compound.

For `/auto-pilot`: the guardrail runs during Step 3 (dependency graph construction). Tasks blocked by transitive dependency on a BLOCKED task are classified as `BLOCKED_BY_DEPENDENCY` (distinct from `BLOCKED` which means the task itself failed). The Supervisor logs the dependency chain and moves on to unblocked tasks.

**Change 2b — Orphan BLOCKED task warning:**

A BLOCKED task with **no downstream dependents** is still a failed task sitting in the backlog. It must not go silent. The system must surface these on every `/orchestrate` or `/auto-pilot` invocation:

1. After scanning for BLOCKED tasks (Change 2 above), separate them into two categories:
   - **Blocking others** — has downstream dependents (handled by Change 2, hard guardrail)
   - **Orphan blocked** — no downstream dependents, but still BLOCKED
2. For orphan blocked tasks, surface a **warning** (not a hard block) on every invocation:
   ```
   [BLOCKED TASKS] — The following tasks are BLOCKED with no dependents:
     - TASK_2026_045: exceeded 2 retries (failed 3 times)
     - TASK_2026_061: exceeded 2 retries (failed 3 times)

     Action needed: investigate and either fix + reset to CREATED, or CANCEL.
   ```
3. This warning appears at the start of every `/orchestrate` and `/auto-pilot` session, before any work begins.
4. The warning is **non-blocking** — the session continues with other tasks. But the user sees it every time until they resolve it.
5. In `/auto-pilot`, also log it: `ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution`

## Dependencies

- None

## Acceptance Criteria

- [ ] task-template.md includes `Poll Interval`, `Health Check Interval`, and `Max Retries` fields with valid values and guidance comments
- [ ] docs/task-template-guide.md documents the new fields with consumer mapping (Auto-pilot Step 5a-jit)
- [ ] Auto-pilot SKILL.md Step 5a-jit extracts per-task timing/retry fields from task.md
- [ ] Auto-pilot SKILL.md monitoring loop uses per-task intervals when present, falls back to global defaults
- [ ] Auto-pilot SKILL.md Step 3 classifies tasks with BLOCKED dependencies as `BLOCKED_BY_DEPENDENCY`
- [ ] Auto-pilot SKILL.md logs blocked dependency chains clearly before spawning
- [ ] Orchestration SKILL.md refuses to start a task that depends on a BLOCKED task, with clear warning
- [ ] Per-task `Max Retries` is clamped to 5 (same as global flag)
- [ ] Tasks with no per-task config behave identically to current behavior (backward compatible)
- [ ] Orphan BLOCKED tasks (no dependents) trigger a non-blocking warning on every `/orchestrate` and `/auto-pilot` invocation
- [ ] Auto-pilot logs orphan blocked tasks as `ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution`

## References

- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md` (Steps 3, 5a-jit, 6, 7)
- Orchestration skill: `.claude/skills/orchestration/SKILL.md`
- Task template: `task-tracking/task-template.md`
- Template guide: `docs/task-template-guide.md`
- Defaults table: Auto-pilot SKILL.md lines 56-63

## File Scope

- task-tracking/task-template.md
- docs/task-template-guide.md
- .claude/skills/auto-pilot/SKILL.md
- .claude/skills/orchestration/SKILL.md

## Parallelism

- Can run in parallel — no file scope conflicts with any CREATED tasks in the registry
