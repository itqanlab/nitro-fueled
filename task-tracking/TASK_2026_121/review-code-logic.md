# Code Logic Review — TASK_2026_121

## Score: 5/10

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `pollAll()` in `JsonlWatcher` catches a dead process and marks it `completed` unconditionally, even if the process was killed by `kill_worker`. The `onExit` callback in `spawn.ts` also updates the status to `completed`/`failed` on exit. These two paths race: if the process dies naturally between polls, `pollAll` fires first and sets `completed`; then the `onExit` fires and also tries to write `completed`/`failed`. No guard prevents the double write. Worse, if a process was killed by `kill_worker` (already set to `killed`), the `onExit` callback will overwrite it with `completed` or `failed`, silently reverting the user-visible status. This is a concrete silent state corruption bug.

- `handleSpawnWorker` inserts the DB row **after** the process is already spawned and the `onExit` / `onMessage` callbacks are registered. If `onExit` fires before the INSERT completes (race between process exit and the INSERT), the UPDATE in `onExit` targets a non-existent row (`changes === 0`, silently ignored). Token accumulator data is lost. No retry. No error surfaced.

- Token accumulation in `JsonlWatcher.processMessage` uses the `result` message type to **overwrite** the running total (`acc.totalInput = usage.input_tokens`), while `assistant` messages **accumulate** (`acc.totalInput += ...`). If a `result` message arrives mid-session, it resets the accumulator using the single-session total, discarding all previous compaction-era additions. Whether this is correct depends entirely on whether `result.usage` is a cumulative total or a per-message delta. This is not documented and the behavior is asymmetric to the `assistant` path — a silent cost miscalculation.

- `killWorkerProcess` removes the child from `childProcesses` before confirming the process died. If SIGTERM is sent but the process ignores it (it takes 5 seconds before SIGKILL), the `onExit` callback fires later, which does not re-add the pid. The process still runs but `childProcesses` thinks it is gone. The watcher's `isProcessAlive(pid)` will still return true for the 5-second window, keeping the worker `active` in the DB. No timeout logic accounts for this window.

### 2. What user action causes unexpected behavior?

- Calling `subscribe_worker` twice for the same `worker_id` re-registers silently via `cleanup(workerId)` which closes the old watchers and starts fresh. But the old `sub` object was passed by reference into the previous chokidar event handler closures (`onEvent` captures `sub`). After cleanup, `sub.satisfied` is `true` from the previous evaluation cycle, so the orphaned closures immediately bail (`if (sub.satisfied) return`). This is safe for the old closures, but there is no feedback to the caller that the previous subscription was destroyed. The supervisor can lose the event it was waiting for.

- Calling `kill_worker` on an already-completed or already-killed worker succeeds silently: there is no guard checking the current `status` before issuing SIGTERM. The PID column holds the original pid, which could have been recycled by the OS and assigned to a completely different process. `killWorkerProcess` will send SIGTERM to that unrelated process. This is a correctness and safety issue.

- Calling `update_session` with `loop_status = 'stopped'` while `end_session` is running in parallel produces a race: both update the `loop_status` column. `end_session` hard-codes `loop_status = 'stopped'` in its UPDATE, so the winner depends on timing.

### 3. What data makes this produce wrong results?

- `contextPercent` in `pushStatsToDB` is calculated as `Math.round((acc.lastInputTokens / 1_000_000) * 100)`. For a 200k-token context window model, a 100k context produces `10%` — not `50%`. The formula divides by one million tokens, which would only give 100% at 1M input tokens. The field name is `context_percent` but the value is not a percent of the model's actual context window. All health calculations that use `context_percent > 80` will never trigger until a worker is pushing 800k tokens — likely never under normal conditions.

- `getHealth` returns `'finished'` when `!row.pid || !isProcessAlive(row.pid)`, even when the worker row has `status = 'active'` in the DB. This can give a health of `'finished'` for a legitimately active worker whose OS re-assigned the PID — `isProcessAlive` uses `process.kill(pid, 0)` which just asks the OS if the PID exists, not if it is the correct process.

