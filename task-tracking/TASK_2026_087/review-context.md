# Review Context — TASK_2026_087

## Task Scope
- Task ID: 2026_087
- Task type: FEATURE
- Files in scope: (reviewers MUST only flag and fix issues in these files)
  - apps/dashboard-api/src/dashboard/dashboard.types.ts (type definitions migrated from event-types.ts)
  - apps/dashboard-api/src/dashboard/sessions.service.ts (session-store + session-id logic)
  - apps/dashboard-api/src/dashboard/analytics.service.ts (analytics-store + analytics-helpers)
  - apps/dashboard-api/src/dashboard/pipeline.service.ts (store + pipeline-helpers + differ + worker-tree-helpers)
  - apps/dashboard-api/src/dashboard/watcher.service.ts (chokidar watcher with OnModuleInit)
  - apps/dashboard-api/src/dashboard/dashboard.controller.ts (REST routes from http.ts)
  - apps/dashboard-api/src/dashboard/dashboard.module.ts (module registration)

## Git Diff Summary

Implementation commit: `5538b3b feat(dashboard-api): migrate state services and REST controllers to NestJS`

### Files Changed

| File | Lines Added | Lines Removed | Description |
|------|-------------|---------------|-------------|
| analytics.service.ts | +280 | 0 | New: Migrated from analytics-store.ts + analytics-helpers.ts. Injectable with 30s cache TTL, reads session dirs, aggregates cost/efficiency/models data |
| dashboard.controller.ts | +177 | -9 | Expanded from placeholder to full REST API: health, registry, plan, state, tasks, sessions, analytics routes |
| dashboard.module.ts | +17 | -4 | Registers all 4 services + controller, exports them. AnalyticsService via useFactory with process.cwd() |
| dashboard.types.ts | +359 | 0 | New: Migrated from event-types.ts. All domain types: TaskStatus, TaskRecord, FullTaskData, OrchestratorState, etc. |
| pipeline.service.ts | +681 | 0 | New: Migrated from store.ts + pipeline-helpers.ts + differ.ts + worker-tree-helpers.ts. Reads all markdown files synchronously via fs |
| sessions.service.ts | +134 | 0 | New: Migrated from session-store.ts + session-id.ts. Reads sessions dir, active sessions, session details |
| watcher.service.ts | +88 | 0 | New: chokidar watcher implementing OnModuleInit to watch task-tracking directory |

### Key Implementation Patterns
- NestJS `@Injectable()` services with constructor injection
- `AnalyticsService` takes `projectRoot: string` in constructor — injected via `useFactory`
- `PipelineService` and `SessionsService` read files synchronously using `fs` module (non-async methods)
- `WatcherService` implements `OnModuleInit`, starts chokidar watcher on module init
- `DashboardController` uses `@Controller('api')` prefix, delegates to services
- Analytics routes are async (file I/O), other routes are synchronous

## Project Conventions
(From CLAUDE.md)
- TypeScript NestJS project under `apps/dashboard-api/`
- Conventional commits with scopes
- File naming: kebab-case for file names, `.service.ts` suffix for services, `.controller.ts` for controllers, `.module.ts` for modules, `.types.ts` for types
- Agent naming: nitro-* prefix (not relevant here)

## Style Decisions from Review Lessons
(From review-general.md — rules relevant to TypeScript NestJS services)

### File Size Limits (MOST VIOLATED RULE)
- Services/repositories/stores: max 200 lines. **pipeline.service.ts is 681 lines — EXCEEDS LIMIT.**
- analytics.service.ts is 280 lines — EXCEEDS 200-line limit.
- dashboard.types.ts is 359 lines — needs checking if types file limit applies.

