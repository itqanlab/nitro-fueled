# Code Style Review — TASK_2026_197

## Score: 6/10

## Review Summary

| Metric          | Value                                    |
| --------------- | ---------------------------------------- |
| Overall Score   | 6/10                                     |
| Assessment      | NEEDS_REVISION                           |
| Blocking Issues | 1                                        |
| Serious Issues  | 3                                        |
| Minor Issues    | 4                                        |
| Files Reviewed  | 7                                        |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`packages/mcp-cortex/src/tools/tasks.ts:84–103` — When `unblocked=true` is combined with a `limit`, the limit is applied to the *pre-filter* row set, not the post-filter result. A caller asking for `limit: 10, unblocked: true` with 20 tasks in the DB (5 unblocked) could receive 0 results if the 10 rows SQL returns happen to all be blocked. This is a semantic contract mismatch between what the parameter name implies and what the implementation delivers. The behavior will confuse a future supervisor that relies on `get_next_wave` falling back to `get_tasks(unblocked: true, limit: N)`.

### 2. What would confuse a new team member?

`tasks.ts:84` — The limit guard chain is written as a single expression:
```
Math.min(Math.max(1, Math.trunc(args.limit)), 200)
```
There is no comment explaining the three-part purpose: floor at 1 (reject zero/negative), truncate to integer (reject floats even though Zod already validated int), cap at 200. Compare with `events.ts:74` which has an inline comment `// Undefined limit → default 500. Explicit limit (including 0) → capped at 1000.` The tasks.ts equivalent has no comment at all.

Separately, `cortex-integration.md` Step 7a instruction "If a broad `get_tasks()` read is needed for reconciliation, pass a small `limit` to avoid oversized responses" does not define what "small" means. The task caps at 200 — but the guidance leaves the reader guessing. No concrete example number is given.

### 3. What's the hidden complexity cost?

The limit semantics differ meaningfully between the two tools that now accept it:

- `get_tasks` / `query_tasks`: `limit` is optional, default is *unlimited*, bounded 1–200.
- `query_events`: `limit` is optional, default is 500, bounded 0–1000.

These two APIs sit side-by-side in `index.ts` but their limit semantics are inconsistent. The default-unlimited behavior of `get_tasks` is the correct choice for the overflow fix (the caller opts in), but it diverges from `query_events` pattern. A future developer adding a new tool will look at both and pick one at random. The divergence is not documented anywhere.

### 4. What pattern inconsistencies exist?

`tasks.ts:85–86` introduces two intermediate variables (`limitClause`, `queryParams`) that exist only to build the SQL string and params array. The existing `events.ts:74–80` avoids this by always pushing limit to params (defaulting when not provided) and keeping a single `LIMIT ?` in the query string. The `tasks.ts` approach is legitimate given "default unlimited" semantics, but the two patterns now coexist without explanation.

`cortex-integration.md` Step 1 (Compaction Recovery) is listed *after* Steps 2–7d in the document ordering, even though it is functionally a pre-step. This was pre-existing but the task did not align it despite touching the file.

### 5. What would I do differently?

1. Apply the limit to the *post-filter* result when `unblocked=true`, or document explicitly that the limit applies pre-filter and update the Zod schema description accordingly.
2. Add a comment above the limit guard line in `tasks.ts:84` matching the style in `events.ts:74`.
3. In `cortex-integration.md` Step 7a, replace "pass a small `limit`" with a concrete example: "e.g., `limit: 50`".
4. Add a test case that exercises `unblocked: true` with a `limit` to lock in the actual behavior (pre-filter or post-filter) as a contract.

---

## Blocking Issues