- The compaction detector fires when `usage.input_tokens < acc.lastInputTokens * 0.7`. This threshold-based heuristic produces false positives: if the model naturally switches to a shorter conversation (e.g., after a tool result clears the context), it increments `compactionCount`. Once `compactionCount >= 2`, health is permanently reported as `'compacting'` even if the worker is healthy. There is no way to clear this flag.

- Pricing table contains `'claude-opus-4-6'` and `'claude-sonnet-4-6'` but the real Anthropic model IDs are versioned strings like `claude-opus-4-5` or include `-20251001` suffixes. A mismatch means any worker using those models reports `$0` cost (the `ZERO_PRICING` fallback path) with only a `console.warn` that goes to stderr, silently visible only in logs.

- `handleListWorkers` returns plain-text formatted strings, not JSON. Every other tool returns `JSON.stringify(...)`. The supervisor calling `list_workers` in a pipeline expecting a structured result will receive unstructured text, making programmatic parsing of worker status unreliable.

### 4. What happens when dependencies fail?

- If the `claude` binary is not on PATH, `spawnWorkerProcess` throws an Error after spawning returns `!child.pid`. But the child event listeners (`stdout`, `stderr`, `exit`) are already attached. The DB INSERT never runs, so no worker row exists. However, the `onExit` callback still fires (referencing `workerId`) and attempts `db.prepare('UPDATE workers ...').run(newStatus, workerId)` on a row that does not exist. The UPDATE silently affects 0 rows. The caller sees a thrown exception from `handleSpawnWorker`, but the watcher state is left with a dangling entry in the `childProcesses` map (pid was never added since `!child.pid` throws first — actually the pid IS undefined so `childProcesses.set` never runs, this part is safe, but the thrown error propagates uncaught through the MCP tool handler in `index.ts` since no try/catch wraps `handleSpawnWorker`).

- If the SQLite database is locked or busy when `pushStatsToDB` runs inside `feedMessage`, the `db.prepare(...).run(...)` throws a `SQLITE_BUSY` error. This error is unhandled — it propagates up through `feedMessage` → `onMessage` callback → `child.stdout.on('data')` handler. An unhandled exception inside a Node.js stream event listener will crash the MCP server process.

- If `readFile` fails in `evaluateCondition` after the one retry, `sub.satisfied = false` is set and the subscription remains active but the watcher listeners are still attached. The subscription never fires. No timeout or fallback ensures the supervisor ever gets unblocked from waiting on this event.

- `jsonlWatcher.start()` is called unconditionally at server startup. If the database is in a bad state, `pollAll` will throw on every 3-second tick with no error handling — unhandled rejection every 3 seconds.

### 5. What's missing that the requirements didn't mention?

- No `session_id` filtering in `get_pending_events`. The description in `index.ts` explicitly notes "not yet implemented" for the `session_id` parameter. In a multi-session environment, the supervisor draining events will receive events from workers belonging to other sessions. This is not a future concern — it is a correctness gap in the current multi-session use case.

- No mechanism to recover accumulators after a server restart. If nitro-cortex crashes and restarts while workers are `active`, the in-memory `accumulators` map is empty. Token counts restart from zero; cost resets to $0. The DB retains the last flushed stats, but any accumulation from the current session window is lost.

- No maximum context window stored per worker. The `context_percent` field is computed against an implicit 1M-token denominator rather than the actual context window of the model in use. There is no model → context-size mapping.

- No deduplication on `filesRead`/`filesWritten`. These are `Set<string>` in memory but serialized as arrays in `progress_json`. After a restart, they become plain arrays in the DB. If the accumulator is re-initialized (e.g., after restart), the Set starts fresh and the historical file list is discarded.

- No `UNCAUGHT_EXCEPTION` / `unhandledRejection` handler in `index.ts`. A thrown error in any SQLite call within a stream event listener will crash the process with no recovery. The supervisor will lose its MCP connection with no diagnostic.

---

## Findings

### [SEVERITY: HIGH] `onExit` callback overwrites `killed` status set by `kill_worker`

**File**: `packages/mcp-cortex/src/tools/workers.ts:97-100` and `packages/mcp-cortex/src/process/spawn.ts:89-93`

