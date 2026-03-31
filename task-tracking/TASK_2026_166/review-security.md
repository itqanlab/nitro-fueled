# Security Review — TASK_2026_166

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 4                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | PASS   | No user-provided string is passed to a dangerous API without an intermediate layer |
| Path Traversal           | PASS   | No file system operations in scope; router params are used only for API calls and Angular Router navigation |
| Secret Exposure          | PASS   | No API keys, tokens, passwords, or PII in any of the four files |
| Injection (shell/prompt) | PASS   | No shell calls; no `eval()`/`Function()`; no `[innerHTML]` or `DomSanitizer` bypass present |
| Insecure Defaults        | FAIL   | `statusClass` is built from unvalidated server data via string concatenation and applied as a CSS class; `customFlows` data from the API is bound directly into `<option value>` without a format guard |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: Unvalidated API string used to construct a CSS class name

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:198-199`
- **Problem**: The `transitionNodes` computed signal builds a CSS class name by concatenating a server-supplied status value with a fixed prefix:
  ```ts
  statusClass: 'tl-status--' + t.to.toLowerCase().replace(/_/g, '-'),
  ```
  The only transform applied is `.toLowerCase()` and `replace(/_/g, '-')`. If the backend returns a `to` value containing spaces, dots, parentheses, or Unicode, those characters are written verbatim into the class string and then applied to the DOM via `[ngClass]` at `task-detail.component.html:96`. Angular's `[ngClass]` binding sets `element.className`, which is reflected in the DOM as an attribute value. While this is not a direct XSS vector (Angular template binding escapes attribute content), an attacker controlling the cortex DB row could inject class names that match pre-existing CSS rules (e.g., `tl-status--admin`, `tl-status--hidden`) and alter the visual presentation of the page, or produce class strings that confuse automated UI scrapers and test harnesses.
- **Impact**: Cosmetic/UI spoofing risk. An attacker with write access to the cortex event log could cause status nodes to render with arbitrary class names. If the application ever adds a class that grants elevated visual privilege (e.g., `admin-highlight`), this becomes a visual-privilege escalation.
- **Fix**: Validate `t.to` against the known `statusColorMap` key set (which already enumerates all legal statuses) before building `statusClass`. Default to `'tl-status--unknown'` for any value outside the allowlist:
  ```ts
  const safeStatus = Object.keys(this.statusColorMap).includes(t.to)
    ? t.to.toLowerCase().replace(/_/g, '-')
    : 'unknown';
  statusClass: 'tl-status--' + safeStatus,
  ```

## Minor Issues

### Minor 1: `customFlows` API data bound directly into `<option value>` without format validation

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.html:490` and `task-detail.component.ts:163-164`
- **Problem**: Custom flow IDs and names from `api.getCustomFlows()` are bound to `[value]="cf.id"` and `{{ cf.name }}` in the select element without any character-set or length validation. The same `cf.id` is subsequently passed directly to `api.setTaskFlowOverride(taskId, flowId)` in `handleFlowOverrideChange`. If the API returns a crafted `id` containing URL path separators (`/`, `..`), the value is forwarded into an HTTP call with no sanitization guard in the component.
- **Impact**: The risk is bounded by whatever URL construction `ApiService.setTaskFlowOverride` performs. If it concatenates the ID into a URL segment without encoding, a value like `../../admin` could cause an unintended API endpoint to be called. Low probability given that flow IDs originate from the same server, but the component should not be the last line of defence.
- **Fix**: Apply a format guard when populating `customFlows` — accept only IDs matching an allowlist pattern (e.g., `/^[a-zA-Z0-9_-]{1,64}$/`) and discard entries that fail it. This mirrors the existing pattern used in the cortex security lessons for WebSocket payload fields.

### Minor 2: `console.warn` in `handleFlowOverrideChange` logs the raw error object

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:172`
- **Problem**: `console.warn('[TaskDetail] flow override update failed:', err)` logs the full `err` value with no cap. In a browser context `console.warn` output is visible to anyone with DevTools open, which is acceptable for a local dashboard. However, if error objects from the API layer include server-side stack traces or internal paths (common in NestJS development mode), they are exposed verbatim.
- **Impact**: Information disclosure to a local user with DevTools access. Low severity for a local-only dashboard; higher if the dashboard is ever served to a wider audience.
- **Fix**: Log only `(err as Error)?.message ?? String(err)` capped to 200 characters, consistent with the pattern established in `.claude/review-lessons/security.md` ("Network exception messages must be capped before terminal output").

## Verdict

| Verdict | PASS |
|---------|------|

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: Unvalidated server-supplied status string used to compose a CSS class name (`transitionNodes` computed, line 198-199). Not immediately exploitable but should be hardened before the dashboard is exposed beyond local use.
