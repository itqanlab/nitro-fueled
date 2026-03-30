# Review Context — TASK_2026_109

## Task Scope
- Task ID: 2026_109
- Task type: FEATURE
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - apps/dashboard-api/src/main.ts
  - apps/dashboard-api/src/app/dtos/
  - apps/dashboard-api/src/app/controllers/
  - apps/dashboard-api/src/app/interceptors/
  - apps/dashboard-api/package.json

## Git Diff Summary
Implementation commit: `2f38d92 feat(dashboard-api): add Swagger, response envelope, versioning — TASK_2026_109`

### Files Changed

| File | Change |
|------|--------|
| `apps/dashboard-api/package.json` | Added `build:spec` script for OpenAPI spec generation |
| `apps/dashboard-api/src/main.ts` | Added Swagger/OpenAPI setup, URI versioning, global interceptor, global error filter |
| `apps/dashboard-api/src/app/dtos/index.ts` | Barrel export for all DTOs (new file) |
| `apps/dashboard-api/src/app/dtos/requests/index.ts` | Barrel export for request DTOs (new file) |
| `apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts` | `TaskIdParamDto` with `@ApiProperty` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts` | Analytics DTOs: Session, Cost, Efficiency, ModelUsage, Comparison (287 lines, new file) |
| `apps/dashboard-api/src/app/dtos/responses/anti-patterns.dto.ts` | `AntiPatternRuleDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/completion-report.dto.ts` | `ReviewScoreDto`, `CompletionReportDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/full-task.dto.ts` | `FullTaskDataDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/graph.dto.ts` | `GraphNodeDto`, `GraphEdgeDto`, `GraphDataDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/index.ts` | Extended barrel exports with 13 new DTO exports |
| `apps/dashboard-api/src/app/dtos/responses/lessons.dto.ts` | `LessonEntryDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/review.dto.ts` | `ReviewFindingDto`, `ReviewDataDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/session.dto.ts` | `SessionSummaryDto`, `SessionDataDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/stats.dto.ts` | `DashboardStatsDto` (new file) |
| `apps/dashboard-api/src/app/dtos/responses/worker-tree.dto.ts` | `WorkerTreeNodeDto`, `WorkerTreeDto` (new file) |
| `apps/dashboard-api/src/app/interceptors/response-envelope.interceptor.ts` | `ResponseEnvelopeInterceptor` — wraps all responses in `{success, data, meta}` (new file) |

### Key Changes Description

**main.ts:**
- Enables URI versioning (`/api/v1/...`) via `VersioningType.URI`
- Registers `ResponseEnvelopeInterceptor` globally
- Registers `ErrorEnvelopeFilter` globally (imported from `./app/filters/error-envelope.filter` — this file is NOT in scope but is referenced from main.ts)
- Configures Swagger UI at `/api/docs` with `DocumentBuilder` and 9 API tags

**Response Envelope Interceptor (`response-envelope.interceptor.ts`):**
- Implements `NestInterceptor<T, ResponseEnvelope<T>>`
- Uses inline interface `ResponseEnvelope<T>` (not exported)
- Wraps responses in `{success: true, data, meta: {timestamp, version: 'v1'}}`
- `success` is typed as `true as const` (literal type)

**DTOs — general pattern:**
- All DTO classes use `public readonly` members with `!` (definite assignment assertion)
- `@ApiProperty` / `@ApiPropertyOptional` decorators on all fields
- No class-validator decorators present (only Swagger decorators — no runtime validation on request bodies)
- `TaskIdParamDto` has no `@IsString()` / `@Matches()` validators — only `@ApiProperty` with a `pattern` hint

**analytics.dto.ts (287 lines — EXCEEDS file size limit of 200 lines):**
- Contains 9 DTO classes: SessionAnalyticsDto, SessionCostPointDto, EfficiencyPointDto, ModelUsagePointDto, SessionComparisonRowDto, AnalyticsCostDataDto, AnalyticsEfficiencyDataDto, AnalyticsModelsDataDto, AnalyticsSessionsDataDto

## Project Conventions

From `CLAUDE.md`:
- Git: conventional commits with scopes
- No business logic in Angular app — frontend is presentation layer only
- Dashboard API is the source of truth, Angular is a client

TypeScript Conventions (from review-general.md):
- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare.
- **No `any` type ever** — use `unknown` + type guards, or proper generics.
- **No `as` type assertions** — use type guards or generics.
- **String literal unions** for status/type/category fields — never bare `string`.
- **No unused imports or dead code**
- **File size limits**: Services/repositories: max 200 lines. Spec files: max 300 lines.
- `tsconfig.json` must not disable `noImplicitAny` or `strictNullChecks`

NestJS/API Conventions:
- All endpoints must have OpenAPI decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- Typed DTOs for every request body and response
- API versioned under `/api/v1/`
- Standardized response envelope for all endpoints

## Style Decisions from Review Lessons

From `.claude/review-lessons/review-general.md`:
- **Explicit access modifiers** — all DTO class members should have `public readonly`. Present in this implementation. ✓
- **File size limits** — `analytics.dto.ts` at 287 lines exceeds the 200-line limit for services/stores.
- **No `any` type** — needs verification across all new DTO files.
- **No `as` assertions** — `success: true as const` in the interceptor is a borderline case (asserting a literal type, not casting to a broader type).
- **Barrel exports** — check for double re-exports (named + wildcard in same file).
- **Error handling** — the interceptor wraps success but does not handle errors. Error handling is delegated to `ErrorEnvelopeFilter` (outside scope). No swallowed errors in scope.
- **Enum values must match canonical source character-for-character** — `TaskStatus` enum is used in `graph.dto.ts`. Verify alignment.
- **String literal unions for type fields** — `reviewType`, `outcome`, `priority`, `type` fields in DTOs are typed as bare `string` — potential convention violation.

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard-api/src/main.ts
- apps/dashboard-api/src/app/dtos/ (all files within)
- apps/dashboard-api/src/app/controllers/ (all files within)
- apps/dashboard-api/src/app/interceptors/ (all files within)
- apps/dashboard-api/package.json

Issues found outside this scope: document only, do NOT fix.

**Note:** `apps/dashboard-api/src/app/filters/error-envelope.filter.ts` is referenced in `main.ts` but is NOT in scope. Do NOT review or fix it. Only note if its absence causes a compilation error.

## Findings Summary
- Blocking: 2
- Serious: 6
- Minor: 3

### Blocking Issues
1. **No runtime validation on `TaskIdParamDto`** — `@ApiProperty.pattern` is docs-only; `class-validator` decorators missing; path traversal risk (Logic CRITICAL, Security CRITICAL)
2. **`class-validator`/`class-transformer` in `devDependencies`** — pruned in production; validation silently non-functional (Logic SERIOUS, Security HIGH)

### Serious Issues
3. `analytics.dto.ts` at 288 lines exceeds 200-line limit — split into 4 files (Style SERIOUS, Logic MODERATE)
4. 8 DTO fields use bare `string` where string literal unions/enums are required by convention (Style SERIOUS, Logic SERIOUS)
5. `PORT` env parsing has no `NaN` guard — `parseInt` of non-numeric value passes `NaN` to `app.listen()` (Logic MODERATE)
6. `ResponseEnvelope<T>` interface not exported — downstream types cannot reference envelope shape (Style MODERATE, Logic MINOR)
7. Filesystem paths exposed in API responses (`SessionSummaryDto.path`, `CompletionReportDto.filesCreated/filesModified`) — information disclosure if deployed externally (Security MEDIUM)
8. Swagger UI at `/api/docs` unauthenticated — full API contract publicly documented (Security MEDIUM)

### Minor Issues
9. `success: true as const` in interceptor — should use explicit return type annotation instead of `as` assertion (Style MODERATE)
10. API version string `'v1'` hardcoded in two locations — extract to constant (Logic MINOR)
11. CORS regex allows all localhost ports — any local process can make credentialed calls (Security LOW)
