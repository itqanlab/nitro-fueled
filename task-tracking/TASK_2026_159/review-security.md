# Security Review — TASK_2026_159

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 9                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | Description length-capped at 4000. Enum fields validated against allowlists. Dependency count capped at 20. Minor gap: `model` field has no format constraint. |
| Path Traversal           | PASS   | No file-system operations in scope. Backend is fully mock. |
| Secret Exposure          | PASS   | No hardcoded credentials, API keys, or tokens in any file. |
| Injection (shell/prompt) | PASS   | No shell commands. No `eval`, `exec`, `Function()`, or SQL in scope. No prompt injection vectors in markdown files reviewed. |
| Insecure Defaults        | FAIL   | Raw HTTP error messages from the server are reflected verbatim to the user via the error signal. No authentication or rate limiting on the create endpoint. |

| Verdict | PASS |
|---------|------|

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Raw Server Error Message Reflected to User

- **File**: `apps/dashboard/src/app/views/new-task/new-task.component.ts:117`
- **Problem**: The `error` callback casts `err` to `Error` and directly sets `err.message` as the user-facing error string. Angular HTTP errors are `HttpErrorResponse` objects whose `.message` field contains the full backend response body, internal NestJS stack detail, or path info depending on the error type. This value is rendered verbatim in the template at `new-task.component.html:156` via `{{ errorMessage() }}`.
- **Impact**: Internal server details (file paths, stack frames, NestJS module names, or validation implementation details) may be disclosed to the user. Angular interpolation escapes HTML so XSS is not in scope here, but information disclosure assists attackers in mapping the backend structure. When the endpoint is wired to real task creation logic, error messages from file system or process execution layers could surface.
- **Fix**: Extract a user-safe message at the HTTP boundary. For `HttpErrorResponse`, read `error.error?.message` (the backend's `BadRequestException` message) and fall back to a generic string. Never forward `.message` from an unknown error shape. Example: `const message = err instanceof HttpErrorResponse ? (err.error?.message ?? 'Request failed') : 'Unexpected error — please try again.';`

### Issue 2: `model` Override Field Has No Format Constraint

- **File**: `apps/dashboard-api/src/tasks/tasks.controller.ts:83-88`
- **Problem**: The `model` field in overrides is validated only as "non-empty string" with no allowlist, no regex pattern, and no length cap independent of the description cap. The field is currently passed through to a mock service and goes nowhere. However, the pattern establishes a surface that will reach model-selection, subprocess spawning, or external API calls when real task creation logic is wired in.
- **Impact**: When wired to real backend: an unbounded `model` string reaching a shell command (e.g., `claude --model <value>`) without quoting or escaping would be a shell injection vector. Passing it to an API gateway without an allowlist enables probing internal model identifiers. The mock-safe code today will not be reconsidered at wiring time if no validation constraint exists.
- **Fix**: Add a maximum length (e.g., 128 characters) and a regex pattern matching known model identifier formats (e.g., `/^[a-zA-Z0-9._-]{1,128}$/`) at the controller validation layer. Document the format constraint in the API type so the frontend can enforce it client-side too.

---

## Minor Issues

- **Duplicate `TaskType` union in `api.types.ts`** (`apps/dashboard/src/app/models/api.types.ts:19-26` vs `:503`): The type is defined twice in the same file. The first definition (line 19) does not include `'CONTENT'`; the second (line 503) does. The frontend component imports `CreateTaskOverrides` from this file — which uses the second definition — so `CONTENT` is accepted on the wire. But any code using the first `TaskType` export will silently reject `CONTENT` as a valid value. The controller on the backend independently defines its own `VALID_TYPES` tuple that includes `CONTENT`. This three-way duplication creates silent type contract divergence across the stack.

- **No rate limiting or authentication on `POST /api/tasks/create`** (`apps/dashboard-api/src/tasks/tasks.controller.ts:25`): The endpoint is fully open with no throttle guard and no auth middleware. For a local development tool this is low risk today, but if the dashboard-api is ever exposed beyond localhost (e.g., via a cloud deployment or port forward), the endpoint becomes freely hammerable. A NestJS `@Throttle()` decorator and/or a `@UseGuards(LocalAuthGuard)` should be added before any production exposure.

- **`castToInput()` performs an unchecked type assertion** (`apps/dashboard/src/app/views/new-task/new-task.component.ts:70`): The helper casts `EventTarget | null` to `HTMLTextAreaElement` without a null guard or `instanceof` check. The handoff notes this is "safe in practice" because `(input)` always fires with a target, but the compiler accepts calls with `null` and the assertion silently produces `null.value` if the event were ever emitted without a target. This is defense-in-depth — not exploitable in practice — but violates the no-`as` type assertion rule from review-general.md.

---

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: Raw server error messages forwarded verbatim from `HttpErrorResponse.message` to the user-facing error display. Not exploitable for XSS due to Angular interpolation escaping, but discloses internal NestJS error detail. Fix before wiring to real task creation logic.
