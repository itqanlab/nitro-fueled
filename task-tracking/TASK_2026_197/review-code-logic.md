# Code Logic Review — TASK_2026_197

## Score: 7/10

## Review Summary

| Metric              | Value            |
| ------------------- | ---------------- |
| Overall Score       | 7/10             |
| Assessment          | NEEDS_REVISION   |
| Critical Issues     | 1                |
| Serious Issues      | 2                |
| Moderate Issues     | 2                |
| Minor Issues        | 2                |
| Failure Modes Found | 4                |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `unblocked` path in `handleGetTasks` runs a **separate, unlimited** `SELECT id FROM tasks WHERE status = 'COMPLETE'` query on line 91 that is **not subject to the `limit` parameter at all**. This means the limit guard only applies to the initial `rows` fetch; the complete-task set used for dependency resolution is unbounded. On a large project with hundreds of COMPLETE tasks, this secondary query produces a large in-memory `Set` on every call. The fix is superficially in place (the primary SELECT is capped) but the original overflow vector — a `WHERE status = 'COMPLETE'` read — still exists inside the function body.

### 2. What user action causes unexpected behavior?

A supervisor calling `get_tasks({ unblocked: true, limit: 5 })` with the intent to get "5 unblocked tasks" will silently get fewer than 5 results. Because `limit` is applied to the initial `rows` query before the unblocked filter, the cap prunes the candidate pool first. The dependency resolver then further filters that already-pruned set. If the first 5 rows by `ORDER BY id` all have unsatisfied dependencies, the caller receives 0 unblocked tasks even though unblocked tasks exist further down the list. There is no documentation, no warning, and no test covering this interaction.

### 3. What data makes this produce wrong results?

- A project where tasks `TASK_2026_001` through `TASK_2026_100` all have unsatisfied dependencies, and `TASK_2026_101` is the first unblocked task: calling `get_tasks({ unblocked: true, limit: 10 })` returns an empty array even though unblocked tasks exist. The result is logically incorrect — the API contract implied by the description "return only unblocked tasks" is broken when `limit` is also specified.
- A floating-point value passed as `limit` (e.g., `2.9`): `Math.trunc(2.9)` = 2, which is correct, but `Math.trunc(-0.5)` = 0, which then gets clamped to 1 by `Math.max(1, ...)`. This is safe, but the behavior is surprising for negative inputs — the schema's `min(1)` constraint at the MCP layer prevents this for external callers, but the function itself accepts any number directly.

### 4. What happens when dependencies fail?

- If the secondary `SELECT id FROM tasks WHERE status = 'COMPLETE'` call (line 91) throws — e.g., due to SQLite BUSY or a schema mismatch — the exception propagates uncaught out of `handleGetTasks`. The MCP server does not wrap tool handlers in a try/catch at the registration level. This results in an unhandled exception that crashes the handler and returns no response to the caller, which the Supervisor interprets as an MCP tool failure and may incorrectly set `cortex_available = false`.
- The primary `db.prepare(...).all(...)` call on line 87 similarly has no error handling. A malformed `args.status` string that passes Zod validation (which it cannot, given the enum) but somehow reaches the handler via a direct call in tests would go unguarded; the test inserts tasks directly so this is a low-probability path in tests, but it is a structural gap.

### 5. What's missing that the requirements didn't mention?

- **`unblocked + limit` interaction semantics are undefined.** The requirement says "add a `limit` param." It does not specify whether `limit` applies before or after the unblocked filter. The current implementation applies it before, which is less useful and creates the wrong-results case above. The correct semantic for a supervisor asking "give me 5 unblocked tasks" is to filter first, then limit.
- **No default limit when no limit is specified and no status filter is set.** The description says "default unlimited." A `get_tasks()` call with no arguments against a 500-task project returns all 500 rows unbounded. The original problem this task was created to solve — overflow on large COMPLETE sets — is only fixed when the caller explicitly requests a limit. An agent that forgets to pass `limit` hits the same overflow.
- **`parallel-mode.md` Step 2 still instructs calling `get_tasks(status=[...all statuses...])` without a limit.** This is the broadest possible query — all tasks, all statuses. On a 500-task project, this still returns everything. The guidance fixed Step 7 (`get_tasks(status: "COMPLETE")`) but did not add a `limit` recommendation to the Step 2 bulk read, which is the actual high-frequency supervisor call.

