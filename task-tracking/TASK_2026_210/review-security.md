# Security Review — TASK_2026_210

## Overall Score: 8/10

## Assessment

The session management migration is broadly well-implemented from a security standpoint. Angular's default template escaping prevents XSS on all rendered session data. Session ID parameters are consistently `encodeURIComponent`-encoded in the API service. No credentials, secrets, or API keys are present. No `[innerHTML]` bindings exist in any in-scope template. Angular's `HttpClient` handles CSRF token forwarding automatically and no custom headers bypass it.

Two minor concerns are present: an unvalidated `JSON.parse` cast on the localStorage config payload, and an unencoded session ID passed directly into a router navigation call. Both have low exploitation probability in this application's context but represent defense-in-depth gaps consistent with patterns flagged previously in this codebase.

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | Select-driven form fields have hardcoded option values; numeric inputs use `type="number"` with `min`/`max` attributes; URL query params are allowlist-filtered in `initializeFromURL()` |
| Path Traversal           | PASS   | All session IDs and task IDs are `encodeURIComponent`-encoded in URL construction in `api.service.ts`; no filesystem access from the frontend |
| Secret Exposure          | PASS   | No API keys, tokens, or passwords found in any in-scope file |
| Injection (shell/prompt) | PASS   | No `eval()`, `Function()`, or shell execution; Angular template engine auto-escapes `{{ }}` bindings; no `[innerHTML]` bindings present |
| Insecure Defaults        | PASS   | localStorage operations are wrapped in try/catch; no `DEBUG=true` or dev-only flags committed |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

No serious issues found.

---

## Minor Issues

### 1. Unvalidated `JSON.parse` cast on localStorage config

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:951`
- **Problem**: `JSON.parse(raw)` result is checked only for `typeof parsed === 'object' && parsed !== null`, then immediately cast `as CreateSessionRequest` without validating individual fields. A corrupted or attacker-modified localStorage entry (e.g., via a XSS on another same-origin page) could supply unexpected field types (`concurrency: "../../etc"`, `priority: {__proto__: ...}`).
- **Risk**: Low in practice — the resulting config object is only POSTed to the backend API where the backend should validate inputs. No code-execution path exists. However, if a field like `concurrency` resolves to `NaN` after `+val` in `onConcurrencyChange`, the form could submit an invalid payload silently.
- **Fix**: After the `typeof` check, additionally validate that numeric fields are finite numbers and string enum fields match their expected unions before accepting the parsed value. Fall back to `{}` if any field is unexpected. This matches the existing pattern in `api.service.ts`'s allowlist guards.

### 2. Session ID passed to `router.navigate` without `encodeURIComponent`

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:46`
- **Problem**: `this.router.navigate(['/session', session.sessionId])` passes the raw `sessionId` string directly as a URL path segment. Angular's router does apply URL encoding to path parameters by default, but the encoding is not explicit at the call site and relies on Angular's internal behavior.
- **Risk**: Negligible given session IDs are UUIDs (`[a-f0-9-]` characters only) sourced from the backend. However, if the session ID format ever changes to include URL-special characters, navigation could silently produce a malformed URL.
- **Fix**: Explicitly encode: `['/session', encodeURIComponent(session.sessionId)]` to match the defensive pattern used consistently in `api.service.ts`.

### 3. Cast-without-validation on provider and priority select values

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:878–889`
- **Problem**: `onPriorityChange`, `onImplementProviderChange`, and `onReviewProviderChange` cast raw `<select>` values using `as 'build-first' | 'review-first' | 'balanced'` and `as 'claude' | 'glm' | 'opencode' | 'codex'` without runtime allowlist checks. TypeScript's `as` provides no runtime protection.
- **Risk**: Low — the select options are hardcoded in the HTML template, limiting realistic input to the listed values. However, a developer adding a new option without updating the handler would silently bypass any future validation.
- **Fix**: Add a runtime guard (e.g., a `Set` of valid values, matching the pattern already used in `api.service.ts` with `VALID_TASK_STATUSES`) and fall back to the default value if the incoming value is not in the set.

---

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: Unvalidated localStorage JSON parse cast (`project.component.ts:951`) — low practical exploitability in the current same-origin context but a known codebase anti-pattern (per security.md). Fix in a follow-on polish pass.