**Issue**: `handleKillWorker` sets `status = 'killed'` in the DB, then the OS sends SIGTERM to the process. When the process eventually exits, the `onExit` callback in `spawn.ts` fires and sets `status = 'completed'` (if exit code is 0) or `status = 'failed'`. This overwrites the `killed` status, making the kill invisible in the DB.

**Impact**: The supervisor sees the worker as `completed` and may schedule follow-up actions (e.g., review tasks) for a worker that was intentionally terminated. Auditing/cost-tracking is also corrupted since the true termination reason is lost.

**Suggestion**: Check the current DB status before writing in `onExit`. If `status = 'killed'`, do not overwrite. Alternatively, pass a cancellation flag through the spawn closure.

---

### [SEVERITY: HIGH] DB INSERT races against process exit in `handleSpawnWorker`

**File**: `packages/mcp-cortex/src/tools/workers.ts:87-114`

**Issue**: The process is spawned and its callbacks registered before the `INSERT INTO workers` runs. On a fast-exiting process (immediately failed), `onExit` fires and executes `UPDATE workers SET status = ? WHERE id = ?` before the INSERT has committed. The UPDATE silently no-ops, and `tokens_json`/`cost_json` are never written for that worker.

**Impact**: Workers that fail quickly have no DB record or have a `status = 'active'` record that never transitions — they appear stuck.

**Suggestion**: Insert the DB row immediately with `status = 'active'` before calling `spawnWorkerProcess`. Pass the `workerId` into `spawnWorkerProcess` as a parameter rather than closing over it after the fact.

---

### [SEVERITY: HIGH] `SQLITE_BUSY` in `pushStatsToDB` crashes the MCP server

**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:200-202`

**Issue**: `pushStatsToDB` calls `db.prepare(...).run(...)` synchronously inside the `onMessage` callback, which fires from a `child.stdout.on('data')` stream event. If better-sqlite3 throws (e.g., `SQLITE_BUSY`, `SQLITE_LOCKED`), the error propagates to the stream event listener with no try/catch. Node.js will emit an uncaught exception and crash the server.

**Impact**: A transient SQLite lock (e.g., from a concurrent `claim_task` in WAL mode) kills the MCP server during an active orchestration run.

**Suggestion**: Wrap `pushStatsToDB` in a try/catch. Log failures to stderr but do not rethrow. Stats are best-effort; token loss is tolerable but a crash is not.

---

### [SEVERITY: HIGH] `context_percent` formula is wrong — health checks never trigger

**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:179`

**Issue**: `contextPercent = Math.round((acc.lastInputTokens / 1_000_000) * 100)`. This produces a percentage where 100% corresponds to 1 million tokens. For a 200k context model with 150k tokens in context, this yields `15%` — `context_percent` will never exceed 80 for any realistic worker, so `getHealth()` can never return `'high_context'`.

**Impact**: The health monitoring system silently never fires `high_context`. Supervisors relying on this signal to preemptively manage context load are flying blind.

**Suggestion**: The formula should divide by the model's actual context window size: `Math.round((lastInputTokens / contextWindowTokens) * 100)`. Requires a model → context-size table alongside the pricing table.

---

### [SEVERITY: HIGH] `get_pending_events` has no `session_id` filter — events leak across sessions

**File**: `packages/mcp-cortex/src/index.ts:205-210` and `packages/mcp-cortex/src/events/subscriptions.ts:188-191`

**Issue**: The `session_id` parameter is declared in the tool's `inputSchema` and described as "not yet implemented". `handleGetPendingEvents` completely ignores it and drains the entire global queue. In a multi-session deployment (the primary use case), Supervisor A calling `get_pending_events` will consume events intended for Supervisor B, and Supervisor B will never see them.

**Impact**: This is a correctness failure for the stated multi-session use case. Events are consumed destructively (drained), so the losing supervisor can wait forever. The acceptance criterion "All session-orchestrator tools are functionally equivalent in nitro-cortex" fails here — `session_id` filtering was presumably present in the original orchestrator.

**Suggestion**: `WatchEvent` already carries `worker_id`. Add `session_id` to `WatchEvent` (populated from the DB at subscribe time), then filter in `drainEvents(sessionId?: string)`.

---

### [SEVERITY: HIGH] `kill_worker` can SIGTERM an unrelated OS process via recycled PID

