# Logic Review — TASK_2026_216

## Score: 6/10

## Review Summary

| Metric              | Value                          |
| ------------------- | ------------------------------ |
| Overall Score       | 6/10                           |
| Assessment          | NEEDS_REVISION                 |
| Critical Issues     | 3                              |
| Serious Issues      | 3                              |
| Moderate Issues     | 4                              |
| Failure Modes Found | 7                              |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The launcher endpoint at `GET /api/analytics/launcher/:launcherId` calls `cortex.getWorkers()` with no filters — it fetches every worker row in the DB and then filters in memory. If the workers table has tens of thousands of rows, the call succeeds, the service iterates all rows, but the client only asked about one launcher. No data is lost but the response is computed on the full table scan. Worse: when `launcherId` does not match any worker, the endpoint returns `{ data: [], total: 0 }` with HTTP 200, indistinguishable from "launcher exists but has no workers yet". A 404 would be the correct response for an unrecognised launcher.

`queryModelPerformance` always sets `complexity: null`, `avg_cost_usd: null`, and `failure_rate: null` in the mapper (line 205). The DTO declares those fields as `@ApiPropertyOptional` which is fine, but callers that depend on `failureRate` will always see `null` regardless of what data exists. This is a permanent silent stub — the SQL CTE does not compute these values and they are hard-coded to null.

### 2. What user action causes unexpected behavior?

A user fetching `/api/analytics/model-performance/claude%2Fsonnet` (model ID with a slash) will trigger NestJS to try to match `claude` against the `:modelId` param and interpret `sonnet` as the next path segment, returning 404 instead of forwarding the encoded model ID. No encoding validation is in place.

A user hitting `/api/analytics/launcher/` (trailing slash, no launcherId) will fall through to the `GET /api/analytics/launcher/:launcherId` route with `launcherId = ""`. The service will filter workers where `w.launcher === ""`, return an empty array, and respond HTTP 200. There is no guard that rejects a blank launcherId.

### 3. What data makes this produce wrong results?

`pickBestModel` treats `avg_review_score = null` as -1 during comparison. If all candidates for a task type have null scores, all compare equal and the tiebreaker fires on `avg_duration_minutes`. If all duration values are also null, `Infinity === Infinity`, so the reduce always returns `best` (never `current`). Result: the first row in the DB wins regardless of any other signal. The `buildRecommendation` fallback branch (`"Only model with data"`) is then emitted — correct text, but the selection is arbitrary insertion order, not any meaningful ranking.

`completionRate` calculation at line 126: `completedCount / total`. `completedCount + failedCount` can be less than `total` when workers are in intermediate states (`running`, `pending`, `spawned`). The completion rate therefore appears lower than reality during active sessions. No in-flight worker exclusion or note in the DTO docs.

The `review_data` correlated subquery in `queryModelPerformance` matches `model_that_reviewed`, not `model_that_built`. This means `avg_review_score` in the performance matrix is the score a model received **from reviewing others**, not the score its own work received in reviews. This is semantically backwards for a "model performance" endpoint. A model that reviewed many tasks will have a score; a model that built many tasks but was never a reviewer will show `null`. The DTO description says "Average review score (0–10)" which a consumer will reasonably read as "how well did this model's work score", not "how well did this model score while reviewing".

### 4. What happens when dependencies fail?

`cortex.getWorkers()` opens a new SQLite connection on every call (see `openDb()` in cortex.service.ts). For the launcher endpoint, if the DB is available when `isAvailable()` was last checked but becomes unavailable between the check and `openDb()` inside `getWorkers()`, `openDb()` returns null, `getWorkers()` returns null, and the service correctly returns null, which the controller turns into 503. This path works.

However the DB open/close pattern (open → query → close) means the launcher endpoint opens and closes a SQLite file handle once per HTTP request with no connection pooling. Under concurrent requests this is safe (better-sqlite3 is synchronous) but creates repeated filesystem opens. Not a correctness failure but a performance concern at scale.

`cortex.getModelPerformance()` is called twice in `getRoutingRecommendations` — once for the full matrix (no: once total). Actually it is called once; the routing endpoint shares the same single call. Fine. But there is no caching or debounce. Every route hit runs a full CTE query against SQLite.

### 5. What's missing that the requirements didn't mention?

