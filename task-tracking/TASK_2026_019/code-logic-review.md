# Code Logic Review -- TASK_2026_019

## Summary

The fix successfully wires stream-json stdout parsing into the existing registry, and the core architecture (feedMessage, print-mode branching, result-type detection) is sound. However, **empirical testing of stream-json output reveals that assistant messages in stream-json mode have fundamentally different semantics than JSONL file messages**, causing inaccurate output token counts, dead end-turn detection logic, and a missed opportunity to use the authoritative totals from the `result` message.

---

## Findings

### [BLOCKING] Output token counts are wrong -- stream-json assistant messages have unreliable output_tokens

- **File**: `src/core/jsonl-watcher.ts:187-188`
- **Issue**: In stream-json mode, the `assistant` message is emitted **before** text generation completes. For the final text turn, `output_tokens` is always `1` (a streaming placeholder). The code accumulates this value via `acc.totalOutput += usage.output_tokens`, so the accumulated output token count is always short by `(actual_output - 1)` for the last turn. For tool-use turns the value is accurate, but the final response turn -- which can be the largest -- is consistently undercounted.

  Empirical evidence from testing `claude -p --output-format stream-json --verbose`:
  ```
  # Multi-turn session: assistant messages show
  stop_reason=None out_tokens=49  content_types=['tool_use']   # accurate
  stop_reason=None out_tokens=68  content_types=['tool_use']   # accurate
  stop_reason=None out_tokens=68  content_types=['tool_use']   # accurate
  stop_reason=None out_tokens=1   content_types=['text']        # WRONG - placeholder

  # Result message shows actual total:
  output=285  # The real cumulative total
  ```

- **Fix**: When processing the `result` message (type === 'result'), extract the cumulative usage totals and **replace** the accumulated values (since result contains session-wide cumulative values):

  ```typescript
  if (msg.type === 'result') {
    const resultMsg = msg as Record<string, unknown>;
    const usage = resultMsg.usage as Record<string, number> | undefined;
    if (usage) {
      acc.totalInput = usage.input_tokens ?? acc.totalInput;
      acc.totalOutput = usage.output_tokens ?? acc.totalOutput;
      acc.totalCacheCreation = usage.cache_creation_input_tokens ?? acc.totalCacheCreation;
      acc.totalCacheRead = usage.cache_read_input_tokens ?? acc.totalCacheRead;
    }
    if (!acc.endTurnAt) {
      acc.endTurnAt = Date.now();
    }
    return;
  }
  ```

### [BLOCKING] End-turn detection via stop_reason is dead code for print-mode workers

- **File**: `src/core/jsonl-watcher.ts:206-212`
- **Issue**: The code checks `assistant.message.stop_reason === 'end_turn'` to detect task completion. In stream-json mode, `stop_reason` is **always `null`** on assistant messages. End-turn is only signaled by the `result` message (handled at line 175). This means for print-mode workers:
  - `acc.endTurnAt` is **never set** from assistant messages (the `end_turn` branch at line 206 never fires)
  - `acc.endTurnAt` is **never reset to null** when tool_use is detected (line 210) -- but since it was never set, this is moot
  - The only way `endTurnAt` gets set is via the `result` handler at line 176

  **Impact**: Auto-close works by accident because the `result` message does set `endTurnAt`. But the intermediate "still working" signal (reset endTurnAt on tool_use, set on end_turn) is entirely absent for print-mode workers.

- **Fix**: Document that end_turn detection from assistant messages is iTerm-JSONL-only. For print mode, the `result` message is the sole completion signal, which is actually more reliable. No code change strictly needed if BLOCKING #1 is fixed (result message becomes the authoritative source).

### [SERIOUS] Leftover stdout buffer content on process exit is silently dropped

- **File**: `src/core/print-launcher.ts:47-69`
- **Issue**: The stdout parser accumulates incomplete lines in `stdoutBuffer`. When the process exits, any remaining content (a final line without a trailing `\n`) is never processed. The `result` message -- the **most important message** for accurate totals per BLOCKING #1 -- is the last line emitted and could lack a trailing newline.

  The `child.on('exit')` handler at line 80 does not flush the buffer. If the `result` message is the last line and doesn't end with `\n`, both the session-end signal and the authoritative token totals are permanently lost.

- **Fix**: Add a buffer flush on stdout close:
  ```typescript
  child.stdout?.on('close', () => {
    if (opts.onMessage && stdoutBuffer.trim()) {
      try {
        const msg = JSON.parse(stdoutBuffer.trim()) as Record<string, unknown>;
        opts.onMessage(msg);
      } catch { /* Not valid JSON */ }
    }
  });
  ```

### [SERIOUS] Race condition -- messages can arrive before workerRef.id is set

