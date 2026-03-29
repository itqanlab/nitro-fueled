# Code Logic Review — TASK_2026_146

## Review Summary

| Metric              | Value                                         |
| ------------------- | --------------------------------------------- |
| Overall Score       | 6/10                                          |
| Assessment          | NEEDS_REVISION                                |
| Critical Issues     | 2                                             |
| Serious Issues      | 4                                             |
| Moderate Issues     | 3                                             |
| Failure Modes Found | 9                                             |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `ModelPerformanceComponent` loading state machine is broken by design. `loading` starts
`true` and is set to `false` only by the `effect()`. Because `initialValue: null` is used on
`toSignal`, the effect fires immediately with `null` — so `this.unavailable` is set to `true`
even on the very first render before the HTTP response has had a chance to arrive. The sequence
is: component constructs → effect fires with `null` → `unavailable = true`, `loading = false` →
the 503 banner and empty-state are both shown while the network request is still in-flight.
This is a silent failure from the user's perspective: they see "Cortex DB unavailable" even when
the API is fully healthy, because the error banner races the initial null signal value.

The `PhaseTimingComponent` shares the same pattern and suffers the same symptom.

The `SessionComparisonComponent` has the same constructor pattern and is equally broken.

### 2. What user action causes unexpected behavior?

**Filter + sort interaction in ModelPerformanceComponent**: `selectedTaskType` is a plain
mutable class field, not a signal. `rowsComputed` reads `this.selectedTaskType` directly
inside a `computed()`. In Angular's signal system, plain property reads inside `computed()`
are not tracked — only signal reads are. When the user changes the task-type filter,
`onTaskTypeChange()` manually calls `this.rows = this.rowsComputed()`, which works. But if
`sortBy()` is called after a filter change, `this.rowsComputed()` re-runs with the correct
filter value, so that path is fine. The real problem is that the filter can fall out of sync
when the HTTP data reloads (e.g., user refreshes manually via some future mechanism) because
the `effect()` re-runs `this.rows = this.rowsComputed()` but `selectedTaskType` may have
been set by the user — that part actually works correctly. However, the untracked read is a
design defect that will bite when the code is extended.

**Session row selection toggle breaks with sorted rows**: `toggleSelect` uses
`this.rows.indexOf(row)` to find the row. After `sortBy()` is called, `this.rows` is a
sorted copy; it still contains the same object references, so `indexOf` still finds them.
This is safe today, but only because object references are preserved. If rows are ever
re-fetched mid-view, the old row reference will not exist in the new array and `indexOf`
will return `-1` silently with no toggle.

**Task Trace `nzLoading` expression is semantically wrong**: `[nzLoading]="taskOptions().length === 0"`
is bound to the task selector. This expression is `true` when the task list is empty (either
because the API failed or because there are genuinely no tasks). A user looking at a system
with zero tasks will see a perpetual loading spinner on the dropdown that never resolves,
with no error message or empty state explaining why.

### 3. What data makes this produce wrong results?

**`computeQualityPerDollar` uses hardcoded pricing constants** (`$3/M input, $15/M output`).
These are approximate Claude Sonnet 3 prices. The system already stores the actual cost on
`CortexWorker.cost`, but `CortexModelPerformance` does not expose total cost — only token
counts. The token-based cost estimate will produce wrong quality-per-dollar values for any
non-Sonnet model (GPT-4o, GLM-5, Gemini, or future Claude models with different pricing),
silently misranking them. The ranking is the "core decision-making view" per the task
description, so incorrect ranking is a high-impact correctness bug.

**Phase timing `rangeWidth` can exceed 100%**: when `minMin` is close to `0` and `maxMin`
exceeds `globalMax` for a single phase... actually that can't happen since `globalMax` is the
max of avg values. But if the raw data has `max_duration_minutes` larger than the global max
of `avg_duration_minutes` (which is almost always true), `(maxVal - minVal) / globalMax` will
exceed 1.0, producing a `rangeWidth` greater than `100%`. The CSS bar will overflow its
container visually.

**Timeline sort uses `localeCompare` on ISO strings**: `timed.sort((a, b) => a.time.localeCompare(b.time))`
works only if timestamps are identical-format ISO-8601 strings. If any timestamp has a
different timezone offset suffix or millisecond precision, string sort produces wrong
chronological order. For example `"2026-03-29T10:00:00Z"` vs `"2026-03-29T10:00:00.000Z"`
sorts correctly, but `"2026-03-29T10:00:00+03:00"` would sort incorrectly relative to UTC.

