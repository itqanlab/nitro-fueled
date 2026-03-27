# Code Style Review - TASK_2026_067

## Review Summary

| Metric          | Value                                              |
| --------------- | -------------------------------------------------- |
| Overall Score   | 5/10                                               |
| Assessment      | NEEDS_REVISION                                     |
| Blocking Issues | 2                                                  |
| Serious Issues  | 5                                                  |
| Minor Issues    | 4                                                  |
| Files Reviewed  | 6                                                  |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The split tool registration pattern is the biggest long-term risk. Today's `index.ts` registers `spawn_worker`, `list_workers`, `get_worker_stats`, `get_worker_activity`, and `kill_worker` inline using `server.tool(name, description, schema, handler)`. The new tools (`subscribe_worker`, `get_pending_events`) use an exported-schema + exported-handler pattern and are also registered inline in `index.ts`. Meanwhile, the old tool *files* (`list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`, `kill-worker.ts`) still export factory functions (`xTool(registry)`) that return `{ name, description, inputSchema, handler }` objects — but those objects are **no longer used** in `index.ts`. The `index.ts` file has already diverged: it reimplements `list_workers`, `get_worker_stats`, `get_worker_activity`, and `kill_worker` inline while the original factory implementations remain in their tool files as dead code. A future developer adding a new tool will encounter two incompatible patterns with no indication which is canonical.

### 2. What would confuse a new team member?

Three things immediately:

1. Why does `get-worker-activity.ts` export `getWorkerActivityTool()` if nothing calls it? The `index.ts` inline implementation is the live one.
2. `getPendingEventsSchema` is exported as `{}` — an empty object literal. This is the schema the MCP SDK uses to advertise what arguments the tool accepts. Any developer looking at it would reasonably wonder if it was an oversight or intentional.
3. The `subscribe_worker` response does not include the `subscribed: boolean` field from the task spec. The spec defines the return shape as `{ subscribed: boolean, watched_paths: string[] }`. The implementation returns a formatted text block instead. This is acceptable for an MCP text tool, but the discrepancy from the spec will confuse whoever reads the spec alongside the code.

### 3. What's the hidden complexity cost?

The `FileWatcher` class introduces a subtle concurrency risk: `evaluateCondition` is async and may be called multiple times in rapid succession for the same `workerId` if the file is written several times within the retry window. The `sub.satisfied` guard prevents double-enqueueing in theory, but between the first `satisfied` check (line 49 in `file-watcher.ts`) and the write of `sub.satisfied = true` (line 122), a second `evaluateCondition` invocation could already have passed the guard. This is a check-then-act race — an anti-pattern the project's own rules flag as a mandatory violation.

### 4. What pattern inconsistencies exist?

**Major:** Two incompatible tool export patterns now coexist in `src/tools/`:

- Old pattern (factory): `export function xTool(registry)` returning `{ name, description, inputSchema, handler }` — used by `list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`, `kill-worker.ts`
- New pattern (split exports): `export const xSchema = {...}` + `export async function handleX(args, dep1, dep2)` — used by `spawn-worker.ts`, `subscribe-worker.ts`, `get-pending-events.ts`

The old factory files are now dead code because `index.ts` reimplements their handlers inline. This is a quiet debt bomb: the dead files look authoritative but are no longer wired up.

**Minor:** Health status casing is inconsistent between the old `get-worker-activity.ts` (`'COMPACTING'`, `'HIGH_CONTEXT'`, `'STUCK'`) and the new `index.ts` inline implementation + `getHealth()` function which uses `'compacting'`, `'high_context'`, `'stuck'` (matching the `HealthStatus` type). The old file's dead code contains the wrong casing but is invisible because it is unreachable.

### 5. What would I do differently?

- Pick one tool pattern and apply it consistently. The new exported-schema + handler pattern is cleaner for testing; adopt it and delete the old factory files.
- Make `evaluateCondition` use a mutex or move the `satisfied` flag assignment before the async file read to close the race window.
- Return a structured JSON object from `get_pending_events` consistently regardless of whether the queue is empty — the current split path (empty → compact inline JSON, non-empty → pretty-printed JSON) is an unnecessary inconsistency.
- Use `z.object({})` instead of `{}` for `getPendingEventsSchema` to make the empty schema explicit and consistent with how the MCP SDK expects its schema argument.

---

## Blocking Issues

