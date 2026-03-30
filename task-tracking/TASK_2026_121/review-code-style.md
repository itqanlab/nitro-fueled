# Code Style Review — TASK_2026_121

## Score: 6/10

## Review Summary

| Metric          | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Overall Score   | 6/10                                                         |
| Assessment      | NEEDS_REVISION                                               |
| Blocking Issues | 3                                                            |
| Serious Issues  | 7                                                            |
| Minor Issues    | 6                                                            |
| Files Reviewed  | 8                                                            |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `WorkerRow` interface in `workers.ts:13-32` duplicates fields from the schema but
uses weaker types (`string` instead of union types like `WorkerType`, `WorkerStatus`,
`ProviderType`). When new statuses or providers are added to the schema, `WorkerRow`
will silently accept invalid values and produce wrong health decisions. The `getHealth`
function at `workers.ts:46` makes decisions based on these string fields with no
compile-time enforcement.

The `contextPercent` calculation in `jsonl-watcher.ts:179` divides input tokens by
1,000,000 to derive a percentage. A worker with a 200k-token context window would show
20% — not its actual usage. The denominator is not the model's context window; it is a
hardcoded constant. This will produce systematically misleading health assessments when
`getHealth` uses `context_percent > 80` to flag high-context state.

### 2. What would confuse a new team member?

`handleGetPendingEvents` in `subscriptions.ts:190` has the most opaque single-line
function in the codebase. The JSON serialization varies the arguments to
`JSON.stringify` based on whether events exist — it conditionally applies indentation
only when there are events. This is not documented and the motivation (token savings?)
is non-obvious. A new developer modifying this line is likely to normalize it and
accidentally break the output format.

The `SessionAccumulator` interface in `jsonl-watcher.ts:23-39` uses `endTurnAt: number
| null` as a dual-purpose sentinel: `null` means "not ended", a number means "ended at
this timestamp, start the 10-second auto-close countdown". This is not named or
documented. The `autoCloseTriggered` boolean alongside it is equally undocumented. The
invariant they together enforce (kill the process at most once, 10s after end_turn) is
only inferrable by reading `pollAll`.

### 3. What's the hidden complexity cost?

`jsonl-watcher.ts` accumulates token totals differently depending on message type. For
`result` messages (lines 116-119), it overwrites the running totals (`acc.totalInput =
...`). For `assistant` messages (lines 130-133), it increments them (`acc.totalInput +=
...`). A worker that emits a `result` message partway through its run will have its
totals reset to only that message's values. This is intentional for stream-json output
mode, but the discrepancy is invisible at the call site and will confuse anyone adding
a new message type handler.

The `FileWatcher` class in `subscriptions.ts` sets `sub.satisfied = true` before
evaluating the condition (`onEvent` at line 85), and resets it to `false` if the
condition is not met (line 148). This means concurrent file-change events may pass the
early-return guard (`if (sub.satisfied) return`) and be silently dropped. The guard
prevents duplicate evaluations from the same condition, but its reset path (`satisfied
= false`) is only reached in the async `evaluateCondition` path, not immediately. Under
rapid file changes this could drop real events.

### 4. What pattern inconsistencies exist?

Two different `ToolResult` type definitions are declared — identically — in both
`sessions.ts:5` and `workers.ts:8`. The existing `tasks.ts` file uses the type inline
without declaring it at all (`{ content: Array<{ type: 'text'; text: string }> }`).
Three files, three approaches to the same structural type.

`sessions.ts` imports `randomUUID` from `node:crypto` at line 2 but never uses it. The
UUID for sessions is generated differently — via a timestamp-based string at line 15.
Meanwhile `workers.ts` correctly uses `randomUUID` for worker IDs. The import in
`sessions.ts` is dead code that signals an incomplete design (sessions probably should
use UUID for consistency).

`WorkerType`, `WorkerStatus`, `ProviderType`, and `LauncherMode` are defined in
`schema.ts` as type aliases, but `WorkerRow` in `workers.ts` redeclares all of these
as `string`. The type system provides zero enforcement at the point where these values
are actually read and acted upon.

### 5. What would I do differently?

- Extract `ToolResult` to a shared `types.ts` in `tools/`, import it everywhere.
- Replace `WorkerRow.status`, `WorkerRow.worker_type`, `WorkerRow.provider`,
  `WorkerRow.launcher` with the already-defined union types from `schema.ts`.
- Replace the `contextPercent` calculation with actual model context window lookup
  (or at minimum document the approximation with its known limitations).
