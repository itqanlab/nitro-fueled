# Security Review — TASK_2026_214

## Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 3                                    |
| Minor Issues     | 4                                    |
| Files Reviewed   | 14                                   |

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | No validation on `name`/`description`/`agentName` field length or character set in API DTOs or service layer |
| Path Traversal           | PASS   | DB path is hard-coded to `process.cwd()/.nitro/cortex.db`; no user-supplied path involved |
| Secret Exposure          | PASS   | No credentials, tokens, or API keys found in any in-scope file |
| Injection (shell/prompt) | PASS   | All DB queries use `better-sqlite3` parameterized prepared statements exclusively; no string concatenation in SQL |
| Insecure Defaults        | FAIL   | No authorization guard on any new API endpoint; error messages in HTTP 500 responses echo internal exception strings |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: No Authentication or Authorization on Any New Endpoint

- **File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts:272–385`
- **Problem**: Eight new endpoints are added with no `@UseGuards()` decorator, no JWT/session check, and no role check of any kind. Specifically:
  - `POST /api/dashboard/orchestration/custom-flows` — creates a flow record in the DB
  - `PUT /api/dashboard/orchestration/custom-flows/:id` — overwrites a flow record
  - `DELETE /api/dashboard/orchestration/custom-flows/:id` — permanently deletes a flow record
  - `PUT /api/dashboard/orchestration/custom-flows/:id/phases` — replaces phases array on a flow
  - `POST /api/dashboard/orchestration/tasks/:taskId/flow-override` — writes `custom_flow_id` into the `tasks` table
  - `DELETE /api/dashboard/orchestration/tasks/:taskId/flow-override` — clears `custom_flow_id` on any task
- **Impact**: Any unauthenticated actor with network access to the dashboard API port can create, modify, or delete custom flows and reassign the orchestration flow for any task without any credential. On a shared machine (or if the port is ever forwarded), this allows unauthorized mutation of pipeline configuration and task assignment data. The `DELETE /tasks/:taskId/flow-override` endpoint also implicitly confirms the existence of any task ID by returning 200 vs 404, enabling enumeration.
- **Fix**: Apply the same authentication guard used on other write endpoints in the dashboard module. If the dashboard is genuinely localhost-only and single-user, document this assumption in `orchestration.module.ts` and add an origin/IP guard at the NestJS middleware layer as a minimum control. The existing read-only endpoints share this gap — this issue predates TASK_2026_214 — but the new write endpoints add meaningful blast radius.

---

### Issue 2: Internal Exception Strings Leaked in HTTP 500 Responses

- **File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts:284–286, 293–295, 308–309, 320–322, 334–336, 349–351, 369–371, 382–384`
- **Problem**: Every catch block in the new endpoint handlers follows this pattern:
  ```
  throw new HttpException(`Failed to create custom flow: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
  ```
  `error.message` is the raw exception message from `better-sqlite3`, the Node.js fs module, or any other internal layer. Example messages include SQLite UNIQUE constraint text (which reveals column names and table names), `ENOENT` messages (which reveal the DB file path including `process.cwd()`), and TypeScript runtime errors.
- **Impact**: An attacker who deliberately triggers failures (e.g., POSTing a duplicate UUID or a DB-path manipulation) receives internal schema and file-system layout information in the response body, reducing the work needed to exploit other vulnerabilities. This is an information disclosure (OWASP A05).
- **Fix**: Log `error.message` server-side via the existing `Logger` instance and return a generic client-facing message: `"An internal error occurred. Check server logs."` The same pattern should be applied to the pre-existing `getFlows` and `getFlow` catch blocks which have the same leak (`error.message` in the 500 body).

---

### Issue 3: Unbounded Free-Text Fields Accepted Without Length Validation

- **File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts:272–287` (POST custom-flows), `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts:79–99` (create)
- **Problem**: `CreateCustomFlowDto` and `UpdateCustomFlowDto` (defined in `types.ts:189–200`) carry `name: string`, `description?: string`, and `phases` array where each phase has `agentName: string`, `agentTitle: string`, and `deliverables: string[]`. None of these fields have a maximum length constraint, a character-set constraint, or a maximum array cardinality. NestJS `ValidationPipe` is only applied to the `cloneFlow` endpoint via `@UsePipes(new ValidationPipe(...))` at line 223 — it is absent from all eight new endpoints. The `phases` array is serialized directly to SQLite via `JSON.stringify` without any size cap.
- **Impact**: A caller can submit a `name` of arbitrary length (megabytes), an arbitrarily deep `phases` array, or `agentName` strings containing control characters, nulls, or Unicode manipulation characters. This creates a denial-of-service vector by bloating the SQLite `phases_json` column without limit. Strings with embedded newlines or control characters stored in `agentName`/`agentTitle` are reflected back in API GET responses and consumed by the Angular frontend without escaping in Angular's text interpolation — this is safe for Angular `{{ }}` bindings but becomes a risk if these values are ever used in a `[innerHTML]` binding or passed to a non-Angular render context.
- **Fix**: Add `class-validator` decorators (`@IsString()`, `@MaxLength(256)`, `@ArrayMaxSize(50)`) to `CreateCustomFlowDto` and `UpdateCustomFlowDto`, and apply `@UsePipes(new ValidationPipe({ whitelist: true }))` to all new endpoint handlers. In the service layer, add a `phasesJson.length` guard before the INSERT (e.g., reject if serialized phases exceed 64 KB).

