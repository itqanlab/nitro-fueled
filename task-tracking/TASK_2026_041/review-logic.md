# Logic Review — TASK_2026_041

## Score: 5/10
## Verdict: PASS_WITH_NOTES

---

## Acceptance Criteria Status

- [x] Cost trend chart across sessions (cumulative and per-session) — bar chart present; **cumulative line chart missing**
- [x] Cost breakdown by model per session (stacked bar) — implemented in AnalyticsCostChart
- [~] Efficiency metrics: avg time/tokens/retries per task trending over sessions — data shape exists but **avgTokensPerTask and retryRate are hardcoded 0**; no chart rendered in HistoricalAnalytics.tsx
- [x] Session comparison table with sortable columns — all columns sortable, works
- [x] Model routing analysis: actual vs hypothetical all-Opus cost — implemented, logic is approximate
- [x] Charts handle gracefully when only 1 session exists (no empty charts) — guarded with `< 2` message
- [x] Data cached and updated when new sessions complete — **cache exists but `invalidate()` is never called**
- [x] Responsive chart sizing (works on different screen widths) — SVG uses `width="100%"` + `viewBox`; table uses `overflowX: auto`

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Caching never invalidates.** `AnalyticsStore.invalidate()` is defined but has zero call sites in the entire codebase. The watcher in `index.ts` fires `fileRouter.handleChange()` on every `.md` file change, but the analytics store is never notified. After the 30-second TTL expires the store re-reads from disk on the next request, so data is eventually consistent — but the acceptance criterion "updated when new sessions complete" is not met: a freshly completed session may not appear for up to 30 seconds with no way for the user to force a refresh.

**Concurrent `buildCaches()` calls produce a race.** Four public getters each call `buildCaches()`. If all four are called simultaneously (e.g., the dashboard loads and fires `Promise.all([cost, models, sessions])`), `isCacheValid()` returns `false` for all four before any of them finishes, and four independent `aggregateAllSessions()` directory scans are launched in parallel. Each scan resolves and overwrites `cacheTs` and the four cache fields independently. The final state is whichever scan resolves last — which is correct by accident but wastes 3x I/O on every cold load.

**`parseCostFromContent` falls back to `log.md` silently.** When `state.md` is missing the code reads `log.md` instead (`const content = stateContent ?? logContent ?? ''`). `log.md` has a completely different format; `parseCostFromContent` will likely return zeros for taskCount and totalCost, causing the session to be silently skipped (`if (parsed.taskCount === 0 && parsed.totalCost === 0) continue`). No warning is emitted.

### 2. What user action causes unexpected behavior?

**Navigating to the page while sessions are running.** The page fetches only once (empty `[]` dependency in `useEffect`). If a new session completes after the page loads, the charts do not refresh. There is no polling, no WebSocket subscription, and no manual refresh button. The user must navigate away and back to see updated data.

**Clicking a column header twice rapidly.** The sort state is local to `AnalyticsSessionsTable` and toggling is synchronous, so rapid clicks are fine. No issue here — but see the missing `aria-sort` attribute for accessibility.

**Visiting the page when `analyticsStore` is `undefined`.** The `createHttpServer` signature marks `analyticsStore` as optional. All four analytics routes fall back to empty-data promises when it is absent. The frontend receives valid empty responses and renders "Not enough data" or "No session data available yet" — this path is safe.

### 3. What data makes this produce wrong results?

**`taskCount` parsing is wrong for most real files.**
```
const completeMatches = content.match(/COMPLETE/g);
const taskCount = completeMatches ? Math.floor(completeMatches.length / 2) : 0;
```
The assumption is that "COMPLETE" appears exactly twice per completed task (once in a status column, once in a heading or summary). In `state.md` files the word "COMPLETE" appears in the task registry table for every task that has ever been COMPLETE — not twice per task. A session with 5 completed tasks and a registry table will have 10+ matches and produce a task count of 5+, but a session with no registry section and a compact state summary might yield 0. This is the primary metric (tasks per session) and it is unreliable.

**`durationMinutes` picks up arbitrary numbers from content.**
```
const minMatch = content.match(/(\d+)m\b/);
```
The fallback `\d+m\b` matches things like "3m" inside model names (`claude-sonnet-3m`), commit hashes, or cost strings. This can produce a wildly wrong duration for any session whose state file does not contain a `Xh Ym` pattern.

**`opusCost` double-counts.** The regex `/opus[^$\n]*\$([0-9.]+)/gi` matches every line containing "opus" followed by a dollar amount. If `state.md` contains a table with a running total row that mentions "opus" alongside the cumulative cost, that total is added on top of the per-task opus lines, inflating the opus cost beyond `totalCost`.

