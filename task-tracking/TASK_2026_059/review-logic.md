# Code Logic Review — TASK_2026_059

## Review Summary

| Metric              | Value                                  |
| ------------------- | -------------------------------------- |
| Overall Score       | 5/10                                   |
| Assessment          | NEEDS_REVISION                         |
| Blocking Issues     | 2                                      |
| Serious Issues      | 4                                      |
| Minor Issues        | 3                                      |
| Failure Modes Found | 6                                      |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`_persist()` swallows all errors without logging. If the directory is deleted, the disk fills up, or
permissions change at runtime, every subsequent mutation writes nothing to disk — the in-memory
registry diverges from what's on disk with no indication to the caller or operator. The server
continues returning `200 OK` from every MCP tool call while silently accumulating a stale file.
After the next restart the registry hydrates from the stale snapshot rather than the current state.

`_hydrate()` also swallows its error silently. The caller has no way to distinguish "file was
absent (expected on first start)" from "file is corrupt and was ignored". On a machine where the
file is corrupt for a known reason (e.g., partial write during a crash), an operator has no log
entry to point at.

### 2. What user action causes unexpected behavior?

A supervisor calls `kill_worker`, which calls `registry.updateStatus(id, 'killed')` — that
persists correctly. But immediately after the persist the `kill_worker` handler returns without
checking whether the persist succeeded. If the write fails (disk full), the worker shows `killed`
in memory for the rest of this server session. On restart it hydrates from the pre-kill snapshot
and shows the worker as `running` again. The supervisor will re-observe a worker it already killed
as live, and may attempt to kill it again or wait for it indefinitely.

### 3. What data makes this produce wrong results?

**Corrupt-but-valid JSON that is not a `[string, Worker][]` array.** `_hydrate()` does
`JSON.parse(raw)` and immediately iterates `entries` with `for (const [id, worker] of entries)`.
If the file contains valid JSON that is not an array (e.g., `{}` written by a different tool, or
the registry was accidentally serialized as an object rather than an array), `for...of` on a
plain object throws `TypeError: entries is not iterable`. That exception is caught by the bare
`catch {}` and hydration silently starts empty — which is the correct fallback — but the scenario
is indistinguishable from "file didn't exist." This is minor but contributes to the observability
gap.

**More critically:** if the saved array contains an entry whose `Worker` object is missing
required fields (e.g., `launcher` was added to the type after entries were saved), the hydrated
worker will be structurally incomplete. `pushStatsToRegistry` and `autoCloseWorker` in
`JsonlWatcher` dispatch on `worker.launcher`; a missing `launcher` field will fall through to the
`else` (print-mode kill) branch regardless of the original launcher type — potentially sending a
SIGTERM to the wrong PID.

### 4. What happens when dependencies fail?

**Disk full during `_persist()`:** The `writeFileSync` call in `_persist()` is wrapped in `try {}
catch {}`. If the write throws (ENOSPC, EACCES, EROFS, etc.), the error is swallowed. There is
no retry, no log, no degraded-mode flag, and no caller notification. The registry continues
mutating in memory. The on-disk file either still has the previous snapshot (if the write failed
before truncating) or is zero-length / corrupted (if the write was interrupted mid-truncate). A
subsequent restart will hydrate from a stale or corrupt state.

**Parent directory deleted after startup:** `mkdirSync` is called once at module load in
`index.ts`. If `~/.session-orchestrator` is deleted while the server is running, every subsequent
`_persist()` call throws ENOENT, which is swallowed. Same divergence scenario as above.

**File permissions revoked:** Same outcome. No indication.

### 5. What's missing that the requirements didn't mention?

- **Atomic write**: `writeFileSync` to `registry.json` truncates the file before writing the new
  content. If the process crashes mid-write (power loss, SIGKILL, OOM) the file is left partially
  written. On restart `readFileSync` gets partial JSON, `JSON.parse` throws, `_hydrate()` catches
  and starts empty — all workers are lost despite the persistence feature existing. The standard
  mitigation is write-to-temp-then-rename: `writeFileSync(path + '.tmp', data)` followed by
  `renameSync(path + '.tmp', path)`. `renameSync` is atomic on POSIX at the filesystem level.
  The task spec says `writeFileSync` is fine but does not account for mid-write crashes.

