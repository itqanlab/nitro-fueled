# Code Style Review — TASK_2026_118

**Reviewer:** nitro-code-style-reviewer
**Scope:** `.claude/commands/nitro-status.md`, `apps/cli/scaffold/.claude/commands/nitro-status.md`
**Verdict:** PASS with minor findings

---

## Summary

Both files are byte-for-byte identical, which is correct per the scaffold-sync convention. The implementation is well-structured with a clear Execution section, a concrete Output Format with real fenced code blocks, and a Notes section that is consistent with the IMPORTANT constraint. Two minor style issues found.

---

## Findings

### STYLE-1 — H1 title drops the `nitro-` prefix [Minor]

**File:** Both files, line 1
**Rule:** Named concepts must use one term everywhere (`/nitro-status` vs `/status` must not be mixed)

The H1 heading reads:
```
# Status — Project Status Report
```

The file is `nitro-status.md` and the command is invoked as `/nitro-status` (confirmed in the Usage section). The title drops the `nitro-` prefix, creating an inconsistency. A user reading the title in isolation would not know whether this is `/status` or `/nitro-status`.

**Expected:**
```
# /nitro-status — Project Status Report
```
or at minimum:
```
# nitro-status — Project Status Report
```

---

### STYLE-2 — Active Tasks / Needs Attention double-listing ambiguity [Minor]

**File:** Both files, lines 17–58
**Rule:** Metadata fields and prose instructions must be consistent within the same file

Execution step 4 says:
> Generate a table of all non-complete tasks **(excluding COMPLETE and CANCELLED)**

This means BLOCKED and FAILED tasks ARE included in Active Tasks. But the Output Format immediately follows with a "Needs Attention" section that lists BLOCKED and FAILED tasks separately. This creates an ambiguous specification: will BLOCKED and FAILED tasks appear once (only in Needs Attention) or twice (Active Tasks + Needs Attention)?

The step should clarify intent. If Active Tasks is meant to show only in-flight work (CREATED, IN_PROGRESS, IMPLEMENTED, IN_REVIEW) and Needs Attention covers BLOCKED and FAILED separately, the exclusion list in step 4 should read "(excluding COMPLETE, CANCELLED, BLOCKED, and FAILED)". If the intent is to show them in both, the prose should state that explicitly.

---

## Checks Passed

| Check | Result |
|-------|--------|
| Enum values character-for-character match canonical source (CLAUDE.md) | PASS |
| Output Format section contains a real fenced code block (not a placeholder) | PASS |
| Step numbering flat and sequential (1–5) | PASS |
| IMPORTANT constraint and Notes are consistent (both prohibit reading task.md files) | PASS |
| No implementation-era language ("new feature", "this now supports", etc.) | PASS |
| Scaffold sync — both files identical | PASS |
| No schema duplication — command references registry.md rather than hardcoding its structure | PASS |

---

## File Scope Confirmation

Only the two in-scope files were reviewed. No issues found outside this scope.
