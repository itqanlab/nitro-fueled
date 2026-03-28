# Security Review — TASK_2026_074

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** `b039b03` — `refactor(worker-core): extract libs/worker-core from apps/session-orchestrator`
**Scope:** libs/worker-core + modified apps/session-orchestrator files (see review-context.md)

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Serious  | 2 |
| Minor    | 7 |

No blocking issues. Two serious findings both reside in `iterm-launcher.ts` and are exploitable only when `use_iterm=true` (non-default). Seven minor issues cover type assertions, missing input bounds, and defensive coding gaps.

---

## Serious Findings

### S-01 — Command injection via `prompt` in iTerm mode

**File:** `libs/worker-core/src/core/iterm-launcher.ts:18–48`
**OWASP:** A03:2021 – Injection

**Description:**
`launchInIterm` escapes the prompt for POSIX single-quoted shell context, then re-escapes the resulting shell command for AppleScript double-quoted string context. The two escaping passes interact incorrectly: the `\'` sequences produced by the POSIX single-quote escape contain a backslash, and the AppleScript pass replaces every `\` with `\\`, corrupting the shell quoting.

Trace for prompt value `'; $(evil) '`:

1. After POSIX single-quote escaping, `escapedPrompt` = `'\'' ; $(evil) '\''`
2. Command fragment built: `''\'' ; $(evil) '\'''`
3. After AppleScript escaping (`\` → `\\`): `''\\'' ; $(evil) '\\'''`
4. Shell sees: `''` (empty), `\\` (literal backslash, outside quotes), `''` (empty) — then **`;` as an unquoted command separator** — then `$(evil)` executes.

**Affected path:** Only when caller passes `use_iterm=true` to `spawn_worker`. Default `print` and `opencode` modes use `spawn()` with an args array and are not affected.

**Risk context:** An attacker with MCP tool access (or a compromised AI worker that calls `spawn_worker`) can execute arbitrary shell commands as the process owner by crafting the `prompt` field.

**Location of flaw:**
```typescript
// iterm-launcher.ts:35–36
const asCommand = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
```
The re-escaping for AppleScript conflicts with the `'\''` sequences already embedded in `command`.

---

### S-02 — Unsanitized `model` field injected into shell command string (iTerm mode)

**File:** `libs/worker-core/src/core/iterm-launcher.ts:25–32`
**OWASP:** A03:2021 – Injection

**Description:**
`opts.model` is embedded directly into the shell command string without any escaping:

```typescript
const command = [
  `cd '${escapedWorkingDirectory}'`,
  '&&',
  'claude',
  '--dangerously-skip-permissions',
  '--model', opts.model,   // ← unescaped
  `'${escapedPrompt}'`,
].join(' ');
```

A model value such as `claude-sonnet; evil_cmd #` would inject `; evil_cmd` as a shell command when executed via iTerm. The Zod schema in `spawn-worker.ts` applies no pattern constraint to the `model` field (`z.string().optional()`), so arbitrary strings reach this function.

**Risk context:** Same as S-01 — exploitable only via `use_iterm=true`. The `prompt` vector (S-01) is already a superset, but `model` provides a simpler injection surface because it requires no quote manipulation.

---

## Minor Findings

### M-01 — `as` type assertions violate project conventions

**Files:**
- `libs/worker-core/src/core/jsonl-watcher.ts:195, 210, 251`
- `libs/worker-core/src/core/worker-registry.ts:34, 37`

**Convention:** `No as type assertions — use type guards or generics` (review-context.md)

Five `as` assertions are present in migrated code:
- `jsonl-watcher.ts:195`: `msg as Record<string, unknown>` for `result` message handling
- `jsonl-watcher.ts:210`: `msg as JsonlAssistantMessage`
- `jsonl-watcher.ts:251`: `block.input as Record<string, string> | undefined`
- `worker-registry.ts:34`: `worker as Partial<Worker>`
- `worker-registry.ts:37`: `err as NodeJS.ErrnoException`

These are convention violations, not active vulnerabilities, but weaken type safety.

---

### M-02 — `JSON.parse` without error handling in `resolveSessionId`

**File:** `libs/worker-core/src/core/jsonl-watcher.ts:325`

```typescript
const parsed: unknown = JSON.parse(readFileSync(sessionFile, 'utf-8'));
```

If the session file contains invalid JSON (e.g., partially written, truncated), `JSON.parse` throws an uncaught exception. The caller in `spawn-worker.ts` does not wrap this call in `try/catch`, so the exception propagates to the MCP handler, producing an unhandled rejection. The `hydrateFromDisk` method in `worker-registry.ts` correctly catches this pattern; the same treatment is missing here.

---

### M-03 — Unbounded `stdoutBuffer` in `process-launcher.ts`

**File:** `libs/worker-core/src/core/process-launcher.ts:43`

```typescript
stdoutBuffer += chunk.toString();
```

The buffer accumulates stdout chunks and is only drained on `\n` boundaries. If the child process writes a very large line (or never writes a newline), `stdoutBuffer` grows without bound, risking OOM in a long-running server. No maximum buffer size or backpressure mechanism is applied.

---

### M-04 — `prompt` field has no length constraint in Zod schema

**File:** `apps/session-orchestrator/src/tools/spawn-worker.ts:9`

```typescript
prompt: z.string().describe('Full prompt to send to the worker session'),
```

No `.max()` is applied. In iTerm mode (S-01, S-02), the prompt is embedded in a shell command string then passed to `osascript`. Very large prompts may exceed AppleScript's argument size limit or hit OS command-line limits, resulting in silent truncation or process failure. In `print` mode the prompt is passed via `spawn()` args and is safer, but the missing bound is still a defensive gap.

---

### M-05 — `readFileSync` in poll loop without size limit

**File:** `libs/worker-core/src/core/jsonl-watcher.ts:166`

```typescript
const content = readFileSync(jsonlPath, 'utf-8');
```

Called every 3 seconds for every active iTerm worker. Long-running workers accumulate large JSONL files; reading the entire file on each poll is O(n) per cycle and can consume significant memory. There is no file-size check before the read. This is a reliability concern, not a vulnerability, but worth flagging in a server process.

---

### M-06 — `watcher.close()` error silently swallowed

**File:** `libs/worker-core/src/core/file-watcher.ts:127`

```typescript
watcher.close().catch(() => {});
```

Errors from closing chokidar watchers are completely suppressed. While watcher closure errors are rarely actionable, suppressing them entirely prevents any visibility into resource-leak situations (e.g., too many open file descriptors). A `process.stderr.write` at minimum would be consistent with the error-logging pattern used elsewhere in the module.

---

### M-07 — Directory traversal risk from `..`-named entries in `resolveJsonlPath`

**File:** `libs/worker-core/src/core/jsonl-watcher.ts:340–344`

```typescript
for (const dir of readdirSync(projectsDir)) {
  const candidate = join(projectsDir, dir, `${sessionId}.jsonl`);
  if (existsSync(candidate)) return candidate;
}
```

`readdirSync` returns OS-provided directory names. On most filesystems, `..` cannot appear as a directory entry, but on some exotic configurations or via symlinks, a directory named `..` could cause `join(projectsDir, '..', ...)` to escape outside `~/.claude/projects/`. Combined with a controlled `sessionId`, this could reference files outside the intended directory. The `sessionId` is already validated against `/` and `\` at line 332, limiting the impact. Severity is low given the nested conditions required, but the `dir` variable should also be validated to exclude `..`.

---

## Security Positives

The following patterns show good defensive security practice and should be preserved:

- **`file-watcher.ts` path traversal protection** (lines 45–53): all watched paths are resolved with `path.resolve()` and validated to remain under `workingDirectory + sep` before any watcher is set up. `followSymlinks: false` prevents escape via symlinks.
- **`worker-registry.ts` file permissions** (line 52): registry JSON written with `mode: 0o600`. Registry directory created with `mode: 0o700` in `index.ts`.
- **`process-launcher.ts` log directory permissions** (line 25): `.worker-logs/` created with `mode: 0o700`.
- **`subscribe-worker.ts` uses registry's `working_directory`** (line 52): file-watch conditions are always resolved relative to the worker's registered `working_directory`, never the caller's input.
- **`iterm-launcher.ts` iTerm session ID validation** (line 114–118): UUID format validated via regex before use in AppleScript. This prevents iTerm session ID injection from unrelated sources.
- **`print-launcher.ts` environment isolation** (lines 46–55): GLM API key is forwarded via explicit environment construction, not by mutating `process.env`. Provider-specific env is scoped to the spawned child only.
- **`worker-registry.ts` atomic writes** (lines 46–57): registry is written to a `.tmp` file then renamed — prevents partial reads during concurrent access.
- **`resolveJsonlPath` sessionId validation** (line 332): rejects session IDs containing `/` or `\`, blocking the most direct path traversal vector.

---

## Files Reviewed

All files in the declared File Scope were reviewed. No issues were found outside scope.
