# Code Style Review - TASK_2026_059

## Review Summary

| Metric          | Value                                |
| --------------- | ------------------------------------ |
| Overall Score   | 6/10                                 |
| Assessment      | NEEDS_REVISION                       |
| Blocking Issues | 2                                    |
| Serious Issues  | 4                                    |
| Minor Issues    | 3                                    |
| Files Reviewed  | 2                                    |

## The 5 Critical Questions

### 1. What could break in 6 months?

The silent swallow in `_persist()` (worker-registry.ts:27-33) is the primary time-bomb. Every write after a disk-full, permissions change, or filesystem error silently discards state. The next restart will hydrate stale data or an empty registry with no diagnostic signal anywhere. The caller — the supervisor — will have no idea whether the registry it reads is current or hours old.

Additionally, the serialisation format is an opaque JSON array of `[string, Worker][]` tuples. There is no schema version field. When the `Worker` interface gains a new required field (not optional), hydrated workers from an old file will be structurally incomplete — TypeScript will not catch this at runtime, and callers will get `undefined` where a value is expected.

### 2. What would confuse a new team member?

The `_hydrate()` method deserialises the file as `[string, Worker][]` (an array of 2-tuples that mirrors `Map.entries()`), but nothing in the code documents this contract. A developer who comes in to add a migration, schema version, or different serialisation format has to reverse-engineer the chosen encoding from the single `JSON.parse` call.

The double-underscore prefix (`_hydrate`, `_persist`) signals "protected, call from subclass" in languages like Python, but TypeScript has first-class `private`. Using `private _hydrate()` creates a naming redundancy: the underscore is noise (TypeScript already enforces the access restriction) and may actively mislead contributors who know the Python convention.

### 3. What's the hidden complexity cost?

`pushStatsToRegistry` in `jsonl-watcher.ts` calls `updateTokens`, then `updateCost`, then `updateProgress` in sequence — three separate `_persist()` flushes for what is logically one stat update. At a 3-second poll interval with multiple active workers this is fine today, but it means the registry file is written up to 3x per worker per poll. As the worker count grows, this compounds. The `_persist()` call inside every individual updater was the right choice for correctness, but the batching problem now lives in the watcher layer and will become visible at scale.

### 4. What pattern inconsistencies exist?

The rest of the codebase (jsonl-watcher.ts, iterm-launcher.ts) uses `camelCase` for private method names: `pollAll`, `readNewLines`, `pushStatsToRegistry`, `autoCloseWorker`. The new methods `_hydrate` and `_persist` break this convention with the underscore prefix. This is the most immediately visible inconsistency for anyone scanning the class.

`remove()` at line 120-123 calls `this._persist()` unconditionally even when the worker did not exist in the map. Contrast with `updateStatus` (line 90-93) which guards with `if (w)` before persisting. The remove case is the inverse: it always persists even when the delete was a no-op (non-existent ID). The anti-patterns file specifically calls out "Delete/update on non-existent ID must return a 'not found' indicator, not silent success."

### 5. What would I do differently?

1. Add a schema version field to the persisted JSON so future format changes can migrate gracefully.
2. Rename `_hydrate` to `hydrate` (or `loadFromDisk`) and `_persist` to `persist` (or `flush`) — drop the underscore, rely on the `private` modifier.
3. Log a warning (not throw) in `_persist()` so disk write failures are observable without crashing.
4. Guard `remove()` consistently — return a boolean indicating whether anything was removed, and only persist if the delete was effective.
5. Consider a single `flush()` that is called by a wrapper that batches updates within the same tick (using `queueMicrotask` or a dirty flag) to reduce per-poll write amplification.

---

## Blocking Issues

### Issue 1: Silent persist failures violate the project anti-pattern mandate

- **File**: `src/core/worker-registry.ts:27-33`
- **Problem**: The `_persist()` catch block swallows all errors with a comment but no log output whatsoever. The anti-patterns file explicitly states: "NEVER swallow errors in fire-and-forget calls. At minimum, log them." and "Operations that modify state must surface errors to the caller."
- **Impact**: A disk-full or permission error causes every subsequent mutation to silently no-op. On the next MCP server restart, the registry appears empty (or stale). The supervisor misclassifies live workers as finished. There is zero diagnostic signal — no log line, no counter, no error surfaced to the tool caller.
- **Fix**: At minimum, add `console.error('[worker-registry] persist failed:', err)` inside the catch. Ideally, expose a `lastPersistError` getter so callers can surface it via a health tool. The function can still be best-effort, but it must not be silent.

### Issue 2: No schema version — deserialization is fragile across interface evolution

