# Style Review — TASK_2026_066

## Overall Score
8/10

## Verdict
PASS WITH NOTES

---

## The 5 Critical Questions

### 1. What could break in 6 months?

A reader maintaining the spec could misread the `compacting` handler because the two places where it appears (event-driven mode and polling mode, lines 704 and 734) use the same prose with no visual distinction between "warn threshold" and "kill threshold". The boundary between `count == 3` and `count >= 6` is written inline as a single long sentence. The two-strike stuck detection, by contrast, has its own dedicated named section ("Two-Strike Stuck Detection"). A year from now, someone editing the threshold numbers is likely to change one occurrence and miss the other.

### 2. What would confuse a new team member?

The log table (lines 105–107) now has three compaction-related rows in sequence:

```
| Worker compacting | HEALTH CHECK — TASK_X: compacting |
| Compaction warning | COMPACTION WARNING — TASK_X: compacted {N} times |
| Compaction limit | COMPACTION LIMIT — TASK_X: compacted {N} times, killing |
```

The first row (`HEALTH CHECK — ... compacting`) is always emitted when the health state is `compacting`. The second and third rows are emitted *additionally* at specific count thresholds. This layering is not obvious from the table: a new reader could assume the three rows are mutually exclusive states, not that `HEALTH CHECK` fires on every observation while `COMPACTION WARNING` fires on top at count 3. There is no prose footnote clarifying this co-emission pattern, unlike the stuck detection rows which have surrounding prose explaining strike counting.

### 3. What's the hidden complexity cost?

The `Compaction Count` column in the Runtime Counters table (state.md line 1686) is a *session-level* counter for Supervisor self-compaction — it predates this change and is unrelated to the new per-worker `Compaction Count` column added to the Active Workers table. Both use the exact same label "Compaction Count" in the same document. A reader who finds the Runtime Counters section first gets a plausible but wrong mental model of what the new column tracks. This naming collision is not a blocker today, but it is a latent source of confusion.

### 4. What pattern inconsistencies exist?

The `compacting` handler text in event-driven mode uses blockquote table formatting (lines 700–708, wrapped in `>`), while the polling mode handler uses a standard table (lines 730–736). The text of the two `compacting` cells is byte-for-byte identical, which is good. However, the polling mode row has trailing prose after its table: `"No action. Worker will compact automatically."` for `high_context`, and similar explanatory fragments on the `healthy` row. The new `compacting` handler in polling mode drops that trailing-prose convention — the old entry said `"No action. This is normal for long tasks."`, and the replacement contains only procedural steps with no closing context note. Event-driven mode never had that trailing prose, so the two modes are now inconsistent with each other in the opposite direction from before (polling mode used to be more verbose; now it matches event-driven mode in compacting but still differs on the other rows). Minor, but worth noting.

### 5. What would I do differently?

Extract the compaction thresholds (3 and 6) into a single named location — either a Configuration table row or an inline constant block near the top of the document — the same way the stuck detection grace period is documented as a single source in the MCP "Note on stuck detection" callout. Currently the numbers 3 and 6 appear exactly twice (once in event-driven mode, once in polling mode) and are not referenced from the log table or the worker-log section. If the team wants to tune the thresholds, they need to find both occurrences manually with no canonical reference.

---

## Findings

### Finding 1 (Non-blocking): Log event table rows omit the `{N}` value at the boundary thresholds

**Location**: Session Log table, lines 106–107

The `COMPACTION WARNING` log row format is:
```
COMPACTION WARNING — TASK_X: compacted {N} times
```
The compaction handler in Step 6c says the warning fires at `count == 3`, so `{N}` is always 3 at that point. Emitting a variable `{N}` where the value is deterministic is not wrong, but contrast with the stuck detection rows, which use concrete values in their labels: `stuck (strike 1/2)` and `stuck for 2 consecutive checks`. Those rows embed the threshold directly in the log string. The compaction rows use `{N}` as a variable — which is fine for the LIMIT row (where `{N}` is not fixed: it could be 6 or higher if monitoring was skipped), but the WARNING row will always say "compacted 3 times" and documenting it as `{N}` creates a false impression of variability. Consider replacing the WARNING row template with the literal `compacted 3 times` to match the concrete-value style of other threshold events.

**Severity**: Non-blocking. Style inconsistency only.

---

### Finding 2 (Non-blocking): "Compaction Count" name collision between Active Workers table and Runtime Counters table

**Location**: state.md format spec — Active Workers table (line 1640) and Runtime Counters table (line 1686)

