# Security Review — TASK_2026_143

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 5/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 1                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 4                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | File paths in `stage_and_commit` lack full metacharacter sanitization |
| Path Traversal           | FAIL   | `get_task_context` builds a file path from `task_id` with no `path.resolve` boundary check |
| Secret Exposure          | PASS   | No hardcoded credentials or API keys found |
| Injection (shell/prompt) | FAIL   | Shell command substitution characters (`$`, backtick) not stripped from file paths before `execSync` |
| Insecure Defaults        | PASS   | Database directory created with `mode: 0o700`; all Zod schemas carry `.max()` bounds |

---

## Critical Issues

### Issue 1: Shell Injection via Unsanitized File Paths in `stage_and_commit`

- **File**: `packages/mcp-cortex/src/tools/context.ts:360-361`
- **Problem**: The file path sanitization strips only `'`, `"`, and `\` before wrapping the value in double-quotes for `git add -- "${fileSafe}"`. Shell metacharacters that remain active inside double-quoted bash arguments — specifically `$()`, backticks, `!`, and newlines — are not stripped. The command is executed via `execSync`, which passes the string to `/bin/sh -c`. A caller-supplied path of `$(id>/tmp/pwned)` survives the sanitization unchanged and is executed by the shell before git receives its argument.
- **Impact**: An MCP client (or any process with access to the MCP socket) can achieve arbitrary command execution on the host by passing a crafted file path. Since MCP servers run under the same user account as the developer, the impact is full local code execution.
- **Fix**: Replace the `execSync` string form with `spawnSync` using an argument array, bypassing the shell entirely:
  ```
  spawnSync('git', ['add', '--', file], { cwd: projectRoot })
  ```
  This is the standard mitigation documented in the existing security lessons (Shell Injection — `spawnSync` vs `exec`). The `git commit -F -` call is already safe because it uses stdin input and no variable interpolation.

---

## Serious Issues

### Issue 1: Implicit Path Traversal Guard in `get_task_context`

- **File**: `packages/mcp-cortex/src/tools/context.ts:43-48`
- **Problem**: The task folder path is built as `join(projectRoot, 'task-tracking', args.task_id)` with no subsequent `path.resolve` boundary check. The current implementation relies on the DB lookup failing for unrecognized IDs (line 39), which acts as an implicit allowlist. However, this guard is fragile for two reasons: (1) `upsert_task` allows inserting arbitrary task IDs into the DB, including ones containing path traversal components; (2) the guard pattern diverges from the project's stated security lesson, which requires an explicit `path.resolve` + starts-with check regardless of upstream validation.
- **Impact**: If an attacker can call `upsert_task` with a crafted `task_id` such as `../../../etc/passwd` (or a subdirectory relative path), a subsequent `get_task_context` call would read files outside the `task-tracking/` boundary and return their contents to the caller.
- **Fix**: After constructing `taskFolder`, add an explicit boundary check:
  ```
  const resolved = path.resolve(taskFolder);
  const base = path.resolve(projectRoot, 'task-tracking') + path.sep;
  if (!resolved.startsWith(base)) {
    return { content: [...], isError: true };
  }
  ```

### Issue 2: `get_recent_changes` Uses `execSync` Shell Form with `--grep` Value in Double-Quoted Argument

- **File**: `packages/mcp-cortex/src/tools/context.ts:152-155`
- **Problem**: Although `taskIdSafe` is stripped to `[A-Z0-9_]` making the current implementation safe, the pattern is structurally fragile. The `execSync` call passes the task ID as `--grep="${taskIdSafe}"` in a shell string. Any future developer weakening the allowlist regex (e.g., allowing lowercase or hyphens) introduces shell injection at this site without realizing the implicit dependency. The `git show --stat ${commits[0].hash}` call at line 195 has the same structure — the hash is constrained to 12 hex characters by the earlier parse, but is passed without quoting in the shell string.
- **Impact**: Latent injection risk. If the `[^A-Z0-9_]` allowlist is ever relaxed or copied to another call site without the guard, shell injection becomes possible.
- **Fix**: Convert both `execSync` calls to `spawnSync` with argument arrays, eliminating the structural dependency on the upstream sanitization:
  ```
  spawnSync('git', ['log', `--grep=${taskIdSafe}`, '--pretty=format:%H|%s|%ai', '--name-only'], { cwd: projectRoot })
  spawnSync('git', ['show', '--stat', commits[0].hash], { cwd: projectRoot })
  ```

---

## Minor Issues

- **`packages/mcp-cortex/src/index.ts:36`** — `McpServer` is initialized with `version: '0.4.0'`, but the startup log on line 457 announces `v0.5.0`. The version string passed to the MCP SDK metadata is the one visible to clients enumerating available tools; an incorrect value can confuse version-gating in downstream tooling.

- **`packages/mcp-cortex/src/tools/context.ts:361`** — Even after the critical fix is applied, the `stage_and_commit` schema in `index.ts` (line 353) accepts file paths up to 1000 characters each with up to 200 files. For a `spawnSync`-based implementation this is safe, but the current `execSync` form with a 200-file loop creates 200 separate subprocesses. Post-fix, consider batching with `git add -- file1 file2 ...` in a single spawn call.

---

## Summary

The single critical finding — shell injection through unquoted `$()` and backtick sequences in the `stage_and_commit` file path argument — is directly exploitable by any caller with access to the MCP socket. The fix is a one-line change from `execSync` string form to `spawnSync` array form, following the pattern already documented in the project's security lessons. All SQL operations are correctly parameterized. The telemetry tools (`telemetry.ts`) and schema migrations (`schema.ts`) are clean.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Shell command injection in `handleStageAndCommit` — file paths containing `$()` or backticks survive sanitization and execute in the shell context of the MCP server process.
