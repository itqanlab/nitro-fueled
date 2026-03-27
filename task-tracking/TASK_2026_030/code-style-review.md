# Code Style Review — TASK_2026_030

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | code-style-reviewer |
| Task | TASK_2026_030 |
| Overall Score | 6/10 |
| Assessment | PASS WITH NOTES |
| Blocking Issues | 0 |
| Serious Issues | 1 |
| Minor Issues | 3 |
| Files Reviewed | 1 |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The inconsistent format string at line 711 (`HH:MM+ZZZZ`, no seconds, no space before `+`) will cause an agent or human to write history session headers in a format that doesn't match the canonical format enforced everywhere else. This is the most likely point of drift — the history header is written once per session and is the "face" of the run summary.

### 2. What would confuse a new team member?

Two things:

- `+ZZZZ` as a placeholder is not a standard notation. ISO 8601 and `strftime` both use `+HH:MM` or `+HHMM`. A developer who reads `+ZZZZ` and then runs `date '+%z'` will get `+0200` and wonder if `ZZZZ` meant four digits or something else. It works, but `+HHMM` would be self-documenting.
- The note at line 203 is appended inline to a numbered step, making it easy to skim past. The same information at line 641 is placed in a blockquote, which is visually distinct and harder to miss. The inconsistency in presentation means one location gets read and the other gets skipped.

### 3. What's the hidden complexity cost?

None introduced. This is documentation-only. The complexity ceiling is low.

### 4. What pattern inconsistencies exist?

**Serious**: The session header format at line 711 uses `HH:MM+ZZZZ` (no seconds, offset glued to time with no space), while every other format string in the diff uses `YYYY-MM-DD HH:MM:SS +ZZZZ` (with seconds, space before offset). These describe different formats. An agent following line 711 literally would write `2026-03-27 14:30+0200` while an agent following line 203 or 641 would write `2026-03-27 14:30:00 +0200`. Both can't be correct for the same document set.

**Minor**: The note at line 203 is inline on a numbered-step line. The equivalent note at line 641 uses a blockquote (`>`). Placement style is inconsistent across the two occurrences.

**Minor**: `+ZZZZ` is used as the placeholder but the concrete examples (lines 1126, 1127, 1141) show `+0200`, which is `+HHMM` format. The placeholder `ZZZZ` has four characters mapping to `HHMM` — this works but is not self-evident. `+HHMM` would make the mapping obvious.

**Minor**: Line 176 describes the requirement ("must include the local timezone offset") but does not show the full `YYYY-MM-DD HH:MM:SS +ZZZZ` format string or the `date` command. Lines 203 and 641 both include the format string and command. The note at line 176 is thinner than the others for no clear reason.

### 5. What would I do differently?

Fix line 711 to use the canonical format: `## Session YYYY-MM-DD HH:MM:SS +ZZZZ — YYYY-MM-DD HH:MM:SS +ZZZZ` (or at minimum `HH:MM:SS +ZZZZ` for the time-only portion). Decide whether the header shows start+end as full datetimes or time-only, then apply that consistently.

Rename the placeholder from `+ZZZZ` to `+HHMM` throughout, since `%z` in strftime outputs `+HHMM` and the placeholder would then be self-explanatory.

Move the inline note at line 203 to its own indented sub-point or blockquote to match the visual weight of the equivalent note at line 641.

---

## Serious Issues

### Issue 1: Session header format at line 711 is inconsistent with the canonical format

- **File**: `.claude/skills/auto-pilot/SKILL.md:711`
- **Problem**: The history session header uses `HH:MM+ZZZZ` — no seconds component, no space between time and offset. Every other format string added in this task uses `YYYY-MM-DD HH:MM:SS +ZZZZ` (seconds present, space before offset). The two formats are not interchangeable and describe different string shapes.
- **Current text**: `## Session YYYY-MM-DD HH:MM+ZZZZ — HH:MM+ZZZZ`
- **Expected**: Should include seconds and space before offset: `## Session YYYY-MM-DD HH:MM:SS +ZZZZ — YYYY-MM-DD HH:MM:SS +ZZZZ` (or time-only `HH:MM:SS +ZZZZ` if the intent is start-time to end-time shorthand, but seconds and space must be present)
- **Impact**: Agents reading both sections will produce inconsistent timestamp strings across files in the same session.

---

## Minor Issues

### Minor 1: Inline note at line 203 lacks the visual distinction used at line 641

