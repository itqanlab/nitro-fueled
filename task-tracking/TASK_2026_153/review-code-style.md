# Code Style Review - TASK_2026_153

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 6/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Blocking Issues | 1                                    |
| Serious Issues  | 3                                    |
| Minor Issues    | 3                                    |
| Files Reviewed  | 2                                    |
| Verdict         | FAIL                                 |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The Per-Phase Output Budget section in SKILL.md sits between two consecutive `---` horizontal rule dividers (lines 37-39 in the final file). This double-separator is visually confusing and creates a structural ambiguity: the section looks orphaned from its surrounding context. A future contributor inserting content above or below the budget table risks placing it outside the HARD RULES block without realizing it. The budget section is functionally a HARD RULE extension but is positioned after the closing `---` of the HARD RULES block — creating a two-source-of-truth: rules are defined in the NEVER DO list AND partially re-stated in the budget table below it.

### 2. What would confuse a new team member?

The heartbeat format was changed from `[HH:MM:SS] Monitoring: {N} active — {TASK_X (Build/provider)...}. Sleeping 30s.` to `[HH:MM] monitoring — {N} active, {N} complete, {N} failed`. The new format drops seconds precision from the timestamp (`HH:MM:SS` → `HH:MM`). No rationale is documented and no comment in the file explains the deliberate precision loss. A developer reading the ANTI-STALL RULE pseudocode block (which also uses `[HH:MM]`) would not know whether the coarser timestamp was intentional or a typo.

Additionally, the Completion row in the Per-Phase Output Budget table uses `COMPLETE task=<task_id> → IMPLEMENTED` as an example, but the table caption for that row reads "Completion". A new reader scanning the table will be confused: the row says the output is `COMPLETE → IMPLEMENTED` but IMPLEMENTED is a BUILD completion state, not a general completion event. The label/example mismatch creates ambiguity about whether this row applies to Build Workers, Review Workers, or both.

### 3. What's the hidden complexity cost?

The Per-Phase Output Budget section introduces an **inline duplicate** of behavioral rules already encoded in HARD RULE #9, the ANTI-STALL RULE pseudocode block (parallel-mode.md line ~731), and the Step 5h spawn sequence (parallel-mode.md line ~688-699). Maintaining four partially-overlapping definitions of the same constraint (output = one line) means any future format adjustment must be propagated to all four locations. The review-general.md lessons explicitly call this out as a pattern that defeats the single-source-of-truth principle ("Partial delegation defeats the purpose," TASK_2026_043).

### 4. What pattern inconsistencies exist?

Three locations in parallel-mode.md now define the heartbeat format:
- ANTI-STALL RULE pseudocode block: `[HH:MM] monitoring — N active, N complete, N failed`
- Event-driven mode Step 6 paragraph: `[HH:MM] monitoring — {N} active, {N} complete, {N} failed`
- Polling mode Step 6 paragraph: `[HH:MM] monitoring — {N} active, {N} complete, {N} failed`

The Per-Phase Output Budget table in SKILL.md then adds a fourth definition using angle-bracket placeholders: `[HH:MM] monitoring — <N> active, <N> complete, <N> failed`.

Three of the four locations use curly-brace notation `{N}` while the budget table uses angle-bracket notation `<N>`. This is a formatting inconsistency across canonical definitions of the same string. It does not change runtime behavior, but it establishes two different placeholder conventions in files supervisors read as instruction sources, which can cause format ambiguity when agents interpolate the values.

### 5. What would I do differently?

1. Move the Per-Phase Output Budget section inside the HARD RULES block (before the closing `---`) rather than after it, so it is unambiguously part of the rules block and not a floating section.
2. Remove the double `---` divider that creates the dead whitespace between sections 37-39.
3. Make the Completion row example reflect the actual behavior: either show Build completion `COMPLETE task=X → IMPLEMENTED` and Review completion `COMPLETE task=X → COMPLETE` as separate rows, or use a generalized example that does not imply a specific end-state.
4. Standardize all four heartbeat format definitions to use the same placeholder notation (curly-braces throughout, matching the existing parallel-mode.md style).
5. Add a "see also" cross-reference in HARD RULE #9 pointing to the budget table and vice-versa, rather than having the rule definition and the format definition in two disconnected sections.

---

## Blocking Issues

### Issue 1: Double Horizontal Divider Creates Dead Section

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 37-40
- **Problem**: Two consecutive `---` dividers were added when the Per-Phase Output Budget section was inserted. The sequence is: `---` (end of HARD RULES block) → `---` (second divider, added by this task) → `## Per-Phase Output Budget`. The second `---` is orphaned dead markup that produces no visual header and signals to Markdown renderers that the HARD RULES block ended before the budget section begins. Workers scanning for the rules block end will exit at the first `---` and may not read the budget section as a rule.
- **Impact**: Supervisors that re-read SKILL.md after compaction may interpret the budget section as non-authoritative (it is outside the HARD RULES block boundary). Any future edit to the HARD RULES block that removes the trailing `---` would also silently remove the budget section delimiter.
- **Fix**: Remove the redundant second `---` and move the `## Per-Phase Output Budget` heading to a position inside the HARD RULES block (after NEVER DO / ALWAYS DO), OR keep it after the block but remove the double divider and add a bold annotation: `> This section is a HARD RULE extension — treat violations with the same severity.`

