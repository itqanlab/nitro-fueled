# Security Review — TASK_2026_171

## Summary

Analytics Reports — Session, Cost, Model & Quality Reports (Angular frontend + NestJS backend).

This review covers 13 in-scope files: 4 NestJS backend files and 8 Angular frontend files (one file, `mock-data.constants.ts`, had only a trivial nav-item addition and is accounted for below).

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 6/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 13                                   |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | Date query params validated by regex on backend; frontend `from`/`to` values are user-typed strings forwarded without format enforcement before the API call. |
| Path Traversal           | FAIL   | `readSessions` and `readReviews` join `this.projectRoot` with directory entries returned by `readdir` — no boundary check verifies the resolved path stays inside the project root. |
| Secret Exposure          | PASS   | No credentials, API keys, or tokens found in any in-scope file. |
| Injection (shell/prompt) | PASS   | No shell execution. Angular template uses only `{{ }}` interpolation and `[style.width.%]` bindings — no `[innerHTML]` or `bypassSecurityTrustHtml` usage found. |
| Insecure Defaults        | FAIL   | No authentication guard on the new `/api/v1/reports/overview` endpoint; controller comment acknowledges local-only intent but this is an undocumented assumption rather than an enforced constraint. CSV export uses `URL.createObjectURL` without revoking on click failure — minor, see Minor Issues. |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Path Traversal — `readdir` entries joined into file-system paths without boundary validation

- **File**: `apps/dashboard-api/src/dashboard/reports.service.ts:134-170`
- **Problem**: `readSessions` calls `readdir(sessionsPath)` and then builds a sub-path with `join(sessionsPath, entry)` without verifying the resolved path is still under `sessionsPath`. Similarly, `readReviews` calls `readdir(tasksPath)` and builds `join(tasksPath, taskDir, fileName)`. If the `task-tracking/sessions/` or `task-tracking/` directory contains a symlink or a crafted entry whose name resolves outside the project root (e.g., a name like `../../etc`), the subsequent `readFile` call follows the constructed path without boundary-checking it. The existing lessons doc (`security.md`) explicitly flags this pattern: "`path.join(base, userInput)` is not a path traversal guard — always boundary-check with `path.resolve`" (TASK_2026_067).
- **Impact**: An attacker who can write a symlink or a directory entry with traversal-containing characters into the `sessions/` or `task-tracking/` folder can cause the service to read arbitrary files accessible to the Node.js process and return their contents in the reports API response. In a local developer environment this is lower probability, but the fix is low effort and the pattern is categorically unsafe.
- **Fix**: After constructing the full entry path, resolve it with `path.resolve` and assert it starts with `path.resolve(sessionsPath) + path.sep` (or `tasksPath` equivalent) before passing it to `readFile` or `stat`. Reject and log any entry that fails the check.

---

### Issue 2: Missing Input Validation on Date Parameters Passed from the Frontend

- **File**: `apps/dashboard/src/app/services/api.service.ts:218-229` and `apps/dashboard/src/app/views/reports/reports.component.ts:67`
- **Problem**: The frontend passes `from` and `to` directly from `<input type="date">` bindings to `getReportsOverview` with no client-side format validation. While the backend correctly validates with `DATE_RE` (`/^\d{4}-\d{2}-\d{2}$/`), the frontend will forward any string value the user can type into the field (e.g., a malformed date, a very long string, or special characters). The Angular `type="date"` input enforces format in modern browsers, but the value is also accessible programmatically, and browser-enforced constraints are bypassed by automated clients. The larger concern is that the backend silently nullifies invalid values rather than returning a 400, so bad input produces a silent all-time report range rather than a visible error.
- **Impact**: A manipulated or automated caller can supply non-date strings that silently widen the report window to all available data. This is an information over-disclosure risk rather than an injection risk, but it is unacceptable in a multi-user deployment.
- **Fix**: Add a `from`/`to` format guard in the frontend service before building `HttpParams` (analogous to the `isValidTaskStatus` pattern already in the same file at line 235). On the backend, return HTTP 400 when either date parameter is present but fails the regex, rather than silently defaulting to `null`.

