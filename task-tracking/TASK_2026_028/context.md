# Task Context - TASK_2026_028

## User Request

Start on task TASK_2026_028, do not stop for approval, finish then commit, run all the reviewers, then commit, finally report.

## Task Type

BUGFIX

## Complexity Assessment

Simple

## Strategy Selected

BUGFIX minimal pattern — known cause, single-file change. Direct systems-developer invocation.

## Conversation Summary

During e2e testing (TASK_2026_014), TASK_2026_002 build worker skipped creating tasks.md entirely. The Build Worker Exit Gate's first check ("All sub-tasks COMPLETE") references tasks.md but never verifies the file exists first. A missing tasks.md vacuously passes (grep on non-existent file returns nothing = no INCOMPLETE rows). Fix: add an explicit tasks.md existence check as the first row of the Build Worker Exit Gate, plus a failure recovery instruction and a cross-reference to the tasks.md format in team-leader-modes.md.

## Related Tasks

- TASK_2026_014: e2e test findings (BUG-2 reported here)

## Created

2026-03-27