---

## Serious Issues

### Issue 1: Completion Row Example State is Misleading

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Per-Phase Output Budget table, Completion row
- **Problem**: The Completion row documents the output as `COMPLETE task=<task_id> → IMPLEMENTED` (or `FAILED` / `BLOCKED`). The example `→ IMPLEMENTED` represents a Build Worker terminal state, but `→ COMPLETE` is the Review+Fix Worker terminal state. These are different events for different worker types. The format string conflates them into one row, with the parenthetical `(or FAILED / BLOCKED)` only covering failure cases — not the second success path `→ COMPLETE`.
- **Tradeoff**: A supervisor reading the table will produce `COMPLETE task=X → IMPLEMENTED` for ALL completions including Review+Fix Workers, because the only success example shown is `→ IMPLEMENTED`. This is a behavioral drift risk.
- **Recommendation**: Split into two rows — one for Build Worker completions (`→ IMPLEMENTED`) and one for Review+Fix Worker completions (`→ COMPLETE`), or use a generalized format such as `COMPLETE task=<task_id> → <new_state>` with a note on which states are valid.

### Issue 2: Placeholder Notation Inconsistency Across Four Canonical Definitions

- **File**: `.claude/skills/auto-pilot/SKILL.md` (budget table uses `<N>`) vs. `.claude/skills/auto-pilot/references/parallel-mode.md` lines ~700, ~768, ~808 (all use `{N}`)
- **Problem**: The heartbeat format string is now canonically defined in four places. Three of those places use curly-brace placeholder notation (`{N} active`) while the budget table in SKILL.md uses angle-bracket notation (`<N> active`). The existing review-general.md lesson states: "Enum values must match canonical source character-for-character" (TASK_001). While placeholders are not enum values, the same principle applies to format string templates: two notations in two locations that are both read by the same autonomous worker creates ambiguous interpolation targets.
- **Recommendation**: Standardize the budget table to use curly-braces (`{N}`) to match all three parallel-mode.md definitions. The budget table is the new entry point — it should conform to the established notation, not introduce a new one.

### Issue 3: Summary Section (Key Principles #8) Not Updated After Step 8 Change

- **File**: `.claude/skills/auto-pilot/SKILL.md` — Key Principles section, Principle #8
- **Problem**: Key Principle #8 reads: `A completed task triggers immediate re-evaluation of the dependency graph`. This is a summary of Step 7f behavior. The task also added a `SESSION COMPLETE` output requirement to Step 8's termination table. The Key Principles list does not mention the session termination output format at all. The review-general.md lesson explicitly states: "Summary sections must be updated when the steps they describe change" (TASK_2026_064). While the Key Principles list is not a direct summary of Step 8, any session-end behavior change should be reflected in the section the Supervisor reads first.
- **Recommendation**: Add a Key Principle that covers the output budget rule, such as `Output exactly ONE conversation line per event — see Per-Phase Output Budget`. This makes the budget rule discoverable from the Key Principles scan without requiring the supervisor to find the budget table buried mid-document.

---

## Minor Issues

1. **SKILL.md line ~52 — Extra blank line after budget table**: There is a double blank line between the closing of the Per-Phase Output Budget table and the "Autonomous loop that processes..." paragraph. Per the existing codebase style (single blank line between sections), this is inconsistent and slightly enlarges context consumption.

2. **parallel-mode.md ANTI-STALL RULE pseudocode vs. Step 6 event-driven step ordering**: The ANTI-STALL RULE pseudocode block defines the heartbeat line as coming AFTER `if done: exit in Step 8`, but the Step 6 Event-Driven Mode description prints the heartbeat BEFORE calling `sleep 30` (i.e., heartbeat → sleep, not sleep → heartbeat). This execution order inconsistency pre-dates this task but was not corrected despite the heartbeat format being touched in both sections.

3. **parallel-mode.md Step 5h spawn sequence — comment style mismatch**: The updated code block uses `← one line per worker, nothing else` for the Output comment, but the surrounding step prose says "nothing else" implies a complete list. The prior version said `← one line per worker, nothing else`, the new version changes the format string but keeps the same comment style — consistent with pre-existing text, so not a regression. Minor: the `#` comment for `get_pending_events()` still reads `← start monitoring` which is accurate but does not reference the budget as the spawn line comment does. Low impact.

---

## File-by-File Analysis

### `.claude/skills/auto-pilot/SKILL.md`