- **File**: `src/index.ts:76-102`
- **Issue**: The `onMessage` callback checks `if (workerRef.id)` (line 84), but `workerRef.id` is set at line 102 after `registry.register()`. If Claude emits messages before registration completes, they are silently dropped.

  In practice, Node's single-threaded event loop means stdout `data` events only fire when the current synchronous block yields. Since `spawn()` -> `registry.register()` -> `workerRef.id = ...` is all synchronous, the window is effectively zero today. However:
  - The pattern is fragile -- if `register()` ever becomes async, messages will be lost
  - The `system` init message (always first) arrives fast and would be dropped if timing changed

- **Fix**: Buffer messages that arrive before registration:
  ```typescript
  const pendingMessages: Record<string, unknown>[] = [];
  // ... in onMessage:
  if (workerRef.id) {
    watcher.feedMessage(workerRef.id, msg);
  } else {
    pendingMessages.push(msg);
  }
  // ... after workerRef.id = worker.worker_id:
  for (const msg of pendingMessages) {
    watcher.feedMessage(workerRef.id, msg);
  }
  ```

### [SERIOUS] Session ID collision -- `print-${Date.now()}` is not unique

- **File**: `src/index.ts:75`
- **Issue**: `Date.now()` has millisecond resolution. If two workers spawn in the same millisecond (parallel spawns from supervisor), they get the same session ID. Since `accumulators` is keyed by session ID, both workers share the same accumulator, causing token counts to be mixed/doubled.
- **Fix**: Append PID for uniqueness: `print-${Date.now()}-${pid}`. PIDs are unique per-spawn. Or use `crypto.randomUUID()`.

### [SERIOUS] Memory leak -- accumulators for print workers are never cleaned up

- **File**: `src/core/jsonl-watcher.ts:37`
- **Issue**: The `accumulators` Map grows indefinitely. When a print-mode worker completes, its accumulator (containing `filesRead` and `filesWritten` Sets that can be large) remains in the Map forever. Over many spawns in an extended auto-pilot session (20+ workers observed in production), this is a growing memory leak.
- **Fix**: After pushing final stats and marking completed in `pollAll()`, delete the accumulator:
  ```typescript
  this.accumulators.delete(worker.session_id);
  ```

### [SERIOUS] Triplicated health assessment logic with inconsistent casing

- **Files**:
  - `src/index.ts:246-254` -- returns lowercase `'starting'`
  - `src/tools/get-worker-activity.ts:25-30` -- returns UPPERCASE `'STARTING'`, `'COMPACTING'`, `'HIGH_CONTEXT'`, `'STUCK'`
  - `src/tools/get-worker-stats.ts:58-67` -- returns lowercase `'starting'`
- **Issue**: Three independent implementations of the same health logic. The `get-worker-activity.ts` version uses different casing than the `HealthStatus` type definition (which specifies lowercase values). TypeScript doesn't catch this because the inline ternary result is typed as string, not `HealthStatus`. The supervisor sees different health labels depending on which tool it calls.
- **Fix**: Extract a single shared `assessHealth()` function. All three call sites should use it.

### [MINOR] `appendFileSync` in hot path blocks the event loop

- **File**: `src/core/print-launcher.ts:51,73`
- **Issue**: `appendFileSync` is called on every stdout/stderr data chunk. For workers with heavy output, this blocks the Node.js event loop. Since this is an MCP server on stdio transport, blocking could cause MCP request/response delays.
- **Fix**: Use `fs.createWriteStream` and pipe to it, or use async `fs.appendFile`.

### [MINOR] `child.pid!` non-null assertion can crash if spawn fails

- **File**: `src/core/print-launcher.ts:82,90`
- **Issue**: If `spawn('claude', ...)` fails (binary not found, ENOMEM), `child.pid` is `undefined`. The `!` assertion passes `undefined` as `number`, causing the registry to store a bogus PID.
- **Fix**: Guard with `if (!child.pid) throw new Error('Failed to spawn claude process')`.

### [MINOR] `hasToolUse` computed but useless for print-mode stop_reason detection

- **File**: `src/core/jsonl-watcher.ts:200,206-212`
- **Issue**: `hasToolUse` is used in the `stop_reason === 'end_turn'` check which never fires for stream-json (stop_reason is always null). The variable computation and the conditional are dead code for print workers. Still works for iTerm JSONL path.
- **Fix**: No action needed if documented.

---

## Verdict

**FAIL** -- Two blocking issues must be addressed before this fix achieves its stated goal:

1. **Output token counts are systematically wrong** because stream-json assistant messages emit placeholder `output_tokens` values for the final text turn. The `result` message contains authoritative cumulative totals that the code currently ignores for token/cost calculation.

2. **The stdout buffer is not flushed on process exit**, meaning the `result` message (which contains the authoritative totals from #1) can be silently dropped if it's the last line without a trailing newline.

The fix for both is straightforward: (a) flush the buffer on stdout close, and (b) extract cumulative token totals from the `result` message to overwrite per-turn accumulated values. This makes the `result` message the authoritative source for final numbers while keeping per-turn accumulation for real-time progress during execution.

The serious issues (session ID collision, memory leak, race condition, triplicated health logic) should also be addressed to make this production-solid.
