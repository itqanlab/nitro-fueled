# Code Style Review — TASK_2026_152

## Summary

This task modified four markdown specification files (two source, two scaffold copies) to
strengthen HARD RULES and add a Pre-Flight Exit Gate to the auto-pilot supervisor skill.
The changes are behavioral spec only — no executable code was touched. The review evaluates
documentation consistency, structural coherence, internal integrity, and scaffold sync
fidelity.

The implementation introduced a significant number of improvements but created a **serious
divergence between source and scaffold copies** that undermines the stated goal of keeping
them byte-for-byte identical. Several other structural and clarity issues were also found.

---

## Review Summary

| Metric          | Value          |
|-----------------|----------------|
| Overall Score   | 5/10           |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 2              |
| Serious Issues  | 4              |
| Minor Issues    | 3              |
| Files Reviewed  | 4              |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The scaffold copies diverge substantially from the source. The scaffold `SKILL.md` is
missing the entire "Worker Mode: single vs split" section, Key Principle #14, updated
Principle #11 and #12, the Prep Worker completion row in Per-Phase Output Budget, and
the Worker-Exit Reconciliation subsection in `parallel-mode.md`. A developer running
`npx @itqanlab/nitro-fueled init` will receive the old scaffold — a supervisor that has
none of the pre-flight exit gate hardening where the split-mode state machine (PREPPED,
IMPLEMENTING) is concerned. This is a correctness gap, not merely a style gap.

### 2. What would confuse a new team member?

`parallel-mode.md` (source) contains a duplicate list numbering error: Step 7 has two
consecutive items labeled `4.` (line 224 and 225 in the source file). A supervisor agent
parsing the spec mechanically will see two items both numbered `4` and may execute the
second one in the wrong order, miss it, or be confused about whether item `5` in the
original scaffold corresponds to item `5` or `6` in the source. There is also an orphaned
blockquote warning about `get_tasks(status: "COMPLETE")` embedded mid-step after the
Worker-Exit Reconciliation subsection closes — it appears at source line 285, sandwiched
between numbered list items 5 through 11 of a different section. The blockquote belongs
inside the reconciliation subsection but instead interrupts the numbered list of the
subsequent section, making the flow incoherent.

### 3. What's the hidden complexity cost?

The source `SKILL.md` now carries two conceptual models simultaneously: the original
two-worker model (Build → Review) referenced throughout much of the file and the new
three-worker model (Prep → Implement → Review) in the updated sections. The scaffold
copy still describes only the two-worker model. This dual-model state increases the
surface area for confusion because references to "Build Worker for CREATED" (correct
for single mode) appear alongside references to "Prep Worker for CREATED" (correct for
split mode) without consistent framing. A reader skimming Key Principles in the scaffold
sees Principle #11 say "Build Worker for CREATED" while the source says "Determine Worker
Mode (single/split)". These are not interchangeable.

### 4. What pattern inconsistencies exist?

The source `parallel-mode.md` consistently uses `get_tasks(compact: true)` while the
scaffold copy inconsistently uses the bare `get_tasks()` form — except in Step 2 where
the scaffold uses a verbose explicit-status-list form
`get_tasks(status=['CREATED', 'IMPLEMENTED', ...], limit=50)` that appears nowhere in
the source. The source uses `get_tasks(compact: true, limit=50)`. These are three
different call forms for the same operation across the two files. An agent reading the
scaffold will see an inconsistent API surface and may combine arguments incorrectly.

The handoff claims the scaffold sync was done manually via `cp`. The diff proves this
is incorrect — the two files have substantial non-trivial differences beyond formatting.
The scaffold is not a copy of the source; it is an older version of the source with the
new additions partially omitted.

### 5. What would I do differently?

Run `diff` between source and scaffold before marking the task IMPLEMENTED. The handoff
states "synced from source" and "byte-for-byte identical" — neither is true. The correct
fix is to copy the source files verbatim to the scaffold paths and confirm with `diff`
that the output is empty. The only acceptable scaffold deviation is template placeholders
that do not apply to the generic scaffold case, and none exist here.

---

## Blocking Issues

### Issue 1: Scaffold SKILL.md is not a sync of the source — it is an older version

- **Files**: `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` vs
  `.claude/skills/auto-pilot/SKILL.md`
- **Problem**: The scaffold is missing: (a) the entire "Worker Mode: single vs split"
  section (11 lines), (b) the Prep Worker completion row in Per-Phase Output Budget,
  (c) the updated Primary Responsibilities list (split-mode states, Worker-Exit Reconciliation
  in item 5), (d) updated Data Access Rules rows (`compact: true`, banned `get_tasks(status:
  "COMPLETE")`), (e) updated Key Principles #11 and #12 (split-mode routing), and (f) Key
  Principle #14 (Supervisor authoritative for task state on worker exit). These omissions
  mean a project initialized from scaffold gets the pre-fix version of the supervisor spec
  for every new project.