**Hypothetical all-Opus calculation is circular and produces $0 savings.**
In `buildModelsData`, `estimatedTokens` is back-calculated from `totalCost / OPUS_COST_PER_MTK`, then `hypOpus` is re-derived as `estimatedTokens * OPUS_COST_PER_MTK`. This equals `totalCost` exactly, so `actualSavings = Math.max(0, hypOpus - totalCost) = 0` always — the savings banner will never show a non-zero value via this code path.

In `aggregateAllSessions`, `hypotheticalOpusCost: cumulativeCost * 1.8` uses a different formula (a 1.8x multiplier). Two conflicting hypothetical-cost calculations exist in the same codebase, and neither is derived from actual token counts.

**`parseAvgReviewScore` matches all `X/10` strings in analytics.md**, including version numbers, percentage metrics formatted as fractions, or any other numeric ratio. A line like "Processed 8/10 tasks" would inflate the review score average.

### 4. What happens when dependencies fail?

**`readdir` ENOENT on the sessions directory.** Handled — the catch block returns `[]` and all analytics endpoints return empty data. Safe.

**`readFile` failure on a specific `state.md`.** Handled — `readTextFile` returns `null` and the session is skipped. Safe.

**Concurrent HTTP requests to the four analytics endpoints during `buildCaches()`.** Four separate in-flight `aggregateAllSessions()` calls run simultaneously (see Finding 1). Each holds open file handles for every session directory. Under a large session directory tree this could hit `EMFILE` (too many open files). There is no back-pressure or concurrency limit.

**`analyticsStore` build failure after cache is populated.** If `buildCaches()` throws partway through (e.g., unexpected `readFile` rejection that bypasses the try-catch), `cacheTs` is never updated, so the next request will retry — which is correct behavior. However the four cache fields may be in a partially updated state from a previous successful run interleaved with a failed run.

### 5. What's missing that the requirements didn't mention?

**No refresh mechanism.** The task spec says "Data cached and updated when new sessions complete." The cache TTL means data is eventually consistent, but there is no event-driven invalidation and no UI affordance for manual refresh.

**`EfficiencyData` is fetched but never rendered.** `HistoricalAnalytics.tsx` calls `getAnalyticsEfficiency()` via the API client, but the result is not stored in state and no chart or table renders it. The efficiency endpoint exists and is correct on the server side, but the acceptance criterion "efficiency metrics trending over sessions" is not visible in the UI. (The `HistoricalAnalytics` component only fetches cost, models, and sessions — not efficiency.)

Wait — re-reading the component: `Promise.all([api.getAnalyticsCost(), api.getAnalyticsModels(), api.getAnalyticsSessions()])`. `getAnalyticsEfficiency()` is not called at all. The efficiency data is absent from the rendered page.

**No token-level data anywhere.** `avgTokensPerTask` is hardcoded to `0` in `buildEfficiencyPoint`. `ModelUsagePoint.tokenCount` is hardcoded to `0` in `buildModelsData`. The hypothetical Opus savings calculation is therefore based on cost alone, not on actual token counts. If the project ever captures token data, the fields exist but the parsing is missing.

**`AnalyticsCostData.hypotheticalOpusCost` is computed as `cumulativeCost * 1.8`** — a hardcoded multiplier with no basis in the actual model pricing ratio. The real Opus/Sonnet price ratio at time of writing is ~5:1 (input) or ~5:1 (output), not 1.8. The value shown in the cost summary card is misleading.

---

## Failure Mode Analysis

### Failure Mode 1: Cache Never Invalidates

- **Trigger**: A session completes and writes a new `state.md` or `analytics.md` to disk.
- **Symptoms**: The dashboard shows stale session counts and costs until the 30-second TTL expires. If the user is watching the dashboard during an active run, freshly completed sessions never appear unless the user navigates away and back (resetting `useEffect`).
- **Impact**: Moderate — data is eventually consistent within 30 seconds, but violates the acceptance criterion.
- **Current Handling**: `invalidate()` exists but has no callers. The watcher in `index.ts` does not call it.
- **Recommendation**: Call `this.analyticsStore.invalidate()` inside `watchTaskTracking`'s watcher callback whenever a session `state.md` or `analytics.md` changes. Alternatively, integrate it as an event bus subscriber on `session:completed`.

### Failure Mode 2: Concurrent `buildCaches()` — Parallel Directory Scans

