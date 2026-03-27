# Code Logic Review - TASK_2026_067

## Review Summary

| Metric              | Value                                        |
| ------------------- | -------------------------------------------- |
| Overall Score       | 5.5/10                                       |
| Assessment          | NEEDS_REVISION                               |
| Blocking Issues     | 2                                            |
| Serious Issues      | 5                                            |
| Moderate Issues     | 3                                            |
| Failure Modes Found | 7                                            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The most dangerous silent failure is the **TOCTOU window in `evaluateCondition`**. The `sub.satisfied` flag is checked at entry, then the async `readFile` call yields control. A second concurrent event fires during the read (chokidar fires `change` twice in quick succession for the same file), passes the `if (sub.satisfied) return` guard on the second call, reads the file, finds the condition satisfied, pushes a **second** `WatchEvent` for the same worker, and then calls `cleanup` a second time on a subscription that was already removed. The user gets duplicate completion events for a single worker — triggering `handleCompletion` twice for the same task.

The second silent failure: `subscribe_worker` returns a human-readable text string when the worker is not found (`Worker X not found in registry.`), not an error or a `{ subscribed: false }` JSON body. The supervisor's fallback detection checks for the MCP tool's absence from the tool list — it has no path to detect a successful-status tool call that actually did nothing. The supervisor logs `"SUBSCRIBED ..."` and runs in event-driven mode forever on a ghost subscription. The worker completes; no event fires; stuck detection eventually kills it two strikes later.

A third silent failure: the event queue is in-memory. If the MCP server restarts between a condition being satisfied and `get_pending_events` being called, the event is lost. The spec acknowledges this and says the supervisor reconciles on startup — but the startup reconciliation code is not in scope for this task, meaning there is a production gap.

### 2. What user action causes unexpected behavior?

A supervisor that calls `subscribe_worker` **after** the worker has already completed (a fast task that finishes in under 30 seconds) registers a chokidar watcher on a file that already satisfies the condition. Chokidar's `add` event fires immediately for an existing file. The condition is evaluated, satisfied, and the event is enqueued before the supervisor's first `get_pending_events` call. This is actually the intended happy path — **but only if chokidar fires `add` for pre-existing files**. The watcher is created with default chokidar options (no explicit `ignoreInitial` set to `false`). Chokidar's default `ignoreInitial` is `true`, meaning it does **not** fire `add` for files that already exist at watch time.

This means: if a worker writes the status file and exits before `subscribe_worker` is called, the condition is never satisfied, no event is ever enqueued, and the supervisor waits 5 minutes for stuck detection to clean up what was actually a successful fast worker. This negates the entire benefit of the event-driven model for fast tasks.

### 3. What data makes this produce wrong results?

The `file_value` condition trims both the file content and the condition value before comparing. A `status` file containing `IMPLEMENTED\n` will match correctly. However: the `file_contains` condition only trims the overall content — it does not normalize line endings (`\r\n` vs `\n`) before calling `.includes()`. A `review-context.md` written on Windows with CRLF line endings that contains `## Findings Summary\r\n` will NOT match the condition string `## Findings Summary`. The supervisor will never see `REVIEW_DONE`.

The Cleanup Worker's three conditions all share the same `event_label: "CLEANUP_DONE"`. If the cleanup worker transitions through `IN_PROGRESS` then `IMPLEMENTED` before the first event is drained, the second condition fires but `sub.satisfied` is already `true` so it is suppressed correctly. This specific path is safe — but the shared event label makes it impossible for the supervisor to know which state the cleanup worker landed in, which could matter for state machine correctness downstream.

### 4. What happens when dependencies fail?

| Dependency | Failure Mode | Current Handling | Assessment |
|---|---|---|---|
| `chokidar.watch()` call | `EMFILE` (too many open file descriptors) | None — error is not caught, crashes the MCP server process | BLOCKING |
| `readFile` after 100ms retry | File deleted (e.g., task cancelled mid-run) | Returns silently, no event | Acceptable |
| `watcher.close()` in cleanup | Rejects (chokidar internal error) | `.catch(() => {})` — swallowed silently | Acceptable |
| MCP server restart mid-session | Event queue wiped | Acknowledged as acceptable by spec | Acceptable with caveat |
| Worker exits, file written, MCP restarts, supervisor calls `get_pending_events` | Returns empty | Supervisor falls back to stuck detection after 5 minutes | Slow but survivable |
| `subscribe_worker` called twice for same worker_id | Old watchers cleaned up via `cleanup()` | Correctly handles re-subscription | OK |

