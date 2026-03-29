# Code Style Review — TASK_2026_139

## Verdict: PASS_WITH_NOTES
Score: 7/10

---

## Summary

Six files reviewed across 212 lines of new content. The documentation is mostly clear and internally consistent. The cortex/fallback dual-path pattern is applied uniformly, terminology is stable, and cross-references resolve correctly. Three issues need tracking before this ships as scaffold content: one terminology mismatch between files, one ambiguous step label placement in `sequential-mode.md`, and one forward reference that points "below" when the target is actually above.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The warning string quoted in `SKILL.md:71` (`"ESCALATE disabled — cortex unavailable"`, lowercase `d`) does not match the log template in `log-templates.md:80` (`ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false`, all-caps). An implementer reading SKILL.md will write a different log string than what log-templates.md documents. Six months from now, anyone grepping logs for that string will find nothing, and the discrepancy will look like a bug in either the skill or the template.

### 2. What would confuse a new team member?

`parallel-mode.md` step `2b` is used for two different things in the same file. The first `2b` appears at line 1088 inside Step 8b ("Cortex path — log SUPERVISOR_COMPLETE"). A second `2b` appears at line 1232 inside Step 8d ("Cortex teardown — call end_session"). Both are labeled `2b`. A new reader following the numbered steps in Step 8d would wonder why step 2b appears in a section that starts at step 1. The teardown step is logically step 3 of Step 8d (after step 2's git commit); calling it `2b` misrepresents its position.

### 3. What's the hidden complexity cost?

The new "If cortex_available = true" block injected between Step 8b's step 1 and step 2 (parallel-mode.md lines 1045-1056) breaks the numbered list flow. The sequence is: step 1 (Read file) → unnumbered cortex prose block → step 2 (Append). This makes it non-obvious that the cortex block is a sub-procedure of step 1, not a stand-alone step. Future editors who add more cortex-path blocks may perpetuate this pattern inconsistently.

### 4. What pattern inconsistencies exist?

The new rows added to `log-templates.md` (lines 78-84) use inconsistent column alignment relative to the existing rows above them (lines 65-77). The existing rows have tightly-padded pipes; the new rows have trailing spaces pushing the pipe columns out of alignment. In rendered Markdown this is invisible, but the raw file is harder to edit and the misalignment will be replicated by implementers copying the table to add future rows. This is a minor cosmetic issue but inconsistent with the file's established style.

### 5. What would I do differently?

The "Handoff Context" section added to `worker-prompts.md` at line 234 is placed between the Review Lead's exit-gate checklist and the Commit Metadata block. The placement is correct by intent (the note says "before this Commit Metadata block"), but the section heading `## Handoff Context (injected when cortex available)` is a permanent fixture while the injected `## Handoff Data` block is conditional and dynamic. The heading could be confused with the injected block itself. A `> Note:` blockquote rather than an `##` heading would make it clearer that this is a standing instruction, not a conditional prompt section. That said, this is a preference, not a bug.

---

## Blocking Issues

None.

---

## Serious Issues

### Issue 1: Log string mismatch between SKILL.md and log-templates.md

- **File**: `.claude/skills/auto-pilot/SKILL.md:71` vs `.claude/skills/auto-pilot/references/log-templates.md:80`
- **Problem**: SKILL.md quotes the warning as `"ESCALATE disabled — cortex unavailable"`. log-templates.md defines the canonical log row as `ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false`. Two differences: (1) case — `disabled` vs `DISABLED`; (2) SKILL.md omits the `escalate_to_user forced false` suffix that log-templates.md includes. These two documents now contradict each other on what string gets written to log.md.
- **Tradeoff**: If an implementer follows SKILL.md, logs will not match the template. Log monitoring or grep tooling built against log-templates.md will miss these events.
- **Recommendation**: Update SKILL.md:71 to use the exact string from log-templates.md: `ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false`. The SKILL.md note is explanatory prose, so quoting the exact log string makes it a useful anchor, not a maintenance liability.

### Issue 2: Duplicate "2b" step label in parallel-mode.md

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md:1088` and `:1232`
- **Problem**: Step 8b has a sub-step labeled `2b` (log SUPERVISOR_COMPLETE). Step 8d — a completely separate step — also has a sub-step labeled `2b` (Cortex teardown via end_session). The label collision means any cross-reference like "see Step 8d step 2b" is unambiguous, but reading sequentially the second `2b` looks like a continuation of Step 8b's numbering. The teardown is logically the third action of Step 8d (after validating SESSION_ID in step 1 and running git commit in step 2), so `3.` or `Step 8d-cortex` would be cleaner.
- **Tradeoff**: Won't cause runtime errors but will confuse a reader following the numbered steps.
- **Recommendation**: Rename the Step 8d sub-step from `**2b. Cortex teardown**` to `**3. Cortex teardown (cortex_available = true only)**` to keep it sequential with the existing steps 1 and 2 in Step 8d.

---

## Minor Issues

- **Minor** — `parallel-mode.md:1045` — The cortex-path prose block injected between step 1 and step 2 of Step 8b uses the heading `**If cortex_available = true**` rather than a numbered sub-step or a `> Note:` blockquote. This breaks the numbered step flow visually. No functional impact, but it is inconsistent with how other cortex-path blocks in the same file are formatted (which use bold labels like `**Cortex path (cortex_available = true):**` as stand-alone blocks before or after the numbered steps, not injected between them).

- **Minor** — `log-templates.md:78-84` — New rows have trailing whitespace in the event-name column (e.g., `| log_event call failed         |` vs `| Session archive committed |` in the rows above). This is a raw-file cosmetic inconsistency. Not a problem in rendered output but makes the table harder to edit with column-aligned editors.

- **Minor** — `parallel-mode.md:1285` — The forward-reference `see ### Step 7f-escalate below` points "below" but `### Event Logging — Cortex Path` is a section that appears at the end of the file, AFTER Step 7f-escalate (line 891). The reference is technically correct — the section is below line 1285 only if the reader is reading from the top — but the phrasing "below" is misleading since Step 7f-escalate is at line 891 and the Event Logging section is at line 1251. Both occur after the NEED_INPUT signal description. The word "below" should be "above" or the reference rephrased as "see **Step 7f-escalate** in this file".

- **Minor** — `cortex-integration.md:85-105` — The four new sections (`### Event Logging`, `### Session History`, `### Worker Handoff Injection`, `### Session Teardown`) are added after the `## Bootstrap Note` section without a separating `---` horizontal rule or a parent `##` heading. All other sections in the file use `##` headings (`## Cortex DB Paths by Step`, `## Bootstrap Note`). The new sections use `###` headings directly under `## Bootstrap Note`, making them appear as children of Bootstrap Note rather than peers. This is a structural heading-level inconsistency.

- **Minor** — `sequential-mode.md:113` — The "Note:" that explains cortex_available detection timing is not formatted as a blockquote (`>`) or bold label, unlike similar notes elsewhere in the auto-pilot reference files. Minor formatting inconsistency.

---

## File-by-File Analysis

### SKILL.md

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

The new config table row for `escalate_to_user` (line 63) is well-written and correctly documents the dependency on `cortex_available`. The new note block (lines 68-72) is clear but contains the log string mismatch described in Serious Issue 1. The note block style (multi-line blockquote) matches the existing `Note on stuck detection` block above it — consistent.

### parallel-mode.md

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 2 minor

The `5c-handoff` step is well-placed and the injection format block is unambiguous. The `7f-escalate` step is clearly scoped with both `escalate_to_user = true` AND `cortex_available = true` conditions — no ambiguity. The Step 8b cortex additions are complete and accurate but the inter-step injection of the `**If cortex_available = true**` block (between numbered steps 1 and 2) breaks the list flow. The Step 8d `2b` label collision is the most likely cause of future confusion.

The Event Logging section at the end of the file is the most polished new addition: the table is correctly formatted, aligned, and covers all the event types mentioned elsewhere in the diff. The NEED_INPUT note at line 1285 has the "below" direction error.

### sequential-mode.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

The cortex teardown addition is concise and well-scoped. The note about `cortex_available` detection at startup correctly mirrors the parallel-mode pattern. The only issue is the bare `Note:` formatting that does not match the blockquote style used elsewhere.

### worker-prompts.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Both "Handoff Context" additions are identical (correct — both Review Lead variants need the same instruction) and the placement between exit-gate and Commit Metadata is logical. The prose is unambiguous about priority: injected data wins over file read. The fallback instruction (`read handoff.md from disk as usual`) correctly matches existing worker behavior.

### cortex-integration.md

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

All four new sections are accurate summaries of the parallel-mode.md details. Cross-references to `parallel-mode.md` section names are correct and resolve. The heading-level issue (new `###` sections as children of `## Bootstrap Note` rather than as peers) is the main structural concern.

### log-templates.md

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

All seven new rows are complete and cover the full set of new events introduced in this task. The event names in the first column are consistent in casing (title case for descriptions). The log string format follows the `\| {HH:MM:SS} \| auto-pilot \| MESSAGE \|` convention used throughout. Trailing whitespace in the first column is the only defect.

---

## Pattern Compliance

| Pattern                        | Status         | Concern                                                       |
|-------------------------------|----------------|---------------------------------------------------------------|
| Dual cortex/fallback structure | PASS           | Every new step documents both paths                           |
| Bold labels for path variants  | PASS           | `**Cortex path**` / `**Fallback path**` used consistently     |
| best-effort / fire-and-forget  | PASS           | Terminology consistent across all six files                   |
| Cross-references resolve       | PASS WITH NOTES| `7f-escalate below` direction error in parallel-mode.md:1285  |
| Heading levels consistent      | FAIL           | cortex-integration.md new sections use wrong heading level    |
| Log string consistency         | FAIL           | SKILL.md warning string diverges from log-templates.md row    |
| Table alignment                | PASS WITH NOTES| log-templates.md new rows have trailing whitespace            |

---

## Technical Debt Assessment

**Introduced**: The `2b` step label collision in parallel-mode.md creates ambiguity for future editors adding cortex paths to other steps.

**Mitigated**: The event type mapping table (parallel-mode.md, end of file) consolidates what was previously scattered across narrative prose — this is a net debt reduction for future implementers.

**Net Impact**: Slight increase, primarily from the label collision and log string mismatch.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The log string mismatch between SKILL.md and log-templates.md (Serious Issue 1) is the only item that produces a concrete operational defect — logs would not match templates, breaking any tooling or grep patterns built against the canonical format. The duplicate `2b` label (Serious Issue 2) is a documentation clarity bug that will slow future contributors. Both are one-line fixes.

---

## What Excellence Would Look Like

A 9/10 version of this diff would:
1. Use an exact, quoted log string in SKILL.md that matches log-templates.md character-for-character.
2. Assign the Step 8d cortex teardown a step number that follows sequentially from steps 1 and 2 in that section.
3. Promote the four new cortex-integration.md sections from `###` to `##` (or add a `## New Cortex Paths` parent), making them peers of Bootstrap Note rather than its children.
4. Format the sequential-mode.md `Note:` as a blockquote for consistency with the rest of the auto-pilot reference style.
5. Remove trailing whitespace from log-templates.md new rows.