**File**: `packages/mcp-cortex/src/tools/workers.ts:217-243`

**Issue**: `handleKillWorker` reads `w.pid` from the DB and calls `killWorkerProcess(w.pid)`. There is no check that the worker `status` is still `active`. If the worker has already exited, the PID has been released and may be re-assigned by the OS to an unrelated process. SIGTERM is then sent to that process.

**Impact**: Calling `kill_worker` on a completed worker silently terminates an unrelated system process. This is a correctness and safety defect.

**Suggestion**: Check `w.status` before issuing the kill. If `status !== 'active'`, return an appropriate response without touching the OS.

---

### [SEVERITY: MEDIUM] `handleUpdateSession` whitelist is missing `ended_at` and `summary`

**File**: `packages/mcp-cortex/src/tools/sessions.ts:7-9`

**Issue**: `UPDATABLE_SESSION_COLUMNS` contains: `loop_status`, `tasks_terminal`, `config`, `task_limit`, `source`. The columns `ended_at` and `summary` are absent. Callers that want to update these fields without calling `end_session` (e.g., to record a partial summary mid-session) cannot do so. The MCP description for `update_session` says "Partial update of session fields (loop_status, tasks_terminal, config, etc.)" — the "etc." implies coverage of all mutable columns.

**Impact**: Partial — `end_session` still provides a complete path. But any agent that calls `update_session` with `summary` or `ended_at` will silently get `{ ok: false, reason: "column 'summary' not updatable" }` with no hint that `end_session` is the right tool.

**Suggestion**: Either add `ended_at` and `summary` to the whitelist, or improve the error message to say "use `end_session` to set `ended_at` and `summary`".

---

### [SEVERITY: MEDIUM] Token double-counting: `result` message resets to single-session total, `assistant` messages accumulate

**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:113-122`

**Issue**: The `result` message handler assigns `acc.totalInput = usage.input_tokens` (overwrite) while the `assistant` handler does `acc.totalInput += usage.input_tokens` (accumulate). The semantics are asymmetric and undocumented. If the `result.usage` fields are cumulative session totals, then the overwrite on `result` is correct and the `assistant` accumulation has been double-counting all along. If `result.usage` is a final-message delta, then the overwrite discards accumulated data.

**Impact**: Cost calculations are either systematically overstated (from `assistant` accumulation followed by overwrite with a lower cumulative total) or understated (if the overwrite wipes real accumulated data). Either way, one of the two paths is wrong for every worker.

**Suggestion**: Document the contract of `result.usage` (is it cumulative or delta?) and make both paths consistent with that contract.

---

### [SEVERITY: MEDIUM] Compaction count never resets — permanent `'compacting'` health after 2 false positives

**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:136-139` and `packages/mcp-cortex/src/tools/workers.ts:48`

**Issue**: `compactionCount` only increments. `getHealth()` returns `'compacting'` if `compactionCount >= 2`. The heuristic (`input < 70% of previous`) fires on any large context reduction, including normal tool-result summarization. After 2 triggers, health is permanently `'compacting'` for the life of the worker.

**Impact**: Supervisors that gate on `health !== 'compacting'` before spawning new tasks will stall permanently if any worker's count reaches 2.

**Suggestion**: Track per-message compaction events as a sliding window or time-bounded flag rather than a lifetime counter. Alternatively, only count events where input drops to under 30% of previous (tighter threshold reduces false positives).

---

### [SEVERITY: MEDIUM] `auto_close` race: process killed, then DB update races against `onExit` callback