**Score**: 6/10
**Issues Found**: 1 blocking, 2 serious, 2 minor

**Analysis**: The Per-Phase Output Budget addition is conceptually correct and solves a real problem (supervisors outputting verbose tables). However, the structural placement is problematic. The section lands after the HARD RULES block's closing divider, which means agents that re-read only the HARD RULES block after compaction will miss it. The format table itself has a significant accuracy issue in the Completion row (the `→ IMPLEMENTED` example only covers one of two success states). The double `---` divider is a clear mechanical defect. Placeholder notation differs from the established convention in parallel-mode.md.

**Specific Concerns**:

1. Lines 37-39: Double `---` divider — the second is dead markup, creates structural ambiguity about whether the budget section is inside or outside the HARD RULES block.
2. Completion row in budget table: `COMPLETE task=<task_id> → IMPLEMENTED` does not cover the `→ COMPLETE` terminal state for Review+Fix Workers.
3. Placeholder notation `<N>` in the table vs. `{N}` everywhere else in the skill ecosystem.

### `.claude/skills/auto-pilot/references/parallel-mode.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: The three heartbeat format updates (ANTI-STALL RULE pseudocode, event-driven, polling) are internally consistent with each other and represent a meaningful improvement — the old format exposed worker-level detail (task IDs, providers) that violated the one-line-per-event rule. The Step 5h spawn block update is accurate and correctly references the Per-Phase Output Budget. The Step 8 termination table now correctly includes the `SESSION COMPLETE` one-liner. These changes accomplish the task goal cleanly. The serious issue (placeholder notation inconsistency) is imported from SKILL.md's choice of `<N>` notation — parallel-mode.md itself uses `{N}` consistently.

**Specific Concerns**:

1. The ANTI-STALL RULE pseudocode uses `[HH:MM]` notation while both event-driven and polling mode step 6 descriptions also use `[HH:MM]` — consistent internally, but the `HH:MM` precision downgrade (from `HH:MM:SS` in the old format) is undocumented. If operators are parsing heartbeat timestamps for diagnostics, they silently lose minute-level precision that was second-level before.

---

## Pattern Compliance

| Pattern                                  | Status | Concern                                                                                       |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Single source of truth for format specs  | FAIL   | Four heartbeat definitions exist; placeholder notation diverges between SKILL.md and parallel-mode.md |
| Summary sections updated with step changes | FAIL | Key Principles section not updated to reflect the new output budget rule                     |
| No redundant markup / dead code           | FAIL   | Double `---` divider in SKILL.md is dead markup                                               |
| Cross-references between related sections | PASS   | HARD RULE #9 correctly links to Per-Phase Output Budget via "See ... below"                  |
| Consistent placeholder notation           | FAIL   | `<N>` vs `{N}` across canonical definitions of the same format string                       |
| Format example accuracy                   | FAIL   | Completion row example `→ IMPLEMENTED` does not cover the Review+Fix terminal state          |

---

## Technical Debt Assessment

**Introduced**: A fourth canonical location for the heartbeat format string. Each additional location increases the cost of any future format change. The inline-duplicate pattern is flagged in review-general.md as a known drift risk (TASK_2026_043, TASK_2026_064).

**Mitigated**: The previous heartbeat format (`[HH:MM:SS] Monitoring: {N} active — {TASK_X (Build/provider)...}`) violated the one-line constraint by embedding a variable-length worker-detail segment that grew with concurrency. The new format is bounded and verifiable. This is a real improvement to supervisor reliability.

**Net Impact**: Slight increase in debt (four definitions instead of three, one inconsistent placeholder notation). The debt is manageable but should be addressed before the budget table accretes more consumers.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The blocking double-divider structurally places the Per-Phase Output Budget outside the HARD RULES block — the section the supervisor is explicitly instructed to re-read after compaction. Combined with the misleading Completion row example and the placeholder notation inconsistency, the review cannot pass as-is.

## What Excellence Would Look Like

A 10/10 implementation would:
1. Place the Per-Phase Output Budget as a numbered sub-section inside the HARD RULES block (e.g., between NEVER DO and ALWAYS DO, labeled `### Output Budget`), making it co-located with the rules it enforces.
2. Use `{N}` placeholders throughout — matching the existing convention in parallel-mode.md.
3. Split the Completion row into two clearly labeled rows for Build Worker (`→ IMPLEMENTED`) and Review+Fix Worker (`→ COMPLETE`) with explicit worker type labels.
4. Add a Key Principles entry referencing the budget rule, so supervisors that scan the principles list before compaction-recovery can locate it without a full file re-read.
5. Remove the redundant `---` divider.
6. Add a "See Per-Phase Output Budget in SKILL.md" cross-reference to each of the three heartbeat-format paragraphs in parallel-mode.md, making parallel-mode.md a consumer of the canonical definition rather than a parallel definition.
