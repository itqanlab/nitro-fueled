# Code Logic Review — TASK_2026_058

**Reviewer**: code-logic-reviewer
**Date**: 2026-03-27
**Task**: Per-Task Status Files — Single Source of Truth for Task State

## Review Summary

| Metric | Value |
|--------|-------|
| Files Reviewed | 10 modified files + 64 status files (spot-checked) |
| Blocking Issues | 1 |
| Serious Issues | 1 |
| Minor Issues | 2 |
| Overall Score | 5/10 |
| Verdict | FAIL |

## Scope

Reviewed according to File Scope in task.md:
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/agents/planner.md`
- `.claude/commands/project-status.md`
- `.claude/commands/create-task.md`
- `packages/cli/src/utils/registry.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/scaffold/.claude/skills/orchestration/SKILL.md`
- `packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md`
- `task-tracking/registry.md`
- `task-tracking/TASK_*/status` (64 files, spot-checked)

---

## Blocking Issues

### B1. parseRegistry regex incompatible with generateRegistry output

**Location**: `packages/cli/src/utils/registry.ts:46-48` (parseRegistry) vs lines 158, 162-163 (generateRegistry)

**Problem**: The `generateRegistry()` function now produces 6-column rows including a Model column:
```
| TASK_2026_001 | COMPLETE    | FEATURE | Description  | 2026-03-23 | — |
```

However, `parseRegistry()` uses a regex that expects exactly 5 columns and the line to end immediately after the date:
```typescript
/^\|\s*(TASK_\d{4}_\d{3})\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(.+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*$/
```

The `\|\s*$` at the end expects `|` followed by end-of-line, but the generated rows have `| — |` after the date column.

**Impact**: `parseRegistry()` will fail to match ANY registry rows. The `status.ts` command flow is:
```typescript
generateRegistry(cwd);      // Generates 6-column registry
const rows = parseRegistry(cwd);  // Returns empty array (regex fails)
```

This breaks the CLI `status` command — it will report "No tasks in registry" even when tasks exist.

**Fix**: Update the parseRegistry regex to either:
1. Accept an optional 6th column: `...(\d{4}-\d{2}-\d{2})\s*\|(?:\s*[^|]*\s*\|)?\s*$/`
2. Or make the Model column capture group optional

---

## Serious Issues

### S1. Hardcoded fallback date in generateRegistry

**Location**: `packages/cli/src/utils/registry.ts:156`

**Code**:
```typescript
const created = existingRow?.created ?? '2026-03-27';
```

**Problem**: When a task has no existing registry entry (new task discovered by folder scan), the Created date falls back to a hardcoded string `'2026-03-27'` instead of the current date.

**Impact**: Tasks created after 2026-03-27 will have incorrect Created dates in the registry. This is especially problematic because:
1. The registry is now generated on-demand
2. New tasks may be added via `/create-task` which writes status files but not registry rows
3. When registry is regenerated, these tasks get the wrong date

**Fix**: Compute current date dynamically:
```typescript
const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
const created = existingRow?.created ?? today;
```

---

## Minor Issues

### M1. Warning message format inconsistency

**Locations**:
- `packages/cli/src/utils/registry.ts:125,129,135` — uses `[warn] TASK_X:` format
- `.claude/skills/auto-pilot/SKILL.md:334` — specifies `"[warn] TASK_YYYY_NNN: status file missing..."`
- `.claude/agents/planner.md:64` — specifies "fall back to registry column 2 and log a warning"
- `.claude/commands/project-status.md:12` — specifies "log a warning"

**Problem**: The CLI uses `[warn]` prefix while markdown specs sometimes just say "log a warning" without specifying format. This is a minor consistency issue — the code follows a reasonable convention, but the specs could be more explicit.

**Impact**: Low — just cosmetic inconsistency in log output.

### M2. Model column introduced without documentation update

**Location**: `packages/cli/src/utils/registry.ts:162-163`

**Problem**: The registry now includes a Model column in both the header and data rows, but this change isn't reflected in the review-context.md or task.md descriptions of what changed. The registry format expanded from 5 to 6 columns.

**Impact**: Future maintainers may not realize the registry format changed, and tools that parse registry.md may need updates.

---

## Verified Correct

### Status file format
All spot-checked status files (`TASK_2026_001`, `TASK_2026_038`, `TASK_2026_058`) contain exactly one word with no trailing content, as specified.

### Status file path consistency
All references use `task-tracking/TASK_YYYY_NNN/status` consistently across:
- orchestration/SKILL.md (lines 120, 375-376)
- auto-pilot/SKILL.md (lines 80, 309-314, 334, 382-391, 584, 611, etc.)
- planner.md (lines 64, 88, 101, 129, 203)
- create-task.md (line 77)
- project-status.md (lines 11-12)
- registry.ts (lines 116, 121-123)

### Whitespace trimming
All status file reads specify trimming whitespace:
- auto-pilot SKILL.md: "trim all whitespace"
- planner.md: "trim whitespace"
- project-status.md: "trim whitespace"
- registry.ts: `.trim()`

### Registry generation header
The generated registry.md correctly includes the "DO NOT EDIT" header as specified:
```markdown
<!-- DO NOT EDIT — generated by nitro-fueled status -->
```

### Status fallback behavior
All specs consistently specify falling back to registry column 2 when status file is missing, with a warning logged. This maintains backwards compatibility during migration.

### FIXING status
The FIXING status is correctly added to `VALID_STATUSES` array in registry.ts and is handled in auto-pilot SKILL.md Step 1 Case 6 and Step 3 dependency classification.

### Scaffold mirroring
The scaffold orchestration SKILL.md mirrors the source file correctly (verified full content match). The scaffold auto-pilot SKILL.md appears to mirror source (verified first 400 lines).

---

## Out of Scope Notes

**CLAUDE.md status list**: The project's CLAUDE.md lists task states as `CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED` without FIXING. However, CLAUDE.md is not in the File Scope for this task, so this is noted but not flagged as a finding for this review.

---

## Recommendations

1. **Immediate**: Fix the parseRegistry regex before merging — this blocks the CLI from functioning
2. **Before merge**: Replace hardcoded date with dynamic date computation
3. **Future**: Consider adding integration test that verifies generateRegistry output can be parsed by parseRegistry
