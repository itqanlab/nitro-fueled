# Code Logic Review — TASK_2026_142

## Score: 6/10

## Summary

The core goal — consolidating session-orchestrator into nitro-cortex and making cortex mandatory by default — is implemented and the happy path works. The `emit_event` / `EmitQueue` integration is correct. However, there are four non-trivial issues that could silently mislead operators or cause data loss in production runs: an EmitQueue drain bug that loses emit_events across session boundaries, a silent fallback induced by a JSON parse failure in init.ts, a misleading description comment on `get_pending_events`, and ambiguous semantics in `allow_file_fallback` that are not enforced at read time.

---

## Findings

### C001 [CRITICAL]: EmitQueue.drain() is not session-scoped — emit_events from one session leak into another

**File**: `packages/mcp-cortex/src/events/subscriptions.ts:298-303`

**Issue**: `handleGetPendingEvents` drains `fileWatcher.drainEvents(sessionId)` with an optional session filter, correctly returning only events for the requested session and leaving others in the file-watcher queue. However, `emitQueue.drain()` is always a full drain — it returns ALL enqueued emit_events regardless of `sessionId`. If two Supervisor sessions are running concurrently (concurrency guard is a soft warning, not a hard lock), Session A's `get_pending_events` call will consume Session B's emit_events and vice versa. The events are silently swallowed — the emitting worker receives `{ok: true}`, the supervisor receives no event, and no error is ever raised.

```ts
// subscriptions.ts:298-303
export function handleGetPendingEvents(fileWatcher: FileWatcher, emitQueue: EmitQueue, sessionId?: string): ToolResult {
  const fileEvents = fileWatcher.drainEvents(sessionId);  // session-scoped ✓
  const emitEvents = emitQueue.drain();                    // full drain — NOT session-scoped ✗
  const all = [...fileEvents, ...emitEvents];
```

The `EmitQueue` stores `worker_id`, `event_label`, `emitted_at`, `data`, and `source` on each event — but NOT `session_id`. Without `session_id` on the stored event there is no way to filter by session at drain time even if the interface were changed.

**Fix**: Either (a) store `session_id` on `EmittedEvent` (look it up from the DB in `handleEmitEvent` using `worker_id`, since the DB query is already there) and filter in `EmitQueue.drain(sessionId?)`, or (b) document clearly that concurrent sessions will cause emit_event cross-contamination and harden the Concurrent Session Guard to a hard abort.

---

### C002 [CRITICAL]: init.ts silently skips cortex configuration on malformed .mcp.json — user never told

**File**: `apps/cli/src/commands/init.ts:241-255`

**Issue**: `handleNitroCortexConfig` reads `.mcp.json` to check if `nitro-cortex` is already configured. If `JSON.parse` throws (malformed JSON, truncated file, encoding error), the `catch {}` block falls through to the prompt or `--cortex-path` path. This is intentional and documented in the comment. However, the fallthrough path then reconfigures cortex over a malformed `.mcp.json`. The `configureNitroCortex` call downstream may try to merge into the existing malformed file or overwrite it. If `configureNitroCortex` fails for any reason and returns `false`, the error message says "configure it manually later" with no hint that the `.mcp.json` was already corrupted. The user ends up with an unknown state: neither the old config nor the new one is confirmed present.

The deeper issue: there is no validation that a malformed `.mcp.json` may already contain a `session-orchestrator` entry that the user needs to remove. The handoff documents this as a known risk ("users with existing `.mcp.json` containing session-orchestrator will need to remove it manually"), but `init` gives no diagnostic output about it. Running `init` on such a project gives no warning.

**Fix**: When `JSON.parse` fails, print a warning: `"Warning: .mcp.json exists but could not be parsed. Proceeding to configure nitro-cortex (existing content may be overwritten)."` Additionally, when parse succeeds and a `session-orchestrator` key is present, warn: `"Warning: .mcp.json contains a 'session-orchestrator' entry. Remove it after this run — it is deprecated."`.

---

### M001 [MAJOR]: get_pending_events description says "not yet implemented" for session_id filter — it IS implemented

**File**: `packages/mcp-cortex/src/index.ts:307-312`

**Issue**: The MCP tool registration for `get_pending_events` has this Zod description:

```ts
session_id: z.string().optional().describe('Optional session filter (not yet implemented)'),
```