- **File**: `src/core/worker-registry.ts:14-24`
- **Problem**: The file is written as a raw `JSON.stringify(entries)` of `[string, Worker][]`. There is no version field. When the `Worker` interface adds a new non-optional field (e.g., the recent `launcher` and `log_path` additions), workers hydrated from an old file will be missing that field at runtime. TypeScript cannot catch this — the cast at line 17 (`const entries: [string, Worker][]`) silently asserts the shape is correct.
- **Impact**: A supervisor that calls `list_workers` after a server restart gets back workers with `undefined` values for newly-added required fields. Downstream code that accesses `w.launcher` on a hydrated worker gets `undefined`, not `'iterm'` or `'print'`, which breaks the kill-path dispatch in `kill_worker`.
- **Fix**: Add a wrapping object `{ version: 1, entries: [...] }` to the persisted JSON. In `_hydrate`, check the version and either migrate or discard stale entries that predate a field addition. This can start as a no-op check (`if (parsed.version !== 1) return`) and grow into a real migration later.

---

## Serious Issues

### Issue 1: `_hydrate` / `_persist` naming breaks codebase convention

- **File**: `src/core/worker-registry.ts:14, 26`
- **Problem**: Every other private method in the codebase uses plain `camelCase` with the `private` modifier (`pollAll`, `readNewLines`, `pushStatsToRegistry`, `autoCloseWorker`). The underscore prefix adds no TypeScript enforcement — `private` already does that — and signals Python-style protected semantics that do not exist in TS.
- **Tradeoff**: This is purely cosmetic but it creates a visual inconsistency that every reader of this class will notice. It will also propagate: future contributors seeing `_persist` will add more `_methodName` privates.
- **Recommendation**: Rename to `hydrateFromDisk()` and `flushToDisk()` (or simply `hydrate()` and `flush()`). This aligns with the existing naming convention and makes the intent clearer than the generic "persist".

### Issue 2: `remove()` persists unconditionally on a no-op delete

- **File**: `src/core/worker-registry.ts:120-123`
- **Problem**: `this.workers.delete(workerId)` returns `false` if the key does not exist, but `_persist()` is called regardless. Every other mutator (`updateStatus`, `updateSession`, etc.) guards with `if (w)` before persisting. The project anti-patterns file states: "Delete/update on non-existent ID must return a 'not found' indicator, not silent success."
- **Tradeoff**: A spurious persist write is cheap, but the inconsistency with every other method in the class is a readability and correctness signal — it suggests the case was not considered rather than being a deliberate design choice.
- **Recommendation**: Return a `boolean` from `remove()` (true = deleted, false = not found) and only call `_persist()` when the delete was effective. This also gives callers a signal they currently lack.

### Issue 3: Hydrated workers bypass `emptyTokens` / `emptyProgress` defaults

- **File**: `src/core/worker-registry.ts:14-24`
- **Problem**: Workers loaded from disk are inserted directly via `this.workers.set(id, worker)`. If the persisted JSON contains a worker whose `tokens` or `progress` object is missing a field (possible if the file was written by an older version of the server), the hydrated worker will be structurally incomplete. The `emptyTokens()`, `emptyCost()`, and `emptyProgress()` factory functions define the canonical defaults, but they are never applied during hydration.
- **Tradeoff**: This is a latent bug that only manifests during schema drift (see Blocking Issue 2), but it is independent of versioning — even minor field additions on optional objects can expose it.
- **Recommendation**: After parsing each worker, merge with the defaults: `const safeWorker = { tokens: emptyTokens(), cost: emptyCost(), progress: emptyProgress(), ...worker }`. This ensures all required fields are present regardless of what the file contains.

### Issue 4: `index.ts` — `mkdirSync` failure is unhandled at module top level

- **File**: `src/index.ts:18`
- **Problem**: `mkdirSync(registryDir, { recursive: true })` is called at the module's top level. If this throws (e.g., the path is a file, not a directory; or a permissions error on a read-only filesystem), the entire MCP server process crashes before the server is even initialised — with a raw Node.js stack trace, not a human-readable error.
- **Tradeoff**: This is exactly what the anti-patterns file flags: "Config/init failures at startup must block with a clear message, not silently continue." A crash is better than silent continuation, but a raw crash with no message is not the "clear message" the rule requires.
- **Recommendation**: Wrap in a try/catch and throw a descriptive `Error`: `throw new Error(\`[session-orchestrator] Cannot create registry dir ${registryDir}: ${err.message}\`)`. This preserves the blocking behavior while giving the operator an actionable message.

---

## Minor Issues

1. **`src/core/worker-registry.ts:29`** — `JSON.stringify(entries)` produces a single line with no formatting. For a dev-facing registry file that operators may inspect manually, `JSON.stringify(entries, null, 2)` costs negligible space and makes the file human-readable without tooling.

2. **`src/core/worker-registry.ts:7`** — `private persistPath: string` could be `private readonly persistPath: string` since it is set in the constructor and never mutated. `readonly` communicates this invariant and prevents accidental reassignment.

3. **`src/index.ts:17-20`** — The variable name `registryDir` is slightly ambiguous (could be any kind of registry). `registryDirPath` or simply `sessionOrchestratorDir` would align better with the descriptive naming style used elsewhere in the file (`registryPath` on line 19 is fine).

