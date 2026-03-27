# Code Style Review — TASK_2026_039

**Overall Score**: 4/10
**Assessment**: The implementation introduces three independent compilation blockers and a cascade of type-contract drift issues between backend and frontend. The pipeline phase derivation has a dead code branch that silently swallows the `FAILED` state. File size limits are exceeded by a wide margin. Several individual files are clean in isolation, which makes the cross-file failures more frustrating — they suggest the two packages were developed without being compiled together.

---

## Critical Issues

### 1. Missing imports in App.tsx — will not compile

- **File**: `packages/dashboard-web/src/App.tsx` lines 98–99
- **Problem**: `<Pipeline />` and `<Squad />` are used in the route table but neither `Pipeline` nor `Squad` is imported anywhere in the file. All other views are imported at lines 4–15; these two are absent.
- **Impact**: The app will fail at build time (TypeScript error + bundler error). No dashboard user can reach either new route.
- **Fix**: Add `import { Pipeline } from './views/Pipeline.js';` and `import { Squad } from './views/Squad.js';` with the existing view imports.

### 2. `as` type assertions in store and file-router

- **File**: `packages/dashboard-service/src/state/store.ts` lines 182–185
- **File**: `packages/dashboard-service/src/parsers/file-router.ts` line 120
- **Problem**: `store.ts` casts `worker as unknown as Record<string, unknown>` to reach `cost`, `tokens`, and `model` fields that do not exist on the `ActiveWorker` interface. `file-router.ts` casts `error as NodeJS.ErrnoException` to read `.code`. Both violate the project rule "No `as` type assertions — if the type system fights you, the type is wrong."
- **Impact**: The `store.ts` cast silently produces zero-value results if the underlying data ever does contain cost fields (the cast produces 0s and `'unknown'`, not actual values). The `file-router.ts` cast hides the fact that `.code` is not guaranteed on all `Error` subtypes in Node.js.
- **Fix for store.ts**: Add `cost?: number; tokens?: number; model?: string;` to the `ActiveWorker` interface in `event-types.ts`, then parse those optional fields properly instead of casting. Fix for file-router.ts: use a type guard (`function isErrnoException(e: unknown): e is NodeJS.ErrnoException { return e instanceof Error && 'code' in e; }`) instead of the assertion.

### 3. `TaskStatus` type divergence between packages — `FIXING` missing from backend

- **File**: `packages/dashboard-service/src/events/event-types.ts` line 1–9
- **File**: `packages/dashboard-web/src/types/index.ts` line 1–10
- **Problem**: The frontend `TaskStatus` union includes `'FIXING'`; the backend's does not. Yet `store.ts` `buildPipelinePhases` (line 315–338) uses `FIXING` as a key in its lookup tables. If the backend receives a `FIXING` task from the registry, the `statusToActivePhase` lookup returns `undefined`, falls through to `??`, and produces an empty `activePhase` — silently suppressing the active pipeline phase.
- **Impact**: Any task in `FIXING` state will display with all phases as `pending` in the pipeline view. The frontend type will also accept values the backend type rejects, creating a split contract.
- **Fix**: Add `'FIXING'` to `TaskStatus` in the backend `event-types.ts`.

---

## Serious Issues

### 1. Store.ts exceeds 200-line file size limit by 2.5x

- **File**: `packages/dashboard-service/src/state/store.ts` — 493 lines
- **Problem**: The file size limit for stores/services is 200 lines. This file is 493 lines. The `buildPipelinePhases`, `getDurationForPhase`, `buildWorkerTrees`, `inferRole`, `computeHealth`, `isReviewLeadChild`, and `isTestLeadChild` helper functions (lines 307–492) account for ~185 lines and have no dependency on `StateStore`'s private state. They are pure utility functions that were appended rather than extracted.
- **Recommendation**: Move the pipeline and worker-tree derivation helpers to `packages/dashboard-service/src/state/pipeline.ts` and `packages/dashboard-service/src/state/worker-tree.ts`. `store.ts` then imports and delegates to them, dropping back under 200 lines.

### 2. Dead code branch — `failed` pipeline phase status is unreachable

