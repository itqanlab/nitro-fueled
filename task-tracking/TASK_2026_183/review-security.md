# Security Review — TASK_2026_183

| Verdict | PASS |
|---------|------|

## Findings

### Unvalidated eventType string used to derive CSS class at runtime

- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.html:83`
- **Line**: 83
- **Severity**: minor
- **Issue**: The template builds a CSS class name by string concatenation from the server-controlled `phase.state` field: `[ngClass]="'phase-chip--' + phase.state"`. `phase.state` originates from the backend type system (`ProgressCenterPhaseState = 'complete' | 'active' | 'pending'`), but no runtime guard confirms the value is within the allowlist before it reaches the DOM attribute. Angular's `[ngClass]` binding is not a code-execution sink, so there is no XSS risk here, but a malformed value from the server could produce an unrecognised class name and break the intended styling with no visibility.
- **Suggestion**: Add a narrow allowlist check in the component before binding, e.g. a helper `sanitizePhaseState(state: string): string` that returns `'pending'` for unknown values, or validate the value on the backend before serialisation. The existing `ProgressCenterPhaseState` TypeScript union type covers this at compile time, but a runtime guard provides defence-in-depth.

---

### Web Notification body includes unsanitised event data

- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts:109`
- **Line**: 109
- **Severity**: minor
- **Issue**: The `maybeNotify` method constructs a `Notification` body directly from WebSocket event fields (`event.task_id`, `event.session_id`, `event.event_type`) without sanitisation. Web Notifications render content as plain text, not HTML, so there is no injection risk in modern browsers. However, if a malicious actor can inject a crafted cortex event through the WebSocket stream, they could spoof the content of browser OS-level notifications, producing phishing-quality messages to the operator.
- **Suggestion**: This is a low-severity risk given the tool is local-only, but the `body` string should be bounded in length and stripped of control characters. A simple `body.slice(0, 200)` truncation and removal of newlines would reduce abuse surface.

---

### No rate limiting on the `getProgressCenter` polling endpoint

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:261`
- **Line**: 261–268
- **Severity**: minor
- **Issue**: The `GET /api/progress-center` endpoint calls `cortexService.getSnapshot()`, which queries all sessions, all workers, all tasks, all phase timings, and all events with `getEventsSince(0)` (unbounded) on every request. The frontend refreshes this endpoint on every debounced WebSocket event (400ms debounce). There is no rate limiting, caching, or response pagination on the endpoint. Under high event throughput this could result in repeated full-table scans of the cortex SQLite database. This is not an OWASP injection or exposure class risk, but it is a denial-of-service by misconfiguration concern.
- **Suggestion**: Add a minimum cache TTL (e.g., 1 second) in `ProgressCenterService.getSnapshot()` or introduce a shared last-fetch timestamp guard. Alternatively, move the `getEventsSince(0)` call to a bounded window (e.g., last 15 minutes of events).

---

### Hardcoded heuristic fallback values exposed in public response

- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts:21–27`
- **Line**: 21–27
- **Severity**: info
- **Issue**: `buildPhaseAverages` initialises default per-phase ETA minutes as hardcoded literals (`PM=5`, `Architect=8`, `Dev=18`, `QA=10`, `Review=4`). These are not secrets, but they are internal operational estimates that are returned in the public snapshot payload. Users with access to the dashboard can observe and calibrate around these values. Not exploitable, noted for awareness.
- **Suggestion**: No immediate action required. If ETA heuristics become sensitive business logic, move defaults to a server-side configuration file rather than embedding them in the response computation.

---

## Positive Security Observations

- **Input validation on all parameterised controller routes**: Every `@Param()` that accepts a task ID or session ID is guarded with a regex allowlist (`TASK_ID_RE`, `SESSION_ID_RE`) before any downstream call. Paths are never derived from user input for file operations.
- **Client-side filter allowlists in ApiService**: `getCortexTasks`, `getCortexWorkers`, and `getCortexModelPerformance` all pass filter values through strict allowlist predicates (`isValidTaskStatus`, `isValidTaskType`, `isValidWorkerStatus`, `isValidComplexity`) before appending them as query parameters.
- **No secrets or credentials found**: No API keys, tokens, bearer strings, or long hex literals appear in any of the reviewed files.
- **No shell execution or eval usage**: No `child_process`, `eval()`, `Function()`, or `vm` calls were found in any in-scope file.
- **Angular output binding used correctly**: All data rendered in the HTML template uses Angular's standard interpolation (`{{ }}`) and property bindings, which escape HTML by default. No `[innerHTML]` or `DomSanitizer.bypassSecurityTrust*` patterns were found.
- **WebSocket type guards present**: Both `isDashboardEvent` and `isCortexEvent` guard unknown socket payloads before forwarding them to observables.
- **Unused export surface in module is acceptable**: `ProgressCenterService` is exported from `DashboardModule` but the export is consistent with the existing export pattern for all other services in the module.

## Summary

The implementation has a clean security posture. No critical or major issues were found. All parameterised API routes validate inputs with regex allowlists before use. The client-side code uses Angular's safe-by-default template binding and validates incoming WebSocket payloads. No secrets, shell execution, eval, or path traversal patterns are present in any in-scope file.

The three minor findings are:

1. A runtime CSS class name is assembled from a backend-typed string field without a runtime allowlist guard (no XSS risk, styling integrity concern only).
2. Browser notification body includes unsanitised WebSocket content (plain text only, local-tool context).
3. The snapshot endpoint performs unbounded event queries on every poll with no caching guard.

None of the findings require blocking the task. They are low-priority hardening items.
