# Code Logic Review — TASK_2026_171

## Summary

| Metric              | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Overall Score       | 6/10                                                       |
| Assessment          | NEEDS_REVISION                                             |
| Critical Issues     | 3                                                          |
| Serious Issues      | 5                                                          |
| Moderate Issues     | 4                                                          |
| Failure Modes Found | 8                                                          |

All five report types are implemented. The happy path works. Export is functional (CSV only — PDF is not delivered, which the task requires). Several logic bugs and data-correctness gaps will silently produce wrong numbers in common scenarios.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `cortexService.getTasks()` and `cortexService.getWorkers()` return `null` when the DB is unavailable. `ReportsService.getOverview` coerces both to `[]` with `?? []`. The report then returns all zeros with no signal to the caller that the underlying data source was unavailable. The API returns HTTP 200 with a zero-filled payload — the user sees "Total Cost: $0.00" and cannot distinguish a real zero from a connection failure.
- `buildQualityCategories` (helpers line 296) adds `Math.max(review.moderateIssues, 1)` even when there are zero moderate issues. Every category is inflated by at least 1 per review, making category counts meaningless when most reviews have zero moderate issues.
- `parseCompactionCount` (helpers line 57) matches any table row with exactly 9 pipe-delimited cells and treats the last column as a compaction count. This will mis-fire on review tables, pipeline tables, or any markdown table with 9 columns, silently adding phantom compaction counts.

### 2. What user action causes unexpected behavior?

- Clicking "Apply Range" with only a `from` date (no `to`) is fully valid per the filter UI, but `withinRange` on line 69 of helpers treats a null `to` as unbounded. This is correct behavior — but the date inputs are bound to `[max]="overview.dateRange.availableTo"`. After the first load, if `availableTo` is null the max attribute disappears, allowing the user to type a future date that returns no data with no feedback.
- Clicking "Reset" resets `from` and `to` to `''` and calls `load()`. The API call passes `from: undefined, to: undefined`. The service validates with `DATE_RE.test(from)` — `undefined` is coerced to the string `'undefined'` in some JS engines, but NestJS's `@Query()` decorator delivers it as `undefined` so `from ?? null` yields `null` correctly. This is safe — but only because two coercions cancel out; a single change in how NestJS passes missing query params would break it.
- Rapid clicking "Apply Range" fires multiple concurrent API calls. The component uses `takeUntilDestroyed` but does NOT cancel the previous in-flight request. Responses can arrive out-of-order and the last response to arrive (not the last to be sent) sets the state.

### 3. What data makes this produce wrong results?

- A `CortexTask` whose `complexity` field is `null` or `undefined` (which can happen for tasks created before the complexity field was added to the schema) will produce a `SuccessRateRow` with `label: undefined`. This is rendered in the table and exported to CSV as `undefined` rather than a fallback string.
- `overallSuccessRate` (reports.service.ts line 86) is computed with a conditional chain that checks `successRows[0].dimension === 'taskType'`. Because `buildSuccessRows` sorts by `successRate DESC` then `total DESC`, the first row is only a `taskType` row if the highest-success-rate task type happens to sort before all other dimensions. If a `complexity` or `model` dimension row has a higher success rate, `overallSuccessRate` returns 0 instead of the real overall success rate. This is a silent correctness bug — the summary card will show 0% overall success even when most tasks complete.
- `buildCostTrend` (helpers line 142) uses `session.started_at.slice(5, 10)` as the label, which yields `MM-DD` (e.g., `03-15`). When sessions span multiple years, two sessions from different years on the same calendar date collapse to the same label, misrepresenting the trend.
- `summarizePrimaryModel` (helpers line 203) uses `Math.max(worker.cost, 1)` as a tiebreaker weight. For workers with a cost of 0 (e.g., failed workers that spent no tokens), this inflates the weight to 1, potentially overriding the correct primary model with a zero-cost failed worker if both have equal adjusted weights.

