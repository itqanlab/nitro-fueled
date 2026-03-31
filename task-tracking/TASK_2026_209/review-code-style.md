# Code Style Review — TASK_2026_209

## Summary

Reviewed the new Implement Worker prompt sections (lines 347-512) in `.claude/skills/auto-pilot/references/worker-prompts.md` for code style consistency with existing Build Worker and Prep Worker sections. Overall, the implementation follows established patterns well with a few minor inconsistencies in step descriptions.

## Findings

| ID | Severity | Location | Issue | Recommendation |
|----|----------|----------|-------|----------------|
| S1 | Minor | Line 403 | Missing "(no trailing newline)" clarification in step 6d status write instruction | Add `(no trailing newline)` after "IMPLEMENTED" for consistency with Build Worker (line 66) and Prep Worker (line 247) |
| S2 | Minor | Line 406 | Missing "The status file is authoritative" phrase in step 6d | Add this phrase after "Best-effort." for consistency with other First-Run worker sections |
| S3 | Minor | Lines 402, 403 | Step 6b lacks git add command example unlike Build Worker step 4b | Consider adding the `git add` command example for clarity, or accept as intentional simplification |
| S4 | Minor | Line 403 | Step 6c uses plain text while Build Worker step 4c uses bold (`**Populate file scope**`) | Apply bold formatting for consistency |
| S5 | Minor | Line 389 | Step 6a says "this is MANDATORY:" while Build Worker says "this is MANDATORY before committing:" | Consider adding "before committing" for consistency |

### Positive Observations

- **Trailing whitespace**: None found in new sections (lines 347-512)
- **Placeholder usage**: All placeholders (`{TASK_ID}`, `{worker_id}`, `{SESSION_ID}`, etc.) are consistent with existing sections
- **Section headers**: Properly formatted with `##` level, matching pattern of other worker prompt sections
- **Code blocks**: Properly opened and closed with triple backticks
- **Section separators**: `---` correctly placed before First-Run Implement Worker (line 345), correctly omitted between First-Run and Retry sections (matching existing pattern)
- **Indentation**: Consistent 3-space indentation for numbered list continuation lines
- **Worker Mode table** (line 19): Correctly adds Implement Worker entry with consistent formatting
- **Worker-to-Agent Mapping** (lines 813-816): Correctly adds Implement Worker entries with consistent formatting
- **Status labeling**: Correctly uses "IMPLEMENTING" status (distinct from "IN_PROGRESS") for the PREPPED → IMPLEMENTED transition

## Verdict

| Criterion | Status |
|-----------|--------|
| Verdict | PASS |
| Blocking Issues | 0 |
| Serious Issues | 0 |
| Minor Issues | 5 |

## Notes

The Implement Worker sections follow the shorter, more concise style established by the Prep Worker (which was added more recently) rather than the more verbose Build Worker style. This is appropriate and represents an evolution toward cleaner prompts.

The minor issues identified are stylistic preferences that do not affect functionality. The status file write will work correctly regardless of whether "(no trailing newline)" is explicitly stated, as the implementation should handle this appropriately.

**Recommendation**: The code is ready to merge. The minor issues can be addressed in a follow-up cleanup task if desired, but they do not block this task's completion.
