# Security Review — TASK_2026_059

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 6/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 2                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | JSON deserialization from disk lacks runtime shape validation — `as [string, Worker][]` cast provides no guard |
| Path Traversal           | PASS   | Registry path is hardcoded via `homedir()` + constant segments; no user-controlled path input |
| Secret Exposure          | FAIL   | Worker records containing `session_id`, `jsonl_path`, `working_directory`, and `log_path` are written world-readable to `~/.session-orchestrator/registry.json` with no file permission restriction |
| Injection (shell/prompt) | PASS   | No shell commands, no eval; `persistPath` is not user-controlled |
| Insecure Defaults        | FAIL   | `mkdirSync` creates `~/.session-orchestrator` with default mode (0o777 masked by umask); `writeFileSync` creates `registry.json` with default mode — neither enforces restrictive permissions |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: No Runtime Validation of Deserialized Registry Entries

- **File**: `src/core/worker-registry.ts:17`
- **Problem**: `JSON.parse(raw)` is immediately cast to `[string, Worker][]` with a TypeScript `as` assertion. This provides zero runtime protection. If the file is malformed (partial write, manual edit, corruption) or if its schema has drifted from the current `Worker` interface (e.g., a field added or removed across versions), `this.workers.set(id, worker)` stores a structurally invalid object. Downstream code that unconditionally reads fields like `worker.tokens.total_combined`, `worker.progress.last_action_at`, and `worker.cost.total_usd` will throw at runtime, crashing the MCP server rather than degrading gracefully.
- **Impact**: A malformed registry file — caused by a partial write, OS crash mid-flush, or a schema migration — causes the MCP server to crash on startup. Because the `_hydrate()` catch block is empty and suppresses all errors, the connection between a bad deserialization and its downstream throw may not be obvious. Worse, if a partially corrupted entry is loaded without throwing, stale fields (e.g., a `null` pid) can cause subtle misbehavior in tools like `kill_worker` and `getHealth`.
- **Fix**: Parse as `unknown`, then validate the structure before trusting it. At minimum, check that the parsed value is an array of two-element tuples, and that each entry contains the required fields with expected types (e.g., `typeof worker.pid === 'number'`, `typeof worker.status === 'string'`). Entries that fail validation should be skipped (logged, not thrown) rather than loaded into the in-memory map. This matches the existing intent of graceful degradation on missing/corrupt files.

### Issue 2: Registry File Written with Default (World-Readable) Permissions

- **File**: `src/core/worker-registry.ts:29` and `src/index.ts:18-19`
- **Problem**: `writeFileSync(this.persistPath, JSON.stringify(entries), 'utf-8')` creates the file with mode `0o666` masked by the process umask (typically `0o644` on most systems, meaning group-readable and world-readable). `mkdirSync(registryDir, { recursive: true })` creates the directory with `0o777` masked by umask (typically `0o755` — group-executable/readable and world-executable/readable). The Worker record shape (see `types.ts`) includes `jsonl_path`, `working_directory`, `log_path`, `session_id`, and `label`. These fields expose filesystem layout of active work sessions, process IDs, and AI provider session identifiers.
- **Impact**: On a shared or multi-user system (even a developer laptop with guest accounts or a CI/CD box), any process running as a different user can read the registry file and learn: active worker PIDs (useful for process-level attacks), JSONL file paths (full conversation logs of AI sessions), working directories of tasks in progress, and session IDs that may be usable to attach to or correlate with the target AI session. Even on a single-user machine this unnecessarily widens the file's exposure surface.
- **Fix**: Pass explicit permission modes: `mkdirSync(registryDir, { recursive: true, mode: 0o700 })` and `writeFileSync(this.persistPath, JSON.stringify(entries), { encoding: 'utf-8', mode: 0o600 })`. Mode `0o700` / `0o600` restricts to the owning user only. Note that `writeFileSync` only applies the mode on file creation, not on subsequent writes to an existing file — either use `fs.chmodSync` after the first write, or open via `fs.openSync` with explicit flags and mode on every write.

### Issue 3: Silent Swallow of Persist Failures Masks Data Loss

- **File**: `src/core/worker-registry.ts:26-33`
- **Problem**: `_persist()` catches all errors and discards them silently. If `writeFileSync` fails (disk full, permissions error, path not writable), the in-memory state diverges from disk with no indication to the caller. Every subsequent mutation will also silently fail, meaning the registry will be fully lost on the next restart with no log evidence of why.
- **Impact**: An operator debugging a "workers lost after restart" incident has no log trace to distinguish between "registry file missing on startup" and "every persist call has been failing silently for hours." This is not a direct exploit vector, but silent data loss under realistic failure conditions (disk full during long autonomous runs) creates a frustrating and opaque failure mode that undermines the entire purpose of this feature.
- **Fix**: At minimum, log the error to `console.error` or `process.stderr` so it appears in the MCP server's output. The catch can still suppress the throw (best-effort semantics are acceptable here), but discarding the error completely means operators cannot diagnose the failure. A single line — `console.error('[WorkerRegistry] persist failed:', err)` — is sufficient.

## Minor Issues

- **`worker-registry.ts:17` — TypeScript `as` cast instead of type guard**: `JSON.parse(raw) as [string, Worker][]` is a type assertion, not a type guard. This is a code quality issue compounding Issue 1 — the type system is suppressing what should be a compile-time signal that validation is missing. Per the project's TypeScript conventions (`review-general.md`: "No `as` type assertions"), this should be replaced with `unknown` + runtime check.

- **`src/index.ts:18` — `mkdirSync` error not handled**: If `mkdirSync` fails for a reason other than the directory already existing (e.g., a file already exists at that path, or a permissions error on the parent), the error throws unhandled at server startup and crashes the process before the MCP transport is even connected. The `{ recursive: true }` flag suppresses "already exists" errors but not other error classes. Wrapping in a try/catch with a clear error message would produce a more debuggable startup failure.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Registry file is written world-readable by default, exposing active session paths, process IDs, and JSONL conversation log locations to any user on the system. This should be fixed with explicit `0o600`/`0o700` permission modes before this feature ships.
