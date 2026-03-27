# Style Review — TASK_2026_063

## Verdict
REVISE

## Score
5/10

## Summary

| Metric          | Value   |
|-----------------|---------|
| Blocking Issues | 2       |
| Advisory Issues | 7       |
| Files Reviewed  | 17      |

The copy itself is clean TypeScript and the core patterns (Zod schemas, atomic persistence, path-traversal guards, async file reads) are solid. The problem is a structural inconsistency that this task introduced into the monorepo: the `src/tools/` directory now contains **two incompatible export patterns** and one of them (the factory pattern) is dead code — never wired up, never called. The task copied files verbatim without reconciling them, leaving a maintenance trap. That is a blocking issue. The second blocker is a JSON formatting inconsistency that is already documented in the review-lessons as a known violation pattern.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The dead factory-pattern tool files (`kill-worker.ts`, `list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`) export named functions that are never imported by `index.ts`. A future developer wanting to add a tool will read these files, assume they represent the correct pattern, wire their tool through the factory, and produce a tool that is never registered. The inconsistency will silently swallow their new tool.

### 2. What would confuse a new team member?

`get-pending-events.ts` and `get-worker-activity.ts` both have a `shortenPath` function at module level. There is also a `shortenPath` in `jsonl-watcher.ts`. Three copies of the same 4-line private helper across the tool layer. A new developer fixing a bug in one copy will miss the other two.

### 3. What's the hidden complexity cost?

`closeAll()` in `file-watcher.ts` (line 114) iterates `[...this.subscriptions.keys()]` with a for-of destructure `for (const [id] of ...)`. `Map.prototype.keys()` returns a `MapIterator<string>`, not an iterator of tuples. The destructure `[id]` works by accident — it takes the first character of the key string, not the key itself. This is a latent bug disguised as style. See full analysis under blocking issues.

### 4. What pattern inconsistencies exist?

The tools directory mixes two completely different patterns:

- **Active pattern (used by index.ts):** `export const xSchema` + `export async function handleX(args, dep1, dep2)` — registered inline in index.ts via `server.tool()`.
- **Dead factory pattern (not used anywhere):** `export function xTool(registry)` returning `{ name, description, inputSchema, handler }` — a self-contained registration object. This is the old registration approach before the SDK's `server.tool()` API was adopted.

`kill-worker.ts`, `list-workers.ts`, `get-worker-activity.ts`, and `get-worker-stats.ts` use the dead factory pattern. Their implementations are **duplicated** in `index.ts` inline. The files contain working, complete implementations that are simply never called. This is documented in `backend.md` under MCP Tool Registration as an exact match for the "Pick one tool export pattern" lesson.

### 5. What would I do differently?

Delete the dead factory-pattern files entirely. The live implementations are already in `index.ts`. The task description said "copy source files" — it should have also said "resolve the two-pattern problem before landing." Alternatively, extract the inline implementations back into the handler pattern and delete the inline code from `index.ts`, then delete the factory files. Either direction is fine; having both is the problem.

---

## Blocking Issues

### [BLOCKING] `closeAll()` destructures a string key as if it were a tuple

- **File**: `packages/session-orchestrator/src/core/file-watcher.ts:114`
- **Code**: `for (const [id] of [...this.subscriptions.keys()])`
- **Problem**: `Map.prototype.keys()` is a `MapIterator<string>`. Spreading it gives `string[]`. Iterating with `for (const [id] of string[])` destructures each string character-by-character — `id` gets the first character of the worker_id string (a UUID hex digit), not the full key. The subsequent `this.cleanup(id)` call looks up `id` in the subscriptions map and finds nothing, so `closeAll()` silently skips every subscription.
- **Impact**: On MCP server shutdown (SIGINT/SIGTERM), `closeAll()` is called. If this bug is active, all chokidar watchers survive process shutdown — file descriptors leak. Under high worker concurrency this can exhaust the OS FD table.
- **Fix**: `for (const id of this.subscriptions.keys())` — iterate keys directly without destructuring. Or `for (const [id] of this.subscriptions)` — iterate the Map's entries, not its keys iterator.

### [BLOCKING] Mixed tool export patterns — dead factory files never registered

