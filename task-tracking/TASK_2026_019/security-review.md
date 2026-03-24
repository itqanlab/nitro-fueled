# Security Review — TASK_2026_019

## Summary

The print-mode token/cost tracking parses stdout JSON from a child process spawned by this server and feeds it into an in-memory registry. The attack surface is narrow (the child process is `claude` CLI launched by us), and the implementation is generally sound with a few minor notes.

## Findings

### [MINOR] Unchecked `as` cast on untrusted JSON — no runtime shape validation
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:85`
- **Issue**: The `onMessage` callback casts `msg as JsonlMessage` without validating the object shape. If the child process emits an unexpected JSON structure (e.g., missing `message.usage` on a `type: "assistant"` object), the code will throw at runtime in `processMessage()` when accessing `assistant.message.usage.input_tokens`. The same pattern exists in `jsonl-watcher.ts:155` (`JSON.parse(lines[i])` assigned directly to `JsonlMessage`). Since the source is the Claude CLI's `--output-format stream-json`, the risk of malformed data is low but non-zero (e.g., a future CLI version changes the schema, or stderr bleeds into stdout).
- **Fix**: Add a lightweight guard in `processMessage()` before accessing nested properties:
  ```ts
  if (msg.type === 'assistant') {
    const assistant = msg as JsonlAssistantMessage;
    if (!assistant.message?.usage) return; // guard
    ...
  }
  ```

### [MINOR] Prototype pollution via JSON.parse is not a practical risk here
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:63`, `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:155`
- **Issue**: `JSON.parse()` in V8/Node does not set `__proto__` from JSON keys — it creates plain objects. The parsed data is only read (numeric fields accumulated, string fields displayed), never spread onto prototypes or used as configuration keys. No prototype pollution vector exists.
- **Fix**: None needed. This is a confirmation of safety.

### [MINOR] Log file path construction — safe but worth noting
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:27`
- **Issue**: The `label` parameter is sanitized via `replace(/[^a-zA-Z0-9_-]/g, '_')` before being used in the log filename, which prevents path traversal (slashes, dots, null bytes all become underscores). The log directory is hardcoded to `{workingDirectory}/.worker-logs/`. This is correctly done.
- **Fix**: None needed. This is a confirmation of safety.

### [MINOR] Environment variable passthrough copies full env to child
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:43`
- **Issue**: `env: { ...process.env }` passes the entire parent environment to the child process. This is necessary for the `claude` CLI to function (it needs PATH, HOME, API keys, etc.). However, any secrets in the MCP server's environment (e.g., unrelated API keys) are also inherited by the child.
- **Fix**: Acceptable for the current trust model (same user, same machine). If this ever runs in a multi-tenant context, consider whitelisting env vars. No action needed now.

### [MINOR] `working_directory` from tool input used directly for `cwd` and log path
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:23,39`
- **Issue**: The `working_directory` parameter from the MCP tool call is used as `cwd` for `spawn()` and as the base for the log directory. An MCP client could pass any directory path. Since this MCP server is designed to be called by a trusted orchestrator (Claude Code CLI acting as supervisor), and the child process runs as the same OS user, this is within the expected trust boundary.
- **Fix**: None needed for current trust model. If exposed to untrusted callers, validate/restrict `working_directory`.

### [MINOR] Raw stdout/stderr appended to log files without sanitization
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:51,73`
- **Issue**: Child process stdout and stderr are appended verbatim to log files. No secrets filtering is applied. If the Claude CLI prints API keys or tokens in its output (unlikely but possible in error messages), they would be persisted in `.worker-logs/`. The logs are local files owned by the user.
- **Fix**: Low risk given the local execution model. No action required.

### [POSITIVE] Process spawning uses `spawn`, not `exec`
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:39`
- **Issue**: `spawn('claude', args, ...)` correctly avoids shell injection. Arguments are passed as an array, not interpolated into a shell string. `stdin` is set to `'ignore'`. `detached: false` ensures the child is tied to the parent's lifecycle.
- **Fix**: None needed. This is correct.

### [MINOR] `resolveJsonlPath` directory traversal in fallback search
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:302-316`
- **Issue**: The `resolveJsonlPath` function has a fallback that iterates all directories under `~/.claude/projects/` looking for a JSONL file matching the session ID. The `sessionId` is used directly in path construction (`${sessionId}.jsonl`). If a malicious session ID contained `../`, it could reference files outside the projects directory. However, the session ID comes from `resolveSessionId()` which reads it from a Claude-generated JSON file, or from the `print-${Date.now()}` pattern for print-mode workers. Neither path allows attacker-controlled input.
- **Fix**: For defense-in-depth, validate that `sessionId` contains no path separators: `if (sessionId.includes('/') || sessionId.includes('\\')) return null;`

## Verdict
PASS_WITH_NOTES

The code is sound for its trust model (local MCP server called by a trusted orchestrator, same user). The main actionable item is adding a null guard on the `as JsonlAssistantMessage` cast to prevent runtime crashes if the Claude CLI's output format changes. The path traversal defense-in-depth suggestion for `resolveJsonlPath` is also worth implementing. No blocking issues found.