### 4. What happens when dependencies fail?

| Dependency | Failure | Current Handling | Assessment |
|---|---|---|---|
| Cortex DB unavailable | `getTasks()` returns `null` | Coerced to `[]` with `?? []` | CONCERN: 200 with zeros, no signal |
| Session filesystem missing | `safeReadDir` returns `[]` | Returns empty array | OK: graceful empty |
| Review file missing | `safeReadFile` returns `''` | Filtered via `if (!content)` | OK |
| `stat()` on review file | Can throw if file disappears between `readdir` and `stat` | Not caught — `stat` is not wrapped in try/catch | CONCERN: throws unhandled exception, bubbles to 500 |
| Cortex DB returns null for `getModelPerformance` | `?? []` | OK — but `buildModelPerformanceRows([])` returns empty rows, summary shows "No model data" | OK |

### 5. What's missing that the requirements didn't mention?

- **PDF export**: The task says "exportable (CSV/PDF)". Only CSV is implemented. `reports-export.ts` contains only `downloadCsv`. There is no PDF path anywhere in the codebase for this feature.
- **Navigation link**: `mock-data.constants.ts` has the reports nav entry, and the route is registered. But no nav guard or loading state prevents the user from seeing an empty/loading state if they navigate before `ngOnInit` fires — this is minor, but the component uses `ChangeDetectionStrategy.OnPush` without signals or `markForCheck()` after the async response arrives. The `loading` and `overview` properties are plain class fields, not signals. With `OnPush`, the template may never re-render after the observable emits because no `ChangeDetectorRef.markForCheck()` is called.
- **No date validation on the filter inputs**: the user can enter `to` < `from`. The backend `withinRange` will return 0 results silently — no error, no feedback.

---

## Failure Mode Analysis

### Failure Mode 1: `overallSuccessRate` returns 0 incorrectly

- **Trigger**: Any dataset where a `model` or `complexity` dimension row achieves a higher `successRate` than every `taskType` row. Because `buildSuccessRows` sorts all dimensions together by `successRate DESC`, the first element of the sorted array may not be a `taskType` row.
- **Symptoms**: Summary card shows "Overall Success: 0.0%". No error is thrown. User cannot tell if the zero is real or a computation bug.
- **Impact**: Misleading KPI. This is the most prominent number on the success rate report card.
- **Current Handling**: None. The conditional `successRows[0].dimension === 'taskType' ? ... : 0` explicitly hard-codes the zero fallback.
- **Recommendation**: Compute `overallSuccessRate` directly from the filtered task list, not by peeking at the sorted row array.

### Failure Mode 2: `stat()` throws if a review file disappears between `readdir` and `stat`

- **Trigger**: File system race — review file is deleted or moved while `readReviews` is iterating.
- **Symptoms**: Unhandled promise rejection, caught by the controller's try/catch, returns HTTP 500 to the frontend. Page shows "Reports are unavailable".
- **Impact**: The entire reports page fails because of one stale review artifact.
- **Current Handling**: `safeReadFile` is safe, but `stat()` on line 169 of reports.service.ts is called directly without any try/catch.
- **Recommendation**: Wrap `stat()` in a try/catch. On failure, skip the review file rather than crashing the whole request.

### Failure Mode 3: `OnPush` component never re-renders

- **Trigger**: The `ReportsComponent` uses `ChangeDetectionStrategy.OnPush` but stores state in plain mutable class fields (`this.overview`, `this.loading`, etc.) rather than signals. With `OnPush`, Angular only runs change detection when an `@Input()` reference changes or `markForCheck()` is called. Observable subscriptions do not automatically schedule a check.
- **Symptoms**: After the API response arrives, the loading spinner stays visible. Or the page appears blank even though `this.overview` was populated. Depends on Angular's zone.js integration — if using `zone.js` (default), zone-aware observables trigger change detection automatically. But if the app migrates to zoneless (which is the direction Angular 17+ pushes), this breaks immediately.
- **Impact**: Reports page shows stale/loading state.
- **Current Handling**: None.
- **Recommendation**: Either add `inject(ChangeDetectorRef).markForCheck()` in the subscription, or migrate state to `signal()` / `computed()`.

