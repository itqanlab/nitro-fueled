# Security Review — TASK_2026_146

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 12                                   |

## Files Reviewed

1. `apps/dashboard/src/app/services/api.service.ts`
2. `apps/dashboard/src/app/views/model-performance/model-performance.adapters.ts`
3. `apps/dashboard/src/app/views/model-performance/model-performance.component.ts`
4. `apps/dashboard/src/app/views/model-performance/model-performance.component.html`
5. `apps/dashboard/src/app/views/phase-timing/phase-timing.adapters.ts`
6. `apps/dashboard/src/app/views/phase-timing/phase-timing.component.ts`
7. `apps/dashboard/src/app/views/phase-timing/phase-timing.component.html`
8. `apps/dashboard/src/app/views/session-comparison/session-comparison.adapters.ts`
9. `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts`
10. `apps/dashboard/src/app/views/session-comparison/session-comparison.component.html`
11. `apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts`
12. `apps/dashboard/src/app/views/task-trace/task-trace.mappers.ts`
13. `apps/dashboard/src/app/views/task-trace/task-trace.component.ts`
14. `apps/dashboard/src/app/views/task-trace/task-trace.component.html`

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | Query param values (`status`, `type`, `taskType`, `complexity`) passed to `HttpParams.set()` without format validation — user-controlled filter inputs reach the API unvalidated |
| Path Traversal           | PASS   | All path params use `encodeURIComponent` before insertion into URLs. No `fs` operations in any of these files. |
| Secret Exposure          | PASS   | No hardcoded API keys, tokens, or credentials. No `console.log` calls in any reviewed file. |
| Injection (shell/prompt) | PASS   | No `eval()`, `new Function()`, `child_process`, or `innerHTML` bindings anywhere in scope. All server-data fields are rendered via Angular interpolation (`{{ }}`), which auto-escapes. |
| Insecure Defaults        | FAIL   | `getCortexSessions()` passes no default limit, meaning a single API call could return an unbounded number of session rows. The `limit` parameter exists but is always `undefined` when called from `SessionComparisonComponent`. |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Unvalidated user-controlled query parameter values sent to the API

- **File**: `apps/dashboard/src/app/services/api.service.ts` lines 125–176, and `apps/dashboard/src/app/views/model-performance/model-performance.component.ts` line 102
- **Problem**: `getCortexTasks()`, `getCortexWorkers()`, and `getCortexModelPerformance()` accept free-text `status`, `type`, `taskType`, and `complexity` strings from the component layer and pass them directly to `HttpParams.set()` without any allowlist or format validation. In `ModelPerformanceComponent`, `selectedTaskType` is bound via `[(ngModel)]` to a free-form `nz-select` that renders server-supplied strings as option values (line 28 of the template: `[nzValue]="type"`). A server that returns a crafted `task_type` value (e.g., `foo&admin=true` or a long string with special characters) will have that value round-tripped as a query parameter on the next filter call.
- **Impact**: While Angular's `HttpClient` and `HttpParams` do URL-encode the parameter value before sending, the absence of an allowlist means semantically invalid or adversarially crafted values are forwarded to the backend API. If the backend API does not validate these parameters independently, the frontend provides no defense-in-depth. In combination with a compromised or misconfigured backend, this could trigger unexpected query behavior (e.g., injecting additional query segments if the backend constructs its DB query by string concatenation). The risk is low in isolation but violates the principle of validating user-controlled data before it reaches any API call.
- **Fix**: Add an allowlist check in `ApiService` before calling `httpParams.set()`. For enum-style fields, define a type union and validate against it: e.g., `const VALID_STATUSES = ['pending','running','complete','failed'] as const;` and guard with `if (VALID_STATUSES.includes(params.status as ...))`. For `taskType` / `complexity` derived from server data, enforce a max length (e.g., 64 characters) and restrict to `[A-Za-z0-9_-]` before passing to `HttpParams`.

---

## Minor Issues

### Minor 1: `getCortexSessions()` called without a limit from SessionComparisonComponent

- **File**: `apps/dashboard/src/app/services/api.service.ts` line 144; `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts` line 43
- **Problem**: `getCortexSessions()` accepts an optional `limit` parameter, but `SessionComparisonComponent` calls `this.api.getCortexSessions()` with no argument, sending no `limit` query param to the API. The response set is therefore entirely backend-controlled.
- **Impact**: If the Cortex DB accumulates a large number of sessions, the response payload could become large enough to cause memory pressure in the browser or meaningfully slow the dashboard. This is a defense-in-depth concern, not an active attack surface, but the `limit` parameter exists for exactly this reason and is never used.
- **Fix**: Pass a reasonable default limit (e.g., `this.api.getCortexSessions(200)`) from the component, or set a default in `getCortexSessions()` itself when `limit` is `undefined`.

### Minor 2: Server-supplied `event_type` and `source` fields rendered without length constraint in timeline

- **File**: `apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts` lines 121–127; `apps/dashboard/src/app/views/task-trace/task-trace.component.html` lines 80–82
- **Problem**: `buildTimeline()` constructs `label` and `detail` strings from raw `e.event_type` and `e.source` fields (both server-supplied strings from `CortexEvent`) and renders them in the template via `{{ event.label }}` and `{{ event.detail }}`. Angular's interpolation prevents XSS. However, there is no length cap on these strings.
- **Impact**: A malformed or abnormally large `event_type` or `source` value from the database could produce an extremely long label that disrupts the timeline layout. Since Angular escapes the output, actual script injection is not possible. This is a display/UX concern with a minor defense-in-depth dimension.
- **Fix**: Apply a `slice` pipe in the template (consistent with how `w.id` is already sliced at line 109) or cap string length in `buildTimeline()` at adapter time (e.g., `e.event_type.slice(0, 80)`).

### Minor 3: `sortBy()` uses unconstrained `col` string as a key into view-model objects

- **File**: `apps/dashboard/src/app/views/model-performance/model-performance.component.ts` lines 85–99; `apps/dashboard/src/app/views/session-comparison/session-comparison.component.ts` lines 75–89
- **Problem**: The `sortBy(col: string)` method stores the caller-supplied column name and uses it as `(a as Record<string, unknown>)[col]` to access view-model properties. This method is called only from `(click)` handlers in the template with hardcoded string literals (`sortBy('model')`, `sortBy('totalCost')`, etc.), so no external user input is involved.
- **Impact**: No active attack surface — callers are all internal template click handlers. However, the pattern allows any future refactor that passes a user-supplied string (e.g., URL query param) to `sortBy()` to access arbitrary object properties. The `as Record<string, unknown>` cast bypasses TypeScript's property checks.
- **Fix**: Narrow `col` to the union of valid column names using a type alias (e.g., `type SortableColumn = 'model' | 'taskType' | ...`), replacing `sortBy(col: string)` with `sortBy(col: SortableColumn)`. This closes the footgun at the TypeScript level.

---

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: Unvalidated user-controlled query parameter values (`status`, `type`, `taskType`, `complexity`) passed through to the Cortex API without an allowlist — low probability of exploitation in the current controlled deployment, but violates defense-in-depth and should be addressed before this dashboard is exposed to untrusted users or connected to a public API endpoint.
