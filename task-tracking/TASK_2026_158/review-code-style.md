# Code Style Review — TASK_2026_158

## Review Summary

| Metric          | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Overall Score   | 5/10                                                                     |
| Assessment      | NEEDS_REVISION                                                           |
| Blocking Issues | 4                                                                        |
| Serious Issues  | 5                                                                        |
| Minor Issues    | 4                                                                        |
| Files Reviewed  | 10                                                                       |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `getActiveSessionsEnhanced()` method in `sessions.service.ts` (lines 162–163) uses `Math.random()` for both `currentPhase` and `status`. Every HTTP call returns different data, so the panel flickers on every WebSocket event that triggers a reload. The handoff acknowledges this but ships it as production code path anyway. Once load is real and events are frequent, the panel will be visually unusable.

The `catchError(() => EMPTY)` on line 64 of `sessions-panel.component.ts` (the background `closeStaleSession` call) silently discards all failures. If the backend crashes, no log, no metric — this violates the anti-pattern rule "NEVER swallow errors in fire-and-forget calls."

### 2. What would confuse a new team member?

`loadSessions()` is both an initialization call and a WebSocket event handler (called from `subscribeToSessionUpdates()` on every `sessions:changed` or `session:update` event). A new developer reading `loadSessions()` sees it calls `getActiveSessionsEnhanced()` and, on empty response, falls back to `loadMockData()`. They will not immediately understand that mock data appears in production whenever the backend returns an empty list — which is a normal state when no sessions are active.

`HealthResponse` (api.service.ts line 6) is an interface defined at the top of the service file, not in a `*.model.ts` file. The project anti-pattern rule explicitly says "Interfaces and types must be defined at module scope in `*.model.ts` files — never inside component or function bodies." Although this is a pre-existing issue, this task touches the file and did not fix it.

### 3. What's the hidden complexity cost?

`project.component.ts` is now 936 lines. The file-size limit for a component is 150 lines per project standards. The task added `SessionsPanelComponent` to the imports but left the bloated host component untouched. Any reviewer of this file going forward must wade through 200+ lines of manual test helpers (`testFullTextSearch`, `testStatusFilter`, etc.) that belong in a spec file, not in production component code.

The `heartbeatStatusMap` computed signal (lines 72–105) iterates both `sessions()` and `recentSessions()` but `continue`s for non-running sessions — the same wasted-allocation pattern already codified as a lesson from TASK_2026_203.

### 4. What pattern inconsistencies exist?

`statusSelectedCount()`, `typeSelectedCount()`, and `prioritySelectedCount()` are plain class methods (project.component.ts lines 353–363) called directly from the template (project.component.html lines 172–268). Per the established rule "template expressions must not call methods — use `computed()` signals," these should be `computed()` signals. The sessions-panel component correctly uses only `computed()` signals in its template; the host component violates the same rule.

The SCSS for `sessions-panel.component.scss` uses pixel values `4px`, `2px`, `11px`, `10px` (lines 250–265) as raw numbers — the heartbeat section mixes raw `px`/numbers with `rem`-based spacing used everywhere else in the file. The inconsistency is within the same file.

### 5. What would I do differently?

- Replace the `Math.random()` mock in `SessionsService.getActiveSessionsEnhanced()` with a deterministic mapping from `loopStatus` to a real status union, and derive `currentPhase` from the actual session log or leave it null. Ship placeholder UI rather than random data.
- Extract `statusSelectedCount`, `typeSelectedCount`, `prioritySelectedCount` as `computed()` signals in `project.component.ts`.
- Move all `test*` methods out of the production component and into a spec file.
- Add a `console.warn` inside the `catchError(() => EMPTY)` on the background `closeStaleSession` call.
- Convert the `HealthResponse` interface in `api.service.ts` to a named export in a model file (or remove it and use `{ status: string; service: string; timestamp: string }` inline).

---

## Blocking Issues

### Issue 1: Silent error swallow on fire-and-forget interval

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:64`
- **Problem**: `catchError(() => EMPTY)` discards the error entirely. No log, no metric.
- **Impact**: If `closeStaleSession` fails repeatedly (backend crash, network loss), operators have zero visibility. Violates the explicit anti-pattern: "NEVER swallow errors in fire-and-forget calls. At minimum, log them." The same violation was already codified in review-lessons/frontend.md from TASK_2026_203.
- **Fix**: Replace with `catchError((err) => { console.warn('[SessionsPanel] closeStaleSession failed:', err); return EMPTY; })`.

### Issue 2: Template method calls instead of computed signals

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:353–363` / `project.component.html:172–268`
- **Problem**: `statusSelectedCount()`, `typeSelectedCount()`, and `prioritySelectedCount()` are plain methods called directly in the template 3 times each. With `OnPush`, these fire on every signal-triggered change detection cycle, not just when the selection changes.
- **Impact**: Unnecessary re-execution. The project lesson "Template expressions must not call methods — use `computed()` signals" (codified 11 tasks ago) is violated here.
- **Fix**: Convert all three to `public readonly statusSelectedCount = computed(() => this.selectedStatuses().length)` (and equivalents for type and priority).

