# Review Context — TASK_2026_121

## Task
nitro-cortex — Session + Worker Tools (Part 2 of 3)

Extends `packages/mcp-cortex` with session CRUD tools, worker lifecycle tools (spawn, list, stats, kill), JSONL stream monitoring, and a file-watcher event subscription system.

## Files Reviewed
- `packages/mcp-cortex/src/db/schema.ts`
- `packages/mcp-cortex/src/tools/sessions.ts`
- `packages/mcp-cortex/src/tools/workers.ts`
- `packages/mcp-cortex/src/process/spawn.ts`
- `packages/mcp-cortex/src/process/token-calculator.ts`
- `packages/mcp-cortex/src/process/jsonl-watcher.ts`
- `packages/mcp-cortex/src/events/subscriptions.ts`
- `packages/mcp-cortex/src/index.ts`

## Review Scores

| Review | Score |
|--------|-------|
| Code Style | 6/10 |
| Code Logic | 5/10 |
| Security | 5/10 |

## Review Files
- `review-code-style.md`
- `review-code-logic.md`
- `review-security.md`

---

## Findings Summary

**Total findings: 24** (1 CRITICAL, 9 HIGH, 8 MEDIUM, 6 LOW)

### CRITICAL

| # | Area | File | Issue |
|---|------|------|-------|
| C1 | Security | `process/spawn.ts:117-120` | `killWorkerProcess` fallback calls `process.kill(pid)` on any PID not in the in-memory map. A DB record with an arbitrary PID can terminate any OS process running under the same user. |

### HIGH

| # | Area | File | Issue |
|---|------|------|-------|
| H1 | Logic | `tools/workers.ts:97-100` | `onExit` callback unconditionally writes `completed`/`failed`, overwriting a `killed` status set by `kill_worker`. Intentional kills are invisible to the supervisor. |
| H2 | Logic | `tools/workers.ts:87-114` | DB INSERT races against process `onExit`. Fast-failing process fires exit callback before the workers row exists — UPDATE no-ops, worker stays `active` forever or has no DB record. |
| H3 | Logic | `process/jsonl-watcher.ts:200-202` | `pushStatsToDB` runs in a stream `data` handler with no try/catch. An SQLITE_BUSY error propagates as an uncaught stream exception and can kill the MCP server. |
| H4 | Logic | `process/jsonl-watcher.ts:179` | `context_percent` formula uses hardcoded `1_000_000` denominator. A 200k-context model at 150k tokens reports 15%. The `high_context` health gate (`> 80`) requires 800k tokens and is unreachable — context overload monitoring is non-functional. |
| H5 | Logic | `events/subscriptions.ts:188-191` | `get_pending_events` ignores the `session_id` parameter (documented as "not yet implemented"). The drain is destructive. In a two-supervisor deployment, the first supervisor to poll consumes the other's events — the second supervisor waits forever. |
| H6 | Logic | `tools/workers.ts:217-243` | `kill_worker` sends SIGTERM with no guard on `w.status`. A completed worker's PID may have been recycled by the OS — the signal terminates an unrelated process. |
| H7 | Security | `index.ts:68`, `index.ts:109` | `JSON.parse(args.fields)` called without try/catch in `update_task` and `update_session` handlers. Invalid JSON from any MCP client throws an unhandled exception and crashes the server. |
| H8 | Security | `tools/workers.ts:87`, `process/spawn.ts:27` | `working_directory` is only `z.string()` validated. Used as `cwd` for child process spawn, `.worker-logs` path, and GLM config resolver — none verify the path is within an allowed project root. |
| H9 | Security | `process/jsonl-watcher.ts:112-151` | Worker stdout messages processed with raw type casts and no numeric field validation. Non-numeric `usage.input_tokens` produces NaN in token accumulators, silently corrupting health checks. |

### MEDIUM

