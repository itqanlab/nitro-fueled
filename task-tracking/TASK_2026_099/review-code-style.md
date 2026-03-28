# Code Style Review — TASK_2026_099

**Reviewer**: nitro-code-style-reviewer
**Date**: 2026-03-28
**Score**: 6/10

---

## Summary

The implementation adds per-task timing overrides and a blocked-dependency guardrail to the Supervisor. The content is functionally complete in the files it touches, but three style issues are notable: a log-entry format inconsistency (escaped vs unescaped pipes) across the new entries in auto-pilot SKILL.md, a missing `preferred_tier` row in the docs guide's Field Reference table, and a casing inconsistency between `preferred_tier` (snake_case) and all other field names (Title Case) in the task template.

---

## Findings

### CRITICAL

None.

---

### HIGH

#### H1 — Log entry pipe escaping is inconsistent across new entries (auto-pilot SKILL.md)

**File**: `.claude/skills/auto-pilot/SKILL.md`, lines 126–128
**Rule**: Named concepts must use one term everywhere; formatting conventions must be uniform.

The Session Log table uses `\|` (backslash-escaped pipes) throughout its existing entries so that the pipe characters are not interpreted as markdown table cell separators. Three new log entries added by this task use unescaped pipes:

```
Line 126: `| {HH:MM:SS} | auto-pilot | BLOCKED — TASK_X: dependency TASK_Y not in registry |`
Line 127: `| {HH:MM:SS} | auto-pilot | ORPHAN BLOCKED — TASK_X: blocked with no dependents, needs manual resolution |`
Line 128: `| {HH:MM:SS} | auto-pilot | TIMING WARNING — TASK_X: {field} value {value} invalid or clamped, falling back to default |`
```

Compare to the adjacent entry at line 125 which correctly uses `\|`:

```
`\| {HH:MM:SS} \| auto-pilot \| BLOCKED — TASK_X: dependency TASK_Y is CANCELLED \|`
```

All three new entries should use the `\|` escaping pattern to be consistent with the surrounding 50+ entries in the table.

---

#### H2 — `preferred_tier` field missing from Field Reference table (docs/task-template-guide.md)

**File**: `docs/task-template-guide.md`, lines 65–76
**Rule**: Summary sections must be updated when the steps they describe change.

The `preferred_tier` field was added to `task-tracking/task-template.md` (second salvage commit) but was not added to the **Field Reference** table in the guide. Every other template field has a row in this table. The guide's Field Reference table currently lists: Type, Priority, Complexity, Description, Dependencies, Acceptance Criteria, References, Poll Interval, Health Check Interval, Max Retries.

`preferred_tier` has no row, so readers cannot determine its consumer or how it is used from the guide alone.

---

#### H3 — `preferred_tier` uses snake_case while all other field names use Title Case (task-template.md)

**File**: `task-tracking/task-template.md`, lines 7–17 (Metadata table)
**Rule**: Named concepts must use one term everywhere; visual table consistency.

All fields in the Metadata table use Title Case with spaces:

```
| Type                  | ...
| Priority              | ...
| Complexity            | ...
| Model                 | ...
| Testing               | ...
| Poll Interval         | ...
| Health Check Interval | ...
| Max Retries           | ...
```

The `preferred_tier` field breaks this pattern by using snake_case:

```
| preferred_tier        | [light | balanced | heavy | auto]
```

The field name in the implementation body (SKILL.md extraction pattern, comment blocks, etc.) does use `preferred_tier` as an internal identifier, but the display name in the Metadata table should follow the same Title Case convention as peers. A display name of `Preferred Tier` would be consistent, with the internal key `preferred_tier` remaining as-is in the comment documentation and SKILL.md extraction logic.

---

### MEDIUM

#### M1 — Missing blank line between Step 3b termination and `### Step 3c` heading (auto-pilot SKILL.md)

**File**: `.claude/skills/auto-pilot/SKILL.md`, between lines 559–561

The `IF plan.md does NOT exist` paragraph runs directly into the `### Step 3c:` heading with no blank line separator:

```markdown
IF `task-tracking/plan.md` does NOT exist:
- Continue to Step 4 with default ordering (Priority then Task ID). No consultation needed.
### Step 3c: File Scope Overlap Detection
```

Every other heading transition in the file has a blank line before the `###` heading. This missing blank line makes Step 3c appear to be part of Step 3b's "else" branch rather than a sibling step.

---

#### M2 — BLOCKED_BY_DEPENDENCY log format uses non-standard placeholder style (auto-pilot SKILL.md)

**File**: `.claude/skills/auto-pilot/SKILL.md`, lines 514–515
**Rule**: Named concepts must use one term everywhere.

The inline log message spec in Step 3 uses `TASK_{blocked}` and `TASK_{dependent}`:

```
Log: "BLOCKED DEPENDENCY — TASK_{blocked}: is BLOCKED and blocks TASK_{dependent}"
```

The established placeholder convention throughout the Session Log table and Step 3 inline log specs uses `TASK_X`, `TASK_Y`, and `TASK_Z`:

```
Line 124: BLOCKED — TASK_X: dependency cycle with TASK_Y
Line 125: BLOCKED — TASK_X: dependency TASK_Y is CANCELLED
Line 515: BLOCKED DEPENDENCY — TASK_{blocked}: is BLOCKED and blocks TASK_{dependent}
```

`TASK_{blocked}` / `TASK_{dependent}` are descriptive variable names that don't match the short `TASK_X` / `TASK_Y` convention. Both the Session Log table entry (if one were to be added) and the inline spec should use `TASK_X: is BLOCKED and blocks TASK_Y` to stay consistent.

---

#### M3 — Orphan BLOCKED display warning uses `TASK_{ID}` placeholder (auto-pilot SKILL.md)

**File**: `.claude/skills/auto-pilot/SKILL.md`, lines 527–531
**Rule**: Consistent placeholder convention.

The orphan blocked display warning block uses `TASK_{ID}`:

```
[ORPHAN BLOCKED TASKS] — The following tasks are BLOCKED with no dependents:
  - TASK_{ID}: {reason}
```

The log entry for the same event (line 127) and the task.md description (line 58) use `TASK_X` for the placeholder. `TASK_{ID}` is a non-standard form not used elsewhere in the skill file's display/log templates.

---

### LOW

#### L1 — `BLOCKED_BY_DEPENDENCY` in-memory status has no explicit non-persistence note (auto-pilot SKILL.md)

**File**: `.claude/skills/auto-pilot/SKILL.md`, lines 491–516
**Rule**: Multi-sentinel columns must document the sentinel contract inline.

The Step 3 Classification table lists `BLOCKED_BY_DEPENDENCY` alongside statuses that ARE written to disk (BLOCKED, COMPLETE, CANCELLED, etc.). A brief inline note clarifying that `BLOCKED_BY_DEPENDENCY` is an in-memory classification only (never written to `status` file or registry) would prevent future implementers from treating it as a persistent state. Currently the only hint is step 5 (`BLOCKED_BY_DEPENDENCY tasks do NOT count against retry limit — they are held, not failed`), which is about retry semantics, not persistence.

---

## File-Level Verdicts

| File | Issues | Verdict |
|------|--------|---------|
| `task-tracking/task-template.md` | H3 | Needs fix |
| `docs/task-template-guide.md` | H2 | Needs fix |
| `.claude/skills/auto-pilot/SKILL.md` | H1, M1, M2, M3, L1 | Needs fix |
| `.claude/skills/orchestration/SKILL.md` | None (not modified by this task) | Pass |

---

## Findings Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 3 |
| LOW | 1 |
| **Total** | **7** |
