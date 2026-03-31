# Code Style Review — TASK_2026_171

## Summary

Analytics Reports feature: Angular frontend + NestJS backend delivering session, cost, model-performance, and quality reports.
13 files reviewed. The backend is clean and well-structured. The frontend component has several pattern violations from established project standards — most are localized to `reports.component.ts` and `.html`.

## Findings

| # | File | Line | Severity | Issue |
|---|------|------|----------|-------|
| 1 | `reports.component.ts` | 17 | **Serious** | Class does not declare `implements OnInit` despite using `ngOnInit()`. All lifecycle hooks must be backed by the corresponding interface for compile-time safety. |
| 2 | `reports.component.ts` | 21–29 | **Serious** | Mutable public fields (`overview`, `loading`, `unavailable`, `from`, `to`, `sessionCostMax`, etc.) used as template-bound state. With `OnPush` change detection, Angular will not detect mutations to plain class fields — only signal/observable pushes. These must be `signal()` or the component must manually call `cdr.markForCheck()` after every mutation. Currently every `this.loading = true` etc. in the `load()` method silently fails to update the view under `OnPush`. |
| 3 | `reports.component.ts` | 76–78 | **Serious** | `Math.max(1, ...overview.*.trend.map(...))` inside the `next` handler spreads potentially large arrays into variadic `Math.max`. If a dataset has thousands of trend points this will throw a stack overflow (`Maximum call stack size exceeded`). Use `Math.max(1, overview.sessionReport.trend.reduce((m, p) => Math.max(m, p.totalCost), 0))` instead. |
| 4 | `reports.component.ts` | 31 | **Minor** | `ngOnInit` is a public method but no `implements OnInit` is declared — see finding #1. Additionally, `ngOnInit` could be replaced with a field initializer calling `load()` directly via a constructor or `effect()`, keeping the class interface clean. |
| 5 | `reports.component.ts` | 46–63 | **Minor** | Export methods (`exportSessionReport`, `exportSuccessReport`, etc.) contain long inline `map()` arrow functions as direct arguments to `downloadCsv`. The line at 46 is ~230 characters. The project's established pattern for `OnPush` components is to use `computed()` for derived data; precomputing the mapped arrays as `computed()` signals would also satisfy the "no method calls in template" rule, even though these are triggered via button clicks rather than template expressions. |
| 6 | `reports.component.html` | 48, 77, 105 | **Serious** | `[style.width.%]="point.totalCost / sessionCostMax * 100"` — inline `[style]` bindings for data-driven widths are against project style (anti-pattern: "CSS variable color driven by data must use class names, not inline `[style]` bindings"). While these are layout widths rather than colors, the same principle applies: division-by-zero risk when `sessionCostMax === 0` (on reset, the field is set to `0`). `0 / 0 = NaN` → `[style.width.%]="NaN"` renders as an invalid CSS value. |
| 7 | `reports.component.html` | 54, 58, 65, 77–93, 107–110 | **Serious** | Many lines exceed 200 characters, with some (line 54, 65, 80, 93) exceeding 300. The project limit for inline templates is 50 lines and readability is a first-class concern. Several `@for` blocks with embedded `<table>` markup are written as single lines. This makes diffs unreadable and search/grep unreliable. The HTML file should use consistent indentation with one element per line. |
| 8 | `reports.component.html` | 107 | **Minor** | `[ngClass]="'severity-pill--' + row.severity"` is a string-concatenated class binding. This is the pattern flagged in `frontend.md`: "CSS variable color driven by data must use class names, not inline style bindings." The severity union type `'critical' | 'serious' | 'moderate'` is known at compile time — a safer alternative is a `@switch` block or a precomputed class map. The current approach loses type safety (any string suffix would not produce a type error). |
| 9 | `reports.service.ts` | 86 | **Serious** | The `overallSuccessRate` calculation on line 86 is a deeply nested ternary chain (~200 characters on a single line): `successRows.length > 0 ? successRows[0].dimension === 'taskType' ? Number((...).toFixed(1)) : 0 : 0`. This violates the 50-line function rule indirectly (single expression with 3 levels of nesting). More importantly, the `successRows[0].dimension === 'taskType'` guard is fragile — it assumes the first row is always a `taskType` dimension because `buildSuccessRows` sorts by `successRate DESC`. A `taskType` row with `successRate 0` would sort last, breaking this assumption. |
| 10 | `reports.service.ts` | 274 | **Serious** | `bestModelBy` uses two `as { model: string } & Record<string, number>` type assertions to force `ModelPerformanceReportRow` into a generic map. This is the exact pattern the anti-patterns file flags: "Avoid `as` type assertions. If the type system fights you, the type is wrong." The correct fix is to type the parameter as `ReadonlyArray<ModelPerformanceReportRow>` and accept a `(row: ModelPerformanceReportRow) => number` callback — the type is already fully defined. |
| 11 | `reports.helpers.ts` | 16–39 | **Serious** | `ParsedSessionMetrics` and `ParsedReviewMetric` are interface definitions inside a `*.helpers.ts` file. The anti-patterns file states: "Interfaces and types must be defined at module scope in `*.model.ts` files — never inside component or function bodies." These two interfaces belong in `reports.types.ts`, not in the helpers file. Helper files should contain only functions. |
| 12 | `reports.helpers.ts` | 57 | **Minor** | `parseCompactionCount` uses a very broad regex that matches any 9-column markdown table row and reads the last column. The regex itself is not self-documenting and a comment explaining why 9 columns is the expected structure is missing. If the analytics table format changes (column is added/removed), this will silently return wrong data. |
| 13 | `dashboard.module.ts` | 49 | **Minor** | The `exports` array is a single line exceeding 130 characters. While not a blocking issue, consistent multi-line formatting matches the rest of the codebase and improves readability in diffs. |
| 14 | `reports.model.ts` | 44–51 | **Minor** | The frontend `SuccessRateRow` interface inlines `readonly dimension: 'taskType' | 'complexity' | 'model' | 'period'` instead of re-using a shared `SuccessDimension` type. The backend exports `SuccessDimension` as a named type alias. The frontend inlines the union. If the set of dimensions changes, the backend `SuccessDimension` and the frontend `SuccessRateRow` must be kept in sync manually — a divergence risk. Since these are in separate packages without a shared types package, a comment noting the coupling would reduce future maintenance risk. |
| 15 | `reports-export.ts` | 1 | **Minor** | `escapeCsv` is not exported. It is a pure utility function with testable behavior (CSV injection, quoting, newlines). Not exporting it makes unit testing harder. It should be exported or the file should include a note that it is intentionally package-private. |
| 16 | `reports.service.ts` | 35–37 | **Minor** | `ReportsService` receives `projectRoot: string` via constructor injection rather than through NestJS DI. This pattern works, but it bypasses the DI container for the configuration value. The `dashboard.module.ts` workaround (line 40-43) using `useFactory` is correct but adds module complexity. A `ConfigService` or environment token would be more idiomatic NestJS. This is pre-existing architectural context, flagged here for awareness. |
| 17 | `api.service.ts` | 218–228 | **Minor** | `getReportsOverview` does not validate the `from`/`to` parameters before appending to `HttpParams`. The backend validates via `DATE_RE`, but a client-side guard that skips empty strings (as the service already does with the `if (params?.from)` check using truthiness) would silently drop a `from` value of `"0"`. This is an edge case but the `||` truthiness check vs explicit `!== undefined && !== ''` check is subtly different. |

