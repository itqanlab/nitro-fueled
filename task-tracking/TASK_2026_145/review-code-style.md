# Code Style Review — TASK_2026_145

## Score: 5/10

## Review Summary

| Metric          | Value         |
| --------------- | ------------- |
| Overall Score   | 5/10          |
| Assessment      | NEEDS_REVISION |
| Blocking Issues | 3             |
| Serious Issues  | 5             |
| Minor Issues    | 4             |
| Files Reviewed  | 8             |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `isCortexAvailable()` probe in `dashboard.controller.ts:435` opens and closes a DB connection on every single-item GET that returns null. For endpoints like `GET /cortex/tasks/:id` and `GET /cortex/tasks/:id/trace`, a not-found result triggers two DB round-trips: one for the real query, one for the probe. If cortex DB is slow or contended, every 404 doubles latency. Worse, there is a TOCTOU window between the probe and the original null — DB could disappear between the two calls, causing a 503 to be incorrectly classified as a 404. Six months from now, when this is used on a lightly-loaded machine, the race will be invisible but the double-open pattern will have been copy-pasted everywhere.

### 2. What would confuse a new team member?

The `queryTaskTrace` function in `cortex-queries-worker.ts:98` is declared to return `CortexTaskTrace` (non-null), but `CortexService.getTaskTrace` wraps it in a try/catch and returns `null` on error. The controller then checks `if (result === null)` and throws 404. A new developer reading `getTaskTrace` in the service sees a `null` return, reads the type declaration on `queryTaskTrace`, and cannot reconcile why the service returns null for "task not found" — because `queryTaskTrace` never returns null for a missing task; it returns `{ task_id, workers: [], phases: [], ... }` with all empty arrays. The 404 path in the controller for `getCortexTaskTrace` is therefore **unreachable in the not-found case** — it will only trigger if the DB is unavailable while the probe succeeds (which cannot happen).

### 3. What's the hidden complexity cost?

`parseJson<T>` is defined twice — once in `cortex-queries-task.ts:32` and again verbatim in `cortex-queries-worker.ts:30`. The `WORKER_COLS` string constant is also defined twice — `cortex-queries-task.ts:25` and `cortex-queries-worker.ts:23`. Both files need to stay in sync manually. The split was done for file-size management, but the correct extract is a shared `cortex-queries-utils.ts` with the shared helpers. Instead, the split produced duplication without eliminating the coupling.

### 4. What pattern inconsistencies exist?

- `DashboardGateway` constructor at line 38 is bare (`constructor(`) without the `public` modifier. Every other constructor in this codebase uses `public constructor(`. This is the only file in the diff that breaks that invariant.
- `cortex.types.ts` uses `snake_case` for all public interface field names (`created_at`, `worker_type`, `task_id`). The existing `dashboard.types.ts` uses `camelCase` fields. The review-general lesson states interface field names must follow the established casing convention. The cortex types establish a parallel snake_case convention for no documented reason — either the DB row names are being leaked directly into the API contract, or the author intended camelCase and forgot to coerce at the mapper boundary.
- `CortexService` uses `public constructor()` but `DashboardGateway` uses bare `constructor()`. One was touched in this diff; the inconsistency is introduced here.

### 5. What would I do differently?

1. Replace `isCortexAvailable()` with a dedicated `isDbAvailable(): boolean` method on `CortexService` that only checks `existsSync(this.dbPath)` — no DB open, no extra round-trip, no TOCTOU.
2. Extract `parseJson` and the `WORKER_COLS` constant to a shared `cortex-queries-utils.ts` to eliminate the duplication.
3. Coerce snake_case DB fields to camelCase in the mappers so the public `Cortex*` interfaces follow the project's established camelCase convention and DB implementation details do not leak into the API contract.
4. Fix the `queryTaskTrace` return type to `CortexTaskTrace | null` so the not-found path is actually reachable, or document explicitly why an empty-array result is the intended "not found" representation.
5. Add `public` to the `DashboardGateway` constructor to match every other constructor in this codebase.

---

## Blocking Issues

