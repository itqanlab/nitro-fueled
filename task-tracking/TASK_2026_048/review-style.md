# Code Style Review — TASK_2026_048

## Summary

The `retrospective.md` command is well-structured and delivers a complete implementation matching the task specification. Three issues need attention before merge: a structural inconsistency in the `## Execution` section heading, a review artifact filename pattern mismatch in the data collection spec that will cause silent data loss in production, and a forward-reference ordering problem in Step 8b of the SKILL.md modification.

## Review Scores

| Criterion | Score |
|-----------|-------|
| Formatting consistency | 6/10 |
| Naming consistency | 5/10 |
| Structure | 7/10 |
| Cross-reference accuracy | 6/10 |
| Overall Score | 6/10 |

---

## Findings

### Blocking

#### B1: Review artifact filename pattern in Step 2 does not match actual codebase conventions

**File**: `.claude/commands/retrospective.md` — line 26

The data collection step instructs the executor to read:

```
task-tracking/TASK_*/review-code-*.md OR
task-tracking/TASK_*/code-style-review.md, code-logic-review.md, code-security-review.md
```

Neither pattern is reliable. Actual task folders use at least two distinct naming schemes:

- `review-code-style.md` / `review-code-logic.md` / `review-security.md` (TASK_2026_036, TASK_2026_023)
- `review-style.md` / `review-logic.md` / `review-security.md` (TASK_2026_029, TASK_2026_042, TASK_2026_048 itself)

The spec's primary pattern `review-code-*.md` will match `review-code-style.md` and `review-code-logic.md` but will MISS `review-style.md` and `review-logic.md`, silently under-counting findings from a large fraction of completed tasks. The fallback list `code-style-review.md` / `code-logic-review.md` / `code-security-review.md` does not match any files that actually exist in the repository.

The instruction must enumerate all known patterns and explicitly glob for all of them, or acknowledge the naming variance so the executor knows to handle both families. As written, a naive execution will silently skip half the review corpus.

**Fix**: Replace line 26 with a pattern list that covers both naming families:

```
- `task-tracking/TASK_*/review-code-style.md`, `review-code-logic.md`,
  `review-style.md`, `review-logic.md`, `review-security.md` — blocking/serious/minor
  finding counts, verdicts per review type. (Note: naming varies by task vintage;
  read whatever review files exist in each task folder.)
```

---

#### B2: Step 8b SKILL.md forward-reference to Step 8c creates unresolvable ordering

**File**: `.claude/skills/auto-pilot/SKILL.md` — line 809

The quality computation note inside Step 8b reads:

> "This data is already partially available from Step 8c; compute the Quality line using the same worker log collection pass."

Step 8b runs before Step 8c (8b is explicitly followed by 8c at line 818). A quality line that "is already partially available from Step 8c" requires Step 8c to have already executed, but Step 8c has not yet run at the point Step 8b fires.

An LLM following these instructions sequentially will encounter a forward-reference it cannot resolve and will either compute the quality metrics redundantly, skip them, or get confused about execution order.

**Fix**: Remove the parenthetical forward-reference on line 809. Replace with:

> "If any metric is unavailable, write `n/a` for that value only. (Step 8c performs a more detailed analytics pass on the same worker logs — collect the data once if possible and share across both steps.)"

This changes the direction of the reference from backward to forward, which is logically correct.

---

### Serious

#### S1: `## Execution` heading in retrospective.md diverges from command file conventions

**File**: `.claude/commands/retrospective.md` — line 13

Every other command in `.claude/commands/` uses `## Execution Steps` (auto-pilot.md, plan.md, create-task.md, initialize-workspace.md) or a numbered step list directly under `## Execution`. The retrospective command uses `## Execution` with no "Steps" suffix, and then labels its sub-sections `### Step N — Title` (dash-separated) rather than `### Step N: Title` (colon-separated) as used by all other commands.

This is a coherence issue: a developer scanning the codebase for "how our commands are structured" will see an inconsistent template signal.

**Recommendation**: Change line 13 from `## Execution` to `## Execution Steps` and change each `### Step N — Title` heading to `### Step N: Title` to align with the established pattern.

---

#### S2: `--since` mode relies on `completion-report.md` for dates, but registry has dates and is faster

**File**: `.claude/commands/retrospective.md` — line 19

The `--since YYYY-MM-DD` handling instructs:

> "Read each candidate `completion-report.md` to verify completion date."