### Issue 1: Check-then-act race on `sub.satisfied` in async condition evaluator

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:49,122`
- **Problem**: The `onEvent` closure checks `sub.satisfied` on line 49 and then calls the async `evaluateCondition`. Inside `evaluateCondition`, `sub.satisfied = true` is set on line 122 only after the async file read completes. If two `change` events fire within the ~100ms retry window for the same path, two concurrent invocations of `evaluateCondition` can both pass the `if (satisfied && !sub.satisfied)` guard before either sets `sub.satisfied = true`. The result is two `WatchEvent` entries pushed to the queue for the same worker, and `cleanup` called twice.
- **Impact**: A worker completion event is delivered twice to the supervisor. The supervisor triggers the Step 7 completion handler twice for the same worker — attempting to double-transition the task state and double-spawn the next worker type (e.g., two Review Lead workers for the same task).
- **Fix**: Set `sub.satisfied = true` optimistically before the async read, not after. If the read subsequently fails, reset it — but given the retry semantics, the simpler fix is to move the flag assignment before the `readFile` call so it is set synchronously in the JS event loop, outside the async gap.

### Issue 2: Two incompatible tool patterns with dead factory files

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`, `kill-worker.ts`
- **Problem**: The old tool files export factory functions (`listWorkersTool(registry)`, `getWorkerActivityTool(registry)`, etc.) but `index.ts` no longer calls them — it reimplements all four inline. The factory files are dead code but look authoritative. The new tools (`subscribe-worker.ts`, `get-pending-events.ts`) use a different export shape. There is now no single canonical pattern for adding a tool.
- **Impact**: The next developer adding a tool will copy one of the two patterns. The old factory files will be copied because they outnumber the new pattern (4 vs 2) and look "real." The new tool will be wired incorrectly (not registered via `server.tool()`), causing a silent registration miss.
- **Fix**: Either (a) delete the four dead factory files and document the new pattern, or (b) rewire `index.ts` to import and use the factory functions again. Pick one pattern and remove all traces of the other.

---

## Serious Issues

### Issue 1: `getPendingEventsSchema` is an empty object literal

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-pending-events.ts:4`
- **Problem**: `export const getPendingEventsSchema = {};` is a plain empty object, not a Zod schema or an MCP-typed schema. `spawn-worker.ts` and `subscribe-worker.ts` use Zod schemas with `.describe()` for each field. The MCP SDK's `server.tool()` method accepts Zod schemas for its input validation. Passing `{}` may work at runtime (no args to validate), but it bypasses the Zod validation layer entirely and produces no schema introspection for MCP clients. The correct form is `{}` as a Zod shape only if wrapped — but the SDK's `tool()` signature expects a `ZodRawShape`, which `{}` technically satisfies as an empty shape. This is lucky, not intentional.
- **Recommendation**: Replace with an explicit empty Zod shape comment: `export const getPendingEventsSchema = {} as const;` with a comment, or use `z.object({})` and adjust registration accordingly. At minimum, add a comment explaining why it is empty.

### Issue 2: `subscribe_worker` returns text, not the spec-defined `{ subscribed, watched_paths }` structure

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/subscribe-worker.ts:54-65`
- **Problem**: The task spec defines the return shape as `{ subscribed: boolean, watched_paths: string[] }`. The implementation returns a formatted multi-line text block. While MCP tools return content arrays, the convention in this codebase is to JSON-stringify structured results (see `get_pending_events`). The supervisor's fallback detection logic checks whether `subscribe_worker` exists in the MCP tool list — it does not parse the return value. But if future supervisor logic tries to extract `watched_paths` count from the response for logging, it will fail silently.
- **Recommendation**: Return `JSON.stringify({ subscribed: true, watched_paths: watchedPaths })` and include the human-readable summary in the same text block, or return JSON only. The text block format is not wrong per se, but it diverges from the spec and from `get_pending_events`'s JSON convention.

### Issue 3: Worker-not-found in `subscribe_worker` returns success-shaped content, not an error signal

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/subscribe-worker.ts:44-49`
- **Problem**: When the worker is not found, the tool returns `{ content: [{ type: 'text', text: 'Worker X not found in registry.' }] }` — the same shape as a success response. The MCP protocol supports `isError: true` on the content array. Other tools in this codebase also use the same not-an-error pattern, so this is a pre-existing inconsistency, but it means the supervisor's fallback detection (which simply calls `subscribe_worker` and checks for its presence) will silently succeed even when the worker ID is wrong. The supervisor logs "SUBSCRIBED" and sets `event_driven_mode = true` but no watcher was registered.
- **Recommendation**: Return `{ content: [...], isError: true }` for not-found cases, consistent with MCP error signaling conventions.

### Issue 4: Inconsistent JSON formatting between empty and non-empty `get_pending_events` responses

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-pending-events.ts:11-25`
- **Problem**: Empty queue returns `JSON.stringify({ events: [] })` (compact, no indentation). Non-empty queue returns `JSON.stringify({ events }, null, 2)` (pretty-printed). This inconsistency is unnecessary — the supervisor should parse either correctly, but any consumer doing string comparison or display will see different formatting for the same semantic result (empty vs non-empty are both valid responses).
- **Recommendation**: Use the same formatting for both branches. Since the supervisor parses JSON, compact format is preferable for both.

