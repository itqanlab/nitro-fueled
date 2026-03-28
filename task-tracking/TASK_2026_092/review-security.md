# Security Review — TASK_2026_092

**Reviewer:** nitro-code-security-reviewer (TASK_2026_092 review pass)
**Date:** 2026-03-28
**Commit reviewed:** `45a06cc feat(dashboard): wire Angular app to NestJS API — TASK_2026_092`
**Verdict:** CHANGES REQUIRED — 3 MEDIUM findings must be resolved before write endpoints are wired

---

## Summary

22 files reviewed. No critical vulnerabilities found. The implementation is a read-only dashboard consumer with no write operations wired yet — this significantly limits the attack surface. Three medium-severity findings require attention before production deployment; three low-severity findings should be addressed in a follow-up.

---

## Findings

### MEDIUM — Path Traversal in URL-Interpolated IDs

**Files:** `apps/dashboard/src/app/services/api.service.ts:49,54,57,89`

Four methods interpolate an `id` parameter directly into URL paths without sanitization:

```typescript
public getTask(id: string): Observable<FullTaskData> {
  return this.http.get<FullTaskData>(`${this.base}/tasks/${id}`);
}
public getTaskReviews(id: string): Observable<ReviewData[]> {
  return this.http.get<ReviewData[]>(`${this.base}/tasks/${id}/reviews`);
}
public getTaskPipeline(id: string): Observable<PipelineData> {
  return this.http.get<PipelineData>(`${this.base}/tasks/${id}/pipeline`);
}
public getSession(id: string): Observable<SessionData> {
  return this.http.get<SessionData>(`${this.base}/sessions/${id}`);
}
```

If task/session IDs are sourced from Angular router params (URL bar), an attacker can craft a URL with `id = ../../../health` or `id = %2F..%2F..%2Fadmin` to probe unintended endpoints. Angular's `HttpClient` does not normalize `../` sequences before sending. The NestJS server is the last line of defence here. **Risk is real if these IDs come from route params.**

**Recommendation:** Validate `id` against an expected format (e.g., `TASK_\d{4}_\d{3}` or a UUID pattern) before interpolating, or use `encodeURIComponent(id)` which converts `/` and `.` to their percent-encoded forms.

---

### MEDIUM — No Authentication on Any API Calls

**File:** `apps/dashboard/src/app/services/api.service.ts`, `apps/dashboard/src/app/app.config.ts`

`provideHttpClient()` is registered with no interceptors. All API methods send unauthenticated requests. There is no auth token, no session cookie, no API key header. If the NestJS API is ever exposed beyond localhost, every endpoint is open to any client.

Additionally, `provideHttpClient()` at `app.config.ts:30` does not include `withXsrfConfiguration()`. Without CSRF protection, a cross-origin page could trigger state-changing requests (once write endpoints are wired) against an authenticated session.

**Recommendation:** Add an auth interceptor (even a no-op stub) early so it is in place before write endpoints are wired. Register `withXsrfConfiguration()` or `withInterceptors([csrfInterceptor])` in `provideHttpClient()`.

---

### MEDIUM — WebSocket Events Accepted Without Runtime Validation

**File:** `apps/dashboard/src/app/services/websocket.service.ts:19-21`

```typescript
this.socket.on('dashboard-event', (event: DashboardEvent) => {
  this.eventsSubject.next(event);
});
```

The `event: DashboardEvent` annotation is TypeScript compile-time only. At runtime the socket delivers a plain JavaScript object. If the WebSocket server is compromised, a MitM is possible (non-TLS WebSocket over `http://`), or the event payload is unexpectedly shaped, malformed data flows directly into Angular signals and template rendering with no validation gate. Template rendering of unexpected object shapes can cause runtime errors or, in edge cases, XSS if a downstream template uses `[innerHTML]`.

**Recommendation:** Add a narrow runtime type guard before calling `eventsSubject.next()`, asserting that the event has at least the expected top-level discriminator fields.

---

### LOW — `console.log` Leaks Task Submission Data

**File:** `apps/dashboard/src/app/views/new-task/new-task.component.ts:161,166`

```typescript
public onSaveDraft(): void {
  console.log('Save draft', { title: this.title, description: this.description, strategy: this.selectedStrategy });
}
public onStartTask(): void {
  console.log('Start task', { title: ..., description: ..., strategy: ..., modelOverrides: this.modelOverrides });
}
```

Task title, description, strategy type, and model overrides are emitted to the browser console on every draft save and task start action. If the app is used in a shared screen, screencasting, or browser extension context, this constitutes information disclosure. Console output is also included in some browser crash reports.