The task description says "Data from cortex get_model_performance, **get_provider_stats**, query_events, workers table." The `get_provider_stats` and `query_events` data sources are not used at all. The routing recommendations endpoint is built purely from `getModelPerformance()`. Provider-level stats (cost per provider, token efficiency by provider) are absent.

Input validation is missing everywhere. `modelId` and `launcherId` path params accept any string including empty string, path traversal sequences, or excessively long inputs. The task type query param on model-performance is also unvalidated.

There are no tests. Zero spec files exist for any analytics file. The task does not explicitly require tests but the implementation has non-trivial aggregation logic (`pickBestModel`, `aggregateLauncherWorkers`) that is untested.

---

## Failure Mode Analysis

### Failure Mode 1: `failureRate`, `complexity`, `avgCostUsd` are permanently null

- **Trigger**: Any call to the model performance endpoints.
- **Symptoms**: Clients always receive `failureRate: null`, `avgCostUsd: null`, `complexity: null` regardless of what data is in the DB.
- **Impact**: Three of the eleven DTO fields are permanently stubbed. The DTO advertises them as real data; consumers building routing logic on `failureRate` get silent misinformation.
- **Current Handling**: Hardcoded `null` in `queryModelPerformance` mapper (line 205 of cortex-queries-worker.ts).
- **Recommendation**: Either remove these fields from `ModelPerformanceRowDto` or extend the SQL CTE to compute them. The workers table has `outcome` which can be used for failure rate. Cost is available in `cost_json`.

### Failure Mode 2: Launcher endpoint returns 200 + empty array for unknown launcher

- **Trigger**: `GET /api/analytics/launcher/nonexistent-launcher`.
- **Symptoms**: `{ data: [], total: 0 }` with HTTP 200. Client cannot distinguish "no data yet" from "launcher does not exist".
- **Impact**: Frontend dashboards may show a blank chart instead of an error state. Typos in launcher IDs are silently accepted.
- **Current Handling**: No 404 guard in service or controller.
- **Recommendation**: After filtering workers, if `filtered.length === 0` and a specific `launcherId` was requested, throw `NotFoundException`. Alternatively document that 200 + empty is the intended contract, and add a note in the DTO.

### Failure Mode 3: `avg_review_score` measures reviewer performance, not builder performance

- **Trigger**: Any model that has phases but has never acted as a reviewer gets `avg_review_score: null`.
- **Symptoms**: Models that did the most build work appear to have no review score; review-only models appear to have scores. The routing recommendation favours models that happen to have reviewed many tasks.
- **Impact**: `getRoutingRecommendations` picks the wrong model for task types where the best builder never acted as reviewer.
- **Current Handling**: SQL uses `r.model_that_reviewed` in `review_data` CTE.
- **Recommendation**: Use `r.model_that_built` to join reviews back to phases, or join `reviews` through `workers` to match `workers.model` that ran the phase, and average the `score` the built work received. This is a business logic correctness bug.

### Failure Mode 4: In-memory full-table worker scan on every launcher request

- **Trigger**: `GET /api/analytics/launcher/:launcherId` with a large workers table.
- **Symptoms**: Response is correct but fetches all workers and discards most of them in memory.
- **Impact**: Memory pressure and unnecessary SQLite I/O as the project accumulates worker history. At 10,000 workers this means deserialising 10,000 rows, parsing `tokens_json` and `cost_json` on each, only to discard 9,900.
- **Current Handling**: `cortex.getWorkers()` has no launcher filter. The filter is applied in-memory in `getLauncherMetrics`.
- **Recommendation**: Add `launcher?: string` to the `queryWorkers` filters and pass it through `CortexService.getWorkers()`.

### Failure Mode 5: `pickBestModel` is non-deterministic when all scores and durations are null

- **Trigger**: Task type where all models have `avg_review_score = null` and `avg_duration_minutes = null`.
- **Symptoms**: The first model in DB insertion order wins. The `reason` string correctly says "Only model with data" but this is misleading if there are actually multiple models.
- **Impact**: Routing recommendations are arbitrary for new task types. Over time as real data accumulates this heals itself, but early in a project's lifecycle recommendations are meaningless noise.
- **Current Handling**: `reduce` falls through both score and duration checks and stays on `best`.
- **Recommendation**: When all candidates have null scores, emit a recommendation only for the model with the most `phase_count` evidence. Document this tiebreaker.

