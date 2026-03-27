# Code Style Review — TASK_2026_032

**Reviewer**: Code Style Reviewer
**Date**: 2026-03-27
**File reviewed**: `.claude/skills/auto-pilot/SKILL.md`
**Scope**: Four additions — (1) session directory files table, (2) three new Session Log events, (3) Step 7h (Write Worker Log File), (4) Step 8c (Generate Session Analytics)

---

## Review Summary

| Metric          | Value                |
|-----------------|----------------------|
| Overall Score   | 5/10                 |
| Assessment      | NEEDS_REVISION       |
| Blocking Issues | 2                    |
| Serious Issues  | 3                    |
| Minor Issues    | 4                    |
| Files Reviewed  | 1                    |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

Step 7h sub-step 5 searches for a line matching `**Verdict**:` to extract review verdicts (line 607). The current review file convention uses `## Verdict` as a section heading followed by `**Recommendation**: VALUE` on the next line. Only one old file (`TASK_2026_012/code-style-review.md`) uses the inline `**Verdict**: VALUE` pattern. Every review file written by the current reviewer agents will produce a `## Verdict` section, not a `**Verdict**:` line. In six months this search will silently find nothing and every Review Worker log will have a verdicts table filled with `{verdict}` placeholders — undetected because the step says "if a file doesn't exist, omit it" (giving a false impression of graceful fallback).

### 2. What would confuse a new team member?

The WORKER LOG event in the Session Log table (line 126) shows `{Build|Review}` as the worker type placeholder, but the Metadata template (line 622) lists `Build | Review | Cleanup` — three types. Step 7h sub-step 7 therefore instructs logging only two types while the format it is producing can contain three. A new supervisor implementation would log `Build` or `Review` but never `Cleanup`, even if a Cleanup Worker completed and had its log written.

### 3. What's the hidden complexity cost?

Step 8c sub-step 1 says "count lines starting with `- ` in Files Modified section" to derive files modified count per worker. The Files Modified section of the worker log template (line 643) specifies "List each file on its own line as: `- path/to/file`". That is unambiguous for file lines. However, if the fallback text `"No committed files detected."` is present (line 644), there are zero lines starting with `- `, so the count is 0 — which is correct. This is not a bug but the counting rule should be stated in Step 8c sub-step 1 with explicit reference to the template format, not assumed. Two independent implementations (one counting `- ` prefixed lines, one counting non-empty lines) would diverge. This is the "ambiguous count definition" anti-pattern already in review-general.md.

### 4. What pattern inconsistencies exist?

The Session Log table ends at line 128 with three new events: WORKER LOG, WORKER LOG FAILED, ANALYTICS. The step logic at line 822 (Step 8c sub-step 10) produces a fourth event `ANALYTICS FAILED` on failure, but this event has no matching row in the Session Log table. Every other failure event in the table has a defined row (e.g., `KILL FAILED`, `SPAWN FAILED`, `MCP RETRY`). `ANALYTICS FAILED` is the only failure event that appears in step logic but is absent from the table — a dead-event definition in reverse (a live event with no reference definition).

The existing lesson in review-general.md line 70 states: "Session log event definitions must have matching log instructions in step logic — if the Session Log table defines an event format, the corresponding step logic must include an explicit log instruction that produces that event. Dead event definitions confuse maintainers." This task adds the mirror problem: a live step-logic event with no table row.

### 5. What would I do differently?

- Fix the verdict search pattern to match the actual review file format (look for `## Verdict` heading then read the `**Recommendation**:` line below it, or accept both patterns with a fallback).
- Add `ANALYTICS FAILED` row to the Session Log table so the table is the single complete reference for all possible log events.
- Add `Cleanup` to the WORKER LOG event template in the log table, or document explicitly that Cleanup Workers do not produce a WORKER LOG event.
- Cross-reference Step 8c back to Step 7h by name: the analytics generation step depends on worker log files existing; a forward reference would make the dependency explicit.

---

## Blocking Issues

### Issue 1: Review verdict search pattern does not match actual review file format