- **Impact**: Any team running `npx @itqanlab/nitro-fueled init` on a new project will
  receive a supervisor that does not know about split mode or the pre-flight exit gate's
  interaction with the PREPPED → IMPLEMENTING flow. The whole point of this bugfix is
  undone for new installs.
- **Fix**: Copy source to scaffold verbatim:
  `cp .claude/skills/auto-pilot/SKILL.md apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`
  Then run `diff` and confirm empty output before marking complete.

### Issue 2: Scaffold parallel-mode.md diverges from source in Step 2 and Step 7

- **Files**: `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` vs
  `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Problem**: Step 2 in the scaffold uses
  `get_tasks(status=['CREATED', 'IMPLEMENTED', ...], limit=50)` — a verbose form that does
  not appear anywhere in the source. The source uses `get_tasks(compact: true, limit=50)`.
  Step 7 in the scaffold omits the Prep Worker completion path entirely and omits the entire
  Worker-Exit Reconciliation subsection with its trigger conditions, expected-state mapping
  table, reconciliation steps, and RECONCILE_DISCREPANCY event schema. Step 3 in the scaffold
  is missing the split-mode task classifications (READY_FOR_PREP, PREPPING,
  READY_FOR_IMPLEMENT, IMPLEMENTING) and the Worker Mode resolution block. Step 4 is missing
  the `implement_candidates` set. Step 5 is missing the worker-type resolution and
  provider/model routing tables.
- **Impact**: A supervisor running from the scaffold reference will not know how to handle
  PREPPED tasks, Implement Workers, or silent worker exits. It will also call `get_tasks()`
  with the wrong argument form, which may produce different results depending on the MCP
  server's argument handling.
- **Fix**: Same as Issue 1 — copy source verbatim and verify with `diff`.

---

## Serious Issues

### Issue 3: Duplicate list item number `4` in source parallel-mode.md Step 7

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`, lines 224-225
- **Problem**: Two consecutive numbered items are both labeled `4.` in Step 7's preferred
  path list. The correct sequence should be 1, 2, 3, 4 then the orphaned second `4.`
  should be `5.` (and the subsequent items renumbered). This is a structural error
  introduced in this task's changes.
- **Tradeoff**: Agents and humans executing numbered steps mechanically will find two
  items both claiming to be item 4. One will be skipped, or the reader will be confused
  about sequence. In an autonomous supervisor this could cause a step to be silently omitted.
- **Recommendation**: Renumber. The second item labeled `4.` should become `5.` and
  the subsequent step list must be renumbered through item 11 accordingly (currently they
  are labeled 5 through 11, which becomes 6 through 12 after the fix). Or, if the second
  `4.` is actually a sub-note on the first `4.`, promote it to a nested bullet under
  the first `4.` entry to make the relationship explicit.

### Issue 4: Orphaned blockquote interrupts a numbered list in source parallel-mode.md

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`, line 285
- **Problem**: A blockquote warning (`> **NEVER call get_tasks(status: "COMPLETE")**...`)
  appears immediately after the closing JSON code block of the Worker-Exit Reconciliation
  subsection, before the numbered list items `5.` through `11.` that belong to the
  surrounding Step 7. The blockquote was likely intended to close the Reconciliation
  subsection, but its position after a code block and before a continuing numbered list
  makes it structurally ambiguous. It is unclear whether items 5-11 are siblings to items
  1-4 of Step 7's preferred path or belong to the reconciliation subsection.
- **Tradeoff**: Readers — and agents — cannot easily determine the scope of the constraint.
  The blockquote applies to the entire loop, but its placement suggests it applies only
  inside reconciliation.
- **Recommendation**: Move the blockquote to the end of the Step 7 numbered list (after
  item 11), or promote it to a named warning callout at the top of Step 7 before the
  numbered list begins.

### Issue 5: "Summary sections must be updated when the steps they describe change" — violation

- **File**: `.claude/skills/auto-pilot/SKILL.md`, Primary Responsibilities section
- **Problem**: Item 5 in Primary Responsibilities was updated in the source to include
  worker-exit reconciliation ("reconcile task state for any worker that exits without
  emitting a state-change event"). Item 7 in Core Loop steps summary (line 278 in source)
  was also updated. However, the ALWAYS DO section's item 5 ("Spawn → sleep atomic
  sequence") references the spawn-then-sleep sequence but was not updated to cross-reference
  the new exit-gate language in parallel-mode.md. The HARD RULE #8 and the Pre-Flight Exit
  Gate are conceptually related but neither references the other by section name.
- **Tradeoff**: Agents that read HARD RULES sequentially may follow Rule #8 (never end
  turn after spawning) but still stall at pre-flight because the pre-flight exit gate is
  only in parallel-mode.md which is loaded on demand — after pre-flight passes. This means
  the exit gate is loaded too late to constrain pre-flight behavior.
- **Recommendation**: Add a forward reference in HARD RULE #8 or in the Pre-flight
  startup sequence (the 3-step check description) pointing to
  `references/parallel-mode.md ## Pre-Flight Exit Gate` so the constraint is reachable
  before the file is demand-loaded.

