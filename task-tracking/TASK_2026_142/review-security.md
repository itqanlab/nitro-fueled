# Security Review — TASK_2026_142

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 6                                    |

Files reviewed:
- `packages/mcp-cortex/src/events/subscriptions.ts`
- `packages/mcp-cortex/src/index.ts`
- `packages/mcp-cortex/src/tools/types.ts`
- `apps/cli/src/commands/init.ts`
- `libs/worker-core/src/types.ts`
- `.claude/skills/auto-pilot/SKILL.md` (partial — cortex/fallback section)

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `label` field character set unconstrained; emit events enqueued for non-existent workers |
| Path Traversal           | PASS   | `FileWatcher.subscribe` uses `path.resolve` + boundary check; `followSymlinks: false` set |
| Secret Exposure          | PASS   | No credentials or tokens in any reviewed file |
| Injection (shell/prompt) | PASS   | No shell exec with user data; `spawnSync` in init.ts uses argument array form |
| Insecure Defaults        | PASS   | `allow_file_fallback` defaults to false (hard-stop); no dangerous opt-in-by-default |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue S001: `emit_event` label field has no character-set constraint — control characters and arbitrary strings reach the event queue

- **File**: `packages/mcp-cortex/src/index.ts:301-305` and `packages/mcp-cortex/src/events/subscriptions.ts:46-47`
- **Problem**: The Zod schema for `emit_event.label` enforces only `max(64)`. The sanitizer in `handleEmitEvent` strips `\r`, `\n`, and `\x1b` but leaves all other characters — Unicode, terminal escape sequences beyond ESC, arbitrary printable/non-printable content — intact. The sanitized label is stored as `event_label` in the emitted event and is returned verbatim by `get_pending_events`. Because the Supervisor reads these events and acts on their labels (routing decisions, log entries), an adversarial or corrupted worker can inject labels containing prompt-injection content (e.g., embedded newlines via `\u2028`/`\u2029`, Unicode look-alike sequences, or multi-line payloads if the sanitizer is bypassed by using U+2028 LINE SEPARATOR). The existing security lesson from TASK_2026_067 explicitly identifies this pattern.
- **Impact**: A compromised worker can craft labels that (a) appear identical to legitimate labels (`PM_COMPLETE`, `IMPLEMENTED`) when rendered but carry extra content, (b) manipulate the Supervisor's behavioral decisions if the label value reaches an LLM-evaluated step, or (c) corrupt log files written from event payloads.
- **Fix**: Constrain `label` in the Zod schema to an allowlist pattern: `z.string().regex(/^[A-Z0-9_]{1,64}$/).describe(...)`. The implementation already validates `worker_id` with a strict regex; apply the same treatment to `label`. Reject values that do not match and return `{ ok: false, error: 'invalid label format' }`.

---

### Issue S002: `emit_event` enqueues events for worker IDs not present in the DB — event spoofing by any caller that knows the UUID format

- **File**: `packages/mcp-cortex/src/events/subscriptions.ts:59-62`
- **Problem**: When `db.prepare('SELECT id FROM workers WHERE id = ?').get(args.worker_id)` returns nothing, the code logs a warning to stderr but then proceeds to enqueue the event. The queue is drained by `get_pending_events` and acted upon by the Supervisor. Any process with access to the MCP server (which is local stdio, so limited; but multiple workers share the same cortex instance) can emit arbitrary events by providing any valid-UUID-format worker_id — even one that was never spawned. This means a rogue or misconfigured worker from a prior session, or any MCP client, can inject events into the current Supervisor's queue.
- **Impact**: An event with a fabricated worker_id and a label of `IMPLEMENTED` or `COMPLETE` could cause the Supervisor to falsely transition a task's state, spawn unwarranted downstream workers, or skip review. While exploitation requires control of an MCP client, this is a weak authorization boundary for a security-critical event bus.
- **Fix**: Reject the call (return `{ ok: false, error: 'unknown worker_id' }`) when the worker is not found in the DB. The existing log line confirms the developer was aware of this path but chose to queue anyway — the comment should be reversed. If there is a legitimate "pre-registration" use case, consider adding a grace window or a separate pre-register API rather than silently accepting unknown IDs.