- **File**: `packages/dashboard-service/src/state/store.ts` lines 344–350
- **Problem**: Inside `buildPipelinePhases`, `statusToActivePhase['FAILED']` is `''` (empty string). The loop at line 346 checks `name === activePhase` — since no phase in `PHASE_ORDER` is named `''`, this condition is always false when the task is `FAILED`. The subsequent branch at line 348 is also `name === activePhase` (same empty string), which is also always false. The `'failed'` `PipelinePhaseStatus` value is never assigned by this logic.
- **Impact**: When a task fails, all phases render as `pending` instead of the intended failure indicator. The bug exists in the currently-shipped code, not as a future risk.
- **Recommendation**: Either assign `activePhase` meaningfully when `taskStatus === 'FAILED'` (e.g., map it to the last active phase), or add an explicit `failed` status path that marks the phase where failure occurred.

### 3. Type-contract drift across three more shared interface fields

- **`PlanData.currentFocus`**: nullable (`| null`) in the frontend, non-nullable in the backend. A `null` from a missing plan section will pass the frontend type guard but crash any backend code treating it as non-nullable.
- **`OrchestratorState.configuration`**: nullable in the frontend, non-nullable in the backend. Same risk.
- **`DashboardStats`**: backend adds `byModel`, `totalCost`, `totalTokens`, `costByModel`, `tokensByModel` as required fields; frontend declares `totalCost`, `totalTokens`, `costByModel`, `tokensByModel` as optional (`?`) and omits `byModel` entirely. A consumer component reading `stats.byModel` with the frontend type will receive a TypeScript error; the same field exists on the actual JSON response.
- **Files**: `packages/dashboard-service/src/events/event-types.ts` and `packages/dashboard-web/src/types/index.ts`
- **Recommendation**: These two files should be a single shared package (or one should import from the other). Until that refactor, any change to one must be mirrored manually in the other. Add a comment to both files calling out the coupling.

### 4. Hardcoded RGBA color literals in Pipeline.tsx

- **File**: `packages/dashboard-web/src/views/Pipeline.tsx` lines 9–11
- **Problem**: The CSS keyframe animation embeds `rgba(249,115,22,0.4)` and `rgba(249,115,22,0)` as raw color values. Project rule: "ALL colors via CSS variables or tokens. NEVER hardcoded hex/rgb values in components."
- **Impact**: When the theme accent color changes, the pulse animation remains orange. The token `tokens.colors.accent` exists and is already used on line 15 for the same conceptual color. The glow variant `tokens.colors.accentGlow` is also available.
- **Recommendation**: Either inject the token values into the `PULSE_STYLE` string as template literals, or convert the animation to a CSS class defined in the global stylesheet where CSS custom properties resolve correctly.

### 5. Unnecessarily wide inline type on `buildWorkerTrees` parameter

- **File**: `packages/dashboard-service/src/state/store.ts` line 424
- **Problem**: The parameter type is written as a 100-character inline structural type instead of referencing the already-defined `ActiveWorker` interface. This is inconsistent with every other function in the file and makes the signature hard to read.
- **Recommendation**: Replace the inline type with `ReadonlyArray<ActiveWorker>`. `ActiveWorker` is already imported at the top of the file.

### 6. Pointless array spread before single-source iteration

- **File**: `packages/dashboard-service/src/state/store.ts` lines 179–181
- **Problem**: `for (const worker of [...this.orchestratorState.activeWorkers])` spreads a `ReadonlyArray` into a new mutable `Array` immediately before iterating it. The spread creates a copy that is thrown away after the loop. The direct form `for (const worker of this.orchestratorState.activeWorkers)` is equivalent and does not allocate.
- **Recommendation**: Remove the array literal wrapper and iterate `activeWorkers` directly.

---

## Moderate Issues

### 1. `SessionAnalytics.outcome` typed as bare `string`

- **File**: `packages/dashboard-service/src/events/event-types.ts` line 295 and `packages/dashboard-web/src/types/index.ts` (inherited via `PipelineData.outcome`)
- **Problem**: `outcome` can only hold values like `'COMPLETE'`, `'FAILED'`, etc. Using bare `string` forfeits exhaustiveness checks. Pipeline.tsx line 160 already hard-codes the comparison `pipeline.outcome === 'COMPLETE'` — that is a magic string against a bare-string field.
- **Recommendation**: Define `type SessionOutcome = 'COMPLETE' | 'FAILED' | 'CANCELLED'` (or reuse `TaskStatus`) and apply it to `SessionAnalytics.outcome` and `PipelineData.outcome`.

