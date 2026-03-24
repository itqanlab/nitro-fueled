# Task: CLI status Command

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | FEATURE  |
| Priority   | P2-Medium |
| Complexity | Simple   |

## Description

Implement the `npx nitro-fueled status` command that displays the current state of all tasks and active workers.

**What status shows:**
- Task registry summary (total, per-state counts: CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW, COMPLETE, BLOCKED, CANCELLED)
- Active workers from `orchestrator-state.md` (if Supervisor is running)
- Per-task detail table (ID, title, status, type, priority)
- Plan progress from `plan.md` (if exists): active phase, milestone progress
- Blockers or tasks needing Product Owner attention

**Usage:**
```
npx nitro-fueled status              # Full status
npx nitro-fueled status --brief      # One-line summary
```

## Dependencies

- TASK_2026_008 — CLI scaffold must exist

## Acceptance Criteria

- [ ] `npx nitro-fueled status` displays task registry summary
- [ ] Shows per-state task counts
- [ ] Shows active workers if Supervisor is running
- [ ] Shows plan progress if plan.md exists
- [ ] `--brief` flag shows one-line summary
- [ ] Handles missing files gracefully (no crash if no registry, no state file)

## References

- Task-tracking reference: `.claude/skills/orchestration/references/task-tracking.md`
- Orchestrator state format: `.claude/skills/auto-pilot/SKILL.md` (orchestrator-state.md section)
- Plan format: `.claude/agents/planner.md` (plan.md specification)
