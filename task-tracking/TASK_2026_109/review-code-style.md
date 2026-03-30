# Code Style Review — TASK_2026_109

**Reviewer:** nitro-code-style-reviewer
**Date:** 2026-03-28
**Scope:** API Contract Layer — OpenAPI Spec, Typed DTOs, Versioned Endpoints
**Overall Score:** 7/10
**Assessment:** PASS WITH FINDINGS

---

## Summary

The implementation is largely well-styled. Access modifiers are applied consistently, naming conventions are correct, imports are clean, and the barrel export strategy is coherent. Two convention violations require attention: `analytics.dto.ts` exceeds the file size limit, and multiple DTO fields use bare `string` where the project convention requires string literal unions for status/type/category fields.

---

## Findings

### SERIOUS — File size limit exceeded

**File:** `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts`
**Lines:** 288 (limit: 200)

Convention: *Services/repositories: max 200 lines.*

The file contains 9 DTO classes. At 288 lines it exceeds the 200-line limit by 44%. The natural split would be by concern:

- `analytics-cost.dto.ts` — `SessionCostPointDto`, `AnalyticsCostDataDto`
- `analytics-efficiency.dto.ts` — `EfficiencyPointDto`, `AnalyticsEfficiencyDataDto`
- `analytics-models.dto.ts` — `ModelUsagePointDto`, `AnalyticsModelsDataDto`
- `analytics-sessions.dto.ts` — `SessionAnalyticsDto`, `SessionComparisonRowDto`, `AnalyticsSessionsDataDto`

The barrel `responses/index.ts` already exports all 9 classes by name so the split would require no changes to consumers.

---

### SERIOUS — Bare `string` for union-eligible status/type/category fields

Convention: *String literal unions for status/type/category fields — never bare `string`.*

The following fields are described in their `@ApiProperty` docs as having a fixed set of values but are typed as `string`:

| File | Class | Field | Expected union |
|------|-------|-------|----------------|
| `responses/analytics.dto.ts:22` | `SessionAnalyticsDto` | `outcome` | `'COMPLETE' \| 'IMPLEMENTED' \| 'FAILED' \| 'STUCK'` |
| `responses/review.dto.ts:39` | `ReviewDataDto` | `reviewType` | `'logic' \| 'style' \| 'security'` (+ others) |
| `responses/review.dto.ts:50` | `ReviewDataDto` | `assessment` | `'PASS' \| 'FAIL'` |
| `responses/graph.dto.ts:37` | `GraphNodeDto` | `type` | should use `TaskType` enum or union |
| `responses/graph.dto.ts:43` | `GraphNodeDto` | `priority` | `'P1-High' \| 'P2-Medium' \| 'P3-Low'` |
| `responses/session.dto.ts:55` | `SessionSummaryDto` | `loopStatus` | `'running' \| 'paused' \| 'stopped'` |
| `responses/worker-tree.dto.ts:43` | `WorkerTreeNodeDto` | `workerType` | `'Build' \| 'Review'` |
| `responses/worker-tree.dto.ts:48` | `WorkerTreeNodeDto` | `status` | should use `WorkerStatus` enum if available |

Note: `GraphNodeDto.status` is correctly typed as `TaskStatus` (enum). The pattern of using enums for some fields and bare `string` for others is inconsistent within the same DTO file (`graph.dto.ts`).

---

### MODERATE — `as const` assertion in interceptor

**File:** `apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts:35`

```typescript
success: true as const,
```

Convention: *No `as` type assertions.*

The `ResponseEnvelope<T>` interface declares `readonly success: true` (literal type). TypeScript will widen `true` to `boolean` in an object literal unless constrained. While the intent is correct, the fix is to annotate the return type explicitly rather than using an assertion:

```typescript
map((data): ResponseEnvelope<T> => ({
  success: true,
  data,
  meta: { ... },
}))
```

With the explicit return type annotation TypeScript narrows the literal correctly without needing `as const`.

---

### MODERATE — `ResponseEnvelope<T>` interface not exported

**File:** `apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts:16-23`

The `ResponseEnvelope<T>` interface is defined at module scope but not exported. Any downstream code that needs to type-annotate a wrapped response cannot import this type. There is no corresponding `ResponseEnvelopeDto` in the interceptor file — the DTO barrel exports a `ResponseEnvelopeDto` from `common.dto`, but whether the two shapes are kept in sync is implicit rather than enforced.

The interface should either be exported or the interceptor should import and reuse the `ResponseEnvelopeDto` type from the DTOs barrel to make the contract explicit.

---

### MINOR — `class-validator` / `class-transformer` in `devDependencies`

**File:** `apps/dashboard-api/package.json:22-25`

```json
"devDependencies": {
  "class-transformer": "^0.5.1",
  "class-validator": "^0.14.0",
  ...
}
```

These packages are NestJS runtime dependencies for `ValidationPipe`. They are in `devDependencies`, which is consistent with the current code — none of the in-scope DTOs apply `class-validator` decorators and `ValidationPipe` is not configured in `main.ts`. However, the task acceptance criteria states *"All request/response shapes have typed DTO classes with validation"* — if `class-validator` decorators are added later (as they should be for `TaskIdParamDto`), this would break production because `devDependencies` are pruned in most deployment pipelines. The packages should move to `dependencies` at the same time validation is added.

---

## Observations (no convention violations)

- **Access modifiers** — All class members use `public readonly` consistently across all DTO files. ✓
- **No `any` type** — No explicit `any` found in any in-scope file. ✓
- **Named import style** — All `@nestjs/swagger` imports use named imports with no wildcard. ✓
- **File naming** — All files use kebab-case consistently. ✓
- **Barrel export consistency** — `responses/index.ts` uses only named exports (no wildcard) — avoids unintentional re-export surface. ✓
- **Unused parameters** — `_context` in `ResponseEnvelopeInterceptor.intercept` correctly prefixed with `_` to signal intentional non-use. ✓
- **Enum alignment** — `TaskStatus` used in `GraphNodeDto.status` and `WorkerHealth` used in `WorkerTreeNodeDto.health` are imported from their canonical sources. ✓
- **Controllers directory** — No files found under `apps/dashboard-api/src/app/controllers/`. Nothing to review.
- **`main.ts`** — Bootstrap code is clean. Error handler types unknown correctly as `unknown` at `:59`. Port parsing uses explicit radix `parseInt(..., 10)`. ✓

---

## Findings Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | SERIOUS | `responses/analytics.dto.ts` | 288 lines — exceeds 200-line limit; split into 4 files |
| 2 | SERIOUS | multiple DTOs (8 fields) | Bare `string` for fields with fixed value sets — use string literal unions or enums |
| 3 | MODERATE | `interceptors/response-envelope.interceptor.ts:35` | `as const` assertion — use explicit return type annotation instead |
| 4 | MODERATE | `interceptors/response-envelope.interceptor.ts:16` | `ResponseEnvelope<T>` not exported — prevents external type reuse |
| 5 | MINOR | `package.json` | `class-validator`/`class-transformer` in `devDependencies` — move to `dependencies` when validation is added |
