# Code Style Review - TASK_2026_060

## Review Summary

| Metric          | Value                                       |
|-----------------|---------------------------------------------|
| Overall Score   | 6/10                                        |
| Assessment      | NEEDS_REVISION                              |
| Blocking Issues | 1                                           |
| Serious Issues  | 3                                           |
| Minor Issues    | 3                                           |
| Files Reviewed  | 1 (SKILL.md, lines 294-350 and 1414-1510)   |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The inconsistent worker type naming in the new table (lines 308-314) will cause mismatches. When a future contributor extends the reconciliation table or writes tooling that parses worker type strings, they will find "Build Worker" (two words, title case with space) inconsistent with "ReviewLead", "TestLead", "FixWorker", and "CompletionWorker" (camelCase, no space). The Worker Type column in the Active Workers table at line 1454 defines the canonical type strings. A script parsing the evidence table expecting `"ReviewLead"` will never match a row written as `"Review Lead"` — but the inverse is equally risky: the table uses `"Build Worker"` which does NOT match the canonical type string `"Build"` recorded in state.md (line 1456 shows `| abc-123 | TASK_2026_003 | Build |`). This is the most significant correctness risk in the diff.

### 2. What would confuse a new team member?

The `mcp_empty_count` field is placed at the very bottom of state.md, after the Retry Tracker section and alongside `Compaction Count` (lines 1496-1497). These two scalars are orphaned below a table — no section heading groups them. A new team member reading state.md for the first time has no obvious signal that these are top-level counters, not continuation of the Retry Tracker table. There is no explanation of what `mcp_empty_count` means without cross-referencing Step 1. The `Compaction Count` has the same problem, but that predates this task. Adding a second orphaned scalar makes the pattern more entrenched.

The sub-bullet structure under the new bullet point (lines 316-323) is also potentially confusing: the three cases start as nested bullet points under a table. The table presents a lookup, then the bullets present case logic — but the bullets themselves are visually at the same indentation level as the outer bullet point label "**Worker in state but NOT in MCP list**". A reader scanning for the three cases must track indentation carefully.

### 3. What's the hidden complexity cost?

The "2 consecutive empty checks" threshold (line 322) is a behavior specification embedded in prose. Its value (2) is hardcoded in the description but has no corresponding field in the Configuration table. If a team member wants to tune the grace period, they cannot do so through the existing config system — they must edit this sentence. The Retry Limit config parameter follows a cleaner model: defined in the Configuration table, referenced by logic. `mcp_empty_count` threshold (2) does not follow that model.

### 4. What pattern inconsistencies exist?

Three inconsistencies found:

1. **Worker type name format**: The evidence table (lines 308-314) mixes `"Build Worker"` (spaced, title case) with `"ReviewLead"`, `"TestLead"`, `"FixWorker"`, `"CompletionWorker"` (camelCase). The Active Workers table in state.md (line 1455-1460) stores the type as `Build`, `ReviewLead`, `TestLead`, `FixWorker`, `CompletionWorker`. The evidence table's first row does not use the canonical stored type name.

2. **Table separator alignment**: The separator row at line 309 uses 17 dashes for column 1, but the header cell `Worker Type` with surrounding spaces is 18 characters wide. This is a minor rendering inconsistency but violates the alignment pattern used in every other table in the file (e.g., the Configuration table at lines 1446-1450 is correctly aligned).

3. **Placement of `mcp_empty_count` in state.md**: `Compaction Count` and `MCP Empty Count` are loose bold-key lines appended below the last section, rather than being rows in the Configuration table (which is the existing location for session-level scalar parameters). The Configuration table already holds `Concurrency Limit`, `Monitoring Interval`, and `Retry Limit`. These runtime counters are different from configuration, but there is no section for "runtime counters" — they float orphaned at the end.

### 5. What would I do differently?

- Use `"Build"` (not `"Build Worker"`) in the evidence table to match the canonical worker type string used in state.md and the spawn logic.
- Fix the 1-character separator misalignment in the table.
- Move `mcp_empty_count` into a named section — either a `## Runtime Counters` section alongside `Compaction Count`, or as a column in the Active Workers table for per-worker tracking (though per-session is correct here). At minimum, add a comment explaining what the field tracks.
- Expose the "2 consecutive checks" threshold as a Configuration parameter (`MCP Empty Limit: 2`) so it can be tuned and is documented alongside other limits.

