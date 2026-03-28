# Code Logic Review — TASK_2026_124

**Reviewer**: nitro-code-logic-reviewer
**Date**: 2026-03-28
**Task**: Evaluation Supervisor — Single Model Mode
**Files Reviewed**:
- `.claude/skills/auto-pilot/SKILL.md` (Evaluation Mode section, lines 226-423; Evaluation Build Worker Prompt, lines 1956-1993; Modes table, line 170)
- `.claude/commands/nitro-auto-pilot.md` (full file)

---

## Summary

| Category | Count |
|----------|-------|
| Critical | 1 |
| Major | 2 |
| Minor | 4 |
| Info | 1 |

---

## Critical Issues

### C1: Benchmark Task Path Unreachable from Worktree

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 1969 and 1991

**Issue**: The Evaluation Build Worker Prompt instructs the worker to read the task description from `benchmark-suite/tasks/{task_id}/task.md`, but the worker's working directory is `{eval_worktree}` (an isolated git worktree). The `benchmark-suite/` directory exists in the main repository, not in the worktree.

**Prompt excerpt**:
```
1. Read the benchmark task description from: benchmark-suite/tasks/{task_id}/task.md
...
Working directory: {eval_worktree}
```

**Impact**: Evaluation Build Workers will fail to find the task description file, causing all benchmark tasks to fail.

**Root Cause**: Step E5.1 copies setup files from `benchmark-suite/tasks/{task_id}/setup/` into the worktree but does NOT copy `task.md`. The prompt assumes `benchmark-suite/` is accessible from the worktree, which it is not.

**Recommendation**: Either:
1. Copy `task.md` into the worktree as part of Step E5.1, or
2. Have the worker read from an absolute path to the main repo's benchmark-suite

---

## Major Issues

### M1: Compaction Count Not Tracked (Acceptance Criteria Gap)

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 366-380 (per-task result format) and lines 296-297 (session.md Task Results table)

**Issue**: The task acceptance criteria specifies "Compaction count (if available from MCP)" as a metric to collect. However:
- The per-task result file format (lines 366-380) does not include a Compaction Count field
- The session.md Task Results table (line 296-297) does not include a Compaction Count column

**Impact**: Acceptance criteria partially unmet. Compaction count is a useful metric for evaluating model efficiency (how often context compaction occurs).

**Note**: The normal state.md Active Workers table (line 2019) DOES have a Compaction Count column, but this tracking mechanism is not applied to Evaluation Mode.

---

### M2: Orphan Branch vs Detached HEAD Documentation Mismatch

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 306-311

**Issue**: Documentation inconsistency:
- Line 307 says: "Create a new orphan branch for the evaluation"
- Line 309 shows: `git worktree add --detach .claude/worktrees/eval-{eval_model_id} HEAD`

These are different concepts:
- **Orphan branch**: A branch with no parent commits
- **Detached HEAD**: A worktree pointing to a specific commit without being on a branch

The actual command creates a detached HEAD worktree, which is correct for isolation purposes. The documentation incorrectly describes it as an orphan branch.

**Impact**: Confusion for implementers/maintainers. The implementation intent (detached HEAD) is correct, but the prose is misleading.

---

## Minor Issues

### m1: Unused Branch Name Computation

**Location**: `.claude/skills/auto-pilot/SKILL.md`, line 306

**Issue**: Step E4.1 computes a worktree branch name `eval/{EVAL_DATE}-{eval_model_id}`, but this value is never used. The worktree is created with `--detach` (no branch) and the worktree path uses a different naming pattern: `.claude/worktrees/eval-{eval_model_id}`.

**Impact**: Dead code/documentation. Not harmful but confusing.

---

### m2: Success Detection Logic Overly Permissive

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 358-362

**Issue**: Success detection checks for EITHER `eval-result.md` OR git commits:
```
- Read `{EVAL_WORKTREE}/eval-result.md` if present
- Check git log in worktree for commits by the worker
- If evidence of work exists: mark as SUCCESS
```

However, the Evaluation Build Worker Prompt explicitly instructs workers to write `eval-result.md` with `Status: DONE`. The current logic would mark a task as SUCCESS even if:
- The worker made commits but crashed before writing `eval-result.md`
- The worker wrote partial work without completing the task

**Recommendation**: Consider checking specifically for `eval-result.md` with `Status: DONE` as the primary success indicator.

---

### m3: No Delay in Worktree Cleanup Retry

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 312-315

**Issue**: The worktree creation retry logic does not specify a delay between cleanup and retry:
```
- Attempt cleanup: `git worktree remove .claude/worktrees/eval-{eval_model_id} --force`
- Retry creation once.
```

**Impact**: On some systems, filesystem operations may require a brief delay to fully complete. Immediate retry could fail spuriously.

---

### m4: Error Messages Not Captured on Worktree Failure

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 312-315

**Issue**: When worktree creation fails and cleanup is attempted, no mechanism is specified to capture the actual error messages from git commands. The FATAL log entry just says "Cannot create evaluation worktree" without the underlying git error.

**Impact**: Debugging worktree issues becomes harder without the actual git error output.

---

## Informational

### i1: Retry Logic Correctly Implemented

**Location**: `.claude/skills/auto-pilot/SKILL.md`, lines 383-384

The retry logic is correct as specified:
- Workers start with `retry_count: 0` (Step E5.5)
- On failure, if `retry_count < 1`, increment and re-spawn
- If `retry_count >= 1`, mark FAILED

This results in exactly 2 total attempts (initial + 1 retry), which matches the task description's "1 retry per task" specification.

---

## Cross-File Consistency Check

| Item | SKILL.md | Command File | Status |
|------|----------|--------------|--------|
| `--evaluate` parameter | line 170 (Modes table) | line 33 (Parameters table) | OK |
| Evaluation mode trigger | line 228 | line 57-60 (parsing) | OK |
| Skips Steps 3-4 | line 228 (separate flow) | line 59 ("skip Steps 3 and 4") | OK |
| Model ID requirement | line 239 | line 58 ("`<model-id>` is required") | OK |
| Quick Reference modes | — | line 293 (includes `evaluate`) | OK |
| Benchmark suite reference | line 233 | line 306 | OK |

No cross-file consistency issues found.

---

## Verdict

**CONDITIONAL PASS** — Critical issue C1 must be resolved before merge. The benchmark task path is unreachable from the worktree, which would cause all evaluation runs to fail.

Issues M1 (compaction count tracking gap) and M2 (orphan branch documentation) should be addressed but do not block merge.

Minor issues are documentation/robustness improvements that can be addressed in a follow-up.