- **Files**: `packages/session-orchestrator/src/tools/kill-worker.ts`, `list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`
- **Problem**: These four files export factory functions (`killWorkerTool(registry)`, `listWorkersTool(registry)`, etc.) that return `{ name, description, inputSchema, handler }` objects. None of them are imported by `index.ts`. `index.ts` implements `kill_worker`, `list_workers`, `get_worker_stats`, and `get_worker_activity` inline using `server.tool()` directly. The factory files are dead code containing complete, diverged implementations. This is the exact pattern called out in `backend.md` "MCP Tool Registration — Pick one tool export pattern."
- **Impact**: Future contributors will copy the factory pattern, write working code, and ship a tool that is never registered. The factory files also contain subtle behavioral differences from the `index.ts` implementations (e.g., `get-worker-activity.ts` uses uppercase health labels like `'COMPACTING'`, `'HIGH_CONTEXT'` whereas `index.ts` uses the `HealthStatus` type values `'compacting'`, `'high_context'` from `types.ts`). The divergence is invisible because neither implementation is wrong in isolation.
- **Fix**: Delete the four factory files. Their implementations are superseded by the inline registrations in `index.ts`. Or: migrate `index.ts` to use the handler-export pattern consistently and delete the inline blocks. Either way, one pattern only.

---

## Advisory Issues

### [ADVISORY] `shortenPath` duplicated three times

- **Files**: `packages/session-orchestrator/src/tools/get-worker-activity.ts:48`, `packages/session-orchestrator/src/tools/get-pending-events.ts` (none — it uses `drainEvents` directly), `packages/session-orchestrator/src/core/jsonl-watcher.ts:347`, `packages/session-orchestrator/src/index.ts:124-127` (inline anonymous)
- **Problem**: The same 4-line `shortenPath` helper exists in `jsonl-watcher.ts` as a module-private function and in `get-worker-activity.ts` as a module-private function. `index.ts` also has an inline equivalent (the `parts.length > 2` slice) not extracted into a function. Three implementations of the same logic.
- **Recommendation**: Extract to a shared utility module (`src/utils/format.ts` or similar). Copy-paste divergence is inevitable otherwise.

### [ADVISORY] `getHealth` / `assessHealth` / inline health ternary — three implementations of the same logic

- **Files**: `packages/session-orchestrator/src/index.ts:203-210` (`getHealth` function), `packages/session-orchestrator/src/tools/get-worker-stats.ts:59-68` (`assessHealth` function), `packages/session-orchestrator/src/tools/get-worker-activity.ts:25-30` (inline ternary chain)
- **Problem**: Three copies of the same health-assessment logic with the same thresholds and conditions. The inline ternary in `get-worker-activity.ts` also uses uppercase labels (`'COMPACTING'`, `'HIGH_CONTEXT'`, `'STARTING'`, `'STUCK'`) that do not match the `HealthStatus` type from `types.ts` (`'compacting'`, `'high_context'`, `'starting'`, `'stuck'`). This means `getWorkerActivityTool` returns values that violate its own type signature — TypeScript does not catch this because the factory file's handler return type is not constrained to `HealthStatus`.
- **Recommendation**: Extract health assessment to a shared function in `core/` that returns `HealthStatus`. The factory files that carry diverged copies are already being deleted per the blocking issue above, which resolves the immediate inconsistency — but the duplication between `index.ts` and `get-worker-stats.ts` would remain and should be consolidated.

### [ADVISORY] `resolveSessionId` and `resolveJsonlPath` use `readFileSync` outside of a watcher context

- **File**: `packages/session-orchestrator/src/core/jsonl-watcher.ts:322-344`
- **Problem**: `resolveSessionId` calls `readFileSync` synchronously in what becomes a polling path (called from `spawn-worker.ts` in a `setTimeout` loop). This is not inside a watcher callback so it does not block the event loop as severely as the backend.md lesson describes, but it is still a synchronous I/O call in an otherwise async function. More importantly, the JSON is parsed with a direct cast: `const meta: SessionMeta = JSON.parse(readFileSync(...))`. No shape validation. If the file is malformed or has an unexpected schema, downstream code receives `undefined` for `sessionId` and the caller propagates `null` silently.
- **Recommendation**: At minimum, validate that the parsed object has a `sessionId` string field before casting. This is a light validation gap, not a crash risk, because the caller handles `null` returns.

### [ADVISORY] `WorkerRegistry.hydrateFromDisk` does not merge with factory defaults