- **Trigger**: Dashboard page load fires `Promise.all` for three analytics endpoints simultaneously; all three pass `isCacheValid() === false` at the same instant.
- **Symptoms**: Three full directory scans run in parallel, each reading every session directory's files. Results are indeterminate (last writer wins). Under heavy session directories this can spike I/O and approach `EMFILE`.
- **Impact**: Serious on large installations; minor on small ones.
- **Current Handling**: None.
- **Recommendation**: Store the in-flight `buildCaches()` promise and return it to subsequent callers: `this._buildPromise = this._buildPromise ?? this.aggregateAllSessions().then(...).finally(() => { this._buildPromise = null; })`.

### Failure Mode 3: `taskCount` Parser Unreliability

- **Trigger**: Any session `state.md` that contains a registry table (which is the normal format), or any file where "COMPLETE" appears more or fewer than twice per completed task.
- **Symptoms**: Task counts are wrong. Sessions with registries show inflated counts; sessions with no registry section show zero tasks and are skipped entirely.
- **Impact**: Serious — task counts feed the efficiency metrics (avg duration/task, failure rate), the session comparison table, and the "Sessions Analyzed" stat card.
- **Current Handling**: None.
- **Recommendation**: Count tasks by a more discriminating pattern, e.g., lines of the form `| TASK_YYYY_NNN | ... | COMPLETE |` in the registry table, rather than a raw word count.

### Failure Mode 4: Efficiency View Never Rendered

- **Trigger**: Any user opening the Historical Analytics page.
- **Symptoms**: The "Efficiency metrics: avg time/tokens/retries" acceptance criterion is fully absent from the UI. `getAnalyticsEfficiency()` is defined in the API client but not called from `HistoricalAnalytics.tsx`. The server endpoint works and returns data.
- **Impact**: Critical — acceptance criterion is not met.
- **Current Handling**: Not implemented in the frontend.
- **Recommendation**: Fetch efficiency data in the `Promise.all` block and render a chart or table for it.

### Failure Mode 5: Hypothetical Opus Savings Always $0 (via `buildModelsData`)

- **Trigger**: Any request to `/api/analytics/models`.
- **Symptoms**: `actualSavings` is always 0. The "Estimated savings" line in the green box never renders. The "Estimated Savings vs All-Opus" stat card always shows `$0.00`.
- **Impact**: Moderate — the feature is present but produces no useful output.
- **Current Handling**: The math is `hypOpus = (totalCost / OPUS_COST_PER_MTK) * 1_000_000 / 1_000_000 * OPUS_COST_PER_MTK` which simplifies to `totalCost`. `actualSavings = max(0, totalCost - totalCost) = 0`.
- **Recommendation**: The hypothetical must be computed per-model: take Sonnet cost, derive its token count using Sonnet pricing, then reprice those tokens at Opus rates. That requires per-model token counts, which are not captured. Use the simpler `cumulativeCost * multiplier` approach (already used in `aggregateAllSessions`) and remove `buildModelsData`'s circular calculation.

---

## Critical Issues

### Issue 1: Efficiency View Not Rendered

- **File**: `packages/dashboard-web/src/views/HistoricalAnalytics.tsx:27`
- **Scenario**: Any page load.
- **Impact**: The "efficiency metrics trending over sessions" acceptance criterion is invisible to users. No chart, no table, no data.
- **Evidence**: `Promise.all([api.getAnalyticsCost(), api.getAnalyticsModels(), api.getAnalyticsSessions()])` — `getAnalyticsEfficiency()` is absent from this call.
- **Fix**: Add `api.getAnalyticsEfficiency()` to the `Promise.all`, store the result, and render an efficiency section.

### Issue 2: `invalidate()` Has No Callers

- **File**: `packages/dashboard-service/src/index.ts` — watcher callback at line 102
- **Scenario**: A session completes and writes files to disk.
- **Impact**: The "Data cached and updated when new sessions complete" criterion is not met. Stale data persists for up to 30 seconds.
- **Evidence**: `grep -rn "invalidate" packages/dashboard-service/src/` returns only the definition in `analytics-store.ts`.
- **Fix**: In `watchTaskTracking`'s watcher callback, check if the changed path is under a `sessions/SESSION_*` directory and call `this.analyticsStore.invalidate()`.

---

## Serious Issues

### Issue 3: `taskCount` Regex Produces Unreliable Counts

- **File**: `packages/dashboard-service/src/state/analytics-helpers.ts:28-29`
- **Scenario**: Any session whose `state.md` includes a task registry table (the majority).
- **Impact**: Task count is inflated. Derived metrics (avg duration/task, failure rate) are wrong. Some sessions may be skipped (count = 0).
- **Evidence**: `content.match(/COMPLETE/g)` then `Math.floor(count / 2)`. A registry table with 5 COMPLETE tasks plus a status summary row has ~10-12 "COMPLETE" occurrences.