- **Persist-on-remove missing on non-existent ID**: `remove(workerId)` calls
  `this.workers.delete(workerId)` unconditionally. `Map.delete` is a no-op when the key does not
  exist, but `_persist()` is still called, writing the unchanged registry to disk. This is
  harmless but wasteful. More importantly it means there is no way for the caller to detect
  "remove was called on a worker that was never registered" — the anti-patterns doc says
  delete-on-non-existent must return a not-found indicator.

- **Write amplification from polling loop**: `JsonlWatcher.pollAll()` fires every 3 seconds and
  calls `registry.updateTokens()`, `registry.updateCost()`, and `registry.updateProgress()` on
  every active worker. Each of those calls now triggers a full `writeFileSync`. With 5 active
  workers that is 3 writes × 5 workers × (60 / 3) = 300 `writeFileSync` calls per minute to the
  same file. This was not a concern before persistence. No acknowledgement of this amplification
  exists in the implementation.

- **No schema version in the persisted file**: The `Worker` type will evolve. When a new field is
  added (e.g., a future `cost_usd_today` field), hydrated workers from older snapshots will have
  `undefined` for that field. All callers already receive `Worker` typed objects and may call
  `.toFixed()` or arithmetic on numeric fields without a `?? 0` guard. No migration path exists.

- **`remove()` returns `void` but the `kill_worker` handler never calls it**: Looking at
  `kill_worker` in `index.ts` (line 157), the handler calls `registry.updateStatus(id, 'killed')`
  but does NOT call `registry.remove(id)`. The killed worker is never removed from the registry or
  from disk. On the next restart it re-appears as `killed` in `list_workers`. This is documented
  behavior (supervisor reconciles stale entries), but the requirement says "every mutation flushes
  to disk (register, kill, ...)" — the `remove` method exists and is called nowhere in the current
  codebase. It is dead code from the persistence perspective.

---

## Failure Mode Analysis

### Failure Mode 1: Mid-Write File Corruption on Process Crash

- **Trigger**: MCP server receives SIGKILL (OOM, force-quit) at the exact moment `writeFileSync`
  has truncated `registry.json` but not yet written the new content.
- **Symptoms**: On next startup `readFileSync` returns an empty string or partial JSON.
  `JSON.parse('')` throws `SyntaxError`. `_hydrate()` catches it silently. Registry starts empty.
  All previously registered workers are gone. `list_workers` returns "No workers tracked" even
  though the processes are still running.
- **Impact**: Supervisor believes no workers exist, spawns duplicates, drives up cost.
- **Current Handling**: Silent catch in `_hydrate()`. Data is permanently lost.
- **Recommendation**: Use write-to-temp + `renameSync` pattern so the old file is preserved if
  the write is incomplete.

### Failure Mode 2: Silent Persist Failure Diverging In-Memory from On-Disk

- **Trigger**: Disk fills up (ENOSPC), directory removed, or permissions revoked at runtime.
- **Symptoms**: All `_persist()` calls after the failure silently do nothing. In-memory state is
  authoritative for the current session but the file on disk holds a stale snapshot. On restart
  the registry hydrates from the stale snapshot.
- **Impact**: Status updates, token counts, and cost figures hydrated on restart are from hours
  ago. Workers shown as `running` may have been killed. Workers shown as `completed` may have
  never existed.
- **Current Handling**: `catch {}` in `_persist()` — complete silence.
- **Recommendation**: At minimum `console.error('[WorkerRegistry] persist failed:', err)`. Consider
  setting a `_persistFailed` flag and returning it via a health endpoint so operators can detect
  the problem.

### Failure Mode 3: Write Amplification Thrashing the Home Directory

- **Trigger**: Multiple active workers being polled by `JsonlWatcher`.
- **Symptoms**: 3 separate `writeFileSync` calls per active worker per 3-second poll cycle. With
  10 workers: 90 writes/minute to a single file. On slow disks or network home directories (NFS,
  SMB) this can cause meaningful latency spikes or I/O errors.
- **Impact**: Degraded MCP server responsiveness. On slow filesystems `writeFileSync` can block
  the Node.js event loop (it is synchronous), delaying all subsequent MCP tool responses during
  the write.
- **Current Handling**: Not handled. Each mutation method calls `_persist()` independently.
- **Recommendation**: Batch writes with a debounced flush (e.g., 500ms `setTimeout` after any
  mutation, cancelled and reset on each new mutation). This reduces peak write frequency from
  O(mutations) to O(1 per 500ms).

