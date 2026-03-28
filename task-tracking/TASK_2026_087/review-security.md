# Security Review — TASK_2026_087

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Commit:** `5538b3b feat(dashboard-api): migrate state services and REST controllers to NestJS`

---

## Overall Assessment

**PASS WITH FINDINGS** — No critical vulnerabilities. The implementation is a read-only, internal dev-tool dashboard with no mutation endpoints. The primary security concerns are lack of authentication, inconsistent input validation on URL parameters, and a type-safety bypass that reaches external data. All findings are contained and low-blast-radius given the deployment context.

**Blocking issues:** 0
**Serious:** 1
**Moderate:** 2
**Minor:** 4

---

## Findings

### [SERIOUS-1] No authentication on any REST endpoint

**File:** `apps/dashboard-api/src/dashboard/dashboard.controller.ts` — all routes
**Description:** Every endpoint under `@Controller('api')` is unauthenticated. Any process that can reach the NestJS server's port can read the full task registry, orchestrator state, session analytics including cost data, and session logs.
**Risk:** If the dashboard API port is reachable beyond localhost (e.g., in a container environment, CI runner, or misconfigured bind address), task data and cost analytics are exposed to anyone on the network.
**Note:** This may be intentional for a local-only dev tool. If the server always binds to `127.0.0.1` and is never exposed externally, this is acceptable. Document the assumption; do not deploy on a non-loopback interface without adding auth.

---

### [MODERATE-1] Unsafe `as unknown as Record<string, unknown>` cast on external data

**File:** `apps/dashboard-api/src/dashboard/pipeline.service.ts:237-244`
```typescript
const workerAny = worker as unknown as Record<string, unknown>;
const cost = typeof workerAny['cost'] === 'number' ? workerAny['cost'] : 0;
```
**Description:** `ActiveWorker` (from `dashboard.types.ts`) does not have `cost`, `tokens`, or `model` fields. The code casts to `Record<string, unknown>` to access these runtime properties that are absent from the type. This is a deliberate `any` escape hatch that bypasses type safety on data that originates from the orchestrator state file (external input parsed and stored by the watcher/parser pipeline).
**Risk:** If the upstream orchestrator state file is malformed or contains adversarially crafted values at these keys, the cast prevents the type system from catching it. The only downstream effect is incorrect stats values (`totalCost`, `totalTokens`), but it demonstrates that the type contract is wrong — the actual runtime shape of `ActiveWorker` is not captured in the type definition.
**Recommendation:** Add `cost?: number; tokens?: number; model?: string` to the `ActiveWorker` interface in `dashboard.types.ts` (which is in scope), or remove the dead aggregation block if the fields are never populated.

---

### [MODERATE-2] Inconsistent URL parameter validation — task ID not validated in two endpoints

**File:** `apps/dashboard-api/src/dashboard/dashboard.controller.ts:68-79`
```typescript
@Get('tasks/:id')
public getTask(@Param('id') id: string): ...  // No format validation

@Get('tasks/:id/reviews')
public getTaskReviews(@Param('id') id: string): ...  // No format validation

@Get('tasks/:id/pipeline')
public getTaskPipeline(@Param('id') id: string): ... {
  if (!/^TASK_\d{4}_\d{3}$/.test(id)) {         // ← validated here only
    throw new BadRequestException(...);
```
**Description:** `/tasks/:id/pipeline` validates that `:id` matches `TASK_\d{4}_\d{3}`, but `/tasks/:id` and `/tasks/:id/reviews` accept arbitrary strings. The raw, unvalidated user-supplied ID is then reflected verbatim in the `NotFoundException` error message: `Task ${id} not found`.
**Risk:** Currently low — the services use the ID only as a Map key (no file I/O). However, the reflected ID in error messages constitutes minor information leakage, and the inconsistency means a future refactor adding file-path construction could silently introduce path traversal. Standardise validation across all three endpoints.

---

### [MINOR-1] `readTextFile` silently discards all errors without logging

