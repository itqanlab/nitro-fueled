# Review Context — TASK_2026_092

## Task Scope
- Task ID: 2026_092
- Task type: FEATURE
- Files in scope: [File Scope section from task.md — these are the ONLY files reviewers may touch]
  - apps/dashboard/src/app/services/api.service.ts (CREATED)
  - apps/dashboard/src/app/services/websocket.service.ts (CREATED)
  - apps/dashboard/src/environments/environment.ts (CREATED)
  - apps/dashboard/src/environments/environment.prod.ts (CREATED)
  - apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts (CREATED)
  - apps/dashboard/src/app/views/analytics/analytics.adapters.ts (CREATED)
  - apps/dashboard/src/app/app.config.ts (MODIFIED — provideHttpClient added)
  - apps/dashboard/project.json (MODIFIED — fileReplacements for production)
  - apps/dashboard/src/app/views/dashboard/dashboard.component.ts (MODIFIED — uses ApiService)
  - apps/dashboard/src/app/views/analytics/analytics.component.ts (MODIFIED — uses ApiService)
  - apps/dashboard/src/app/layout/status-bar/status-bar.component.ts (MODIFIED — uses ApiService)
  - apps/dashboard/src/app/layout/sidebar/sidebar.component.ts (MODIFIED — inlined constants)
  - apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts (MODIFIED — inlined constants)
  - apps/dashboard/src/app/views/models/model-assignments.component.ts (MODIFIED — inlined constants)
  - apps/dashboard/src/app/views/new-task/new-task.component.ts (MODIFIED — inlined constants)
  - apps/dashboard/src/app/views/providers/provider-hub.component.ts (MODIFIED — inlined constants)
  - apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts (MODIFIED — inlined constants)
  - apps/cli/package.json (MODIFIED — copy-web-assets points to apps/dashboard/dist)
  - package.json (MODIFIED — socket.io-client added)

## Git Diff Summary

Implementation commit: `45a06cc feat(dashboard): wire Angular app to NestJS API — TASK_2026_092`

**22 files changed, 771 insertions(+), 103 deletions(-)**

### Files Changed

- **apps/dashboard/src/app/services/api.service.ts** (NEW, 107 lines): Angular injectable service using `HttpClient` to call all NestJS REST endpoints. Imports typed interfaces from `dashboard-api/src/dashboard/dashboard.types`. All methods return `Observable<T>`. Explicit `public`/`private` access modifiers used. Uses `inject()` for DI.

- **apps/dashboard/src/app/services/websocket.service.ts** (NEW, 28 lines): Angular injectable using `socket.io-client`. Connects to wsUrl from environment. Listens for `dashboard-event`. Exposes `events$: Observable<DashboardEvent>`. Uses `DestroyRef` for cleanup.

- **apps/dashboard/src/environments/environment.ts** (NEW, 5 lines): Dev environment with `apiUrl: 'http://localhost:3001'` and `wsUrl: 'http://localhost:3001'`.

- **apps/dashboard/src/environments/environment.prod.ts** (NEW, 5 lines): Production environment with empty strings for `apiUrl` and `wsUrl`.

- **apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts** (NEW, 52 lines): Pure adapter functions mapping `TaskRecord` → `Task` and `DashboardStats` → `AnalyticsSummary`. Contains `ACTIVE_STATUSES` and `COMPLETED_STATUSES` string literal union arrays.

- **apps/dashboard/src/app/views/analytics/analytics.adapters.ts** (NEW, 74 lines): Pure adapter functions mapping `AnalyticsCostData` + `AnalyticsModelsData` → `AnalyticsData`. Contains `PROVIDER_COLOR_CLASSES` const array.

- **apps/dashboard/src/app/app.config.ts** (MODIFIED): Added `provideHttpClient()` to providers array.

- **apps/dashboard/project.json** (MODIFIED): Added `fileReplacements` array in production configuration to swap `environment.ts` → `environment.prod.ts`.

- **apps/cli/package.json** (MODIFIED): `copy-web-assets` script updated from `../dashboard-web/dist` to `../dashboard/dist`.

- **package.json** (MODIFIED): Added `socket.io-client` dependency.

