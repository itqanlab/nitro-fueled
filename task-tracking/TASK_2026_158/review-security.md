# Security Review — TASK_2026_158

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 6/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 10                                   |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | URL query params cast without allowlist; session ID params have no format guard on three routes |
| Path Traversal           | PASS   | No file path construction from user input in these files |
| Secret Exposure          | PASS   | No hardcoded credentials or tokens found |
| Injection (shell/prompt) | PASS   | No shell execution; Angular templates use auto-escaping throughout |
| Insecure Defaults        | FAIL   | Frontend component initiates state-mutating close-stale POST on a repeating timer; no auth on REST API |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Session ID Parameters Accepted Without Format Validation on Three Routes

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:229`, `:290`, `:508`
- **Problem**: Three controller methods receive a `:id` path parameter and pass it directly to service methods without any format validation. This is in contrast to task ID routes in the same file, which enforce `TASK_ID_RE` at lines 115, 131, 144, 453, and 473. The three unguarded routes are:
  - `GET /api/sessions/:id` (line 229) — passes raw `id` to `sessionsHistoryService.getSessionDetail(id)`
  - `GET /api/sessions/:id/detail` (line 290) — passes raw `id` to `this.sessionsService.getSession(id)`
  - `GET /cortex/sessions/:id` (line 508) — passes raw `id` to `this.cortexService.getSessionSummary(id)`
- **Impact**: If any downstream service uses the `id` value to construct a file path, database query string, or log entry, an attacker who can reach the API can supply path traversal segments (`../`), excessively long strings, or control characters. The frontend's `encodeURIComponent` call in `api.service.ts` lines 178 and 509 does not fully mitigate this; it only encodes at the HTTP layer, and the NestJS `@Param()` decorator decodes the value before the handler sees it. The risk is concrete if `sessionsHistoryService.getSessionDetail` or `cortexService.getSessionSummary` ever constructs a file path from the ID.
- **Fix**: Add a format guard matching the expected session ID pattern before passing the value to the service. A session ID follows the pattern `SESSION_YYYY-MM-DD_HH-mm-ss`. Apply:
  ```typescript
  const SESSION_ID_RE = /^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;
  if (!SESSION_ID_RE.test(id)) {
    throw new BadRequestException({ error: 'Invalid session ID format' });
  }
  ```
  at the top of all three handlers, mirroring the `TASK_ID_RE` pattern already present for task routes.

---

### Issue 2: Frontend Component Triggers State-Mutating POST from a Repeating Client-Side Timer

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:62–65`
- **Problem**: The component constructor starts a 5-minute interval that calls `this.apiService.closeStaleSession(30)`, which issues `POST /api/v1/sessions/close-stale`. Every browser tab that renders this component will independently fire this POST every 5 minutes. The backend action (`closeStaleSession`) permanently changes server state by marking sessions as stopped.
- **Impact**: Multiple concurrent tabs multiply the close-stale request rate. More importantly, a single user visiting the project page triggers an irreversible administrative side effect (closing sessions) without any explicit user gesture. If the session-close logic has a bug (e.g., it matches too broadly), the frontend timer silently amplifies the damage at a 5-minute cadence. This also means anyone who can render this page in a browser tab is effectively an administrator of session lifecycle — and with no authentication on the REST API, any user on the same machine or network who can reach the API port can do the same.
- **Fix**: Move the `closeStaleSession` call from the frontend component entirely. It belongs in a backend scheduled task (NestJS `@Cron` or `setInterval` in a dedicated service), not in a UI component. If it must remain on the frontend, gate it behind an explicit admin action (button click), not a silent timer.

---