### TypeScript Conventions
- Explicit access modifiers on ALL class members — `public`, `private`, `protected`. Never bare.
- No `any` type ever — use `unknown` + type guards, or proper generics.
- No `as` type assertions
- String literal unions for status/type/category fields — never bare `string`.
- Use `Pick<>`/`Omit<>` for interface subsets — never duplicate fields manually.
- No unused imports or dead code.
- Falsy checks skip zero values — use `!== undefined` or `!= null`.

### Naming
- kebab-case for file names
- camelCase for variables, functions, methods
- PascalCase for classes, interfaces, types, enums

### File Structure
- One interface/type per file — but dashboard.types.ts combines all domain types (migration file)
- File suffixes must follow convention — `.types.ts` used here (note: review-general.md says no `.type.ts`, but `.types.ts` plural may be acceptable)

### Error Handling
- Never swallow errors — at minimum, log them. No empty catch blocks.
- Error messages must be human-readable — not raw exception strings.

### TypeScript Cross-Package Type Contracts
- Shared interface files duplicated across packages must be kept byte-for-byte identical
- Missing imports in entry files are compilation blockers

## Findings Summary

| Review | Score | Blocking | Serious | Moderate | Minor | Info |
|--------|-------|----------|---------|----------|-------|------|
| Code Style | 6/10 | 0 | 6 | 0 | 4 | 1 |
| Code Logic | N/A | 0 | 2 | 3 | 1 | 0 |
| Security | PASS | 0 | 1 | 2 | 4 | 0 |
| **Total** | | **0** | **9** | **3** | **9** | **1** |

### Key Findings by Severity

**Serious (9 total):**
- S1 (Style): `pipeline.service.ts` 681 lines — 3.4× over 200-line service limit
- S2 (Style): `analytics.service.ts` 280 lines — 40% over 200-line service limit
- S3 (Style): Inline `import()` types in `pipeline.service.ts` — `PlanData`, `DashboardEvent`, `WorkerTreeNode` not at top-level
- S4 (Style): `as unknown as Record<string, unknown>` double cast in `getStats()`
- S5 (Style): `readTextFile` swallows all errors silently
- S6 (Style): 5 Map fields missing `readonly` modifier in `pipeline.service.ts`
- SERIOUS-1 (Logic): `buildModelsData` inflates per-model task counts when session uses multiple models
- SERIOUS-2 (Logic): `replace(',', '')` only removes first comma — large cost values truncated
- SERIOUS-1 (Security): No authentication on any REST endpoint (acceptable for local-only tool but must be documented)

**Moderate (3 total):**
- MODERATE-1 (Logic): `TaskRecord.type` uses bare `string` instead of `TaskType`
- MODERATE-2 (Logic): `ActiveWorker.workerType`/`status` use bare `string` instead of `WorkerType`/`WorkerStatus`
- MODERATE-3 (Logic) / MODERATE-2 (Security): Analytics endpoints catch errors without logging — original error discarded

**Minor (9 total):**
- M1–M4 (Style): Loose `string` typings in `dashboard.types.ts` where union types exist
- M5 (Style): Analytics catch blocks discard original error
- M6 (Style): Local `LogEntry` type duplicates shape from `dashboard.types.ts`
- MINOR-1 (Security): `readTextFile` silent error discard without logging
- MINOR-2 (Security): Session/task IDs reflected verbatim in error messages
- MINOR-3 (Security): `process.cwd()` as implicit config — fragile in non-standard working dirs
- MINOR-4 (Security): `ignoreInitial: false` in chokidar causes burst on startup

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard-api/src/dashboard/dashboard.types.ts
- apps/dashboard-api/src/dashboard/sessions.service.ts
- apps/dashboard-api/src/dashboard/analytics.service.ts
- apps/dashboard-api/src/dashboard/pipeline.service.ts
- apps/dashboard-api/src/dashboard/watcher.service.ts
- apps/dashboard-api/src/dashboard/dashboard.controller.ts
- apps/dashboard-api/src/dashboard/dashboard.module.ts

Issues found outside this scope: document only, do NOT fix.