The `EMFILE` failure is the most dangerous: chokidar fails to set up the watcher and throws, but the exception propagates from `watch()` in `file-watcher.ts` line 45 with no try-catch. This crashes the entire MCP server process. With many parallel workers (concurrency=5, multiple conditions each), the file descriptor table fills quickly.

### 5. What's missing that the requirements didn't mention?

**Missed by spec:**

1. **`ignoreInitial: false` is required for subscribe-after-completion correctness** — the spec says "Watch is set up immediately when `subscribe_worker` is called — even if the file doesn't exist yet" but does not mention the inverse: what if the file already satisfies the condition. The implementation leaves `ignoreInitial` at chokidar's default (`true`), breaking this case.

2. **No cap on the event queue** — the queue is an unbounded `WatchEvent[]`. If the supervisor crashes and stops calling `get_pending_events`, every worker completion enqueues an event. With 100 workers this is 100 events; at 10,000 it becomes a memory problem. An `IN_MEMORY_BUFFERS_NEED_SIZE_CAPS` anti-pattern violation per the review lessons (T79).

3. **No `subscribe_worker` timeout** — the supervisor's fallback detection only checks if the tool exists in the tool list. If the tool exists but the MCP server is overloaded and the call hangs, there is no timeout, matching the known anti-pattern `IPC calls need timeout` from backend.md.

4. **No `last_stuck_check_at` initialization** — the SKILL.md Step 6 references `last_stuck_check_at` in state but Step 5e does not specify an initial value when writing the active worker row. If the field is undefined, `Date.now() - undefined >= 5 minutes` evaluates to `NaN >= 300000` which is `false`. The first stuck check is silently skipped until the supervisor happens to set the field on the first update.

---

## Failure Mode Analysis

### Failure Mode 1: TOCTOU double-event (Concurrent `change` events)

- **Trigger**: Chokidar fires two `change` events in rapid succession (common on macOS for writes that trigger both attribute and content notifications). Both pass the `if (sub.satisfied) return` guard because the first `readFile` has not resolved yet.
- **Symptoms**: Two `WatchEvent` entries in the queue for the same `worker_id`. Supervisor calls Step 7 (completion handler) twice for the same task. Depending on Step 7's idempotency, this may cause a double state transition, double cleanup spawn, or double log entry.
- **Impact**: Non-deterministic, depends on Step 7 guards. Best case: a spurious no-op. Worst case: double Cleanup Worker spawn for a single task.
- **Current Handling**: The `sub.satisfied` flag is set to `true` inside `evaluateCondition` after `readFile` resolves — there is no synchronous lock preventing a second concurrent invocation from entering past the guard.
- **Recommendation**: Set `sub.satisfied = true` synchronously at the top of `onEvent` (before the async `evaluateCondition` call), not inside the async callback. This makes the guard effective across concurrent event deliveries.

### Failure Mode 2: Subscribe-after-completion gets no event (chokidar `ignoreInitial: true`)

- **Trigger**: Fast worker (< 30 seconds) writes `IMPLEMENTED` to the status file and exits. Supervisor then calls `subscribe_worker`. Chokidar watches the file but does not fire `add` because `ignoreInitial` defaults to `true` for already-existing files.
- **Symptoms**: No `BUILD_COMPLETE` event ever arrives in the queue. Stuck detection fires at the 5-minute mark. The worker's process is already dead, so `get_worker_activity` returns `finished`. Step 7 is triggered via the stuck path, not the event path.
- **Impact**: 5-minute delay on every fast task. The event-driven speedup is completely negated for any worker that completes before the supervisor gets around to subscribing.
- **Current Handling**: Not handled.
- **Recommendation**: Pass `{ ignoreInitial: false }` to chokidar's `watch()`. For `file_exists` conditions this is exactly right. For `file_value` and `file_contains`, this triggers an immediate evaluation on the existing file, which is the desired behavior.