### Issue 3: Randomized data shipped as production code path

- **File**: `apps/dashboard-api/src/dashboard/sessions.service.ts:162–163`
- **Problem**: `currentPhase: phases[Math.floor(Math.random() * phases.length)]` and `status: statuses[Math.floor(Math.random() * statuses.length)]` return different data on every call. The endpoint is wired to the production controller and frontend.
- **Impact**: The sessions panel flickers to different phases/statuses on every WebSocket-triggered reload. Any monitoring or display logic that reads `currentPhase` or `status` will behave non-deterministically. This is not a "known risk" — it is broken behavior shipped to the main code path.
- **Fix**: Derive `currentPhase` from a real field (or return `null` and handle it in the frontend), and derive `status` deterministically from `loopStatus` only.

### Issue 4: `heartbeatStatusMap` iterates recentSessions but skips all of them

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:79–81`
- **Problem**: The computed signal spreads both `sessions()` and `recentSessions()` into `allSessions`, then immediately `continue`s for any session where `status !== 'running'`. Since `recentSessions` is constructed to contain only non-running sessions (lines 129/185), 100% of entries from `recentSessions` are iterated and immediately skipped — wasted allocation on every tick.
- **Impact**: This is the exact pattern documented in review-lessons/frontend.md from TASK_2026_203 as a blocking violation.
- **Fix**: Change `const allSessions = [...this.sessions(), ...this.recentSessions()]` to `const allSessions = this.sessions()` since only running sessions are processed.

---

## Serious Issues

### Issue 1: `startedAt.slice(11, 16)` is a method call in the template

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html:37`
- **Problem**: `session.startedAt.slice(11, 16)` is called inside an `@for` loop in the template. This fires on every change detection cycle for every item.
- **Tradeoff**: The `truncatedActivities` computed map was correctly added to avoid this, but the same pattern was not applied to `startedAt` formatting or to `session.sessionId.slice(-16)` (line 53).
- **Recommendation**: Add `startedAtTime` and `sessionIdShort` to the precomputed map (or a separate `formattedSessions` computed signal) alongside `truncatedActivities`.

### Issue 2: `lastHeartbeat` optional field allows silent data gaps

- **File**: `apps/dashboard/src/app/models/sessions-panel.model.ts:13`
- **Problem**: `readonly lastHeartbeat?: string | null` is optional. The `heartbeatStatusMap` computed signal handles `null`/`undefined` by falling back to the cortex heartbeat map, which is correct — but the frontend will silently show "No heartbeat" for any session where the field is genuinely absent vs. actually missing a heartbeat. There is no way to distinguish "field not returned" from "field returned as null" at the view layer.
- **Tradeoff**: This was flagged as a lesson from TASK_2026_203: "Optional interface fields on model types allow silent data flow gaps."
- **Recommendation**: If `lastHeartbeat` is required for the heartbeat feature to function, make it non-optional in the model (`readonly lastHeartbeat: string | null`). This forces the backend to always include the field and makes absence a compile error.

### Issue 3: Mock fallback fires when backend returns empty list

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:127–134`
- **Problem**: `if (data.length > 0) { ... } else { this.loadMockData(); }`. An empty list from the backend (no active sessions — a valid production state) silently triggers mock data. The UI will always show at least 3 fake sessions.
- **Tradeoff**: This masks real state. The correct behavior is to show "No active sessions" when the API returns an empty array.
- **Recommendation**: Remove the `loadMockData()` call from the `next` branch. Keep it only in `error` (or remove entirely and mark as dev-only).

### Issue 4: `project.component.ts` is 936 lines — 6x over the 150-line limit

- **File**: `apps/dashboard/src/app/views/project/project.component.ts`
- **Problem**: The file size limit for components is 150 lines. The file is 936 lines. While the bulk of this is pre-existing, this task modified the file and added more content without addressing the size. The `test*` methods (lines 554–843) — 290 lines of manual test helpers — are production component code that should be in a spec file.
- **Tradeoff**: Every reviewer touching this file must navigate 936 lines. The test methods pollute the public API of the component.
- **Recommendation**: Move `test*` methods to a `project.component.spec.ts` file immediately. Extract filter logic into a dedicated service or computed pipe.

### Issue 5: `getSession` controller method has no return type annotation

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:229`
- **Problem**: `public async getSession(@Param('id') id: string)` has no return type. Every other controller method in the file uses explicit return type annotations.
- **Tradeoff**: TypeScript will infer `Promise<any>` here, losing type safety on the response shape.
- **Recommendation**: Add `Promise<SessionHistoryDetail | never>` or the appropriate return type from `sessionsHistoryService.getSessionDetail`.