- Name the `endTurnAt + autoCloseTriggered` pair with a comment block explaining the
  state machine it encodes.
- Remove the dead `randomUUID` import from `sessions.ts`.

---

## Blocking Issues

### Issue 1: Dead import — `randomUUID` imported but never used in `sessions.ts`

- **File**: `packages/mcp-cortex/src/tools/sessions.ts:2`
- **Problem**: `import { randomUUID } from 'node:crypto'` is present but `randomUUID`
  is never called. The session ID is constructed via a date-format string at line 15,
  not `randomUUID`. This is dead code.
- **Impact**: Misleads readers into thinking sessions use UUID-format IDs (they do
  not). Workers and sessions use different ID schemes with no comment explaining the
  intentional divergence. This will cause confusion when a developer needs to look up a
  session by ID in the DB.
- **Fix**: Remove the unused import. If session IDs should be UUID-format (which would
  be more consistent with `worker_id`), switch to `randomUUID()` and remove the date
  string. Either decision is fine; pick one and make it explicit.

### Issue 2: Duplicate `ToolResult` type defined in two files, inconsistent with a third

- **File**: `packages/mcp-cortex/src/tools/sessions.ts:5` and
  `packages/mcp-cortex/src/tools/workers.ts:8`
- **Problem**: The type `type ToolResult = { content: Array<{ type: 'text'; text:
  string }> }` is declared identically in two separate files. `tasks.ts` uses the same
  structure inline without naming it. Three files, three approaches to the same
  contract.
- **Impact**: When the MCP protocol response shape changes, it must be updated in
  multiple places. TypeScript will not detect that `sessions.ts` and `workers.ts` have
  drifted from `tasks.ts` because they are structurally compatible but declared
  separately.
- **Fix**: Create `packages/mcp-cortex/src/tools/types.ts` exporting `ToolResult`.
  Import it in all tool files. This is a two-line change per file.

### Issue 3: `WorkerRow` interface uses `string` for typed union fields

- **File**: `packages/mcp-cortex/src/tools/workers.ts:13-32`
- **Problem**: `WorkerRow.status`, `WorkerRow.worker_type`, `WorkerRow.provider`, and
  `WorkerRow.launcher` are all typed as `string`. The schema already defines precise
  union types: `WorkerStatus`, `WorkerType`, `ProviderType`, `LauncherMode`. The
  `getHealth` function at line 46 makes decisions based on `row.compaction_count` and
  calls `isProcessAlive(row.pid)` where `pid` is `number | null` — but then adds a
  truthiness check `!row.pid` which incorrectly fails for PID 0 (edge case, but a
  classic anti-pattern from the review-lessons).
- **Impact**: A new status value added to `WorkerStatus` will not cause a type error if
  a `switch` or comparison in `getHealth` is not updated. The compiler cannot help.
- **Fix**: Change `WorkerRow.status` to `WorkerStatus`, `WorkerRow.worker_type` to
  `WorkerType`, `WorkerRow.provider` to `ProviderType | null`, `WorkerRow.launcher` to
  `LauncherMode | null`. Import the types from `../db/schema.js`.

---

## Serious Issues

### Issue 4: `contextPercent` calculation is semantically incorrect

- **File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:179`
- **Problem**: `const contextPercent = Math.round((acc.lastInputTokens / 1_000_000) *
  100)` treats 1M tokens as 100%. No model has a 1M-token context window as its
  ceiling (Sonnet 4.6 is 200k). A worker at 180k input tokens shows 18% context usage
  but is actually at 90% of its window.
- **Tradeoff**: The value is stored in the DB and drives the `high_context` health
  check at `workers.ts:50` (`context_percent > 80`). With this formula, that threshold
  is never reachable in practice on standard Claude models.
- **Recommendation**: Either use a per-model context window map keyed by model name, or
  change the denominator to 200_000 (the tightest window among current models). Document
  the approximation with an inline comment.

### Issue 5: Token accumulation strategy switches between overwrite and increment without documentation

- **File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:113-133`
- **Problem**: `result` messages overwrite totals (`acc.totalInput = usage.input_tokens
  ?? acc.totalInput`) at lines 116-119. `assistant` messages increment them (`acc.totalInput
  += usage.input_tokens`) at lines 130-133. There is no comment explaining that
  `result` is a final cumulative total that supersedes the running tally.
- **Tradeoff**: If the stream-json format changes or a new message type bridges these
  two behaviors, double-counting or zeroing becomes likely.