But `handleGetPendingEvents` at `subscriptions.ts:298-303` DOES pass `args.session_id` to `fileWatcher.drainEvents(sessionId)`. The file-watcher path IS session-filtered. The description is stale and will cause agents using this tool to believe session filtering does not work, leading them to either not pass `session_id` (safe but inefficient — they drain all sessions' file events) or to not trust the filtering (causing extra cross-session polling). More critically, agents reading this description may pass no `session_id` and silently consume events from other sessions (linking back to C001 for emit_events, where the filter truly is not implemented).

**Fix**: Update the description to: `'Optional session filter. When provided, file-watcher events are filtered by session_id. Note: emit_event events are not yet session-filtered — all emit events are returned regardless of this parameter.'` This both corrects the stale claim and documents the C001 gap.

---

### M002 [MAJOR]: `allow_file_fallback` semantics are not validated at config read time — typos silently default to false

**File**: `libs/worker-core/src/types.ts:65-71`

**Issue**: `allow_file_fallback?: boolean` is optional with `undefined = false` semantics per the handoff. This is correct for TypeScript callers that construct the object programmatically. However, `NitroFueledConfig` is presumably read from `.nitro-fueled/config.json` at runtime via `JSON.parse`. If a user writes `"allow_file_fallback": "true"` (string instead of boolean), or `"allow_fallback": true` (typo in key), the TypeScript type will not catch this at runtime — `JSON.parse` returns `unknown` and must be cast. If the cast is not validated (e.g., `config as NitroFueledConfig`), the runtime value of `allow_file_fallback` will be `undefined` (key typo) or `"true"` (string), both of which are falsy in `if (!config.allow_file_fallback)` checks. The user set the flag, believes it is enabled, but the Supervisor stops on cortex failure instead of degrading gracefully. No error is shown.

Without seeing the config-read path I cannot confirm whether Zod validation is applied, but the SKILL.md description references `allow_file_fallback: true in .nitro-fueled/config.json` as a user-facing instruction, which means users are typing this value manually.

**Fix**: Confirm the config reader applies `z.boolean()` validation to `allow_file_fallback`. If it does a plain cast, add a runtime boolean check: `typeof parsed.allow_file_fallback === 'boolean' ? parsed.allow_file_fallback : false` and warn on unexpected type.

---

### M003 [MAJOR]: FileWatcher.subscribe() sets `sub.satisfied = true` BEFORE the async condition evaluation completes — concurrent watcher events can skip the queue

**File**: `packages/mcp-cortex/src/events/subscriptions.ts:167-173`

**Issue**: In the `onEvent` handler:

```ts
const onEvent = () => {
  if (sub.satisfied) return;
  sub.satisfied = true;                    // marked satisfied immediately
  this.evaluateCondition(...).catch(...);  // async evaluation starts
};
```

`evaluateCondition` for `file_value` and `file_contains` types reads the file asynchronously. If the condition is NOT met (e.g., file exists but value doesn't match), `evaluateCondition` resets `sub.satisfied = false` at line 247. This is intentional — it allows the watcher to re-fire. However, between the `sub.satisfied = true` line and the async file read, a second `change` event can fire on the same file. The second `onEvent` call sees `sub.satisfied = true` and returns immediately — it is gated out. If the first evaluation ultimately resets `satisfied = false`, the second event is permanently lost. The file changed twice but only one evaluation attempt was made, and if that evaluation failed, the subscription is silently waiting for a third change that may never come.

This is not a new bug introduced by this PR (the logic was pre-existing), but the new test coverage did NOT add a test for this scenario, so the PR's changes leave the gap uncovered.

**Fix**: Track a separate `evaluating` flag. Only gate new `onEvent` calls when both `satisfied` is true AND the event was actually enqueued. If `evaluateCondition` finds the condition unmet and resets `satisfied`, any event received during the async window should trigger a re-evaluation, not be silently dropped.

---

### m001 [MINOR]: Test for handleGetPendingEvents only covers the empty-queue case — no test for combined drain

**File**: `packages/mcp-cortex/src/events/subscriptions.spec.ts:226-238`

**Issue**: The new test added in this PR passes `new EmitQueue()` to `handleGetPendingEvents` and verifies an empty result. This is a build-fix test, not a behavior test. There is no test that:
- Enqueues an emit_event into EmitQueue and verifies it appears in `handleGetPendingEvents` output
- Verifies that file-watcher events and emit_events appear together in the combined `events` array
- Verifies the combined output shape matches what the Supervisor expects

The test proves the function can be called without crashing. It does not prove the integration is correct.

**Fix**: Add a test that enqueues one `EmittedEvent` into the queue, then calls `handleGetPendingEvents`, and asserts `data.events.length === 1` with the expected `source: 'emit_event'` field.

---

### m002 [MINOR]: printSummary condition is inverted — step shown when cortex IS configured

**File**: `apps/cli/src/commands/init.ts:363-365`

**Issue**:

```ts
if (skipCortex) {
  console.log(`  ${step++}. npx nitro-fueled init --cortex-path <path>   Configure nitro-cortex MCP server`);
}
```

The step says "Configure nitro-cortex MCP server" and is shown when `skipCortex` is true. This is correct — if the user skipped cortex, they should be told how to configure it later. This is NOT a bug. However, when `skipCortex` is false AND `--cortex-path` was not provided and the user pressed Enter at the prompt (cortex config was also skipped interactively), `printSummary` receives `skipCortex = false` and the step is NOT shown, leaving the user without guidance on configuring cortex. The `skipCortex` parameter only reflects the `--skip-cortex` flag, not whether cortex was actually configured during the run.

**Fix**: Pass a `cortexConfigured: boolean` parameter to `printSummary` instead of `skipCortex`, derived from whether `handleNitroCortexConfig` actually wrote the configuration.

---

### m003 [MINOR]: DEPRECATED.md migration instructions point to the wrong path format

**File**: `apps/session-orchestrator/DEPRECATED.md:20`

**Issue**: The migration instructions say:

```
Run `npx nitro-fueled init --cortex-path <path>` to configure the new single MCP server,
where `<path>` points to the `packages/mcp-cortex` directory in this repository.
```

This is correct for users running the CLI against this monorepo. However, external users who installed nitro-fueled via `npx @itqanlab/nitro-fueled init` into their own project will not have `packages/mcp-cortex` — they need to install or clone the cortex package separately. The DEPRECATED.md does not explain this distinction, which will confuse external adopters.

**Fix**: Add a note clarifying that `<path>` must point to a local clone of `mcp-cortex` or the published npm package path when nitro-cortex is released as a standalone package.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The most dangerous silent failure is C001: a Supervisor session drains emit_events belonging to a different concurrent session. The emitting worker gets `{ok: true}`, but the event is consumed by the wrong session's `get_pending_events` call. The correct supervisor never sees the phase transition. From the supervisor's perspective the worker is making no progress — it will eventually be treated as stuck and killed or retried. No error, no log, no diagnostic.

The second silent failure is m002: a user who presses Enter to skip cortex setup during `init` gets no "Next step: configure cortex" guidance in the summary, even though cortex was not actually configured.

### 2. What user action causes unexpected behavior?

A user who types `"allow_file_fallback": "true"` (string) in config.json instead of `true` (boolean) will set the flag, believe degraded mode is enabled, restart the Supervisor, and then have it abort when cortex is unavailable — exactly the behavior they tried to opt out of. No error references the config key.

### 3. What data makes this produce wrong results?

Any `emit_event` emitted during a multi-session run (two Supervisors running, which is technically warned against but not hard-blocked) will be consumed by whichever supervisor calls `get_pending_events` first, regardless of which session the worker belongs to.

### 4. What happens when dependencies fail?

- `configureNitroCortex` returns `false` on failure. `init.ts` logs a warning and continues. The manifest is still written. The user's `.nitro-fueled/manifest.json` shows a successful install but cortex is unconfigured. On next `run`, the Supervisor hits FATAL and stops. The user must diagnose the mismatch.
- `evaluateCondition` fails to read the file on both attempts (lines 224-232) and resets `sub.satisfied = false`. The subscription remains active but the watcher is NOT re-registered — `cleanup(workerId)` is called in `enqueueAndCleanup` only when the condition IS met. So a transient read failure leaves the subscription alive to re-fire on the next file change. This is actually correct behavior, but it is not documented.

### 5. What's missing that the requirements didn't mention?

- No migration script or automated detection for existing `.mcp.json` files that contain `session-orchestrator`. The handoff documents this as a known risk but there is no path for existing users to discover it without reading deprecation docs.
- No version bump in `packages/mcp-cortex/src/index.ts` server version string. The server still reports `0.4.0` despite gaining `emit_event` and `subscribe_worker` functionality. If a client checks the server version to determine feature availability, it will get stale data. (The version string in `McpServer` constructor and the `console.error` startup message both say `0.4.0`.)
- `get_pending_events` in the MCP tool description says "not yet implemented" for session filtering, which is misleading (M001). An AI agent reading the tool list at runtime will make sub-optimal decisions based on this stale description.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Add `isError?: boolean` to ToolResult | COMPLETE | None — single-line change, correct |
| Pass EmitQueue to handleGetPendingEvents test | COMPLETE | Test only covers empty-queue path (m001) |
| Remove session-orchestrator from init.ts | COMPLETE | Silent fallthrough on JSON parse error not warned (C002) |
| Add `allow_file_fallback` to NitroFueledConfig | COMPLETE | No runtime validation at config read time (M002) |
| Write DEPRECATED.md | COMPLETE | Migration instructions incomplete for external users (m003) |
| SKILL.md: cortex hard-fail by default | COMPLETE | None |
| SKILL.md: allow_file_fallback opt-in degraded mode | COMPLETE | Mirrors M002 — user config typo silently defaults to false |

### Implicit Requirements NOT Addressed

1. `EmittedEvent` in `subscriptions.ts` does not carry `session_id`, making session-scoped drain of emit_events impossible (C001). The file-watcher path has session awareness but the emit path does not.
2. No MCP server version bump after adding significant new tools (emit_event, subscribe_worker integration) — semantic versioning expectations are violated.
3. No warning to existing users that their `.mcp.json` may contain a deprecated `session-orchestrator` entry that will cause two MCP servers to start unnecessarily.