---

## Minor Issues

### M001: `get_pending_events` drains ALL emit events regardless of `session_id` filter

- **File**: `packages/mcp-cortex/src/events/subscriptions.ts:298-304` and `packages/mcp-cortex/src/index.ts:307-312`
- **Problem**: `handleGetPendingEvents` filters file watcher events by `sessionId` (correct) but calls `emitQueue.drain()` unconditionally — all emit events are returned regardless of session. If two Supervisor sessions run concurrently, the first `get_pending_events` call will consume emit events belonging to the second session's workers.
- **Impact**: In single-session deployments (current primary use case) this is harmless. In multi-session deployments it causes silent event loss: worker events are consumed by the wrong Supervisor. The `EmittedEvent` struct contains a `worker_id` but no `session_id`, which is the root cause.
- **Fix**: Add `session_id` to `EmittedEvent` (populated from the DB lookup already done in `handleEmitEvent`) and filter `emitQueue.drain()` by `sessionId` in the same way file events are filtered.

---

### M002: `EmittedEvent.data` type divergence between MCP implementation and shared library

- **File**: `packages/mcp-cortex/src/events/subscriptions.ts:21` vs `libs/worker-core/src/types.ts:143`
- **Problem**: In `subscriptions.ts`, `EmittedEvent.data` is typed as `Record<string, string>`, matching the Zod constraint. In `libs/worker-core/src/types.ts`, the same `EmittedEvent.data` is `Record<string, unknown>`. These are separate type definitions for what is conceptually the same interface. The shared type is wider than the validated type at the wire boundary.
- **Impact**: Code that imports from `libs/worker-core` and processes `event.data` values will see `unknown` values and may access them without guarding, relying on the incorrect assumption that the MCP enforces them as strings. Conversely, if the Zod schema is ever relaxed, the shared type would not reflect that change.
- **Fix**: Align the types. The Zod schema enforces `z.string().max(512)` for values, so `Record<string, string>` is correct at the MCP layer. The shared type should match: change `libs/worker-core/src/types.ts:143` to `data?: Record<string, string>`. Cross-reference the TypeScript cross-package rule from review-general.md.

---

### M003: `init.ts` — `.mcp.json` parse result uses `as` cast without deep runtime validation

- **File**: `apps/cli/src/commands/init.ts:241`
- **Problem**: `JSON.parse(readFileSync(projectMcp, 'utf-8')) as Record<string, unknown>` and the nested `maybeServers as Record<string, unknown>` casts provide no runtime protection if the file contains an unexpected shape. The code only reads the value (does not execute or write it), and the `try/catch` wraps the parse, so the impact is limited. However, a malformed or adversarially crafted `.mcp.json` could cause the `'nitro-cortex' in servers` check to throw a non-parse error (e.g., if `servers` is a Proxy or non-standard object), bypassing the existing-config guard.
- **Impact**: Low — worst case, the `nitro-cortex` already-configured guard is skipped and the user is re-prompted (or the config is rewritten). No remote code execution.
- **Fix**: Add `Array.isArray(maybeServers)` check before the `as` cast, and validate that `typeof servers === 'object' && servers !== null && !Array.isArray(servers)` before the `'nitro-cortex' in servers` check.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: S001 — The `emit_event` label field has no character-set constraint. A worker can inject arbitrary string content into the Supervisor's event queue via event labels. While exploitation requires a valid UUID format and MCP access, the Supervisor acts on label values for routing decisions, making this a real behavioral-injection surface. Add a regex allowlist (`/^[A-Z0-9_]{1,64}$/`) to the Zod schema as the primary fix.