- **Recommendation**: Add a comment block before lines 113-133 explaining that `result`
  provides the authoritative cumulative count and overwrites the incremental accumulator,
  while `assistant` provides per-message increments that are accumulated until a `result`
  supersedes them.

### Issue 6: `handleListWorkers` uses string concatenation for `ORDER BY`, inconsistent with other tools

- **File**: `packages/mcp-cortex/src/tools/workers.ts:122-130`
- **Problem**: The function builds four different prepared statements conditionally
  instead of building a single query with dynamic filters (the pattern used in
  `tasks.ts:handleGetTasks`). This leads to four code paths for essentially the same
  query, increasing maintenance burden.
- **Tradeoff**: Not a correctness issue, but it diverges from the established pattern
  in the same package without justification.
- **Recommendation**: Refactor to the `conditions: string[] / params: unknown[]`
  accumulation pattern used in `handleGetTasks`.

### Issue 7: `spawn.ts` imports `join` and `resolve` from `node:path` separately — `resolve` duplicated at line 4

- **File**: `packages/mcp-cortex/src/process/spawn.ts:1-4`
- **Problem**: Line 3 imports `join` from `'node:path'`. Line 4 imports `resolve` from
  `'node:path'`. These are two separate import statements from the same module.
- **Impact**: Minor but violates import consolidation idiom and signals inattentive
  editing (one `resolve` import was added later without merging with the existing one).
- **Recommendation**: Merge into `import { join, resolve } from 'node:path'`.

### Issue 8: `onExit` callback signature in `SpawnOptions` differs from actual usage

- **File**: `packages/mcp-cortex/src/process/spawn.ts:17` and
  `packages/mcp-cortex/src/tools/workers.ts:97-100`
- **Problem**: `SpawnOptions.onExit` is declared as `(code: number | null, signal:
  string | null, pid: number) => void` but at `workers.ts:97-100` the callback only
  uses `code` (`(code) => { ... }`). The `signal` and `pid` parameters in the type
  signature exist but are never consumed by any caller.
- **Tradeoff**: Dead parameters in a callback signature mislead readers into thinking
  this information is being used. They add noise to the type declaration.
- **Recommendation**: If no caller uses `signal` and `pid`, simplify to `(code: number
  | null) => void`.

### Issue 9: `buildGlmEnv` function silently accepts an empty string API key

- **File**: `packages/mcp-cortex/src/process/spawn.ts:162-172`
- **Problem**: `buildGlmEnv('')` is called from `spawnWorkerProcess` at line 44 as
  `buildGlmEnv(opts.glmApiKey ?? '')`. If `glmApiKey` is `undefined` (which is
  possible since it is optional in the interface), an empty string is passed. The guard
  for missing GLM key lives in `workers.ts:80-84` before `spawnWorkerProcess` is called,
  but `spawnWorkerProcess` itself has no safeguard.
- **Tradeoff**: The guard is present for the MCP tool path but `spawnWorkerProcess` can
  be called directly from other code without the same guard. The fallback `?? ''`
  actively hides a missing key rather than surfacing it.
- **Recommendation**: Assert `opts.glmApiKey` is non-empty inside `spawnWorkerProcess`
  when `provider === 'glm'`, or change the type to require it (`glmApiKey: string` when
  `provider === 'glm'` via a discriminated union).

### Issue 10: `handleGetPendingEvents` serialization logic is intentionally inconsistent and undocumented

- **File**: `packages/mcp-cortex/src/events/subscriptions.ts:190`
- **Problem**: The function conditionally applies `JSON.stringify(data, null, 2)`
  (pretty) when events exist and `JSON.stringify(data, undefined, undefined)` (compact)
  when the queue is empty — all on a single line. This is not explained. The ternary
  reads: `JSON.stringify({ events: ... }, events.length > 0 ? null : undefined,
  events.length > 0 ? 2 : undefined)`.
- **Tradeoff**: The behavior is technically correct but the code is needlessly clever.
  A reader who simplifies this to `JSON.stringify({ events }, null, 2)` will not break
  functionality but will see that even the empty case is pretty-printed, potentially
  wondering if that matters.
- **Recommendation**: Extract to two explicit branches with a comment explaining the
  intent. If the compact form is for token savings, say so.

---

## Minor Issues

1. **`schema.ts:128-148`: Inline multi-field object literals on single lines** — `emptyTokenStats` packs two fields per line (e.g., `total_input: 0, total_output: 0,`). The pattern is inconsistent: `emptyCost` packs all four on one line. Pick one format and apply consistently.