### Failure Mode 4: `buildQualityCategories` inflates every category count

- **Trigger**: Any review with 0 moderate issues.
- **Symptoms**: Category counts in the "Quality Trends" table are higher than actual findings. A category that had only 1 critical issue and 0 moderate issues counts as 2.
- **Impact**: Top category metric and category rankings are directionally wrong. Not immediately obvious from the UI.
- **Current Handling**: `Math.max(review.moderateIssues, 1)` on helpers line 296 is the bug.
- **Recommendation**: Remove the `Math.max(..., 1)` guard. Sum actual counts. If the intent was to ensure at least one entry per review, that logic belongs elsewhere.

### Failure Mode 5: Cortex unavailability is invisible to the user

- **Trigger**: Cortex DB file does not exist or is locked when `ReportsService.getOverview` runs.
- **Symptoms**: All cortex-derived data (cost analysis, model performance, success rate from DB tasks) returns zeros. Session report and quality trends (filesystem-derived) may still have real data. The overall page looks partially populated but the user cannot distinguish "no data yet" from "DB is down".
- **Impact**: Misleading — a cost report showing $0 when real costs exist.
- **Current Handling**: `this.cortexService.getTasks() ?? []` silently substitutes empty arrays.
- **Recommendation**: Track whether cortex returned null vs. an empty array. Surface a "cortex data unavailable" warning in the API response so the frontend can display a banner.

### Failure Mode 6: `parseCompactionCount` regex matches wrong table rows

- **Trigger**: Any session state.md file that has a markdown table with exactly 9 pipe-delimited columns where the last column is a number — review tables, phase tables, worker tables.
- **Symptoms**: Compaction count for sessions is inflated by phantom matches.
- **Impact**: `averageCompactions` in session summary is wrong. Session rows show incorrect compaction counts.
- **Current Handling**: None. The regex is too broad.
- **Recommendation**: Match specifically for compaction marker patterns (e.g., lines containing the word "Compaction" or a specific column header) rather than any 9-column table row.

### Failure Mode 7: Multi-year cost trend collapse

- **Trigger**: Sessions from two different years on the same calendar day (e.g., `2025-03-15` and `2026-03-15`).
- **Symptoms**: Both sessions appear under the same trend label `03-15`, and their costs are rendered as two separate bars with the same label. Charts and exports become ambiguous.
- **Impact**: Cost trend chart is misleading for projects running across calendar years.
- **Current Handling**: `session.started_at.slice(5, 10)` — year is dropped.
- **Recommendation**: Use `session.started_at.slice(0, 10)` for uniqueness, or group by year-month at minimum.

### Failure Mode 8: Rapid filter application race condition

- **Trigger**: User clicks "Apply Range" twice quickly.
- **Symptoms**: Two API requests in flight. The first response can overwrite the second if network latency differs.
- **Impact**: Stale data displayed after the second click, user may not notice.
- **Current Handling**: `takeUntilDestroyed` only cancels on component destroy, not on the next filter action.
- **Recommendation**: Use `switchMap` instead of a bare `subscribe` — each new filter emission would cancel the previous in-flight request.

---

## Critical Issues

### Issue 1: `overallSuccessRate` produces 0 when it should not

- **File**: `apps/dashboard-api/src/dashboard/reports.service.ts`, line 86
- **Scenario**: Any dataset where a non-`taskType` dimension row sorts first due to a higher success rate.
- **Impact**: The headline KPI on the success rate report is wrong. Users make workflow decisions based on this number.
- **Evidence**: The computation peeks at `successRows[0].dimension === 'taskType'` — but `buildSuccessRows` sorts all dimensions together. If `model: 'claude-opus-4-6'` has a 100% rate with 5 tasks and the best task type has 85%, the first row is a model row, and `overallSuccessRate` returns 0.
- **Fix**: Compute overall success rate from the filtered cortex tasks directly: count COMPLETE status tasks divided by total filtered tasks.

