# Security Review — TASK_2026_145

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 6                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | Task/session ID params on cortex endpoints have no format guard; filter query params have no allowlist |
| Path Traversal           | PASS   | DB path is fully static (`process.cwd() + /.nitro/cortex.db`); no user-controlled path segments |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys in any reviewed file |
| Injection (shell/prompt) | PASS   | All SQL uses parameterized queries with `?` placeholders; no string-concatenated user input; no shell calls |
| Insecure Defaults        | FAIL   | No LIMIT on bulk queries; full `CortexEvent.data` payload broadcast over WebSocket without filtering |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: No format validation on task/session ID path params for cortex endpoints

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:310,328,361`
- **Problem**: The three cortex endpoints that accept `/:id` path parameters — `GET /cortex/tasks/:id` (line 310), `GET /cortex/tasks/:id/trace` (line 328), and `GET /cortex/sessions/:id` (line 361) — accept any arbitrary string and pass it directly to `CortexService` methods, which forward it as a parameterized SQL bind value. The existing file-system task endpoints (`/api/v1/tasks/:id`) correctly apply `TASK_ID_RE` (`/^TASK_\d{4}_\d{3}$/`) before proceeding, but this guard was not applied to the new cortex endpoints.
- **Impact**: SQL injection is blocked by parameterized queries, so there is no injection risk. However: (a) an arbitrarily long task ID string (e.g., 10 MB) will be materialized in memory and forwarded to SQLite with no length cap, creating a potential DoS vector; (b) the inconsistency means any future code path that adds file-system operations using the same `id` parameter (e.g., reading `task-tracking/{id}/...`) would be unguarded from the moment it is written, since reviewers will assume the controller validated the format. The prior security lesson (TASK_2026_143) explicitly requires that task IDs used for path construction be validated at the controller boundary, not at the point of first fs use.
- **Fix**: Add `if (!TASK_ID_RE.test(id)) throw new BadRequestException(...)` guards to `getCortexTask`, `getCortexTaskTrace`. For `getCortexSession`, define a session ID regex (e.g., `/^SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/`) and apply it before the service call.

### Issue 2: Unvalidated filter query parameters passed to SQL queries

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:292-300,381-390`
- **Problem**: `GET /cortex/tasks?status=&type=` and `GET /cortex/workers?sessionId=&status=` accept NestJS `@Query()` parameters as raw `string | undefined` and forward them without any validation to `CortexService.getTasks()` / `CortexService.getWorkers()`. These values are passed as SQL bind parameters (parameterized — no injection risk), but there is no length cap and no allowlist for `status` or `type`, which are clearly bounded enum values. A caller can supply a 1 MB string for `status` and it will be sent to the DB engine.
- **Impact**: Minor resource amplification vector. More practically, it violates the defense-in-depth pattern already established for every other controller parameter in this file. The pattern risk (a future developer adding a non-parameterized use of the same filter value) is the larger concern.
- **Fix**: Apply `.trim()` and a max-length check (e.g., 64 characters) on each query param before use. For `status` and `type`, consider a `z.enum()` or explicit allowlist check matching the canonical cortex status values. For `sessionId`, apply the session ID regex.

## Minor Issues

- **Unbounded result sets on bulk queries** — `apps/dashboard-api/src/dashboard/cortex-queries-task.ts:89-103` and `cortex-queries-worker.ts:81-96`: `queryTasks()` and `queryWorkers()` have no LIMIT clause. For a local dev tool with hundreds of tasks this is acceptable, but if the cortex DB grows to thousands of records a single API call materializes the entire table into memory. A defensive `LIMIT 5000` (or configurable via query param) would bound memory usage. Not exploitable in the current deployment model but worth tracking.

- **Full `CortexEvent.data` payload broadcast to all WebSocket subscribers without any field filtering** — `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:175`: `this.server.emit('cortex-event', event)` broadcasts the entire `CortexEvent` object, including `data: Record<string, unknown>`, which is deserialized from the `events.data` DB column. The `data` column is written by internal pipeline workers and is not expected to contain secrets in normal operation, but there is no explicit stripping. If a worker ever logs a sensitive value (API key, token) into an event's `data` field, it will be pushed to every connected WebSocket client. For this local-only dev tool the risk is low, but worth noting as the events surface expands.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Missing input validation on cortex `:id` path parameters — while SQL injection is neutralized by parameterized queries, the absence of a format guard is an inconsistency with the established pattern for identical endpoints in the same controller, and creates an unguarded entry point if file-system path construction is ever added to these code paths.
