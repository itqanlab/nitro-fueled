# Security Review — TASK_2026_201

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 6/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 12                                   |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | No user-controlled input reaches the service; no injection vectors present |
| Path Traversal           | PASS   | No file system operations in the new code |
| Secret Exposure          | FAIL   | Raw upstream provider error messages — which may include fragments of auth challenges or key-related diagnostics — are forwarded to the frontend |
| Injection (shell/prompt) | PASS   | No shell execution; no prompt construction from external data |
| Insecure Defaults        | FAIL   | Auth guard is opt-in at runtime; quota endpoint exposes sensitive business data (org cost, token usage) with no auth in non-production environments |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: Untrusted Provider Error Messages Reflected in API Response

- **File**: `apps/dashboard-api/src/providers/providers.service.ts:63`
- **Problem**: The `unavailable()` helper returns `reason: message.slice(0, 200)` where `message` is the `.message` property of a thrown `Error`. For HTTP failures, that message is constructed by the service itself (e.g., `"GLM API returned 401"`), so it is safe. However, the three fetch methods also let exceptions from `fetch()` itself propagate — network-level errors whose `.message` strings are Node.js-internal strings. More critically, if the upstream provider embeds diagnostic content in the response body and a future maintainer changes the throw to include that body (a common debugging pattern), provider-controlled content would flow verbatim into the API response. The 200-character cap reduces severity but does not eliminate the class.
- **Impact**: A provider API returning a crafted error message (e.g., one embedding a token prefix or an internal URL) could surface that string in the frontend UI and in browser developer tools accessible to any user of the dashboard.
- **Fix**: Build the `reason` string exclusively from safe, locally-controlled fragments. Use only the HTTP status code and a static label string: `reason: \`GLM API unavailable (HTTP ${resp.status})\``. Never embed content derived from response bodies or exception `.message` strings in the response DTO. Where network-level errors must be surfaced, use a static string like `"Network error — see server logs"`.

---

### Issue 2: Quota Endpoint Exposes Sensitive Business Data Without Mandatory Authentication

- **File**: `apps/dashboard-api/src/app/auth/http-auth.guard.ts:28-30`
- **Problem**: The `HttpAuthGuard` is only enforced when `AUTH_ENABLED=true` or `NODE_ENV=production`. In all other environments the guard passes every request unconditionally. The new `/api/providers/quota` endpoint returns per-organisation token consumption and financial cost data (`costThisPeriod` in USD/CNY) for three AI providers. This is sensitive business-intelligence data. Unlike most dashboard endpoints that show internal task metrics, this endpoint makes live calls to external provider billing APIs and returns real cost figures. Exposing it without authentication in any deployment environment — including shared development or staging servers — leaks financial data.
- **Impact**: Any party who can reach the API server (LAN peer, shared staging environment, misconfigured proxy) can read the organisation's provider spend without credentials.
- **Fix**: Add `@UseGuards(HttpAuthGuard)` explicitly on the `ProvidersController` class (or on the `getQuota` handler) to enforce auth regardless of the `APP_GUARD` opt-in state. Alternatively, add `'/api/providers'` to the set of paths that require an explicit allowlist exception and document the exception rationale. If the intent is that cost data is always internal, consider moving it behind a separate admin-tier guard rather than the generic dashboard guard.

---

## Minor Issues

### Minor 1: `resp.json()` Cast Without Runtime Validation Produces Silent NaN in Response

- **File**: `apps/dashboard-api/src/providers/providers.service.ts:81, 130, 180`
- **Problem**: All three fetch helpers cast `resp.json()` as `Record<string, unknown>` and then access numeric fields with `?? 0`. If a provider changes its response shape (a documented risk in the handoff), field values will be `undefined`, arithmetic will produce `NaN`, and `JSON.stringify(NaN)` produces `null`. The frontend will silently display `0 / 0 tokens` with no indication of the shape mismatch.
- **Severity**: Low — no security boundary is breached, but silent data corruption degrades data integrity guarantees.
- **Recommendation**: After casting, assert that expected numeric fields are `typeof field === 'number'`. If they are not, throw a typed error: `throw new Error('GLM API: unexpected response shape')`. This routes the failure to the `unavailable` path with a clear diagnostic instead of surfacing `null` token values.

---

### Minor 2: In-Process Cache Does Not Protect Against Upstream Rate-Limit Amplification

- **File**: `apps/dashboard-api/src/providers/providers.service.ts:38-57`
- **Problem**: The 5-minute TTL cache is keyed on the string `'quota'` and applies globally. However, if `getQuota()` is called concurrently before the first response settles, multiple simultaneous upstream fan-outs will be dispatched (no in-flight deduplication). In a multi-tab dashboard scenario, three rapid page loads could each trigger three provider API calls before the first result populates the cache.
- **Severity**: Low — the 5-minute window limits steady-state exposure, but bursts are unguarded.
- **Recommendation**: Add an in-flight request deduplication guard: store the `Promise.allSettled` promise itself in the cache while it is pending, and return that same promise to any concurrent caller rather than dispatching a new fan-out.

---

### Minor 3: No Rate Limiting on the Quota Endpoint

- **File**: `apps/dashboard-api/src/providers/providers.controller.ts:12-26`
- **Problem**: The `GET /api/providers/quota` endpoint has no per-caller rate limit. The 5-minute TTL cache mitigates repeated calls from a single flow, but an authenticated caller who bypasses normal UI interaction could invoke the endpoint rapidly — especially if the cache is cold after restart. Each call fans out to three external provider APIs, each with their own API-key rate limits.
- **Severity**: Low — in the current single-user dashboard context, exploitation probability is low. Becomes a concern if the API is exposed more broadly.
- **Recommendation**: Apply a per-IP or per-API-key rate limit of 1 request per 5 minutes on this endpoint using a NestJS throttle guard (`@Throttle` from `@nestjs/throttler`), matching the cache TTL.

---

## Verdict

| Verdict | NEEDS_REVISION |
|---------|---------------|

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Untrusted upstream provider error strings are forwarded verbatim (up to 200 characters) into the API response DTO. While no current code path embeds response bodies in those strings, the pattern creates a fragile trust boundary one change away from information disclosure. Combined with the auth-optional design for a cost-data endpoint, two independently addressable serious issues prevent APPROVE.