The Active Workers table now has a `Compaction Count` column (per-worker, reset to 0 on spawn). The Runtime Counters table has a pre-existing `Compaction Count` row (session-level, counts Supervisor self-compactions). Both live in the same `state.md` document under different section headers. The labels are identical strings.

There is no in-spec disambiguation. Any tool or human parsing `state.md` for "Compaction Count" will get two hits with no way to tell which is which without knowing the section header context.

A simple fix: rename the Runtime Counters row to `Supervisor Compaction Count` or `Session Compaction Count` to distinguish it from the per-worker column.

**Severity**: Non-blocking, but creates a latent maintenance hazard. Recommend renaming before the spec is implemented.

---

### Finding 3 (Non-blocking): Compaction handler lacks a cross-reference to the dedicated section

**Location**: Step 6c `compacting` rows in both modes (lines 704 and 734)

The two-strike stuck handling says `"Apply two-strike detection (see below)"` and there is a dedicated named section ("Two-Strike Stuck Detection") that explains the full protocol. The new compaction handler is self-contained in the table cell — no `(see below)` pointer, no dedicated section. For now, the handler is simple enough that this works. But if the logic ever grows (e.g., per-task vs. per-worker counters, partial-kill behavior), there will be no obvious section to expand. This is a future-proofing note, not a current defect.

**Severity**: Non-blocking. Worth considering.

---

### Finding 4 (Non-blocking): Co-emission pattern between "Worker compacting" and "Compaction warning" rows is undocumented

**Location**: Session Log table, lines 105–107

The existing `| Worker compacting |` row (`HEALTH CHECK — TASK_X: compacting`) is still present and unchanged. The new handler increments the count and then, at threshold, also emits `COMPACTION WARNING`. This means at count == 3, the log will contain two rows for the same monitoring cycle:
```
| HH:MM:SS | auto-pilot | HEALTH CHECK — TASK_X: compacting |
| HH:MM:SS | auto-pilot | COMPACTION WARNING — TASK_X: compacted 3 times |
```
This is deliberate (the HEALTH CHECK is the routine per-cycle log, the WARNING is the threshold action), but it is not stated anywhere in the spec. Contrast: the stuck detection section explicitly describes when each log entry fires relative to the two-strike counter. The compaction log rows have no equivalent explanatory text.

**Severity**: Non-blocking. Clarity issue.

---

## Pattern Compliance

| Pattern | Status | Concern |
|---------|--------|---------|
| Terminology consistency (`compaction_count` snake_case in prose) | PASS | All occurrences use `compaction_count` uniformly |
| Table column formatting in state.md | PASS | New column aligns with existing column style; separator row updated correctly |
| Log event format (pipe-table row, `—` separator) | PASS | Both new rows follow `COMPACTION KEYWORD — TASK_X: ...` format matching existing entries |
| Threshold language (`count == 3` vs `count >= 6`) | PASS | Boundary semantics are correct: `==` for warning (exact trigger), `>=` for kill (catches any slip-through) |
| Kill action consistency | PASS | `call kill_worker, trigger Worker Recovery Protocol, increment retry_count` matches the stuck-kill sequence exactly |
| Worker-log Metadata table | PASS | `Compaction Count` field placed after `Outcome`, consistent with ordering of fields that reflect worker behaviour at end-of-run |
| Dual-mode parity (event-driven vs polling) | PASS | Both `compacting` handler cells are byte-for-byte identical |

---

## Summary of Changes Assessed

| Change | Assessment |
|--------|------------|
| `Compaction Count` column added to Active Workers table in state.md | Correct. Default 0 in example rows. Separator row updated. |
| `compacting` handler updated in polling mode (Step 6c) | Correct. Logic matches spec requirements. |
| `compacting` handler updated in event-driven mode (Step 6c) | Correct. Identical to polling mode text. |
| `Compaction Count` field added to Step 7h worker-log Metadata | Correct. Field present, format matches other Metadata fields. |
| Supervisor self-compaction limit note removed | Correct. Note deleted cleanly with no dangling references. |
| `COMPACTION WARNING` and `COMPACTION LIMIT` log event rows added | Correct in structure. Minor style concern on `{N}` in WARNING row (Finding 1). |

---

## Review Summary

| Overall Score | 8/10 |
|---|---|
| Verdict | PASS WITH NOTES |
| Blocking Issues | 0 |
| Non-blocking Issues | 4 |
| Files Reviewed | 1 |
| Key Concern | Naming collision: "Compaction Count" used for both per-worker column and session-level Runtime Counter in the same state.md document |