## The 5 Critical Questions

### 1. What could break in 6 months?

`reports.component.ts` lines 76–78 — spreading an unbounded trend array into `Math.max()` will throw a stack overflow once production data grows. Also `reports.service.ts` line 86 — the `overallSuccessRate` assumption that `successRows[0]` is always a `taskType` row will silently produce `0` for overall success rate when the highest-rated row happens to be a `model` or `complexity` dimension row.

### 2. What would confuse a new team member?

The `ParsedSessionMetrics` and `ParsedReviewMetric` interfaces in `reports.helpers.ts` — they look like data contracts but live in a helpers file. New team members expect data contracts in `*.model.ts` or `*.types.ts` files and would not find them there. Additionally, the `bestModelBy` method's double `as` cast in `reports.service.ts` line 274 hides that the caller already knows the concrete type — the cast will confuse anyone trying to understand what `rows` actually contains.

### 3. What's the hidden complexity cost?

The `OnPush` + mutable field anti-pattern in `reports.component.ts` is the biggest hidden cost. The component appears to work in development (because `NgZone` may trigger full change detection cycles in non-production modes), but in a zone-less or strict `OnPush` context, none of the loading state mutations will update the view. Fixing this later requires converting 8+ fields to signals and updating all template bindings — a non-trivial refactor.

### 4. What pattern inconsistencies exist?

- The backend defines `SuccessDimension` as an exported named type (`reports.types.ts` line 44). The frontend re-inlines the same union in `SuccessRateRow`. Every other type-pairing in this codebase uses shared contracts or at minimum mirrors the name.
- `reports.component.ts` uses `[(ngModel)]` two-way binding (requiring `FormsModule`) for `from`/`to` inputs. The rest of the dashboard uses reactive forms or signal-based state. This is an isolated divergence.
- `reports-export.ts` has no class wrapper or namespace — it exports plain functions. This is actually fine for pure utilities, but it's the only file in `views/reports/` that doesn't follow the Angular file-with-class convention. A comment clarifying it's intentionally a plain module would help.

### 5. What would I do differently?

- Convert `overview`, `loading`, `unavailable`, `from`, `to`, and the `*Max` fields to `signal()` so they actually work under `OnPush`.
- Replace the `Math.max(1, ...array.map(...))` spread with a `reduce`-based max.
- Move `ParsedSessionMetrics` and `ParsedReviewMetric` to `reports.types.ts`.
- Fix `bestModelBy` to accept `ModelPerformanceReportRow` directly instead of the `Record<string, number>` cast.
- Add `implements OnInit` to `ReportsComponent`.
- Reformat the HTML file with one element per line.

## Verdict

| Metric | Value |
|--------|-------|
| Overall Score | 5/10 |
| Verdict | **FAIL** |
| Blocking Issues | 0 |
| Serious Issues | 7 |
| Minor Issues | 10 |
| Files Reviewed | 13 |

The backend files (`reports.types.ts`, `reports.helpers.ts`, `reports.service.ts`, `dashboard.controller.ts`, `dashboard.module.ts`) are well-organized. The `reports.types.ts` type coverage is thorough and `readonly` is applied consistently.

The frontend has multiple pattern violations: the `OnPush` + mutable fields combination is a functional bug waiting to surface in production, the HTML is unreadable due to extreme line lengths, and the `bestModelBy` type assertion contradicts established project rules. The `ParsedSessionMetrics`/`ParsedReviewMetric` interfaces in the wrong file is a findability violation.

The serious issues at lines 2, 3, 6, 9, 10, 11 of the findings table must be addressed before this code is considered pattern-compliant with the rest of the dashboard.
