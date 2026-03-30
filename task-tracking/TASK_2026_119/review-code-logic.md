# Code Logic Review — TASK_2026_119

## Summary

The `/nitro-burn` command is a markdown instruction file that correctly implements the happy path for all three invocation modes. However, it contains five logic gaps — two of which can silently produce wrong totals or missing rows — and several underspecified parsing rules that will break when the LLM executing the command encounters real-world data formats.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Duration parsing only handles `Nm` format.** Step 4 says: "parse `Nm` format to minutes". The real `orchestrator-history.md` data contains `~104m`, `~3m`, `~12m`, `~2m`, `115m` — values prefixed with `~` (tilde approximation markers). A strict `Nm` parser silently skips these entries or parses them as `NaN`, producing a total duration that is lower than reality without any warning to the user.

**`orchestrator-history.md` has two structural formats, only one is handled.** The file contains both single-task "Task Completion Entry" blocks (with a simple 5-column table) and multi-task "Session" blocks (with a free-form paragraph header plus a multi-row workers table). Step 2 says to "Extract: Task, Worker type, Cost, Duration from each entry's table" — this instruction is ambiguous for Session blocks, where the Task column contains compound names like `TASK_2026_116-REFACTORING-FIX (from paused)` and the table may span multiple tasks. A naïve extraction will silently misidentify Task IDs for session-block rows.

**Empty state condition is wrong.** Step 2 says: "If no `session-analytics.md` files exist AND `list_workers` returns no data, output the empty state message." But `orchestrator-history.md` is a third data source. A project that only has history entries (no analytics files, MCP offline) will silently receive the empty state message even though data exists.

### 2. What user action causes unexpected behavior?

**`--since` filter applied only to `session-analytics.md`, not to `orchestrator-history.md`.** The filter is described as "tasks whose `Start Time` in `session-analytics.md` is on or after the given date." If a task has no `session-analytics.md` file but exists in `orchestrator-history.md` (many older tasks fit this pattern), it is never subject to the `--since` filter — it either appears in every `--since` report regardless of its actual date, or it is silently excluded because there is no analytics file to match it against. The command gives no instruction on how to handle this case.

**`--task` validation is folder-existence only.** If the task folder exists but has no `session-analytics.md` and MCP is offline, the command will validate successfully but then produce an empty per-task table with no data. The empty state guard only triggers if BOTH conditions are true globally, not per-task. A user who runs `/nitro-burn --task TASK_2026_099` on an old task with only history data will get an almost-blank table with no explanation.

### 3. What data makes this produce wrong results?

**Duplicate task IDs across history formats produce double-counting.** `orchestrator-history.md` contains both a "Task Completion Entry" section for a task AND entries in Session blocks for the same task (e.g., TASK_2026_049 has a Session block entry with 5 rows summing to ~$7.56, plus is also referenced in other entries). Step 3 says "sum the costs" for tasks in multiple rows, but the instruction covers only orchestrator-history. If the same task_id appears in both a solo "Task Completion Entry" block AND inside a Session workers table, the cost is double-counted.

**Tilde-prefixed costs are ambiguous.** `orchestrator-history.md` contains costs like `~$1.51`, `~$3.00`, `~$0.87`. Step 3's cost rule says: "Mark cost as `—` if no source has a real value." Is `~$1.51` a "real value"? The command never defines what constitutes a "real cost value." Different LLM executions will handle this inconsistently — sometimes including these approximate values in totals, sometimes treating them as non-real.

**`Workers` fallback of 1 is wrong for multi-worker history tasks.** A task like TASK_2026_049, which had 5 separate workers in the Session block (Build, Cleanup, Review, Test, Completion), will report `Workers: 1` if MCP data is unavailable. This is specifically misleading for the cost-spike investigation use case that motivated this command.

### 4. What happens when dependencies fail?

**MCP `list_workers` fails mid-execution.** The command correctly says "MCP calls are best-effort." However, if `list_workers` returns a partial result (some tasks have data, some do not due to a timeout or connection drop), there is no instruction to detect partial responses. A truncated MCP result will report some tasks as having 0 tokens/cost when they actually have data, and the Cost Note "N of N tasks have worker records" will report an inflated numerator.

