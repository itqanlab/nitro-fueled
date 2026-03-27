# Security Review — TASK_2026_063

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 6/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 17                                   |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `working_directory` accepted from caller without boundary validation in spawn_worker; `itermSessionId` interpolated into AppleScript without safe-character guard |
| Path Traversal           | PASS   | file-watcher.ts uses `path.resolve` + boundary check correctly; subscribe-worker.ts uses registry-sourced directory correctly |
| Secret Exposure          | PASS   | No hardcoded secrets; API key sourced from env var only |
| Injection (shell/prompt) | FAIL   | iTerm launcher interpolates `workingDirectory` and `label` into AppleScript using shell-level single-quote escaping that is incomplete for AppleScript context; `label` used with double-quote escaping only but unescaped backslashes can still break the outer AppleScript string |
| Insecure Defaults        | FAIL   | `process-launcher.ts:mkdirSync` creates `.worker-logs` directory without an explicit mode, defaulting to 0o755 (world-listable); `worker-registry.ts` type guard does not validate individual Worker field shapes — loads structurally malformed entries into memory |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: AppleScript Injection via `workingDirectory` in iterm-launcher.ts

- **File**: `packages/session-orchestrator/src/core/iterm-launcher.ts:24-31`
- **Problem**: The `workingDirectory` value (caller-supplied, passed through from `spawn_worker`) is interpolated directly into an AppleScript string using single-quote shell escaping (`cd '${opts.workingDirectory}'`). The code escapes backslashes and double-quotes in `escapedPrompt` and `asLabel`, then re-escapes for AppleScript, but `workingDirectory` receives no escaping at all before it is placed in the shell command string at line 25. A path containing a single quote (e.g., `/Users/alice/my project's/dir`) breaks the single-quote shell context, allowing injection into the shell command that iTerm executes, which in turn is embedded in AppleScript.
- **Impact**: An attacker who can control the `working_directory` argument to `spawn_worker` (valid within the MCP threat model — any Claude Code session can call this tool) can inject arbitrary shell commands that execute in the iTerm window under the user's account.
- **Fix**: Apply the same single-quote escaping to `workingDirectory` as is done for `escapedPrompt` (replace `'` with `'\''`), or switch to an absolute-path-only check + `spawnSync`/`spawn` with an argument array so no shell is involved.

---

### Issue 2: `itermSessionId` Interpolated into AppleScript Without Validation

- **File**: `packages/session-orchestrator/src/core/iterm-launcher.ts:121`
- **Problem**: In `closeItermSession`, the caller-supplied `itermSessionId` (a string stored in the registry at spawn time) is interpolated verbatim into an AppleScript string: `if unique ID of aSession is "${itermSessionId}"`. The registry hydration type guard (`isPersistedRegistry`) checks only that `entries` is an array and `version` is a number — it does not validate individual Worker fields. A corrupted or hand-edited `registry.json` with a crafted `iterm_session_id` value containing `"` can break the AppleScript string boundary and inject AppleScript commands.
- **Impact**: Local attacker with write access to `~/.session-orchestrator/registry.json` can inject AppleScript that executes arbitrary commands under the user's account when any worker is killed or auto-closed.
- **Fix**: Validate `itermSessionId` against the known UUID format (e.g., `/^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i`) before interpolating into AppleScript. Also validate individual Worker fields in `isPersistedRegistry` or a per-entry guard.

---

### Issue 3: `resolveSessionId` Parses External JSON Without a Type Guard

- **File**: `packages/session-orchestrator/src/core/jsonl-watcher.ts:324-327`
- **Problem**: `resolveSessionId` reads a PID-keyed JSON file from `~/.claude/sessions/` and immediately accesses `.sessionId` via a direct `as SessionMeta` cast: `const meta: SessionMeta = JSON.parse(readFileSync(sessionFile, 'utf-8'))`. There is no runtime validation. If the file is absent, malformed, or contains a non-string `sessionId`, the access will either throw (crashing the function's caller) or silently return `undefined` cast as `string`. This file is written by Claude Code itself, not this package, so its schema can change across CLI versions.
- **Impact**: A schema change in the Claude Code CLI's session file format would cause `resolveSessionId` to return a garbage session ID for iTerm workers, correlating them incorrectly and potentially causing stats to be written to the wrong worker's registry entry.
- **Fix**: Load as `unknown`, validate `typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string, unknown>).sessionId === 'string'` before access, and return `null` on validation failure.

## Minor Issues

1. **`process-launcher.ts:25` — `.worker-logs` directory created without explicit mode** — `mkdirSync(logDir, { recursive: true })` creates the directory with the process umask default (typically 0o755, world-listable). Log files capture stderr from subprocess workers and may contain prompt content or stack traces. The directory should be created with `{ recursive: true, mode: 0o700 }` per the existing pattern in `index.ts` (which correctly uses `mode: 0o700` for the registry directory).

2. **`worker-registry.ts:150-153` — `isPersistedRegistry` type guard only validates the outer shape, not per-entry Worker fields** — the guard confirms `version` is a number and `entries` is an array, but does not validate that each entry `[id, worker]` conforms to the Worker interface. A partially-written or schema-drifted registry.json will load silently malformed Worker objects that may cause crashes when their fields are dereferenced. A per-entry guard checking at minimum `typeof worker.pid === 'number'`, `typeof worker.working_directory === 'string'`, and `typeof worker.launcher === 'string'` would make hydration safe across schema versions.

3. **`subscribe-worker.ts:10-11` — `event_label` field accepts any string matching `min(1).max(100)` with no character-set constraint** — `event_label` values are echoed in MCP responses returned to the caller by `get_pending_events`. While the current usage is internal, the lack of a character-set constraint (no allowlist, no rejection of control characters or newlines) means crafted labels could confuse downstream string parsers that treat the response as line-delimited text. Constraining to `/^[A-Z0-9_]{1,64}$/` at the Zod layer would close this without breaking any current consumers.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: AppleScript injection via unescaped `workingDirectory` in the iTerm launcher — a caller supplying a working directory path containing a single quote can inject shell commands executed inside the AppleScript-driven iTerm window (Issue 1). This is pre-existing in the original repo, but crosses the OWASP injection threshold and should be fixed before the package ships as part of the monorepo.

**Note on BLOCKING classification**: Per the task instructions, BLOCKING status is reserved for issues introduced by this move task itself (not pre-existing). All three serious issues above are pre-existing in the original repo. None were introduced by the copy-move operation itself. The move is mechanically clean — no security regression was introduced. All three issues are marked ADVISORY for this task but should be tracked for remediation.