**Recommendation:** Remove or guard behind `environment.production === false` before production deployment.

---

### LOW — Silent Error Swallowing on API Failures

**Files:**
- `apps/dashboard/src/app/views/dashboard/dashboard.component.ts:66,71`
- `apps/dashboard/src/app/views/analytics/analytics.component.ts:27,32`
- `apps/dashboard/src/app/layout/status-bar/status-bar.component.ts:20`

All three components silence API errors entirely:

```typescript
this.api.getRegistry().pipe(catchError(() => of([] as TaskRecord[])))
this.api.getStats().pipe(catchError(() => of(null as DashboardStats | null)))
```

When the NestJS API is unreachable, the dashboard silently shows stale zeros. There is no logging, no toast, and no error state propagated to the UI. This makes diagnosing production outages harder, and users have no signal that the data they see is stale.

**Recommendation:** Log at minimum `console.error(err)` inside each `catchError` callback. Ideally propagate an error flag to the template.

---

### LOW — Dev Environment Uses Plaintext HTTP

**File:** `apps/dashboard/src/environments/environment.ts:3-4`

```typescript
apiUrl: 'http://localhost:3001',
wsUrl:  'http://localhost:3001',
```

HTTP (non-TLS) is acceptable for localhost-only development. However, if the dev environment is ever pointed at a remote host (staging, remote dev VM) by changing only this URL, credentials or session tokens could be transmitted in plaintext. The production environment correctly falls back to relative URLs (same-origin), but the dev config offers no TLS by default.

**Recommendation:** Note in `environment.ts` that this file must not be used against non-localhost hosts without switching to `https://`. A comment guard is sufficient.

---

### LOW — `socket.io-client` in `devDependencies`

**File:** `package.json:19`

`socket.io-client` is a **runtime** dependency of the Angular app but is listed under `devDependencies`. Angular's build pipeline bundles it at build time, so this does not break the compiled output. However, it creates a misleading package manifest: downstream tooling, dependency auditors, and security scanners that distinguish `dependencies` vs `devDependencies` may skip vulnerability scans for `socket.io-client`. The `@types/socket.io-client` entry at line 18 is correctly in `devDependencies`.

**Recommendation:** Move `socket.io-client` to `dependencies` so it appears in `npm audit` production dependency scans.

---

## Files With No Findings

| File | Notes |
|---|---|
| `environment.prod.ts` | Empty strings → relative URLs + `window.location.origin` fallback. Intentional, no secrets. |
| `dashboard.adapters.ts` | Pure transformation functions. Safe. |
| `analytics.adapters.ts` | Pure transformation functions. `Math.min(100, ...)` guards prevent value overflow. Safe. |
| `project.json` | Standard Angular build config. `fileReplacements` is standard practice. No security issues. |
| `sidebar.component.ts` | Static constants only, no network calls. No security issues. |
| `mcp-integrations.component.ts` | `parseInt(..., 10)` with `isNaN` guard. No security issues. |
| `model-assignments.component.ts` | No-op handlers. No security issues. |
| `provider-hub.component.ts` | Pure display component. No security issues. |
| `agent-editor.store.ts` | `JSON.stringify` comparison for dirty check. No `eval` or dynamic code. Safe. |
| `apps/cli/package.json` | `test -d` guard before `rm -rf` in copy script. Correct. No security issues. |

---

## OWASP Top 10 Checklist

| Category | Finding | Severity |
|---|---|---|
| A01 Broken Access Control | No auth on any API endpoint | MEDIUM |
| A02 Cryptographic Failures | HTTP URLs in dev environment | LOW |
| A03 Injection | Path traversal via unsanitized `id` in URL construction | MEDIUM |
| A05 Security Misconfiguration | No CSRF protection configured | MEDIUM |
| A06 Vulnerable Components | `socket.io-client` in devDeps, may skip audit | LOW |
| A09 Security Logging Failures | All API errors silently discarded | LOW |
| A10 SSRF | Not applicable (client-side only) | N/A |

---

## Verdict

**PASS WITH FINDINGS.** No critical or blocking vulnerabilities. The most significant risks (path traversal, no auth, no WebSocket validation) should be addressed before the API gains write endpoints. The current read-only state limits exploitability.

Priority order for remediation:
1. Auth interceptor + CSRF config (A01/A05) — prerequisite for any write endpoint
2. URL path sanitization for `id` params (A03) — before routing task IDs from URL bar
3. WebSocket runtime validation (A03) — before any event payload drives state mutations
4. Console.log removal (A09) — before any staging/production deployment
5. Move `socket.io-client` to `dependencies` — next package.json update