- **File**: `.claude/skills/auto-pilot/SKILL.md`, line 607
- **Problem**: Step 7h sub-step 5 instructs the supervisor to search for a line matching `**Verdict**:` in each review file. The actual review files produced by reviewer agents use a `## Verdict` section heading followed by `**Recommendation**: VALUE` on the next line. A grep for `**Verdict**:` on any current review file returns no match. Only `TASK_2026_012/code-style-review.md` uses the old inline format. Every Review Worker log written by any supervisor running against current-format reviews will silently have an empty verdicts table.
- **Impact**: The Review Verdicts section of worker logs is always empty. The Review Quality table in analytics.md (Step 8c sub-step 5) aggregates these verdicts — with empty input it will show all zeros, making the analytics section misleading rather than useful.
- **Fix**: Change the search instruction to: "Find the `## Verdict` heading, then read the next non-blank line for `**Recommendation**: VALUE` and extract VALUE. As a fallback, also check for a line matching `**Verdict**: VALUE` for older files." Update the review-lesson to note the canonical verdict format.

### Issue 2: `ANALYTICS FAILED` log event emitted by step logic but absent from Session Log table

- **File**: `.claire/skills/auto-pilot/SKILL.md`, line 822 (step logic) vs lines 126–128 (Session Log table)
- **Problem**: Step 8c sub-step 10 instructs the supervisor to log `ANALYTICS FAILED — {reason}` on failure. The Session Log table defines WORKER LOG, WORKER LOG FAILED, and ANALYTICS — but not ANALYTICS FAILED. The table is the canonical reference for all log events; an event produced by steps but absent from the table has no authoritative format, is invisible to anyone reading the table to understand possible log states, and violates the "event definitions must have matching log instructions" principle from review-general.md (applied in reverse here).
- **Impact**: Future maintainers reading the Session Log table will not know this event can appear in a real session log, making it harder to parse or monitor logs programmatically. A new implementation of the supervisor would likely omit it.
- **Fix**: Add a row to the Session Log table: `| Analytics failed | \| {HH:MM:SS} \| auto-pilot \| ANALYTICS FAILED — {reason} \|` directly after the `Analytics written` row.

---

## Serious Issues

### Issue 3: WORKER LOG event template shows only `{Build|Review}` but Cleanup Workers also produce logs

- **File**: `.claude/skills/auto-pilot/SKILL.md`, lines 126 and 662
- **Problem**: The Session Log table entry for "Worker log written" (line 126) uses `{Build|Review}` as the worker type placeholder. The Metadata template in the worker log format (line 622) lists `Build | Review | Cleanup` — three types. Step 7h sub-step 7 — the log instruction — reproduces `{Build|Review}` (line 662). If a Cleanup Worker completes and its log is written, the log event will contain `Cleanup` as the type, but the defined template says `{Build|Review}`. The spec is internally inconsistent about whether Cleanup Workers generate WORKER LOG events.
- **Tradeoff**: If Cleanup Workers are intentionally excluded from WORKER LOG events, the Metadata template should say `Build | Review` only, and Step 7h should clarify that it is not triggered for Cleanup Workers. If Cleanup Workers are included, the log table row and step 7 log instruction must say `{Build|Review|Cleanup}`.
- **Recommendation**: Decide the intended behavior and make all three locations (table row, metadata template, step 7 log instruction) consistent.

### Issue 4: Step 8c sub-step 1 counting rule is ambiguous — delegates to template but doesn't cite it

- **File**: `.claude/skills/auto-pilot/SKILL.md`, lines 730–731
- **Problem**: Sub-step 1 says "count lines starting with `- ` in Files Modified section." The underlying template (line 643) uses `- path/to/file` format. The instruction is correct but does not cite the template format or the fallback text `"No committed files detected."`. The review-general.md lesson (line 59) states: "Algorithm specs that count discrete items must define the counting rule precisely." Two implementors who read only Step 8c without reading Step 7h's template could interpret "lines starting with `- `" differently (e.g., count all markdown list items in the whole file).
- **Recommendation**: Add: "Use the template format defined in Step 7h sub-step 6: count lines starting with `- ` in the `## Files Modified` section only. If the section contains only the text `No committed files detected.`, count = 0."