---

## Failure Mode Analysis

### Failure Mode 1: `unblocked` filter interacts incorrectly with `limit`

- **Trigger**: Caller passes `{ unblocked: true, limit: N }` where N is smaller than the number of tasks with unresolved dependencies.
- **Symptoms**: Returns fewer unblocked tasks than exist, or returns zero even though unblocked tasks are present. Supervisor may stall or spawn fewer workers than expected.
- **Impact**: Supervisor underutilizes parallelism, tasks sit idle, no error is surfaced.
- **Current Handling**: None. The function silently returns the wrong answer.
- **Recommendation**: Apply `limit` after the unblocked filter, not before. This matches the semantic implied by the API description.

### Failure Mode 2: Unbounded secondary COMPLETE query inside `unblocked` path

- **Trigger**: Caller passes `{ unblocked: true }` on a project with 500+ COMPLETE tasks and no `limit`.
- **Symptoms**: The fix for the COMPLETE overflow (the primary `SELECT` LIMIT clause) does not apply to the secondary `SELECT id FROM tasks WHERE status = 'COMPLETE'` query on line 91. This secondary query is completely unbounded.
- **Impact**: On large projects, every `unblocked` call fetches all COMPLETE task IDs into memory regardless of the `limit` argument. The original overflow vector is still present on this code path.
- **Current Handling**: None. The secondary query has no cap.
- **Recommendation**: The secondary COMPLETE query should also be bounded, or the dependency resolution should be done in SQL using a JOIN/subquery rather than fetching all COMPLETE IDs into a JS Set.

### Failure Mode 3: No default cap on unlimited `get_tasks()` calls

- **Trigger**: Supervisor calls `get_tasks()` with no `limit` (the common case in Steps 1, 2, 8 of parallel-mode).
- **Symptoms**: Returns all tasks in the DB, unbounded. On a large project this is the same token overflow the task was created to prevent, just triggered via any status-unfiltered call rather than a COMPLETE-filtered one.
- **Impact**: Context window overflow, slow response, high memory use.
- **Current Handling**: None. `limit` is optional; when absent, no cap is applied.
- **Recommendation**: Set a sensible default (e.g., 500) and document it. Or add a prominent warning in the tool description when no limit is provided.

### Failure Mode 4: Uncaught SQLite exceptions from `handleGetTasks`

- **Trigger**: SQLite throws SQLITE_BUSY, SQLITE_LOCKED, or SQLITE_CORRUPT during either the primary or secondary query.
- **Symptoms**: Exception propagates to the MCP SDK handler, which may send an error frame or crash the handler. The Supervisor may see a tool-call failure and mark `cortex_available = false`, falling back to expensive file-based reads.
- **Current Handling**: None. No try/catch in `handleGetTasks`.
- **Recommendation**: Wrap both queries in try/catch; return a structured error response rather than letting the exception bubble.

---

## Critical Issues

### Issue 1: `unblocked + limit` returns semantically wrong results

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:84-103`
- **Scenario**: `handleGetTasks(db, { unblocked: true, limit: 5 })` when first 5 rows by `ORDER BY id` all have unsatisfied dependencies.
- **Impact**: Returns 0 results even though unblocked tasks exist. Supervisor stalls, no error raised. This is a silent correctness failure.
- **Evidence**: Line 84 computes `limit` and applies it via `LIMIT ?` in the SQL on line 87. The unblocked filter on lines 89-103 then operates on `rows` (the already-limited set). Filtering after limiting breaks the "at most N unblocked tasks" semantic.
- **Fix**: Move the `limitClause` application to after the unblocked filter, or restructure: fetch all rows matching the non-unblocked filters, apply the unblocked post-filter, then slice to `limit`.

---

## Serious Issues

### Issue 2: Secondary COMPLETE query in `unblocked` path is unbounded

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:90-92`
- **Scenario**: Any call with `unblocked: true` on a project with hundreds of COMPLETE tasks.
- **Impact**: The exact overflow this task was created to prevent still occurs on the `unblocked` path. The `limit` added on line 84 does not apply to this query.
- **Evidence**: `db.prepare("SELECT id FROM tasks WHERE status = 'COMPLETE'").all()` — no LIMIT clause, no cap, no reference to `args.limit`.
- **Fix**: Either add `LIMIT 1000` (or a higher internal cap) to this query, or rewrite the dependency resolution as a SQL JOIN so the COMPLETE set never needs to be materialized in JS.