**File:** `apps/dashboard-api/src/dashboard/analytics.service.ts:69-75`
```typescript
private async readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;   // ← no logging
  }
}
```
**Description:** Any file read failure — permission denied, disk error, unexpected exception — returns `null` silently. The caller treats `null` as "file does not exist" and skips the session, potentially masking permission issues or storage errors that should be visible in logs.
**Recommendation:** Log at `warn` level (not `error`, since missing optional files are expected) before returning `null`.

---

### [MINOR-2] Session ID reflected verbatim in 404 response

**File:** `apps/dashboard-api/src/dashboard/dashboard.controller.ts:137-140`
```typescript
@Get('sessions/:id')
public getSession(@Param('id') id: string): ... {
  if (!data) throw new NotFoundException({ error: `Session ${id} not found` });
```
**Description:** The raw URL parameter `:id` is embedded directly into the error response body without sanitization. For an internal tool this is low risk, but it establishes a pattern of reflecting unsanitized user input in responses. The same pattern exists at line 72 for task IDs.
**Recommendation:** Use a generic message (`Session not found`) or validate/sanitize the ID before embedding it in response messages.

---

### [MINOR-3] `process.cwd()` evaluated at module-init time as file-system root

**File:** `apps/dashboard-api/src/dashboard/dashboard.module.ts:18-20`
```typescript
{
  provide: AnalyticsService,
  useFactory: () => new AnalyticsService(process.cwd()),
}
```
**File:** `apps/dashboard-api/src/dashboard/watcher.service.ts:21`
```typescript
const taskTrackingPath = join(process.cwd(), 'task-tracking');
```
**Description:** Both `AnalyticsService` and `WatcherService` root their file system access at `process.cwd()`. The working directory is an implicit, environment-level configuration value — not an explicit, validated config. If the process is started from an unexpected directory, these services silently watch or read the wrong path with no error.
**Risk:** Low for local dev use. Becomes higher risk if the service is run in a container or CI where `cwd` is not the repo root.
**Recommendation:** Make `projectRoot` an explicit NestJS `ConfigService` value (e.g. `PROJECT_ROOT` env var with a validated fallback) rather than relying on `process.cwd()`.

---

### [MINOR-4] Chokidar watcher `ignoreInitial: false` triggers bulk file events on startup

**File:** `apps/dashboard-api/src/dashboard/watcher.service.ts:58-66`
```typescript
const watcher = watch(directory, {
  ignoreInitial: false,   // ← all existing files emit 'add' on startup
  ...
```
**Description:** With `ignoreInitial: false`, every existing file under `task-tracking/` emits an `'add'` event when the watcher starts. If there are hundreds of task files and a downstream handler is expensive or logs verbosely, this creates a burst of activity on every cold start.
**Risk:** No security vulnerability, but it is a denial-of-service amplifier if downstream handlers perform I/O. Worth flagging given the task-tracking directory can grow large over time.
**Recommendation:** Change to `ignoreInitial: true` unless initial file discovery is required for correctness.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `dashboard.types.ts` | 359 | Clean — pure type definitions, no runtime risk |
| `sessions.service.ts` | 134 | Clean — in-memory store, no I/O |
| `analytics.service.ts` | 280 | 1 minor (silent error swallow) |
| `pipeline.service.ts` | 681 | 1 moderate (unsafe cast) |
| `watcher.service.ts` | 88 | 1 minor (ignoreInitial) |
| `dashboard.controller.ts` | 177 | 1 serious (no auth), 1 moderate (param validation), 1 minor (ID reflection) |
| `dashboard.module.ts` | 25 | 1 minor (process.cwd reliance) |

---

## OWASP Coverage

| Category | Finding |
|----------|---------|
| A01 Broken Access Control | SERIOUS-1 — no auth on any endpoint |
| A03 Injection | MODERATE-1 — type cast bypass on external data |
| A05 Security Misconfiguration | MINOR-3 — implicit cwd dependency |
| A09 Logging Failures | MINOR-1 — silent error discard in readTextFile |
| A10 SSRF / Path Traversal | Not applicable — no user-controlled file paths |