### Issue 1: `limit` applies pre-filter when `unblocked=true`, producing silently truncated results

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:84–103`
- **Problem**: The SQL `LIMIT ?` is applied to the initial `SELECT * FROM tasks` query. When `unblocked=true`, the code then filters the returned `rows` array by dependency resolution. If the SQL limit returns, say, 5 rows and all 5 are blocked, the caller receives 0 results — even when 50 unblocked tasks exist in the DB. There is no error or indication of truncation.
- **Impact**: A supervisor using `get_tasks(unblocked: true, limit: 20)` as a fallback for `get_next_wave` could see an empty list and halt, despite CREATED tasks being available. Silent incorrect behavior under a specific argument combination is a production correctness risk.
- **Fix**: Either (a) apply the limit post-filter by slicing `filtered` instead of adding `LIMIT ?` to the SQL when `unblocked` is true, or (b) document the pre-filter semantic clearly in the Zod schema description and add a test that asserts it, so the behavior is intentional rather than accidental.

---

## Serious Issues

### Issue 1: Missing test for `unblocked + limit` interaction

- **File**: `packages/mcp-cortex/src/tools/tasks.spec.ts`
- **Problem**: The two new test cases cover `limit` in isolation. No test exercises the `unblocked: true` + `limit` combination, which is the exact edge case with the pre-filter ambiguity described in the blocking issue. The behavior is untested and could silently regress.
- **Tradeoff**: Adding a test would either expose the pre-filter bug or document the pre-filter intent. Either outcome is better than the current silence.
- **Recommendation**: Add a test that inserts 3 tasks with satisfied deps and 3 with unsatisfied deps, calls `handleGetTasks(db, { unblocked: true, limit: 2 })`, and asserts the result contains 2 unblocked tasks — not 2 pre-filter rows minus blocked ones.

### Issue 2: No lower-bound test for `limit` parameter

- **File**: `packages/mcp-cortex/src/tools/tasks.spec.ts:91–124`
- **Problem**: Tests cover requested limit (2) and over-max limit (9999 capped to 200). Neither covers limit=0 or limit=-1 (both should clamp to 1 per `Math.max(1, ...)`) or limit=1 (boundary). The cap behavior at 200 is tested; the floor behavior at 1 is untested. The Zod schema on the MCP side enforces `min(1)`, but `handleGetTasks` is called directly in tests and is also callable internally — the floor guard in the function itself is untested.
- **Tradeoff**: Low risk with Zod in place, but direct internal callers bypass Zod.
- **Recommendation**: Add a test: `handleGetTasks(db, { limit: 0 })` and assert it returns at most 1 row (floor clamped to 1), matching the guard's intent.

### Issue 3: `get_tasks` description says "default unlimited" but does not warn about overflow risk

- **File**: `packages/mcp-cortex/src/index.ts:43–51`
- **Problem**: The `limit` field description reads: `'Max tasks to return (default unlimited, max 200)'`. A caller reading this sees "default unlimited" and may knowingly omit `limit` for a full-roster read — but at 500+ COMPLETE tasks, this is exactly the overflow scenario the task was built to prevent. The description gives no guidance on *when* to use `limit`. Compare with the `query_events` description which has no "unlimited" framing — it always defaults to 500.
- **Tradeoff**: Documenting the risk in the schema description costs nothing and reaches every LLM that inspects the tool.
- **Recommendation**: Change the description to: `'Max tasks to return (1–200). Omit only for small registries; always set limit when filtering status: "COMPLETE" or fetching the full roster to avoid oversized responses.'`

---

## Minor Issues

1. **`tasks.ts:86` — Spread creates an unnecessary array copy**: `[...params, limit]` allocates a new array each call. `events.ts:75` avoids this by pushing directly to `params`. Negligible in practice but inconsistent.

2. **`cortex-integration.md` Step 7a — "pass a small `limit`" is vague**: The guidance says to pass a "small `limit`" with no example value. Autonomous agents parse instructions literally. A concrete example ("e.g., `limit: 50`") is needed. Both the runtime copy and scaffold copy share this vagueness.

3. **`parallel-mode.md` Step 7.4 — "always provide a bounded `limit`" is not linked to a value**: Same problem as above but in `parallel-mode.md`. The word "bounded" implies any limit satisfies the requirement. An agent could pass `limit: 200` (the max) when the intent is a small sample for reconciliation. Consider "a small bounded `limit` (e.g., 20–50)" to be actionable.

4. **`tasks.spec.ts:115–122` — loop uses `+= 1` instead of `++`**: The loop `for (let i = 0; i < 210; i += 1)` is a style divergence from idiomatic JavaScript. The rest of the codebase uses `i++` in similar loops. Minor but inconsistent.

---

## File-by-File Analysis

### `packages/mcp-cortex/src/tools/tasks.ts`

**Score**: 6/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The limit feature is added with correct parameterized SQL (`LIMIT ?` via `queryParams`), matching the project rule from `review-general.md`. The Math guard chain is functionally correct. The blocking issue is that `unblocked` filtering happens after the SQL limit, meaning the limit is pre-filter rather than post-filter. This is semantically wrong for the intended use case (get N unblocked tasks) and produces silent truncation. The intermediate variable pattern (`limitClause`, `queryParams`) is readable but inconsistent with `events.ts` style.

**Specific Concerns**:
1. `line 84–103`: `limit` applied pre-filter, then `unblocked` filter applied in-memory on the already-limited set.
2. `line 86`: Spread creates a new array; `events.ts:75` pushes directly. Inconsistent style.

### `packages/mcp-cortex/src/index.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: `limit` Zod schema is correctly added to both `get_tasks` and `query_tasks` registrations with matching constraints (`int().min(1).max(200)`). The alias (`query_tasks`) correctly delegates to `handleGetTasks` with the full args. The only concern is the description text for `limit` which advertises "default unlimited" without any guidance on when to avoid omitting it.