### Issue 1: `isCortexAvailable()` opens a live DB connection as an availability probe — double open, TOCTOU, performance hazard

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:433-436`
- **Problem**: The probe calls `this.cortexService.getEventsSince(Number.MAX_SAFE_INTEGER)` which calls `openDb()` and `close()`. Every not-found cortex GET that hits this path (e.g., `getCortexTask`, `getCortexTaskTrace`, `getCortexSession`) opens the DB twice per request. Between the original query call and the probe, the DB can be deleted or become unavailable — the probe result no longer reflects the state at query time.
- **Impact**: Double latency on all cortex 404 responses. Silent misclassification of 503 as 404 when DB disappears in the TOCTOU window. The pattern will be copy-pasted for future endpoints.
- **Fix**: Add `public isAvailable(): boolean { return existsSync(this.dbPath); }` to `CortexService`. Call that instead of the live-query probe.

### Issue 2: `parseJson<T>` and `WORKER_COLS` are duplicated across two query files

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries-task.ts:25,32` and `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts:23,30`
- **Problem**: `parseJson` is identical in both files — character-for-character. `WORKER_COLS` is also identical. If the worker table schema changes (add/remove a column), both definitions must be updated or they will diverge silently.
- **Impact**: Maintenance split-brain. The file was split for size reasons (correct call) but the shared utilities were not extracted (wrong execution). This is exactly the pattern the review-general lesson on "utility files that aggregate multiple distinct sub-operations" warns about.
- **Fix**: Create `cortex-queries-utils.ts` exporting `parseJson` and `WORKER_COLS`. Both query files import from it.