### Failure Mode 6: `completionRate` underreports during active sessions

- **Trigger**: Workers still in `running` or `spawned` status are counted in `totalWorkers` but not in `completedCount` or `failedCount`.
- **Symptoms**: A session with 10 spawned workers of which 8 completed and 2 are still running shows `completionRate: 0.8` instead of a pending/active indicator.
- **Impact**: Dashboard may show artificially low completion rate for launchers during active orchestration runs.
- **Current Handling**: No separation of terminal vs in-flight workers.
- **Recommendation**: Document the semantic (completion rate includes only terminal workers) or expose `inFlightCount` separately.

### Failure Mode 7: Empty `launcherId` path param accepted

- **Trigger**: `GET /api/analytics/launcher/` (blank param, though NestJS may 404 this) or a client that sends an empty string in a programmatic call.
- **Symptoms**: The service runs `workers.filter(w => w.launcher === "")` which returns workers with no launcher set (if any), or returns empty array.
- **Impact**: Incorrect query semantics masked as a valid response.
- **Current Handling**: No guard.
- **Recommendation**: Add a guard: `if (!launcherId?.trim()) throw new BadRequestException(...)`.

---

## Critical Issues

### Issue 1: `avg_review_score` is reviewer score, not builder score

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts:183`
- **Scenario**: Every query to model-performance and routing-recommendations.
- **Impact**: Routing recommendations are computed on the wrong metric. Models selected as "best" may be models that reviewed most frequently, not models that produced the best-scoring work.
- **Evidence**: `review_data` CTE uses `r.model_that_reviewed AS model`. The mapper then reports this as `avgReviewScore` on `ModelPerformanceRowDto` which consumers will interpret as "score this model's work received".
- **Fix**: Change the CTE to join reviews through phases or workers to get `model_that_built` and average the scores received by that model's built work: `SELECT r.model_that_built AS model, t.type AS task_type, r.score FROM reviews r LEFT JOIN tasks t ON r.task_id = t.id WHERE 1=1${reviewWhere}`. Update `reviewWhere` model filter to `r.model_that_built = ?` accordingly.

### Issue 2: `failureRate`, `avgCostUsd`, `complexity` are permanently null stubs

- **File**: `apps/dashboard-api/src/dashboard/cortex-queries-worker.ts:201-206`
- **Scenario**: Every model performance response.
- **Impact**: Three advertised DTO fields carry no data. Any consumer building failure-aware routing logic receives silent misinformation (`null` instead of a real rate).
- **Evidence**: `complexity: null, avg_cost_usd: null, failure_rate: null` hardcoded in the mapper.
- **Fix**: Either (a) remove fields from `ModelPerformanceRowDto` and `CortexModelPerformance` with a comment explaining they are future work, or (b) compute them. `failure_rate` can be derived from `phases.outcome` where outcome = 'FAILED' / total phases. `avg_cost_usd` requires joining workers to phases by `worker_run_id` and averaging `cost_json`.

### Issue 3: Full workers table scan for per-launcher query

- **File**: `apps/dashboard-api/src/analytics/analytics.service.ts:42`
- **Scenario**: Every call to `GET /api/analytics/launcher/:launcherId`.
- **Impact**: Loads the entire workers table into memory, parses every `tokens_json` and `cost_json` JSON blob, then discards all but the matching launcher's rows. Will degrade as worker history accumulates.
- **Evidence**: `this.cortex.getWorkers()` is called without any filter. The `queryWorkers` function supports `sessionId` and `status` filters but not `launcher`.
- **Fix**: Add `launcher?: string` to the `queryWorkers` filter, pass it through `CortexService.getWorkers()`, and call `this.cortex.getWorkers({ launcher: launcherId })` in the service.

---

## Serious Issues

### Issue 4: No 404 for unknown launcher

- **File**: `apps/dashboard-api/src/analytics/analytics.service.ts:41-55`
- **Scenario**: `GET /api/analytics/launcher/typo-launcher-name`
- **Impact**: Returns HTTP 200 with empty array. Caller cannot distinguish "no data yet" from "launcher does not exist". Frontend charts will show blank state with no error.
- **Fix**: In `getLauncherMetrics`, after filtering workers, if the result is empty and `launcherId` was provided, return null or a sentinel so the controller can throw `NotFoundException`.

### Issue 5: No input validation on path/query params

- **File**: `apps/dashboard-api/src/analytics/analytics.controller.ts` (all routes)
- **Scenario**: Empty string launcherId, excessively long modelId, SQL special characters in taskType query param.
- **Impact**: The SQLite layer uses parameterised queries so injection is not a risk, but empty launcherId causes meaningless queries, and malformed input is never rejected at the boundary.
- **Fix**: Add NestJS `ValidationPipe` with class-validator decorators on query/param DTOs, or add manual guards: `if (!launcherId?.trim()) throw new BadRequestException(...)`.

### Issue 6: `pickBestModel` arbitrary tiebreak when all candidates have null scores AND null duration

- **File**: `apps/dashboard-api/src/analytics/analytics.service.ts:168-185`
- **Scenario**: Early project state where a new task type has multiple models with no review scores or timing yet.
- **Impact**: Routing recommendation is insertion-order-dependent. The `reason` text says "Only model with data" which is incorrect when there are multiple models.
- **Fix**: When multiple candidates exist and all have null scores, pick the one with the highest `phase_count`. Update `buildRecommendation` to say "Most phases logged (X) — no review scores yet" instead of "Only model".

---

## Moderate Issues

### Issue 7: `ModelPerformanceRowDto` has no `@ApiResponse` on controller methods

- **File**: `apps/dashboard-api/src/analytics/analytics.controller.ts`
- **Impact**: Swagger will not show the response schema. Other endpoints in this codebase use `@ApiResponse` decorators. Consistency gap.
- **Fix**: Add `@ApiResponse({ status: 200, type: ModelPerformanceResponseDto })` etc. to each handler.

### Issue 8: `completionRate` semantics not documented and misleading during active sessions

- **File**: `apps/dashboard-api/src/analytics/analytics.dto.ts:74`
- **Impact**: DTO says "completedCount / totalWorkers" but during active sessions this drops artificially because in-flight workers count toward the denominator.
- **Fix**: Add `@ApiProperty` description: "Terminal completion rate. In-flight workers count toward totalWorkers but not completedCount, so this drops during active sessions." Or expose `inFlightCount` explicitly.

### Issue 9: `mapModelPerf` is an arrow function used as a method reference without binding

- **File**: `apps/dashboard-api/src/analytics/analytics.service.ts:82-97`
- **Impact**: `rows.map(this.mapModelPerf)` — `mapModelPerf` is a regular method called without binding. It does not use `this` internally so it works today, but if a future maintainer adds a `this` reference it will silently break. Pattern inconsistency.
- **Fix**: Either make it a static method (`private static mapModelPerf`) to document the intent, or call it as `rows.map((r) => this.mapModelPerf(r))`.

### Issue 10: `analytics.dto.ts` not listed in task file scope

- **File**: `task-tracking/TASK_2026_216/task.md`
- **Impact**: The task scope only lists controller, service, and module. The DTO file was created but is not tracked. Minor bookkeeping gap.
- **Fix**: Add `apps/dashboard-api/src/analytics/analytics.dto.ts` to the task file scope.

---

## Data Flow Analysis

```
GET /api/analytics/model-performance?taskType=FEATURE

  AnalyticsController.getModelPerformance(taskType)
    |
    v
  AnalyticsService.getModelPerformance({ taskType })
    |
    v
  CortexService.getModelPerformance({ taskType })
    |
    +-- openDb() — opens SQLite file (new connection each call)
    |
    v
  queryModelPerformance(db, { taskType })
    |
    +-- CTE phase_data: filters by t.type = taskType   [OK]
    +-- CTE review_data: filters by t.type = taskType  [OK]
    +-- GROUP BY model, task_type                       [OK]
    +-- review_count / avg_review_score via correlated  [CONCERN: uses model_that_reviewed, not model_that_built]
    +-- complexity / avg_cost_usd / failure_rate        [CRITICAL: always null, not computed]
    |
    v
  CortexModelPerformance[] returned                     [OK]
    |
    v
  rows.map(this.mapModelPerf)                           [CONCERN: unbound method]
    |
    v
  ModelPerformanceResponseDto { data, total }           [OK]
    |
    v
  Controller returns DTO                                [OK]


