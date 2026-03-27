# Style Review — TASK_2026_041

## Score: 6/10
## Verdict: PASS_WITH_NOTES

---

## Findings

### BLOCKING

**[B1] `DashboardStats` interface divergence between service and web — silent runtime contract break**

- `packages/dashboard-service/src/events/event-types.ts:175–186` — service defines `byModel`, `totalCost`, `totalTokens`, `costByModel`, `tokensByModel` as **required** fields
- `packages/dashboard-web/src/types/index.ts:176–186` — web defines the same fields as **optional** (`?`) and is missing `byModel` entirely

This is an active cross-package contract break. Per the review lesson established in TASK_2026_039: "Shared interface files duplicated across packages must be kept byte-for-byte identical." The divergence compiles cleanly in both packages but will cause runtime failures when the web side accesses `stats.byModel` or when it receives an object where those fields are always present but the type says they might be absent. Any component that guards `stats.totalCost` with `?.` while the service always provides it is also silently weakening the type contract.

---

**[B2] New analytics types not re-exported from `packages/dashboard-service/src/index.ts`**

- `packages/dashboard-service/src/index.ts:175–198` — the `export type { ... }` block ends at `SessionAnalytics` and does not include `AnalyticsCostData`, `AnalyticsEfficiencyData`, `AnalyticsModelsData`, `AnalyticsSessionsData`, `SessionCostPoint`, `EfficiencyPoint`, `ModelUsagePoint`, `SessionComparisonRow`

Any external consumer that depends on the service package's public API (e.g., a CLI consumer, a test harness, or a future client that imports from the package rather than its internal paths) cannot import the new analytics types. The types exist only in `event-types.ts` internally and in the web's `types/index.ts` as a duplicate. This is the same pattern that caused TASK_2026_039's blocking finding: a growing duplication surface with no single source.

---

**[B3] `analytics-store.ts:93` — POSIX-only path split produces wrong `sessionId` on Windows**

- `packages/dashboard-service/src/state/analytics-store.ts:93-94`

```ts
const parts = dir.split('/');
const sessionId = parts[parts.length - 1];
```