2. **`workers.ts:141-143`: Magic number `1_000_000` for token display threshold** — the value is used inline without a named constant. A reader must infer that this is a display formatting threshold (show "M" suffix above 1M tokens). Extract to a named constant: `const TOKEN_DISPLAY_MEGA_THRESHOLD = 1_000_000`.

3. **`subscriptions.ts:55`: `resolve(workingDirectory) + sep` path boundary check** — the pattern appends `sep` to ensure the base path ends with a separator before calling `startsWith`. This is correct but subtle. A brief inline comment explaining why `sep` is appended (to prevent `'/foo/bar'.startsWith('/foo/b')` false positives) would prevent future "simplification" that breaks the security boundary.

4. **`token-calculator.ts:84`: `round` function is unexported and private** — the function rounds to 2 decimal places. The rounding precision (cents) is a business rule that could reasonably be questioned. A comment stating "round to nearest cent" documents the intent and makes future precision changes deliberate rather than accidental.

5. **`jsonl-watcher.ts:60-61`: Column list in `pollAll` DB query is hardcoded as a string** — selecting specific columns is good practice, but the column names are duplicated from the `WorkerRow` interface without enforcement. If a column is renamed, this string silently produces `undefined` values in TypeScript.

6. **`index.ts:218`: Version string `'0.2.0'` appears in two places** — at line 31 in the `McpServer` constructor and at line 218 in the startup log message. These will drift. The version should come from a single source (e.g., `package.json` import or a top-level constant).

---

## File-by-File Analysis

### `db/schema.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

The schema is clean and well-organized. CHECK constraints on all enum columns, FK on
`workers.session_id` and `workers.task_id`, WAL mode enabled, and indexes on the hot
query paths. The helper factories (`emptyTokenStats`, `emptyCost`, `emptyProgress`) are
a good pattern.

**Specific Concerns**:
1. Lines 128-148: Multi-field packing inconsistency in factory functions (minor, see
   Minor Issue 1).
2. `WorkerType`, `WorkerStatus`, `ProviderType`, `LauncherMode` are exported but the
   downstream `WorkerRow` in `workers.ts` ignores them — the schema's typing effort is
   wasted at the consumer layer (see Blocking Issue 3).

---

### `tools/sessions.ts`

**Score**: 6/10
**Issues Found**: 1 blocking, 1 serious, 1 minor

**Specific Concerns**:
1. Line 2: Dead `randomUUID` import (Blocking Issue 1).
2. Line 5: Duplicate `ToolResult` declaration (Blocking Issue 2).
3. Lines 83-89: `handleListSessions` issues per-session `prepare().all()` DB queries
   inside a loop (N+1 query pattern). For sessions with many workers, this scales
   linearly with the session count. A single `GROUP BY session_id` query would replace
   the loop.

---

### `tools/workers.ts`

**Score**: 5/10
**Issues Found**: 2 blocking, 2 serious, 1 minor

**Specific Concerns**:
1. Lines 13-32: `WorkerRow` uses `string` for all typed union fields (Blocking Issue 3).
2. Line 8: Duplicate `ToolResult` declaration (Blocking Issue 2).
3. Lines 122-130: Four-branch query construction diverges from pattern in `tasks.ts`
   (Serious Issue 6).
4. Lines 97-100: `onExit` callback ignores two of three declared parameters (Serious
   Issue 8).
5. Line 141: Magic number `1_000_000` as display threshold (Minor Issue 2).

---

### `process/spawn.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 2 serious, 0 minor

The process management code is solid. The SIGTERM + SIGKILL escalation with a 5-second
delay is correct. Flushing remaining `stdoutBuffer` on `close` event prevents lost
messages. The `process.once('exit')` cleanup handler is good hygiene.

**Specific Concerns**:
1. Lines 3-4: Duplicate `node:path` import statements (Serious Issue 7).
2. Line 44: `buildGlmEnv(opts.glmApiKey ?? '')` swallows a missing key (Serious
   Issue 9).

---

### `process/token-calculator.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Clean, readable, single-responsibility. Pricing table is well-structured. GLM models
show $0 pricing explicitly rather than falling through to zero — good intent
communication.

**Specific Concerns**:
1. Line 84: `round` function silently encodes a business decision (2 decimal places =
   cents precision). See Minor Issue 4. No `openai/gpt-5.4` model exists as of the
   review date — likely a placeholder. This will produce warnings in production when a
   real OpenAI model key is used.

---

### `process/jsonl-watcher.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

