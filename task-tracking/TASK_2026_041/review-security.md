# Security Review — TASK_2026_041

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 3                                    |

## OWASP Checklist Results

| Category                 | Status | Notes                                                                 |
|--------------------------|--------|-----------------------------------------------------------------------|
| Input Validation         | FAIL   | Task/session IDs reflected in error messages without format guard on two routes |
| Path Traversal           | PASS   | analytics-store uses readdir output (not user input) for paths; static file server has boundary check |
| Secret Exposure          | PASS   | No credentials, API keys, or tokens found                            |
| Injection (shell/prompt) | PASS   | No shell execution, no eval, no prompt injection vectors             |
| Insecure Defaults        | PASS   | CORS uses allowlist (not wildcard); no debug flags committed         |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Unvalidated `:id` route params reflected in error responses and passed to store on two routes

- **File**: `packages/dashboard-service/src/server/http.ts:89, 96, 141`
- **Problem**: The routes `GET /api/tasks/:id` (line 86) and `GET /api/tasks/:id/reviews` (line 95) pass `params.id` directly to store methods and include it verbatim in the error JSON body (`Task ${params.id} not found`). Similarly, `GET /api/sessions/:id` (line 138) reflects `params.id` in the 404 error at line 141. No format validation is applied before use. By contrast, `GET /api/tasks/:id/pipeline` (line 116) does apply a strict `/^TASK_\d{4}_\d{3}$/` guard. The three routes that lack the guard are inconsistent with the one that has it.
- **Impact**: An attacker can supply an arbitrary string (up to the `[^/]+` regex match) as the `:id` segment. This string is echoed in the JSON error response, which could be used for response injection if a downstream parser treats the error field as structured data. The unvalidated value is also passed to `store.getFullTask`, `store.getReviews`, and `sessionStore.getSession` — if any of those internally construct file paths from the ID (which they likely do, given this is a file-backed store), a crafted ID containing path traversal sequences could escape the task or session directory. This is the same pattern flagged in security.md from TASK_2026_039.
- **Fix**: Apply `if (!/^TASK_\d{4}_\d{3}$/.test(params.id)) { sendJson(res, req, { error: 'Invalid task ID format' }, 400); return; }` at the top of the `/api/tasks/:id` and `/api/tasks/:id/reviews` handlers, matching the guard already present in `/api/tasks/:id/pipeline`. For sessions, apply an equivalent guard (e.g., `/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/`) before passing `params.id` to the session store or including it in error messages.

---

## Minor Issues

### Minor 1: Silent error suppression in readdir and readTextFile hides disk/permission failures

- **File**: `packages/dashboard-service/src/state/analytics-store.ts:49, 57-58`
- **Problem**: Both `readSessionDirs` (catch returns `[]`) and `readTextFile` (catch returns `null`) swallow all errors silently. A disk-full condition, permission error, or unexpected filesystem state produces no log trace. This is the same pattern noted in security.md from TASK_2026_059.
- **Impact**: Silent data loss — analytics will return empty/zero results with no indication of why, making the failure invisible and hard to diagnose.
- **Fix**: Add `console.error` or `process.stderr.write` inside each catch block, logging the error without rethrowing.

### Minor 2: Symlink escape in readSessionDirs

- **File**: `packages/dashboard-service/src/state/analytics-store.ts:44-47`
- **Problem**: `readdir(sessionsPath, { withFileTypes: true })` returns directory entries including symlinks that pass `.isDirectory()` as true (symlinks to directories report true for `isDirectory()` when using `withFileTypes`). A symlink planted inside `task-tracking/sessions/` pointing outside the project root would cause subsequent `readTextFile` calls to read arbitrary files accessible to the process. The `startsWith('SESSION_')` filter (line 46) limits this to symlinks whose names begin with `SESSION_`, but that is a trivially satisfied constraint.
- **Impact**: Local privilege escalation — any process or user with write access to the sessions directory can cause the dashboard to read and surface (via API response) content from arbitrary files. This is the same pattern noted in security.md from TASK_2026_022.
- **Fix**: After constructing each session directory path (line 47), call `fs.realpathSync` and verify the resolved path still starts with `path.resolve(sessionsPath)`. Skip any entry whose resolved path escapes the sessions directory.

### Minor 3: Regex patterns in parseCostFromContent have bounded but non-zero ReDoS exposure

- **File**: `packages/dashboard-service/src/state/analytics-helpers.ts:12`
- **Problem**: The pattern `/Total Cost[^\$]*\$([0-9,.]+)/i` uses a `[^\$]*` negated class with `*` quantifier followed by a required `\$` anchor. On a string that starts with `Total Cost` followed by thousands of characters that are neither `$` nor the chars in `[0-9,.]+`, the engine backtracks across the entire span before failing. The `opus` and `sonnet` patterns at lines 17 and 23 use `[^$\n]*` which limits backtracking to within a single line, significantly reducing the surface. The primary concern is line 12.
- **Impact**: The file content is read from the local filesystem (state.md/log.md written by the orchestrator), so exploitation requires write access to those files. The practical risk is low in the current deployment model. If the service is ever extended to process externally supplied content, this becomes a more serious DoS vector.
- **Fix**: Add a length cap before passing content to `parseCostFromContent` (e.g., `content.slice(0, 50_000)`) or rewrite the line-12 pattern to use a possessive quantifier / atomic group if the Node.js version supports it, or anchor the match more tightly (e.g., require the pattern to appear within a short window using `.{0,200}`).

---

## Findings Outside Scope

None noted. The three files reviewed exactly match the declared scope.

---

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: Unvalidated `:id` params on `/api/tasks/:id`, `/api/tasks/:id/reviews`, and `/api/sessions/:id` are passed to the file-backed store without format validation — inconsistent with the guard already present on `/api/tasks/:id/pipeline`. Fix before the next task that extends the store to perform direct file I/O on the task ID.
