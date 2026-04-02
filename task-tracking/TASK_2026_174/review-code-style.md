# Document / Content Style Review — TASK_2026_174

## Review Summary

| Metric          | Value                                         |
| --------------- | --------------------------------------------- |
| Overall Score   | 7/10                                          |
| Verdict         | PASS                                          |
| Blocking Issues | 0                                             |
| Serious Issues  | 3                                             |
| Minor Issues    | 6                                             |
| Files Reviewed  | 7                                             |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `investigation.md` failure counts table uses inconsistent column alignment and
a merged-cell workaround in plain Markdown (the `| 2 direct fallbacks |` cell in
row 2 is carrying two distinct values — count and qualifier — that a reader or
downstream tool will parse as a single field). If this table is ever imported into
a report generator, the column mismatch will corrupt the output.
(`investigation.md`, line 101–108)

### 2. What would confuse a new team member?

`tasks.md` uses `**Developer**: nitro-systems-developer` as a batch-level label
but the format used in no other task file in the repo. A reader unfamiliar with this
specific research task will not know if `nitro-systems-developer` is a role, a
literal agent name, or a placeholder left from scaffolding.
(`tasks.md`, lines 5 and 19)

### 3. What's the hidden complexity cost?

`plan.md` defines success criteria inline with the approach steps
(the `## Success Criteria` section is 2 lines that contain a raw number:
`9 total fallbacks, 8 GLM-5-related, 1 outlier`). That number is not labeled
as a hypothesis or a pre-read of the retro — it reads as a fact stated before
the investigation ran. A reader will not know whether this number was known
up-front or discovered during analysis.
(`plan.md`, line 18)

### 4. What pattern inconsistencies exist?

Three files use sentence-case headings consistently
(`task-description.md`, `plan.md`, `handoff.md`). Two files use
title-case headings inconsistently within themselves
(`investigation.md` mixes `## Executive Summary` with
`## Answers to Research Questions` vs. `### 1. What are the specific failure modes?`).
`tasks.md` uses bold labels instead of headings for sub-task names, diverging from
both conventions.

The "Recommended Order" section in `follow-on-tasks.md` is an ordered list
inside a single-level document that otherwise uses only tables — the switch in
structure is abrupt and unexplained.

### 5. What would I do differently?

- Fix the `investigation.md` failure counts table to give the "stuck x2" row a
  proper numeric count (`2`) and move the qualifier text into a separate Notes
  column or into the prose below the table.
- Add a document-level metadata block (date, author agent, task ID) to
  `investigation.md` so it is self-contained when read outside the task folder.
- Replace the `**Developer**: nitro-systems-developer` pattern in `tasks.md` with
  whatever heading convention the rest of the task-tracking system uses.

---

## Blocking Issues

None.

---

## Serious Issues

### Issue 1: Failure counts table has a structurally broken column

- **File**: `investigation.md`, lines 101–108
- **Problem**: Row 2 of the table reads
  `| Stuck x2 health-check kill | 2 direct fallbacks | 091, 113 |`.
  The second column is `Count`, but this cell contains the string
  `2 direct fallbacks` — a mixed numeric-plus-qualifier value. The next row
  then adds `| Additional same-family kill evidence | 3 | 088, 092, 117 |`,
  which uses a plain number in the same column. The column is semantically
  inconsistent between its own rows.
- **Tradeoff**: The prose below the table recovers the reader, so comprehension is
  not broken. But the table itself fails as a standalone reference and will
  mislead anyone who reads just the table.
- **Recommendation**: Standardise the Count column to integers only. Move the
  qualifier `direct fallbacks` into the prose or add a fourth `Notes` column.

### Issue 2: `plan.md` states the reconciliation number as prior knowledge