### Issue 2: `stat()` call is not wrapped — can throw and crash the entire reports request

- **File**: `apps/dashboard-api/src/dashboard/reports.service.ts`, line 169
- **Scenario**: A review file is deleted or renamed between `readdir` listing it and `stat()` being called on it.
- **Impact**: Unhandled rejection propagates to the controller's generic catch, returning HTTP 500. The entire reports page becomes unavailable because of one missing file.
- **Evidence**: `const fileStat = await stat(filePath);` — no try/catch wrapping this call.
- **Fix**: Wrap in try/catch inside the `Promise.all` map. On error, return `null` and let the existing null filter exclude it.

### Issue 3: PDF export not implemented (requirement stated CSV/PDF)

- **File**: `apps/dashboard/src/app/views/reports/reports-export.ts`
- **Scenario**: User clicks any export button expecting PDF.
- **Impact**: The task acceptance criteria states "exportable (CSV/PDF)". PDF is entirely absent. All five export buttons only produce CSV. The `downloadCsv` function is the only export utility.
- **Evidence**: `reports-export.ts` contains one function: `downloadCsv`. No PDF library is used anywhere in the frontend.
- **Fix**: Either implement PDF export (e.g., using the browser's print-to-PDF, `jsPDF`, or server-side generation), or update the acceptance criteria to reflect CSV-only delivery and document the gap.

---

## Serious Issues

### Issue 4: `buildQualityCategories` inflates counts with `Math.max(..., 1)`

- **File**: `apps/dashboard-api/src/dashboard/reports.helpers.ts`, line 296
- **Scenario**: Any review file with 0 moderate issues (common for APPROVED reviews).
- **Impact**: Every category's count is inflated by 1 per review processed. A category that appears in 10 reviews, each with 0 moderate issues, shows a count 10 higher than the real finding count.
- **Fix**: Replace `Math.max(review.moderateIssues, 1)` with `review.moderateIssues`.

### Issue 5: `parseCompactionCount` regex is too broad

- **File**: `apps/dashboard-api/src/dashboard/reports.helpers.ts`, line 57-63
- **Scenario**: Any session state.md with markdown tables having 9 pipe-separated columns (e.g., worker tables, task tables).
- **Impact**: Compaction counts for all sessions are likely wrong — inflated by rows from unrelated tables.
- **Fix**: Target the specific markdown pattern that indicates a compaction event rather than matching any 9-column table row.

### Issue 6: `OnPush` component stores state in mutable class fields, not signals

- **File**: `apps/dashboard/src/app/views/reports/reports.component.ts`, lines 21-29
- **Scenario**: With `ChangeDetectionStrategy.OnPush`, change detection does not run on arbitrary field mutations. Currently works under zone.js but will break with Angular's zoneless mode, which is the project direction.
- **Impact**: Reports page may not update after API response in future Angular versions, or in any SSR/zoneless context.
- **Fix**: Convert `overview`, `loading`, `unavailable`, and the max-value fields to `signal()`. The template already uses direct property access and will work with signals without changes.

### Issue 7: Missing `switchMap` for filter application — stale data race

- **File**: `apps/dashboard/src/app/views/reports/reports.component.ts`, line 65-88
- **Scenario**: Two "Apply Range" clicks within a typical HTTP round-trip window.
- **Impact**: Stale data displayed silently.
- **Fix**: Refactor `load()` to push filter params into a `Subject`, and use `switchMap` to cancel previous requests.

### Issue 8: `CortexTask.complexity` can be null/undefined — surfaces as `label: undefined` in rows and CSV

- **File**: `apps/dashboard-api/src/dashboard/reports.service.ts`, line 198
- **Scenario**: Tasks created before the `complexity` field was introduced in the cortex schema.
- **Impact**: Success rate table and CSV export contain `undefined` string in the Complexity rows. Not immediately obvious to the user.
- **Fix**: Use `task.complexity ?? 'Unknown'` as the dimension label.

---

## Moderate Issues

### Issue 9: `buildCostTrend` drops year from label — ambiguous across calendar years

- **File**: `apps/dashboard-api/src/dashboard/reports.helpers.ts`, line 144
- **Scenario**: Project runs across a year boundary.
- **Impact**: Cost trend chart has duplicate labels for the same calendar day in different years.
- **Fix**: Use `session.started_at.slice(0, 10)` for the label.

### Issue 10: No user feedback when filter range produces no data

- **File**: `apps/dashboard/src/app/views/reports/reports.component.html`
- **Scenario**: User sets `from` > `to`, or selects a date range with no data.
- **Impact**: All report sections show zeros with no explanation. User may think the system is broken.
- **Fix**: Add a "No data in this range" state to each section, triggered when totals are 0 and date range params are non-null.

### Issue 11: `summarizePrimaryModel` uses `Math.max(worker.cost, 1)` for failed workers

- **File**: `apps/dashboard-api/src/dashboard/reports.helpers.ts`, line 203
- **Scenario**: A task has one successful worker with cost $0.001 and one failed worker with cost $0.
- **Impact**: The failed worker gets a phantom weight of 1, which may outweigh the successful worker's real cost. The primary model for the task is misattributed.
- **Fix**: Use `worker.cost` directly. If tiebreaking is needed, use phase count or worker status rather than inflating zero-cost workers.

### Issue 12: Cortex data unavailability is invisible in the API response

- **File**: `apps/dashboard-api/src/dashboard/reports.service.ts`, lines 44-46
- **Scenario**: Cortex DB is unavailable.
- **Impact**: Report returns HTTP 200 with zeros. User cannot distinguish from an empty-data scenario.
- **Fix**: Add a `dataSourceWarnings: string[]` field to the `ReportsOverview` response shape. Populate it when cortex returns null. Display a banner in the frontend when warnings are present.

---

## Data Flow Analysis

```
Angular ReportsComponent.load()
  → ApiService.getReportsOverview({ from, to })
    → GET /api/reports/overview?from=X&to=Y
      → DashboardController.getReportsOverview()
        → ReportsService.getOverview(from, to)
          ├── readSessions(from, to)              [filesystem: task-tracking/sessions/SESSION_*/]
          │     ├── safeReadFile(state.md)
          │     ├── safeReadFile(analytics.md)
          │     ├── parseCostFromContent()         [regex-based parsing]
          │     ├── parseMetricValue()             [regex-based parsing]
          │     └── parseCompactionCount()         [CONCERN: too-broad regex, see Issue 5]
          ├── readReviews(from, to)               [filesystem: task-tracking/TASK_*/review-*.md]
          │     ├── safeReadFile(review-*.md)
          │     └── stat(filePath)                [CRITICAL: not wrapped in try/catch, Issue 2]
          ├── cortexService.getTasks()            [SQLite: opens/closes DB per call]
          │     └── returns null if DB absent     [CONCERN: coerced to [], Issue 12]
          ├── cortexService.getWorkers()          [SQLite]
          ├── cortexService.getSessions()         [SQLite]
          ├── cortexService.getModelPerformance() [SQLite]
          └── cortexService.getPhaseTiming()      [SQLite]
              ↓
          Build report structs (all helpers)
              ↓
          Return ReportsOverview (HTTP 200)
  ← Angular ReportsComponent receives response
    → Assigns to this.overview (plain field, not signal) [SERIOUS: Issue 6]
    → Template re-renders (relies on zone.js)
```

### Gap Points Identified

1. `stat()` can throw at line 169 — no error boundary.
2. Cortex null returns are silently promoted to empty arrays with no warning propagated to the response.
3. `overallSuccessRate` computed from sorted multi-dimension array — wrong when non-taskType row sorts first.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Session Report (per-session summary, tasks, cost, model, efficiency) | COMPLETE | `parseCompactionCount` regex may inflate counts |
| Task Success Rate Report (by type, complexity, model, period) | COMPLETE | `overallSuccessRate` returns 0 incorrectly in some datasets |
| Cost Analysis Report (token/cost trends, model breakdown, task-type breakdown) | COMPLETE | Cost trend labels drop year |
| Model Performance Report (completion rates, review scores, phase timings, cost efficiency) | COMPLETE | |
| Quality Trends Report (review scores, categories, risk areas) | COMPLETE | Category counts inflated by `Math.max(...,1)` |
| Date range selector | COMPLETE | No validation that `from` <= `to` |
| CSV export | COMPLETE | |
| PDF export | MISSING | Requirement states "CSV/PDF" — PDF not implemented |
| Meaningful insights | COMPLETE | Insights are directional and useful |

### Implicit Requirements NOT Addressed

1. No feedback when cortex DB is unavailable — user cannot distinguish zero data from connection failure.
2. No protection against `to < from` producing an empty and confusing report.
3. The `OnPush` component pattern will silently break when Angular zoneless mode is adopted.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| No session files on disk | YES | `safeReadDir` returns `[]` | OK |
| Session file missing state.md or analytics.md | YES | `safeReadFile` returns `''`, filtered as null | OK |
| Review file deleted between readdir and stat | NO | `stat()` throws uncaught | CRITICAL |
| Cortex DB absent | PARTIAL | Returns `null`, coerced to `[]` | No warning surfaced |
| `from` > `to` date filter | NO | Returns empty data silently | No user feedback |
| Task with null complexity | NO | `undefined` surfaces in rows and CSV | |
| Rapid filter clicks | NO | Race condition, last response wins | |
| Sessions spanning multiple years | NO | Year dropped from cost trend labels | |
| All workers have 0 cost | PARTIAL | `Math.max(..., 1)` creates phantom weights | Misattributes primary model |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| Cortex DB (SQLite) | MEDIUM (DB may not exist in all installs) | HIGH (zeros across 3 of 5 reports) | Coercion to `[]` with no warning |
| Filesystem session dirs | LOW | LOW (graceful empty) | `safeReadDir` OK |
| Filesystem review stat() | LOW | HIGH (entire request crashes) | NONE — needs fix |
| Angular HTTP | LOW | LOW (error state shown) | OK |

---

## Verdict

| Verdict | FAIL |
|---|---|
| Blocking Issues | PDF export not delivered (requirement gap); `stat()` not guarded (crashes entire reports endpoint on file race); `overallSuccessRate` computes 0 when it should not (misleading KPI) |
| Recommendation | Fix the three critical issues before marking COMPLETE. The five serious issues should be addressed in the same pass since they are small. |

---

## What Robust Implementation Would Include

- `stat()` wrapped in a per-file try/catch that skips the file on error instead of crashing the request.
- `overallSuccessRate` computed from the raw filtered task list, not by peeking at a sorted multi-dimension row array.
- A `dataSourceWarnings: string[]` field in `ReportsOverview` so the frontend can display a "cortex data unavailable" banner instead of silent zeros.
- `switchMap` in the Angular component to cancel in-flight requests when a new filter is applied.
- State in `signal()` properties rather than plain class fields to be `OnPush`-correct without relying on zone.js.
- PDF export or an explicit scope change that drops PDF from the acceptance criteria.
- `Math.max(review.moderateIssues, 1)` removed from `buildQualityCategories`.
- Year included in cost trend labels (`YYYY-MM-DD` or `YYYY-MM`).
