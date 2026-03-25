# Task: Add Shared Review Context and Task File-Scope Isolation

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | FEATURE     |
| Priority   | P1-High     |
| Complexity | Medium      |

## Description

During e2e testing, two related problems emerged from running parallel review workers on tasks that share files:

1. **Cross-task interference (BUG-3)**: TASK_001 reviewer fixed code belonging to TASK_002 because both tasks edit `index.html`. The commit message says "TASK_001 review findings" but includes fixes for TASK_002 code.

2. **Contradictory decisions (BUG-4)**: TASK_001 reviewer changed `var` to `const`/`let`, then TASK_002 reviewer changed them back to `var`. No shared context meant they made opposing style decisions.

### Solution: Two-part fix

**Part A -- Shared Review Context File**

Before spawning review workers, the supervisor generates a `review-context.md` in `task-tracking/` containing:
- Project conventions established during planning (from plan.md decisions log)
- Style decisions already made by completed reviews
- Tech stack constraints (e.g., "this project uses modern JS, const/let preferred")

All review workers read this file before starting their review.

**Part B -- Task File Scope Tracking**

During task creation (plan phase or architect phase), record which files each task will create/modify in `task.md`:
- Add a `## File Scope` section to the task template
- Build workers populate this after implementation (list of files touched)
- Supervisor detects overlapping file scopes between concurrent tasks
- When overlap detected: either serialize reviews or add scope boundaries to reviewer instructions
- Reviewers are instructed to only review/fix code within their task's scope (using git blame to identify ownership)

## Dependencies

- None

## Acceptance Criteria

- [ ] `review-context.md` is generated before review workers are spawned
- [ ] Review context includes project conventions from plan.md decisions log
- [ ] Review context is updated as reviews complete (decisions feed into next reviewer)
- [ ] Task template includes `## File Scope` section
- [ ] Build workers populate file scope after implementation
- [ ] Supervisor detects overlapping file scopes and logs a warning
- [ ] When file scopes overlap, reviews are serialized (not parallel)
- [ ] Review workers only fix issues within their task's file scope

## References

- `task-tracking/TASK_2026_014/e2e-test-findings.md` -- BUG-3, BUG-4, ENH-3, ENH-4
- `.claude/skills/auto-pilot/SKILL.md` -- supervisor review spawning logic
- `.claude/skills/orchestration/SKILL.md` -- review phase instructions
- `task-tracking/task-template.md` -- task template to extend