### Failure Mode 4: Structurally Incomplete Workers After Schema Evolution

- **Trigger**: New field added to `Worker` type in a future commit. Server restarts, hydrates old
  registry.json entries that lack the new field.
- **Symptoms**: Workers have `undefined` for the new field. Code that accesses `w.newField` gets
  `undefined`. If arithmetic is performed on it (e.g., token totals), result is `NaN`. If the
  field is used in a conditional, it evaluates falsy silently.
- **Impact**: Silently wrong stats, potential NaN propagation in cost calculations.
- **Current Handling**: None. No schema version. No migration step. No post-hydration validation.
- **Recommendation**: Add a `_schemaVersion` field to the persisted format. On hydration, validate
  each entry with a runtime type guard and fill missing numeric fields with `0`, missing strings
  with `''`, missing booleans with safe defaults.

### Failure Mode 5: `remove()` Is Dead Code — Never Called

- **Trigger**: `remove(workerId)` is only path for deleting a worker from the registry. No call
  site in the entire codebase invokes it. `kill_worker` calls `updateStatus` to `'killed'` but
  leaves the entry in the map.
- **Symptoms**: Over time, `list_workers` accumulates every worker ever registered since the
  registry was first created, including workers from weeks ago with `killed` / `completed` status.
  With no eviction, the registry.json grows unboundedly.
- **Impact**: Growing file size (minor for typical usage), but more importantly: `list('all')`
  returns an ever-growing list, and there is no garbage collection or TTL mechanism.
- **Current Handling**: None. No TTL, no eviction, no max-size guard.
- **Recommendation**: This is a pre-existing design gap but persistence makes it permanent (was
  previously wiped on restart). Document the intended eviction strategy or add a TTL-based cleanup
  for `completed`/`killed`/`failed` entries older than N days.

### Failure Mode 6: `Worker.launcher` Undefined on Old Hydrated Entries

- **Trigger**: Registry.json was written before the `launcher` field was added to the `Worker`
  type (or written by a future version that removed the field). On hydration, the worker's
  `launcher` is `undefined`.
- **Symptoms**: In `JsonlWatcher.pollAll()`, the check `if (worker.launcher === 'print' ||
  worker.launcher === 'opencode')` evaluates false. The worker falls through to the iTerm branch
  (`readNewLines` on a JSONL path that may be empty-string). In `autoCloseWorker`, the `if
  (worker.launcher === 'iterm')` check is false, `else if (worker.launcher === 'opencode')` is
  false, so `killPrintProcess(worker.pid)` is called on what may have been an iTerm-launched
  process. Wrong kill function, wrong PID handling.
- **Impact**: Stale workers processed incorrectly on restart; potential kill-of-wrong-process.
- **Current Handling**: None. No post-hydration validation of `launcher` field.
- **Recommendation**: Add a post-hydrate validation pass: if `launcher` is missing or not in the
  known union, set it to `'print'` as a safe default and log a warning.

---

## Blocking Issues

### Blocking Issue 1: `_persist()` Silently Swallows All Errors

- **File**: `src/core/worker-registry.ts:26-33`
- **Scenario**: Disk full, directory deleted, permissions revoked — any I/O error on `writeFileSync`.
- **Impact**: In-memory registry diverges from on-disk state. On restart, hydration produces
  stale data with no indication of the problem. Supervisor sees old state. Workers are
  misclassified.
- **Evidence**:
  ```typescript
  private _persist(): void {
    try {
      const entries = Array.from(this.workers.entries());
      writeFileSync(this.persistPath, JSON.stringify(entries), 'utf-8');
    } catch {
      // Best-effort — do not crash on persist failure
    }
  }
  ```
  The comment says "best-effort" but logging the error costs nothing and prevents hours of
  debugging a stale registry.
- **Fix**: Add `console.error('[WorkerRegistry] persist failed:', err)` in the catch block.
  Optionally expose a `persistFailed: boolean` property so health checks can surface this.

### Blocking Issue 2: Non-Atomic `writeFileSync` — File Corrupted on Mid-Write Crash

- **File**: `src/core/worker-registry.ts:29`
- **Scenario**: Process receives SIGKILL or system power-cycles at the exact moment
  `writeFileSync` has opened and truncated `registry.json` but not finished writing.