### Failure Mode 3: `chokidar.watch()` throws EMFILE — MCP server crashes

- **Trigger**: High concurrency (many workers, many conditions each). OS file descriptor table exhausted. `watch()` in `file-watcher.ts:45` throws `EMFILE`.
- **Symptoms**: MCP server process crashes. All in-flight workers lose their watchers. Event queue is lost. Supervisor loses its MCP connection.
- **Impact**: Full supervisor disruption. All active workers must be recovered via the MCP empty grace period path, which adds up to 10 minutes of delay.
- **Current Handling**: No try-catch around `watch()`. The exception propagates up through `subscribe()` into the MCP tool handler, which likely returns a 500 to the supervisor.
- **Recommendation**: Wrap `watch()` in try-catch. On failure, log the error and return the subscription without that watcher (or return a "partial subscription" indicator). The supervisor should detect partial success and fall back to polling for that worker.

### Failure Mode 4: `subscribe_worker` worker-not-found returns text, not error — silent ghost subscription

- **Trigger**: Supervisor calls `subscribe_worker` with a `worker_id` that does not exist in the MCP registry (e.g., MCP server restarted, registry lost, worker_id mismatch).
- **Symptoms**: Tool returns `"Worker X not found in registry."` as a text content block with no error status. Supervisor parses this as success (the tool call succeeded). Supervisor sets `event_driven_mode = true`, logs `"SUBSCRIBED ..."` — but no watcher was created. The worker never fires an event.
- **Impact**: Identical to Failure Mode 2. The worker completes silently. Stuck detection fires 5 minutes later. The event-driven model is degraded to polling without the supervisor knowing.
- **Current Handling**: Not handled. The spec says `subscribe_worker` returns `{ subscribed: boolean, watched_paths: string[] }` but the implementation returns a plain text string in both success and failure paths.
- **Recommendation**: Return `JSON.stringify({ subscribed: false, watched_paths: [], error: 'Worker not found' })` on failure so the supervisor can detect and react. Alternatively, use MCP's error response mechanism.

### Failure Mode 5: CRLF line endings break `file_contains` match for Review Lead

- **Trigger**: A reviewer running on Windows (or any tool that writes CRLF) produces `review-context.md` with `## Findings Summary\r\n`.
- **Symptoms**: `content.trim().includes('## Findings Summary')` is `true` (trim removes only leading/trailing whitespace, not embedded `\r`). Wait — actually `.trim()` is applied to the whole content, not per-line. The substring `## Findings Summary\r` does include `## Findings Summary` as a prefix... actually `'## Findings Summary\r\n...'.includes('## Findings Summary')` is `true` because includes does substring match.
- **Revised assessment**: This specific case actually works. However the `trimmed` variable is the full file content with trim() applied only at the two ends. If `## Findings Summary` appears in the middle of the file with normal `\n` line endings, the includes will find it. If the header has trailing spaces (`## Findings Summary   `), includes will NOT find `## Findings Summary` — it will find the string with trailing spaces only if you search for the longer version. This is actually fine given the spec searches for the exact header.
- **Actual concern**: The `file_contains` condition does NOT normalize to lowercase, and the spec string is case-sensitive. If a reviewer writes `## findings summary` (lowercase), the condition never fires. This is by design (case-sensitive spec), but worth noting as a fragile dependency on reviewer behavior.
- **Impact**: Low probability in practice since the section header is generated by agent prompts.

### Failure Mode 6: `last_stuck_check_at` undefined on first loop iteration

- **Trigger**: Supervisor spawns a worker and writes the active worker row to `state.md`. Step 5e does not specify an initial value for `last_stuck_check_at`. On the first 30-second iteration of Step 6, the condition `Date.now() - last_stuck_check_at >= 5 minutes` evaluates `Date.now() - undefined`, which is `NaN`. `NaN >= 300000` is `false`.
- **Symptoms**: The first stuck check is silently skipped. The worker receives a 5-minute + 30-second grace before the first stuck check instead of 5 minutes. Unlikely to cause a real failure but creates undefined behavior in the state machine.
- **Current Handling**: Not addressed in SKILL.md Step 5e-ii or Step 6.
- **Recommendation**: Step 5e should specify `last_stuck_check_at = spawn_time` as the initial value. This ensures the first stuck check fires 5 minutes after spawn, as intended.

