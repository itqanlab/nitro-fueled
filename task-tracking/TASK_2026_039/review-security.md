# Security Review — TASK_2026_039

**Overall Score**: 8/10
**Assessment**: Well-structured implementation with solid existing defenses. Two serious issues exist: the pipeline route validates task ID against the registry but the store call still uses the unvalidated raw param, and the React views render unchecked string fields from server JSON without any CSP backstop. No critical issues; no credentials or shell injection found.

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | Pipeline route validates via registry lookup but `params.id` is used raw in subsequent store call; `TASK_ID_RE` regex in client.ts is correct but server-side has no equivalent guard |
| Path Traversal           | PASS   | `session-analytics.parser.ts` uses regex matching (`canParse`) to accept file paths, not to construct them. File-router reads from watcher-emitted paths only. Static file serving has `resolve`+prefix boundary check (http.ts:181). |
| Secret Exposure          | PASS   | No tokens, keys, or credentials found anywhere in scope. |
| Injection (shell/prompt) | PASS   | No `exec`/`eval`/`Function()` calls. No shell commands. No markdown rendering to HTML. JSX renders text nodes only (no `dangerouslySetInnerHTML`). |
| Insecure Defaults        | PASS   | CORS is explicitly allowlist-based (not `*`). Only GET + OPTIONS are registered. No debug flags or dev-only endpoints in production routes. |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Pipeline route uses raw `:id` param in store call after partial validation

- **File**: `packages/dashboard-service/src/server/http.ts:114-121`
- **Problem**: The `/api/tasks/:id/pipeline` handler validates that `params.id` appears in the in-memory registry (`store.getRegistry().find(r => r.id === params.id)`), then — if found — passes `params.id` directly to `store.getTaskPipeline(params.id)`. This is effectively safe today because the store only does an array lookup with the same id; it does not construct file-system paths with it. However, the pattern is inconsistent with the explicit `TASK_ID_RE` guard present in the client (`client.ts:18`) and in every other route that receives an id. If `getTaskPipeline` is later extended to read session-analytics from disk, this param will flow unvalidated into a path. The pattern inconsistency is itself a Serious issue per the project's own security lessons ("Task ID validation must be applied uniformly at every path-construction site").
- **Impact**: Currently low — the store call is safe. If the store method is extended to perform file I/O (which the analytics integration at store.ts:281 already begins), the unvalidated param becomes a path traversal vector.
- **Fix**: Add `if (!/^TASK_\d{4}_\d{3}$/.test(params.id)) { sendJson(res, req, { error: 'Invalid task id' }, 400); return; }` at the top of the handler, before the registry lookup. Apply the same guard to the existing `/api/tasks/:id` and `/api/tasks/:id/reviews` handlers for consistency (those are existing routes but are included in the modified file in scope).

---

### Issue 2: Unchecked string fields from server JSON rendered in JSX with no Content Security Policy

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx:55-58,71,136`, `packages/dashboard-web/src/views/Squad.tsx:49-53,82`
- **Problem**: `Pipeline.tsx` renders `phase.name`, `phase.status`, `phase.duration`, `part` (from `parallelParts`), `t.id`, and `t.description` directly as JSX children. `Squad.tsx` renders `node.role`, `node.workerType`, `node.status`, `tree.taskId`. These values come from `api.getTaskPipeline()` and `api.getWorkerTree()`, which in turn come from the dashboard-service. In the intended threat model the service is local-only. However, if a task description or worker label in the underlying data files is crafted to contain JavaScript, React's JSX rendering does safely HTML-escape string children — so no stored XSS reaches the DOM. The concern is the absence of a Content Security Policy (`<meta>` or header): if XSS were introduced via any other vector (future `dangerouslySetInnerHTML`, a new dependency), the CSP would limit blast radius. This was flagged as a defense-in-depth gap in the security lessons from TASK_2026_023.
- **Impact**: No active XSS in the current code — React JSX escapes string children. The gap is the missing CSP backstop, noted as a defense-in-depth requirement in `security.md` (TASK_2026_023 lesson).
- **Fix**: Add a `Content-Security-Policy` response header in `http.ts` when serving `index.html` (the SPA entry point). Minimum policy: `script-src 'self'; style-src 'self' 'unsafe-inline'; default-src 'self'`. The `'unsafe-inline'` for styles is required for the React inline-style approach used throughout these views.

---

## Moderate Issues

No moderate issues found.

---

## Minor Issues

### Minor 1: `fetchError` message rendered verbatim from network errors (Pipeline.tsx:142, Squad.tsx:125)

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx:142`, `packages/dashboard-web/src/views/Squad.tsx:125`
- `fetchError` is set from `err.message` (an `Error` object). The API client formats error messages as `"API error: ${response.status} ${response.statusText}"`. React JSX-escapes the string, so no XSS. However, if the error originates from a crafted HTTP server response (e.g., a MITM or a substituted service), the status text could be long or contain misleading content. The per-lesson cap of 200 characters (security.md, TASK_2026_068 lesson) is not applied here.
- **Fix**: Truncate `fetchError` to 200 characters before rendering: `err.message.slice(0, 200)`.

### Minor 2: `sessionAnalyticsParser.canParse` regex has no anchored start — theoretical bypass on unusual paths

- **File**: `packages/dashboard-service/src/parsers/session-analytics.parser.ts:6`
- The regex `/TASK_\d{4}_\d{3}[\\/]session-analytics\.md$/` lacks a leading `^`. This means a path like `/evil/TASK_1234_001/session-analytics.md` would match. In practice this is not exploitable because the watcher emits real file-system paths only, and the file content is just a markdown table parsed into safe fields. Flagged for completeness.
- **Fix**: No functional fix required; purely cosmetic tightening: anchor with a path separator before the task ID segment if strict matching is desired.

### Minor 3: `getWorkerTree` propagates raw `label` field into `WorkerTreeNode.label` without sanitization

- **File**: `packages/dashboard-service/src/state/store.ts:448-458`
- `w.label` from the orchestrator state is stored as-is in the `WorkerTreeNode` and returned in the API response. `inferRole` lowercases and compares against known strings, which is safe. The `label` field itself is then rendered in `Squad.tsx` via `node.role` (which is the `inferRole` output, not `label`), so the raw label does not reach the DOM directly. No immediate risk.
- **Fix**: No immediate action required. Document that `label` is treated as opaque display data and must never be interpolated into paths or shell commands.

---

## Info

- **CORS handling for new routes**: Both new routes (`/api/tasks/:id/pipeline`, `/api/workers/tree`) are registered via `addRoute` and served through the central `createServer` handler which calls `sendJson`, which always includes `getCorsHeaders`. The allowlist-based CORS from the existing implementation correctly covers these routes without any change. PASS.
- **Markdown parsing injection**: The `SessionAnalyticsParser` parses a table into a `Record<string, string>` and stores the values as plain strings. No HTML or shell output is derived from these values. The `taskId` field is validated implicitly by `analytics.taskId` emptiness check in the file-router. No injection surface identified.
- **Path traversal in session-analytics parser**: The parser is only invoked when `canParse` returns true (path regex match). It extracts the task ID from the file path using the same regex, not from user input. No external input reaches `filePath`. PASS.
- **Static file path traversal**: The existing boundary check at `http.ts:181` — `!fullPath.startsWith(resolvedBase + '/')` — correctly prevents traversal. This check was in place before this task and is not modified. PASS.
- **`getSession` in client.ts**: Uses `encodeURIComponent(id)` before URL construction (client.ts:99). The new `getWorkerTree` and `getTaskPipeline` methods also validate with `TASK_ID_RE` on the client side. PASS.
