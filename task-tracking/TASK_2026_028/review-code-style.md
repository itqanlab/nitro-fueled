# Code Style Review — TASK_2026_028

## Score: 7/10

## Summary

The two additions are structurally sound and follow the document's overall tone and formatting conventions. One substantive issue exists: the "Expected" cell of the new table row overpromises what the specified Command actually verifies, creating an internal inconsistency in the table that could mislead a worker running the check.

---

## Findings

### SERIOUS — Expected cell claims content verification, Command only checks existence

**File**: `.claude/skills/orchestration/SKILL.md` line 339

**Problem**: The new table row reads:

```
| tasks.md exists | Glob task-tracking/TASK_[ID]/ for tasks.md | File exists with at least one subtask row |
```

A `Glob` call only confirms whether the file is present in the filesystem. It does not inspect file contents. The Expected value — "File exists with at least one subtask row" — makes a content claim ("at least one subtask row") that the specified Command cannot fulfill.

Every other row in the table is internally consistent: "All sub-tasks COMPLETE" uses `Grep "COMPLETE" in tasks.md` (content check); "Registry updated" uses `Grep task ID in registry.md` (content check). The new row breaks this discipline by coupling a filesystem check with a content expectation.

A worker following the table literally will run a Glob, see the file exists, mark the check green, and move on — even if tasks.md is empty. The "at least one subtask row" requirement would go unenforced.

**Fix**: Either split into two rows or align the Expected cell with what Glob actually verifies:

Option A — Split into two rows (preferred, matches existing granularity):
```
| tasks.md exists         | Glob task-tracking/TASK_[ID]/ for tasks.md | File present |
| tasks.md non-empty      | Grep "### Task" in tasks.md                | At least one task entry found |
```

Option B — Tighten Expected to match Command:
```
| tasks.md exists | Glob task-tracking/TASK_[ID]/ for tasks.md | File present in task folder |
```
(The content requirement then belongs in "All sub-tasks COMPLETE" row, which already uses Grep.)

---

### MINOR — Cross-reference section name uses em dash that does not reflect document heading structure

**File**: `.claire/skills/orchestration/SKILL.md` line 348

**Problem**: The recovery note reads:

> See the tasks.md format in `.claude/skills/orchestration/references/team-leader-modes.md` (MODE 1 — Expected Output section).

In `team-leader-modes.md`, the actual heading structure is:
```
## MODE 1: DECOMPOSITION
### Expected Output
```

The cross-reference uses an em dash (`MODE 1 — Expected Output`) to imply a combined name, but neither heading uses an em dash. A reader searching for "MODE 1 — Expected Output" as a section anchor would not find it. The reference is navigable in practice (the file is short enough), but it does not follow the review lesson from `review-general.md`:

> Cross-file section references must use names, not numbers — if a command references "Planner protocol 5b", and the agent renumbers sections, the reference silently breaks. Use descriptive references.

More precisely: the reference should match the heading as it actually appears.

**Fix**: Update to use the exact heading hierarchy:

> See the tasks.md format in `.claude/skills/orchestration/references/team-leader-modes.md` (the "Expected Output" section under "MODE 1: DECOMPOSITION").

---

### MINOR — Recovery note uses "rows" terminology inconsistent with tasks.md format

**File**: `.claude/skills/orchestration/SKILL.md` line 348

**Problem**: The recovery note instructs:

> Create it by listing all implementation steps you completed as COMPLETE rows.

The tasks.md format (as shown in `team-leader-modes.md` MODE 1 Expected Output section) is not a table — it uses `### Task N.N:` heading blocks with `**Status**: COMPLETE` fields. Calling these "COMPLETE rows" is a terminology mismatch. A worker unfamiliar with the format might interpret "rows" as meaning table rows and produce the wrong structure.

**Fix**: Use format-accurate language:

> Create it by listing all implementation steps you completed, each as a `### Task N.N:` entry with `**Status**: COMPLETE`.

Or, more simply:

> Create it following the format in that file, marking all completed steps as `**Status**: COMPLETE`.

---

## Verdict

APPROVED WITH MINOR FIXES

The SERIOUS finding does not block logic — the adjacent "All sub-tasks COMPLETE" row catches empty tasks.md at the content level, so the gate is not entirely blind. However, the Expected cell mismatch is a documentation quality problem that will confuse future maintainers and could result in a worker treating a Glob result as sufficient verification. It should be corrected before this task is closed.
