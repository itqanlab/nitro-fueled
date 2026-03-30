# Code Logic Review — TASK_2026_109

**Reviewer:** nitro-code-logic-reviewer
**Date:** 2026-03-28
**Task:** API Contract Layer — OpenAPI Spec, Typed DTOs, Versioned Endpoints

## Summary

| Metric | Value |
|--------|-------|
| Files Reviewed | 16 |
| Critical Issues | 1 |
| Serious Issues | 2 |
| Moderate Issues | 2 |
| Minor Issues | 2 |
| Overall Score | 7/10 |
| Assessment | PASS WITH FINDINGS |

## Critical Issues

### 1. TaskIdParamDto has no runtime validation (request-dto-no-validation)

**File:** `apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts:11-18`

The task acceptance criteria states "All request/response shapes have typed DTO classes with validation", but `TaskIdParamDto` only has `@ApiProperty` decorators — no `class-validator` decorators.

```typescript
export class TaskIdParamDto {
  @ApiProperty({
    pattern: '^TASK_\\d{4}_\\d{3}$',  // <-- This is documentation only, NOT enforced
  })
  public readonly id!: string;
}
```

**Impact:** The pattern `^TASK_\d{4}_\d{3}$` is NOT enforced at runtime. Invalid task IDs (e.g., `../../etc/passwd`, arbitrary strings) will pass through to controllers and services, potentially causing parsing errors, file system access issues, or unexpected behavior downstream.

**Required fix:** Add class-validator decorators:
```typescript
import { IsString, Matches } from 'class-validator';

export class TaskIdParamDto {
  @ApiProperty({ ... })
  @IsString()
  @Matches(/^TASK_\d{4}_\d{3}$/, { message: 'taskId must match TASK_YYYY_NNN format' })
  public readonly id!: string;
}
```

Additionally, ensure `ValidationPipe` is registered globally in `main.ts`.

---

## Serious Issues

### 2. class-validator in devDependencies (package-json-dep-category)

**File:** `apps/dashboard-api/package.json:22-23`

```json
"devDependencies": {
  "class-transformer": "^0.5.1",
  "class-validator": "^0.14.0",
  ...
}
```

`class-validator` and `class-transformer` are runtime validation libraries. If DTOs use these decorators for request validation (which they should per acceptance criteria), these must be in `dependencies`, not `devDependencies`.

**Impact:** Production builds that prune devDependencies will fail at runtime when ValidationPipe attempts to use class-validator.

---

### 3. DTO fields use bare strings instead of available enums (type-looseness)

Multiple DTOs use `string` types where explicit enums exist and should be used for type safety and API contract consistency.

| File | Field | Current Type | Should Be |
|------|-------|--------------|-----------|
| `graph.dto.ts:36` | `type` | `string` | `TaskType` |
| `graph.dto.ts:43` | `priority` | `string` | `TaskPriority` |
| `worker-tree.dto.ts:42` | `workerType` | `string` | `WorkerType` |
| `worker-tree.dto.ts:48` | `status` | `string` | `WorkerStatus` |
| `session.dto.ts:55` | `loopStatus` | `string` | enum (running/paused/stopped) |
| `analytics.dto.ts:22` | `outcome` | `string` | enum (COMPLETE/IMPLEMENTED/FAILED/STUCK) |
| `review.dto.ts:39` | `reviewType` | `string` | enum (logic/style/security/etc.) |
| `review.dto.ts:50` | `assessment` | `string` | enum (PASS/FAIL/etc.) |

**Impact:**
- API consumers cannot rely on the OpenAPI spec to know valid values
- No compile-time safety if services return invalid strings
- Inconsistent with `status` field in `GraphNodeDto` which correctly uses `TaskStatus` enum

---

## Moderate Issues

### 4. PORT parsing has no NaN guard (env-parsing)

**File:** `apps/dashboard-api/src/main.ts:51`

```typescript
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 0;
```

If `PORT` is set to a non-numeric value (e.g., `PORT=abc`), `parseInt()` returns `NaN`. Passing `NaN` to `app.listen()` may cause unpredictable behavior.

**Suggested fix:**
```typescript
const portEnv = process.env['PORT'];
const port = portEnv ? parseInt(portEnv, 10) : 0;
if (Number.isNaN(port)) {
  console.error('[dashboard-api] Invalid PORT value, using random port');
}
```

---

### 5. analytics.dto.ts exceeds 200-line file limit (file-size)

**File:** `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts` (288 lines)

Per project conventions, DTO/service files should be max 200 lines. This file contains 9 DTO classes and could be split:
- `session-analytics.dto.ts` — SessionAnalyticsDto
- `cost-analytics.dto.ts` — SessionCostPointDto, AnalyticsCostDataDto
- `efficiency-analytics.dto.ts` — EfficiencyPointDto, AnalyticsEfficiencyDataDto
- `model-usage.dto.ts` — ModelUsagePointDto, AnalyticsModelsDataDto
- `session-comparison.dto.ts` — SessionComparisonRowDto, AnalyticsSessionsDataDto

---

## Minor Issues

### 6. Hardcoded version in multiple locations (maintainability)

**Files:**
- `main.ts:39` — `version: 'v1'` in ResponseEnvelopeInterceptor
- `main.ts:30` — `.setVersion('1.0')` in DocumentBuilder

The API version string appears in two places. Consider extracting to a constant:
```typescript
const API_VERSION = 'v1';
```

---

### 7. ResponseEnvelope interface not exported (internal-type)

**File:** `apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts:16-23`

The `ResponseEnvelope<T>` interface is defined inline but not exported. If clients need to reference the envelope shape (e.g., for testing), they cannot import it.

**Note:** This may be intentional — the envelope shape is implicit from usage. Flag as informational.

---

## Out of Scope Observations

The following issues were noted but are outside the review scope:

1. **ErrorEnvelopeFilter** (`./app/filters/error-envelope.filter.ts`) is imported in `main.ts` but not in scope. Cannot verify error handling logic.

2. **Controllers** are listed in scope but the `controllers/` directory is empty — OpenAPI decorators must be on controllers elsewhere (likely `dashboard.controller.ts` in a different path).

---

## Verification Checklist

- [x] No `any` types
- [x] No type assertions (except `true as const` — acceptable for literal types)
- [x] No unused imports
- [x] No incomplete implementations or stubs
- [x] All DTOs have `public readonly` access modifiers
- [x] Recursive type (WorkerTreeNodeDto.children) correctly handled with lazy type function
- [x] Nullable fields properly typed with `| null` and `@ApiPropertyOptional`
- [ ] Request DTOs have class-validator decorators — **FAIL** (TaskIdParamDto)
- [ ] String fields use enums where enums exist — **PARTIAL** (some use enums, some don't)
- [ ] File size within limits — **FAIL** (analytics.dto.ts)

---

## Recommendations

1. **Immediate:** Add class-validator decorators to `TaskIdParamDto` and any other request DTOs
2. **Immediate:** Move `class-validator` and `class-transformer` to `dependencies`
3. **Immediate:** Register `ValidationPipe` globally in `main.ts` to activate validation
4. **Before merge:** Replace bare `string` types with available enums in DTOs
5. **Before merge:** Split `analytics.dto.ts` into smaller focused files

---

**Report generated by:** nitro-code-logic-reviewer
**Files reviewed:** 16 in scope
