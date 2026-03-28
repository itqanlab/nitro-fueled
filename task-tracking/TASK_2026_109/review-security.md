# Security Review — TASK_2026_109

**Reviewer:** nitro-code-security-reviewer
**Date:** 2026-03-28
**Task:** API Contract Layer — OpenAPI Spec, Typed DTOs, Versioned Endpoints
**Commit reviewed:** `2f38d92 feat(dashboard-api): add Swagger, response envelope, versioning — TASK_2026_109`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH     | 1 |
| MEDIUM   | 2 |
| LOW      | 1 |
| INFO     | 2 |

Overall posture: **Needs fixes before merge.** The CRITICAL and HIGH findings must be addressed. The remaining findings are contextual to the dev-tool deployment model.

---

## Findings

### [CRITICAL] No runtime validation on `TaskIdParamDto` — path traversal risk

**File:** `apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts:11-18`

```typescript
export class TaskIdParamDto {
  @ApiProperty({
    pattern: '^TASK_\\d{4}_\\d{3}$',  // documentation only — NOT enforced at runtime
  })
  public readonly id!: string;
}
```

The `pattern` field inside `@ApiProperty` is Swagger documentation metadata only. It has **no runtime effect**. No `class-validator` decorators (`@IsString()`, `@Matches()`) are present, so any string — including path traversal sequences (`../../etc/passwd`), null bytes, or injection payloads — will pass through to controllers without validation.

Based on the task description (resolving tasks by ID to read files from `task-tracking/`), the task ID is used to construct filesystem paths. Without input validation, a malicious or malformed ID could escape the intended directory.

**Required fix:** Add `@IsString()` and `@Matches(/^TASK_\d{4}_\d{3}$/)` decorators from `class-validator`, and register `ValidationPipe` globally in `main.ts`.

---

### [HIGH] `class-validator` and `class-transformer` in `devDependencies` — validation inoperable in production

**File:** `apps/dashboard-api/package.json:20-24`

```json
"devDependencies": {
  "class-transformer": "^0.5.1",
  "class-validator": "^0.14.0",
  ...
}
```

`class-validator` and `class-transformer` are listed under `devDependencies`. NestJS's `ValidationPipe` (which enforces `@IsString()`, `@Matches()` etc.) requires both packages at runtime. In a production build (`npm install --omit=dev`), these packages will not be present, making the entire validation pipeline silently non-functional — no error, no warning, no enforcement.

This is a systemic vulnerability: even if the CRITICAL finding above is fixed by adding validation decorators, they will not run in production unless these packages are moved to `dependencies`.

**Required fix:** Move `class-validator` and `class-transformer` to `dependencies`.

---

### [MEDIUM] Filesystem paths exposed directly in API responses — information disclosure

**Files:**
- `apps/dashboard-api/src/app/dtos/responses/session.dto.ts:42-44`
- `apps/dashboard-api/src/app/dtos/responses/completion-report.dto.ts:36-47`

`SessionSummaryDto.path` exposes the raw filesystem path of the session directory:
```typescript
@ApiProperty({ example: 'task-tracking/sessions/SESSION_2026-03-15_10-30-00/' })
public readonly path!: string;
```

`CompletionReportDto.filesCreated` and `filesModified` expose internal source file paths:
```typescript
@ApiProperty({ example: ['src/app/auth.service.ts', 'src/app/auth.module.ts'] })
public readonly filesCreated!: ReadonlyArray<string>;
```

For a localhost-only dev tool, this is low-urgency. However, if the CORS policy is ever relaxed or the API is deployed externally, these fields reveal internal directory structure and could assist an attacker in building path traversal or directory enumeration attacks.

**Note:** This is a design concern rather than an imminent vulnerability given the current localhost-only deployment. No fix required now, but the architecture should be documented as intentionally exposing filesystem paths.

---

### [MEDIUM] Swagger UI accessible at `/api/docs` without authentication

**File:** `apps/dashboard-api/src/main.ts:47-49`

```typescript
SwaggerModule.setup('api/docs', app, document, { ... });
```

The Swagger UI is exposed at `/api/docs` with no authentication gate. It documents every endpoint, parameter shape, response structure, and tag. The current CORS policy restricts browser-based requests to `localhost`, but:
1. Non-browser HTTP clients (curl, Postman) are not bound by CORS.
2. If the CORS regex is ever broadened, the full API contract becomes publicly documented.

For a localhost dev tool, this is acceptable as-is. It is flagged for awareness.

**Recommendation:** If this API is ever deployed beyond localhost, add authentication (e.g., a bearer token checked via a guard) before the Swagger route.

---

### [LOW] CORS regex allows all ports on localhost — any local process can call the API

**File:** `apps/dashboard-api/src/main.ts:12-16`

```typescript
app.enableCors({
  origin: /^https?:\/\/localhost(:\d+)?$/,
  credentials: true,
});
```

The regex `^https?:\/\/localhost(:\d+)?$` allows any port on localhost (e.g., `http://localhost:3000`, `http://localhost:8080`). Any locally running web app can make credentialed cross-origin requests to the dashboard API. This is intentional for dev tooling but means any locally running malicious or compromised web app can read all task data.

This is expected and acceptable for a dev-only tool. Flagged for documentation purposes.

---

### [INFO] No authentication or authorization on any endpoints

**File:** `apps/dashboard-api/src/main.ts`

All endpoints are accessible without any authentication. The Swagger description itself notes this is a "read-only" internal dev-tool API. Given the localhost-only CORS restriction and the read-only nature of the data (task registry, session logs, analytics), this is a reasonable design decision for the current use case.

If this API ever gains write endpoints or is deployed beyond localhost, an authentication layer must be added.

---

### [INFO] No authentication on `ErrorEnvelopeFilter` (out-of-scope note)

**File:** `apps/dashboard-api/src/app/filters/error-envelope.filter.ts` (out of scope — noted only)

The `ErrorEnvelopeFilter` is registered globally in `main.ts` but is outside the review scope. If it leaks stack traces or internal exception messages in error responses, that would be an information disclosure risk. This should be reviewed separately.

---

## OWASP Coverage

| Category | Status |
|----------|--------|
| A01 Broken Access Control | No auth layer — acceptable for localhost dev tool |
| A02 Cryptographic Failures | N/A |
| A03 Injection | **CRITICAL** — `TaskIdParamDto` lacks runtime input validation; path traversal risk |
| A04 Insecure Design | MEDIUM — filesystem paths in API responses |
| A05 Security Misconfiguration | MEDIUM — Swagger UI unauthenticated; CORS open to all local ports |
| A06 Vulnerable Components | HIGH — `class-validator`/`class-transformer` in devDependencies |
| A07 Auth and Auth Failures | INFO — no auth (intentional for dev tool) |
| A08 Software Integrity Failures | N/A |
| A09 Logging Failures | N/A — `console.log` acceptable for dev tool |
| A10 SSRF | N/A — no outbound HTTP requests in scope |

---

## Required Actions Before Merge

1. **[CRITICAL]** Add `@IsString()` and `@Matches(/^TASK_\d{4}_\d{3}$/)` to `TaskIdParamDto.id` and register `ValidationPipe` globally in `main.ts`.
2. **[HIGH]** Move `class-validator` and `class-transformer` from `devDependencies` to `dependencies` in `package.json`.

All other findings are informational or deferred to a future hardening pass.
