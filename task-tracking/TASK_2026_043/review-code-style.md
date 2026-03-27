# Code Style Review — TASK_2026_043

## Score: 6/10

## Issues Found

---

### BLOCKING

**None.** All three files are internally coherent and the changes do not break any existing workflow. The issues below are serious enough to cause confusion or silent drift but are not blocking task creation outright.

---

### SERIOUS

#### S1: sizing-rules.md Hard Limits table contains a row that cannot be validated

**File**: `task-tracking/sizing-rules.md`, line 19

The Hard Limits table includes:

```
| Estimated batches in tasks.md | 3 |
```

`task-template.md` has no "batches" field. There is no section, table row, or metadata field called "batches" anywhere in the template. An agent following this rule cannot evaluate it against a written `task.md` because the artifact it would need to read does not exist. Either:

- This row is referencing an internal planning concept that never surfaces in the template (in which case it must be labeled as "Planner internal — not checkable by /create-task"), or
- The template is missing a "Batches" field that should have been added as part of this task.

As written, the row creates the false impression that this limit is enforceable. The corresponding check is also absent from the Step 5c validation table in `create-task.md`, which confirms no one actually intended to validate it — but that means the Hard Limits table in `sizing-rules.md` has a row the Planner might try to enforce that `/create-task` silently ignores.

**Impact**: Inconsistency between the two consumers of `sizing-rules.md`. A future Planner session may reject a task for exceeding "3 batches" when `/create-task` would have accepted it.

**Recommendation**: Either remove the "Estimated batches in tasks.md" row from the Hard Limits table entirely, or annotate it clearly as "Planner-internal heuristic — not checkable from task.md".

---

#### S2: Step numbering in create-task.md is broken at the insertion point

**File**: `.claude/commands/create-task.md`, lines 55–101

