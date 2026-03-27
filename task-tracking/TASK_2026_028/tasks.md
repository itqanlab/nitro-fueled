# Development Tasks - TASK_2026_028

**Total Tasks**: 2 | **Batches**: 1 | **Status**: 0/1 complete

## Batch 1: Enforce tasks.md in Build Worker Exit Gate - COMPLETE

**Developer**: systems-developer
**Tasks**: 2 | **Dependencies**: None

### Task 1.1: Add tasks.md existence check to Build Worker Exit Gate

**File**: .claude/skills/orchestration/SKILL.md
**Status**: COMPLETE

Add a new row as the FIRST row in the Build Worker Exit Gate table:

| tasks.md exists | Glob task folder for tasks.md | File exists with at least one subtask row |

This must come BEFORE the "All sub-tasks COMPLETE" check so the file existence is confirmed before grepping it.

Also add a recovery note under the table explaining what to do when tasks.md is missing: "If tasks.md is missing, create it by listing all implementation steps you completed as rows with status COMPLETE. Reference the tasks.md format in `.claude/skills/orchestration/references/team-leader-modes.md` (MODE 1 Expected Output section)."

### Task 1.2: Verify tasks.md format is documented

**File**: .claude/skills/orchestration/references/team-leader-modes.md
**Status**: COMPLETE

Confirm the tasks.md format is documented in MODE 1 Expected Output. No change needed if it's already there (it is per current read). Just verify — no edit required unless something is missing.