- **File**: `plan.md`, line 18
- **Problem**: Success criterion 2 reads
  "Failure counts reconcile with the retrospective summary: 9 total fallbacks, 8
  GLM-5-related, 1 outlier." This sounds like a factual constraint on the analysis
  rather than a testable hypothesis. If the evidence had yielded a different count,
  the plan would have directed the investigator to make the numbers match rather
  than report what was found.
- **Tradeoff**: The retrospective was already read before the plan was written, so
  the number was likely known. The issue is that the plan is filed as a forward-
  looking document, not a retrospective one. The framing creates an appearance of
  confirmation bias.
- **Recommendation**: Rephrase as "Verify whether failure counts align with the
  retrospective summary (which reports 9 total fallbacks)" to make the
  investigative intent clear.

### Issue 3: `tasks.md` uses a non-standard developer-labeling pattern

- **File**: `tasks.md`, lines 5 and 19
- **Problem**: `**Developer**: nitro-systems-developer` appears twice as a
  batch-level attribute. No other task file in the reviewed set uses this pattern.
  The tasks.md format for research tasks is not documented anywhere in the folder,
  so this label introduces a format that cannot be validated or extended consistently.
- **Tradeoff**: The label conveys useful provenance information. The problem is not
  the information but the ad-hoc formatting.
- **Recommendation**: Either move agent provenance to `session-analytics.md` (which
  already tracks task metadata) or adopt a consistent label format that matches the
  `handoff.md` structure.

---

## Minor Issues

1. **`investigation.md` line 109**: The reconciliation sentence embeds a quoted
   number in backtick code style (`\`9\``, `\`8\``, `\`1\``). The backtick
   style works, but it is inconsistent with the rest of the document, which uses
   plain prose for numeric references.

2. **`investigation.md` headings**: The document switches between `### N. Question
   text?` format (for research questions) and `### N. Label: event type` format
   (for failure taxonomy entries). Picking one format throughout would reduce
   cognitive switching.

3. **`follow-on-tasks.md`**: The table column `Rationale` contains multi-sentence
   values but the other columns (`Title`, `Type`, `Priority`) are single tokens.
   Long rationale text inside a Markdown table cell wraps unpredictably in most
   renderers. Moving rationale to a sub-list under each table row or to a separate
   prose section would be more readable.

4. **`session-analytics.md`**: The `Phases Completed | PM, Architect, Dev` row is
   factually correct but missing `Review` — this is a research task so no Review
   phase ran, but that absence is not noted. A reader will wonder whether the phase
   was skipped or simply not reached.

5. **`task-description.md` vs. `plan.md`**: Both files open with a `## Objective`
   / `## Approach` split but are stored as separate documents that partially
   overlap in scope. The objective in `task-description.md` line 3–5 and the
   success criteria in `plan.md` lines 17–19 reference the same evidence numbers.
   There is no harm in having both files, but a reader navigating the folder will
   open both before understanding they serve different roles.

6. **`handoff.md` line 21**: "Four early `glm failed` fallbacks do not have
   corresponding worker logs, so their root cause is inferred as spawn-time zero
   activity rather than proven from per-worker telemetry." This is a correct and
   honest caveat. However, the word "proven" sets a higher bar than the
   investigation's own standard, which uses "strongly suggests" in the body of
   `investigation.md`. The two phrasings should be aligned.

---

## File-by-File Analysis

### task-description.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Well-structured. Objective, Scope, Evidence Sources, and Deliverables
map cleanly to a research brief format. Formatting is consistent throughout.

**Specific Concerns**:
1. (Minor) Slight overlap with `plan.md` success criteria. No fix needed, but
   consider a one-line cross-reference: "See `plan.md` for acceptance criteria."

---

### plan.md

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: Structurally sound and concise. The six-step approach is clear.
The success criteria section is where the serious issue lives (see Serious Issue 2).

**Specific Concerns**:
1. (Serious) Line 18: reconciliation number stated as a constraint rather than a
   hypothesis. See Serious Issue 2.

---