`node:path` is already imported and `join` is already used to build `dir`. The `path` module provides `path.basename(dir)` which is cross-platform. Splitting on `'/'` works on macOS/Linux but silently returns the full path string as a single element on Windows (where paths use `\`), making `sessionId` a full absolute path instead of a folder name. All downstream logic (`parseSessionIdDate`, `buildSessionCostPoint`, etc.) then receives a broken ID.

---

### MINOR

**[M1] `PlanData.currentFocus` and `OrchestratorState.configuration` nullability diverge between service and web**

- `packages/dashboard-service/src/events/event-types.ts:65–71` — `currentFocus` is non-nullable in service
- `packages/dashboard-web/src/types/index.ts:66–72` — `currentFocus` is `| null` in web
- Same divergence on `configuration` (service: required; web: `| null`)

These divergences predate this task but were not corrected when the task added new interfaces. Because `analytics-store.ts` follows the correct pattern (using the service-side types directly), this is not a new regression — but the web-side types remain inconsistently looser than the service. Adding new types to the web `types/index.ts` without auditing and closing these gaps perpetuates the divergence trend.

**[M2] Sorted array in `AnalyticsSessionsTable` is recreated on every render with no memoization**

- `packages/dashboard-web/src/views/AnalyticsSessionsTable.tsx:66–75`

```ts
const sorted = [...sessions].sort((a, b) => { ... });
```

This is inside the component body with no `useMemo`. For the expected data sizes (tens of sessions) this is not a performance problem, but it violates the pattern from review lessons (TASK_2026_040): "Derived Maps inside render functions must be memoized." The same lesson applies to derived sorted arrays. `handleSort` and `sortIndicator` defined as plain inner functions are also recreated every render; `useCallback` should wrap `handleSort`.

**[M3] Two hardcoded `rgba` color values in `AnalyticsModelsChart.tsx`**

- `packages/dashboard-web/src/views/AnalyticsModelsChart.tsx:59` — `'rgba(148,163,184,0.15)'`
- `packages/dashboard-web/src/views/AnalyticsModelsChart.tsx:84` — `'rgba(34,197,94,0.08)'`

The review instructions and project rules state all colors via CSS variables or token values. The existing pattern in `CostDashboard.tsx` already uses `rgba(148,163,184,0.2)` directly (not via token), which indicates this is an established project convention for muted fills rather than a strict violation. However, both usages embed magic RGBA values with no named token or comment explaining the origin. At minimum, these should be aliased to named constants (e.g., `const TRACK_BG = 'rgba(148,163,184,0.15)'`) co-located with the component, so the intent is clear and not silently duplicated. The second value (`rgba(34,197,94,0.08)`) corresponds to `tokens.colors.green` at 8% opacity — a comment or named constant documenting this relationship would eliminate the guesswork.

**[M4] `http.ts:43`, `http.ts:152`, `http.ts:162` — lines exceed 120 characters**

- Line 43: `createHttpServer` signature is a single 116-char line but with 4 params it should be multi-line for readability
- Lines 152–153, 158, 162–163, 168: `.then().catch()` chains on one line exceed 120 chars each

No line-length rule is explicitly documented for this project, but the existing `http.ts` codebase above line 43 breaks parameters to multiple lines consistently. The new 4-route block switches style mid-file.

**[M5] `AnalyticsCostChart.tsx` SVG bar chart has no legend for stacked colors**

- `packages/dashboard-web/src/views/AnalyticsCostChart.tsx:83–104`

The stacked bar uses three fills (blue = other, cyan = sonnet, purple = opus) with no legend in the SVG or adjacent to it. A screen reader gets `aria-label="Cost per session bar chart"` but color-blind users viewing the chart cannot distinguish the segments. The `AnalyticsModelsChart` shows a proper labeled breakdown below — the cost chart should either follow the same pattern or include a `<title>` + `<desc>` SVG element per segment for accessibility.

**[M6] `analytics-helpers.ts` — `AggregatedSessionData` interface exported but never consumed**

- `packages/dashboard-service/src/state/analytics-helpers.ts:62–66`

```ts
export interface AggregatedSessionData {
  readonly costPoints: ReadonlyArray<SessionCostPoint>;
  readonly effPoints: ReadonlyArray<EfficiencyPoint>;
  readonly compRows: ReadonlyArray<SessionComparisonRow>;
}
```

This interface is defined and exported but nothing in the codebase imports or uses it. `AnalyticsStore.aggregateAllSessions` returns an inline anonymous type instead. Dead export surface per the review-general lesson: "No unused imports or dead code — if exported but never imported, remove it."

---

### SUGGESTIONS

**[S1] `AnalyticsSessionsTable.tsx` — `th` and `td` style objects defined at module scope as `React.CSSProperties` constants**

- `packages/dashboard-web/src/views/AnalyticsSessionsTable.tsx:34–52`

This is a good pattern — stable references defined outside the component avoid recreation on each render. Worth noting as the correct approach; the same technique could be applied to other components that currently inline their styles.

**[S2] `analytics-store.ts` — `buildModelsData` hardcodes `OPUS_COST_PER_MTK` for the hypothetical comparison but the constant is also used inline on line 115 as a magic multiplier `* 1.8`**

- `packages/dashboard-service/src/state/analytics-store.ts:115`

```ts
costData: { sessions: costPoints, cumulativeCost, hypotheticalOpusCost: cumulativeCost * 1.8 },
```

Line 79 uses the defined `OPUS_COST_PER_MTK` constant for an accurate per-token calculation. Line 115 uses a bare `1.8` multiplier as a rough approximation. These two "hypothetical Opus cost" calculations are derived differently and will diverge as Opus pricing changes. Either both should use the constant + token derivation, or a comment should explain that line 115 is a deliberate rough approximation and not a duplication mistake.

**[S3] `HistoricalAnalytics.tsx` — `AnalyticsEfficiencyData` is fetched from the client API but never consumed**

- `packages/dashboard-web/src/api/client.ts:110–112` — `getAnalyticsEfficiency` method exists
- `packages/dashboard-web/src/views/HistoricalAnalytics.tsx:27–31` — `Promise.all` fetches only cost, models, sessions; efficiency is not included

The efficiency API endpoint exists and the types are defined but no view displays efficiency data. If intentional (deferred feature), this should be noted. If unintentional, the `getAnalyticsEfficiency` call and the `AnalyticsEfficiencyData` state were dropped between planning and implementation.

---

## Summary Table

| File | Lines | Within Limit | Notes |
|------|-------|-------------|-------|
| `analytics-store.ts` | 150 | PASS (200 limit) | B3 path split, S2 magic multiplier |
| `analytics-helpers.ts` | 115 | PASS (200 limit) | M6 dead export |
| `HistoricalAnalytics.tsx` | 111 | PASS (150 limit) | S3 missing efficiency view |
| `AnalyticsCostChart.tsx` | 134 | PASS (150 limit) | M5 no legend |
| `AnalyticsSessionsTable.tsx` | 123 | PASS (150 limit) | M2 missing useMemo/useCallback |
| `AnalyticsModelsChart.tsx` | 107 | PASS (150 limit) | M3 hardcoded rgba |
| `AnalyticsCards.tsx` | 56 | PASS (150 limit) | Clean |
| `event-types.ts` (modified) | 358 | N/A | B1 DashboardStats divergence |
| `http.ts` (modified) | 245 | N/A | B2 missing re-exports (index), M4 line length |
| `index.ts` (modified) | 199 | N/A | B2 analytics types not re-exported |
| `types/index.ts` (modified) | 347 | N/A | B1 DashboardStats divergence, M1 nullability |
| `client.ts` (modified) | 124 | PASS | Clean |
| `App.tsx` (modified) | 116 | PASS | Clean |
| `Sidebar.tsx` (modified) | 100 | PASS | Clean |