The command defines steps as:

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 5b → Step 5c → Step 6
```

Step 5 ("Update Registry"), Step 5b ("Validate Auto-Pilot Readiness"), and Step 5c ("Validate Task Sizing") are three discrete sequential operations using a lettered sub-step scheme. This is inconsistent: nothing in the command document describes this as a sub-step pattern, and Step 5b and 5c are not substeps of Step 5 — they are post-creation validation phases that logically belong after file and registry writes are complete.

A new contributor reading this document will be confused about whether:
- 5b and 5c are optional (sub-steps often imply conditional execution)
- The next step after "Step 5" is "Step 5b" or "Step 6"
- This is a deliberate versioning scheme to avoid renumbering later steps

The prior lesson in `review-general.md` explicitly states: "Cross-file section references must use names, not numbers — if a command references a section by number, and the agent renumbers sections, the reference silently breaks." Introducing a non-standard mixed numbering scheme (5, 5b, 5c) is exactly the kind of drift risk that lesson was trying to prevent.

**Impact**: If another step is inserted before Step 6, a future developer must decide whether the new step is "Step 5d" or "Step 6" (renumbering everything after). The pattern sets a bad precedent.

**Recommendation**: Renumber as Step 5, Step 6, Step 7, Step 8, or restructure 5b/5c as explicitly named sub-steps under a "Post-Creation Validation" section with its own numbered heading.

---

#### S3: Indicators section in sizing-rules.md duplicates the Hard Limits table without adding value

**File**: `task-tracking/sizing-rules.md`, lines 21–27

The "Indicators a Task Is TOO LARGE" section restates four of the five Hard Limits table rows nearly verbatim:

- "More than 5–7 files need creation or significant modification" (same as Hard Limits row 1)
- "Description exceeds ~150 lines" (same as Hard Limits row 4)
- "More than 5 acceptance criteria groups" (same as Hard Limits row 2)
- "Complexity is 'Complex' AND scope spans multiple architectural layers" (same as Hard Limits row... well, this is not in the Hard Limits table at all — see S4)

The section adds only one genuinely new indicator: "Multiple unrelated functional areas are touched" — and even that is not in the Hard Limits table.

This creates the exact duplication anti-pattern the task was designed to eliminate. A future edit to the Hard Limits table will be easy to miss in the Indicators section, or vice versa. In six months, the two sections will contradict each other.

**Impact**: Maintainability. The two sections will drift.

**Recommendation**: Collapse the Indicators section to reference-only content: "Any violation of the Hard Limits table above is an indicator. Additionally: multiple unrelated functional areas are touched." Remove the verbatim repetition.

---

#### S4: "Complexity is Complex AND multiple architectural layers" appears in Indicators but not the Hard Limits table

**File**: `task-tracking/sizing-rules.md`, lines 25 and 13–19

The Hard Limits table has five rows. "Complexity is Complex AND multiple architectural layers" is NOT one of them. It appears only in the Indicators section (line 25) and in the Step 5c validation table in `create-task.md` (line 98).

This makes the Hard Limits table incomplete as a reference. An agent that reads only the Hard Limits table to enforce rules will miss this condition. An agent that reads only the Indicators section will find it but without the "MUST NOT exceed" framing.

**Impact**: Inconsistent enforcement between agents relying on different sections. The Planner's Section 4c summary list in `planner.md` (line 143) does include this rule, which means the Planner enforces something the Hard Limits table does not claim as a limit.

**Recommendation**: Add a sixth row to the Hard Limits table: `| Complexity "Complex" + multiple architectural layers | Split required |` — and remove it from the Indicators section (covered by S3 above).

---

### MINOR

#### M1: "Non-blocking" semantics defined twice with slightly different phrasing

**Files**: `task-tracking/sizing-rules.md` (implicitly), `.claude/commands/create-task.md`, lines 80 and 101

Step 5c defines warnings as "non-blocking" in the warning template prose at line 80 ("You can proceed as-is or split the task into smaller pieces") and again at line 101 ("Warnings are non-blocking — display them, then continue to Step 6"). Saying it twice in the same step is fine, but the `sizing-rules.md` file itself never uses the word "non-blocking." If an agent reads only `sizing-rules.md` for behavioral guidance, it will see only the Splitting Guidelines section with "MUST NOT exceed" language, which implies blocking.

The severity is minor because `sizing-rules.md` is a reference doc, not a behavioral directive, and `create-task.md` is clear. But the framing mismatch between "MUST NOT exceed ANY of these" (sizing-rules.md) and "non-blocking warning" (create-task.md) is jarring when read together.

**Recommendation**: Add a one-sentence note to `sizing-rules.md` after the Hard Limits table: "These limits trigger warnings, not hard failures. The consuming command or agent determines whether violations block or warn."

---

#### M2: Warning template uses an emoji in a codebase that avoids them

**File**: `.claude/commands/create-task.md`, line 83

The warning template contains `⚠️`. The project instructions and agent conventions show no use of emoji in command or agent definition files. Step 6's success summary (lines 106–118) uses no emoji. The `review-general.md` lessons file uses no emoji. This is a one-off that stands out as inconsistent with the document's own tone.

**Recommendation**: Replace `⚠️ SIZING WARNING` with `WARNING — SIZING` or `[SIZING WARNING]` to match the plain-text convention of the rest of the command.

---

#### M3: planner.md Section 4c summary list partially duplicates sizing-rules.md

**File**: `.claude/agents/planner.md`, lines 139–144

After correctly delegating authority to `sizing-rules.md` as "single source of truth," the section immediately provides a four-item summary list:

```
- Max 5–7 files created or significantly modified
- Max 5 acceptance criteria groups
- Description must not exceed ~150 lines
- Complexity "Complex" + multiple architectural layers = split it
```

This summary will drift the moment `sizing-rules.md` is updated (e.g., if the file limit changes from 7 to 10). This is the same duplication problem the task was trying to fix in the planner's previous inline rules.

The summary is softer than the old inline rules (labeled "Summary of key limits" rather than an authoritative list), but it is still a maintenance liability.

**Recommendation**: Either remove the summary list entirely (trusting the reference doc), or explicitly caveat it: "Summary as of [task], may not reflect current values — see sizing-rules.md for authoritative limits."

---

#### M4: Step 5c does not specify what to do when the task.md file cannot be parsed

**File**: `.claude/commands/create-task.md`, lines 78–101

Step 5c instructs the agent to "validate the content against sizing rules" but does not describe the fallback if the agent cannot determine a count (e.g., if the description length is ambiguous, or if acceptance criteria groups are not clearly delimited). The checks involving judgment ("Multiple unrelated functional areas detected (use judgment)") have no definition of how confident the agent must be before firing the warning.

This is acceptable for a first implementation but worth noting: "use judgment" is an unbounded instruction that will produce inconsistent results across sessions.

**Recommendation**: Add a brief note: "When count is indeterminate, skip the check — do not warn based on uncertainty alone."

---

## Summary

The implementation correctly achieves its stated goal: a shared `sizing-rules.md` reference, a Step 5c in `/create-task`, and a delegating Section 4c in `planner.md`. The cross-references between files are accurate. The tone is consistent with surrounding content.

The two issues most likely to cause real problems are:

1. **The un-enforceable "Estimated batches" row in the Hard Limits table** (S1) — it references a field that does not exist in `task.md`, making it either a dead rule or a Planner-specific heuristic that was not meant to be shared.

2. **The broken step numbering scheme** (S2) — 5 / 5b / 5c is a non-standard pattern that sets a precedent for future insertions and conflicts with the project's existing lesson about cross-file section references breaking under renumbering.

The duplication concerns (S3, S4, M3) are the same class of problem the task was designed to fix; the implementation partially reintroduces them.

Score justification: The core requirement works (7/10 baseline), but the broken Hard Limits table row and step numbering issue are meaningful problems that will be hit by future maintainers (deduct 1 point each).
