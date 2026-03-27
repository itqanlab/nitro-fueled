# Code Style Review — TASK_2026_045

## Score: 5/10

## Summary

Section 3e is structurally sound and the integration points in 3a and 3b are correct. However, the inline fallback table in 3e is an incomplete copy of `sizing-rules.md` — it is missing one dimension and uses different field names than the canonical source. This creates exactly the drift problem that review-general.md calls out. There are also two secondary issues: `sizing-rules.md` itself is now stale (it lists its consumers and does not mention Section 3e), and the intra-file section references use numbers that will silently break if sections are ever renumbered.

---

## Findings

### BLOCKING

**1. Inline fallback table omits the fourth dimension from `sizing-rules.md`**

- **File**: `.claude/agents/planner.md` lines 146–151 (Inline Fallback Limits table)
- **Problem**: `sizing-rules.md` defines four hard-limit dimensions. The fallback table in Section 3e reproduces only three of them. The missing row is: "Complexity 'Complex' + multiple architectural layers → Split required." When `sizing-rules.md` is absent, Section 3e will silently skip this check.
- **Impact**: A task flagged `Complexity: Complex` that spans multiple architectural layers will pass the fallback check and enter a worker session unchallenged — exactly the failure mode this task exists to prevent.
- **Fix**: Add the fourth row to the Inline Fallback Limits table. The detection logic in Step 5 must also include a corresponding check (e.g., read the Complexity field from `task.md` and, if "Complex", check whether the description spans multiple architectural layers or the File Scope crosses layer boundaries).

---

**2. Inline fallback table uses dimension names that do not match `sizing-rules.md`**

- **File**: `.claude/agents/planner.md` lines 148–150 vs. `task-tracking/sizing-rules.md` lines 16–19
- **Problem**: The canonical source uses "Files created or significantly modified" and "Requirements / acceptance criteria groups". The fallback table uses "Files in File Scope section" and "Acceptance criteria items/groups". These are not the same labels, and the first diverges in meaning: `sizing-rules.md` counts files the task modifies, while 3e Step 5 counts entries in the File Scope section of `task.md`. If a task author lists 6 files in File Scope but the task actually touches 8, the canonical dimension would flag it and the 3e check would pass.
- **Impact**: The fallback check is measuring a proxy (File Scope section entries) and calling it the same thing as the canonical limit, which measures actual modification scope. This produces silent false negatives.
- **Fix**: Either (a) align the fallback dimension name and description with `sizing-rules.md` ("Files created or significantly modified") and add a note that Section 3e approximates this by counting File Scope entries since `task.md` does not separately track "files actually modified", or (b) add a note in `sizing-rules.md` acknowledging the approximation. The key requirement is that readers understand the two documents are measuring slightly different things.

---

### SERIOUS

**3. `sizing-rules.md` header is now stale — does not list Section 3e as a consumer**

- **File**: `task-tracking/sizing-rules.md` line 3
- **Problem**: The header says "Referenced by `/create-task` (Step 6b) and the Planner agent (Section 4c)." Section 3e is now a third consumer that reads and applies this file. The omission means a future contributor editing `sizing-rules.md` does not know that a sizing review runs on every `/plan` and `/plan status` invocation. They may remove a dimension assuming it is only enforced at creation time, not realising it also gates the backlog review.
- **Impact**: Cross-file reference drift. The consumer list is the primary place where the impact of modifying `sizing-rules.md` is communicated to contributors.
- **Fix**: Update the header line in `sizing-rules.md` to read: "Referenced by `/create-task` (Step 6b), the Planner agent (Section 4c), and the Planner Backlog Sizing Review (Section 3e)." This is a one-line change outside the declared file scope of this task, but it is necessary for consistency.

---

**4. Intra-file section references use numbers that will break on renumbering**

- **File**: `.claude/agents/planner.md` lines 65 and 91
- **Problem**: Both call-sites read "Run **Backlog Sizing Review** (Section 3e)". The review-general.md lesson on cross-file references (line 62) requires using descriptive names rather than numbers so references survive renumbering. The same principle applies inside a single large file: if Section 3 is ever restructured and a new subsection is inserted before 3e, these references silently point to the wrong section. The name "Backlog Sizing Review" is present, which is good, but the number is the operative locator an agent will use.
- **Impact**: Low probability now, but planner.md has grown steadily (it is currently ~388 lines and will grow further). Section 3 already has five subsections; adding more is likely.
- **Fix**: Remove the parenthetical section number from both call-sites. "Run **Backlog Sizing Review**" is sufficient — the name is unique in the file and will survive any renumbering. If the number is kept as a navigational aid, it must be understood as non-authoritative.

---

**5. Section 3e is missing from the "What You Never Do" boundary conditions**

- **File**: `.claude/agents/planner.md` Section 10 (line 366 area)
- **Problem**: Section 10 lists things the Planner must never do but does not mention the constraint most relevant to Section 3e: never auto-split an oversized task. The rule exists in 3e Step 8d ("Wait for Product Owner approval before creating any replacement tasks. Do not auto-split.") but it is a critical safety constraint that belongs in the "never do" list, where it is visible at a glance without reading through all of Section 3.
- **Impact**: An agent skimming the "never do" list before acting on a backlog scan has no reminder that auto-splitting is forbidden. The instruction is present but buried.
- **Fix**: Add a line to Section 10: "Auto-split oversized tasks without Product Owner approval (see Section 3e — always wait for explicit approval before creating replacement tasks)."

---

### MINOR

**6. Step 3 in Section 3e uses a path pattern that is not self-explaining**

- **File**: `.claude/agents/planner.md` line 125
- **Problem**: "For each CREATED task, read `task-tracking/TASK_YYYY_NNN/task.md`." The placeholder `TASK_YYYY_NNN` is used correctly elsewhere in the document, but this is the only place where it appears as a path component inside a code-inline span. Readers unfamiliar with the convention could read this as a literal path rather than a template.
- **Fix**: Add a parenthetical: "...read `task-tracking/TASK_YYYY_NNN/task.md` (substituting the actual task ID)." or reword to "...read the `task.md` in that task's folder."

**7. Section 3e "Steps" heading uses bold-number format inconsistently**

- **File**: `.claude/agents/planner.md` lines 121–155
- **Problem**: The steps in Section 3e are numbered plain lists. Steps 8a–8e use alphabetic sub-bullets, which is the pattern that review-general.md (line 53) explicitly warns against: "mixed schemes (Step 5, Step 5b, Step 5c) signal to future contributors that insertions should continue the sub-letter pattern." Sub-steps 8a–8e are a small instance of this, but given this lesson was added in TASK_2026_043, introducing the same pattern in the same task cycle is a consistency failure.
- **Fix**: Convert 8a–8e to a flat continuation (steps 9–13) or replace the lettered sub-steps with a named block ("On approval:" / "On rejection:" inline prose) so there is no sub-letter numbering to continue.

---

## Verdict: NEEDS_FIXES

Two blocking issues must be resolved before this section is reliable. The inline fallback table is functionally incomplete (missing a dimension) and uses dimension names that diverge from the canonical source. Both issues cause silent false-negatives in the fallback path — which is the path most likely to be exercised immediately after deploying this change on a project that does not yet have `sizing-rules.md`.

The serious issues (stale consumer list in `sizing-rules.md`, section number references, missing "never do" entry) are correctness concerns that will cause maintenance problems within the next few planning cycles. The minor issues are cosmetic but follow directly from lessons that were already in `review-general.md` before this task was implemented.
