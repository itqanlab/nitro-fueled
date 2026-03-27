# Task: Registry-Driven Supervisor — Priority and Dependencies in Registry

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P2-Medium   |
| Complexity | Medium      |
| Model      | default     |
| Testing    | skip        |

## Description

The Supervisor currently reads `task.md` for every non-terminal task at startup (Step 2) to extract Priority, Dependencies, Complexity, and Model — all needed for dependency graph building and wave planning. With a large backlog of CREATED tasks, this balloons the Supervisor's context window unnecessarily before a single worker is spawned.

The fix: store Priority and Dependencies directly in `registry.md`. The Supervisor then reads only the registry at startup (one file read) and builds the full dependency graph from it. `task.md` is read just-in-time, strictly for quality validation (Description length, Acceptance Criteria), and only when a task is about to be spawned — not upfront for all tasks.

### Changes Required

1. **`task-tracking/registry.md` column schema** — add `Priority` and `Dependencies` columns. Backfill existing CREATED/IN_PROGRESS/IMPLEMENTED/IN_REVIEW rows with their values from the corresponding `task.md` files.

2. **`.claude/skills/auto-pilot/SKILL.md` Step 2** — rewrite to read registry only. Remove the per-task `task.md` read loop. Extract Priority and Dependencies from the new registry columns instead.

3. **`.claude/skills/auto-pilot/SKILL.md` Step 2b** — move the task.md quality validation read from startup to just-in-time: read `task.md` only when a task advances to the front of the spawn queue (immediately before calling `spawn_worker`). This preserves the quality gate without loading all task bodies upfront.

4. **`.claude/commands/create-task.md` Step 5** — update the registry row format to include Priority and Dependencies when writing a new row. Registry row format becomes: `Task ID | Status | Type | Description | Priority | Dependencies | Created | Model`.

5. **Backfill** — update existing non-terminal task rows in `registry.md` with correct Priority and Dependencies values sourced from their `task.md` files.

## Dependencies

- TASK_2026_060 — both tasks modify `.claude/skills/auto-pilot/SKILL.md`; must not run concurrently

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_060 — both modify `.claude/skills/auto-pilot/SKILL.md` and would produce merge conflicts.

Suggested execution wave: Wave after TASK_2026_060 completes.

## Acceptance Criteria

- [ ] `registry.md` has `Priority` and `Dependencies` columns; all non-terminal task rows are backfilled with correct values
- [ ] Supervisor Step 2 reads only `registry.md` at startup — no per-task `task.md` reads
- [ ] Dependency graph is correctly built from registry `Dependencies` column alone
- [ ] Step 2b quality validation defers `task.md` read to just before spawn (not upfront for all tasks)
- [ ] `/create-task` Step 5 writes Priority and Dependencies to the registry row
- [ ] Existing behavior is unchanged: dependency resolution, wave planning, quality validation all work as before

## References

- `.claude/skills/auto-pilot/SKILL.md` — Step 2 and Step 2b
- `task-tracking/registry.md` — current schema (Task ID | Status | Type | Description | Created | Model)
- `.claude/commands/create-task.md` — Step 5 registry row format

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` — Step 2 rewrite + Step 2b just-in-time deferral
- `task-tracking/registry.md` — add Priority + Dependencies columns, backfill non-terminal rows
- `.claude/commands/create-task.md` — update Step 5 registry row format