---

## Minor Issues

- **scss mixed units**: `sessions-panel.component.scss:250–265` — the heartbeat section uses raw `px` numbers (`4px`, `2px`, `11px`, `10px`) while the rest of the file uses `rem`. Pick one unit system per file.
- **scss hardcoded rgba color**: `sessions-panel.component.scss:59` — `box-shadow: 0 2px 8px rgba(23, 125, 220, 0.1)` hardcodes a hex-equivalent color that cannot follow theme changes. Use `var(--accent)` with opacity or a CSS `color-mix()` expression.
- **`HealthResponse` interface not in model file**: `apps/dashboard/src/app/services/api.service.ts:6–10` — pre-existing, but this task touched the file. Interface belongs in a `*.model.ts` file per project anti-patterns.
- **`[attr.role]="'button'"`**: `sessions-panel.component.html:18,72` — binding a static string via `[attr.role]` is unnecessary. Use the plain attribute `role="button"` instead. Same for `[attr.tabindex]="0"` and `[attr.aria-label]` (where aria-label IS dynamic, the binding is correct — but role and tabindex are static).

---

## File-by-File Analysis

### `sessions-panel.component.ts`

**Score**: 6/10
**Issues Found**: 2 blocking, 1 serious

**Analysis**: The component correctly uses `OnPush`, `inject()`, `computed()`, and `takeUntilDestroyed`. The `heartbeatStatusMap` and `truncatedActivities` computed maps are the right pattern. However, the `catchError(() => EMPTY)` silent swallow is a codified anti-pattern violation, the heartbeat computed wastes allocation on recentSessions, and mock data is used as a fallback for an empty (valid) API response.

**Specific Concerns**:
1. Line 64: Silent `catchError(() => EMPTY)` on `closeStaleSession` interval (blocking).
2. Lines 79–81: `heartbeatStatusMap` iterates `recentSessions()` but skips every entry unconditionally (blocking).
3. Lines 127–134: Mock data triggered on empty API response — masks valid "no sessions" state (serious).

---

### `sessions-panel.component.html`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 2 minor

**Analysis**: Uses `@for`/`@if` block syntax correctly. Keyboard accessibility with `keydown.enter`/`keydown.space` is good. The static `[attr.role]="'button'"` binding is unnecessary noise.

**Specific Concerns**:
1. Line 37: `session.startedAt.slice(11, 16)` — method call in template, fires per item per cycle (serious).
2. Line 53: `session.sessionId.slice(-16)` — same issue as above.
3. Lines 18, 72: Static attributes bound via `[attr.*]` when plain attributes suffice (minor).

---

### `sessions-panel.component.scss`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

**Analysis**: CSS variable usage is consistent throughout except for two violations. No hardcoded hex colors in the main selectors. Phase and status color classes are well-organized.

**Specific Concerns**:
1. Line 59: `rgba(23, 125, 220, 0.1)` — hardcoded color in box-shadow, bypasses token system (minor/anti-pattern).
2. Lines 250–265: Mixed `px` and `rem` units in the heartbeat section (minor).

---

### `sessions-panel.model.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious

**Analysis**: Types are defined at module scope in a model file — correct. `SessionStatus` and `SessionPhase` as union types (not bare strings) are correct. The `lastHeartbeat?` optional field creates a silent data gap.

**Specific Concerns**:
1. Line 13: `lastHeartbeat?: string | null` — optional when the heartbeat feature depends on it (serious).

---

### `api.service.ts` (modified)

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor (pre-existing)

**Analysis**: The two new methods `getActiveSessionsEnhanced()` and `closeStaleSession()` follow the existing service pattern cleanly. Import grouping is maintained.

**Specific Concerns**:
1. Line 6: `HealthResponse` interface inside service file — pre-existing, not introduced by this task but not fixed either (minor).

---

### `project.component.ts` (modified)

**Score**: 4/10
**Issues Found**: 1 blocking, 2 serious

**Analysis**: The addition of `SessionsPanelComponent` to imports is correct. However, the file is 936 lines against a 150-line component limit. Three template-called methods violate the "no method calls in templates" rule. The test helper methods bloat the production component.

**Specific Concerns**:
1. Lines 353–363: `statusSelectedCount()`, `typeSelectedCount()`, `prioritySelectedCount()` are plain methods used in templates (blocking).
2. Lines 554–843: 290 lines of `test*` methods in production component code (serious — should be in spec).
3. File at 936 lines: 6x over the 150-line limit (serious).

---

### `project.component.html` (modified)

**Score**: 7/10
**Issues Found**: 1 blocking (via component method calls)

