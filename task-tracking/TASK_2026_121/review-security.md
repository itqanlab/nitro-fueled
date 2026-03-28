# Security Review — TASK_2026_121

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 5/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 1                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 8                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | `JSON.parse` without try/catch on two MCP tool entry points; `working_directory` input has no path normalization |
| Path Traversal           | FAIL   | `working_directory` from MCP input used to build log dir and resolve config without boundary check |
| Secret Exposure          | PASS   | GLM API key travels via env var, never logged; config parse error logs only the file path |
| Injection (shell/prompt) | PASS   | `child_process.spawn` used with args array, not `exec` — shell metacharacters in prompt do not cause shell injection |
| Insecure Defaults        | FAIL   | `process.kill` called on arbitrary PID from DB when child is not in the in-memory map |

---

## Critical Issues

### Issue 1: Arbitrary Process Kill via Attacker-Controlled PID in Database

- **File**: `packages/mcp-cortex/src/process/spawn.ts:117-120`
- **Problem**: `killWorkerProcess` first checks the in-memory `childProcesses` map. If the PID is not there (e.g., the server restarted, or the record was inserted directly into the DB), execution falls through to `process.kill(pid, 'SIGTERM')` and then `process.kill(pid, 'SIGKILL')` using the PID value read from the database — with no validation. Any process running under the same OS user as the MCP server can be targeted.
- **Impact**: An attacker who gains write access to the SQLite database (or who can call `spawn_worker` and immediately manipulate the DB) can terminate arbitrary system processes — including the shell, editor, or other services running under the same user. On a developer machine this could kill any running process.
- **Fix**: Maintain a persistent PID registry (e.g., stored in the DB alongside a generation token written at spawn time). Before sending a signal via `process.kill`, verify that the PID was registered by this server instance and that its start time matches (`/proc/<pid>/stat` on Linux or `ps -o lstart` on macOS). At minimum, restrict the fallback path to PIDs that appear in the server's own DB-registered list and never send SIGKILL via `process.kill` to an unknown PID.

---

## Serious Issues

### Issue 1: `JSON.parse` Without try/catch on Two MCP Tool Entry Points

- **File**: `packages/mcp-cortex/src/index.ts:68` (update_task) and `packages/mcp-cortex/src/index.ts:109` (update_session)
- **Problem**: Both `update_task` and `update_session` receive `args.fields` as a Zod-validated `z.string()` and immediately call `JSON.parse(args.fields)` with no surrounding try/catch. A caller that passes a syntactically invalid JSON string (e.g., `"{"`) causes an unhandled exception that propagates up through the MCP SDK. Depending on the SDK's error boundary, this may crash the entire MCP server process.
- **Impact**: Any MCP client (or a rogue agent with tool access) can crash the server with a single malformed call, producing a denial-of-service against all other workers sharing the session.
- **Fix**: Wrap both `JSON.parse` calls in try/catch and return `{ ok: false, reason: 'invalid JSON in fields' }` on parse failure. Alternatively use `z.string().refine(s => { try { JSON.parse(s); return true; } catch { return false; } })` in the Zod schema so the error is surfaced before the handler runs.

### Issue 2: `working_directory` Input Has No Path Normalization or Boundary Check

- **File**: `packages/mcp-cortex/src/tools/workers.ts:87-110` (handleSpawnWorker) and `packages/mcp-cortex/src/process/spawn.ts:27-32`
- **Problem**: `args.working_directory` from the `spawn_worker` MCP tool is validated only as `z.string()`. It is used directly as `cwd` for the spawned process (spawn.ts:50) and to construct the `.worker-logs` directory (spawn.ts:27). A path like `../../../tmp` or `/etc` is accepted. The GLM API key resolver also reads from `resolve(workingDirectory, '.nitro-fueled/config.json')` — an attacker can point this at any filesystem path to probe for config files outside the project.
- **Impact**: Log files are written outside the intended project tree. The config resolver can be redirected to read arbitrary JSON files from the filesystem. If a target file happens to contain a string at the `providers.glm.apiKey` path, it is returned as an API key.
- **Fix**: At the `spawn_worker` Zod layer, add a `z.string().refine(p => path.isAbsolute(p))` check, and in `handleSpawnWorker` resolve and verify `working_directory` against an allowed-roots list (e.g., `projectRoot` or a configured set of allowed workspace roots). Reject any path that does not start with an approved prefix.

### Issue 3: Unvalidated JSON Parsing of Worker Process Output Written to Database

- **File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts:112-151`
- **Problem**: `processMessage` receives data from the worker's stdout stream (parsed in spawn.ts with JSON.parse). The code performs raw type casts without field validation: `(msg as Record<string, Record<string, number>>).usage` at line 114 is accessed and its numeric fields used in arithmetic at lines 116-119 and 130-133. If a worker emits a message where `usage.input_tokens` is a string, null, or a very large number, the arithmetic produces NaN or Infinity which is then written to the DB as JSON. Token counters and cost calculations will silently corrupt downstream for that worker.
- **Impact**: Corrupted token/cost data in the DB; `contextPercent` written as NaN causes `getHealth` in workers.ts:49 (`tokens.context_percent > 80`) to always return false, masking high-context workers as healthy.
- **Fix**: Validate that `usage.input_tokens` and `usage.output_tokens` are finite non-negative numbers before accumulation. A lightweight helper `isFiniteNonNeg(v: unknown): v is number` applied before each arithmetic line is sufficient.

---

## Minor Issues

1. **Unquoted label in logPath construction** — `spawn.ts:31-32`: `safeLabel` correctly strips non-alphanumeric characters before use in the log file name. The sanitization regex `/[^a-zA-Z0-9_-]/g` is correct. However, the timestamp portion `new Date().toISOString().replace(/[:.]/g, '-')` is internally generated and not user-controlled. No action required, but the sanitization scope should be documented so future changes do not inadvertently widen it.

2. **Silent queue drop with no alerting** — `subscriptions.ts:161`: When `MAX_EVENT_QUEUE_SIZE` (1,000) is reached, events are silently dropped with only a stderr log. A dropped event means a worker completion signal is lost, causing the supervisor to believe a worker is still running. The current behavior is a reliability issue; under adversarial conditions (e.g., a worker flooding events) it could be used to prevent completion signals from being delivered. Consider emitting a structured error event or capping per-worker queue entries rather than a global cap.

3. **`process.env` forwarded wholesale to child processes** — `spawn.ts:43-45`: When `provider !== 'glm'`, `env: process.env` is passed, forwarding every environment variable the MCP server inherited to the child process. This includes any secrets in the parent environment (`ANTHROPIC_API_KEY`, database passwords, etc.). This is common practice for CLI wrapper tools, but for a long-running server that may accumulate sensitive env vars, explicit allow-listing of env vars passed to children is a defense-in-depth improvement.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The arbitrary process kill via unregistered PID (spawn.ts:117-120) is the single highest-impact finding — an attacker with DB write access or a compromised agent can SIGKILL any process running under the server's OS user. The two unguarded `JSON.parse` calls in index.ts are an easy denial-of-service path that should be fixed before the tool is exposed to untrusted callers.
