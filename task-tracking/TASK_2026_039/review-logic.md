# Code Logic Review — TASK_2026_039

**Overall Score**: 5/10
**Assessment**: The happy path works end-to-end, but there are correctness gaps in the FAILED state pipeline display, in the worker-tree ordering, and in the getDurationForPhase logic. Several acceptance criteria from task.md are entirely absent. The React lifecycle in Pipeline.tsx has a stale-closure edge case. The parser has silent data-corruption potential on malformed tables.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **FAILED task shows no failed phase.** `statusToActivePhase['FAILED'] = ''` means `activePhase` is the empty string. The dead-code branch `else if (taskStatus === 'FAILED' && name === activePhase)` is unreachable because `activePhase === ''` can never equal a phase name. Every phase renders as `pending`. A user looking at a failed task sees four grey "pending" phases with no indication of what broke or where.
- **getDurationForPhase maps both Review and Fix to 'QA'** and then checks `analytics.phasesCompleted.includes('QA')`. Both phases hit the same boolean gate: if QA did not complete, neither phase gets a duration even if the build was timed. If QA completed, both Review and Fix show the same total session duration — the same string for two different phases. There is no granular per-phase timing.
- **SessionAnalyticsParser swallows `parseInt` NaN silently.** If `filesRaw` is a non-numeric string (e.g., `"unknown count"`), `parseInt` returns `NaN` and `NaN || null` gives `null`. The field is silently nulled with no log, no warning. Only `'unknown'` is explicitly handled.
- **File-router: sessionAnalyticsParser fires on no event.** There is no SSE/WebSocket push when analytics are parsed — the store is updated but no `DashboardEvent` is emitted. The Pipeline view depends on polling via the select change, so it can only show new analytics data after the user re-selects the task.

### 2. What user action causes unexpected behavior?

- **User selects a task while a slow fetch is in flight, then selects a second task.** Two concurrent `api.getTaskPipeline` calls are in flight. Both have independent `.then(setPipeline)` callbacks. If the first call resolves after the second, `pipeline` is set to stale data for the wrong task. There is no cancellation (no AbortController) and no guard checking that the settled task ID still matches `selectedId`.
- **User opens Pipeline view with no tasks in the registry.** `activeTasks` is `[]`, `selectedId` stays `''`, no fetch fires, no pipeline renders. The UI shows nothing at all — no empty state message. The user sees a bare select dropdown and no guidance.
- **User opens Squad view when orchestratorState is null.** `getWorkerTree` returns `[]` (via the `?? []` guard), which is correct. But the empty-state div contains the emoji `🚫` which is an emoji in code without explicit user request — minor style violation per project conventions.
- **Worker with an unparseable spawnTime.** `new Date('').getTime()` returns `NaN`. `Date.now() - NaN === NaN`. `Math.max(0, NaN) === NaN`. The elapsed display in `formatElapsed(NaN)` returns `NaNs` for `Math.floor(NaN / 1000) < 60`. The `WorkerNode` renders "NaNs".

### 3. What data makes this produce wrong results?

- **Task status `'FIXING'` in the frontend types is absent.** `event-types.ts` (service side) declares `TaskStatus` without `'FIXING'`; `types/index.ts` (web side) also lacks `'FIXING'`. But `store.ts` `completedThrough` has a `FIXING` entry. If a task record ever carries `status: 'FIXING'` (populated from the registry parser), the `TaskRecord` type rejects it at compile time, and at runtime the `statusToActivePhase['FIXING'] = 'Fix'` branch is never reached through the type-safe path. This is a type/runtime mismatch — one side of the stack knows about `FIXING`, the other does not.
- **Multiple workers with identical labels for the same task.** `inferRole` is purely label-based. If two "Build Worker" sessions are active for the same task (e.g., retry after kill), both map to `roots`. There is no deduplication — the tree shows duplicate root nodes. If two "Review Lead" labels exist, the second one clobbers `reviewLeadNode` and the first's children are orphaned into `reviewLeadChildren` attached only to the second.
- **Worker whose label contains multiple recognized substrings** (e.g., `"nitro-build worker review lead"`). `inferRole` returns on first match. The order of `if` branches determines the role, with no documentation of priority. A label containing both "build worker" and "review lead" gets 'Build Worker'. This is unlikely but the ordering is implicit and undocumented.
- **Markdown table with pipes in a cell value** (e.g., `| Duration | 1h | 30m |`). The parser splits on `|` and takes `cells[1]`, yielding `"1h "` and losing `"30m"`. Duration strings containing pipes are silently truncated.
- **registry.md row with a task ID that does not match** `/TASK_\d{4}_\d{3}/`. `getTaskPipeline` falls back to `taskStatus = 'CREATED'` because `record` is found, but analytics with the non-standard ID never match — the regex in `sessionAnalyticsParser.canParse` requires the exact pattern. Silent mismatch produces an empty pipeline.