- **File**: `.claude/skills/auto-pilot/SKILL.md:203`
- **Problem**: The timezone format note is appended to the end of numbered step 1. The equivalent note at line 641 uses a blockquote (`>`), making it visually distinct. The inconsistency means one is easy to skim past.
- **Recommendation**: Extract to its own indented note or blockquote to match line 641's treatment.

### Minor 2: Placeholder `+ZZZZ` is non-standard and non-self-documenting

- **File**: `.claude/skills/auto-pilot/SKILL.md:203, 641, 711, 1110, 1111`
- **Problem**: The `date %z` strftime directive outputs `+HHMM` (e.g., `+0200`). Using `ZZZZ` as the placeholder does not map obviously to this output format. A developer seeing `ZZZZ` may think of ISO 8601 extended (`+HH:MM`) or moment.js `ZZZZ` (named timezone), neither of which is what `%z` produces.
- **Recommendation**: Replace `+ZZZZ` with `+HHMM` as the placeholder throughout. It mirrors the actual output of `%z` exactly.

### Minor 3: Note at line 176 is thinner than its counterparts at lines 203 and 641

- **File**: `.claude/skills/auto-pilot/SKILL.md:176`
- **Problem**: Line 176 states the requirement but omits the format string and the `date` command that lines 203 and 641 include. A reader encountering line 176 first gets less information than one who reaches line 203 or 641.
- **Recommendation**: Either add the format string and command to line 176, or cross-reference line 203 explicitly so readers know where to find the canonical form.

---

## File-by-File Analysis

### `.claude/skills/auto-pilot/SKILL.md`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 3 minor

**Analysis**:

The core intent of the changes — mandating local time with timezone offset across all datetime fields — is sound and the format string `YYYY-MM-DD HH:MM:SS +ZZZZ` is applied consistently in four of the five changed locations. The `date` command example (`date '+%Y-%m-%d %H:%M:%S %z'`) is correct on macOS/Linux. Concrete examples using `+0200` in table rows are appropriate and do not constitute inconsistency.

The serious issue is at line 711: the session history header format drops seconds and removes the space before the offset, making it a different format shape than what is enforced everywhere else. This will result in diverging timestamp styles between state.md (which agents update continuously) and orchestrator-history.md (which agents write at session close).

**Specific Concerns**:

1. Line 711: `HH:MM+ZZZZ` vs `HH:MM:SS +ZZZZ` — different format shape, needs alignment
2. Line 203: note is appended inline to a step rather than given visual separation, inconsistent with line 641
3. Lines 203, 641, 711, 1110, 1111: `+ZZZZ` placeholder would be clearer as `+HHMM`

---

## Pattern Compliance

| Pattern | Status | Concern |
|---------|--------|---------|
| Format string consistency | FAIL | Line 711 uses `HH:MM+ZZZZ`, others use `HH:MM:SS +ZZZZ` |
| Backtick usage for code/format strings | PASS | All format strings and commands are in backticks |
| `date` command correctness | PASS | `date '+%Y-%m-%d %H:%M:%S %z'` is correct |
| Concrete examples vs placeholders | PASS | `+0200` in table rows is appropriate for examples |
| Prose clarity | PASS WITH NOTES | Notes are clear; inline placement at line 203 reduces discoverability |

---

## Technical Debt Assessment

**Introduced**: Mild — the `+ZZZZ` placeholder is a non-standard convention that future contributors will need to decode. The inconsistent session header format will require a follow-up fix when an agent or human notices the mismatch.

**Mitigated**: The changes close a real gap: previously, there was no canonical guidance on timezone handling in any of these locations. Any guidance is better than none.

**Net Impact**: Slight positive, but the line 711 inconsistency will generate a follow-up task if left unfixed.

---

## Verdict

**Recommendation**: PASS WITH NOTES
**Confidence**: HIGH
**Key Concern**: Line 711's `HH:MM+ZZZZ` format is inconsistent with `HH:MM:SS +ZZZZ` used everywhere else in this changeset. It should be corrected before the session history header produces timestamps that differ structurally from all other datetime fields in the system. This is not blocking merge, but it is the first thing that should be addressed in a follow-up or quick fixup commit.

## What Excellence Would Look Like

A 9/10 version of this change would:

1. Use a single, explicitly named format constant (e.g., define it once in a "Datetime Standards" section and reference it from each location, rather than repeating the format string five times with slight variations)
2. Use `+HHMM` as the placeholder so the mapping from `date %z` output is obvious without cross-referencing
3. Place all timezone notes in blockquotes consistently, not mixed inline and blockquote
4. Show the full canonical format string at line 176 so the first mention is as complete as the later ones
5. Use `HH:MM:SS +HHMM` in the session history header to match the canonical format
