# Code Style Review — TASK_2026_037

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | code-style-reviewer |
| Overall Score | 6/10 |
| Verdict | PASS WITH NOTES |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The review file naming inconsistency (see Blocking Issue 1) is the highest-risk item. The "Both done" evaluation in `auto-pilot/SKILL.md` line 652 checks for `review-code-style.md`, `review-code-logic.md`, `review-security.md`. The worker-log extraction at lines 708-710 checks for `code-style-review.md`, `code-logic-review.md`, `code-security-review.md`. These are different names. Whichever convention is actually used at runtime, one of these two blocks will silently find nothing and proceed as if the data does not exist. This ambiguity will produce phantom "clean" evaluations or missing analytics data — both failure modes are silent.

### 2. What would confuse a new team member?

The `orchestration/SKILL.md` Completion Phase section (lines 316-326) and the "Update Registry" section (lines 374-376) both say "the Review Worker sets the status to COMPLETE." That language is stale. After this refactoring, the Review Worker is the Review Lead, which explicitly does NOT set COMPLETE — the Fix Worker or Completion Worker does. A developer reading those notes will build a mental model that conflicts with the actual flow described by the new prompt templates. The contradiction is not subtle; two adjacent blocks in the same file contradict each other.

### 3. What's the hidden complexity cost?

The Completion Worker prompt (auto-pilot line 1314) instructs the worker to follow the Completion Phase in `orchestration/SKILL.md`. That file's Completion Phase section begins with a note saying the Fix Worker or Completion Worker runs this phase — correct. But the "Update Registry" sub-section (line 376) still attributes ownership to the "Review Worker." A Completion Worker following these instructions inline will encounter this stale note and may interpret it ambiguously. The complexity cost is that two documents must now stay synchronized on which worker sets COMPLETE, and they already diverged on the first revision.

### 4. What pattern inconsistencies exist?

Three inconsistencies found:

**a) Review file naming** (Blocking): `auto-pilot/SKILL.md` uses two different naming conventions for the same set of files in different sections (see Blocking Issue 1).

**b) `expected_end_state` for ReviewLead** (Serious): The Active Workers table example at line 1403 shows `expected_end_state = COMPLETE` for a ReviewLead worker. But the code comment at line 531 defines `expected_end_state="REVIEW_DONE"` for ReviewLead, and line 606 confirms "ReviewLead expected transitions: none — stays at IN_REVIEW." The state table example contradicts the specification text and will confuse anyone populating or reading state.md.

**c) "Review Worker" as a generic term** (Serious): `orchestration/SKILL.md` uses "Review Worker" throughout (lines 124, 257, 317, 376, 436) as a generic term that could mean either the old combined reviewer role or the new Review Lead specifically. The auto-pilot file uses more precise names (ReviewLead, TestLead, FixWorker, CompletionWorker). The mixed vocabulary creates ambiguity about which worker type is being described in the orchestration file's scope notes and exit gate.

### 5. What would I do differently?

- Standardize review file names across all references in a single pass and add a glossary table at the top of auto-pilot/SKILL.md listing canonical file names.
- Replace every occurrence of "Review Worker" in `orchestration/SKILL.md` with "Review Lead" where that is the specific worker type meant, and use "review-phase worker" when speaking generically.
- Fix the `expected_end_state` example in the state.md template to match the spec (REVIEW_DONE, not COMPLETE, for ReviewLead).
- The Retry Fix Worker prompt (lines 1283-1301) has no step numbering beyond a bare list. The First-Run Fix Worker prompt has 7 numbered steps; the retry variant drops to an unnumbered list of 4 items. The inconsistent structure makes it harder to reference a specific step when debugging.

---

## Findings

### Blocking

**Issue 1: Review file naming inconsistency within `auto-pilot/SKILL.md`**

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Lines**: 652-653 vs 708-710 vs 1243-1245
- **Problem**: Three sections reference the review output files using two different naming conventions:
  - Lines 652-653 ("Both done" evaluation): `review-code-style.md`, `review-code-logic.md`, `review-security.md`
  - Lines 1243-1245 (Fix Worker prompt): `review-code-style.md`, `review-code-logic.md`, `review-security.md`
  - Lines 708-710 (worker-log extraction, step 7 of 7h): `code-style-review.md`, `code-logic-review.md`, `code-security-review.md`

  Additionally, the Review Lead prompt continuation check at lines 1074-1076 uses `review-code-style.md`, `review-code-logic.md` — consistent with lines 652-653 — but the Retry Review Lead prompt at lines 1132-1134 matches those same names. So the inconsistency is isolated to the worker-log extraction block at lines 708-710.

- **Impact**: The worker-log extraction block (Step 7h, sub-step 5) will find no files at runtime if the actual files are named `review-code-style.md` (the more common convention in this file). Review scores and verdicts in `analytics.md` and `orchestrator-history.md` will silently show `—` and `unknown` even when reviews completed successfully. Analytics quality metrics become meaningless.
- **Fix**: Align lines 708-710 to use `review-code-style.md`, `review-code-logic.md`, `review-security.md` to match every other reference in this file.

---

### Serious

