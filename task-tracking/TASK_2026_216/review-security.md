# Security Review — TASK_2026_216

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 2                                    |
| Files Reviewed   | 5                                    |

Files reviewed:
- `apps/dashboard-api/src/analytics/analytics.dto.ts`
- `apps/dashboard-api/src/analytics/analytics.service.ts`
- `apps/dashboard-api/src/analytics/analytics.controller.ts`
- `apps/dashboard-api/src/analytics/analytics.module.ts`
- `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts` (supporting verification)

`apps/dashboard-api/src/dashboard/cortex.service.ts` and `apps/dashboard-api/src/app/auth/http-auth.guard.ts` were read for context only — issues in those files are out of scope and not flagged.

---

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | No format validation on `modelId`, `launcherId`, or `taskType` params; no `class-validator` constraints |
| Path Traversal           | PASS   | User inputs never touch file paths; they are passed only to parameterized SQLite queries and in-memory filters |
| Secret Exposure          | PASS   | No hardcoded credentials, tokens, or API keys in any of the four analytics files |
| Injection (shell/prompt) | FAIL   | `modelId` and `launcherId` are interpolated verbatim into `logger.warn` calls — log injection vector present |
| Insecure Defaults        | PASS   | DB opened readonly; `AnalyticsModule` correctly inherits the global `APP_GUARD`; 503 response body is a static string |

---

## Critical Issues

No critical issues found.

---

## Serious Issues

### Issue 1: Log Injection via Unvalidated URL Parameters

- **File**: `apps/dashboard-api/src/analytics/analytics.controller.ts:39` and `:54`
- **Problem**: `modelId` and `launcherId` are received from route parameters and interpolated directly into `logger.warn` template strings with no sanitization, length cap, or character-set check:
  ```
  this.logger.warn(`getModelPerformanceById(${modelId}): cortex DB unavailable`);
  this.logger.warn(`getLauncherMetrics(${launcherId}): cortex DB unavailable`);
  ```
  An attacker can supply a value containing newlines (`%0A`), CRLF sequences, or ANSI escape codes. On systems where application logs are collected by a log aggregator, newline injection can forge entirely new log lines (log forging). ANSI escape sequences can corrupt terminal output.
- **Impact**: Log forging under conditions where the 503 path is triggered (DB unavailable). The attack requires the cortex DB to be offline, which limits probability, but the attack surface exists unconditionally. Severity is bounded by the fact that these logs are operational, not security audit logs.
- **Fix**: Sanitize the parameter before logging. A simple approach: strip non-printable characters and cap to 200 characters before interpolation — consistent with the established cap rule in `.claude/review-lessons/security.md`. For example:
  ```typescript
  const safeId = modelId.replace(/[^\x20-\x7E]/g, '').slice(0, 200);
  this.logger.warn(`getModelPerformanceById(${safeId}): cortex DB unavailable`);
  ```

### Issue 2: No Input Format Validation on Route/Query Parameters

- **File**: `apps/dashboard-api/src/analytics/analytics.controller.ts:21,36,49`
- **Problem**: `modelId`, `launcherId`, and `taskType` are accepted as raw unbounded strings with no format constraints. There are no `class-validator` decorators (e.g., `@IsString()`, `@Matches()`, `@MaxLength()`) on request parameter DTOs. NestJS requires a `ValidationPipe` applied to `@Param()` and `@Query()` to enforce such constraints, which requires the parameters to be wrapped in a validated DTO class.
  - `taskType` has no allowlist (valid values appear to be `FEATURE`, `BUGFIX`, etc.).
  - `modelId` and `launcherId` have no max-length or character-set constraint.
  - Payloads are safely parameterized before reaching SQLite (no SQL injection risk), but the absence of validation means any content can be submitted and will flow through the application silently.
- **Impact**: Without format validation, oversized strings can create large log entries, and arbitrary Unicode values can reach the response JSON. The DB parameterization limits the exploit surface for SQL injection, but the pattern violates defense-in-depth and would allow invalid inputs to consume server resources on other code paths in the future.
- **Fix**: Add a validated query/param DTO using `class-validator`. At minimum:
  - `modelId` and `launcherId`: `@IsString() @MaxLength(128) @Matches(/^[a-zA-Z0-9._:-]+$/)` (adjust pattern to match known model/launcher naming conventions)
  - `taskType`: `@IsOptional() @IsEnum(TaskType)` using the existing `TaskType` enum from `apps/dashboard-api/src/app/dtos/enums/task.enums.ts`
  - Enable `ValidationPipe` globally or per-parameter to enforce these at runtime.

---

## Minor Issues

### Minor 1: Unbounded Result Sets — No LIMIT on Analytics Queries

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts:154–206` (called via `CortexService.getModelPerformance`)
- The `queryModelPerformance` function has no `LIMIT` clause. For a long-running deployment with many tasks, models, and task types, this could return a very large result set, loading it entirely into memory in the NestJS process.
- This is an operational concern rather than an exploitable vulnerability, but under adversarial conditions (e.g., a deployment where the DB has been seeded with many distinct model/task combinations) it could be used to degrade availability.
- **Fix**: Add a configurable `LIMIT` (e.g., 1000 rows) and document it as an accepted ceiling.

### Minor 2: Auth Guard Exempt-Path List Does Not Include Analytics Routes, but This Is Correct

- `EXEMPT_PATH_PREFIXES` in `HttpAuthGuard` does not include any `/api/analytics` path. The guard is registered as `APP_GUARD`, so all analytics endpoints are protected by default. This is the correct posture and is not a defect.
- Noted here because the absence of analytics in the exempt list is intentional and should be preserved — a future developer adding analytics to the exempt list to facilitate UI development would bypass auth for all analytics data.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Log injection via raw URL parameters interpolated into `logger.warn` (controller lines 39 and 54). The parameterized SQLite queries prevent SQL injection, and the global `HttpAuthGuard` is correctly applied, so the exploit surface is meaningful but bounded. The two serious issues are straightforward to fix.
