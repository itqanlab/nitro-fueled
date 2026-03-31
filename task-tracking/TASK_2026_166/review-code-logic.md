# Code Logic Review - TASK_2026_166

## Review Summary

| Metric              | Value                                      |
| ------------------- | ------------------------------------------ |
| Overall Score       | 6/10                                       |
| Assessment          | NEEDS_REVISION                             |
| Critical Issues     | 2                                          |
| Serious Issues      | 4                                          |
| Moderate Issues     | 3                                          |
| Failure Modes Found | 9                                          |
| Verdict             | NEEDS_REVISION                             |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **Loading spinner never clears on first render.** The `loading` signal is set to `false` only when `data !== null`. The `toSignal` initial value is `null`. The first effect invocation fires synchronously on construction with `data === null`, so `loading.set(false)` is skipped. When the HTTP request returns `null` for all four endpoints (all `catchError` branches fire simultaneously), `data` becomes the object `{ taskData: null, traceData: null, contextData: null, pipelineData: null }` which is **truthy** — so loading clears. But the check on line 207 is `if (data !== null)`, and a fully-null-valued object IS non-null. This actually works, but only accidentally; the logic reads as "clear loading when data arrives" but is really "clear loading when the observable emits anything non-null". This is fragile reasoning documented nowhere.

- **`vm` signal is set even on failure.** `viewModelComputed()` calls `adaptTaskDetail` when `data` is non-null and `id` is set. If all four API calls fail, `adaptTaskDetail` is called with four `null` arguments and produces a ViewModel with empty strings/arrays everywhere. The `@if (!loading() && taskId() && !vm())` branch never shows "Task not found" because `vm()` is always a non-null object after the first load. Users see a page full of empty states rather than a clear error or a "not found" message.

- **`handleFlowOverrideChange` subscription is unmanaged.** The `.subscribe()` call on line 166 creates a subscription that is never stored or cleaned up. If the user navigates away mid-save and back, the old pending subscription fires on the destroyed component's signals, producing a `signal written after component destroyed` runtime error in dev mode and a silent no-op in production.

- **`findDependentTasks` derives "dependents" from event data.** Any event whose `data.task_id` field is any task ID other than the current task is treated as "depends on this task." This is a heuristic that will include false positives (e.g., a supervisor event that references a sibling task). Users will see phantom dependency links.

### 2. What user action causes unexpected behavior?

- **Rapid task navigation.** The user clicks Task A, then immediately clicks Task B before the first `forkJoin` resolves. Both `switchMap` invocations are active; Angular's `switchMap` cancels the first, but `this.taskId.set(id)` on line 84 runs inside the `switchMap` projection. This means `taskId` is set to Task A's ID, then the inner observable is cancelled, but `taskId` stays as Task A. When Task B's `forkJoin` resolves, `viewModelComputed()` calls `adaptTaskDetail('TASK_A', ...Task_B_data...)` — the ViewModel has Task A's ID but Task B's content. The header shows "TASK_A" while all the data belongs to Task B.

- **Clicking a dependency/dependent link on the same component.** `navigateToTask(taskId)` navigates to `/project/task/:taskId`. If the component is not destroyed and recreated on route change (depends on router outlet config), the second effect that initializes `selectedFlowOverrideId` from `contextData` will still fire, but `customFlows` was already loaded once and won't refresh. If the new task has a custom flow override, the dropdown may start with the old task's override preselected until the API call resolves.