**Issue 2: `expected_end_state` example for ReviewLead contradicts specification**

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Lines**: 1403 (state.md example table) vs 531 (spec comment) vs 606 (transition table)
- **Problem**: The sample `state.md` Active Workers table at line 1403 shows a ReviewLead row with `Expected End State = COMPLETE`. The specification text at line 531 explicitly states `expected_end_state="REVIEW_DONE"` for ReviewLead, and the transition table at line 606 confirms ReviewLead does not produce a registry state change. The example table is the most visible artifact a developer will copy when building tooling or debugging state — it teaches the wrong value.
- **Recommendation**: Change the ReviewLead row in the example table to show `Expected End State = REVIEW_DONE` to match the spec.

**Issue 3: Stale "Review Worker" language in `orchestration/SKILL.md` scope notes**

- **File**: `.claude/skills/orchestration/SKILL.md`
- **Lines**: 124, 257, 317, 376, 436 heading
- **Problem**: These sections use "Review Worker" as though it is still the single combined reviewer that performs fixes and runs the Completion Phase. After this refactoring, "Review Worker" in the Supervisor context refers specifically to the Review Lead — which exits at IN_REVIEW without applying fixes or setting COMPLETE. Lines 376 and the "Update Registry" subsection note say "In Supervisor mode, the Review Worker sets the status to COMPLETE" — this is now factually wrong for the Review Lead. Only Fix Worker or Completion Worker sets COMPLETE.
- **Recommendation**: Replace "Review Worker" with "Review Lead" where describing the new dedicated reviewer role, and update the "Update Registry" note to say "the Fix Worker or Completion Worker sets the status to COMPLETE" (matching the Review Lead Note already present at lines 321-326).

**Issue 4: `orchestration/SKILL.md` phase detection table has an ambiguous row**

- **File**: `.claude/skills/orchestration/SKILL.md`
- **Line**: 140
- **Problem**: The row `review-context.md + review files (no COMPLETE) | Review/Test phase done — Supervisor spawns Fix or Completion Worker` uses `(no COMPLETE)` as a qualifier. This is ambiguous — it is unclear whether "no COMPLETE" refers to registry status, review file verdict values, or something else. A worker resuming from this state needs to know whether to check the registry or the review file contents.
- **Recommendation**: Clarify to: `review-context.md + review files (registry still IN_REVIEW)` or reword the qualifier to unambiguously refer to registry state.

**Issue 5: Retry Fix Worker prompt lacks step numbers**

- **File**: `.claude/skills/auto-pilot/SKILL.md`
- **Lines**: 1291-1298
- **Problem**: The First-Run Fix Worker prompt has 7 clearly numbered steps including an explicit EXIT GATE check. The Retry Fix Worker prompt drops numbering entirely and has only 4 bare items with no EXIT GATE section. The asymmetry creates a risk that a retrying Fix Worker skips the exit gate check, since it is not listed. All retry prompts for other worker types (Build Worker retry at line 1037, Review Lead retry at lines 1144-1145) explicitly include exit gate references.
- **Recommendation**: Add explicit step numbers and a minimal EXIT GATE checklist to the Retry Fix Worker prompt, consistent with First-Run Fix Worker and all other retry prompts.

---

### Minor

**Issue 6: Strategy Quick Reference table omits Completion Worker from flow descriptions**

- **File**: `.claude/skills/orchestration/SKILL.md`, line 27-29
- **Problem**: The strategy flow column for FEATURE, BUGFIX, REFACTORING shows `-> [Fix Worker]` at the end but does not show `-> [Completion Worker]` as the alternative clean-path outcome. The brackets indicate optionality, but the table implies Fix Worker is the only post-review worker type.
- **Recommendation**: Update to `-> [Fix Worker | Completion Worker]` or add a footnote.

**Issue 7: Worker log event format inconsistency for Fix/Completion workers**

- **File**: `.claude/skills/auto-pilot/SKILL.md`, line 765
- **Problem**: Step 7h sub-step 7 instructs logging with `({Build|Review|Cleanup})` as the worker type token. There is no slot for `Fix` or `Completion` worker types in that log format, even though those are new worker types from this task. The log entry for a Fix Worker or Completion Worker would either write an incorrect label or fall through to an undefined case.
- **Recommendation**: Update the log format string to `({Build|Review|Fix|Completion|Cleanup})`.

**Issue 8: `orchestration/SKILL.md` session logging phase table missing Fix/Completion phase entries**

- **File**: `.claude/skills/orchestration/SKILL.md`, lines 244-252
- **Problem**: The Phase Transition Log Entries table lists `QA started`, `QA complete`, and `Completion phase done` as the post-dev log entries. There is no entry for "Fix phase started" or "Fix phase complete" even though Fix Workers run phases inside the orchestration skill context. A Fix Worker session would produce no phase log entries except the final Completion phase done.
- **Recommendation**: Add log row definitions for fix phase events, or add a note that Fix/Completion Workers only log the Completion phase entry (making the omission intentional and explicit).

**Issue 9: `orchestration/SKILL.md` Review Worker Exit Gate section title mismatch**

- **File**: `.claude/skills/orchestration/SKILL.md`, line 436
- **Problem**: The exit gate heading is `### Review Worker Exit Gate` but the section's content (line 445) already uses the new language: "Review Lead does NOT set COMPLETE." The heading still uses the old generic term while the content reflects the new model. Minor but adds to the vocabulary drift noted in Issue 3.
- **Recommendation**: Rename to `### Review Lead Exit Gate` for consistency with the new model.