### Issue 4: Hypothetical Opus Savings Always Returns Zero

- **File**: `packages/dashboard-service/src/state/analytics-store.ts:77-79`
- **Scenario**: Any request to `/api/analytics/models`.
- **Impact**: The savings feature always displays $0.00; the green "Estimated savings" line never renders.
- **Evidence**: `estimatedTokens = (totalCost / OPUS_COST_PER_MTK) * 1_000_000`, then `hypOpus = (estimatedTokens / 1_000_000) * OPUS_COST_PER_MTK` which equals `totalCost` algebraically.

### Issue 5: Concurrent Cache Build Race (Four Parallel Directory Scans)

- **File**: `packages/dashboard-service/src/state/analytics-store.ts:121-129`
- **Scenario**: Dashboard page load (`Promise.all` of three parallel API calls before cache is warm).
- **Impact**: Redundant I/O; potential `EMFILE` on large installations; non-deterministic final cache state.

---

## Moderate Issues

### Issue 6: `durationMinutes` Fallback Regex Over-Matches

- **File**: `packages/dashboard-service/src/state/analytics-helpers.ts:36-38`
- **Scenario**: Any session file without a `Xh Ym` pattern.
- **Impact**: Duration metrics may be wildly wrong, showing minutes extracted from model version strings or other numeric fragments.

### Issue 7: `opusCost` Regex May Double-Count Cumulative Rows

- **File**: `packages/dashboard-service/src/state/analytics-helpers.ts:17-19`
- **Scenario**: Session files with a summary table that includes a "Total Opus cost" row after per-task opus rows.
- **Impact**: `costByModel['claude-opus-4-6']` can exceed `totalCost`, making the stacked bar chart render incorrectly (negative "other" segment, since `otherH = barH - opusH - sonnetH` can go negative).

### Issue 8: `parseAvgReviewScore` Matches Non-Score Fractions

- **File**: `packages/dashboard-service/src/state/analytics-helpers.ts:55`
- **Scenario**: `analytics.md` contains ratio strings unrelated to review scores.
- **Impact**: Average review score is polluted; trending data is misleading.

### Issue 9: `AnalyticsCostData.hypotheticalOpusCost` Uses Magic 1.8x Multiplier

- **File**: `packages/dashboard-service/src/state/analytics-store.ts:115`
- **Scenario**: Displayed as a metric in the cost endpoint response.
- **Impact**: The hypothetical is not grounded in actual pricing. Sonnet is approximately 5x cheaper than Opus; the 1.8x figure significantly understates potential savings and may confuse users comparing the number to `actualSavings` from the models endpoint (which is always 0 for a different reason).

### Issue 10: No Data Refresh in Frontend

- **File**: `packages/dashboard-web/src/views/HistoricalAnalytics.tsx:21`
- **Scenario**: User leaves the page open while sessions complete.
- **Impact**: Page shows stale data indefinitely. No WebSocket subscription, no polling, no refresh button.

---

## Data Flow Analysis

```
[User opens HistoricalAnalytics]
  → Promise.all([cost, models, sessions])     # efficiency NOT fetched
  → api.getAnalyticsCost()
      → GET /api/analytics/cost
          → analyticsStore.getCostData()
              → buildCaches() [if TTL expired — NO event-driven invalidation]
                  → aggregateAllSessions()
                      → readSessionDirs()      # reads task-tracking/sessions/
                      → for each dir:
                          readTextFile(state.md) ?? readTextFile(log.md)
                          parseCostFromContent(content)
                              taskCount = COMPLETE matches / 2  # UNRELIABLE
                              totalCost = regex match           # OK
                              opusCost  = regex match           # MAY DOUBLE-COUNT
                              duration  = regex match           # MAY OVER-MATCH
                          readTextFile(analytics.md)
                          parseAvgReviewScore()                 # MAY MATCH NON-SCORES
              → [3 parallel buildCaches() calls land here concurrently — NO MUTEX]
          ← AnalyticsCostData
              hypotheticalOpusCost = cumulativeCost * 1.8      # MAGIC MULTIPLIER
      ← JSON
  → api.getAnalyticsModels()
      → GET /api/analytics/models
          → analyticsStore.getModelsData()
              → buildCaches() [same race, may be second concurrent scan]
              → buildModelsData(costData.sessions)
                  actualSavings = max(0, totalCost - totalCost) # ALWAYS 0
      ← JSON
  → api.getAnalyticsSessions()  [efficiency omitted]
      ← JSON
  → setState for 3 data shapes
  → render: StatCards + CostChart + SessionsTable + ModelsChart
            # EfficiencyData section: MISSING FROM RENDER
```