### Failure Mode 7: Worker process exits before `subscribe_worker` call (Cleanup Worker subscribing in `IN_PROGRESS`)

- **Trigger**: Cleanup Worker is spawned to salvage uncommitted work from a failed worker. Its first action is to write `IN_PROGRESS` to the status file. If the Cleanup Worker is very fast and writes `IN_PROGRESS` before the supervisor calls `subscribe_worker`, the chokidar watcher on the status file misses this event (same as Failure Mode 2).
- **Symptoms**: The Cleanup Worker completes its salvage and eventually writes `COMPLETE`. The `COMPLETE` condition fires correctly (assuming `ignoreInitial` issue is fixed). But the `IN_PROGRESS` event is lost — which is fine since `CLEANUP_DONE` fires regardless of which of the three values triggered it. The correct behavior still occurs in this case, just via a later condition.
- **Impact**: Low. The fallback to the `COMPLETE` condition handles this correctly.

---

## Critical Issues

### Issue 1: Chokidar `watch()` not wrapped in try-catch — EMFILE can crash MCP server

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:45`
- **Scenario**: High concurrency (5+ workers, 3 conditions each = 15 simultaneous watchers). OS hits `EMFILE` limit. `watch()` throws synchronously inside the `for...of conditions` loop. Exception propagates through `subscribe()` up to the MCP tool handler, likely causing an unhandled rejection that crashes the Node.js process.
- **Impact**: Full MCP server crash. All workers lose supervision. Recovery requires the MCP empty grace period path, adding 5-10 minutes of dead time.
- **Evidence**: `file-watcher.ts:45` — `const watcher = watch(absolutePath, { persistent: false });` — no try-catch.
- **Fix**: Wrap `watch()` in try-catch. On error, log to stderr and either skip this condition (partial subscription) or re-throw with a recoverable error that the MCP handler returns to the supervisor as a structured failure.

### Issue 2: `ignoreInitial: true` default breaks subscribe-after-completion for any fast worker

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:45`
- **Scenario**: Any worker that completes before the supervisor calls `subscribe_worker`. Chokidar is started on a file that already exists and already satisfies the condition. No `add` event fires because `ignoreInitial` defaults to `true`.
- **Impact**: The primary benefit of the event-driven model — fast pipeline progression — is negated for all fast tasks. A task that takes 20 seconds still incurs a 5-minute delay via stuck detection's `finished` path. This is likely to affect Build Workers on simple tasks frequently.
- **Evidence**: `file-watcher.ts:45` — `watch(absolutePath, { persistent: false })` — no `ignoreInitial: false`.
- **Fix**: Pass `{ persistent: false, ignoreInitial: false }` to chokidar. This triggers an immediate `add` event for existing files, causing the condition to be evaluated immediately on subscription.

---

## Serious Issues

### Issue 3: TOCTOU double-event — `sub.satisfied` not set synchronously

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:48-53`
- **Scenario**: Chokidar fires two `change` events within the same event loop tick (common on macOS). Both `onEvent` callbacks fire before either `evaluateCondition` call resolves. Both pass the `if (sub.satisfied) return` guard. Both enqueue a `WatchEvent`.
- **Impact**: Supervisor receives two completion events for one worker. Step 7 runs twice. Consequence depends on Step 7 guard logic (not reviewed here), but at minimum creates confusing log output and potential double state transitions.
- **Fix**: Set `sub.satisfied = true` synchronously inside `onEvent` before calling `evaluateCondition`. If `evaluateCondition` ultimately finds the condition unsatisfied, reset `sub.satisfied = false`. This makes the guard race-safe.

### Issue 4: `subscribe_worker` returns unstructured text — supervisor cannot detect subscription failure

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/subscribe-worker.ts:43-49`
- **Scenario**: `worker_id` not found in registry. Tool returns text `"Worker X not found."`. MCP tool call succeeds (HTTP 200 equivalent). Supervisor treats this as success.
- **Impact**: Supervisor runs in event-driven mode with a ghost subscription. Worker completes; no event fires. 5-minute delay via stuck detection.
- **Fix**: Return `JSON.stringify({ subscribed: false, watched_paths: [], error: 'Worker not found in registry' })` on failure so the supervisor can detect and log a specific warning, and optionally fall back to per-worker polling for that specific worker.

