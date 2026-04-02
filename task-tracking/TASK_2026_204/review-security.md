# Security Review — TASK_2026_204

## Review Summary

| Metric           | Value                                            |
|------------------|--------------------------------------------------|
| Overall Score    | 6/10                                             |
| Assessment       | NEEDS_REVISION                                   |
| Critical Issues  | 0                                                |
| Serious Issues   | 3                                                |
| Minor Issues     | 4                                                |
| Files Reviewed   | 7                                                |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                                     |
|--------------------------|--------|-------------------------------------------------------------------------------------------|
| Input Validation         | FAIL   | Model string fields are accepted without length or character-set checks                   |
| Path Traversal           | FAIL   | `working_directory` falls back to `process.cwd()` with no boundary or allowlist check     |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys found in any file                                     |
| Injection (shell/prompt) | PASS   | No shell exec calls or prompt injection vectors found in scope                            |
| Insecure Defaults        | FAIL   | No authentication or rate limiting on any REST endpoint; no concurrent-session hard cap   |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: No Authentication or Authorization on Any REST Endpoint

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` (all routes, lines 55–189)
- **Problem**: Every endpoint (`POST /api/sessions`, `PATCH /api/sessions/:id/config`, `POST /api/sessions/:id/stop`, etc.) is unauthenticated. Any process or browser page that can reach the API port can create, stop, drain, or reconfigure supervisor sessions. The session-ID format validation at line 36 (`SESSION_ID_RE`) restricts which IDs are accepted in URL params, but creates no session ownership concept.
- **Impact**: On a shared machine or if the API port is reachable over a local network, any user can terminate all running sessions, alter concurrency/provider config, or start new sessions (exhausting resources) with zero credentials.
- **Fix**: Add a NestJS `AuthGuard` or a minimal API-key header check (e.g., `X-Internal-Token` validated against an env-var secret) to all session-mutation endpoints. Read-only endpoints (`GET /api/sessions`, `GET /api/sessions/:id`) are lower priority but should follow the same guard.

---

### Issue 2: No Concurrent-Session Hard Cap — Resource Exhaustion via Session Flooding

- **File**: `apps/dashboard-api/src/auto-pilot/session-manager.service.ts:43–69`
- **Problem**: `createSession()` has no guard on `this.runners.size`. Each `SessionRunner` starts a `setInterval` polling loop and can spawn `config.concurrency` worker processes. A caller (or bug) that issues repeated `POST /api/sessions` requests will create an unbounded number of runners, intervals, and worker processes until the OS limits are hit (file descriptors, PIDs, memory).
- **Impact**: A single unauthenticated POST loop exhausts OS resources and takes down the API server. Even with authentication, a buggy client can cause the same outcome.
- **Fix**: Add a hard cap in `createSession()` before the `supervisorDb.createSession()` call:
  ```ts
  if (this.runners.size >= MAX_CONCURRENT_SESSIONS) {
    throw new Error(`Max concurrent sessions (${MAX_CONCURRENT_SESSIONS}) reached`);
  }
  ```
  A reasonable default is `MAX_CONCURRENT_SESSIONS = 5`. The constant should be configurable via env var.

---

### Issue 3: `working_directory` Accepted From Client and Set to `process.cwd()` by Default — No Boundary Enforcement

- **File**: `apps/dashboard-api/src/auto-pilot/session-manager.service.ts:49`
- **Problem**: `mergedConfig.working_directory = mergedConfig.working_directory || process.cwd()`. The `working_directory` field is part of `SupervisorConfig` and is accepted in `CreateSessionRequest` (camelCase `workingDirectory` is absent from `parseCreateBody` but the type allows it to be passed). More critically: `process.cwd()` is set as the default, and this string is later passed verbatim to `WorkerManagerService.spawnWorker` and used for filesystem operations (prompt building, task reads) with no boundary check against a safe root. If a client can supply an arbitrary `working_directory` value, it can redirect all worker file operations to any path the API process can access.
- **Impact**: An authenticated or internal caller (or a future code path that exposes `workingDirectory` in the HTTP API) can cause workers to read/write files outside the project root — a classic path traversal via config injection. Already flagged in security lessons: "MCP tools that accept a `working_directory` parameter must derive the actual boundary from the registry, not from the caller." (TASK_2026_067)
- **Fix**: Pin `working_directory` to a server-configured root (env var `NITRO_WORKING_DIR` or startup config). Never accept it from HTTP request bodies. In `session-manager.service.ts`, remove the `mergedConfig.working_directory` fallback branch and always assign from the server-side constant. In `parseCreateBody` and `parseUpdateConfigBody`, explicitly strip any `workingDirectory` field if it were ever present.

---

## Minor Issues

### Minor 1: Model String Fields Have No Length or Character-Set Validation

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:257–265` (create), lines 326–333 (update config)
- **Problem**: `prepModel`, `implementModel`, `implementFallbackModel`, and `reviewModel` are validated only as `typeof body[key] !== 'string'`. Strings of arbitrary length and content (including control characters, newlines, or path segments) are accepted and stored as `SupervisorConfig` fields. These values are subsequently logged (`session-runner.ts:59`, `session-runner.ts:102`) and passed to `WorkerManagerService` as the `model` parameter.
- **Impact**: A crafted model string with embedded newlines or escape sequences could pollute log output. An excessively long string can cause unexpected behavior in downstream model-routing code. Low probability of direct exploit, but these strings flow to multiple consumers with no cap.
- **Fix**: Add a max-length check (e.g., `body[key].length > 128`) and a character-set allowlist (e.g., `/^[a-zA-Z0-9_.:\/-]+$/`) for all model string fields in both `parseCreateBody` and `parseUpdateConfigBody`.