### Issue 3: `queryTaskTrace` returns `CortexTaskTrace` (never null), but controller throws 404 on null result — dead code path

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts:98` and `apps/dashboard-api/src/dashboard/dashboard.controller.ts:329-336`
- **Problem**: `queryTaskTrace` always returns a `CortexTaskTrace` struct — even when the task does not exist, it returns `{ task_id, workers: [], phases: [], ... }`. The service wraps it in try/catch and returns null only on exception. The controller's null check therefore only triggers on an exception, not on "task not found". The 404 response for missing task IDs is unreachable, and a request for a nonexistent task silently returns an empty trace with status 200.
- **Impact**: API contract is broken: clients receive `{ task_id, workers: [], phases: [], reviews: [], fix_cycles: [], events: [] }` for nonexistent task IDs instead of 404. Future consumers will cache this empty result as valid data.
- **Fix**: Either (a) add an existence check in `queryTaskTrace` using the tasks table and return null when the task row does not exist, or (b) document that an all-empty trace is the canonical "not found" representation and remove the 404 throw from the controller.

---

## Serious Issues

### Issue 4: Public `Cortex*` interfaces use snake_case field names — leaks DB schema into API contract

- **File**: `apps/dashboard-api/src/dashboard/cortex.types.ts` — all public interfaces (lines 10–148)
- **Problem**: `CortexTask`, `CortexWorker`, `CortexSession`, etc. use `created_at`, `worker_type`, `task_id`, `spawn_time`. The existing public type in this module, `dashboard.types.ts`, uses camelCase (`taskId`, `sessionId`). The review-general lesson states: "interface field names must follow the interface's established casing convention." The mappers (`mapTask`, `mapWorker`) copy field names verbatim from `RawTask`/`RawWorker` without coercion — the DB column names are now the public API field names.
- **Tradeoff**: Coercing at the mapper boundary requires a larger mapper but produces a camelCase API contract consistent with the rest of the dashboard API.
- **Recommendation**: Convert all public `Cortex*` interfaces to camelCase. Update mappers accordingly. `Raw*` interfaces remain snake_case since they mirror the DB schema.

### Issue 5: `constructor` in `DashboardGateway` missing `public` access modifier

- **File**: `apps/dashboard-api/src/dashboard/dashboard.gateway.ts:38`
- **Problem**: Every other constructor in this dashboard directory uses `public constructor(`. The gateway uses bare `constructor(`. The review-general lesson is explicit: "Explicit access modifiers on ALL class members." This is the only diff-touched file that breaks the invariant.
- **Tradeoff**: None — pure consistency fix.
- **Recommendation**: Add `public` keyword.

### Issue 6: `status` and `type` filter parameters in query functions accept bare `string` — no union or validation

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries-task.ts:89` and `cortex-queries-worker.ts:81`
- **Problem**: `filters?: { status?: string; type?: string }` and `filters?: { sessionId?: string; status?: string }` use bare `string`. The review-general lesson states: "String literal unions for status/type/category fields — never bare string." There are no Zod validation guards on the controller query params either — any string passes through to SQL.
- **Tradeoff**: Adding unions requires knowing the valid values. Even a `TODO` comment noting this is intentionally left open would be better than bare string.
- **Recommendation**: Define string literal unions for at least the known status and type values (or accept `string` with a comment documenting the intentional openness). Add validation or sanitization before use in SQL if input is untrusted.

### Issue 7: `cortex.types.ts` is 262 lines — exceeds model/type file size limit

- **File**: `apps/dashboard-api/src/dashboard/cortex.types.ts`
- **Problem**: Review-general file size limit for interfaces/models is 80 lines. This file is 262 lines — more than 3x the limit. It contains two conceptually distinct groups: public API response types (lines 10–148) and raw DB row types (lines 152–263). These serve different consumers and belong in separate files.
- **Tradeoff**: Splitting requires updating all import paths.
- **Recommendation**: Split into `cortex-response.types.ts` (public shapes) and `cortex-db.types.ts` (raw DB rows).

### Issue 8: `mapEvent` is exported from `cortex-queries-worker.ts` but also re-exported through barrel — consumers could import from either

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries.ts:14` and `cortex-queries-worker.ts:65`
- **Problem**: `mapWorker` and `mapEvent` are exported directly from `cortex-queries-worker.ts` AND re-exported in the barrel `cortex-queries.ts`. Any file importing from `cortex-queries-worker.ts` directly bypasses the barrel. If the barrel is ever refactored, those direct imports break silently. `cortex-queries-task.ts` already imports `mapWorker` directly from `cortex-queries-worker.ts:15` — the barrel is being partially bypassed in the same PR that introduced it.
- **Recommendation**: Remove the direct export of `mapWorker`/`mapEvent` from `cortex-queries-worker.ts` (make them unexported module-level functions) if they are only needed via the barrel, or document the expected import path.

---

## Minor Issues

- `cortex-queries-worker.ts:110-114`: Inline object literals for `CortexPhase` mapping span multiple properties on single comma-separated lines (e.g., `id: r.id, worker_run_id: r.worker_run_id, task_id: r.task_id, ...`). This is inconsistent with how other mappers in the file use multi-line object literals (`mapWorker` at line 43). Formatter/linter should enforce this, but the inconsistency is notable.
- `cortex-queries-worker.ts:155-168`: The `queryModelPerformance` function builds two separate WHERE clause fragments (`phaseWhere`, `reviewWhere`) and pushes parameters into the same flat `params` array twice. The order of positional parameters in the CTE must match the push order. This is fragile and will break silently if the filter conditions are reordered. A comment explaining the param order is required, or the CTE should use named parameters.
- `dashboard.controller.ts:26`: `TASK_ID_RE` is a module-level constant but is used only by this controller. There is no consistency issue here (no shared regex file exists), but its pattern `^TASK_\d{4}_\d{3}$` does not match the existing task IDs that have three-digit suffixes padded to exactly three digits — it would reject `TASK_2026_1000` if task numbers ever exceed 999. This is a latent constraint worth documenting.
- `cortex.service.ts:28-38`: The service re-exports all public types imported from `cortex.types.ts`. This doubles as a re-export hub. If the controller or gateway need these types, they should import from `cortex.types.ts` directly. Re-exporting through the service creates an implicit coupling between service and type module that is not standard NestJS practice.

---

## File-by-File Analysis

### cortex.types.ts

**Score**: 5/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**: Well-structured separation of raw DB row types and public response types. The Raw interfaces are correctly defined at module scope (enforces the lesson from TASK_2026_141). The main problems are file size (262 lines vs 80-line limit) and the snake_case field names on public interfaces leaking DB column naming into the API contract.

**Specific Concerns**:
1. Lines 10–148: All public `Cortex*` interfaces use snake_case field names. Should be camelCase to match the rest of the dashboard API.
2. Lines 1–263: File is 262 lines — split into response types and DB row types.

### cortex-queries-task.ts

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

**Analysis**: Clean query structure, proper parameterized queries, correct use of typed Raw interfaces before mapping. `parseJson` duplication is the main defect.

**Specific Concerns**:
1. Lines 21–26: `TASK_COLS`, `SESSION_COLS`, `WORKER_COLS` defined here; `WORKER_COLS` is also defined in `cortex-queries-worker.ts:23`.
2. Line 32: `parseJson` duplicated from `cortex-queries-worker.ts:30`.

### cortex-queries-worker.ts

**Score**: 5/10
**Issues Found**: 1 blocking, 2 serious, 2 minor

**Analysis**: The duplicate `parseJson` and `WORKER_COLS` are the clearest problems. The `queryTaskTrace` not returning null for missing tasks is the blocking issue. The complex CTE parameter ordering is fragile.

**Specific Concerns**:
1. Line 98: `queryTaskTrace` return type is non-null `CortexTaskTrace` for nonexistent tasks — returns all-empty arrays instead of null.
2. Lines 155–168: Flat parameter array for a two-CTE query with independently filtered clauses — push order must match CTE parameter positions exactly, and there is no comment explaining this.

### cortex-queries.ts

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: Clean barrel re-export. The one concern is that `mapWorker` and `mapEvent` are re-exported here but are also importable directly from `cortex-queries-worker.ts`. Direct import already happens in `cortex-queries-task.ts`.

### cortex.service.ts

**Score**: 6/10
**Issues Found**: 1 blocking (isCortexAvailable probe, located in controller but designed around this service), 0 serious, 1 minor

**Analysis**: Clean NestJS service. Open-per-call pattern with `finally { db.close() }` is correct for read-only use. Logging is appropriate. Re-exporting types from the service (lines 28–38) is the minor oddity.

**Specific Concerns**:
1. Lines 28–38: Service re-exports types. Types should be imported directly from `cortex.types.ts` by consumers, not re-exported through the service.

### dashboard.controller.ts

**Score**: 5/10
**Issues Found**: 2 blocking, 0 serious, 1 minor

**Analysis**: The 8 new cortex endpoints are structurally consistent with the existing endpoints. The `isCortexAvailable()` probe is the architectural problem. The controller is now 437 lines — 2.9x the 150-line limit. This was pre-existing before this task, but the 8 new endpoints deepened the violation.

**Specific Concerns**:
1. Lines 433–436: `isCortexAvailable()` opens the DB as a probe — replace with `existsSync` check.
2. Lines 329–336, 310–318: The 404 path for `getCortexTaskTrace` and `getCortexTask` is unreachable for "task not found" because `queryTaskTrace` never returns null for missing tasks.

### dashboard.gateway.ts

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: Cortex polling is well-structured: interval started in `afterInit`, stopped in `onModuleDestroy`. Silent skip when DB unavailable is correct. Error handling in `broadcastChanges` is proper.

**Specific Concerns**:
1. Line 38: Constructor missing `public` access modifier — breaks codebase consistency.

### dashboard.module.ts

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: `CortexService` correctly registered as a provider and exported. No issues.

---

## Pattern Compliance

| Pattern                       | Status | Concern                                                      |
| ----------------------------- | ------ | ------------------------------------------------------------ |
| Explicit access modifiers     | FAIL   | `DashboardGateway` constructor missing `public`             |
| No bare `string` for status   | FAIL   | Filter params use bare `string` for status/type fields      |
| File size limits              | FAIL   | `cortex.types.ts` 262 lines (limit: 80); controller 437 lines |
| No duplicated code            | FAIL   | `parseJson` and `WORKER_COLS` duplicated across query files |
| Interface field casing        | FAIL   | Public interfaces use snake_case instead of camelCase       |
| Parameterized SQL             | PASS   | All queries use `?` placeholders                            |
| Typed Raw interfaces          | PASS   | DB rows cast once to typed Raw interfaces, not field-by-field |
| NestJS patterns               | PASS   | `@Injectable`, `Logger`, DI wiring all correct              |
| Error handling                | PASS   | All catch blocks log and return null; no swallowed errors   |
| Graceful degradation          | PASS   | `existsSync` guard, 503 on null, interval silently skips    |

---

## Technical Debt Assessment

**Introduced**:
- Duplicate `parseJson` and `WORKER_COLS` across two query files — will drift silently on schema changes.
- snake_case field names on public interfaces — downstream consumers (dashboard frontend) will have to decide whether to coerce or adopt mixed conventions.
- `isCortexAvailable()` probe pattern — if other developers add new single-item endpoints, they will copy this double-open pattern.
- Controller is at 437 lines with no split in sight — each new feature group deepens the violation.

**Mitigated**:
- File-size problem in queries was partially addressed by splitting task/worker queries — the intent was correct even if the execution left duplication.
- Graceful degradation via null returns from the service is the right design; it just needs the controller probe to be replaced with a cheaper check.

**Net Impact**: Moderate increase. The snake_case API contract leak is the most expensive debt — once the frontend is built against it, renaming fields will be a breaking change.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `queryTaskTrace` never returns null for missing tasks, making the 404 path unreachable and silently returning an empty trace as 200 for all nonexistent task IDs. This is a silent correctness bug disguised as a style question.

---

## What Excellence Would Look Like

A 9/10 implementation would:
- Coerce snake_case DB fields to camelCase in all mappers so the public `Cortex*` interfaces match the dashboard API convention.
- Extract `parseJson` and `WORKER_COLS` into `cortex-queries-utils.ts` to eliminate duplication.
- Replace `isCortexAvailable()` with `existsSync(this.dbPath)` — no DB open, no TOCTOU, no double latency.
- Fix `queryTaskTrace` to return `CortexTaskTrace | null` (null when the task row does not exist) so the 404 path is reachable.
- Split `cortex.types.ts` into response types and DB row types to stay within the 80-line file size limit.
- Add `public` to the `DashboardGateway` constructor.