### 4. What happens when dependencies fail?

- **`/api/tasks/:id/pipeline` fails (service crash, network loss).** Pipeline.tsx catches the error and sets `fetchError`, which is displayed. That part works. But `pipeline` retains its previous value — the stale pipeline for a previously-selected task remains visible below the error message. The user sees both an error and data that may not correspond to the current selection.
- **`/api/workers/tree` fails mid-interval.** Squad.tsx sets `fetchError` but does NOT clear the `trees` state. `isLoading` was set to `false` after the first successful load. On the next `setInterval` tick, if the request fails, the stale worker trees remain displayed alongside the error message. Workers that have completed are shown as still active.
- **Service restarts while Squad view is open.** The interval keeps firing. The first post-restart request may succeed immediately because the service was already restarted and returns a fresh empty state. Trees correctly go to `[]`. However, if restart takes > 5 seconds, the interval fires multiple overlapping requests during reconnection. Each fires its own `.catch` setting `fetchError`, no problem — but `isLoading` is never reset to `true` during the outage, so there is no loading spinner to communicate degraded state.
- **`new Date(w.spawnTime).getTime()` with a null spawnTime.** The worker interface declares `spawnTime: string` (required, not optional). If the underlying orchestratorState parser emits a worker record with an empty string for spawnTime, `new Date('').getTime()` is `NaN`. The guard `w.spawnTime ? ... : 0` only protects against falsy — empty string is falsy, so `elapsedMs = 0`. That is actually safe. But the interface contract promises a string; if the parser emits `null` at runtime, the guard fails.

### 5. What's missing that the requirements didn't mention?

- **Model badge per phase** — explicitly listed as a requirement in task.md: "Model badge on each phase node (e.g., 'Opus' or 'Sonnet')". Not implemented. `PipelinePhase` has no `model` field; `PhaseNode` renders none.
- **Cost per phase on hover** — explicitly listed in task.md. Not implemented. No cost data flows into `PipelineData` at all.
- **Click-through from phase to artifacts** — acceptance criterion in task.md. Not implemented; `PhaseNode` has no `onClick` and no routing.
- **Click-through from worker to detailed stats** — acceptance criterion. Not implemented; `WorkerNode` has no `onClick`.
- **Completed sub-workers collapse with checkmark** — acceptance criterion. `WorkerNode` has no collapsed/expanded state; all children always render.
- **Real-time updates for Squad view** — the task requires WebSocket events for sub-worker spawn/complete. The Squad view uses `setInterval(load, 5000)` polling only. This is a deliberate fallback but the acceptance criterion says "real-time updates via WebSocket".
- **No event emitted after analytics parse.** The file-router calls `this.store.setSessionAnalytics(...)` but emits no `DashboardEvent`. Any SSE-connected client cannot know analytics changed without polling the pipeline endpoint.

---

## Critical Issues

### Issue 1: FAILED task state renders all phases as pending — failed phase invisible