### Issue 6: "NEVER batch-load" rule — timing makes it unenforceable as written

- **File**: `.claude/skills/auto-pilot/SKILL.md`, Load-on-Demand Protocol section
- **Problem**: Rule 3 in the Trigger → Reference mapping says: "Entering Core Loop (after
  all pre-flight passes): load `references/parallel-mode.md`". The Pre-Flight Exit Gate is
  the first section of `parallel-mode.md`. This means the exit gate is only readable AFTER
  pre-flight completes — at precisely the moment the supervisor should already be acting on
  it. A supervisor that violates the exit gate during pre-flight (the bug this task fixes)
  will never have loaded `parallel-mode.md` at the time of violation. The exit gate must
  either be inlined into SKILL.md (at least a summary) or the trigger mapping must be
  updated to say "before entering pre-flight" rather than "after pre-flight passes".
- **Tradeoff**: The exit gate exists in the right place for normal loop operation but
  arrives too late to prevent the pre-flight stall pattern it was created to address.
  The fix addresses the symptom described in the task but may not actually prevent
  recurrence for a fresh supervisor that has not yet loaded parallel-mode.md.
- **Recommendation**: Add a brief Pre-Flight Exit Gate rule directly in SKILL.md under
  HARD RULES (as Rule #10 or inline after Rule #8) so it is readable before
  `parallel-mode.md` is loaded. The full detail can remain in `parallel-mode.md`.

---

## Minor Issues

1. **Double blank line at SKILL.md line 206-207** (source and scaffold both) — two consecutive
   blank lines between the Trigger → Reference mapping list and the paragraph starting "All
   mode-specific details...". One blank line is consistent with the rest of the document.
   This was present before this task but was not cleaned up.

2. **"Worker Mode: single vs split" table column alignment** in source SKILL.md — the table
   header `| Complexity | Default Worker Mode |` has a narrower left column than the data
   rows. The Markdown renders correctly in most viewers, but it is inconsistent with the
   alignment style of all other tables in this file which use padded columns for readability.

3. **Step 5 duplicate numbering in source parallel-mode.md** — items `8.` appears twice
   in the preferred path for Step 5 (the source shows two `8.` lines: "On success, persist
   active-worker state..." and "If `subscribe_worker()` is available..."). This was not
   introduced by this task but exists in both source and scaffold. It is an existing error
   that the diff confirms was present and unmodified. It is worth fixing in a follow-on.

---

## File-by-File Analysis

### `.claude/skills/auto-pilot/SKILL.md` (source)

**Score**: 6/10
**Issues Found**: 1 blocking (via scaffold divergence), 2 serious, 1 minor

**Analysis**: The new content itself (Banned Bash patterns, Banned provider labels, Banned
tangent patterns, Load-on-demand batch-load rule, pre-flight data access row) is clearly
written, concrete, and mechanically enforceable — this is the right format for behavioral
spec. The explicit "Banned X patterns" sub-lists are notably better than the previous prose
descriptions. The Worker Mode section is well-structured. The problem is not the added
content but the enforcement timing gap (Issue 6) and the scaffold divergence.

**Specific Concerns**:
1. The pre-flight exit gate is only reachable after parallel-mode.md is loaded — which
   happens after pre-flight passes. The gate therefore cannot constrain pre-flight behavior
   in a fresh session. (Serious — Issue 6)
2. Key Principle #14 ("Supervisor is authoritative for task state on worker exit") was
   added without updating the ALWAYS DO summary section to reflect the reconciliation
   pattern. (Serious — Issue 5)

### `.claude/skills/auto-pilot/references/parallel-mode.md` (source)

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: The Pre-Flight Exit Gate section is well-placed at the very top of the file,
is clearly written, and covers the right prohibition surface. The Worker-Exit Reconciliation
subsection is thorough and the RECONCILE_DISCREPANCY JSON schema is a useful addition. The
core content is correct and addresses the stated violations from SESSION_2026-03-30_03-40-31.

**Specific Concerns**:
1. Duplicate list item number `4` in Step 7 preferred path introduces structural ambiguity
   in a spec that is executed mechanically. (Serious — Issue 3)
2. Orphaned blockquote after the reconciliation JSON schema interrupts the surrounding
   numbered list's flow and obscures scope. (Serious — Issue 4)

### `apps/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` (scaffold)

**Score**: 3/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

**Analysis**: Described in the handoff as "synced from source" and "byte-for-byte identical".
The diff proves this is incorrect. The scaffold is missing substantial content introduced in
this task: the Worker Mode section, the updated Per-Phase Output Budget row for Prep Workers,
the updated Primary Responsibilities list, the updated Data Access Rules rows, and the updated
Key Principles. Any project initialized from this scaffold will receive a broken supervisor spec
that does not know about split mode or the full reconciliation behavior.

### `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` (scaffold)

**Score**: 3/10
**Issues Found**: 1 blocking, 0 serious, 0 minor

**Analysis**: Also described as "synced from source" but is actually an older version. The
scaffold is missing the Worker-Exit Reconciliation subsection, the Duplicate Spawn Guard,
the RECONCILE_DISCREPANCY schema, the split-mode task classifications in Step 3, the
implement_candidates set in Step 4, and the worker-type resolution and provider/model routing
in Step 5. Step 2 uses a verbose explicit-status form that does not appear in the source.
The Pre-Flight Exit Gate section IS correctly present and matches source — this is the one
area that was synced correctly.

---

## Pattern Compliance

| Pattern                                 | Status | Concern                                                               |
|-----------------------------------------|--------|-----------------------------------------------------------------------|
| Source and scaffold byte-for-byte equal | FAIL   | Substantial divergence in both files across major sections            |
| Single source of truth per rule         | FAIL   | Duplicate numbering and scope ambiguity introduce competing readings  |
| Summary sections reflect step changes   | FAIL   | ALWAYS DO section not updated; HARD RULES do not reference exit gate  |
| Concrete, mechanically verifiable rules | PASS   | New banned-pattern lists are specific and enumerable                  |
| Consistent MCP call forms               | FAIL   | Three different `get_tasks()` call forms across source and scaffold   |

---

## Technical Debt Assessment

**Introduced**:
- Dual-model (two-worker vs three-worker) narrative split across source and scaffold that
  will require a reconciliation task to close.
- Numbering errors in Step 5 and Step 7 of parallel-mode.md that will produce confusion
  in future edits (contributors may perpetuate the pattern or introduce further conflicts).
- Enforcement timing gap for the Pre-Flight Exit Gate: the spec is in a demand-loaded file
  that is loaded after the phase it is meant to gate.

**Mitigated**:
- Explicit banned-pattern lists significantly reduce the ambiguity that allowed the observed
  violations to occur. This is a genuine improvement.
- Pre-Flight Exit Gate section is well-positioned within parallel-mode.md for the normal
  (post-pre-flight) operational path.

**Net Impact**: Negative on scaffold sync integrity; positive on rule specificity.

---

## Verdict

| Verdict | Value         |
|---------|---------------|
| Overall | FAIL          |

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The scaffold copies are not synced with the source. The handoff claims
"byte-for-byte identical" — the diff proves otherwise. A blocking correctness gap exists
for every new project initialized from this scaffold. The two blocking issues (scaffold
SKILL.md and scaffold parallel-mode.md divergence) must be resolved before this task
can be marked COMPLETE.

The numbered-list errors (Issues 3 and 4) and the enforcement timing gap (Issue 6) are
worth fixing in the same pass since all changes are in the same files already being modified.

## What Excellence Would Look Like

A 9/10 implementation of this task would:
1. Copy source to scaffold verbatim and verify with `diff` showing empty output — not
   `cp` and hope.
2. Add a condensed Pre-Flight Exit Gate rule directly in HARD RULES (SKILL.md) so it is
   readable before `parallel-mode.md` is demand-loaded — placing the gate only in the
   on-demand file means it arrives too late to gate the behavior it describes.
3. Fix the Step 7 duplicate numbering and orphaned blockquote in the same changeset —
   these are structural errors in the files being modified.
4. Update the ALWAYS DO section and Key Principles consistently when new reconciliation
   behavior is added to Primary Responsibilities and Core Loop steps.
5. Include a `diff` command in the handoff proving scaffold sync, not a prose assertion.