---

## Blocking Issues

### Issue 1: Worker type name mismatch in evidence table

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:310`
- **Problem**: The first row of the new evidence table uses `"Build Worker"` as the Worker Type label. The canonical worker type identifier stored in state.md's Active Workers table is `"Build"` (see line 1456: `| abc-123 | TASK_2026_003 | Build |`). The spawn logic and worker type enumeration (line 548) defines the stored values as `"Build"`, `"ReviewLead"`, `"TestLead"`, `"FixWorker"`, `"CompletionWorker"`. Any supervisor implementation that looks up a worker's type from state.md and uses it to index into the evidence table will fail to match the `"Build Worker"` row.
- **Impact**: A supervisor session reading an active worker with `worker_type = "Build"` and consulting this table will find no matching row for `"Build Worker"`, falling through to undefined behavior — potentially skipping the evidence check entirely and triggering the wrong completion path.
- **Fix**: Change `| Build Worker |` to `| Build |` at line 310 to match the canonical type string. The other four rows (`ReviewLead`, `TestLead`, `FixWorker`, `CompletionWorker`) are already correct.

---

## Serious Issues

### Issue 1: Hardcoded threshold with no configuration entry

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:322`
- **Problem**: The sentence "If `mcp_empty_count` reaches 2 AND still no file-system evidence, treat all unknown-status workers as failed" embeds a hard threshold of 2 in prose. There is no corresponding entry in the Configuration table (lines 1446-1450) and no parameter in the `--limit`/`--stuck` parameter set. The Retry Limit parameter (also 2) follows the config table pattern — `mcp_empty_count` should follow the same pattern.
- **Tradeoff**: A low threshold catches real MCP restarts quickly but may false-positive on slow starts. A high threshold is more tolerant but increases recovery latency. This tradeoff should be configurable, not buried in a prose sentence.
- **Recommendation**: Add `| MCP Empty Limit | 2 |` to the Configuration table in state.md format. Reference it in the logic: "If `mcp_empty_count` reaches `{mcp_empty_limit}`...".

### Issue 2: `mcp_empty_count` placement lacks grouping context

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:1496-1497`
- **Problem**: `**Compaction Count**: 0` and `**MCP Empty Count**: 0` are orphaned at the bottom of the state.md format block with no section heading. A supervisor recovering from compaction reads state.md top to bottom. These fields must be found and parsed — but they have no structural marker. There is no heading like `## Runtime Counters` to signal their purpose or group them.
- **Tradeoff**: The existing `Compaction Count` predates this task and has the same problem. Adding a second orphaned scalar makes the pattern a fixture rather than a temporary wart.
- **Recommendation**: Add a `## Runtime Counters` section heading above `**Compaction Count**` and `**MCP Empty Count**` to group them. This is a small structural change that makes the format self-documenting.