- **File**: `packages/dashboard-service/src/state/store.ts`, lines 315–325 and 347–349
- **Scenario**: A task transitions to `FAILED` status at any pipeline phase.
- **Impact**: The pipeline view shows four grey "pending" circles. No phase is highlighted as failed. The user cannot determine which phase failed.
- **Evidence**: `statusToActivePhase['FAILED'] = ''`. The guard `else if (taskStatus === 'FAILED' && name === activePhase)` at line 348 compares a phase name string against `''` — always false. Dead code.
- **Fix**: Either populate `statusToActivePhase['FAILED']` with the last-active phase name, or add a separate `failedPhase` field to the status mapping (requires additional context the store doesn't yet have). At minimum, the dead branch should be removed and a `FAILED` status should mark the last non-pending phase as `'failed'`.

### Issue 2: Race condition in Pipeline.tsx — stale API response overwrites correct data

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx`, lines 94–102
- **Scenario**: User selects Task A (slow), then quickly selects Task B (fast). Task B resolves first, sets pipeline. Task A resolves second, overwrites with wrong data.
- **Impact**: Silently displays pipeline for the wrong task with no error or indication.
- **Evidence**: No AbortController, no guard comparing `selectedId` to the task ID in the resolved response.
- **Fix**: Create an `AbortController` inside the `useEffect`, pass its `signal` to `fetch` via the api client, and return a cleanup that calls `controller.abort()`. Or capture `selectedId` in a closure ref and discard responses where `resolvedId !== currentSelectedId`.

### Issue 3: `FIXING` status missing from frontend and service `TaskStatus` union types

- **File**: `packages/dashboard-web/src/types/index.ts` line 1–10; `packages/dashboard-service/src/events/event-types.ts` line 1–9
- **Scenario**: Any task enters the `FIXING` state (which the store's `completedThrough` table explicitly handles).
- **Impact**: TypeScript rejects the value at compile time. At runtime, the registry parser may emit `FIXING` as a status string — this passes through the `string` type in `TaskRecord.status` only if it is typed as `string` rather than the union. The pipeline status lookup returns the correct value from `buildPipelinePhases` if reached, but the status will cause type errors in any switch-exhaustiveness or strict-union handling.
- **Fix**: Add `'FIXING'` to `TaskStatus` in both `event-types.ts` and `types/index.ts`.

---

## Serious Issues

### Issue 4: getDurationForPhase returns the same total session duration for both Review and Fix phases

- **File**: `packages/dashboard-service/src/state/store.ts`, lines 366–378
- **Scenario**: A task completes both Review and Fix phases. Both phases query `analytics.phasesCompleted.includes('QA')`. Both receive `analytics.duration` — the full session duration — as their displayed duration.
- **Impact**: User sees identical duration strings on two different phase nodes. Both are misleading (they show total elapsed, not per-phase time). The requirement asks for per-phase duration.
- **Fix**: The `SessionAnalytics` interface does not carry per-phase timestamps. Until the analytics format includes per-phase data, these should return `null` rather than a misleading shared value. Alternatively, return a label like "total: X" to clarify the value is session-wide.

### Issue 5: Worker ordering is non-deterministic — leads appear after their children in the tree

- **File**: `packages/dashboard-service/src/state/store.ts`, lines 460–488
- **Scenario**: Workers from `orchestratorState.activeWorkers` are iterated in the order they appear in the state file. If a Review Lead is listed after its children (e.g., spawned later and appended last), `reviewLeadChildren` is populated first and `reviewLeadNode` is set later. The code correctly handles this case, appending children to the lead at the end — this part is fine. However, root-level nodes (Build Worker, Fix Worker, etc.) are pushed into `roots` as they are encountered, while the lead nodes are pushed at the end of the loop in lines 474–486. The result: all non-lead roots appear before all lead nodes, regardless of the semantic ordering that makes sense for the UI (Build Worker → Review Lead → Test Lead).
- **Impact**: Squad display has inconsistent node ordering across refreshes and does not reflect the conceptual pipeline order.
- **Fix**: Sort `roots` after assembly — e.g., by a defined role priority table.

### Issue 6: Pipeline.tsx shows stale pipeline data when fetch fails for a new task selection

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx`, lines 94–102 and 145–166
- **Scenario**: User selects Task A (success, `pipeline` set). User selects Task B (fetch fails). `setFetchError` fires. `pipeline` is never cleared.
- **Impact**: The error message and the stale Task A pipeline are simultaneously visible. User cannot tell if the displayed pipeline belongs to the selected task or a previous one.
- **Fix**: Call `setPipeline(null)` at the start of the effect (after `setFetchError(null)`) to clear stale data before any new fetch.

### Issue 7: Squad.tsx `formatElapsed` returns NaN string for invalid `spawnTime`

- **File**: `packages/dashboard-web/src/views/Squad.tsx`, lines 12–18
- **Scenario**: A worker is emitted with an unparseable `spawnTime` (malformed ISO string, missing field coerced to empty string by parser).
- **Impact**: `WorkerNode` renders "NaNs" or "NaNm" in the elapsed time cell — visible garbled text in the production UI.
- **Fix**: Guard `formatElapsed` against `NaN`: `if (!Number.isFinite(ms) || ms < 0) return '—';`

---

## Moderate Issues

### Issue 8: Auto-selection of first task in Pipeline.tsx re-fires on every registry update

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx`, lines 104–108
- **Scenario**: `activeTasks` is a derived value computed inline: `registry.filter(...)`. In React, this creates a new array reference on every render. The `useEffect` at line 104 depends on `[activeTasks, selectedId]`. Every registry change (e.g., a task status update pushed via SSE) produces a new `activeTasks` reference, triggering the effect. The condition `!selectedId && activeTasks.length > 0` prevents re-setting `selectedId` once it is chosen, so this does not cause an infinite loop. However, the effect runs unnecessarily on every registry refresh.
- **Fix**: Move `activeTasks` to a `useMemo` or restructure the effect to depend on `[registry, selectedId]` with an explicit check.

### Issue 9: isReviewLeadChild / isTestLeadChild check role (post-infer) not label (raw), but REVIEW_LEAD_CHILDREN set contains raw label fragments

- **File**: `packages/dashboard-service/src/state/store.ts`, lines 382–415
- **Scenario**: `isReviewLeadChild(role)` receives the already-inferred role string (e.g., `'Style Reviewer'`). It checks `REVIEW_LEAD_CHILDREN.has(role.toLowerCase())`. The set contains `'style reviewer'` — so `'style reviewer'` matches correctly. But if `inferRole` returned the raw label unchanged (the final `return label` fallback), and the raw label were e.g. `'code style reviewer'`, `.has('code style reviewer')` fails — it is not in the set, which only has `'code style'` and `'style reviewer'`.
- **Impact**: Workers with labels that do not precisely match inferRole's recognized patterns fall through to `roots` instead of being nested under their lead. The tree is flatter than intended.
- **Fix**: Apply `isReviewLeadChild` and `isTestLeadChild` to the raw label before inferRole is called, or expand the sets to cover more label variants.

### Issue 10: parseTable skips separator rows but not header rows with dashes in cell values

- **File**: `packages/dashboard-service/src/parsers/session-analytics.parser.ts`, lines 36–49
- **Scenario**: The check `cells[0].startsWith('---')` skips Markdown separator rows. But if a data row has a first cell starting with `---` (unlikely but possible in free-text markdown tables), it is silently skipped.
- **Scenario 2**: `cells[0] === 'Field'` only catches the exact header literal. If the table header is `| **Field** | **Value** |` (bolded), `cells[0]` is `'**Field**'` and the header row is parsed as a data row with key `'**Field**'` — a phantom entry in the result map.
- **Impact**: Bolded Markdown table headers produce phantom keys. The analytics object falls back to field-path-derived taskId but other fields (`outcome`, `duration`, etc.) become empty strings.
- **Fix**: Normalize header detection: `cells[0].replace(/\*/g, '').trim() === 'Field'`.

---

## Minor Issues

### Issue 11: `PipelineArrow` uses the Unicode right arrow character hardcoded in JSX

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx`, line 79
- Not a correctness issue but renders as `→` which in some fonts/OS combinations may not display at the expected width. Using an SVG or CSS border would be more robust. Low priority.

### Issue 12: PULSE_STYLE injects a `<style>` tag on every render cycle

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx`, lines 7–12 and 113–114
- The `PULSE_STYLE` string is injected as an inline `<style>` block inside the JSX tree. If the `Pipeline` component is unmounted and remounted (e.g., route navigation), the style tag may accumulate in the `<head>` depending on the React renderer. In practice this is cosmetic but it is not idiomatic — CSS animations should be defined in a stylesheet.

### Issue 13: `api.getWorkerTree` has no taskId validation, unlike `getTaskPipeline`

- **File**: `packages/dashboard-web/src/api/client.ts`, line 82–84
- Minor inconsistency: `getTaskPipeline` validates the taskId with `TASK_ID_RE` before fetching. `getWorkerTree` takes no parameters — this is correct and consistent, so no issue. But `getTaskPipeline` and `getTask` validate; `getTaskReviews` also validates. The pattern is consistent where needed.

### Issue 14: Empty-state in Squad.tsx contains an emoji

- **File**: `packages/dashboard-web/src/views/Squad.tsx`, line 138
- `🚫` is an emoji added without explicit user request. Per project conventions in CLAUDE.md: "Do not use emojis unless user explicitly requests it."

---

## Data Flow Analysis

```
SessionAnalytics data flow:

session-analytics.md (on disk)
  → chokidar watcher fires
  → FileRouter.handleChange() [debounce 100ms]
  → SessionAnalyticsParser.canParse() — regex match
  → SessionAnalyticsParser.parse() — parseTable()
      [RISK: bolded headers produce phantom keys]
      [RISK: pipe chars in cell values truncate data]
  → StateStore.setSessionAnalytics(taskId, analytics)
      [NO event emitted — SSE clients not notified]
  ← stored in sessionAnalyticsMap

Pipeline API flow:

GET /api/tasks/:id/pipeline
  → http.ts: registry lookup — 404 if not found [CORRECT]
  → store.getTaskPipeline(taskId)
  → buildPipelinePhases(taskStatus, analytics)
      [RISK: FAILED maps to '' — no phase marked failed]
      [RISK: FIXING absent from frontend type union]
  → getDurationForPhase per phase
      [RISK: Review and Fix return same total duration]
  → PipelineData returned as JSON

Pipeline.tsx flow:

Registry SSE update → useDashboardStore → activeTasks recomputed
  → useEffect([activeTasks, selectedId]) re-runs [unnecessary re-run]
  → setSelectedId(activeTasks[0].id) if no selection
  → useEffect([selectedId]) fires
  → api.getTaskPipeline(selectedId)
      [RISK: no AbortController — prior fetch can overwrite]
      [RISK: pipeline not cleared before new fetch — stale shown on error]
  → setPipeline(data)
  → render PhaseNode per phase

Worker tree flow:

GET /api/workers/tree
  → store.getWorkerTree()
  → buildWorkerTrees(activeWorkers)
  → inferRole per worker label
      [RISK: isReviewLeadChild checks inferred role, not raw label]
  → parent-child assembly
      [RISK: multiple leads of same type — second clobbers first]
      [RISK: roots ordering non-deterministic]
  → WorkerTree[] returned

Squad.tsx:
  setInterval(load, 5000)
  → api.getWorkerTree()
  → setTrees() [stale trees kept on error]
  → formatElapsed(node.elapsedMs)
      [RISK: NaN if spawnTime invalid]
```

### Gap Points:
1. No `DashboardEvent` emitted after analytics parse — push notification gap.
2. Pipeline fetch not cancelled on task re-selection — stale response window.
3. `FAILED` and `FIXING` status handling broken at type and logic levels.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Pipeline view shows per-task phase diagram with status indicators | PARTIAL | FAILED state displays all phases as pending — broken |
| Active phases have visual pulse/glow animation | COMPLETE | Correctly implemented |
| Duration and model shown per phase | PARTIAL | Duration is total session duration, not per-phase; model field entirely absent |
| Cost per phase available on hover | MISSING | No cost data in PipelinePhase or PipelineData |
| Parallel phases (Review + Test) shown as branched paths | PARTIAL | parallelParts are hardcoded strings, not dynamic; visual branching is stacked list not true branching |
| Squad view shows hierarchical Lead→sub-worker tree per task | COMPLETE | Core logic works |
| Sub-workers appear in real-time as spawned | PARTIAL | Polling only (5s interval), not WebSocket real-time |
| Health status color-coded per worker | COMPLETE | HEALTHY_COLOR map correct |
| Completed workers collapse with checkmark | MISSING | No collapsed state in WorkerNode |
| Click-through from pipeline phase to related artifacts | MISSING | No onClick, no routing |
| Click-through from worker to detailed stats | MISSING | No onClick, no stats panel |

### Implicit Requirements NOT Addressed:
1. A task with no analytics data and status `CREATED` shows four pending phases with no duration — correct but there is no user-facing explanation that analytics are unavailable yet.
2. When `orchestratorState` is null (no session active), Squad shows "No active squads" — this is the correct behavior, but the route is registered regardless; a user navigating directly to `/squad` with no active session gets no guidance that a session must be running.
3. The `PipelineData.outcome` field renders `null` by hiding the outcome section, but non-`COMPLETE` outcomes (e.g., `'FAILED'`, partial strings from analytics) are colored red — the condition `pipeline.outcome === 'COMPLETE'` is correct but any unexpected string value also gets red color, which may be misleading if the analytics outcome field contains a custom value.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Empty registry | YES | activeTasks = [], no fetch, empty dropdown | No empty-state message in Pipeline view |
| Task not in registry (pipeline endpoint) | YES | 404 returned | Correct |
| No analytics for task | YES | analytics = null, duration = null | Correct |
| FAILED task status | NO | All phases render as pending | Critical bug |
| FIXING task status (frontend) | NO | Missing from TaskStatus union | Type mismatch |
| Multiple leads of same type | NO | Second clobbers first lead node | Children orphaned |
| Invalid spawnTime string | PARTIAL | Empty string guarded, non-empty invalid string produces NaN | NaN rendered in UI |
| Rapid task re-selection | NO | No AbortController | Stale response race condition |
| Service down during Squad poll | PARTIAL | fetchError set, stale trees shown | Misleading state |
| Worker label matches no pattern | YES | Returns raw label via fallback | Label shown as-is (acceptable) |
| Bolded markdown table headers | NO | Header parsed as data row | Phantom keys, analytics silently wrong |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| Registry → Pipeline phase derivation | MED | FAILED status shows wrong state | None — bug |
| SessionAnalytics parse → store | LOW | Bolded headers corrupt data | None — bug |
| Pipeline fetch → React state | MED | Race condition on fast re-selection | None |
| Worker tree assembly → Lead ordering | LOW | Duplicate leads clobber each other | None |
| Squad 5s poll → stale state on error | MED | Old workers shown as active post-failure | None |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The FAILED pipeline state display is broken (dead code path means no phase is ever marked failed), and five of eleven acceptance criteria from the task spec are entirely unimplemented (model badge, cost on hover, click-through from phases, click-through from workers, worker collapse). This is a partial implementation shipped as complete.

## What Robust Implementation Would Include

- `AbortController` in Pipeline's fetch effect, cleaned up on dependency change
- `setPipeline(null)` before each new fetch to prevent stale-data-plus-error display
- Correct `FAILED` phase marking: either a `failedPhase` field in the status mapping or a last-active-phase inference
- `FIXING` added to `TaskStatus` in both packages
- `formatElapsed` guard against `NaN` input
- `isReviewLeadChild` / `isTestLeadChild` applied to raw label before inferRole, or expanded set entries
- Sorted `roots` array after tree assembly
- A `DashboardEvent` emitted after `setSessionAnalytics` so SSE clients update without polling
- Bolded-header normalization in `parseTable`
- `useMemo` for `activeTasks` to avoid unnecessary effect re-runs
