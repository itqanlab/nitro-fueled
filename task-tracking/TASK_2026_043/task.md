# Task: Task Sizing Validation in /create-task Command

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P1-High     |
| Complexity | Simple      |

## Description

Add task sizing validation to the `/create-task` command so that ALL task creation paths enforce the same sizing limits already documented in the Planner agent (Section 4c). Currently, the Planner has sizing heuristics but `/create-task` has none — tasks created via `/create-task` or bulk creation bypass sizing enforcement entirely.

### What to do

1. **Extract sizing rules into a shared reference doc** (`task-tracking/sizing-rules.md`) — single source of truth for both the Planner agent and `/create-task` command. Rules:
   - More than 5-7 files need creation or significant modification = too large
   - Multiple unrelated functional areas touched = too large
   - Complexity is "Complex" AND scope spans multiple architectural layers = too large
   - Description exceeds 150 lines = too large
   - More than 5 acceptance criteria groups = too large

2. **Add Step 5c to `/create-task`** — after the task.md is written, validate the content against sizing rules. If any limit is exceeded, warn the user with specific violations. Warnings are non-blocking — user can acknowledge and proceed.

3. **Update `planner.md`** — replace the inline sizing rules in Section 4c with a reference to `task-tracking/sizing-rules.md` so both paths use the same source of truth.

## Dependencies

- None

## Acceptance Criteria

- [ ] `task-tracking/sizing-rules.md` exists with all sizing limits documented
- [ ] `/create-task` warns when a task description exceeds 150 lines
- [ ] `/create-task` warns when acceptance criteria exceed 5 groups
- [ ] `/create-task` warns when the task references more than 5-7 files to create/modify
- [ ] `/create-task` warns when Complexity is "Complex" and multiple architectural layers are involved
- [ ] Sizing rules are referenced by both `/create-task` and the Planner agent (no duplication)
- [ ] Warnings are non-blocking — user can acknowledge and proceed

## References

- `.claude/commands/create-task.md` — current /create-task command
- `.claude/agents/planner.md` — Section 4c sizing heuristics
- `task-tracking/TASK_2026_004/implementation-plan.md` lines 183-191 — original sizing rules

## File Scope

- `.claude/commands/create-task.md`
- `.claude/agents/planner.md`
- `task-tracking/sizing-rules.md`