- **apps/dashboard/src/app/views/dashboard/dashboard.component.ts** (MODIFIED): Wired to `ApiService` — loads tasks from registry, stats from getStats(). ~111 lines net change.

- **apps/dashboard/src/app/views/analytics/analytics.component.ts** (MODIFIED): Wired to `ApiService` — loads cost + model data. ~129 lines net change.

- **apps/dashboard/src/app/layout/status-bar/status-bar.component.ts** (MODIFIED): Wired to `ApiService` — loads state/health. ~46 lines net change.

- **apps/dashboard/src/app/layout/sidebar/sidebar.component.ts** (MODIFIED): Inlined nav constants, removed MockDataService.

- **apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts** (MODIFIED): Inlined constants.

- **apps/dashboard/src/app/views/models/model-assignments.component.ts** (MODIFIED): Inlined constants.

- **apps/dashboard/src/app/views/new-task/new-task.component.ts** (MODIFIED): Inlined constants.

- **apps/dashboard/src/app/views/providers/provider-hub.component.ts** (MODIFIED): Inlined constants.

- **apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts** (MODIFIED): Inlined constants.

## Project Conventions

From CLAUDE.md:
- Git: conventional commits with scopes
- All agents use the `nitro-` prefix
- Task states: CREATED | IN_PROGRESS | IMPLEMENTED | IN_REVIEW | COMPLETE | FAILED | BLOCKED | CANCELLED

From TypeScript conventions (angular project):
- Explicit access modifiers on ALL class members
- No `any` type — use proper generics or `unknown`
- No `as` type assertions
- String literal unions for status/type fields
- kebab-case file names
- One interface/type per file where practical
- Never swallow errors

## Style Decisions from Review Lessons

Relevant rules for TypeScript/Angular files:
- **Components: max 150 lines. Inline templates: max 50 lines.** (MOST VIOLATED RULE)
- **Services/repositories/stores: max 200 lines.** — api.service.ts (107 lines) and websocket.service.ts (28 lines) are within limits.
- **Explicit access modifiers on ALL class members** — `public`, `private`, `protected`. Never bare.
- **No `any` type ever** — use `unknown` + type guards, or proper generics.
- **No `as` type assertions** — if the type system fights you, the type is wrong.
- **String literal unions for status/type/category fields** — never bare `string`.
- **No unused imports or dead code** — if exported but never imported, remove it.
- **Never swallow errors** — at minimum, log them. No empty catch blocks.
- **Error messages must be human-readable** — not raw exception strings. Wrap at boundaries.
- **Falsy checks skip zero values** — `if (x || y)` skips when both are 0. Use `!== undefined` or `!= null`.
- **One interface/type per file** — don't define models inside component files.

## Scope Boundary (CRITICAL)
Reviewers MUST only flag and fix issues in these files:
- apps/dashboard/src/app/services/api.service.ts
- apps/dashboard/src/app/services/websocket.service.ts
- apps/dashboard/src/environments/environment.ts
- apps/dashboard/src/environments/environment.prod.ts
- apps/dashboard/src/app/views/dashboard/dashboard.adapters.ts
- apps/dashboard/src/app/views/analytics/analytics.adapters.ts
- apps/dashboard/src/app/app.config.ts
- apps/dashboard/project.json
- apps/dashboard/src/app/views/dashboard/dashboard.component.ts
- apps/dashboard/src/app/views/analytics/analytics.component.ts
- apps/dashboard/src/app/layout/status-bar/status-bar.component.ts
- apps/dashboard/src/app/layout/sidebar/sidebar.component.ts
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts
- apps/dashboard/src/app/views/models/model-assignments.component.ts
- apps/dashboard/src/app/views/new-task/new-task.component.ts
- apps/dashboard/src/app/views/providers/provider-hub.component.ts
- apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts
- apps/cli/package.json
- package.json

Issues found outside this scope: document only, do NOT fix.

## Findings Summary
- Blocking: 8 (Style High: 5, Logic Major: 3)
- Serious: 10 (Style Medium: 7, Security Medium: 3)
- Minor: 17 (Style Low: 9, Logic Minor: 5, Security Low: 3)
