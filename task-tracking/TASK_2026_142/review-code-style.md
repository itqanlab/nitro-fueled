# Code Style Review — TASK_2026_142

## Score: 6/10

## Findings

### C001 [MAJOR]: Stale `session-orchestrator` references in SKILL.md

**File**: `.claude/skills/auto-pilot/SKILL.md:66`, `.claude/skills/auto-pilot/SKILL.md:579`

**Issue**: Two references to `session-orchestrator` by name remain in the file after the migration to nitro-cortex:

- Line 66: `> **Note on stuck detection**: Stuck detection is server-side -- the MCP session-orchestrator determines the stuck health state...`
- Line 579: `"MCP session-orchestrator unreachable after 3 retries. Supervisor paused. State saved. Resolve MCP connection and re-run /auto-pilot to resume."`

The deprecation notice (`apps/session-orchestrator/DEPRECATED.md`) and the surrounding SKILL.md text consistently refer to `nitro-cortex`, but these two sentences were not updated. The runtime log message at line 579 is user-facing — a Supervisor running after migration will emit a message naming a server that no longer exists, which will confuse operators tracing an incident.

**Fix**: Replace both references: line 66 should name `nitro-cortex` as the server determining stuck state; line 579 should read `"MCP nitro-cortex unreachable..."`.

---

### C002 [MINOR]: `handleGetPendingEvents` call signature mismatch in spec

**File**: `packages/mcp-cortex/src/events/subscriptions.spec.ts:230`

**Issue**: The production signature (confirmed in `subscriptions.ts:298`) is:

```
handleGetPendingEvents(fileWatcher: FileWatcher, emitQueue: EmitQueue, sessionId?: string): ToolResult
```

The test at line 230 calls:

```typescript
handleGetPendingEvents(watcher, new EmitQueue())
```

The argument order is correct and `sessionId` is optional, so this compiles and passes today. However, the spec imports `EmitQueue` from `subscriptions.js` and constructs it inline — it does not test the `sessionId` filter path at all. The "empty queue" case is the only scenario exercised. This is not wrong per se, but it means the `sessionId` filtering logic added as part of this task is untested. Given that the task handoff explicitly states `EmitQueue` was added to fix the build, the test covers only the minimal case rather than the new behaviour.

**Fix**: Consider adding a second test case that passes a `sessionId` to confirm filter-by-session works (or add a TODO comment to flag the gap so the next reviewer knows it was intentional).

---

### C003 [MINOR]: JSDoc comment uses double-dash inside comment block

**File**: `libs/worker-core/src/types.ts:69`

**Issue**: The JSDoc for `allow_file_fallback`:

```typescript
/** When false (default), nitro-cortex MCP unavailability = error + stop. Set true to enable degraded file-based fallback. */
```

This is a single-line doc comment on a one-liner property — stylistically fine. However the field name uses `snake_case` (`allow_file_fallback`) while all other fields in `NitroFueledConfig` also use `camelCase` (`launchers`, `providers`, `routing`). The snake_case field breaks naming consistency within the same interface.

**Fix**: Rename to `allowFileFallback` to match the interface's `camelCase` convention. Update all read sites in SKILL.md (the config JSON key name can remain snake_case in the config file if that is intentional, but the TypeScript property should be camelCase).

---

### C004 [MINOR]: `ToolResult` type is a single-line export with no JSDoc

**File**: `packages/mcp-cortex/src/tools/types.ts:1`

**Issue**: The entire file is one line. Adding `isError?: boolean` is the correct MCP SDK field name, and the type is correct. However:

1. There is no JSDoc explaining what `isError` means or when callers should set it. The `isError` flag controls how the MCP SDK surfaces the result to the host — callers who forget to set it for error paths will silently return successful-looking responses with error text inside. This is a non-obvious semantic that deserves documentation.
2. The `content` array type (`Array<{ type: 'text'; text: string }>`) is an inline anonymous type rather than a named type, making it harder to extend if more content block types are added later.