### Issue 3: URL Query Parameters Accepted Into Typed State Without Allowlist Validation

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:894–911`
- **Problem**: `initializeFromURL()` reads query parameters from `ActivatedRoute.snapshot.queryParamMap` and sets them directly into component state via `as`-casts:
  ```typescript
  this.selectedStatuses.set(params.get('status')!.split(',') as QueueTaskStatus[]);
  this.selectedTypes.set(params.get('type')!.split(',') as QueueTaskType[]);
  this.sortField.set(params.get('sort') as SortField);
  this.sortDirection.set(params.get('dir') as SortDirection);
  this.viewMode.set(params.get('view') as QueueViewMode);
  ```
  These casts compile without error but provide no runtime validation. Any value from the URL (an attacker-crafted link, a browser extension, or a stored XSS vector) is accepted as-is.
- **Impact**: Typed state receives arbitrary string values, bypassing the TypeScript type system at runtime. Downstream code that uses `statusClassMap[task.status]` with a map keyed on `QueueTaskStatus` values will produce `undefined` for any unknown status, which Angular then renders as an empty class — a silent rendering glitch. More seriously, `this.selectedStatuses.set(...)` with attacker-controlled values is passed into URL construction (`updateURL`), creating a reflected injection into the browser's address bar. If the `searchQuery` is ever rendered via `innerHTML` rather than interpolation, this becomes a stored reflected XSS path.
- **Fix**: Validate each parsed value against the corresponding allowlist before setting it into state. The `VALID_TASK_STATUSES` and related allowlists already exist in `api.service.ts` and should be shared. For each parameter, filter the split array to only known-valid values:
  ```typescript
  const rawStatuses = params.get('status')!.split(',');
  this.selectedStatuses.set(rawStatuses.filter(isValidTaskStatus));
  ```

---

## Minor Issues

### Minor 1: `taskId` Derived from Unvalidated Session ID Substrings

- **File**: `apps/dashboard-api/src/dashboard/sessions.service.ts:159`
- **Problem**: `taskId` is constructed as `` `TASK_${session.sessionId.slice(8, 12)}_${session.sessionId.slice(13, 16)}` `` — direct substring extraction from a session ID that originates from the session store, without first validating that `session.sessionId` matches the expected session ID format. If a session ID has an unexpected shape (shorter string, different delimiters), the substring extraction produces a malformed task ID that is returned to the frontend verbatim.
- **Fix**: Validate `session.sessionId` against the session ID regex before extracting substrings. Return a clearly marked placeholder (e.g., `'TASK_UNKNOWN'`) for sessions whose IDs do not match the expected format.

---

### Minor 2: Silent Error Swallow on Cortex Sessions Fetch

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:146–148`
- **Problem**: The `error` handler for `getCortexSessions()` is an empty comment: `/* best-effort — silently ignore */`. No logging occurs when this call fails.
- **Impact**: If the cortex sessions endpoint fails due to a server misconfiguration, a CORS error, or a network issue, there is zero diagnostic signal in the browser console or server logs. Security-relevant failures (e.g., 401 Unauthorized, 403 Forbidden in a future auth-enabled deployment) are invisible.
- **Fix**: Add at minimum a `console.warn` or `console.error` call in the error handler, even for best-effort calls.

---

### Minor 3: WebSocket CORS Allowlist Uses String Literals Instead of a Regex

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:18–21`
- **Problem**: The gateway CORS config is:
  ```typescript
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4200'],
  }
  ```
  While this is an improvement over `*`, the existing `security.md` lesson (TASK_2026_086) recommends using a regex: `origin: /^https?:\/\/localhost(:\d+)?$/`. The string list approach requires a manual update each time a new dev port is added (e.g., `4201`, `4202` from parallel `ng serve` runs). A developer adding a new port and not knowing to update this list will see "origin blocked by CORS" and may widen the config to `*` as a quick fix.
- **Fix**: Replace the string array with `/^https?:\/\/localhost(:\d+)?$/` as recommended in the existing security lessons.

---

## Verdict

| Field        | Value           |
|--------------|-----------------|
| Verdict      | NEEDS_REVISION  |
| Confidence   | HIGH            |
| Top Risk     | Session ID parameters are passed without format validation to service methods on three routes, creating an exploitable path traversal surface if any underlying service constructs file paths from the ID |