**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:76-84`

**Issue**: `pollAll` calls `killWorkerProcess(row.pid)`, sets `acc.autoCloseTriggered = true`, calls `pushStatsToDB`, then sets `status = 'completed'` and deletes the accumulator. Concurrently, the `onExit` callback fires (once the process actually terminates) and also sets the status to `completed` (code=0) or `failed`. If the exit code is non-zero (the worker was killed by SIGTERM), `onExit` sets `status = 'failed'`, overwriting the `completed` set by `pollAll`.

**Impact**: A successfully auto-closed worker can be marked `failed` if the exit code reflects the kill signal. This creates a misleading post-session report showing failures.

**Suggestion**: Same fix as the `kill_worker` race: check current DB status in `onExit` before writing, or remove the `onExit` status-writing path entirely and rely solely on `pollAll`.

---

### [SEVERITY: MEDIUM] `handleSpawnWorker` does not validate that `session_id` exists

**File**: `packages/mcp-cortex/src/tools/workers.ts:58-115`

**Issue**: `handleSpawnWorker` does not verify that `args.session_id` references an existing session before inserting the worker row. The DB has `REFERENCES sessions(id)` as a FK with `FOREIGN_KEYS = ON`. If the session_id is invalid, the INSERT will throw a `FOREIGN KEY constraint failed` exception that propagates uncaught from `handleSpawnWorker`.

**Impact**: The MCP tool returns an unstructured exception instead of `{ ok: false, reason: 'session_not_found' }`. The caller sees an error response with an opaque exception message.

**Suggestion**: Pre-validate session existence and return a structured `{ ok: false, reason: 'session_not_found' }` response.

---

### [SEVERITY: MEDIUM] `handleListSessions` N+1 query: one DB call per session row

**File**: `packages/mcp-cortex/src/tools/sessions.ts:81-100`

**Issue**: For each session row returned by the main query, a separate `GROUP BY` query is executed to fetch worker counts. With 50 sessions this is 51 queries. No LIMIT is applied to the main session query.

**Impact**: Under load, listing sessions blocks the SQLite WAL writer for the duration of all these reads. Not an immediate crash risk but a throughput bottleneck.

**Suggestion**: Use a single query with a LEFT JOIN and GROUP BY on both tables, or use a subquery. Also apply a LIMIT (e.g., 100) on the outer query.

---

### [SEVERITY: MEDIUM] `subscribe_worker` uses `ignoreInitial: false` — condition fires immediately on existing file

**File**: `packages/mcp-cortex/src/events/subscriptions.ts:76`

**Issue**: `watch(absolutePath, { ignoreInitial: false, ... })` means chokidar fires an `add` event immediately for any file that already exists at the watched path. For a `file_exists` condition, this is intentional. But for `file_value` and `file_contains`, this causes the condition to be evaluated against the existing file content before the worker has had a chance to write to it. The first evaluation may match stale content and fire the event prematurely.

**Impact**: A supervisor waiting for a worker to write `COMPLETE` to a status file will immediately see the event fire if the file already exists with any matching content from a previous run.

**Suggestion**: Use `ignoreInitial: true` for `file_value` and `file_contains` conditions, since the intent is to detect new writes, not pre-existing state.

---

### [SEVERITY: LOW] `handleListWorkers` returns unstructured text, not JSON

**File**: `packages/mcp-cortex/src/tools/workers.ts:136-153`

**Issue**: All other tools in the server return `JSON.stringify(...)`. `handleListWorkers` returns a multi-line formatted string. A supervisor script parsing tool output will fail when it encounters `list_workers` output in text format vs JSON format.

**Impact**: Inconsistency in output format breaks any pipeline that programmatically parses tool results.

**Suggestion**: Return a JSON array of worker objects (with the formatted display as an optional `summary` field), consistent with other tools.

---

### [SEVERITY: LOW] `elapsed_minutes` is always `0` in `pushStatsToDB`

**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:197`

**Issue**: `progress_json` always stores `elapsed_minutes: 0`. The value is never computed.

**Impact**: Every tool that displays elapsed time via `progress_json` shows `0m`. The elapsed time displayed in `handleListWorkers` is computed separately from `spawn_time` in the DB row (correct), but `handleGetWorkerStats` reads from `progress_json` and would show `0m` if it used `elapsed_minutes` (it currently recomputes from `spawn_time` too — so no user-visible bug yet, but the stored value is meaningless and could mislead future code).

**Suggestion**: Compute `elapsed_minutes` from `acc` accumulator start time or simply remove the field from `WorkerProgress` if it is always recomputed at display time.

---

### [SEVERITY: LOW] `onExit` signature mismatch with `SpawnOptions`

**File**: `packages/mcp-cortex/src/process/spawn.ts:16` and `packages/mcp-cortex/src/tools/workers.ts:97-100`