---

## File-by-File Analysis

### `src/core/worker-registry.ts`

**Score**: 5/10
**Issues Found**: 2 blocking, 3 serious, 2 minor

**Analysis**:

The implementation is functionally correct for the happy path: construction hydrates from disk, every mutating method calls `_persist()`, and the graceful-degradation requirement (empty registry on missing/corrupt file) is met. The logic is small and easy to follow.

The problems are in the failure modes. Silent persist failures are the most dangerous because they create a split-brain state: the in-memory registry diverges from the on-disk state, and neither the operator nor the supervisor gets any signal that this happened. The versioning gap means the file format will silently become incompatible as the `Worker` interface evolves — this has already happened once with `launcher` and `log_path` being added to the type.

The naming inconsistency (`_hydrate`/`_persist` vs the rest of the codebase's plain `camelCase` privates) is the most immediately visible style violation.

**Specific Concerns**:

1. `worker-registry.ts:21-23` — Empty catch with comment but no logging. Acceptable for hydration (missing file is normal), but should log on JSON parse errors to distinguish "file not found" from "file is corrupt". These are two distinct failure modes the operator needs to tell apart.
2. `worker-registry.ts:27-33` — Silent catch on persist. This is a blocking anti-pattern violation.
3. `worker-registry.ts:120-123` — Unconditional persist on delete regardless of whether anything was deleted.
4. `worker-registry.ts:7` — `persistPath` should be `readonly`.

---

### `src/index.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**:

The wiring in `index.ts` is clean. The path choice (`~/.session-orchestrator/registry.json`) is a stable, conventional location. Using `{ recursive: true }` on `mkdirSync` is correct. The three lines at the top of the file are easy to follow and do not add unnecessary complexity.

The single serious concern is the unhandled `mkdirSync` failure at module scope — a permissions or filesystem error here will produce a raw crash rather than a diagnostic message.

**Specific Concerns**:

1. `index.ts:18` — `mkdirSync` unhandled exception at module top level.
2. `index.ts:17` — `registryDir` could be named more specifically, though this is minor.

---

## Pattern Compliance

| Pattern                       | Status | Concern                                                                  |
| ----------------------------- | ------ | ------------------------------------------------------------------------ |
| No silent error swallowing    | FAIL   | `_persist()` catch block has no logging — direct anti-pattern violation  |
| Consistent private naming     | FAIL   | `_hydrate`/`_persist` breaks the codebase's plain camelCase convention   |
| Defensive against schema drift| FAIL   | No version field; hydrated workers not merged with factory defaults      |
| Startup errors are descriptive| FAIL   | `mkdirSync` at module level crashes raw on failure                       |
| Delete returns "not found"    | FAIL   | `remove()` is void, always persists, violates the anti-pattern rule      |
| Type safety                   | PASS   | `[string, Worker][]` cast is the only assertion; acceptable here         |
| File size                     | PASS   | 154 lines, within the 200-line service limit                             |
| Import style                  | PASS   | Node built-ins imported with `node:` prefix consistently                 |

---

## Technical Debt Assessment

**Introduced**:
- No schema version in the persisted file creates a silent migration debt every time `Worker` gains a required field.
- Silent persist failures mean operational disk issues are invisible — debt that compounds the longer it takes to notice.
- Batching problem: `pushStatsToRegistry` causes 3 `_persist()` calls per worker per poll cycle. Will become noticeable as worker count grows.

**Mitigated**:
- The core bug (registry wipeout on MCP restart) is addressed.
- The graceful degradation path (start empty on corrupt file) is correctly implemented.

**Net Impact**: Negative. The feature works for the happy path, but the silent failure modes introduce observability debt that will require a follow-up fix once they surface in production.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `_persist()` silently swallows all disk write errors. This is a direct violation of the project anti-pattern rule ("NEVER swallow errors in fire-and-forget calls. At minimum, log them.") and creates an invisible split-brain state between the in-memory registry and the on-disk file. The fix is a one-line log call, but the absence of it makes the implementation non-compliant with a project-level rule.

---

## What Excellence Would Look Like

A 9/10 implementation would include:

1. A wrapping `{ version: 1, entries: [...] }` envelope in the persisted JSON so schema evolution can be detected and handled.
2. A `console.error` (minimum) or structured log in `_persist()`'s catch, plus differentiation in `_hydrate()`'s catch between ENOENT (expected on first start) and JSON parse failure (unexpected corruption).
3. Factory-default merging during hydration (`{ tokens: emptyTokens(), ...worker }`) to guard against missing fields from older file versions.
4. `remove()` returning `boolean` and only persisting on effective deletes.
5. `readonly` on `persistPath`.
6. Methods named `hydrateFromDisk()` / `flushToDisk()` or plain `hydrate()` / `flush()` to match the codebase's camelCase private convention.
7. The `mkdirSync` call wrapped in a try/catch with a descriptive error message.