**Analysis**: The `<app-sessions-panel>` embed is clean. Template control flow uses `@if`/`@for` correctly. The method-call issue from the component leaks into this file.

**Specific Concerns**:
1. Lines 172–268: `statusSelectedCount()`, `typeSelectedCount()`, `prioritySelectedCount()` called as methods in template (blocking — same as component issue).

---

### `sessions.service.ts` (new, NestJS)

**Score**: 4/10
**Issues Found**: 1 blocking, 1 serious

**Analysis**: The service is cleanly structured and under 200 lines. `getSessions()`, `getSession()`, `setSessionState()` are well-organized. The `getActiveSessionsEnhanced()` method however ships randomized data as a production endpoint.

**Specific Concerns**:
1. Lines 162–163: `Math.random()` for `currentPhase` and partially for `status` — non-deterministic production data (blocking).
2. Lines 148–149: Inline union type arrays for `phases` and `statuses` duplicate the `SessionPhase`/`SessionStatus` types defined in the frontend model. The backend has no shared type; the values are disconnected from the frontend union and could drift (serious).

---

### `dashboard.controller.ts` (modified)

**Score**: 8/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: The new session endpoints follow existing controller patterns. Swagger decorators are present. Parameter validation uses the established `TASK_ID_RE` regex where applicable.

**Specific Concerns**:
1. Line 229: `public async getSession(@Param('id') id: string)` — no return type annotation, breaks the pattern established by every other method in this 574-line controller (serious).

---

### `dashboard.gateway.ts` (modified)

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious

**Analysis**: `sessions:changed` broadcast is already present from before this task. The new broadcast correctly emits the event type that `sessions-panel.component.ts` listens for. Cleanup is handled in `onModuleDestroy()`. No new issues introduced.

---

## Pattern Compliance

| Pattern                        | Status | Concern                                                           |
| ------------------------------ | ------ | ----------------------------------------------------------------- |
| Signal-based state             | PASS   | `signal()` and `computed()` used throughout                       |
| `readonly` on computed signals | PASS   | All `computed()` fields are `public readonly`                     |
| `OnPush` change detection      | PASS   | Both new components use `OnPush`                                  |
| `inject()` for DI              | PASS   | No constructor injection in Angular code                          |
| `@if`/`@for` block syntax      | PASS   | No `*ngIf`/`*ngFor` in new templates                             |
| No method calls in templates   | FAIL   | `statusSelectedCount()`, `typeSelectedCount()`, `prioritySelectedCount()` called from project.component.html |
| CSS variables only             | FAIL   | `rgba(23, 125, 220, 0.1)` in sessions-panel.scss:59              |
| No silent error swallows       | FAIL   | `catchError(() => EMPTY)` on closeStaleSession interval           |
| File size limits               | FAIL   | project.component.ts at 936 lines (limit: 150)                    |
| Interfaces in model files      | FAIL   | `HealthResponse` in api.service.ts (pre-existing)                 |
| Type safety (no random data)   | FAIL   | `Math.random()` for phase/status in sessions.service.ts           |

---

## Technical Debt Assessment

**Introduced**:
- Randomized production data path in `getActiveSessionsEnhanced()` that will require a full rework once real session state is plumbed through.
- `loadMockData()` as a fallback for empty API responses — will silently mask "no sessions" state until explicitly removed.
- `test*` methods in production component code — will accumulate and drift from real behavior.

**Mitigated**:
- Correctly uses `takeUntilDestroyed` instead of manual Subject/takeUntil.
- `heartbeatStatusMap` and `truncatedActivities` precomputation avoids per-item method calls (though the heartbeat computed still has the recentSessions waste).

**Net Impact**: Debt increased. The randomized data and mock fallback patterns are the most dangerous — they are production paths that will require non-trivial rework once real data is available, and they will mislead anyone debugging the panel in the interim.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `getActiveSessionsEnhanced()` ships `Math.random()` as a production code path, and `catchError(() => EMPTY)` silently discards background errors — both are codified anti-pattern violations that must be fixed before this reaches a review-complete state.

---

## What Excellence Would Look Like

A 10/10 implementation would:

1. Derive `currentPhase` and `status` deterministically from the session's `loopStatus` and actual log data — never use `Math.random()`.
2. Show an empty state ("No active sessions") when the API returns an empty array, not mock data.
3. Log errors in the background `closeStaleSession` interval before returning `EMPTY`.
4. Precompute `startedAt` and `sessionId` display strings in the same `computed()` map as `truncatedActivities`, not via template method calls.
5. Scope `heartbeatStatusMap` to `this.sessions()` only — not spread recentSessions and skip them immediately.
6. Extract the `test*` methods from `project.component.ts` into a spec file and address the 936-line file size.
7. Add explicit return types to all async controller methods.

---

| Verdict | FAIL |
| ------- | ---- |