**Reviews and fix cycles in the timeline always appear at the end** with `time: ''` (empty
string). The sort happens on `timed` before reviews and fix cycles are appended, so they are
always rendered after all workers/phases/events regardless of when they actually occurred.
This makes the Task Trace timeline misleading for tasks where a review happened mid-session
between two dev phases.

### 4. What happens when dependencies fail?

| Integration point                           | Failure scenario                                    | Current handling                          | Assessment             |
|---------------------------------------------|-----------------------------------------------------|-------------------------------------------|------------------------|
| `getCortexModelPerformance()` HTTP error    | API returns 500                                     | `catchError(() => of(null))` + effect     | Broken (see Issue 1)   |
| `getCortexPhaseTimings()` HTTP error        | API returns 500                                     | Same pattern                              | Broken (see Issue 1)   |
| `getCortexSessions()` HTTP error            | API returns 500                                     | Same pattern                              | Broken (see Issue 1)   |
| `getCortexTasks()` HTTP error (TaskTrace)   | Task list fails to load                             | `of(null)` → taskOptions returns `[]`     | Spinner never resolves |
| `getCortexTaskTrace(id)` HTTP error         | Trace endpoint 404 or 500                           | `catchError(() => of(null))`              | Shows empty state — OK |
| `selectedTaskId$.next(id)` before component destroys | Component destroyed mid-flight           | BehaviorSubject + toSignal with `takeUntilDestroyed` implicit | OK (Angular manages subscription) |

### 5. What's missing that the requirements didn't mention?

- **No date-range filter on Model Performance**: task.md specifies "Filter by date range, task type, complexity". Only `taskType` filter is implemented. `complexity` filter and date-range are both absent.
- **No complexity filter on Model Performance**: `CortexModelPerformance` does not expose a `complexity` field, so this cannot be implemented without an API change — but the absence is not documented anywhere in the component or handoff.
- **No phase duration trend view**: task.md specifies "Phase duration trends over time". The Phase Timing view only shows aggregate stats with no time-axis breakdown.
- **No outlier callout list**: task.md specifies "Outlier detection (phases that took 3x+ average)". The `isOutlier()` method exists and the row is highlighted, but there is no dedicated "outlier" summary section — a user must scan every row to find them.
- **Session Comparison "model mix" column is absent**: task.md specifies "Model mix used per session". `CortexSession` does not expose model mix at session level (only `supervisor_model`). This metric is missing with no user-visible indicator.
- **Session Comparison "tasks per hour" is absent**: task.md specifies "Tasks completed per hour". The computed `durationHours` exists but tasks-per-hour is never calculated or shown.

---

## Critical Issues

### Issue 1: Loading/unavailable state machine fires error before HTTP completes

**File**: `apps/dashboard/src/app/views/model-performance/model-performance.component.ts:71-83`
Also: `phase-timing.component.ts:56-69`, `session-comparison.component.ts:61-73`

**Scenario**: The component initialises, `toSignal` emits `initialValue: null` synchronously
in the same microtask. The `effect()` fires with `raw === null`, sets `unavailable = true` and
`loading = false`. The "Cortex DB unavailable" banner is rendered. The actual HTTP request
completes ~200ms later but in `model-performance.component.ts` the `if (raw === null)` branch
that sets `unavailable = true` has no companion that resets it once the real response arrives
because the else branch correctly sets `unavailable = false` — wait, actually this does reset.
Let me be precise: the **real** bug is that after the initial null fires and sets
`unavailable = true`, there is a flash of the error banner. For `ModelPerformanceComponent`
the else branch resets it on real data, so it self-heals. However, if the API fails, the
sequence is: null → unavailable banner → never clears. The `loading` calculation on line 74
is:

```typescript
this.loading = raw === null && !this.unavailable;
```

When `unavailable` is set `true` and then the signal stays `null` (real API error), `loading`
is `false` but `unavailable` is `true` — this is the correct terminal error state. So the
logic is *eventually* correct but produces a false-positive flash of the unavailable banner
on every page load on healthy systems. This is a poor UX that looks like a real error.

**Impact**: Users see "Cortex DB unavailable" every time the page loads (for ~200ms), which
erodes trust in the status message. More importantly, `PhaseTimingComponent` does not have
the `loading = raw === null && !this.unavailable` guard on line 74 — it sets `loading = false`
unconditionally in both branches, so there is no loading skeleton for the phase timing view at
all (the skeleton guard is `@if (loading && !unavailable)` — once `null` fires, `loading`
becomes `false` and the skeleton never appears).

**Severity**: HIGH

**Fix**: Distinguish "initial null" from "error null". Use a separate `LoadingState` enum with
`PENDING | LOADED | ERROR` instead of two booleans, or check `raw === null && this.loading`
only after a non-null value has been received.