### 2. `WorkerTreeNode.status` and `WorkerTreeNode.workerType` typed as bare `string`

- **File**: `packages/dashboard-service/src/events/event-types.ts` lines 279–280
- **Problem**: `WorkerStatus` and `WorkerType` are already defined in the same file. These fields should use those types.
- **Recommendation**: Change `status: string` to `status: WorkerStatus` and `workerType: string` to `workerType: WorkerType`.

### 3. `SessionAnalytics` parse produces empty strings for missing time fields with no indication

- **File**: `packages/dashboard-service/src/parsers/session-analytics.parser.ts` lines 27–30
- **Problem**: `startTime`, `endTime`, `duration`, and `outcome` default to `''` if the field is absent from the table. An empty string is indistinguishable from a field that was intentionally left blank vs. a file that never had the field. Downstream code in `getDurationForPhase` checks `analytics.duration` without a null guard — `''` is truthy in the context `analytics !== null`, so the duration value `''` could render as an empty string label in the UI.
- **Recommendation**: Use `string | null` for these fields and default to `null` when absent, consistent with how `filesModified` is handled in the same parser.

### 4. `getDurationForPhase` returns `analytics.duration` for all phases regardless of phase

- **File**: `packages/dashboard-service/src/state/store.ts` lines 366–378
- **Problem**: The function maps phase names to analytics phase names (`Build → Dev`, `Review → QA`, `Fix → QA`) and then checks if that analytics phase appears in `phasesCompleted`. If it does, it returns `analytics.duration` — which is the **total** session duration, not the per-phase duration. All phases will show the same total duration value. The variable name `duration` in the UI will mislead users into thinking it represents phase-specific elapsed time.
- **Recommendation**: Either source per-phase durations from the analytics data (if available), or rename the displayed value to `Total session duration` to make clear it applies to the whole session.

---

## Minor Issues

- **`Pipeline.tsx` line 55**: Ternary chain for status icons (`'complete' ? '✓' : 'failed' ? '✗' : ...`) works but would be more maintainable as a `Record<PipelinePhaseStatus, string>` constant, consistent with `STATUS_COLOR` and `STATUS_BG` above it.
- **`Squad.tsx` line 138**: Emoji `🚫` hardcoded in JSX. Minor, but inconsistent with the `Sidebar.tsx` pattern where emoji come from the `NavItem.icon` data field, not embedded in render logic.
- **`store.ts` line 309**: `PHASE_ORDER` is a module-level `const` with `SCREAMING_SNAKE_CASE` — correct per the review-general.md lesson. No issue here; noting for completeness since it could be confused with the Angular-world camelCase rule (which does not apply here).
- **`file-router.ts` line 221**: `if (!analytics.taskId) return;` silently drops analytics with an empty `taskId` with no log message. The analogous review and report parsers at lines 196 and 211 emit a `console.warn`. Apply the same pattern here.
- **`http.ts` lines 114–121**: The pipeline route checks `store.getRegistry().find(...)` to validate the task exists, then calls `store.getTaskPipeline(params.id)` which also calls `registry.find(...)` internally. This is a double-scan of the registry for every pipeline request. Minor but worth eliminating by having `getTaskPipeline` return `null` for unknown IDs and letting the HTTP layer handle it.

---

## Info

- **`session-analytics.parser.ts`** (51 lines): Clean, correct access modifiers, no `any`, proper regex. The `parseTable` private helper is a reasonable extraction. No issues beyond the `string` vs `string | null` concern noted under Moderate.
- **`Sidebar.tsx`** (99 lines): Clean. Nav items added correctly to the data array. Within file size limit.
- **`client.ts`** (103 lines): Clean. `getTaskPipeline` and `getWorkerTree` follow the exact pattern of all existing methods. Input validation via `TASK_ID_RE` is applied consistently. The `response.json() as Promise<T>` on line 33 is a pre-existing pattern in the file, not new to this task.
- **`http.ts`** changes: Both new routes integrate correctly with the existing `addRoute` / `sendJson` pattern.
