# Security Review — TASK_2026_187

## Review Summary

| Metric           | Value                                  |
|------------------|----------------------------------------|
| Overall Score    | 6/10                                   |
| Assessment       | NEEDS_REVISION                         |
| Critical Issues  | 0                                      |
| Serious Issues   | 2                                      |
| Minor Issues     | 3                                      |
| Files Reviewed   | 13                                     |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                                              |
|--------------------------|--------|----------------------------------------------------------------------------------------------------|
| Input Validation         | PASS   | Session ID validated against `SESSION_ID_RE` regex before any use; task IDs similarly guarded      |
| Path Traversal           | FAIL   | `readLogContent` constructs file paths using `sessionId` without a `path.resolve` boundary check   |
| Secret Exposure          | PASS   | No hardcoded credentials, tokens, or API keys in any reviewed file                                 |
| Injection (shell/prompt) | PASS   | No shell execution; no eval; Angular templates use text interpolation (`{{ }}`) — XSS-safe         |
| Insecure Defaults        | FAIL   | Log file content is served verbatim to the client with no size cap; no authorization on any route  |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Path Traversal in `readLogContent` — `sessionId` Not Boundary-Checked After `join`

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:257–272`
- **Problem**: `readLogContent` constructs candidate paths with `join(projectRoot, 'task-tracking', 'sessions', sessionId, 'log.md')` and `join(projectRoot, '.nitro', 'sessions', sessionId, 'log.md')`. Although `sessionId` is validated against `SESSION_ID_RE` (`/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/`) before the controller dispatches to this service method, the service method itself performs no such check — it accepts `sessionId` as a plain `string` parameter. `path.join` normalises `..` sequences rather than rejecting them. If `sessionId` ever reaches this method from a different call site that does not validate the regex (e.g., a future service-to-service call, a refactor of the controller guard, or a unit test supplying a raw value), the `readFile` call can traverse outside the project root to any file the server process can read.
- **Impact**: An attacker who can bypass or remove the regex guard in the controller can cause the server to read and return arbitrary files from the host filesystem in the `logContent` field of the session detail response.
- **Fix**: Add a boundary check inside `readLogContent` itself, directly after constructing each candidate path. Apply `path.resolve` to both the candidate and the base directory and assert the resolved candidate starts with the resolved base:
  ```ts
  const resolved = resolve(filePath);
  const base1 = resolve(projectRoot, 'task-tracking', 'sessions');
  const base2 = resolve(projectRoot, '.nitro', 'sessions');
  if (!resolved.startsWith(base1 + sep) && !resolved.startsWith(base2 + sep)) continue;
  ```
  This makes the boundary enforcement defense-in-depth — it holds regardless of whether the caller validated the input. This pattern is already documented in the project's security lessons (`security.md` — Path Traversal section, TASK_2026_067).

### Issue 2: Unbounded Log File Content Returned to Client

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:265–266` / `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html:180`
- **Problem**: `readFile(filePath, 'utf-8')` reads the entire log file and the full content is returned in the `logContent` field of `SessionHistoryDetail`. The Angular template renders it verbatim inside a `<pre>` tag. There is no size cap anywhere in the pipeline. Session log files can grow to multiple megabytes over long runs; a particularly large file will:
  1. Exhaust the NestJS response buffer and increase API latency for all concurrent requests.
  2. Transfer excessive data to the browser, causing the detail page to become unresponsive.
  3. If the log contains ANSI escape sequences or other control characters, some browsers may render them unexpectedly inside `<pre>` — not an XSS risk in Angular's template engine, but a UI integrity issue.
- **Impact**: Denial-of-service against the dashboard API for large log files; degraded user experience; potential terminal-code noise in the rendered log view.
- **Fix**: Cap the read at a reasonable size (e.g., the last 100 KB of the file) either by reading the file size first and using a byte-range read, or by truncating `content` to `content.slice(-102400)` before returning. Add a `truncated: boolean` field to `SessionHistoryDetail` so the frontend can display a notice. Alternatively, expose a dedicated paginated `/sessions/:id/log` endpoint and return `null` for `logContent` in the detail response.

---

## Minor Issues

### Minor 1: No Authentication or Authorization on Any Route

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:36–40`
- **Note**: The controller comment explicitly states the API is intended for local-only (127.0.0.1) use and that authentication is intentionally absent. This is an acceptable trade-off for a local developer tool. However, the bind-address enforcement is not implemented in any in-scope file — there is no guard, middleware, or host-check confirming `127.0.0.1` binding. If the server ever starts on `0.0.0.0` (e.g., inside Docker, a CI VM, or behind a misconfigured reverse proxy), all session history, worker details, and cost data become unauthenticated-public. Flag as a defense-in-depth gap: the security contract stated in the comment needs to be enforced by the runtime configuration, not relied on by future callers.

### Minor 2: `SESSION_ID_RE` Regex Does Not Validate Separator Characters Exhaustively for the Timestamp Portion

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:34`
- **Note**: The regex `/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/` is strict and correctly prevents path traversal characters (`..`, `/`, `~`). However, it allows dashes in the time portion (`\d{2}-\d{2}-\d{2}`) where the canonical session ID format uses dashes as separators anyway. This is correct as-is. The minor concern is that the regex is defined only in the controller; the service layer (`readLogContent`) trusts it without re-checking. See Serious Issue 1 for the defense-in-depth fix.

### Minor 3: `drainSession` PATCH Endpoint Missing from Controller — Client Calls an Undefined Route

- **File**: `apps/dashboard/src/app/services/api.service.ts:411–415`
- **Note**: `ApiService.drainSession` issues a `PATCH /api/sessions/:id/stop` request. No handler for this route exists in any in-scope controller file (`dashboard.controller.ts` has no `@Patch` decorator). The route will return a 404 or 405 at runtime. This is not a security issue per se, but it is a surface where a future developer might add the handler and forget input validation (the `id` in the PATCH would need the same `SESSION_ID_RE` guard). Flag so the implementation gap is addressed with the guard already in place.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Path traversal in `readLogContent` — the service accepts `sessionId` as a raw string and constructs filesystem paths without an internal boundary check, relying solely on the controller-layer regex guard. A single call-site change or future service-to-service invocation bypasses the guard entirely.

| Verdict | NEEDS_REVISION |
|---------|---------------|