**`orchestrator-history.md` does not exist.** Step 2 correctly says "if it exists." This case is handled. No issue here.

**Glob finds zero `session-analytics.md` files but MCP returns workers.** The empty state check fires correctly (`no analytics AND no MCP data`). However, if MCP has data but no analytics files exist, the command correctly proceeds — but the per-task table will have Task IDs from MCP only, with no Outcome, Phases Completed, or Files Modified data (all `—`). The command does not address what the Outcome column displays in this scenario; it only lists `session-analytics.md` as the primary source with no fallback for Outcome.

### 5. What's missing that the requirements didn't mention?

**No instruction for tasks with multiple `session-analytics.md` runs.** A task can be retried: it gets an IMPLEMENTED status, is re-opened, and runs again. If two separate orchestration runs both write to the same `session-analytics.md` file (overwriting or appending), the command will either see one record (last write wins) or multiple rows. The command assumes exactly one session per task file and gives no guidance on multi-run files.

**No timezone normalization for `--since` comparison.** Real `Start Time` values are `2026-03-27 12:44:59 +0200`. A user running `/nitro-burn --since 2026-03-28` may get unexpected results depending on whether the LLM strips the timezone offset before comparing. The instruction says "on or after the given date" but the comparison semantics for timezone-aware timestamps versus a bare date are unspecified.

**Outcome enum values are incomplete.** Step 4 says to count `COMPLETE, IMPLEMENTED, FAILED, STUCK`. Real data also contains `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `CREATED`, and `CANCELLED` (from the project's task state machine). Tasks currently in-flight will have one of these statuses. The Outcomes line in the Project Totals table silently omits them — a project with 10 in-progress tasks shows only the terminal-state counts, making the math appear to not add up.

---

## Findings

### HIGH — Duration parser handles only `Nm`, not `~Nm` (tilde-prefixed values)

- **Location**: Step 4, "parse `Nm` format to minutes"
- **Scenario**: `orchestrator-history.md` contains entries like `~104m`, `~3m`, `~8m`. These values exist in every Session block in the real history file.
- **Impact**: Total duration is silently understated. There is no error or warning — the tilde rows are either skipped or parsed as `NaN` and dropped.
- **Fix**: Explicitly define that `~Nm` values should strip the tilde and parse as approximate minutes. Add a note to the Total Duration row in the output: "(includes approximate values)".

### HIGH — Tilde-prefixed costs are not classified as real or not-real

- **Location**: Step 3 merge table, "Mark cost as `—` if no source has a real value"
- **Scenario**: `orchestrator-history.md` has `~$1.51`, `~$3.00`, `~$0.87`. These are common for session-block entries. Whether they count as "real" is undefined.
- **Impact**: Inconsistent totals across executions. The Cost Note denominator may be wrong.
- **Fix**: Define explicitly: tilde-prefixed values are treated as approximate real values and included in totals, but the Cost Note should mention "includes approximate values."

### HIGH — `orchestrator-history.md` Session block Task IDs are compound strings

- **Location**: Step 2, source 3 — "Extract: Task" from each entry's table
- **Scenario**: Session block worker table rows have Task column values like `TASK_2026_116` and Worker column values like `TASK_2026_116-REFACTORING-FIX (from paused)`. The command does not specify how to extract the task ID from a compound Worker name vs. the Task column.
- **Impact**: If the LLM reads the wrong column, it extracts garbage Task IDs. If it reads the correct Task column, it may still group entries incorrectly since the same Task ID can appear multiple times in a single session block.
- **Fix**: Clarify that Task ID extraction in Session blocks should use the `Task` column value verbatim (not the `Worker` column), and sum cost and duration for all rows sharing the same `Task` value within and across blocks.

### HIGH — `--since` filter is undefined for tasks sourced only from `orchestrator-history.md`

- **Location**: Step 1 and Step 2
- **Scenario**: A task exists in `orchestrator-history.md` but has no `session-analytics.md`. The `--since` filter cannot be applied because there is no `Start Time` field.
- **Impact**: Either these tasks always appear regardless of the `--since` boundary (inflated report) or they are silently excluded (undercount). Both are wrong.
- **Fix**: Add an explicit rule: for tasks with history data but no analytics file, use the orchestrator-history entry's session date/time as the date proxy for `--since` filtering, or explicitly exclude such tasks and note the exclusion count.

### MEDIUM — `Workers` fallback of 1 is incorrect for multi-worker tasks

- **Location**: Step 3 merge table, "Workers: 1 (assumed)"
- **Scenario**: Task TASK_2026_049 had 5 workers (Build, Cleanup, Review, Test, Completion). With MCP offline, the Workers column shows 1.
- **Impact**: The column is misleading. A user investigating cost spikes will underestimate complexity.
- **Fix**: When `orchestrator-history.md` has rows for a task, count the distinct rows per task as the Workers value instead of defaulting to 1. This requires a small additional logic branch but is significantly more accurate.

### MEDIUM — Outcome has no fallback source

- **Location**: Step 3 merge table — "Outcome: session-analytics.md, Fallback: orchestrator-history.md Result"
- **Scenario**: `orchestrator-history.md` Result column uses values like `COMPLETE`, `IMPLEMENTED`, `REVIEW_DONE`, `TEST_DONE (SKIP)`, `registry fixed` — not all of these are valid Outcome enum values.
- **Impact**: The Outcome column may display non-canonical values like `REVIEW_DONE` or `TEST_DONE (SKIP)` from history data. The display rule says "use the exact status enum values."
- **Fix**: Add a mapping rule: when using orchestrator-history Result as Outcome fallback, map `REVIEW_DONE`/`TEST_DONE`/`CLEANUP_DONE` to `IMPLEMENTED`, and `registry fixed` to `COMPLETE`. Everything else passes through.

### MEDIUM — Empty state fires even when `orchestrator-history.md` alone has data

- **Location**: Step 2, empty state condition
- **Scenario**: No `session-analytics.md` files, MCP offline, but `orchestrator-history.md` has 60 entries.
- **Impact**: User gets "No session analytics found" even though significant data exists.
- **Fix**: Change the empty state condition to: "If no `session-analytics.md` files exist AND `list_workers` returns no data AND `orchestrator-history.md` does not exist or is empty."

### MEDIUM — Outcome enum values in Totals are incomplete

- **Location**: Step 4, "Task count by outcome: count COMPLETE, IMPLEMENTED, FAILED, STUCK"
- **Scenario**: Tasks may have statuses: `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `CREATED`, `CANCELLED`.
- **Impact**: The Outcomes row in Project Totals silently omits these. Users see totals that do not add up to the task count.
- **Fix**: Either add "and any other statuses found" to the count instruction, or replace with "group and count all distinct Outcome values found."