---

## Minor Issues

### Minor 1: Dangling Foreign Key on Task Delete

- **File**: `packages/mcp-cortex/src/db/schema.ts:127–136` (CUSTOM_FLOWS_TABLE) and noted in `task-tracking/TASK_2026_214/handoff.md:71`
- **Problem**: The `custom_flow_id` column on `tasks` does not carry `REFERENCES custom_flows(id) ON DELETE SET NULL`. Deleting a custom flow leaves existing tasks with a stale `custom_flow_id` pointing at a non-existent row. The FK is not enforced at the schema level (it is only an `ALTER TABLE ... ADD COLUMN custom_flow_id TEXT` without a REFERENCES clause).
- **Impact**: Stale FKs produce silent no-ops when the orchestration engine tries to look up the assigned flow for a task. No data corruption, but a latent logical integrity hole.
- **Fix**: Either add `REFERENCES custom_flows(id) ON DELETE SET NULL` to the column migration DDL, or add a pre-delete check in `CustomFlowsService.delete()` that clears all referencing task rows in a transaction before deleting the flow.

---

### Minor 2: `flowId` Passed to DB Without Format Validation in `setTaskFlowOverride`

- **File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts:356–371`
- **Problem**: The `flowId` field from the request body is passed directly to `customFlowsService.setTaskFlowOverride(taskId, req.flowId)` without verifying it is a valid UUID or that a row with that ID actually exists in `custom_flows`. The service performs a raw `UPDATE tasks SET custom_flow_id = ?` — if the supplied `flowId` is a valid string but references no flow, the task silently ends up with a broken assignment. The check `if (!req.flowId)` at line 359 only guards against empty string, not malformed values.
- **Impact**: A caller can assign any arbitrary string as `custom_flow_id` on any task (subject to Issue 1). No SQL injection (parameterized statement), but logical integrity is bypassed.
- **Fix**: Add a `customFlowsService.findOne(req.flowId)` existence check before calling `setTaskFlowOverride`, and return HTTP 422 Unprocessable Entity if the flow does not exist. Optionally, validate that `req.flowId` matches the UUID pattern.

---

### Minor 3: `taskId` Route Parameter Not Pattern-Validated

- **File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts:356, 373`
- **Problem**: `@Param('taskId') taskId: string` is used directly in DB queries with no format guard. While `better-sqlite3` parameterized queries prevent SQL injection, an unusually long or specially formed `taskId` (e.g., containing null bytes or control characters) is stored in `custom_flow_id` on the tasks row without sanitization.
- **Impact**: Low probability but could cause downstream confusion in display or logging contexts. Consistent with the project's existing pattern of validating task IDs before use (per `security.md` rule added in TASK_2026_037 and TASK_2026_060).
- **Fix**: Validate `taskId` against the canonical pattern `/^TASK_\d{4}_\d{3}$/` and return HTTP 400 for non-matching values, consistent with the pattern already documented in `.claude/review-lessons/security.md`.

---

### Minor 4: `console.warn` Leaks Task ID and API Error Detail to Browser Console

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:172`
- **Problem**: `console.warn('[TaskDetail] flow override update failed:', err)` logs the full error object (which may include the HTTP response body, including any internal message — see Issue 2) to the browser console. In a production SPA this exposes API error messages to any user who opens DevTools, and also leaks the task ID in the log prefix format.
- **Impact**: Minor information disclosure in the browser console; not directly exploitable but compounds the information disclosure risk from Issue 2.
- **Fix**: Remove the task ID from the log prefix or replace `console.warn` with a user-visible error state signal rather than a console log.

---

## Verdict

| Verdict | Result |
|---------|--------|
| Recommendation | REVISE |
| Confidence | HIGH |
| Top Risk | No authorization guard on write endpoints (Issue 1) — any unauthenticated caller can create, modify, or delete flow records and reassign task flow overrides |
