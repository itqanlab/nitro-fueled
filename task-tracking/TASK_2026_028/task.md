# Task: Enforce tasks.md as Required Build Artifact

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P2-Medium   |
| Complexity | Simple      |

## Description

During e2e testing, TASK_2026_001 build worker created a `tasks.md` (subtask breakdown with 5 items), but TASK_2026_002 build worker skipped it entirely. The orchestration skill does not enforce `tasks.md` as a required artifact, leaving it to worker discretion.

Subtask tracking is important for:
- Supervisor to monitor granular progress
- Post-mortem analysis of what was done
- Consistency across all tasks

### Fix

Add `tasks.md` to the Build Worker Exit Gate checklist in the orchestration skill. The file must exist and contain at least one subtask before the worker can exit.

## Dependencies

- None

## Acceptance Criteria

- [ ] Orchestration skill Exit Gate requires `tasks.md` to exist in task folder
- [ ] `tasks.md` must contain at least one subtask row
- [ ] Build workers that skip `tasks.md` fail the Exit Gate and are instructed to create it
- [ ] Template/example for `tasks.md` format documented in orchestration skill or task-template-guide

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-2
- `.claude/skills/orchestration/SKILL.md` -- Exit Gate checklist
- Test project `task-tracking/TASK_2026_001/tasks.md` -- working example