### Issue 5: `closeAll()` iterates `subscriptions` while `cleanup()` mutates it

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:87-90`
- **Problem**: `closeAll()` iterates `this.subscriptions` with `for (const [id] of this.subscriptions)` and calls `this.cleanup(id)` on each iteration. `cleanup()` calls `this.subscriptions.delete(workerId)`. Mutating a `Map` while iterating it with `for...of` is safe in JavaScript (the spec guarantees already-visited entries are not re-visited and newly deleted entries are skipped if not yet visited), but entries deleted by a callback that's called from within the loop create a subtle read order dependency. The safer idiom is `Array.from(this.subscriptions.keys())` before iterating to snapshot the key set.
- **Recommendation**: Snapshot keys before the loop: `for (const id of Array.from(this.subscriptions.keys()))`.

---

## Minor Issues

1. **`file-watcher.ts:103` — anonymous Promise in retry**: `await new Promise((r) => setTimeout(r, 100))` should use a named `sleep` utility if one exists in the codebase, for readability. If not, this is acceptable as-is but could be extracted to a helper.

2. **`subscribe-worker.ts:37` — inline type duplication**: The `args` parameter type on `handleSubscribeWorker` manually re-declares `{ worker_id: string; working_directory: string; conditions: z.infer<typeof watchConditionSchema>[] }` instead of using `z.infer<typeof subscribeWorkerSchemaObject>`. This creates a maintenance trap — if the schema gains a new field, the function signature must be updated separately.

3. **`types.ts:108` — comment style inconsistency**: The section comment `// --- Event-driven worker completion ---` uses a dashed-line style not seen elsewhere in the file. The existing types use no section headers. This is cosmetic but inconsistent.

4. **`index.ts:217` — signal handlers on a single line with semicolons**: `process.on('SIGINT', () => { watcher.stop(); fileWatcher.closeAll(); process.exit(0); });` puts multiple statements on one line. The pre-existing SIGINT handler on the line above it uses the same style, so this is consistent with existing code — but both are borderline readable. Not a new problem introduced by this task.

---

## File-by-File Analysis

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/types.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The three new condition types (`FileValueCondition`, `FileContainsCondition`, `FileExistsCondition`) and the discriminated union `WatchCondition` are well-structured. The `WatchEvent` interface is clean. Types use `snake_case` for fields consistent with the rest of the file. The `triggered_at: string` with ISO timestamp comment is acceptable for an event-driven system. The only quibble is the dashed-line section comment style inconsistency (minor).

**Specific Concerns**:
1. `types.ts:131` — `triggered_at` is `string` with a comment `// ISO timestamp`. A branded type (`ISOTimestamp = string & { __brand: 'iso' }`) would be better, but this is consistent with the file's existing approach, so not a new problem.

---

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 1 serious, 1 minor

**Analysis**: The overall structure is clean. The class has a clear single responsibility, JSDoc comments are present and accurate, and the use of chokidar (consistent with the existing `jsonl-watcher.ts`) is appropriate. The `drainEvents()` implementation using `splice(0)` is idiomatic. However, the check-then-act race on `sub.satisfied` across async boundaries is a real bug that violates the project's own anti-pattern rules on race conditions.

**Specific Concerns**:
1. `file-watcher.ts:49,122` — TOCTOU race on `sub.satisfied` across async boundaries (Blocking Issue 1).
2. `file-watcher.ts:87-90` — mutation of `subscriptions` Map during iteration in `closeAll()` (Serious Issue 5).
3. `file-watcher.ts:103` — anonymous Promise for sleep (Minor Issue 1).

---

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/subscribe-worker.ts`

**Score**: 5/10
**Issues Found**: 0 blocking, 3 serious, 1 minor

**Analysis**: The Zod schema for `watchConditionSchema` is well-done — a proper `discriminatedUnion` on `type`, with `.describe()` on every field. This is the best type-safety pattern in the entire changeset. However, the response format diverges from both the spec and from how `get_pending_events` returns data, the not-found case does not signal an error, and the arg type duplication is a maintenance liability.

**Specific Concerns**:
1. `subscribe-worker.ts:54-65` — text-only response instead of spec-defined JSON structure (Serious Issue 2).
2. `subscribe-worker.ts:44-49` — not-found returns success-shaped content (Serious Issue 3).
3. `subscribe-worker.ts:37` — inline arg type re-declaration instead of `z.infer<>` (Minor Issue 2).

---

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-pending-events.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 0 minor

**Analysis**: The function is correctly thin — delegates entirely to `fileWatcher.drainEvents()` and formats the result. The drain-on-read semantics are correctly implemented. The empty-schema export and formatting inconsistency are the two concerns.

**Specific Concerns**:
1. `get-pending-events.ts:4` — `getPendingEventsSchema = {}` (Serious Issue 1).
2. `get-pending-events.ts:11-25` — inconsistent JSON formatting between empty/non-empty paths (Serious Issue 4).

---

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts`