### Issue 3: Step 2 of `parallel-mode.md` still calls `get_tasks()` without a limit

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md:67`
- **Scenario**: Supervisor executing Step 2 on every loop tick against a large project.
- **Impact**: The highest-frequency supervisor call — the Step 2 full task-roster read — has no limit guidance. The fix targets Step 7 (COMPLETE-filtered reconciliation) but not Step 2. An agent following the spec will still fetch all tasks on every tick.
- **Evidence**: Step 2 reads: `Call get_tasks(status=['CREATED', 'IMPLEMENTED', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETE', 'CANCELLED'])` with no `limit` argument shown or recommended.
- **Fix**: Add `limit: 500` (or project-appropriate cap) to the Step 2 example call, with a note explaining that projects exceeding this should paginate or use targeted status filters.

---

## Moderate Issues

### Issue 4: No test for `unblocked + limit` interaction

- **File**: `packages/mcp-cortex/src/tools/tasks.spec.ts`
- **Scenario**: The critical failure mode (Issue 1) has zero test coverage.
- **Impact**: The bug can ship and regress silently. The two new tests cover only the happy path (limit respected) and the cap (9999 clamped to 200) — neither exercises the `unblocked` filter.
- **Fix**: Add a test: insert 5 tasks with unmet dependencies and 2 without. Call `handleGetTasks(db, { unblocked: true, limit: 3 })`. Assert 2 results are returned (all unblocked tasks), not 0 (which is what the current code produces if the 3 limited rows all have deps).

### Issue 5: `Math.trunc` on float `limit` is safe but undocumented

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:84`
- **Scenario**: Direct internal callers (e.g., tests) pass a float like `2.7`.
- **Impact**: `Math.trunc(2.7)` = 2; the caller may be surprised. The schema enforces `z.number().int()` for MCP callers, but the function signature accepts `number` without enforcing integer type. This is a mismatch between the schema constraint and the function contract.
- **Fix**: Either change the function signature to narrow `limit` to `number` with a JSDoc `@param` note, or validate `Number.isInteger(args.limit)` inside the handler and return an error.

---

## Minor Issues

### Minor 1: Scaffold sync appears correct but adds drift risk

- **Files**: `apps/cli/scaffold/.claude/skills/auto-pilot/references/cortex-integration.md` and `parallel-mode.md`
- **Observation**: The scaffold files are byte-for-byte identical to the `.claude/` originals. The sync is correct for this commit. However, there is no automated check that keeps these in sync — a future change to `.claude/skills/` that misses the scaffold copy will silently create divergence. This is a maintenance risk, not a code defect.
- **Recommendation**: Add a CI check (e.g., `diff -r .claude/skills/auto-pilot/references/ apps/cli/scaffold/.claude/skills/auto-pilot/references/`) to catch divergence early.

### Minor 2: Tool description for `limit` says "default unlimited" — accurate but dangerous

- **File**: `packages/mcp-cortex/src/index.ts:49`
- **Observation**: `describe('Max tasks to return (default unlimited, max 200)')` — the max 200 stated in the description matches the implementation. However, "default unlimited" is a footgun for agents and humans: it signals that omitting `limit` is a safe default, when in fact it may return thousands of rows.
- **Recommendation**: Change to "default: all matching rows (no cap unless specified); use limit=200 for large datasets".

---

## Data Flow Analysis

```
Caller: handleGetTasks(db, { status?, type?, priority?, unblocked?, limit? })
  |
  v
[Line 84] limit = args.limit !== undefined
            ? Math.min(Math.max(1, Math.trunc(args.limit)), 200)
            : undefined
  |
  v
[Line 87] SELECT * FROM tasks WHERE [...] ORDER BY id [LIMIT ?]
           <- limit applied HERE (primary filter)
  |
  v
[If unblocked == true]
  |
  +--> [Line 91] SELECT id FROM tasks WHERE status = 'COMPLETE'
  |              <- NO LIMIT — unbounded secondary query (BUG: failure mode 2)
  |
  +--> [Lines 93-103] JS filter: rows.filter(row => deps all in completeTasks)
                      <- operates on already-limited `rows` (BUG: failure mode 1)
                         correct semantic: filter THEN limit
  |
  v
[Return] JSON.stringify(filtered | rows)
```

Gap points identified:
1. Secondary COMPLETE query bypasses the limit entirely.
2. `limit` is applied to the wrong stage when `unblocked = true` — limit should come after the dependency filter.
3. No error handling around either SQLite query — exceptions propagate uncaught.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Add `limit` param to `get_tasks` and `query_tasks` | COMPLETE | Correctly bounded 1-200 |
| SQL `LIMIT` clause applied | COMPLETE | Applied on primary SELECT |
| Cap at 200 enforced in handler | COMPLETE | `Math.min(..., 200)` on line 84 |
| Zod schema updated for both tools | COMPLETE | Both tools have `z.number().int().min(1).max(200)` |
| Tests for requested and capped limits | COMPLETE | Two tests added |
| Single-task checks moved to `get_task_context` | COMPLETE | Step 7a and parallel-mode updated |
| Scaffold sync | COMPLETE | Files are identical to source |
| `unblocked + limit` interaction correct | MISSING | Limit applied before filter — wrong semantic |
| Unbounded secondary COMPLETE query addressed | MISSING | `unblocked` path still unlimited |
| Step 2 bulk query gets limit guidance | MISSING | Highest-frequency call still has no limit |

### Implicit Requirements NOT Addressed:
1. `get_tasks()` with no arguments and no status filter is still unbounded — the original overflow is only partially solved.
2. The `unblocked` path's secondary COMPLETE query was an implicit overflow source; it was not considered in scope but remains exploitable.
3. Guidance for Step 2 of the supervisor loop (the per-tick full task read) needed a limit recommendation as much as Step 7 did.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| `limit` = 1 | YES | `Math.max(1, ...)` clamps to 1 | Correct |
| `limit` = 200 | YES | Passes through unchanged | Correct |
| `limit` = 9999 | YES | Clamped to 200 | Test confirms this |
| `limit` = 0 | YES | Clamped to 1 | Surprising but not breaking |
| `limit` = undefined | YES | No LIMIT clause added | Still unbounded — intended but risky |
| `limit` = 2.9 (float) | PARTIAL | `Math.trunc` → 2 | Works; schema prevents externally |
| `unblocked + limit` | NO | Limit applied before filter | Returns wrong count |
| `unblocked` with 500+ COMPLETE tasks | NO | Secondary query is unbounded | Original overflow still present |
| SQLite BUSY during query | NO | No try/catch | Uncaught exception |
| Empty DB (no tasks) | YES | Returns empty array | Correct |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Primary SELECT with LIMIT | LOW | Controlled result size | Working correctly |
| Secondary COMPLETE SELECT (unblocked path) | MEDIUM on large projects | Unbounded, same overflow as pre-fix | None currently |
| MCP schema → handler type coercion | LOW | Zod enforces int/min/max | Schema and handler aligned |
| Supervisor Step 2 `get_tasks()` bulk read | MEDIUM | Still unbounded by default | Limit guidance not added to Step 2 |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The `unblocked + limit` interaction is logically inverted — `limit` prunes the candidate pool before the dependency filter runs, which can return zero results even when unblocked tasks exist. On a project where the supervisor uses `get_tasks({ unblocked: true, limit: N })` to find its next batch, this silently causes stalls with no error. This plus the still-unbounded secondary COMPLETE query inside the `unblocked` path mean the core overflow problem is only partially fixed.

## What Robust Implementation Would Include

- `limit` applied after the `unblocked` filter, not before — or a SQL-native dependency check that avoids the two-pass approach entirely.
- A bounded secondary query for COMPLETE task IDs (or a JOIN-based SQL alternative that avoids materializing the full COMPLETE set in JS).
- A default cap (e.g., 500) on unbounded `get_tasks()` calls, with a warning in the description.
- Step 2 in `parallel-mode.md` updated with an explicit `limit` recommendation to prevent per-tick overflow on large projects.
- Tests for: `unblocked + limit` interaction, `unblocked` with all tasks blocked, and the clamping behavior with float inputs.
- try/catch around both SQLite queries in `handleGetTasks` with a structured error response.