**Fix**: Add a one-line JSDoc above the type: `/** MCP tool response. Set isError: true when the tool encountered an error — the host uses this flag, not the text content, to determine error status. */`

---

### C005 [MINOR]: DEPRECATED.md migration guidance is incomplete for `--overwrite` users

**File**: `apps/session-orchestrator/DEPRECATED.md:17-21`

**Issue**: The migration section says:

```
Run `npx nitro-fueled init --cortex-path <path>` to configure the new single MCP server
```

The handoff explicitly notes: "Users with existing `.mcp.json` containing `session-orchestrator` entry will need to remove it manually — no migration tool provided." The deprecation file does not mention this manual removal step. A user following the DEPRECATED.md instructions will re-run `init`, which configures nitro-cortex but does NOT remove the stale `session-orchestrator` entry. They will end up with both entries, which is arguably worse than neither.

**Fix**: Add a step to the Migration section:

```
1. Remove the `session-orchestrator` entry from your `.mcp.json` manually.
2. Run `npx nitro-fueled init --cortex-path <path>` to add `nitro-cortex`.
```

---

### C006 [MINOR]: `init.ts` — `detectMcpConfig` import removal not confirmed; residual utility export not flagged

**File**: `apps/cli/src/commands/init.ts:7` and handoff note

**Issue**: The handoff notes that "`detectMcpConfig` import removed from `init.ts`" and that "`apps/cli/src/utils/mcp-configure.ts` still exports `configureMcp` (not removed)". The current `init.ts` imports `configureNitroCortex` from `mcp-configure.js` (line 7). The `configureMcp` export is dead from `init`'s perspective but may still be consumed by other callers. This is an accepted known risk per the handoff but there is no `// TODO` or comment at the import site to alert future reviewers that `mcp-configure.ts` has a partially-unused public surface. Without a marker, the dead export will persist indefinitely.

**Fix**: Add a comment in `mcp-configure.ts` or a `TODO` ticket noting that `configureMcp` is no longer called by `init` and can be removed in a follow-up cleanup.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The stale `session-orchestrator` name in the SKILL.md error message (C001, line 579) is a user-facing string. When a Supervisor session fails to reach nitro-cortex and prints that message, an operator will search documentation and configs for `session-orchestrator` — a server that has been deprecated — rather than diagnosing `nitro-cortex`. Incident triage time increases.

### 2. What would confuse a new team member?

The `allow_file_fallback` field name (C003) sitting in a `camelCase` interface will prompt a new contributor to ask why this field is different. If they follow the naming convention and rename it, they will break the config JSON key unless the deserialization layer handles both forms. The inconsistency is a silent trap.

### 3. What's the hidden complexity cost?

`ToolResult.isError` has no documentation (C004). The flag has a non-obvious semantic — the MCP host uses the flag, not the content text, to decide error vs success. Every tool handler that returns an error path and omits `isError: true` is silently wrong. One undocumented field compounds across the entire tool surface.

### 4. What pattern inconsistencies exist?

Two places remain that name `session-orchestrator` directly (C001), while the rest of the SKILL.md and the new DEPRECATED.md consistently use `nitro-cortex`. The renaming was partial.

### 5. What would I do differently?

- Complete the `session-orchestrator` → `nitro-cortex` rename in SKILL.md in the same PR that adds the deprecation notice.
- Rename `allow_file_fallback` to `allowFileFallback` at the TypeScript interface level; use the snake_case form only in the JSON config file and coerce at parse time.
- Add a short JSDoc to `isError?` to close the documentation gap before the type proliferates across tool handlers.

## Summary

The implementation is functionally correct and the scope of changes is appropriately narrow. The single most impactful gap is the stale `session-orchestrator` name in two places of SKILL.md — one of which is a user-facing error message emitted at failure time (C001). The `camelCase` inconsistency on `allow_file_fallback` (C003) is a maintainability smell that will compound as the config type is read in more places. The remaining findings are documentation gaps. No blocking issues; two majors that should be addressed before this is considered complete.