### Issue 5: Event queue is unbounded — OOM risk under sustained failure

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:19`
- **Scenario**: Supervisor crashes or stops calling `get_pending_events`. Every subsequent worker completion pushes to `eventQueue`. With large batches (50+ tasks) or a long-running session, this grows without bound.
- **Impact**: MCP server OOM under sustained supervisor absence. Violates the `IN_MEMORY_BUFFERS_NEED_SIZE_CAPS` anti-pattern from backend review lessons (T79).
- **Fix**: Cap `eventQueue` at a reasonable size (e.g., 500 events). On overflow, log a warning. New events can be dropped (the supervisor's startup reconciliation handles recovery) or old events can be evicted (FIFO drop).

### Issue 6: `last_stuck_check_at` has no specified initial value — first stuck check is NaN-guarded skip

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` (Step 5e-ii)
- **Scenario**: Step 5e-ii does not instruct the supervisor to initialize `last_stuck_check_at` in the active worker row. On the first Step 6 iteration, `Date.now() - undefined` is `NaN`. `NaN >= 300000` is `false`. First stuck check silently skipped.
- **Impact**: Stuck detection for a genuinely stuck worker is delayed by one 30-second cycle. Low severity on its own, but undefined behavior in the state machine is a maintenance risk.
- **Fix**: Specify in Step 5e that `last_stuck_check_at` is initialized to `spawn_time` when writing the active worker row.

### Issue 7: Cleanup Worker condition table uses same `event_label` for all three conditions — ambiguous completion signal

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` (Step 5e-ii table)
- **Scenario**: All three Cleanup Worker conditions use `event_label: "CLEANUP_DONE"`. When the event fires, the `condition` field in `WatchEvent` tells the supervisor which value was matched, but the supervisor's Step 7 completion handler is keyed on `event_label`, not on `condition.value`. If Step 7 needs to know what state the cleanup landed in (e.g., to decide whether to re-queue for review), it cannot determine this from `event_label` alone without re-reading the status file.
- **Impact**: Moderate. Step 7 will likely re-read the status file anyway, so in practice this may not matter. But it represents an implicit coupling that is not documented.
- **Fix**: Use distinct labels: `CLEANUP_IN_PROGRESS`, `CLEANUP_IMPLEMENTED`, `CLEANUP_COMPLETE`. Or document explicitly that the Cleanup Worker completion handler always re-reads the status file and does not rely on the label for state inference.

---

## Moderate Issues

### Issue 8: `subscribe_worker` `working_directory` is caller-supplied, not derived from the worker record

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/subscribe-worker.ts:27, 52`
- **Scenario**: The tool accepts `working_directory` as an explicit parameter even though the registered worker already has `working_directory` in its registry entry. A caller that passes a mismatched directory watches the wrong absolute paths.
- **Impact**: Condition is never satisfied (wrong path). No event fires. 5-minute stuck detection delay.
- **Recommendation**: Use `worker.working_directory` from the registry instead of accepting it as a parameter. Or at minimum cross-validate them and log a warning on mismatch.