### LOW — No timezone normalization rule for `--since` date comparison

- **Location**: Step 1, `--since` filter logic
- **Scenario**: `Start Time` values include timezone offsets like `+0200`. A `--since 2026-03-28` comparison is ambiguous.
- **Impact**: A task started at `2026-03-27 23:30:00 +0200` (UTC 21:30) may be included or excluded depending on how the LLM handles the offset. Minor inconsistency, not data loss.
- **Fix**: Add: "Compare dates in local time (strip timezone offset), using only the YYYY-MM-DD portion of Start Time."

### LOW — `--task` scope with no data produces unexplained near-empty table

- **Location**: Step 1, `--task` validation
- **Scenario**: Task folder exists, no analytics file, MCP offline, no history entry.
- **Impact**: User gets an empty per-task table with all `—` values and no explanation.
- **Fix**: Add: "If all data sources yield no rows for the specified task, output: `No data found for {TASK_ID}. Run the task under auto-pilot with nitro-cortex active to capture analytics.`"

### LOW — Scaffold copy is identical to source (correct)

- **Location**: `apps/cli/scaffold/.claude/commands/nitro-burn.md`
- **Status**: Files are byte-for-byte identical. This is correct per acceptance criteria.

---

## Data Flow Analysis

```
User invokes /nitro-burn [args]
        |
        v
Step 1: Argument parsing
  - No args: all tasks          OK
  - --since DATE: validate fmt  OK — but no TZ normalization rule
  - --task ID: validate folder  OK — but no data-absent fallback message
        |
        v
Step 2: Data collection (three sources)
  - MCP list_workers            OK — best-effort, failure documented
  - Glob session-analytics.md  OK — but no instruction for multi-run files
  - orchestrator-history.md    ISSUE: two structural formats (solo vs session block)
                                ISSUE: compound Task IDs in session blocks
        |
        v
Empty state check               ISSUE: ignores orchestrator-history.md as 3rd source
        |
        v
Step 3: Merge per task
  - Duration                    ISSUE: ~Nm tilde values not handled
  - Cost                        ISSUE: ~$X.XX tilde values not classified
  - Outcome fallback            ISSUE: non-canonical Result values from history
  - Workers fallback            ISSUE: 1 assumed, should count history rows
  - --since filter on history   ISSUE: no Start Time field available
        |
        v
Step 4: Totals
  - Duration sum                ISSUE: tilde values dropped or cause NaN
  - Token sum                   OK
  - Cost sum                    ISSUE: tilde costs unclear
  - Outcome counts              ISSUE: missing non-terminal status values
        |
        v
Step 5: Output                  OK — format and display rules are clear
```