- **Impact**: `registry.json` is left empty or half-written. On restart `_hydrate()` reads a
  corrupt file, catches `SyntaxError`, starts empty. All worker state is permanently lost.
  This is the exact failure mode the persistence feature is meant to prevent.
- **Evidence**: `writeFileSync(this.persistPath, ...)` truncates the target file in-place before
  writing. POSIX does not guarantee atomicity for `write()` beyond a single block.
- **Fix**: Write to a `.tmp` sibling first, then `renameSync` to the final path:
  ```typescript
  import { writeFileSync, renameSync } from 'node:fs';
  const tmp = this.persistPath + '.tmp';
  writeFileSync(tmp, JSON.stringify(entries), 'utf-8');
  renameSync(tmp, this.persistPath);
  ```
  `renameSync` is atomic on POSIX (single filesystem). The old file is preserved until the new
  write completes.

---

## Serious Issues

### Serious Issue 1: Write Amplification from Polling Loop

- **File**: `src/core/worker-registry.ts`, driven by `src/core/jsonl-watcher.ts:284-317`
- **Scenario**: 5 active workers, 3-second poll interval. Each `pushStatsToRegistry` call invokes
  `updateTokens` + `updateCost` + `updateProgress` = 3 `_persist()` calls per worker per tick =
  15 `writeFileSync` calls per tick = 300 calls/minute to the same file.
- **Impact**: On slow or network-mounted home directories, each synchronous `writeFileSync` blocks
  the Node.js event loop. Burst writes can cause perceptible MCP tool latency. On NFS mounts, a
  single write can take 200-500ms, stalling all tool calls.
- **Fix**: Debounce `_persist()` with a 500ms timeout reset on each call. Or batch: accumulate
  a `_dirty` flag, and flush on a fixed interval (e.g., 2s) rather than synchronously on every
  mutation.

### Serious Issue 2: `remove()` Is Dead Code — Registry Grows Without Bound

- **File**: `src/core/worker-registry.ts:120-123`, `src/index.ts` (no call site)
- **Scenario**: Every registered worker (spawned, killed, completed, failed) accumulates in the
  registry file indefinitely. After weeks of operation, `registry.json` contains thousands of
  entries, all with terminal statuses.
- **Impact**: `list_workers` output becomes noisy; the on-disk file grows without bound; no
  mechanism to clean up stale entries. Persistence makes this permanent where previously it was
  reset on restart.
- **Fix**: Define a retention policy (e.g., evict entries with terminal status older than 7 days
  on hydration, or on `_persist()` when the registry exceeds N entries). At minimum, document the
  intended eviction strategy in a comment.

### Serious Issue 3: Post-Hydration Worker Integrity Not Validated

- **File**: `src/core/worker-registry.ts:14-24`
- **Scenario**: Old `registry.json` was written by a version of the server that predates a field
  addition (`launcher`, `provider`, `log_path`, etc.). Hydrated workers have `undefined` for the
  new field. Downstream code in `jsonl-watcher.ts` dispatches on `worker.launcher` with no
  null-guard.
- **Impact**: Wrong launcher branch executed for stale workers. For `autoCloseWorker`, this can
  send a kill signal using the wrong mechanism (e.g., `killPrintProcess` on an iTerm-launched PID).
- **Fix**: After hydration, apply a post-load migration function that sets safe defaults for any
  field that TypeScript considers required but may be absent in the JSON (use `worker.launcher ??
  'iterm'`, etc.).

### Serious Issue 4: `mkdirSync` at Module Load — No Runtime Recreation

- **File**: `src/index.ts:18`
- **Scenario**: `mkdirSync(registryDir, { recursive: true })` runs once at startup. If
  `~/.session-orchestrator` is deleted or moved while the server is running, the next
  `_persist()` call throws ENOENT. That error is caught and swallowed. Registry updates are lost
  silently for the rest of the session.
- **Impact**: Same divergence risk as Blocking Issue 1, triggered by a directory lifecycle event.
- **Fix**: Move the `mkdirSync` call inside `_persist()` before the write, or add it to the
  catch/retry logic. `mkdirSync` with `{ recursive: true }` is a no-op if the directory already
  exists, so calling it on every write has negligible overhead.

---

## Minor Issues

