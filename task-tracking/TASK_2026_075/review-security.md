# Security Review — TASK_2026_075

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Task:** Refactor session-orchestrator to consume @nitro-fueled/worker-core
**Verdict:** CONDITIONAL PASS — 2 medium findings require attention before merge

---

## Scope

Files reviewed (per task.md File Scope):
- `apps/session-orchestrator/src/index.ts`
- `apps/session-orchestrator/src/tools/get-pending-events.ts`
- `apps/session-orchestrator/src/tools/spawn-worker.ts`
- `apps/session-orchestrator/src/tools/subscribe-worker.ts`
- `apps/session-orchestrator/package.json`

---

## Findings

### MEDIUM — Path traversal in subscribe_worker conditions

**File:** `apps/session-orchestrator/src/tools/subscribe-worker.ts:6-21`

The `path` field in all three watch condition types is validated only for length (`z.string().min(1).max(500)`) but not for path traversal sequences. A caller can pass a value like `../../../../etc/passwd` and the schema will accept it. The actual path resolution — joining `worker.working_directory` with the provided path — happens inside `fileWatcher.subscribe` in `@nitro-fueled/worker-core` (out of scope), so whether directory escape is possible depends on that implementation.

The risk is real: if `FileWatcher` does a naive join without `path.resolve` + containment check, any file on the filesystem can be watched. Given the `file_value` and `file_contains` condition types read file contents, this could expose sensitive files.

**Recommendation:** Add a `.refine()` check on `path` to reject values containing `..` segments:
```typescript
path: z.string().min(1).max(500)
  .refine((p) => !p.split('/').includes('..'), { message: 'Path traversal not allowed' })
```

---

### MEDIUM — Inconsistent input validation on emit_event label

**File:** `apps/session-orchestrator/src/index.ts:153`

The `subscribe_worker` tool restricts `event_label` to `/^[A-Z0-9_]{1,64}$/` (uppercase alphanumeric + underscores). The `emit_event` tool applies only `z.string().max(64)` on its `label` field — no character restriction. Labels from both sources are merged and returned together by `get_pending_events`, but a Supervisor consuming these events may use the label for routing or status transitions. Allowing arbitrary characters (spaces, special chars, injection sequences) in a field treated as a state machine signal is inconsistent and could cause unexpected behavior in consumers.

**Recommendation:** Apply the same regex pattern used in `subscribe-worker.ts`:
```typescript
label: z.string().regex(/^[A-Z0-9_]{1,64}$/).describe(...)
```

---

### LOW — Unbounded prompt input allows DoS via memory/cost inflation

**File:** `apps/session-orchestrator/src/tools/spawn-worker.ts:9`

```typescript
prompt: z.string().describe('Full prompt to send to the worker session'),
```

No `max()` constraint is applied. A malicious or buggy caller can pass a multi-megabyte prompt, exhausting worker context immediately and inflating cost. While this is an internal MCP server (not publicly exposed), the attack surface includes any agent or script connected via the MCP protocol.

**Recommendation:** Add a reasonable upper bound (e.g., `z.string().max(50_000)`).

---

### LOW — Unsafe `as` type assertions bypass type safety

**Files:**
- `apps/session-orchestrator/src/index.ts:168` — `data as Record<string, unknown> | undefined`
- `apps/session-orchestrator/src/tools/spawn-worker.ts:101` — `msg as JsonlMessage`
- `apps/session-orchestrator/src/tools/spawn-worker.ts:147` — `msg as JsonlMessage`

These assertions suppress TypeScript's type checker without validation. If the runtime value does not match the asserted type, errors are silently swallowed rather than surfaced. The `data` payload at `index.ts:168` is particularly notable: it is external input accepted directly from a tool caller and cast without any type guard before being enqueued.

**Recommendation:** Replace with type guards (`typeof`, `instanceof`, narrowing predicates) or remove the casts if the type is already inferred correctly by TypeScript.

---

### LOW — No size limit on emit_event data payload

**File:** `apps/session-orchestrator/src/index.ts:154`

```typescript
data: z.record(z.string(), z.unknown()).optional()
```

The `data` object has no constraints on key count, key length, or value depth. An oversized payload will be stored in the in-memory `EventQueue` and serialized in every `get_pending_events` response. This could cause memory pressure or large MCP response payloads.

**Recommendation:** Add a depth/size constraint, or limit via key count (e.g., `z.record(z.string().max(64), z.unknown())` plus a `.refine` to cap key count at 20).

---

### LOW — Error messages may leak internal paths

**File:** `apps/session-orchestrator/src/tools/subscribe-worker.ts:56`

```typescript
text: JSON.stringify({ subscribed: false, error: String(err), watched_paths: [] }),
```

`String(err)` on a Node.js `Error` includes the message, which may contain filesystem paths from inside `fileWatcher.subscribe`. In a local MCP server context this is low risk, but it diverges from the defensive posture of only returning structured error codes to callers.

**Recommendation:** Log the full error to `process.stderr` and return a generic error code to the caller, or at minimum check `err instanceof Error` before extracting the message.

---

### INFO — Wildcard dependency version for @nitro-fueled/worker-core

**File:** `apps/session-orchestrator/package.json:17`

```json
"@nitro-fueled/worker-core": "*"
```

A wildcard resolves to any version, including future ones that may introduce breaking behavior. For an internal monorepo workspace dependency this is typically managed by Nx/pnpm workspace resolution, but it is worth noting that explicit workspace pinning (`"workspace:*"`) or a semver range would be more explicit about the intent.

**No action required** if this is a workspace package resolved at build time by Nx. Flagging for awareness.

---

### INFO — No authentication on MCP server

**File:** `apps/session-orchestrator/src/index.ts` (StdioServerTransport)

The MCP server uses stdio transport with no caller authentication. Any process that connects via stdio (e.g., any MCP client or piped process) can call `spawn_worker`, `kill_worker`, or `emit_event`. This is standard for MCP servers running as local user processes, but it means the server fully trusts its caller. OS-level process isolation is the only boundary.

**No action required** — this is by design for local MCP servers. Documented for awareness.

---

### POSITIVE — Strong security patterns observed

- **Registry directory permissions** (`index.ts:27`): `mode: 0o700` limits registry access to the owner. Good practice.
- **Working directory source** (`subscribe-worker.ts:52`): `worker.working_directory` is taken from the trusted registry, not from caller-supplied input. This is a correct trust boundary.
- **Incompatible flag rejection** (`spawn-worker.ts:37`): `use_iterm + provider=opencode` combination rejected eagerly with a clear error.
- **Consistent use of Zod validation** across all tool schemas provides a strong input validation foundation.
- **No remaining local `./core/` imports** — the refactor target (TASK_2026_075 acceptance criteria) is met; all imports correctly point to `@nitro-fueled/worker-core`.

---

## Summary Table

| Severity | Count | Status |
|----------|-------|--------|
| HIGH     | 0     | —      |
| MEDIUM   | 2     | Require fix before merge |
| LOW      | 4     | Should fix |
| INFO     | 2     | Awareness only |

The two MEDIUM findings (path traversal in watch conditions, inconsistent label validation) should be addressed. All other findings are quality improvements that do not block merge.