Gap points:
1. Tilde-prefixed numeric values in duration and cost columns of `orchestrator-history.md` are not handled.
2. Session block rows in `orchestrator-history.md` have compound Worker names; Task ID extraction is ambiguous.
3. `--since` filter has no defined behavior for history-only tasks.
4. Empty state guard misses `orchestrator-history.md` as a standalone data source.
5. Non-terminal outcome values (`IN_PROGRESS`, `BLOCKED`, etc.) will not appear in Totals counting.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Command file created at correct paths | COMPLETE | Both files exist and are identical |
| Locates and reads session analytics files | COMPLETE | Glob instruction is correct |
| Output shows per-task token/cost breakdown | PARTIAL | Tilde cost ambiguity and Worker fallback inaccuracy |
| Output shows project totals | PARTIAL | Outcome count is incomplete; duration total breaks on tilde values |
| Graceful empty state | PARTIAL | Misses history-only scenario |
| Command is read-only | COMPLETE | "Do not modify any files" rule is explicit |

### Implicit Requirements NOT Addressed

1. **Multi-run tasks**: A task re-executed twice produces two sets of analytics. The command assumes one session per task.
2. **History-only tasks under `--since`**: Older tasks predating analytics files cannot be date-filtered.
3. **Tilde-approximate data**: Real production data uses `~` prefixes extensively. The command needs to handle this format.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| No analytics files, MCP online | YES | Proceeds with MCP data | OK |
| No analytics files, MCP offline | PARTIAL | Triggers empty state | Ignores orchestrator-history.md |
| Duration value is `~104m` | NO | — | Silent drop or NaN |
| Cost value is `~$1.51` | NO | — | Undefined behavior |
| Task appears in both history formats | NO | — | Double-count risk |
| `--since` on history-only task | NO | — | Undefined inclusion/exclusion |
| Task has no Outcome source | PARTIAL | Falls back to history | Non-canonical Result values |
| Invalid `--task` with no data | PARTIAL | Reports empty table | No explanation shown |
| Timezone edge cases in `--since` | NO | — | Minor inconsistency |

---

## Verdict

**Recommendation**: PASS_WITH_NOTES

**Confidence**: HIGH

**Top Risk**: The tilde-prefixed duration/cost values in `orchestrator-history.md` are so pervasive in the real data (present in every Session block) that any execution against a live repository will produce incorrect totals silently. This is the single highest-priority fix before this command is used to investigate cost spikes.

The command's structure, security posture, and happy-path flow are well-designed. The issues are logic gaps in parsing rules, not architectural problems. All can be addressed with targeted additions to the existing step instructions.

---

## What Robust Implementation Would Include

- An explicit "tilde-stripping" pre-processing rule applied to all numeric fields read from `orchestrator-history.md`, with a note added to the output indicating approximate values were included.
- A canonical definition of "real cost value": any numeric value (with or without tilde prefix) that is not the literal string `unknown`.
- A `Task ID extraction rule` for Session blocks: always use the `Task` column, never the `Worker` column; strip nothing.
- A `--since` fallback rule: for tasks with no analytics file, use the Session block's header timestamp as the date proxy.
- A multi-sentinel Outcome mapping table covering all Result values found in the real `orchestrator-history.md`.
- An updated empty state condition that covers the history-only scenario.
- Worker count fallback derived from history row counts, not a hardcoded 1.