### Issue 5: Per-Task Breakdown table has a `Type` column with no defined value set

- **File**: `.claude/skills/auto-pilot/SKILL.md`, line 792–795
- **Problem**: The `analytics.md` template (Step 8c sub-step 8) includes a `Type` column in the Per-Task Breakdown table, shown as `FEATURE` in the example row. Step 8c sub-step 3 says "for each unique task_id found across all worker logs" but never defines where `Type` comes from or what values are valid. Task type is not written to worker log files — those log Worker Type (Build/Review/Cleanup), not task type. The registry.md likely has a type column, but Step 8c does not instruct the supervisor to read the registry for this value.
- **Tradeoff**: If `Type` is meant to be task type (FEATURE, BUG, etc.), sub-step 3 must include an instruction to read `task-tracking/registry.md` for each task_id. If it is meant to be Worker Type, the column header is misleading.
- **Recommendation**: Add to sub-step 3: "Read `task-tracking/registry.md` to get the task Type for each task_id. If the task is not found in the registry, write `unknown`."

---

## Minor Issues

1. **Step 7h sub-step 0 numbering starts at 0**: The step sub-steps are numbered 0, 1, 2, 3, 4, 5, 6, 7, 8. Starting at 0 is unusual for prose spec documents; all other step sub-steps in SKILL.md start at 1. While functional, this creates a visual inconsistency. (line 592)

2. **Worker log template `## Phase Timeline` section uses `{SESSION_DIR}log.md` as a raw placeholder inside a code fence**: The instruction `{Copy rows from {SESSION_DIR}log.md that contain TASK_X. If no phase entries: omit this table and write "No phase transitions recorded."}` (line 650) mixes a prose instruction inside what is supposed to be the output template format. Other template placeholders use `{field}` convention for values, but this is an instruction, not a value placeholder. It should be placed outside the code fence as a note, as is done elsewhere in the skill.

3. **Review Verdicts table in worker log template always shows all three rows**: Lines 656–658 show Code Style, Code Logic, and Security rows unconditionally, with the omission instruction buried in the line after the closing fence (line 659). An implementor reading top-to-bottom will write all three rows then read the omission rule. The omission instruction should appear before the table or be integrated as inline notes per-row.

4. **Step 8c sub-step 7 format strings are inconsistent**: `Avg Cost per Task` says write `$X.XX` but `Avg Duration per Task` says write `Xm`. The Summary table (lines 779–788) formats `Total Duration` as `{total_duration}m` and `Total Cost` as `${total_cost}`. The sub-step and template are consistent with each other, but `n/a` (lowercase) is used as the fallback — the rest of the file uses `"unknown"` as the not-available sentinel. Using two different sentinel values (`unknown` for MCP fetch failures vs `n/a` for division-by-zero) will cause inconsistency in how consumers check for missing values.

---

## File-by-File Analysis

### `.claude/skills/auto-pilot/SKILL.md` (new additions only)

**Score**: 5/10
**Issues Found**: 2 blocking, 3 serious, 4 minor

**Analysis**:

The four additions are internally mostly coherent and follow the existing SKILL.md format conventions (pipe-table rows, code-fence templates, bold step labels). The session directory files table correctly references `analytics.md` (Step 8c) and `worker-logs/` (Step 7h) with accurate step cross-references — that cross-referencing is done well. The best-effort framing ("never block on failure") is correctly applied to both new steps, consistent with how MCP failures are handled elsewhere.

The critical failures are in the verdict search pattern (Blocking Issue 1) and the incomplete Session Log table (Blocking Issue 2). Both are execution-correctness problems, not style preferences — they will produce wrong output silently, which is the worst kind of wrong output.

**Specific Concerns**:

1. Line 607: `**Verdict**:` search pattern does not match the `## Verdict` / `**Recommendation**: VALUE` format used by actual review agents.
2. Line 822: `ANALYTICS FAILED` event has no table row in the Session Log reference.
3. Lines 126 and 662: `{Build|Review}` excludes Cleanup Worker type from the WORKER LOG event format.
4. Lines 792–795: Per-Task Breakdown `Type` column has no defined data source in the algorithm steps.
5. Line 592: Sub-step numbering starts at 0, inconsistent with all other steps in the document.