---

### Issue 2: `computeQualityPerDollar` uses hardcoded Claude Sonnet pricing for all models

**File**: `apps/dashboard/src/app/views/model-performance/model-performance.adapters.ts:25-35`

```typescript
const estimatedCost =
  (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
```

**Scenario**: The user compares GLM-5 (much cheaper per token) against Claude Sonnet. GLM-5's
actual cost-per-token is approximately 10x lower, but this formula applies Sonnet prices to
all models, inflating GLM-5's estimated cost and dramatically underestimating its
quality-per-dollar ratio. The ranking in the "core decision-making view" is then inverted.

**Impact**: The primary purpose of the Model Performance view is to inform which model to use.
Incorrect quality-per-dollar values directly subvert that decision. A user acting on this data
will systematically choose the wrong model.

**Severity**: HIGH

**Fix**: Either (a) have the API endpoint return `total_cost` alongside token counts (the
actual cost is already tracked in the DB via `CortexWorker.cost`), or (b) inject a per-model
pricing table and compute cost from it, documenting that GLM/Gemini/GPT prices are
configurable.

---

## Serious Issues

### Issue 3: `rangeWidth` can produce CSS overflow (>100%)

**File**: `apps/dashboard/src/app/views/phase-timing/phase-timing.adapters.ts:50-53`

```typescript
const rangeWidth =
  globalMax > 0
    ? ((maxVal - minVal) / globalMax * 100).toFixed(1) + '%'
    : '0%';
```

`globalMax` is the maximum of `avg_duration_minutes` values. `maxVal` is the `max_duration_minutes`
of a phase, which will almost always exceed the global average maximum. For example: if the
average max phase is 30 min (`globalMax = 30`) but the `max_duration_minutes` of a single
phase is 90 min, then `rangeWidth = (90 - 0) / 30 * 100 = 300%`. The range overlay visually
explodes out of its parent bar.

**Severity**: SERIOUS

**Fix**: Compute `globalMax` from `max_duration_minutes` values, not `avg_duration_minutes`, OR
clamp `rangeWidth` to `100%`.

---

### Issue 4: Reviews and fix cycles always appear at the bottom of timeline regardless of actual timing

**File**: `apps/dashboard/src/app/views/task-trace/task-trace.adapters.ts:132-150`

```typescript
// These are appended AFTER the sort, with time: ''
for (const r of [...reviews].sort((a, b) => a.id - b.id)) {
  result.push({ time: '', label: `Review: ${r.review_type}`, ... });
}
```

**Scenario**: A task with two dev phases and an intermediate review (Phase 1 → Review →
Phase 2) will show Phase 1, Phase 2, then Review at the bottom — inverting the actual
execution order. For multi-round tasks this makes the timeline unreadable.

**Impact**: The Task Trace view's stated purpose is "Timeline visualization". An incorrectly
ordered timeline actively misleads the user diagnosing a task's execution.

**Severity**: SERIOUS

**Fix**: Reviews and fix cycles need timestamp fields from the API. If `CortexReview` and
`CortexFixCycle` expose no timestamp, the timeline should document this explicitly (e.g.,
append them with a note "time unknown — shown at end") rather than interspersing them as
if they were sorted.

---

### Issue 5: Missing acceptance criteria — no date-range or complexity filter on Model Performance

**File**: `apps/dashboard/src/app/views/model-performance/model-performance.component.ts`

`task.md` specifies: "Filter by date range, task type, complexity". Only `taskType` is
implemented. `complexity` is not in `CortexModelPerformance` (no `complexity` field in the
type), so it cannot be filtered. The date-range filter is also absent.

**Impact**: The acceptance criterion "Model Performance view shows quality/cost/failure matrix
with filters" is only partially satisfied. A reviewer checking the ACs would mark this
criterion incomplete.

**Severity**: SERIOUS

---

### Issue 6: `nzLoading` on task selector shows permanent spinner when task list is empty

**File**: `apps/dashboard/src/app/views/task-trace/task-trace.component.html:18`

```html
[nzLoading]="taskOptions().length === 0"
```

If the `getCortexTasks()` call fails (`catchError` returns `null`) or succeeds with an empty
array, `taskOptions()` returns `[]` and `nzLoading` stays `true` forever. The user sees a
spinning dropdown with no explanation. The distinction between "still loading" and "no tasks
available" is lost.

**Impact**: A user on a fresh installation (no tasks yet) cannot distinguish between a broken
API and a legitimately empty system. Accessibility tools also announce the loading state
continuously.

**Severity**: SERIOUS