### Issue 9: MCP tool reference table in SKILL.md shows `subscribe_worker` returns `{ subscribed: boolean, watched_paths: string[] }` but implementation returns text

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` (MCP Tool Signatures section)
- **Scenario**: The documented signature says the tool returns a structured JSON object. The implementation returns a plain human-readable text block. The supervisor's fallback detection logic relies on detecting the tool's existence in the tool list — but if it ever tries to parse the return value as JSON for the `subscribed` field, it will get a parse error.
- **Impact**: Documentation mismatch that will confuse future maintainers. If the supervisor is ever updated to parse the return value, it breaks.
- **Fix**: Either update the implementation to return `JSON.stringify({ subscribed: true, watched_paths })` (which also fixes Issue 4), or update the documentation to reflect the text format.

### Issue 10: `closeAll()` iterates while mutating — potential skip on cleanup

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts:86-90`
- **Scenario**: `closeAll()` iterates `this.subscriptions` with `for...of` and calls `this.cleanup(id)` which calls `this.subscriptions.delete(id)`. In JavaScript, deleting Map entries during a `for...of` iteration over the same Map is defined behavior (the deleted entry is not revisited), so this is actually safe. The Map iterator skips already-deleted entries but does visit entries that exist at the time of iteration.
- **Impact**: Technically safe in current JS/V8. However it is a fragile pattern that violates the principle of not mutating a collection during iteration. A future refactor that changes the cleanup path could make this unsafe.
- **Recommendation**: Collect all IDs first (`const ids = [...this.subscriptions.keys()]`) then iterate `ids`. Low priority.

---

## Data Flow Analysis

```
Supervisor (SKILL.md Step 5e-ii)
  |
  | spawn_worker(prompt, cwd, label) -> worker_id
  |
  | subscribe_worker(worker_id, working_directory, conditions)
  |   -> MCP tool handler: handleSubscribeWorker()
  |       -> registry.get(worker_id)          [ISSUE 4: not found = text, not error]
  |       -> fileWatcher.subscribe(id, cwd, conditions)
  |           -> for each condition:
  |               absolutePath = join(cwd, condition.path)
  |               watcher = chokidar.watch(absolutePath, { persistent: false })
  |                         [ISSUE 1: no try-catch on watch()]
  |                         [ISSUE 2: ignoreInitial: true by default]
  |               watcher.on('add', onEvent)
  |               watcher.on('change', onEvent)
  |
  | ... time passes ...
  |
  Worker writes status file / review-context.md
  |
  chokidar fires 'add' or 'change'
  |
  onEvent() -- synchronous
    if (sub.satisfied) return   [ISSUE 3: not race-safe against concurrent events]
    evaluateCondition() -- async
      readFile(absolutePath)    [retry once on ENOENT]
      evaluate condition type
      if satisfied && !sub.satisfied:
        sub.satisfied = true
        eventQueue.push(WatchEvent)  [ISSUE 5: unbounded queue]
        cleanup(workerId)
          watcher.close() for all watchers
          subscriptions.delete(workerId)
  |
Supervisor (Step 6, every 30 seconds)
  |
  get_pending_events()
    -> handleGetPendingEvents()
        -> fileWatcher.drainEvents()   [splice(0) — correct, atomic]
        -> returns JSON or empty
  |
  for each event: trigger Step 7 (completion handler)
  |
  for remaining active workers (no event yet):
    if Date.now() - last_stuck_check_at >= 5min:  [ISSUE 6: may be NaN on first check]
      get_worker_activity(worker_id)
      apply two-strike detection
```

### Gap Points Identified:

1. The chokidar `add` event for a pre-existing file is not fired (ignoreInitial: true), creating a permanent dead zone for fast workers.
2. No synchronous guard prevents two concurrent `onEvent` calls from both entering `evaluateCondition` and both enqueuing.
3. The success/failure signal from `subscribe_worker` cannot be distinguished by the supervisor from the text response alone.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| `subscribe_worker` tool exists and accepts watch conditions | COMPLETE | Implementation present |
| MCP sets up `fs.watch` immediately after subscription | COMPLETE (via chokidar) | No try-catch on watch() |
| When condition satisfied, marks worker finished and appends to queue | PARTIAL | `sub.satisfied` flag is set async, not sync — double-event risk |
| `get_pending_events` returns and drains the queue (idempotent) | COMPLETE | `splice(0)` is correct |
| Supervisor calls `subscribe_worker` after each successful spawn | COMPLETE (in SKILL.md) | Documented correctly |
| Supervisor polls `get_pending_events` every 30 seconds | COMPLETE (in SKILL.md) | Documented correctly |
| Supervisor processes events immediately | COMPLETE (in SKILL.md) | Documented correctly |
| Stuck detection still runs every 5 min for workers without events | COMPLETE (in SKILL.md) | `last_stuck_check_at` uninitialized |
| Fallback if `subscribe_worker` unavailable | COMPLETE (in SKILL.md) | Only detects tool absence, not subscription failure |
| All worker types have correct watch conditions | COMPLETE | Cleanup Worker ambiguous label; fast-worker race not handled |
| One-shot watchers removed after satisfaction | COMPLETE | Cleanup called inside evaluateCondition after satisfaction |
| Re-subscription cleans up old watchers | COMPLETE | `subscribe()` calls `cleanup()` first |