---

## Pattern Compliance

| Pattern                                 | Status | Concern                                                                                      |
|-----------------------------------------|--------|----------------------------------------------------------------------------------------------|
| Session Log table completeness          | FAIL   | `ANALYTICS FAILED` event produced by steps but absent from table                            |
| Step logic matches event definitions    | FAIL   | Verdict search pattern does not match actual review file format                               |
| Best-effort / non-blocking new steps    | PASS   | Both 7h and 8c correctly state failures must not block the loop                              |
| Cross-references to new artifacts       | PASS   | Files table correctly cites Step 7h and Step 8c                                              |
| Consistent sentinel values              | FAIL   | `n/a` used in Step 8c, `unknown` used everywhere else                                        |
| Worker type consistency across sections | FAIL   | `{Build|Review}` in log table/step vs `Build|Review|Cleanup` in metadata template            |
| Counting rule precision                 | SERIOUS | Count instruction in Step 8c does not cite the template that defines the counted format      |

---

## Technical Debt Assessment

**Introduced**:
- Verdict search mismatch (Blocking Issue 1) will silently accumulate empty verdicts in every analytics file until fixed. The longer this runs, the more historical analytics data will be wrong.
- Inconsistent sentinel values (`unknown` vs `n/a`) will require a normalization pass if analytics data is ever consumed programmatically.

**Mitigated**:
- Removing "(future)" placeholders from the files table is a clean improvement.
- The best-effort framing on both new steps prevents the new features from becoming loop-blocking failures.

**Net Impact**: Slightly negative. The sentinel inconsistency and verdict mismatch introduce two quiet failure modes that won't surface until someone tries to use the analytics data.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The verdict search pattern (line 607) is wrong against all current review files. Every Review Worker log produced before this is fixed will have an empty verdicts table, and the Review Quality section of analytics will show all zeros — making the analytics appear to work while producing silently incorrect data.

---

## What Excellence Would Look Like

A 10/10 implementation of this spec addition would:

1. Use the actual review file format (`## Verdict` + `**Recommendation**: VALUE`) as the extraction target in Step 7h sub-step 5, with a backward-compatibility fallback for the older `**Verdict**: VALUE` inline format.
2. Add `ANALYTICS FAILED` to the Session Log table so the table is the complete canonical reference.
3. Define exactly one sentinel value for "data unavailable" (use `unknown` throughout — `n/a` is a display concern, not a data value).
4. Resolve the Cleanup Worker ambiguity by either excluding Cleanup from WORKER LOG events (document this explicitly) or including `Cleanup` in the log event template in all three places.
5. Include a "Data Sources" note at the top of Step 8c listing every file it reads from — session state.md, registry.md, worker-logs/, log.md — so future maintainers know the full dependency surface before touching any of those files.

---

## New Review Lessons

The following new patterns should be appended to `.claude/review-lessons/review-general.md`:

- **Step logic that searches for a pattern in a cross-agent file must use the actual format that agent produces, not an assumed format** — when a step reads a file written by another agent (e.g., review files written by reviewer agents), the search pattern must be verified against real output. An assumed pattern (e.g., `**Verdict**:`) that does not match real output (`## Verdict` heading + `**Recommendation**: VALUE`) silently fails and produces empty results with no error. (TASK_2026_032)
- **Session Log table must include ALL events emitted by step logic, including failure variants** — if step logic emits an event on success (e.g., `ANALYTICS`) it must also define the failure event (e.g., `ANALYTICS FAILED`) in the table. The table is the canonical reference; events absent from the table are invisible to log parsers and future maintainers. (TASK_2026_032)
- **Sentinel values for unavailable data must be a single canonical value across all steps and templates** — do not mix `unknown` (used for MCP/fetch failures) and `n/a` (used for division-by-zero or conditional absence). Pick one and use it everywhere. Mixing sentinels forces consumers to check for two different strings when detecting missing data. (TASK_2026_032)
