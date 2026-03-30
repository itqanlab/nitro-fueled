# Task: Resolve Deferred TASK_2026_109 Findings — DTO Validation, File Split, ValidationPipe

## Metadata

| Field                 | Value        |
|-----------------------|--------------|
| Type                  | BUGFIX       |
| Priority              | P2-Medium    |
| Complexity            | Medium       |
| Preferred Tier        | balanced     |
| Model                 | default      |
| Testing               | required     |
| Poll Interval         | default      |
| Health Check Interval | default      |
| Max Retries           | default      |

## Description

Three findings from TASK_2026_109 (API Contract Layer) were explicitly deferred to a follow-on task. They must now be resolved: (1) `TaskIdParamDto` is missing `@Matches` / `@IsString` decorators — path traversal risk flagged as CRITICAL by the security reviewer — add validators and register `ValidationPipe` globally in `main.ts`; (2) `class-validator` and `class-transformer` are in `devDependencies` — move them to `dependencies` so they survive production pruning; (3) `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts` is 288 lines and exceeds the 200-line limit — split into 4 focused files as recommended in the review.

## Dependencies

- TASK_2026_109 — COMPLETE (this is the follow-on task)

## Acceptance Criteria

- [ ] `TaskIdParamDto` has `@Matches(/^TASK_\d{4}_\d{3}$/)` and `@IsString()` decorators applied
- [ ] `ValidationPipe` registered globally in `main.ts` with `{ whitelist: true, forbidNonWhitelisted: true }`
- [ ] `class-validator` and `class-transformer` moved from `devDependencies` to `dependencies` in `apps/dashboard-api/package.json`
- [ ] `analytics.dto.ts` split into 4 files under a `dtos/responses/analytics/` subdirectory (or equivalent split as designed by Architect)
- [ ] All existing DTO barrel exports updated to reflect the split
- [ ] No regression in existing Swagger UI (all endpoints still documented correctly)

## References

- `apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts` — add validators
- `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts` — split this file
- `apps/dashboard-api/src/main.ts` — register ValidationPipe
- `apps/dashboard-api/package.json` — move class-validator/class-transformer to deps
- TASK_2026_109 review-security.md — CRITICAL finding on TaskIdParamDto
- TASK_2026_109 review-code-style.md — SERIOUS finding on analytics.dto.ts file size
- TASK_2026_109 completion-report.md — deferred findings listed

## File Scope

- `apps/dashboard-api/src/app/dtos/requests/task-id.param.dto.ts`
- `apps/dashboard-api/src/app/dtos/responses/analytics.dto.ts` (split)
- `apps/dashboard-api/src/main.ts`
- `apps/dashboard-api/package.json`
- `apps/dashboard-api/src/app/dtos/index.ts` (barrel update)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_131 (both touch dashboard-api main.ts and module bootstrapping).
✅ Can run in parallel with TASK_2026_130 (retro skill file, no overlap).
Suggested execution wave: Wave after TASK_2026_131, or run before it if auth work is deprioritized.