---

### Minor 2: Session ID Leaked in Error Messages Without Sanitization

- **File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts:94–96, 117–119, 139–141, etc.`
- **Problem**: When a valid-format session ID does not match a running session, the controller throws `new NotFoundException(\`Session ${id} not found\`)`. Because `id` has already been validated against `SESSION_ID_RE`, the session ID format is safe to echo. However, this pattern sets a precedent — if validation were ever loosened, unvalidated caller-controlled strings would be interpolated into exception messages returned to callers.
- **Impact**: Low risk as currently written, because validation precedes echo. Noted as a pattern to watch.
- **Fix**: Keep the pattern as-is since the regex guard precedes the interpolation. Document explicitly in the controller that `id` must always be regex-validated before it is used in a response string.

---

### Minor 3: `Object.assign(this.config, patch)` in `updateConfig` Allows Prototype Pollution (Low Probability)

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:93`
- **Problem**: `Object.assign(this.config, patch)` merges all enumerable own properties of `patch` into `this.config`. `patch` is typed as `UpdateConfigRequest` (a `Partial<Pick<SupervisorConfig, ...>>`), but if TypeScript's structural typing were relaxed or the value were constructed externally, a `__proto__` key in `patch` could pollute the object prototype. In practice, NestJS deserializes JSON bodies via `class-transformer` or raw `JSON.parse`, and modern V8 is resistant to `__proto__`-based pollution via `Object.assign`. The path traversal risk (via key injection) is the more realistic concern.
- **Impact**: Very low in this stack. Included because `Object.assign` with external-origin objects is a known pattern that has caused CVEs in other contexts.
- **Fix**: Replace with an explicit field-by-field assignment or use `{ ...this.config, ...patch }` which does not modify the target in place and avoids prototype mutation. Alternatively, use `Object.assign(Object.create(null), this.config, patch)` and re-assign.

---

### Minor 4: Config Snapshot Returned in `getStatus()` Exposes Full SupervisorConfig Including Internal Provider Details

- **File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts:110-126`, `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts:159–178`
- **Problem**: `SessionStatusResponse` embeds the full `SupervisorConfig` including `working_directory`. The `GET /api/sessions/:id` and `GET /api/sessions` endpoints return this to any caller. On a shared or internet-accessible server, this reveals the absolute server-side working directory path to unauthenticated clients.
- **Impact**: Information disclosure — reveals server file system structure. Can be used to craft more targeted path traversal attempts (Issue 3 above becomes more actionable with a known base path).
- **Fix**: Strip `working_directory` from the public `SessionStatusResponse` type, or introduce a separate `PublicSessionStatusResponse` that omits it. Alternatively, restrict the GET endpoints with the same auth guard recommended in Issue 1.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: No authentication on session-mutation endpoints combined with no concurrent-session cap (Issues 1 and 2) means any process that can reach the API port can exhaust server resources or disrupt all running supervisor sessions. The `working_directory` path (Issue 3) compounds this once the API is exposed beyond localhost.