**Fix**: Use a dedicated `tasksLoading` boolean that tracks whether the HTTP request has
completed, set to `false` once `tasksSignal()` emits any non-initial value.

---

## Moderate Issues

### Issue 7: Duplicate `adaptModelPerformance` call inside `computed` and `taskTypeOptions`

**File**: `apps/dashboard/src/app/views/model-performance/model-performance.component.ts:52-62`

```typescript
private readonly rowsComputed = computed<ModelPerfRow[]>(() => {
  const adapted = adaptModelPerformance(this.modelPerfSignal()); // call 1
  ...
});

public readonly taskTypeOptions = computed<string[]>(() => {
  const raw = adaptModelPerformance(this.modelPerfSignal()); // call 2
  ...
});
```

`adaptModelPerformance` is called twice every time `modelPerfSignal` changes. Both computeds
depend on the same signal, so they fire together. The adapter is pure and cheap, but it
allocates a new array each time. This doubles the allocation cost unnecessarily.

**Severity**: MODERATE

---

### Issue 8: `as Record<string, unknown>` cast in sortBy breaks type safety

**File**: `apps/dashboard/src/app/views/model-performance/model-performance.component.ts:93-94`
Also: `session-comparison.component.ts:83-84`

```typescript
const aVal = (a as Record<string, unknown>)[col];
```

`col` is a `string` supplied by the template click handler, not typed as `keyof ModelPerfRow`.
If a column name is misspelled in the template (e.g., `sortBy('avgReviewscore')` instead of
`'avgReviewScore'`), `aVal` and `bVal` are both `undefined` and the sort silently becomes
a no-op. Review-lesson explicitly states: "No `as` type assertions".

**Severity**: MODERATE

---

### Issue 9: `ModelPerfRow` and `PhaseTimingRow` declared in adapter files, not `.model.ts` files

**Files**:
- `model-performance.adapters.ts:3-14` — `ModelPerfRow` interface
- `phase-timing.adapters.ts:3-13` — `PhaseTimingRow` interface
- `session-comparison.adapters.ts:3-19` — `SessionRow` interface
- `task-trace.adapters.ts:11-80` — `WorkerRow`, `PhaseRow`, `ReviewRow`, `FixCycleRow`,
  `TimelineEvent`, `TaskTraceViewModel` interfaces

Review-general.md states: "One interface/type per file — don't define models inside component
files. Move to `*.model.ts`." The adapter files define view-model interfaces inline alongside
transformation logic. This is a naming/structure violation: model interfaces should live in
`*.model.ts` files, adapters in `*.adapters.ts`.

**Severity**: MODERATE

---

## Data Flow Analysis

```
User navigates to /telemetry/model-performance
  -> ModelPerformanceComponent constructs
  -> toSignal fires initialValue: null synchronously
  -> effect() runs: null seen -> unavailable=true, loading=false  [ISSUE 1: false alarm banner]
  -> HTTP GET /api/v1/cortex/analytics/model-performance
  -> Response arrives -> toSignal emits CortexModelPerformance[]
  -> effect() runs: rows = rowsComputed()
     -> rowsComputed() reads modelPerfSignal() and selectedTaskType (untracked plain field)
     -> adaptModelPerformance() runs TWICE (rowsComputed + taskTypeOptions)  [ISSUE 7]
     -> computeQualityPerDollar() uses hardcoded Sonnet pricing  [ISSUE 2]

User changes task-type filter
  -> ngModelChange -> onTaskTypeChange()
  -> this.rows = this.rowsComputed()  [manual call, not signal-reactive]

User clicks column header
  -> sortBy(col)
  -> rowsComputed() re-runs (correct), then cast to Record<string,unknown>  [ISSUE 8]

User navigates to /telemetry/task-trace
  -> getCortexTasks() -> taskOptions computed
  -> [nzLoading]="taskOptions().length === 0" -> may show permanent spinner  [ISSUE 6]
  -> User selects task -> selectedTaskId$.next(id)
  -> switchMap -> getCortexTaskTrace(id) fires
  -> traceSignal emits CortexTaskTrace
  -> adaptTaskTrace() runs:
     -> buildTimeline() sorts workers/phases/events, appends reviews/fixes after sort  [ISSUE 4]
     -> rangeWidth computed in phase adapter can exceed 100%  [ISSUE 3]
```

Gap points:
1. `null` initial signal value is indistinguishable from API error null in all three components.
2. `computeQualityPerDollar` has no per-model pricing — produces wrong rankings.
3. Timeline reviews/fix cycles lose chronological positioning.

---

## Requirements Fulfillment