- **File**: `packages/session-orchestrator/src/core/worker-registry.ts:33-35`
- **Problem**: Hydrated entries are inserted directly: `this.workers.set(id, worker)`. The backend.md lesson ("Hydrated records must be merged with factory defaults") requires merging each record with `emptyTokens()`, `emptyCost()`, `emptyProgress()` defaults before inserting. A registry file that predates a new field on `WorkerTokenStats` (e.g., a future `compaction_details` field) will produce structurally incomplete `Worker` objects. TypeScript does not catch this because the shape comes from a JSON cast.
- **Recommendation**: Change the hydration loop to merge each entry: `this.workers.set(id, { tokens: emptyTokens(), cost: emptyCost(), progress: emptyProgress(), ...worker })`.

### [ADVISORY] `get-pending-events.ts` inconsistent JSON formatting between empty and non-empty responses

- **File**: `packages/session-orchestrator/src/tools/get-pending-events.ts:12-26`
- **Problem**: Empty case returns compact JSON (`JSON.stringify({ events: [] })`). Non-empty case returns pretty-printed JSON (`JSON.stringify({ events }, null, 2)`). A consumer doing string comparison or displaying the output sees different wire formats for the same logical response. This is called out explicitly in `backend.md` "MCP Tool Registration — Use consistent JSON formatting."
- **Recommendation**: Pick one format (compact is preferred for machine consumers) and apply to both branches.

### [ADVISORY] `itermSessionId` may be undefined from AppleScript — no guard in `closeItermSession`

- **File**: `packages/session-orchestrator/src/core/iterm-launcher.ts:113-138`
- **Problem**: `closeItermSession` receives `itermSessionId: string` but guards on `if (!itermSessionId) return false`. For non-iTerm workers, `iterm_session_id` is registered as the empty string `''` (see `spawn-worker.ts:119`). The guard handles the empty string case, but the AppleScript interpolates `itermSessionId` directly into the script string without escaping: `if unique ID of aSession is "${itermSessionId}"`. If `itermSessionId` were ever to contain a double-quote (unusual for iTerm UUIDs but not structurally impossible), it would break the AppleScript syntax. This is a narrow risk but worth noting given the script-injection lessons in the codebase.
- **Recommendation**: At minimum, document the assumption that iTerm session IDs are always UUID strings with no special characters.

### [ADVISORY] `appendFileSync` in stdout data handler blocks the event loop per chunk

- **File**: `packages/session-orchestrator/src/core/process-launcher.ts:41`
- **Problem**: Every chunk of stdout from a spawned worker triggers a synchronous `appendFileSync` to the log file. For high-throughput workers generating large output, this blocks the event loop on every chunk. The backend.md lesson "Never use `readFileSync` in a file-watcher callback" covers the read side; the same principle applies to synchronous writes in data-event handlers. Under normal usage this is unlikely to cause visible latency, but under high concurrency it stacks.
- **Recommendation**: Buffer writes and flush on a timer, or use an async writable stream (`fs.createWriteStream` in append mode) rather than synchronous appends.

### [ADVISORY] `mkdirSync` for log directory is called once at spawn time, not inside write path

- **File**: `packages/session-orchestrator/src/core/process-launcher.ts:25`
- **Problem**: `mkdirSync(logDir, { recursive: true })` is called before spawning. If the `.worker-logs` directory is deleted while the server is running, subsequent `appendFileSync` calls throw `ENOENT` — and the error is silently swallowed by the `child.on('error')` handler, which itself calls `appendFileSync` to the same path (double failure). The backend.md lesson says `mkdirSync` should be inside `_persist()` / the write path, not only at startup.
- **Recommendation**: Move `mkdirSync` immediately before the first `appendFileSync` in the data handler, or check existence before each batch flush.

---

## File-by-File Analysis

### `src/index.ts`

**Score**: 6/10 — Functional, readable, good signal handler patterns. The `getHealth` function duplicates logic already present in tool files. The inline `list_workers` and other tool implementations are the live copies of what the dead factory files also implement.

### `src/types.ts`

**Score**: 9/10 — Clean discriminated unions, proper `type`-only exports where applicable. No `any`. The `{ type: string }` catch-all in `JsonlMessage` union is intentional for forward-compatibility and the comment in `jsonl-watcher.ts` explains why.

### `src/core/worker-registry.ts`

**Score**: 7/10 — Atomic write-to-temp-then-rename is correct. Schema version envelope is correct. The hydration gap (no factory default merge) is an advisory finding. The `flushToDisk` function uses the correct name instead of `_persist()` but follows the same pattern.

### `src/core/file-watcher.ts`