### tasks.md

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: Task breakdown is clear and the statuses are correctly marked. The
file is functional. The formatting inconsistency in the developer label is the main
concern.

**Specific Concerns**:
1. (Serious) `**Developer**: nitro-systems-developer` is a non-standard pattern.
   See Serious Issue 3.

---

### investigation.md

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 2 minor

**Analysis**: This is the strongest document in the set. The evidence base is cited
specifically, the taxonomy is coherent, and the research question answers are direct
and honest about the limits of the evidence. The table structure issue and the
heading inconsistency are the main weaknesses.

**Specific Concerns**:
1. (Serious) Lines 101–108: Failure counts table has a broken Count column in row 2.
   See Serious Issue 1.
2. (Minor) Backtick-style number references on line 109 are inconsistent with prose
   style elsewhere.
3. (Minor) Heading format switches between `### N. Question?` and `### N. Label`
   across sections.

---

### follow-on-tasks.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Concise and actionable. The table covers the four proposed tasks, and
the recommended order section is useful. The only weakness is long Markdown table
cells for rationale text.

**Specific Concerns**:
1. (Minor) Rationale column contains multi-sentence content that wraps poorly in
   standard Markdown renderers.

---

### session-analytics.md

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Correct metadata. Duration and outcome are consistent with the
handoff. The missing `Review` phase note is a small gap.

**Specific Concerns**:
1. (Minor) No indication that the `Review` phase was intentionally skipped.

---

### handoff.md

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Well-written. The Decisions section clearly articulates the routing-
policy rationale. The Known Risks section is honest and specific, which is the most
important quality in a handoff document.

**Specific Concerns**:
1. (Minor) Line 21: "proven" sets a higher evidentiary bar than the phrasing used
   in the investigation body. Should align with "strongly suggests" or equivalent.

---

## Pattern Compliance

| Pattern                       | Status | Concern                                             |
| ----------------------------- | ------ | --------------------------------------------------- |
| Consistent heading levels     | PARTIAL| `investigation.md` mixes heading format styles      |
| Table column consistency      | FAIL   | Failure counts table has a mixed-type Count column  |
| Terminology consistency       | PASS   | "fallback", "stuck", "health check" used uniformly  |
| Evidence citation style       | PASS   | Session paths and log entries cited specifically     |
| Markdown syntax validity      | PASS   | No broken links, no malformed list syntax found     |
| Document-level metadata       | PARTIAL| `investigation.md` has no standalone date/task header |
| Internal cross-referencing    | PASS   | `follow-on-tasks.md` referenced from investigation  |

---

## Technical Debt Assessment

**Introduced**: The `**Developer**: nitro-systems-developer` label in `tasks.md` is
an undocumented format that could propagate to future research tasks if not
corrected.

**Mitigated**: The investigation clearly documents its evidence limitations in
`handoff.md`, which reduces the risk of follow-on tasks being designed on false
assumptions.

**Net Impact**: Slightly positive. The content is substantively sound; the debt is
formatting and framing, not analytical.

---

## Verdict

**Recommendation**: PASS — proceed to implementation of follow-on tasks.
**Confidence**: HIGH
**Key Concern**: The failure counts table in `investigation.md` has a broken
column that could mislead readers who rely on the table without reading the prose.
Fix the Count column before this document is used as a reference in follow-on task
planning.

## What Excellence Would Look Like

A 10/10 version of this investigation set would include:

- A document-level header in `investigation.md` (date, task ID, author agent) so
  it is fully self-contained when read outside the folder.
- A failure counts table with uniform column types (integer Count, text Notes),
  separating the qualifier from the number.
- A one-line note in `session-analytics.md` confirming the Review phase was
  intentionally not run (research task, no code to review).
- A consistent heading format throughout `investigation.md` — either all numbered
  question-style or all label-style, not both.
- `plan.md` success criterion phrased as a testable hypothesis rather than a
  pre-stated answer.