**Issue**: `SpawnOptions.onExit` is typed `(code: number | null, signal: string | null, pid: number) => void` with 3 parameters. The `handleSpawnWorker` usage only uses `code`: `(code) => { ... }`. This is fine at runtime (extra args are ignored) but the `pid` param is redundant since `workerId` is closed over. The inconsistency is minor but the `pid` param in `onExit` suggests intent to handle "which process exited" but the implementation ignores it.

**Impact**: No functional impact. Type clarity issue.

---

### [SEVERITY: LOW] `resolveGlmApiKey` silently returns `undefined` on config parse failure

**File**: `packages/mcp-cortex/src/process/spawn.ts:157`

**Issue**: If `config.json` exists but `JSON.parse` throws, `resolveGlmApiKey` logs to `console.error` and returns `undefined`. The caller in `handleSpawnWorker` then returns `{ ok: false, reason: 'GLM API key not found... }`. The config parse failure is not surfaced in the tool response — the caller sees a key-not-found error, not a malformed config error.

**Impact**: Confusing debugging when config exists but is malformed.

---

## Acceptance Criteria Coverage

| Criterion | Status |
|-----------|--------|
| `create_session()` + `get_session()` round-trip stores and retrieves full session state | PASS — logic is correct; `config` is stored as a string and returned as-is |
| `spawn_worker()` launches a Claude Code process and tracks it in the workers table | PARTIAL — functional in happy path; DB race condition when process exits before INSERT |
| `list_workers()` returns workers with status, token usage, and cost data | PARTIAL — data is correct but output format is unstructured text, not JSON |
| `kill_worker()` terminates the process and updates worker status in DB | PARTIAL — terminates correctly; status can be overwritten to `completed`/`failed` by `onExit` |
| `subscribe_worker()` / `get_pending_events()` event flow works end-to-end | PARTIAL — works in single-session; `session_id` filter unimplemented; events leak across sessions |
| `list_sessions()` returns all active sessions | PASS — works correctly, N+1 queries under load |
| All session-orchestrator tools are functionally equivalent in nitro-cortex | PARTIAL — `get_pending_events` lacks session filtering; `context_percent` health signal non-functional |
| Two supervisors using `claim_task()` concurrently never claim the same task | PASS — inherited from Part 1's atomic SQL; not new code in this part |

---

## Summary

The happy path for session CRUD and worker spawning works correctly. However, there are three categories of defects that will cause observable failures in production: (1) a status-overwrite race where `onExit` silently reverts `killed` back to `completed` or `failed`, (2) the `context_percent` formula is off by an order of magnitude, making the entire `high_context` health signal permanently inert, and (3) `get_pending_events` has no `session_id` filtering, which means events are non-deterministically consumed across concurrent sessions — the primary deployment scenario. These are not edge cases; they will manifest on the first multi-session run.

---

## Post-Review Lessons (new patterns to append to `.claude/review-lessons/backend.md`)

- **`onExit` callbacks must guard against overwriting terminal DB status** — when a process spawner registers an `onExit` that writes `completed`/`failed`, it must first check the current DB status. If the row is already `killed` (or any other terminal state), do not overwrite. Race between `kill_worker` and natural process exit is guaranteed. (TASK_2026_121)
- **Process spawn must INSERT DB row before registering exit callbacks** — if DB INSERT runs after `spawn()`, a fast-exiting process can fire `onExit` before the row exists. Always insert with `status = active` first, then spawn. (TASK_2026_121)
- **Context percent requires a per-model context window denominator** — `input_tokens / 1_000_000 * 100` is not a percentage of context utilization unless the model has a 1M token window. Store a model → context_size_tokens map and divide by the actual window. (TASK_2026_121)
- **`get_pending_events` drain is destructive — must filter by session before draining** — any globally-shared event queue that multiple consumers drain must apply session/consumer filtering before removing items, or use per-consumer queues. A global drain in a multi-tenant MCP server causes event theft between sessions. (TASK_2026_121)
- **`chokidar` with `ignoreInitial: false` fires on pre-existing files** — for conditions that detect a new write (file_value, file_contains), use `ignoreInitial: true`. Only use `ignoreInitial: false` for `file_exists` conditions where pre-existence is a valid trigger. (TASK_2026_121)