### Implicit Requirements NOT Addressed:

1. **Subscribe-after-completion**: A worker that finishes before subscription is registered should still fire an event. The `ignoreInitial` flag must be explicitly disabled to support this.
2. **Subscription failure signaling**: The supervisor needs to know if subscription failed (worker not in registry) so it can fall back to per-worker polling rather than silently running in degraded event-driven mode.
3. **Event queue size cap**: Any in-memory accumulation buffer requires a size cap per the project's established anti-pattern rules.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| File absent at watch-fire time (atomic rename) | YES | Retry once after 100ms | Correct per spec |
| Worker re-subscribed (cleanup then re-spawn) | YES | `subscribe()` calls `cleanup()` first | Correct |
| Worker exits before subscribe call | NO | chokidar ignoreInitial:true silently misses it | BLOCKING |
| Concurrent chokidar events for same file | NO | `sub.satisfied` set async, not sync | SERIOUS |
| `chokidar.watch()` throws (EMFILE) | NO | No try-catch | BLOCKING |
| Worker not in registry at subscribe time | PARTIAL | Returns text error, not structured error | SERIOUS |
| Event queue grows unbounded | NO | No size cap | SERIOUS |
| `last_stuck_check_at` uninitialized | NO | NaN comparison silently false | MODERATE |
| Cleanup Worker: which status value triggered? | PARTIAL | Same event_label for all 3 values | MODERATE |
| MCP server restart (queue lost) | DOCUMENTED | Accepted; startup reconciliation handles | Acceptable |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| chokidar on high-concurrency system (EMFILE) | MED | MCP crash | None currently |
| subscribe-after-completion for fast tasks | HIGH | Silent miss, 5-min delay | None currently |
| Supervisor parsing subscribe_worker response | LOW | Ghost subscription | Return structured JSON |
| Concurrent chokidar events | MED (macOS) | Double completion event | Sync flag set |
| Event queue accumulation during supervisor absence | LOW | OOM after extended absence | Size cap needed |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The `ignoreInitial: true` default in chokidar means any worker that completes before `subscribe_worker` is called will never fire a completion event. On fast tasks — the use case most expected to benefit from this feature — the system silently falls back to 5-minute stuck detection. This directly undermines the stated goal of the task ("replace the 5-minute polling loop"). This is a one-line fix (`ignoreInitial: false`) but it is blocking because without it the feature does not reliably work.

**Second Top Risk**: No try-catch on `chokidar.watch()`. On any system with a limited file descriptor table and concurrent workers, a single EMFILE crashes the MCP server and disrupts all active sessions.

---

## What Robust Implementation Would Include

1. `chokidar.watch()` wrapped in try-catch with structured error returned to supervisor
2. `{ ignoreInitial: false }` option to catch pre-existing satisfied conditions
3. Synchronous `sub.satisfied = true` set in `onEvent` before async `evaluateCondition` call, with reset on non-satisfaction
4. `subscribe_worker` returning `JSON.stringify({ subscribed: true|false, watched_paths, error? })` so the supervisor can detect failure vs. success
5. Event queue size cap (e.g., 500) with a warning log on overflow
6. `last_stuck_check_at` initialized to `spawn_time` in the active worker row (documented in Step 5e)
7. Distinct `event_label` values for Cleanup Worker's three conditions, or explicit documentation that Step 7 re-reads status file for disambiguation
8. `working_directory` derived from the worker registry record inside `handleSubscribeWorker`, not accepted as a caller-supplied parameter (reduces misconfiguration surface)