### `packages/mcp-cortex/src/tools/tasks.spec.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: Two new test cases are added and they cover the primary happy path (requested limit) and overflow cap (9999 → 200). However the `unblocked + limit` combination — the exact scenario that motivated the task — has no test. The floor boundary (limit=0 or limit=1) is also uncovered. The test helper `insertTaskWithStatus` is cleanly extracted, which is good.

**Specific Concerns**:
1. No test for `unblocked: true` + `limit` interaction.
2. No test for limit floor (0 or negative → clamped to 1).
3. `line 115`: `i += 1` vs idiomatic `i++`.

### `.claude/skills/auto-pilot/references/cortex-integration.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

**Analysis**: Step 7a correctly redirects single-task checks to `get_task_context(task_id)` and explicitly forbids `get_tasks(status: "COMPLETE")` for verification. This is the primary behavioral change and it is stated clearly. The "pass a small `limit`" guidance is vague for autonomous agents.

### `apps/cli/scaffold/.claude/skills/auto-pilot/references/cortex-integration.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Byte-for-byte identical to the runtime copy, which is correct scaffold sync behavior. Same "small `limit`" vagueness carries over.

### `.claude/skills/auto-pilot/references/parallel-mode.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Step 7.4 correctly replaces the old single-task status check with `get_task_context(task_id)` and explicitly adds "Avoid `get_tasks(status: \"COMPLETE\"))`". The instruction at the end of Step 7.4 to "always provide a bounded `limit`" is present but lacks a concrete number.

### `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Identical to the runtime copy. Scaffold sync is correct.

---

## Pattern Compliance

| Pattern                            | Status | Concern                                                  |
| ---------------------------------- | ------ | -------------------------------------------------------- |
| Parameterized SQL (LIMIT clause)   | PASS   | `LIMIT ?` used, value in params array                    |
| Type safety (no `any`)             | PASS   | `unknown[]` for params                                   |
| Zod schema matches handler args    | PASS   | Both `get_tasks` and `query_tasks` have matching schemas |
| Limit semantics consistency        | FAIL   | `get_tasks` default=unlimited vs `query_events` default=500 — undocumented divergence |
| Test coverage for new behavior     | FAIL   | `unblocked + limit` interaction untested                 |
| Doc guidance concrete (no vague terms) | FAIL | "small limit" without an example value                  |

---

## Technical Debt Assessment

**Introduced**:
- Pre-filter limit semantics for `unblocked=true` is now baked in. If this is intentional, it must be documented. If accidental, fixing it later requires a behavior change that may break callers who adapted to the incorrect behavior.
- "Default unlimited" description for `get_tasks.limit` sets an expectation that the tool is safe to call without a limit, which contradicts the task's stated goal.

**Mitigated**:
- The immediate overflow risk for `get_tasks(status: "COMPLETE")` is addressed by the guidance changes in `cortex-integration.md` and `parallel-mode.md`.
- The SQL layer is now gated with a `LIMIT ?` parameter when called with a limit argument.

**Net Impact**: Slight debt increase. The mechanism is correct but the `unblocked + limit` interaction creates a behavioral trap that is currently invisible to callers.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `limit` is applied pre-filter in the `unblocked=true` code path, which silently under-delivers results. A supervisor calling `get_tasks(unblocked: true, limit: 20)` with a registry of 100 tasks where the first 20 alphabetically are all blocked would receive 0 results. This is the exact scenario the task is meant to protect against in reverse — an overflow prevention mechanism that instead causes a starvation defect under specific conditions.

---

## What Excellence Would Look Like

A 9/10 implementation would:
1. Apply `limit` post-filter when `unblocked=true` (slice `filtered` not `rows`), or explicitly document the pre-filter semantic with a clear Zod description and a test that asserts the truncation behavior.
2. Add a test that combines `unblocked: true` with `limit`, covering the exact scenario that motivated the task.
3. Add a boundary test for `limit=0` to prove the floor guard works.
4. Replace "pass a small `limit`" in the guidance docs with a concrete example number.
5. Add an inline comment on `tasks.ts:84` matching the style of the analogous comment in `events.ts:74`.
