# Code Style Review — TASK_2026_124

**Reviewer**: nitro-code-style-reviewer
**Date**: 2026-03-28
**Verdict**: PASS WITH NOTES

---

## Summary

The implementation adds the `--evaluate` flag and Evaluation Mode to the Auto-Pilot skill and command. The overall structure is consistent with existing patterns — sections are clearly headed, tables follow the established column convention, and the prompt template matches the format of existing Build Worker prompts. Six style issues are noted below, none of which are blocking.

---

## Issues

### S1 — Stale cross-reference in SKILL.md (Minor)

**File**: `.claude/skills/auto-pilot/SKILL.md`, line 172
**Severity**: Minor

The line updated by this task reads:

> "Single-task, dry-run, and evaluation modes are handled by the command entry point (`.claude/commands/auto-pilot.md`)."

The actual command file is `.claude/commands/nitro-auto-pilot.md`. The old name `auto-pilot.md` no longer exists. Any reader navigating to this path will not find the file.

---

### S2 — Dead variable: branch name computed but never used in E4 (Minor)

**File**: `.claude/skills/auto-pilot/SKILL.md` — Step E4
**Severity**: Minor

Step E4 begins:

> "1. Compute worktree branch name: `eval/{EVAL_DATE}-{eval_model_id}` (sanitized)."

The immediately following `git worktree add` command uses `--detach`, which means no branch is created. The computed name is never referenced again in E4 or in any subsequent step. This creates a confusing dead variable — the reader expects the branch name to be stored or passed somewhere.

---

### S3 — `session.md` initial template lacks `Finished` row placeholder (Minor)

**File**: `.claude/skills/auto-pilot/SKILL.md` — Steps E3 and E7
**Severity**: Minor

The `session.md` template in Step E3 includes these metadata fields: Model, Date, Started, Status, Tasks, Completed, Failed. Step E7 instructs: "Add `Finished` field with current timestamp." This means `Finished` is appended as a new row at finalization time. Per the review lessons: "Summary sections must be updated when the steps they describe change." The initial template should include a `Finished` placeholder (e.g., `| Finished | — |`) so the session.md structure is stable and parseable regardless of whether finalization has run.

---

### S4 — Variable casing inconsistency: `EVAL_WORKTREE` vs `{eval_worktree}` (Minor)

**File**: `.claude/skills/auto-pilot/SKILL.md` — Step E4 vs Evaluation Build Worker Prompt
**Severity**: Minor

Throughout E4–E7 the worktree path variable is always written as `EVAL_WORKTREE` (all-caps, consistent with `EVAL_DIR` and `EVAL_DATE`). However, the Evaluation Build Worker Prompt template (line 1991) uses:

```
Working directory: {eval_worktree}
```

The lowercase `{eval_worktree}` diverges from every other variable in this section. All template substitution variables in this file follow `{lower_snake}` form, so the inconsistency is on the prose side (uppercase in step instructions vs lowercase in templates). This is an internal inconsistency that could confuse a reader filling in template values — a note linking the two forms would resolve the ambiguity.

---

### S5 — `{notes}` in session.md table is undefined (Minor)

**File**: `.claude/skills/auto-pilot/SKILL.md` — Step E6
**Severity**: Minor

Step E6 step 3c writes a row to the session.md Task Results table:

```
| {task_id} | {difficulty} | {SUCCESS/FAILED} | {wall_clock}s | {retry_count} | {notes} |
```

The `{notes}` variable is never defined in any preceding step and has no documented source. The per-task result file template (same step, E6 step 3d) also omits a `Notes` field entirely. Per the review lessons: "Each distinct set of valid enum values must have its own documented subsection." The same principle applies to undocumented template variables — `{notes}` should either be defined (e.g., "populated from the worker's eval-result.md Notes field, or empty string if absent") or the column removed to match the per-task file template.

---

### C1 — Contradictory routing for `--evaluate` across Step 2 and Step 6 (Minor)

**File**: `.claude/commands/nitro-auto-pilot.md` — Steps 2 and 6
**Severity**: Minor

Step 2 says:

> "If `--evaluate` is present, skip Steps 3 and 4 entirely and **jump directly to the Evaluation Mode sequence in SKILL.md**."

Step 6 also contains an explicit `--evaluate` handler:

> "IF `--evaluate <model-id>`: Enter Evaluation Mode. See the `## Evaluation Mode` section in SKILL.md."

These two instructions are contradictory. Step 2 implies execution jumps from Step 2 straight to SKILL.md (bypassing Step 5 and Step 6 entirely). Step 6 implies normal execution flow continues through Step 5 (Display Summary) and Step 6, at which point the evaluate branch is taken.

A secondary symptom: the Step 5 `Mode:` display line only lists `{all | single-task TASK_ID | dry-run}` — `evaluate` is absent. If Step 5 does run in evaluate mode (which Step 6 implies), the display would either show nothing or an incorrect mode. The routing intent should be made unambiguous in one place and the other updated to match.

---

## Non-Issues (Explicitly Confirmed)

- **Modes table row**: The new `| **Evaluate** | ... |` row matches the column count and formatting of all other rows. No issue.
- **Parameters table**: The `--evaluate` row format is consistent with `--continue` (both accept an optional/required string argument). No issue.
- **Evaluation Build Worker Prompt structure**: Header format, numbered steps, and exit instruction all match the existing Build Worker Prompt template. No issue.
- **File size**: Both files are large reference documents; no line-limit concern applies per project conventions.