- **Selecting "Default (built-in flow)" in the flow override dropdown.** The `<option value="">` produces `flowId = ""`. The code correctly routes to `clearTaskFlowOverride`, but `selectedFlowOverrideId.set(flowId || null)` would set it to `null` — correct. However, if the save fails, `overrideSaving` is cleared but `selectedFlowOverrideId` is NOT rolled back. The dropdown reverts visually (because it's not bound two-way), but the signal stays at the pre-change value, causing `selectedFlowOverrideName` to show the old override name again as an "Active override" badge — misleading the user.

### 3. What data makes this produce wrong results?

- **Task with no events but a current status other than CREATED.** `buildStatusTransitions` only adds transitions based on events with `eventType` matching a fixed list. A task that jumped directly from CREATED to COMPLETE with no matching events will show a timeline with only the CREATED dot, while the header badge shows COMPLETE. The timeline lies.

- **Phase with `durationMinutes = 0`.** In `phaseBars()`, the guard `|| 1` ensures `maxDuration` is at least 1, but a phase with `durationMinutes = 0` passes the `.filter(p => p.durationMinutes !== null)` check and maps to `widthPercent = 0`. The phase bar renders as a 4px sliver (`min-width: 4px` in CSS). This is cosmetically ugly but not a data corruption.

- **`completionReport.rootCause` and `.fix` typed as `string` but treated as nullable.** In `api.types.ts`, `CompletionReport.rootCause` is typed as `string` (non-optional, non-nullable). In `task-detail.model.ts`, `completionReport.rootCause` is typed as `string | null`. The adapter does `completion.rootCause ?? null`. If the API returns an empty string `""` for `rootCause`, `?? null` passes `""` through (since `??` only catches `null`/`undefined`), and the Handoff section renders a blank "Root Cause" row — a visible empty label.

- **`transitionNodes()` applies `| date:'shortDate'` to `node.formattedTime`.** `node.formattedTime` is already a pre-formatted locale string produced by `toLocaleString()`. Piping a locale-formatted string through Angular's `DatePipe` will attempt to parse it as a date; on some locales this succeeds, on others the string is not parseable and `DatePipe` silently returns `null`, rendering nothing in the timeline time slots.

### 4. What happens when dependencies fail?

| Dependency              | Failure Scenario                      | Current Handling                          | Assessment                                         |
| ----------------------- | ------------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| `api.getTask(id)`       | 404 / 500                             | `catchError(() => of(null))` — silent     | No user feedback; blank metadata section           |
| `api.getCortexTaskTrace`| Cortex DB unavailable                 | `catchError(() => of(null))` — silent     | Workers/phases/reviews/events all empty, no notice |
| `api.getCortexTaskContext` | 500                                | `catchError(() => of(null))` — silent     | No status, no created date shown                   |
| `api.getTaskPipeline`   | 404                                   | `catchError(() => of(null))` — silent     | `pipelineAvailable` flag set false, not surfaced    |
| `api.getCustomFlows()`  | Network failure                       | `catchError(() => of([]))` — silent       | Dropdown only shows "Default", no error notice     |
| `api.setTaskFlowOverride`| Race / 500                           | `console.warn` only                       | User sees no error toast; override state is wrong  |

Every API failure is swallowed with a silent empty state. The user cannot distinguish "task has no reviews" from "reviews failed to load." This violates the project anti-pattern "Operations that modify state must surface errors to the caller."

### 5. What's missing that the requirements didn't mention?

- **Compaction count per worker.** Requirement item 9 explicitly lists "compaction count" as a Worker Activity column. The `WorkerEntry` model has no `compactionCount` field. The Worker Activity table has no "Compaction" column. This is a missing requirement item — not just cosmetic.

- **Test results summary.** Requirement item 8 says "Score & Quality — Overall task score, review scores breakdown, **test results summary**." There is no test results section rendered anywhere. The completionReport carries no test data, and no such field exists on the ViewModel.

- **QA verification status on acceptance criteria.** Requirement item 10 says "Acceptance Criteria — Checklist with **verification status from QA**." The rendered list uses a static hollow-circle bullet (`&#x25CB;`) for every item. There is no mechanism to distinguish verified vs. unverified criteria.

- **Overall task score.** Requirement item 8 says "Overall task score." No aggregate score is computed or displayed — only individual review scores.

- **Absolute timestamps on timeline nodes are double-formatted.** `formattedTime` is produced with `toLocaleString()` (JS) and then piped through `| date:'shortDate'` (Angular). If the locale-string is not parseable by `DatePipe`, the time renders blank. Even when it does parse, the shortDate format throws away the time portion, showing only the date — the full requirement is "exact timestamps."

---

## Failure Mode Analysis

### Failure Mode 1: TaskId/Data Mismatch on Fast Navigation

- **Trigger**: User navigates from Task A to Task B before the first `forkJoin` completes.
- **Symptoms**: Header shows Task A's ID; all data (workers, phases, reviews, events) belongs to Task B.
- **Impact**: Critical — user views the wrong task's data, may make decisions based on it.
- **Current Handling**: None. `taskId.set(id)` is called inside the `switchMap` projection, before the inner Observable resolves. `switchMap` cancels the outer but `taskId` was already mutated.
- **Recommendation**: Move `taskId.set(id)` outside the `switchMap` projection, or derive `taskId` from `dataSignal` after it resolves rather than setting it eagerly inside the projection.

### Failure Mode 2: "Task Not Found" Branch Never Shown

- **Trigger**: All four API endpoints return 404/500.
- **Symptoms**: User sees a page full of empty states (no metadata, empty timeline, empty workers) — not the "Task not found" empty state.
- **Impact**: Serious — confusing UX; user cannot tell if the task is genuinely empty or failed to load.
- **Current Handling**: `vm()` is always set to the output of `adaptTaskDetail` (which returns a well-structured ViewModel even with all-null inputs), so `!vm()` is never true after load.
- **Recommendation**: Return `null` from `adaptTaskDetail` (or `viewModelComputed`) when both `taskData` and `contextData` are null. This makes the `@if (!loading() && taskId() && !vm())` branch reachable.

### Failure Mode 3: Unmanaged Flow Override Subscription (Memory / State Leak)

- **Trigger**: User changes the flow override dropdown, then navigates to another route before the HTTP request resolves.
- **Symptoms**: The subscription fires on the destroyed component, updating signals that no longer exist (dev-mode error) or silently no-oping (production).
- **Impact**: Moderate — no data loss, but observable lifecycle leak.
- **Current Handling**: `.subscribe()` result is discarded — no `takeUntilDestroyed` or `DestroyRef` teardown.
- **Recommendation**: Inject `DestroyRef` and pipe `takeUntilDestroyed(this.destroyRef)` on the `request$` observable, or store the subscription and unsubscribe in an `ngOnDestroy`.

### Failure Mode 4: Timeline Timestamp Double-Formatting

- **Trigger**: Any task with status transitions (the common case).
- **Symptoms**: `node.formattedTime` is a locale string (e.g., "3/31/2026, 10:45:00 AM"). Piping through `| date:'shortDate'` in the template either: (a) re-parses and shows only the date losing time precision, or (b) fails to parse and renders blank.
- **Impact**: Serious — timeline times may be blank or truncated, losing the "exact timestamps" requirement.
- **Current Handling**: None detected. The computation in `transitionNodes()` builds `formattedTime` with `toLocaleString()`, then the template pipes it through `DatePipe` again.
- **Recommendation**: Either store the raw ISO timestamp in `formattedTime` and let `DatePipe` format it, or remove the `| date:'shortDate'` pipe from the template since the string is already formatted.

### Failure Mode 5: `findDependentTasks` False Positives

- **Trigger**: Any task that has a supervisor event referencing another task's ID in its `data.task_id` field.
- **Symptoms**: The "Depended By" column shows tasks that do not actually list this task as a dependency.
- **Impact**: Moderate — misleading dependency graph; user may investigate phantom blockers.
- **Current Handling**: Every event with any `data.task_id !== currentTaskId` is added to the dependents list, with no cross-check against those tasks' actual `dependencies` arrays.
- **Recommendation**: Remove `findDependentTasks` from the adapter. Reverse-dependency data should come from a dedicated API endpoint that queries all tasks where `dependencies CONTAINS taskId`, not from event payloads.

### Failure Mode 6: Missing Compaction Count Column (Requirement Gap)

- **Trigger**: Always — the column is missing.
- **Symptoms**: Worker Activity table has no Compaction Count column, despite requirement 9 listing it explicitly.
- **Impact**: Serious — requirement not fulfilled.
- **Current Handling**: Not implemented. `CortexWorker` has no `compaction_count` field in `api.types.ts` either.
- **Recommendation**: Add `compaction_count: number` to `CortexWorker`, add `compactionCount: number` to `WorkerEntry`, map it in the adapter, and add the column to the Worker Activity table.

### Failure Mode 7: Acceptance Criteria Shows No Verification Status

- **Trigger**: Always — static bullets with no verification logic.
- **Symptoms**: Every criterion shows `○` regardless of whether QA verified it.
- **Impact**: Serious — requirement 10 says "with verification status from QA."
- **Current Handling**: A static hollow circle `&#x25CB;` is hardcoded for every item. No pass/fail status is sourced from anywhere.
- **Recommendation**: Either source QA verification status from the completion report or cortex data, or document explicitly that verification status is out of scope.

### Failure Mode 8: Score & Quality Section Missing Test Results

- **Trigger**: Always — test results summary not implemented.
- **Symptoms**: Score & Quality section shows only review score cards. No test results appear.
- **Impact**: Serious — requirement 8 explicitly includes "test results summary."
- **Current Handling**: Not implemented. No test-related field exists on the ViewModel or model types.
- **Recommendation**: Either add test result data from the completion report/cortex trace, or explicitly mark this as out of scope in the task.

### Failure Mode 9: Flow Override Rollback Missing on Save Failure

- **Trigger**: User changes flow override; HTTP save fails.
- **Symptoms**: `overrideSaving` clears. `selectedFlowOverrideId` remains at the value from before the failed save — matching what the server actually has. BUT the `<select>` element has already visually changed (it is not two-way bound, so it reflects the user's DOM choice, not the signal). The signal and the DOM are now out of sync.
- **Impact**: Moderate — user thinks the override is set to the old value (badge shows old name) but the dropdown shows their (failed) new selection.
- **Current Handling**: Error path only logs `console.warn`.
- **Recommendation**: Reset `selectedFlowOverrideId` to its pre-change value in the error handler, and use `ViewChild` + `ElementRef` to programmatically reset the `<select>` DOM element to the prior value. Add a user-visible error notification.

---

## Critical Issues

### Issue 1: TaskId/Data Mismatch on Concurrent Navigation

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:82-84`
- **Scenario**: User clicks Task A link then immediately clicks Task B while Task A's `forkJoin` is in-flight.
- **Impact**: User sees Task A's ID in the header but Task B's workers, phases, reviews, and events in all sections. Any action (e.g., flow override change) is applied to Task A's ID because `taskId` signal still holds Task A.
- **Evidence**: `this.taskId.set(id)` is called eagerly inside the `switchMap` projection before the inner forkJoin resolves. `switchMap` cancels the inner observable but the side-effect has already fired.
- **Fix**: Remove the `this.taskId.set(id)` call from inside `switchMap`. Instead derive `taskId` from `dataSignal` post-resolution (e.g., store the id alongside the data bundle), or set it after the `forkJoin` completes.

### Issue 2: "Task Not Found" State Is Unreachable

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:96-101` and `task-detail.adapters.ts:26-89`
- **Scenario**: All four API endpoints fail (404, network error, etc.).
- **Impact**: `vm()` is always non-null after data loads (adapter always returns an object). The `@if (!loading() && taskId() && !vm())` branch never renders. User sees a component full of empty-state placeholders — no indication of whether data truly doesn't exist or failed to load.
- **Evidence**: `adaptTaskDetail` always returns a `TaskDetailViewModel`, even when all four source arguments are `null`.
- **Fix**: Return `null` from `adaptTaskDetail` when both `taskData` and `contextData` are null (no recoverable data at all). This makes the "not found" empty state reachable.

---

## Serious Issues

### Issue 3: Timeline Timestamps Double-Formatted and Potentially Blank

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:201` and `task-detail.component.html:99`
- **Scenario**: Any task with status transitions (universal).
- **Impact**: Timeline timestamps show only a date (losing time precision required by spec) or render blank when `DatePipe` cannot parse the locale string.
- **Evidence**: `formattedTime: t.timestamp ? new Date(t.timestamp).toLocaleString() : ''` — locale string. Template: `{{ node.formattedTime | date:'shortDate' }}` — pipes that locale string through `DatePipe`.
- **Fix**: Store the raw ISO timestamp as `formattedTime` (or rename to `rawTimestamp`) and let `DatePipe` format it in the template with a format that includes both date and time (e.g., `'medium'`).

### Issue 4: Unmanaged Subscription in `handleFlowOverrideChange`

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:166`
- **Scenario**: User changes flow override then navigates away before the HTTP call resolves.
- **Impact**: Subscription fires on destroyed component. Angular signals throw in dev mode. Silently misfires in production.
- **Fix**: Inject `DestroyRef` and add `.pipe(takeUntilDestroyed(this.destroyRef))` to `request$`. Per the frontend review lessons rule: "Every `addEventListener`/`on()` must have removal."

### Issue 5: Compaction Count Column Missing from Worker Activity (Requirement 9)

- **File**: `apps/dashboard/src/app/models/api.types.ts:493-509`, `task-detail.model.ts:19-34`, `task-detail.adapters.ts:114-131`, `task-detail.component.html:336-364`
- **Scenario**: Always.
- **Impact**: Requirement item 9 ("compaction count") is unimplemented throughout the entire stack — not in `CortexWorker`, not in `WorkerEntry`, not in the adapter, not in the template.
- **Fix**: Extend the data model (`CortexWorker.compaction_count`), ViewModel (`WorkerEntry.compactionCount`), adapter mapping, and add a Compaction column to the Worker Activity table.

### Issue 6: `findDependentTasks` Produces Unreliable Data

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.adapters.ts:208-219`
- **Scenario**: Any task whose event log contains supervisor events referencing other task IDs.
- **Impact**: "Depended By" column shows tasks that have no dependency relationship with the current task. The algorithm has no valid theoretical basis — event `data.task_id` does not indicate that that task depends on the current task.
- **Fix**: Replace with a proper reverse-dependency API call, or query the registry for tasks whose `dependencies` array contains the current `taskId`. Remove the heuristic entirely until a proper endpoint exists, and show "Reverse dependency lookup unavailable" in the UI.

---

## Moderate Issues

### Issue 7: Flow Override Dropdown/Signal State Desync on Save Failure

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:171-175`
- **Scenario**: User changes the flow override dropdown; the HTTP save fails.
- **Impact**: `selectedFlowOverrideId` signal stays at the pre-change value but the `<select>` DOM element shows the user's new (failed) selection. The badge and the dropdown show different values.
- **Fix**: Add `console.warn` (already present — acceptable minimum), but also reset the `<select>` element programmatically via `ViewChild`/`ElementRef`, and add a user-visible error notification.

### Issue 8: Acceptance Criteria Has No QA Verification Status (Requirement 10 Partial)

- **File**: `apps/dashboard/src/app/views/task-detail/task-detail.component.html:372-380`
- **Scenario**: Always.
- **Impact**: Requirement 10 says "with verification status from QA." All criteria show an identical hollow-circle bullet. Verified and unverified criteria are visually identical.
- **Fix**: Either source verification status from the completion report or add it to the ViewModel/adapter pipeline. If not available, explicitly document the limitation.

### Issue 9: `reviewScores[].score` Type Mismatch

- **File**: `apps/dashboard/src/app/models/api.types.ts:180` and `task-detail.model.ts:79`
- **Scenario**: When `completionReport.reviewScores` are rendered in the Reviews section.
- **Impact**: `CompletionReport.reviewScores[].score` is typed as `string` in `api.types.ts`. The template renders `{{ score.score }}/10`. For cortex-sourced review entries (`ReviewEntry.score`), the score is typed as `number` and used with colour logic `r.score >= 7`. The two sources use different types for the same concept. The `completionReport` score sub-section cannot use the colour thresholds, but there is no indication of this — the rendering silently omits colour coding for these scores.
- **Fix**: Either parse `score` to a number in the adapter for `completionReport.reviewScores`, or align the type in `api.types.ts`. Add colour coding to the completion report score rows as a follow-up.

---

## Data Flow Analysis

```
User clicks task link
  → ActivatedRoute.paramMap emits
  → taskId$ produces ID
  → switchMap: this.taskId.set(id) [SIDE EFFECT BEFORE FORKJOIN]  ← Issue 1
  → forkJoin([getTask, getCortexTaskTrace, getCortexTaskContext, getTaskPipeline])
       all 4 wrapped in catchError(→ null) ← silent failure on any endpoint
  → toSignal → dataSignal()
  → effect fires:
      if (data !== null) loading.set(false)   ← loading cleared even on all-null data
      vm.set(viewModelComputed())
  → viewModelComputed():
      adaptTaskDetail(id, taskData, traceData, contextData, pipelineData)
        ← always returns non-null object even when all sources null  ← Issue 2
  → Template renders via @if (vm(); as m)
      Sections use m.workers / m.phases / m.reviews / m.events
```

**Gap Points Identified:**
1. `taskId` signal set before forkJoin resolves — can contain stale ID when the inner observable is cancelled.
2. All API failures produce the same output as "task genuinely has no data" — indistinguishable to the user.
3. `findDependentTasks` reads event payloads, not actual dependency declarations — produces spurious reverse dependencies.
4. `transitionNodes()` pre-formats timestamps then template re-formats them — double transformation.
5. Flow override subscription has no teardown — lifecycle leak.

---

## Requirements Fulfillment

| Requirement                                                | Status   | Concern                                                              |
| ---------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| 1. Core Metadata (ID, type, priority, complexity, status, created) | COMPLETE | All fields rendered; `model` and `preferred tier` fields absent from ViewModel/adapter |
| 2. Status Timeline with exact timestamps and durations     | PARTIAL  | Timeline renders; timestamps double-formatted (may be blank or date-only) |
| 3. Relations & Dependencies with navigation                | PARTIAL  | Forward deps correct; reverse deps use unreliable heuristic          |
| 4. Reviews with scores, findings count, pass/fail          | COMPLETE | Both review table and completion report scores rendered              |
| 5. Model & Provider Info per phase                         | PARTIAL  | Per-worker model/provider shown; cost-per-phase not broken out       |
| 6. Launcher Info (launcher, session ID)                    | COMPLETE | Launcher card section renders launcher and session ID                |
| 7. Phase Timing with breakdown chart                       | COMPLETE | Table and bar chart both present                                     |
| 8. Score & Quality with test results summary               | PARTIAL  | Review scores shown; test results summary not present                |
| 9. Worker Activity with compaction count and retry count   | PARTIAL  | Retry count shown; compaction count missing from entire stack        |
| 10. Acceptance Criteria with QA verification status        | PARTIAL  | Criteria list renders; verification status not implemented           |
| 11. File Scope (created/modified)                          | COMPLETE | Created and modified file groups rendered                            |
| 12. Handoff Artifact                                       | COMPLETE | Root cause, fix, and findings-fixed rendered                         |
| 13. Event Log                                              | COMPLETE | Chronological event log rendered                                     |

### Implicit Requirements NOT Addressed:

1. **`model` and `preferred tier` fields** — listed in requirement 1 Core Metadata, but absent from `TaskDetailViewModel`, the adapter, and the template.
2. **Overall task score** — requirement 8 says "overall task score" (a single aggregate); only per-review scores appear.
3. **Error/loading state distinguishes API failure from empty data** — a page with no data due to a 500 looks identical to a page for a brand-new task with no workers or reviews.
4. **Navigation accessibility** — dependency links use `(click)` and `role="link"` but have no `(keydown.enter)` handler, making keyboard navigation incomplete.

---

## Edge Case Analysis

| Edge Case                                    | Handled | How                                               | Concern                                              |
| -------------------------------------------- | ------- | ------------------------------------------------- | ---------------------------------------------------- |
| All API endpoints return null                | NO      | Shows empty-state sections; vm() is always non-null | "Task not found" branch unreachable                 |
| Task with zero events                        | YES     | `@if (m.statusTransitions.length === 0)` empty state | OK                                                |
| Task with zero workers                       | YES     | Empty state shown in worker/model/launcher sections | OK                                                 |
| Rapid task link clicks                       | NO      | taskId signal set inside switchMap projection     | Shows wrong task ID with correct data               |
| Phase with durationMinutes = 0               | YES(partial) | Passes filter, renders 4px bar min-width      | Cosmetically ugly, not wrong                        |
| Worker with sessionId shorter than 24 chars  | YES     | No-op in slice logic                              | OK                                                  |
| Worker with id shorter than 12 chars         | YES     | No-op in slice logic                              | OK                                                  |
| Flow override save fails mid-navigation      | NO      | Subscription not cleaned up                       | Fires on destroyed component                        |
| completionReport.rootCause = ""              | NO      | `?? null` passes through empty string             | Blank label visible in Handoff section              |

---

## Integration Risk Assessment

| Integration                         | Failure Probability | Impact | Mitigation                                       |
| ----------------------------------- | ------------------- | ------ | ------------------------------------------------ |
| getTask → null                      | MED                 | HIGH   | Silent; ViewModel built from other sources only  |
| getCortexTaskTrace → null           | MED                 | HIGH   | Workers/phases/reviews/events all empty silently |
| getCortexTaskContext → null         | MED                 | MED    | Metadata falls back to registry; some fields empty |
| getTaskPipeline → null              | MED                 | LOW    | Flag set; not visually surfaced                  |
| setTaskFlowOverride fails           | LOW                 | MED    | Only console.warn; DOM/signal desync             |
| getCustomFlows fails                | LOW                 | LOW    | Dropdown shows only "Default"                    |
| Route param changes fast            | LOW                 | HIGH   | TaskId/data mismatch — critical failure mode     |

---

## What Robust Implementation Would Include

- `adaptTaskDetail` returning `null` when no recoverable data is found (both taskData and contextData null), making the "not found" branch reachable.
- `taskId` derived reactively from the resolved data bundle, not set eagerly as a side-effect inside `switchMap`.
- At least one user-visible toast or inline error state when any of the four API calls fails (distinguish empty from error).
- `DestroyRef`-backed teardown for the flow override subscription.
- `formattedTime` storing the raw ISO timestamp so `DatePipe` can format it once in the template.
- A dedicated API endpoint for reverse dependencies rather than `findDependentTasks` scanning event payloads.
- `compaction_count` added through the full stack (API type → WorkerEntry → adapter → template).
- QA verification status sourced from completion report or cortex trace for the acceptance criteria checklist.
- `(keydown.enter)` handlers on `.dep-link` elements for keyboard accessibility.
- Error notification (e.g., `NzMessageService`) on flow override save failure.

---

## Verdict

| Verdict | NEEDS_REVISION |
| ------- | -------------- |

**Recommendation**: REVISE  
**Confidence**: HIGH  
**Top Risk**: Critical Issue 1 (taskId/data mismatch on fast navigation) means users can be shown data for the wrong task without any indication. Critical Issue 2 (unreachable "not found" state) means all API failures silently produce a blank page instead of a diagnostic message. Three requirement items (compaction count, test results summary, QA verification status) are unimplemented. Requires revision before shipping.