---

### Issue 3: CSV Injection (Formula Injection) — Unescaped Cell Values Containing Formula-Trigger Characters

- **File**: `apps/dashboard/src/app/views/reports/reports-export.ts:1-24`
- **Problem**: `escapeCsv` wraps values containing commas, double-quotes, or newlines in double-quotes but does not strip or prefix leading formula-trigger characters (`=`, `+`, `-`, `@`). Values sourced from the backend include free-text fields such as `row.sessionId`, `row.primaryModel`, `row.label` (task type, complexity, model name), `row.category`, `row.note`, and insight strings. If any of these fields contains a value starting with `=` (e.g., a model named `=cmd|'/C calc'!A1`, or a category detected as `=HYPERLINK(...)`), the exported CSV will execute that formula when opened in Microsoft Excel or LibreOffice Calc. The field values come ultimately from the filesystem (session folder names, cortex DB entries, review file content parsed via regex) — all of which are writable by local tooling and therefore controllable.
- **Impact**: When a user exports and opens the CSV in a spreadsheet application, formula injection can trigger arbitrary local commands (DDE payloads in Excel on Windows) or SSRF-like HTTP requests (HYPERLINK formulas). Even in milder forms, it causes data corruption and unexpected spreadsheet behavior. This is a well-documented OWASP vulnerability class (CWE-1236).
- **Fix**: In `escapeCsv`, prefix any string value whose first character is one of `=`, `+`, `-`, `@`, `\t`, `\r` with a single apostrophe (`'`), which causes spreadsheet parsers to treat the cell as a literal string: `if (/^[=+\-@\t\r]/.test(stringValue)) return "'" + stringValue;` (applied before the comma/quote wrapping logic).

---

## Minor Issues

### Minor 1: `URL.revokeObjectURL` called synchronously before browser navigation completes

- **File**: `apps/dashboard/src/app/views/reports/reports-export.ts:21-23`
- **Problem**: `link.click()` triggers an asynchronous browser download, but `URL.revokeObjectURL(url)` is called on the very next line. Some browsers (particularly older versions of Firefox and Safari) may not have started reading the blob before `revokeObjectURL` is called, resulting in a failed or empty download.
- **Fix**: Use `setTimeout(() => URL.revokeObjectURL(url), 100)` or listen for the `click` event to complete before revoking.

---

### Minor 2: `[ngClass]` dynamic class construction from server-provided `severity` string

- **File**: `apps/dashboard/src/app/views/reports/reports.component.html:107`
- **Problem**: The template uses `[ngClass]="'severity-pill--' + row.severity"`. The `severity` value is typed as `'critical' | 'serious' | 'moderate'` in the TypeScript interface, but at runtime this is controlled by the backend. If a backend bug or an upstream data change causes `severity` to contain an unexpected value, the resulting CSS class name is unpredictable. This is a defense-in-depth concern — Angular's `NgClass` does not execute scripts, but it can produce unexpected CSS class names.
- **Fix**: Validate `severity` against the known union before rendering, or use an explicit `@if` / `@switch` block that maps known values to classes.

---

### Minor 3: `safeReadDir` and `safeReadFile` silently swallow all errors

- **File**: `apps/dashboard-api/src/dashboard/reports.service.ts:310-324`
- **Problem**: Both helper methods catch all errors and return empty values with no logging. Per the review lessons ("`Never swallow errors — at minimum, log them`"), silent catch blocks make it impossible to diagnose permission errors, unexpected filesystem states, or security-relevant failures (e.g., a path traversal guard throwing `EACCES`).
- **Fix**: Add a `this.logger.warn(...)` call inside each catch block, logging the path and error message (capped to 200 characters as per existing security lessons).

---

## Verdict

| Verdict | FAIL |
|---------|------|
| **Recommendation** | REVISE |
| **Confidence** | HIGH |
| **Top Risk** | CSV injection (Issue 3) — server-derived free-text fields including model names, session IDs, category labels, and insight strings are written directly to CSV without formula-trigger character escaping, creating a spreadsheet formula injection vector when users export and open files. |