**Score**: 4/10 — The `closeAll()` destructuring bug is blocking. The optimistic-lock pattern and security boundary checks are well-implemented and the JSDoc is accurate and useful.

### `src/core/jsonl-watcher.ts`

**Score**: 6/10 — The `readFileSync` usage is in a polling path rather than a watcher callback, which is acceptable but not ideal. The `resolveSessionId` cast is an advisory gap. The `shortenPath` duplication is minor. Overall the accumulator pattern is sound.

### `src/core/process-launcher.ts`

**Score**: 7/10 — The shared subprocess utility is a good extraction per the backend lesson. The synchronous `appendFileSync` in data handlers is advisory, the `mkdirSync` placement is advisory.

### `src/core/iterm-launcher.ts`

**Score**: 7/10 — Uses `execFile` not `exec` (correct per backend lesson). The AppleScript injection risk is narrow but worth a comment.

### `src/core/print-launcher.ts`

**Score**: 8/10 — Clean. Guards for missing env var before spawn. The `buildGlmEnv()` spreads `process.env` correctly.

### `src/core/opencode-launcher.ts`

**Score**: 8/10 — Clean. Exit code tracking is a good pattern for distinguishing completion from failure.

### `src/core/token-calculator.ts`

**Score**: 8/10 — Unrecognized models return zero-cost with a warning (correct per backend lesson). Pricing table is organized and documented.

### `src/tools/spawn-worker.ts` and `src/tools/subscribe-worker.ts`

**Score**: 8/10 — Zod schemas are defined separately and re-exported. Input validation is thorough. `subscribe-worker.ts` correctly uses the registry's `working_directory` not caller input. `spawn-worker.ts` validates the incompatible flag combination before spawning.

### `src/tools/get-pending-events.ts`

**Score**: 6/10 — JSON formatting inconsistency is an advisory finding matching a known lesson.

### `src/tools/kill-worker.ts`, `list-workers.ts`, `get-worker-activity.ts`, `get-worker-stats.ts`

**Score**: 2/10 (collectively) — Dead code. Never imported, never registered. Contains diverged implementations. Blocking issue.

### `package.json` / `tsconfig.json`

**Score**: 9/10 — Correct `"type": "module"`, appropriate target and module resolution for Node 16+, `strict: true`. No issues.

---

## Pattern Compliance

| Pattern                          | Status | Concern                                                        |
|----------------------------------|--------|----------------------------------------------------------------|
| Single tool export pattern       | FAIL   | Factory files coexist with handler-export pattern; dead code   |
| Atomic file persistence          | PASS   | write-to-temp + rename implemented correctly                   |
| Schema version envelope          | PASS   | REGISTRY_VERSION + PersistedRegistry wrapper present           |
| Hydrate with factory defaults    | FAIL   | Hydration does not merge with emptyTokens/emptyCost/emptyProgress |
| Type safety (no `any`)           | PASS   | `unknown` used where applicable; narrowing is explicit         |
| Consistent JSON response format  | FAIL   | get-pending-events has compact vs pretty-print split           |
| Path traversal guard             | PASS   | file-watcher resolves and validates within working_directory   |
| MCP not-found responses          | ADVISORY | Worker not-found responses lack `isError: true`             |
| Resource cleanup on shutdown     | FAIL   | closeAll() has destructuring bug; watchers not closed on SIGINT|

---

## Technical Debt Assessment

**Introduced**: Two-pattern inconsistency in `src/tools/` — this was pre-existing in the sibling repo but is now tracked in the monorepo and will affect every future tool addition. The `closeAll()` bug was also pre-existing and is now under this repo's maintenance responsibility.

**Mitigated**: None (this was a copy task, not a refactoring task).

**Net Impact**: Neutral on debt level if the blocking issues are resolved immediately. If left, the two-pattern problem compounds with each new tool.

---

## What Excellence Would Look Like

A 9/10 version of this task would:
1. Delete the four dead factory files on copy, keeping only the actively-used handler-export pattern.
2. Fix the `closeAll()` destructuring to iterate keys directly.
3. Extract `getHealth`/`assessHealth` and `shortenPath` into shared utility modules rather than duplicating across files.
4. Normalize `get-pending-events.ts` to use the same JSON format for both branches.
5. Add factory-default merging in `hydrateFromDisk`.

Points 3–5 are advisory and could reasonably be deferred. Points 1 and 2 should not be merged without resolution.