GET /api/analytics/launcher/:launcherId

  AnalyticsController.getLauncherMetrics(launcherId)
    |
    v
  AnalyticsService.getLauncherMetrics(launcherId)
    |
    v
  CortexService.getWorkers()  <-- NO filter passed     [CRITICAL: full table scan]
    |
    v
  All workers loaded into memory
    |
    v
  workers.filter(w => w.launcher === launcherId)        [SERIOUS: empty string not guarded]
    |
    v
  if filtered.length === 0                              [SERIOUS: returns 200 not 404]
    |
    v
  groupWorkersByLauncher(filtered)
    |
    v
  aggregateLauncherWorkers                              [MODERATE: completionRate misleading during active sessions]
    |
    v
  LauncherMetricsResponseDto { data, total }            [OK]
```

### Gap Points Identified:

1. `review_data` CTE measures the wrong actor — reviewer instead of builder.
2. Three DTO fields (`failureRate`, `avgCostUsd`, `complexity`) carry hardcoded null, not computed data.
3. Workers table is fully scanned per request when a launcher-filtered SQL query is available.
4. No 404 path for unknown launcher — empty array + 200 is ambiguous.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| GET /api/analytics/model-performance (full matrix) | COMPLETE | failureRate/cost/complexity always null |
| GET /api/analytics/model-performance/:modelId (per-model) | COMPLETE | Same null stubs |
| GET /api/analytics/launcher/:launcherId (aggregate by launcher) | PARTIAL | Full table scan; no 404 for unknown launcher |
| GET /api/analytics/routing-recommendations | PARTIAL | Selects on reviewer score, not builder score |
| Data from cortex get_model_performance | COMPLETE | — |
| Data from get_provider_stats | MISSING | Not used anywhere |
| Data from query_events | MISSING | Not used anywhere |
| Data from workers table | PARTIAL | Used but via full scan |
| New NestJS module | COMPLETE | Module properly registered |

### Implicit Requirements NOT Addressed:

1. Callers need to distinguish "launcher not found" from "launcher has no workers yet" — no 404 path exists.
2. Query param sanitisation / input validation at the HTTP boundary.
3. The task description listed `get_provider_stats` and `query_events` as data sources — neither is integrated.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| DB unavailable | YES | null → 503 via ServiceUnavailableException | Works correctly |
| Empty model performance table | YES | Returns `{ data: [], total: 0 }` | Acceptable |
| Unknown modelId | YES | Returns `{ data: [], total: 0 }` + 200 | Same ambiguity as launcher; no 404 |
| Unknown launcherId | NO | Returns empty 200 | Should 404 |
| Blank launcherId string | NO | Filters workers where launcher = "" | No guard |
| All candidates have null scores | PARTIAL | Falls back to duration, then insertion order | Tiebreak is non-deterministic |
| Workers in intermediate state (running/spawned) | NO | Counted in total, lowers completionRate | No documentation |
| taskType query param with special chars | NO | Passed directly to SQL (parameterised, so safe) | No rejection of obviously invalid values |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| CortexService.getModelPerformance() | LOW | 503 returned, logged | Adequate |
| CortexService.getWorkers() — full scan | MED (grows over time) | Slow response, high memory | Add launcher filter to queryWorkers |
| SQLite open per request | LOW now | File handle churn under concurrent load | Better-sqlite3 sync; tolerable for now |
| queryModelPerformance CTE | LOW | Wrong `avg_review_score` silently returned | Semantic bug, not crash |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: `avg_review_score` is the wrong metric — it measures how active a model is as a reviewer, not how well a model's build output scored. This is the primary input to `getRoutingRecommendations`, meaning the routing logic recommends the most-reviewing model, not the best-building model. This is a silent correctness bug that passes all happy-path tests.

---

## What Robust Implementation Would Include

- SQL CTE that computes `failure_rate` from `phases.outcome` and `avg_cost_usd` from `workers.cost_json` joined to phases via `worker_run_id`.
- `review_data` CTE using `model_that_built` to capture the score a model's work received.
- A `launcher` filter in `queryWorkers` to avoid full table scans.
- `NotFoundException` when a specific launcher ID produces zero workers.
- `BadRequestException` for empty string path params.
- `@ApiResponse` decorators on all controller methods for Swagger completeness.
- At minimum a unit test for `pickBestModel` covering: all-null scores, score tie resolved by duration, single candidate.
- An explicit `inFlightCount` field in `LauncherMetricsDto` so `completionRate` semantics are unambiguous.
