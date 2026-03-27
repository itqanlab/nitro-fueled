# Task: Planner Retroactive Oversized Task Detection

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | REFACTORING |
| Priority   | P2-Medium   |
| Complexity | Simple      |

## Description

Add a backlog sizing review step to the Planner agent's consultation flow. When the Planner is invoked via `/plan` or `/plan status`, it should scan all CREATED tasks in the registry, read their `task.md` files, and check them against the sizing rules in `sizing-rules.md`.

This is the retroactive safety net — it catches tasks that:
- Were created before sizing enforcement existed
- Were manually created by editing files directly (the only path that bypasses all other validation)
- Somehow slipped past creation-time and pre-flight checks

### Behavior

1. On every `/plan` and `/plan status` invocation, scan all CREATED tasks
2. For each task, read `task.md` and check against `sizing-rules.md` limits
3. If oversized tasks are found:
   - Report them to the Product Owner with specific violations (which limits exceeded)
   - Propose splitting into properly-sized subtasks with dependencies
   - Wait for Product Owner approval before creating any splits
4. If no oversized tasks found, proceed normally (no noise)

### Where to add this

Add as Section 3e "Backlog Sizing Review" in `planner.md`, invoked as part of both the new planning conversation flow (3a) and the status flow (3b).

## Dependencies

- None (can reference `sizing-rules.md` if it exists, or use inline rules as fallback)

## Acceptance Criteria

- [ ] Planner scans all CREATED tasks for sizing violations on `/plan` and `/plan status`
- [ ] Oversized tasks reported with specific violations (which limits exceeded)
- [ ] Planner proposes split into subtasks when oversized tasks are found
- [ ] Split proposals wait for Product Owner approval
- [ ] Uses `sizing-rules.md` for rules when available, inline fallback otherwise
- [ ] No noise when all tasks are properly sized

## References

- `.claude/agents/planner.md` — Planner agent definition
- `task-tracking/sizing-rules.md` — sizing limits (created by TASK_2026_043)
- `task-tracking/TASK_2026_004/implementation-plan.md` lines 183-191 — original sizing rules

## File Scope

- `.claude/agents/planner.md`