| Requirement                                                                 | Status   | Concern                                              |
| --------------------------------------------------------------------------- | -------- | ---------------------------------------------------- |
| Model Performance: quality/cost/failure matrix with filters                 | PARTIAL  | Only taskType filter; no complexity, no date range   |
| Phase Timing: average duration per phase per complexity                     | PARTIAL  | No complexity breakdown; trends over time absent     |
| Session Comparison: compares sessions by cost/tasks/efficiency              | PARTIAL  | Tasks/hour and model-mix columns absent              |
| Task Trace: full chain for selected task                                    | COMPLETE | Timeline ordering of reviews is incorrect            |
| All views use NG-ZORRO and match dark theme                                 | COMPLETE | No issues observed                                   |
| Navigation sidebar updated with new view links                              | COMPLETE | Four entries added correctly                         |
| Views handle empty state gracefully                                         | PARTIAL  | Task trace selector shows permanent spinner on empty |

### Implicit Requirements NOT Addressed

1. **Failure distinction**: users cannot distinguish "API unreachable" from "API returned
   empty data" in Phase Timing and Session Comparison (both collapse to the same empty state).
2. **Complexity field missing from API**: task.md requested complexity filtering but
   `CortexModelPerformance` has no complexity column. This gap was not surfaced as a blocker
   or tracked as a follow-on item.
3. **`failure_rate` column absent**: task.md describes a "quality/cost/failure rate" matrix.
   `CortexModelPerformance` has no `failure_rate` or equivalent field. The feature is
   described as available but failure rate is not displayed.

---

## Edge Case Analysis

| Edge Case                                  | Handled | How                                   | Concern                                                  |
| ------------------------------------------ | ------- | ------------------------------------- | -------------------------------------------------------- |
| Empty model performance array              | YES     | `nz-empty` shown                      | False-positive unavailable banner on load                |
| HTTP error on model-performance endpoint   | PARTIAL | `catchError -> null -> unavailable`   | Brief false banner flash even on success                 |
| Zero tasks in task list                    | NO      | Loading spinner never resolves        | ISSUE 6                                                  |
| Task trace 404 (task has no trace data)    | YES     | `nz-empty` shown at bottom            | OK                                                       |
| Session with `tasks_terminal = 0`          | YES     | `costPerTask = null`, shown as `—`    | OK                                                       |
| Phase with all-null duration fields        | YES     | `'—'` displayed                       | OK                                                       |
| Range width exceeding 100%                 | NO      | Not clamped                           | ISSUE 3 — visual overflow                                |
| Non-UTC timestamps in timeline             | PARTIAL | String sort works for same-format ISO | Risk if API emits mixed formats                          |
| Model performance with 0 tokens            | YES     | `estimatedCost === 0 -> null`         | OK, but wrong model for all non-Sonnet models (ISSUE 2)  |

---

## Integration Risk Assessment

| Integration                         | Failure Probability | Impact         | Current Mitigation            |
| ----------------------------------- | ------------------- | -------------- | ----------------------------- |
| cortex analytics endpoints down     | MEDIUM (TASK_2026_145 may not be deployed) | All 4 views broken | `catchError` catches, but banner flash occurs |
| `CortexModelPerformance` shape change | MEDIUM (handoff notes this risk) | Wrong data displayed silently | None — no runtime validation  |
| `CortexTaskTrace` missing `events` array | LOW | `buildTimeline` crashes on `raw.events.map` if `events` is undefined | No null guard on `raw.events` |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Issue 2 — the quality-per-dollar metric (the primary output of the Model
Performance view) uses hardcoded Claude Sonnet pricing for all models, producing systematically
wrong rankings for any non-Sonnet model. This silently undermines the view's stated purpose.

---

## What Robust Implementation Would Include

- A `LoadingState = 'pending' | 'loaded' | 'error'` discriminated union instead of two
  booleans, eliminating the initial-null false-alarm banner pattern.
- Per-model pricing table (injected via config or fetched from API) for `computeQualityPerDollar`.
- `CortexTaskTrace.events` null-guard in `buildTimeline` before iterating.
- Timestamp-based positioning for reviews/fix cycles in the timeline (requires API field
  addition or explicit "time unknown" labelling).
- `rangeWidth` capped at `100%` with the correct `globalMax` denominator.
- A `tasksLoading` signal flag in `TaskTraceComponent` instead of inferring loading state
  from array length.
- `complexity` and `date range` filter wires, even if they gracefully show "not yet available
  from API" until TASK_2026_145 exposes those dimensions.
- Typed `sortColumn` as `keyof ModelPerfRow` to eliminate the `as Record<string, unknown>` cast.