The most complex file in this set and the one carrying the most hidden risk.

**Specific Concerns**:
1. Line 179: `contextPercent` calculation is semantically wrong (Serious Issue 4).
2. Lines 113-133: Undocumented overwrite-vs-increment token accumulation switch (Serious
   Issue 5).
3. Lines 23-39: `endTurnAt` / `autoCloseTriggered` state machine is undocumented
   (captured in The 5 Critical Questions, not a separate issue but maintenance risk).
4. Line 60-61: Hardcoded column string in `pollAll` query (Minor Issue 5).

---

### `events/subscriptions.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

The path traversal guard at line 58 (`abs.startsWith(resolvedBase)`) is a meaningful
security boundary. The `satisfied` flag to prevent double-evaluation is a reasonable
design, though the async reset path introduces the subtle race described in Critical
Question 3.

**Specific Concerns**:
1. Line 190: Opaque conditional `JSON.stringify` serialization (Serious Issue 10).
2. Line 55: Missing comment on why `sep` is appended (Minor Issue 3).

---

### `index.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

Tool registration is well-organized into clear sections with comment headers. The Zod
validation schema for `watchConditionSchema` is correctly using `z.discriminatedUnion`.
The SIGINT/SIGTERM handler correctly stops all subsystems before exit.

**Specific Concerns**:
1. Lines 31 and 218: Version string duplicated (Minor Issue 6).
2. Line 209: `session_id` input schema parameter on `get_pending_events` is declared as
   "not yet implemented" — this is a dead input that will confuse callers who pass it
   expecting filtering behavior.

---

## Pattern Compliance

| Pattern                              | Status | Concern                                                                   |
| ------------------------------------ | ------ | ------------------------------------------------------------------------- |
| No bare `string` for union fields    | FAIL   | `WorkerRow` uses `string` for all typed status/type fields                |
| No duplicate type definitions        | FAIL   | `ToolResult` declared twice identically                                   |
| No unused imports                    | FAIL   | `randomUUID` imported but unused in `sessions.ts`                         |
| Whitelist pattern for dynamic SQL    | PASS   | Both `UPDATABLE_SESSION_COLUMNS` and `UPDATABLE_COLUMNS` sets present     |
| N+1 query guard                      | FAIL   | `handleListSessions` runs per-session worker count queries in a loop      |
| Import consolidation (same module)   | FAIL   | `spawn.ts` has two separate `node:path` imports                           |
| Input validation at system boundary  | PASS   | Zod schemas on all tools, path traversal guard in `FileWatcher`           |
| Resource cleanup on shutdown         | PASS   | SIGTERM/SIGINT handlers stop watcher, close DB                            |

---

## Technical Debt Assessment

**Introduced**:
- The `contextPercent` calculation bug will persist in the DB forever for any workers
  already stored. If the calculation is corrected, historical values remain inconsistent
  with new values.
- The dual `ToolResult` type declaration creates a divergence point that grows harder to
  unify as more tool files are added.
- The `WorkerRow` weak typing means any future `getHealth` logic changes have no
  compiler assistance.

**Mitigated**:
- The whitelist pattern on updatable columns (`UPDATABLE_SESSION_COLUMNS`) is solid and
  prevents SQL injection via dynamic column names.
- The path traversal guard in `FileWatcher` is a meaningful security control that
  prevents condition paths from escaping the working directory.

**Net Impact**: Slight negative. The functional foundations are good but the type-safety
shortcuts compound over time as more tools reference `WorkerRow` without the proper
unions.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The `contextPercent` calculation in `jsonl-watcher.ts:179` makes the
`high_context` health signal essentially non-functional under normal Claude model
context windows. A supervisor reading `context_percent: 18` on a worker that is
actually at 90% of its context window will not intervene. This is the highest-impact
correctness issue in the batch.

## What Excellence Would Look Like

A 10/10 implementation would:

1. Define `ToolResult` once in a shared `tools/types.ts` and import it everywhere.
2. Use the union types from `schema.ts` in `WorkerRow` — the schema defines them, the
   consumer should enforce them.
3. Calculate `contextPercent` using a per-model context window map (already implied by
   the existing `PRICING` map in `token-calculator.ts` — add a parallel
   `CONTEXT_WINDOWS` map).
4. Document the `endTurnAt / autoCloseTriggered` state machine with a two-line comment
   explaining the invariant.
5. Remove the dead `session_id` parameter from `get_pending_events` or implement the
   filtering.
6. Fix the N+1 query in `handleListSessions` with a single aggregated query.