### Minor Issue 1: `_hydrate()` Catch Is Bare — No Log on Corrupt File

- **File**: `src/core/worker-registry.ts:21-23`
- **Scenario**: `registry.json` is corrupt (partial write, manual edit, encoding error). The file
  is silently discarded. An operator trying to understand why workers disappeared after a restart
  has no log entry to examine.
- **Fix**: Log at least a `console.warn` distinguishing `ENOENT` (expected) from `SyntaxError`
  (unexpected): if `err.code !== 'ENOENT' && !(err instanceof SyntaxError && raw === '')` then
  log the error. This is low-noise for the common case and diagnostic for the unusual one.

### Minor Issue 2: `remove()` Does Not Return a Not-Found Indicator

- **File**: `src/core/worker-registry.ts:120-123`
- **Evidence**:
  ```typescript
  remove(workerId: string): void {
    this.workers.delete(workerId);
    this._persist();  // called even when nothing was deleted
  }
  ```
- **Anti-pattern**: `anti-patterns.md` — "Delete/update on non-existent ID must return a
  'not found' indicator, not silent success." `Map.delete` returns `boolean`; this is ignored.
  `_persist()` is called even when nothing changed.
- **Fix**: Return `boolean` from `remove()` (the result of `this.workers.delete(workerId)`) and
  skip `_persist()` when the key was not present.

### Minor Issue 3: No `updateCost` in `kill_worker` Handler — Cost Not Persisted at Final Moment

- **File**: `src/index.ts:157`
- **Scenario**: `kill_worker` calls `registry.updateStatus(id, 'killed')`, which persists. But
  the `lines` array that is returned to the caller includes `w.cost.total_usd` — read from the
  in-memory state just before the status update. The final cost at kill time is NOT separately
  persisted; it relies on whatever the last poller wrote. If the poller has not run recently, the
  persisted cost is stale at the moment of kill.
- **Impact**: Minor — next poll cycle would have updated cost anyway, but the worker is now
  `killed` and won't be polled again. The cost displayed in `list_workers` after restart reflects
  the last polled cost, not the cost at kill time.
- **Fix**: Consider explicitly calling `registry.updateCost(id, w.cost)` inside `kill_worker`
  before the status update to snapshot the final cost at termination time.

---

## Data Flow Analysis

```
spawn_worker (MCP call)
  -> handleSpawnWorker()
    -> launchWith[Print|Iterm|OpenCode]()   [process spawned]
    -> registry.register(opts)              [in-memory Map.set + _persist() to disk]
      -> writeFileSync(registry.json)       [BLOCKING: can fail silently, not atomic]
  -> returns worker_id to caller

JsonlWatcher.pollAll() [every 3s]
  -> registry.list('active')               [reads in-memory Map]
  -> for each worker:
      -> registry.updateTokens()            [_persist() #1]   <-- 3 writes per worker per tick
      -> registry.updateCost()              [_persist() #2]
      -> registry.updateProgress()          [_persist() #3]

kill_worker (MCP call)
  -> registry.get(worker_id)               [reads in-memory Map]
  -> kill process
  -> registry.updateStatus(id, 'killed')   [_persist() to disk]
  [registry.remove() is NEVER called here — worker stays in map/file forever]

--- MCP server restart ---

WorkerRegistry constructor()
  -> _hydrate()
    -> readFileSync(registry.json)          [can read partial file if prev write crashed]
    -> JSON.parse(raw)                      [throws on corrupt JSON — caught silently]
    -> for [id, worker] of entries          [no validation of worker shape]
      -> this.workers.set(id, worker)       [launcher=undefined if schema evolved]
```

**Gap Points Identified:**
1. `writeFileSync` in `_persist()` is not atomic — crash mid-write leaves corrupt file
2. `_persist()` errors are swallowed with no log — operator cannot detect divergence
3. No post-hydration shape validation — structurally incomplete workers reach `JsonlWatcher`
4. `remove()` is never called — registry grows without bound on disk
5. 3 writes per active worker per poll tick — write amplification not bounded

---