**Score**: 4/10
**Issues Found**: 1 blocking, 0 serious, 1 minor

**Analysis**: The additions for `subscribe_worker` and `get_pending_events` registration are correct and follow the inline registration style already used in `index.ts` for the other tools (the inline style was introduced by a prior refactor). However, `index.ts` now registers `list_workers`, `get_worker_stats`, `get_worker_activity`, and `kill_worker` inline while the corresponding tool files still export factory functions — those factory functions are dead code. The file has grown to 219 lines. The `getHealth()` function at line 203 duplicates the `assessHealth()` function in `get-worker-stats.ts` (same logic, different name). This is pre-existing but the new additions exacerbate the pattern split.

**Specific Concerns**:
1. `index.ts` as a whole — dead factory files across `src/tools/` (Blocking Issue 2).
2. `index.ts:217` — signal handlers on single line (Minor Issue 4, pre-existing).

---

### `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The SKILL.md additions are thorough and well-integrated. Step 5e-ii documents the subscribe flow with a clear per-worker-type table. The fallback logic (detect missing tool, set `event_driven_mode = false` once, never re-check per spawn) is explicitly specified. The event-driven monitoring loop (Step 6) is described clearly with the 30s poll interval and the 5-minute stuck-detection guard. The distinction between completion-via-event and completion-via-`finished` health state is handled (addressing the race where process exits before file watcher fires).

**Specific Concerns**:
1. SKILL.md line 575-577 — the Cleanup Worker table shows three separate rows all using `event_label: CLEANUP_DONE`. A new developer reading this might wonder if three events fire (they don't — only one fires). The prose below clarifies this, but the table is misleading at first read. Consider collapsing to one row with a multi-value `value` column.

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                                                    |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Discriminated union for conditions | PASS   | `WatchCondition` is a proper TS discriminated union                                        |
| Zod discriminatedUnion in schema  | PASS   | `watchConditionSchema` uses `z.discriminatedUnion` correctly                               |
| No `any` types                    | PASS   | No `any` found in new files                                                                |
| Tool export pattern consistency   | FAIL   | Two incompatible patterns; old factory files are dead code (Blocking Issue 2)              |
| Error signaling (not-found)       | FAIL   | Returns success-shaped content for not-found (Serious Issue 3)                             |
| Race condition safety             | FAIL   | TOCTOU on `sub.satisfied` across async boundary (Blocking Issue 1)                         |
| Input validation at boundaries    | PASS   | `subscribeWorkerSchema` validates with Zod including `min(1)` on conditions array          |
| Resource cleanup on teardown      | PASS   | `closeAll()` wired to SIGINT/SIGTERM in `index.ts`                                        |
| Anti-pattern: silent error swallow | WARN  | `watcher.close().catch(() => {})` in `cleanup()` swallows close errors silently            |

---

## Technical Debt Assessment

**Introduced**:
- Dead factory files (`list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`, `kill-worker.ts`) are now fully orphaned. Every future tool author must choose between two patterns.
- `getHealth()` in `index.ts` and `assessHealth()` in `get-worker-stats.ts` are duplicates. The dead factory file's version uses wrong casing for health status constants.
- `subscriptions` Map grows without a size cap. A long-running supervisor spawning many workers without explicit `closeAll` calls could accumulate stale entries if workers complete via the registry (not via file watch) without the subscription being cleaned up. This is bounded in practice but unguarded in code.

**Mitigated**:
- Replaces the 5-minute polling loop with 30-second event polling — a clear win for pipeline throughput.
- The chokidar-based `FileWatcher` class is well-separated from the MCP tool layer, which makes it independently testable.

**Net Impact**: New debt introduced (dead files, split pattern, race condition) partially offsets the quality of the new feature. The feature logic itself is sound; the structural issues around it are the problem.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: The check-then-act race on `sub.satisfied` in `file-watcher.ts` can cause double-completion events and double-spawned workers. That is a correctness bug, not a style issue, and it must be fixed. The dead factory files are not urgent but will cause confusion at the next tool-addition boundary.

## What Excellence Would Look Like

A 9/10 implementation would:
1. Have exactly one tool pattern across all files in `src/tools/` — the new exported-schema + handler pattern — with the dead factory files deleted.
2. Set `sub.satisfied = true` before the async read to close the race window, with a comment explaining why.
3. Return `JSON.stringify({ subscribed: true, watched_paths })` from `subscribe_worker` matching the spec.
4. Use `{ content: [...], isError: true }` for all not-found responses.
5. Use consistent JSON formatting in `get_pending_events` regardless of queue size.
6. Extract `getHealth()` to a shared utility and delete the `assessHealth()` duplicate in the dead factory file — or simply delete the dead file.