| # | Area | File | Issue |
|---|------|------|-------|
| M1 | Logic | `tools/sessions.ts:51-79` | `update_session` whitelist missing `ended_at` and `summary`. These fields exist on the schema but return a confusing "not updatable" error instead of pointing to `end_session`. |
| M2 | Logic | `process/jsonl-watcher.ts:113-122` | Token accumulation ambiguity: `result` messages overwrite totals (treating usage as cumulative), while `assistant` messages add deltas. One of these paths double-counts tokens depending on whether `result.usage` is cumulative or a delta. |
| M3 | Logic | `process/jsonl-watcher.ts:136-139` | Compaction count only increments, never resets. Two false positives permanently lock health at `compacting` for the worker's lifetime. |
| M4 | Logic | `process/jsonl-watcher.ts:76-86` | `auto_close` race: `pollAll` marks worker `completed`, then `onExit` (if the kill signal produces a non-zero exit code) can overwrite to `failed`. |
| M5 | Logic | `tools/workers.ts:58-115` | `handleSpawnWorker` does not validate session existence before INSERT. FK violation propagates as an unstructured exception instead of `{ ok: false, reason: 'session_not_found' }`. |
| M6 | Style | `tools/sessions.ts:2`, `tools/workers.ts:2` | `randomUUID` imported in `sessions.ts` but unused — session IDs use date strings. Duplicate `ToolResult` type declared identically in both files. |
| M7 | Style | `tools/workers.ts:13-32` | `WorkerRow` redeclares `status`, `worker_type`, `provider`, `launcher` as `string` despite schema exporting precise union types. Zero compiler enforcement on health decision logic. |
| M8 | Style | `process/jsonl-watcher.ts:179` | `contextPercent` formula bug (same root cause as H4) is a style issue too — magic constant `1_000_000` with no comment explaining intent. |

### LOW

| # | Area | File | Issue |
|---|------|------|-------|
| L1 | Logic | `tools/workers.ts:136-153` | `handleListWorkers` returns unstructured text. Every other tool returns JSON — this inconsistency breaks any caller that tries to parse the response. |
| L2 | Logic | `process/jsonl-watcher.ts:196` | `elapsed_minutes` always stored as `0` in `progress_json` — never computed from spawn time. |
| L3 | Logic | `events/subscriptions.ts:76` | `ignoreInitial: false` causes `file_value`/`file_contains` conditions to fire immediately on existing files from previous runs, potentially triggering stale events at subscribe time. |
| L4 | Security | `events/subscriptions.ts:152-163` | When event queue hits 1,000-cap, events are silently dropped with only a stderr write. Callers have no way to detect the drop. |
| L5 | Security | `process/spawn.ts:43-53` | For non-GLM providers, `process.env` is forwarded wholesale to the child process (including all secrets). For GLM, the env is explicitly constructed — inconsistent approach. |
| L6 | Style | `process/spawn.ts:3-4` | Two separate `node:path` imports (`join` and `resolve`) could be consolidated. |

---

## Acceptance Criteria Coverage

| Criterion | Status |
|-----------|--------|
| `create_session` + `get_session` round-trip | PASS |
| `spawn_worker` launches process + tracks in DB | PARTIAL — DB race on fast exit (H2) |
| `list_workers` returns status, tokens, cost | PARTIAL — unstructured text output (L1) |
| `kill_worker` terminates + updates status in DB | PARTIAL — `onExit` overwrites `killed` (H1) |
| `subscribe_worker` / `get_pending_events` end-to-end | PARTIAL — no session filter, events leak across sessions (H5) |
| `list_sessions` returns all active sessions | PASS |
| All session-orchestrator tools functionally equivalent | PARTIAL — `context_percent` broken (H4), no session filter (H5) |
| Two-supervisor concurrent `claim_task` safety | PASS — inherited from Part 1 |

## Verdict

**NEEDS_REVISION** — 1 critical + 9 high severity findings. The implementation has a correct structural foundation but several logic bugs that would cause real failures in production: events leaking across sessions (H5), killed workers appearing as completed (H1), a DB race on fast exit (H2), a broken health monitoring signal (H4), and a process-kill security issue (C1). These must be fixed before this task can be marked COMPLETE.