The task registry (`task-tracking/registry.md`) already carries a `Created` date column, and `completion-report.md` files may not exist for older tasks or tasks that were completed outside the full orchestration pipeline. Instructing the executor to read N individual `completion-report.md` files before it even knows which tasks are in scope is wasteful and fragile.

The registry is the authoritative index. Reading it first (already required for `--all` mode) and then filtering by date before opening individual task folders is both faster and more robust.

**Recommendation**: Revise Step 1 `--since` bullet to read the registry first, filter task IDs with a `Created` date on or after the given date as a first pass, then optionally verify against `completion-report.md` only for tasks that pass the initial filter to get a more precise completion (vs creation) date.

---

#### S3: `## Skill Path` footer in retrospective.md is misleading

**File**: `.claude/commands/retrospective.md` — line 133

The footer reads:

```
## Skill Path

`.claude/skills/orchestration/SKILL.md` — not invoked directly; this command is self-contained.
```

The "Skill Path" convention in other commands (orchestrate.md, auto-pilot.md) links to the skill file that the command LOADS. Pointing to the orchestration skill when this command does not use it is confusing. The statement "not invoked directly; this command is self-contained" negates the section's own premise.

The retrospective command has no skill file. The footer should either be removed or changed to a `## References` section following the pattern of plan.md and create-task.md.

---

#### S4: No pre-flight check for required directories

**File**: `.claude/commands/retrospective.md` — general

Every other command that reads task-tracking artifacts (plan.md, auto-pilot.md, create-task.md) includes an explicit pre-flight check: does `task-tracking/` exist? Does `task-tracking/registry.md` exist?

The retrospective command has no such check. If run in an uninitialized workspace, Step 2 will produce confusing errors from failed file reads rather than a clean user-facing message.

**Recommendation**: Add a pre-flight step before Step 1 (or as Step 0):

```
Verify `task-tracking/` directory and `task-tracking/registry.md` exist.
If missing: "Workspace not initialized. Run /initialize-workspace first."
```

---

### Minor

#### M1: Planner.md Section 3a retrospective check (line 66) and Section 3b check (line 90) are nearly identical prose — consider extracting to a shared sub-section

**File**: `.claude/agents/planner.md` — lines 66 and 90

The retrospective check paragraph is copy-pasted between Section 3a and 3b with only one word different ("Surface any unresolved conflicts..." in 3a vs the same phrase in 3b). If the check logic ever changes, it must be updated in two places. Extract to a named procedure (e.g., "Step 1b: Retrospective Check" defined once in a new Section 2.x) and reference it from both 3a and 3b.

---

#### M2: Pro Tip #8 in planner.md uses a slightly different imperative voice than tips #1-7

**File**: `.claude/agents/planner.md` — line 441

Tips 1-7 all follow the pattern "**Verb the noun** — explanation." Tip 8 reads:

> "**Check `task-tracking/retrospectives/` before planning new tasks**..."

This is structurally consistent with the pattern. However "recent patterns predict where implementation will hit friction" reads as a declarative statement rather than a tip for the agent. Reframe as "read the most recent report to identify categories of risk that previously caused implementation friction" to maintain the action-oriented voice of the other tips.

---

#### M3: The `--since` example date in the command header is hardcoded

**File**: `.claude/commands/retrospective.md` — line 10

```
/retrospective --since 2026-03-25 # analyze from date
```

The date `2026-03-25` is a real date close to the authoring date of this file. Future readers may wonder if this is a meaningful date or just an example. Use a clearly generic form like `YYYY-MM-DD` in the comment (e.g., `# analyze tasks completed since this date`) to signal it is a placeholder.

---

#### M4: `## Important Rules` section appears at line 124 but the term "PO" (Product Owner) is used without being defined in this file

**File**: `.claude/commands/retrospective.md` — line 126

All other command files spell out "Product Owner" on first use or delegate to the planner/orchestrate skill which defines the role. Within retrospective.md, "PO" appears only in the Important Rules section, never having been introduced. New contributors will need to look up what "PO" means.

---

## Verdict

**PASS WITH NOTES**

Blocking issues B1 and B2 should be resolved before the command is exercised against real data: B1 will cause silent data loss by missing review files with older naming patterns, and B2 creates a logically impossible forward-reference that will confuse any LLM following Step 8b literally. Serious issue S3 (misleading Skill Path footer) is a credibility issue that will trip up anyone trying to understand the command's architecture. The remaining findings are improvements.