### Issue 3: Missing reset condition for `mcp_empty_count` in the "evidence found" path

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:316`
- **Problem**: The "If evidence of completion is found" bullet (line 316) triggers the completion handler but does not explicitly reset `mcp_empty_count` to 0. The "non-empty list, worker missing" case at line 323 does say "Reset `mcp_empty_count` to 0." The "evidence found" case omits this instruction. If a previous loop iteration incremented `mcp_empty_count` to 1, and the next loop finds evidence and triggers the completion handler, the counter stays at 1. On the next invocation where MCP is empty (possibly a different worker), the count starts from 1 instead of 0, halving the effective grace period.
- **Recommendation**: Add "Reset `mcp_empty_count` to 0." to the end of the "If evidence of completion is found" bullet at line 316.

---

## Minor Issues

1. **Line 309 — Table separator 1 character short**: The separator for column 1 is 17 dashes (`-----------------`) while the header cell `Worker Type` with surrounding spaces is 18 characters wide (` Worker Type      ` = 18 chars). Should be `------------------` (18 dashes) for visual alignment. Not a rendering failure in most Markdown processors, but inconsistent with all other tables in the file.

2. **Lines 316-323 — Indentation structure is awkward**: The three case bullets (lines 316, 317, 323) are nested at 5 spaces of indent inside a list item that itself is indented at 3 spaces. This creates a table floating inside a bullet, followed by sub-bullets at the same visual level as sibling list items. Consider extracting the table and case logic into a numbered sub-section (e.g., "#### Reconciliation cases when worker is missing from MCP") rather than nesting inside a bullet point. This is a readability concern, not a correctness concern.

3. **Line 319 — Log message uses `{mcp_empty_count}` after increment**: The log line reads `"(empty_count={mcp_empty_count})"` where `{mcp_empty_count}` refers to the value after the increment (line 318 says to increment first, then log). This is technically correct behavior but the ordering is implicit. A brief inline note — "log the post-increment value" — would remove the ambiguity for implementors.

---

## File-by-File Analysis

### SKILL.md (lines 294-350 and 1414-1510)

**Score**: 6/10
**Issues Found**: 1 blocking, 3 serious, 3 minor

**Analysis**:

The new content integrates the file-system-first reconciliation logic correctly at a behavioral level. The three-case breakdown (evidence found / empty list no evidence / non-empty list) matches the task specification. The `mcp_empty_count` field appears in the correct place (state.md format block) and is initialized to 0. The log message format is specific and actionable.

The primary structural weakness is the worker type naming inconsistency in the evidence table. This is a direct correctness risk, not a style preference — the table is meant to be consulted programmatically by the supervisor when matching against worker type strings stored in state.md. Using `"Build Worker"` instead of `"Build"` creates a lookup gap.

The secondary concern is the hardcoded threshold and absent configuration entry. The skill has a clear precedent (Retry Limit as a config parameter) that this change does not follow.

**Specific Concerns**:

1. Line 310: `| Build Worker |` should be `| Build |` — canonical type string mismatch with state.md line 1456.
2. Line 322: Threshold `2` is hardcoded prose — no corresponding Configuration table entry.
3. Line 316: "Evidence found" case silently omits `mcp_empty_count` reset.
4. Line 309: Separator dash count is 17, header cell width is 18 — 1-character misalignment.

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                                 |
|----------------------------------|--------|-------------------------------------------------------------------------|
| Consistent worker type names     | FAIL   | `"Build Worker"` in evidence table does not match `"Build"` in state.md |
| Table separator alignment        | FAIL   | Column 1 separator is 1 dash short                                      |
| Configurable thresholds          | FAIL   | `mcp_empty_count` threshold (2) is hardcoded in prose, not in config    |
| Terminology consistency          | PASS   | All other worker types (ReviewLead, TestLead, etc.) match canonical names |
| State field placement            | PARTIAL| Field added correctly but lacks structural grouping in state.md         |
| Logic completeness (reset paths) | FAIL   | `mcp_empty_count` reset missing from "evidence found" path              |

---

## Technical Debt Assessment

**Introduced**:
- A hardcoded threshold (2) embedded in prose that cannot be tuned via the existing configuration system. This will require a future doc-only change to expose as a config parameter.
- A second orphaned scalar in state.md (alongside the pre-existing `Compaction Count`) without structural grouping. As state.md grows, ungrouped scalars at the bottom become a maintenance pattern that is harder to break.

**Mitigated**:
- The MCP restart false-positive trigger that caused incorrect completion handler invocations on empty `list_workers` responses. This is a real correctness improvement.

**Net Impact**: Slight increase in debt due to the hardcoded threshold and ungrouped state field, partially offset by the correctness gain.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `"Build Worker"` type label in the evidence table does not match the canonical `"Build"` type string stored in state.md, creating a lookup gap that would cause evidence checks to silently fail for Build Worker rows.

---

## What Excellence Would Look Like

A 9/10 implementation would:
1. Use `"Build"` (not `"Build Worker"`) in the evidence table to align with the canonical type string format in state.md.
2. Add `| MCP Empty Limit | 2 |` to the Configuration table and reference it by name in the threshold logic, following the Retry Limit precedent.
3. Add `## Runtime Counters` section heading in state.md format to group `Compaction Count` and `MCP Empty Count`.
4. Explicitly state "Reset `mcp_empty_count` to 0" in the evidence-found path, eliminating ambiguity about when the counter resets.
5. Fix the 1-character separator misalignment in the evidence table.