## Acceptance Criteria Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| On restart, `list_workers` returns all pre-restart workers | COMPLETE | Correct under happy-path; broken on mid-write crash (Blocking Issue 2) |
| Workers loaded from disk appear with last-known status | COMPLETE | Correct for happy-path; schema-evolved workers may have wrong shape (Serious Issue 3) |
| Every mutation flushes to disk | COMPLETE | Technically true, but `remove()` is dead code and writes are not atomic |
| Missing or corrupt file on startup — no crash | COMPLETE | Bare `catch {}` prevents crash; but no log distinguishes ENOENT from corruption (Minor Issue 1) |
| TypeScript compiles cleanly | LIKELY COMPLETE | No type errors observed in review; cannot run compiler without environment |

### Implicit Requirements NOT Addressed

1. **Atomic writes** — the task spec says `writeFileSync` is acceptable, but does not account for
   the crash-during-write scenario that defeats the entire purpose of persistence.
2. **Write amplification budget** — no acknowledgement that 3 writes/worker/tick occurs, nor any
   mitigation.
3. **Registry eviction / TTL** — persistence makes the pre-existing lack of eviction a permanent
   accumulation problem.
4. **Schema migration** — no versioning or migration as the `Worker` type evolves.
5. **Persist-failure observability** — operators need to know when disk persistence stops working.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| `registry.json` absent on first start | YES | `catch {}` in `_hydrate()` | No log to confirm expected path |
| `registry.json` contains valid non-array JSON | YES (accident) | `for...of` throws, caught by `catch {}` | Indistinguishable from ENOENT |
| `registry.json` is empty string | YES (accident) | `JSON.parse('')` throws, caught | Same — silent |
| Partial / corrupt JSON (mid-write crash) | YES (accident) | `JSON.parse` throws, caught | Data permanently lost; no atomic write protection |
| `_persist()` throws ENOSPC / EACCES | PARTIAL | Swallowed, no crash | Silent divergence; no operator signal |
| `~/.session-orchestrator` deleted at runtime | NO | `_persist()` throws ENOENT, swallowed | Silent divergence |
| Worker with missing `launcher` field on hydration | NO | Hydrated as-is, `undefined` field passed downstream | Wrong kill branch in `autoCloseWorker` |
| Rapid concurrent mutations (burst spawns) | PARTIAL | Node.js is single-threaded; no concurrent writes from JS | Still causes write amplification |
| Registry file grows over months | NO | No TTL or eviction logic | Unbounded growth |
| `remove()` called on non-existent ID | PARTIAL | No-op + unnecessary `_persist()` | Anti-pattern violation; no not-found indicator |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| `writeFileSync` to `~/.session-orchestrator/registry.json` | LOW-MEDIUM (disk full, perms) | HIGH — silent divergence on restart | Add error logging; use atomic write |
| `readFileSync` + `JSON.parse` on hydration | LOW (file exists, valid) | HIGH — start empty, all workers lost | Already caught; add ENOENT vs corrupt distinction |
| `JsonlWatcher.pollAll()` triggering 3 writes/worker/tick | CERTAIN | MEDIUM — I/O pressure on busy servers | Debounce or batch writes |
| `Worker` schema evolution vs persisted snapshots | CERTAIN (over time) | MEDIUM — undefined fields reach code that assumes presence | Add post-hydrate validation |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Non-atomic `writeFileSync` means the persistence feature can destroy all worker
state on a crash — exactly the failure mode it was built to prevent. This should be fixed before
the feature is relied on in production.

---

## What Robust Implementation Would Include

1. **Atomic write** via write-to-temp + `renameSync` — prevents corrupt file on crash.
2. **Error logging in `_persist()`** — `console.error` at minimum; a `_persistFailed` flag for
   health checks.
3. **Debounced flush** — accumulate a dirty flag, flush on a 500ms debounce or fixed 2s interval.
   Eliminates write amplification from the polling loop.
4. **Post-hydration validation** — iterate hydrated workers, apply safe defaults for fields
   missing from older serialized snapshots. Log a warning per repaired entry.
5. **Schema version field** — embed `{ schemaVersion: 1, workers: [...] }` in the persisted
   format. Migration functions keyed by version enable forward-compatible upgrades.
6. **TTL eviction on hydration** — discard `completed`/`killed`/`failed` entries older than N
   days during `_hydrate()` to prevent unbounded growth.
7. **`remove()` returning `boolean`** and skipping persist when no-op — alignment with the
   anti-patterns contract.
8. **ENOENT-vs-corrupt distinction in `_hydrate()`** — `console.warn` only when the file exists
   but is unreadable; stay silent when ENOENT.