### Gap Points Identified:

1. `getAnalyticsEfficiency()` never called; efficiency data never rendered.
2. `invalidate()` never called; cache never invalidated on file change.
3. `buildCaches()` has no concurrency guard; 3+ parallel scans on cold load.
4. `taskCount` calculation unreliable for real session file formats.
5. `actualSavings` algebraically always 0 via `buildModelsData`.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Cost trend chart (cumulative + per-session) | PARTIAL | Per-session bar chart present; cumulative line chart absent |
| Cost breakdown by model per session (stacked bar) | COMPLETE | Rendering works; may show negative segment if opusCost > totalCost |
| Efficiency metrics trending | MISSING | Server endpoint exists; frontend does not fetch or render it |
| Session comparison table (sortable) | COMPLETE | All 7 columns sortable; works correctly |
| Model routing: actual vs hypothetical Opus cost | PARTIAL | Shown in UI but `actualSavings` is always $0 due to math error |
| 1-session grace (no empty charts) | COMPLETE | `< 2` guard with message |
| Cache updated when session completes | PARTIAL | 30s TTL works; event-driven invalidation missing |
| Responsive chart sizing | COMPLETE | SVG viewBox + table overflow |

### Implicit Requirements NOT Addressed:

1. **Live data while page is open** — no polling or WebSocket subscription; user must navigate away and back.
2. **Cumulative cost line chart** — the task spec explicitly calls for "Line chart: cumulative cost over time." Only a bar chart is present.
3. **Cost-per-task efficiency trending** — mentioned in task spec as "Cost-per-task average trending over sessions." Not rendered (related to missing efficiency section).
4. **Pie chart: total spend by model** — task spec lists it. `AnalyticsModelsChart` uses horizontal bars, not a pie. Minor visual deviation, functionally equivalent.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Zero sessions | YES | Empty arrays returned; tables/charts show "no data" message | — |
| One session | YES | `< 2` guard in cost chart | Table and models chart still render with 1 row |
| Session dir unreadable | YES | `catch` returns `[]` | — |
| Individual file unreadable | YES | `readTextFile` returns `null`, session skipped | No warning emitted |
| `state.md` missing (log.md fallback) | PARTIAL | Falls back to `log.md` | `log.md` format incompatible with parser; session likely skipped silently |
| `analytics.md` missing | YES | `parseAvgReviewScore(null)` returns 0 | — |
| opusCost > totalCost (double-count) | NO | `otherH` goes negative in stacked bar | Negative SVG rect height renders as zero-height bar; visual glitch |
| Concurrent API calls on cold cache | NO | Multiple full directory scans | I/O amplification; potential EMFILE |
| Page open while new session arrives | NO | No refresh mechanism | Stale data until navigation |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| `readdir` on sessions dir | LOW | Returns empty data | Handled |
| `readFile` on individual session file | MEDIUM | Session skipped silently | Handled (no warning) |
| HTTP route throws async | LOW | `.catch()` returns 500 JSON | Handled |
| Concurrent `buildCaches()` calls | HIGH (on every page load) | 3x I/O; non-deterministic result | NOT handled |
| `invalidate()` never called | CERTAIN | Stale data for 30s after session completion | NOT handled |

---

## Verdict

**Recommendation**: PASS_WITH_NOTES
**Confidence**: HIGH
**Top Risk**: Efficiency metrics are entirely missing from the UI (acceptance criterion unmet), and `actualSavings` is always $0 due to a circular calculation — the two most visible features of the model routing section silently produce no output.

## What Robust Implementation Would Include

1. A `_buildPromise` mutex in `AnalyticsStore.buildCaches()` so concurrent callers await a single shared scan rather than launching parallel ones.
2. `invalidate()` wired into the chokidar watcher callback for session files, replacing the pure TTL approach.
3. `taskCount` parsed from registry table rows (lines matching `| TASK_YYYY_NNN |`) rather than raw word count.
4. Hypothetical Opus savings computed per-model using the actual model pricing ratio (5:1 for Opus/Sonnet), not a hardcoded 1.8x multiplier and not via a circular token back-calculation.
5. `getAnalyticsEfficiency()` called in `HistoricalAnalytics` and an efficiency chart or table rendered.
6. A polling interval (or WebSocket subscription to session-complete events) so the page refreshes without navigation.
7. `avgTokensPerTask` and `retryRate` populated from actual session data rather than hardcoded 0.
