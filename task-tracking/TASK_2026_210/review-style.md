# Code Style Review — TASK_2026_210

## Overall Score: 5/10

## Assessment

The session management migration is functionally coherent — types are clean, the presentational component pattern is correctly applied, and the WebSocket + interval fallback refresh strategy is solid. However, several recurring anti-patterns undermine the implementation: the component file is nearly 3x over the size limit, test harness methods leaked into production API, legacy `@Input`/`@Output` syntax used instead of the modern signal-based equivalents, an `as` type assertion on untrusted localStorage data, and four fire-and-forget session actions with zero error surface. The `api.types.ts` model file is at 838 lines and growing, which is a structural concern. These are not cosmetic — they are the kind of problems that bite maintainers 6 months out.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

`loadSavedConfig()` at `project.component.ts:951` does `parsed as CreateSessionRequest` on raw `JSON.parse` output. If the server-side shape of `CreateSessionRequest` changes (new required fields, renamed fields, stricter types), the cast will silently succeed and the caller will receive a stale or mismatched object that gets sent to the API with no validation error. The bug will appear as a cryptic 400 or 422 from the API, not a TypeScript error.

### 2. What would confuse a new team member?

`project.component.ts` is 1,019 lines. Scrolling through it, a new developer will find: filtering logic, sorting logic, URL persistence, session form state, session CRUD, 10 `test*()` methods, and an in-memory DOM-mutation screen-reader helper — all in one class. There is no obvious split point because none of these concerns are extracted. The `test*()` methods (lines 569–858) are especially jarring: they mutate production signal state, call `router.url`, and are tagged `public`, meaning they appear in auto-complete alongside real public methods.

### 3. What's the hidden complexity cost?

`applyFiltersAndSort()` is a 70-line `public` method on the component class (anti-pattern: violates single responsibility and exposes internal logic). It is called only from `filteredTasks = computed(...)`. Because it is `public`, future developers may call it directly from tests or templates, bypassing the `computed()` memoization and causing redundant re-computation. `compareTasks()` and `sortTasks()` are also `public` for the same test-harness reason. These three methods should be `private`.

### 4. What pattern inconsistencies exist?

Two distinct signal I/O patterns are mixed across the changed files:

- `sessions-panel.component.ts` uses `@Input()` / `@Output() EventEmitter` (decorator pattern, pre-Angular 17).
- The rest of the codebase uses `input()` / `output()` signal-based primitives (see `flow-editor.component.ts` and `flow-diagram.component.ts`).

The project has already adopted the newer syntax. `SessionsPanelComponent` introduced as a new/rewritten component in this task should use signal-based I/O to be consistent with the direction.

Additionally, `sessions-list.component.ts:68` uses `s.config.prep_model` (snake_case field from `SupervisorConfig`) as `supervisorModel`. Every other field access in the same file uses camelCase from `SessionStatusResponse`. This is a silent shape mismatch that only works because TypeScript currently resolves the field; if `SupervisorConfig` is ever refactored to camelCase, this will be a runtime blank with no compile-time warning.

### 5. What would I do differently?

- Extract the 10 `test*()` methods into a dedicated spec file or a `ProjectComponentTestHarness` class, not into the production component.
- Split `project.component.ts` into at minimum: a `ProjectFilterService` for filter/sort logic and a leaner `ProjectComponent` for view state and session orchestration.
- Replace `@Input()/@Output()` on `SessionsPanelComponent` with `input()` / `output()` to match the codebase direction.
- Replace `parsed as CreateSessionRequest` with explicit field-by-field construction or a validation helper.
- Add error callbacks to the four fire-and-forget session action methods.

---

## Blocking Issues

### Issue 1: Test harness methods leaked into production component API

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:569–858`
- **Problem**: Ten `public test*()` methods (`testFullTextSearch`, `testStatusFilter`, `testTypeFilter`, `testPriorityFilter`, `testModelFilter`, `testDateRangeFilter`, `testSort`, `testActiveFilterChips`, `testURLPersistence`, `testResultCountDisplay`, `testFilterPerformance`, `testAccessibility`, `testResponsiveDesign`) are defined in the production component class. They mutate live signal state, call `router.url`, manipulate `window.innerWidth`, and query the DOM with `document.querySelector`.
- **Impact**: These methods pollute the public API of the component. They appear in IDE auto-complete. If they are called in production (e.g., via a test automation hook that reaches the production build), they side-effect real signal state. `testResponsiveDesign()` writes to `window.innerWidth`, which is a global side effect. They add ~280 lines to a component that is already massively over-size-limit.
- **Fix**: Move to a spec file (`project.component.spec.ts`) or a standalone test harness. Remove entirely from the component class.

### Issue 2: `as` type assertion on unvalidated localStorage data

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:951`
- **Problem**: `return (typeof parsed === 'object' && parsed !== null) ? parsed as CreateSessionRequest : {}` casts any non-null object to `CreateSessionRequest` without checking field names, types, or values. A stale or corrupted `nitro-session-config` entry (e.g., from a prior schema version) will pass the cast and be sent directly to `createAutoSession()`.
- **Impact**: Violates the anti-pattern "Never use `as` type assertions — if the type system fights you, the type is wrong." The stored object could contain `implementProvider: 'openai'` (removed provider) and the API will receive a value not in `ProviderType`. This will produce a server-side error with no UI feedback on the next session creation attempt.
- **Fix**: Either validate individual fields against the known union types (`ProviderType`, `PriorityStrategy`) and reconstruct a clean `CreateSessionRequest`, or accept `{}` as the fallback and let the form defaults apply.

### Issue 3: Fire-and-forget session actions swallow errors silently

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:909–923`
- **Problem**:
  ```typescript
  public onPauseSession(id: string): void {
    this.apiService.pauseAutoSession(id).subscribe({ next: () => this.loadSessions() });
  }
  ```
  All four session action handlers (`onPauseSession`, `onResumeSession`, `onStopSession`, `onDrainSession`) have no `error` callback. If the API call fails (network error, 409 conflict, session already stopped), the user sees nothing — the button appears to work, the session list does not refresh, but no error is surfaced.
- **Impact**: Violates the anti-pattern "Operations that modify state must surface errors to the caller — never silently succeed." The user will click Pause and see no feedback if the backend rejects the request.
- **Fix**: Add `error: () => { /* surface error to user */ }` callbacks. At minimum, `console.error` and set an error signal that the template can display.

---

## Serious Issues

### Issue 4: `project.component.ts` is 1,019 lines — 3x over the component limit

- **File**: `apps/dashboard/src/app/views/project/project.component.ts`
- **Problem**: The file size limit for components is 150 lines. Even excluding the 280-line test harness section (Issue 1), the file is ~739 lines — still ~5x the limit. The component conflates filter/sort logic, URL persistence, session form state, session CRUD, and accessibility helpers.
- **Tradeoff**: Refactoring mid-task has cost, but this file will keep growing. Every future session feature and every new filter lands here.
- **Recommendation**: Extract `applyFiltersAndSort`/`compareTasks`/`sortTasks` into a stateless `ProjectFilterService`. Session form and CRUD can become a `SessionFormService` or a sub-component. This is not optional — the size rule exists precisely to prevent this kind of accumulation.

### Issue 5: `@Input()/@Output()` on `SessionsPanelComponent` instead of signal-based I/O

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:30–34`
- **Problem**: This component was rewritten in this task but uses the pre-Angular 17 decorator pattern:
  ```typescript
  @Input() sessions: SessionStatusResponse[] = [];
  @Output() pauseSession = new EventEmitter<string>();
  ```
  The project is moving to signal-based inputs/outputs. Existing components in the codebase that were updated (`flow-editor.component.ts`, `flow-diagram.component.ts`) use `input()` / `output()`. This new component should not regress the pattern.
- **Recommendation**: Convert to `readonly sessions = input<SessionStatusResponse[]>([])` and `readonly pauseSession = output<string>()`.

### Issue 6: `EnrichedDetail` and `EnrichedSession` interfaces defined inside component files

- **File**: `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:17–34`, `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts:18–31`
- **Problem**: The anti-patterns rule states: "Interfaces and types must be defined at module scope in `*.model.ts` files — never inside component or function bodies." Both `EnrichedDetail` and `EnrichedSession` are component-file-scoped interfaces.
- **Tradeoff**: These are view-model types specific to the component's `computed()` shape. They are genuinely local. However, the rule is explicit, and when the next developer needs to reuse or test the enrichment logic, the type will not be importable.
- **Recommendation**: Move to `session-detail.model.ts` and `sessions-list.model.ts` (create if needed), or at minimum to a shared `session-view-models.ts`.

### Issue 7: `supervisorModel` derived from `s.config.prep_model` (snake_case field)

- **File**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts:68`
- **Problem**: `supervisorModel: s.config.prep_model || '—'` accesses `prep_model` from `SupervisorConfig`, which is the only snake_case field being read in this file. All other accessed fields use camelCase. This is a shape inconsistency baked into the adapter.
- **Tradeoff**: `SupervisorConfig` intentionally uses snake_case to match the CLI/server config format. But the comment-free access creates an invisible coupling: if `SupervisorConfig` is ever normalized to camelCase, this silently becomes `undefined` with no compile error (because TypeScript would see a missing field as `undefined` not an error with dot access on an optional chain).
- **Recommendation**: Add a comment noting the intentional snake_case: `// SupervisorConfig intentionally uses snake_case to match CLI config format`.

### Issue 8: Duplicate `base` and `cortexBase` constants pointing to the same URL

- **File**: `apps/dashboard/src/app/services/api.service.ts:107–108`
- **Problem**:
  ```typescript
  private readonly base = `${environment.apiUrl}/api`;
  private readonly cortexBase = `${environment.apiUrl}/api`;
  ```
  These are identical. `cortexBase` adds zero value and silently suggests different routing namespaces. New developers may use `cortexBase` for non-cortex calls thinking it routes differently.
- **Recommendation**: Remove `cortexBase` and replace all its usages with `this.base`. This is a pre-existing issue that the new session methods correctly avoided (they use `this.base`), but the field persists and is still used elsewhere.

### Issue 9: `drainSession` uses `PATCH` but other stop actions use `POST`

- **File**: `apps/dashboard/src/app/services/api.service.ts:431–435`
- **Problem**:
  ```typescript
  public drainSession(sessionId: string): Observable<SessionActionResponse> {
    return this.http.patch<SessionActionResponse>(
      `${this.base}/sessions/${encodeURIComponent(sessionId)}/stop`,
      {},
    );
  }
  ```
  `stopAutoSession()` uses `POST /sessions/:id/stop`. `drainSession()` uses `PATCH /sessions/:id/stop`. Both target the same endpoint path (`/stop`) with different HTTP verbs. This will fail at runtime if the server only handles one of the two verbs on that route. The `SessionActionResponse` for drain says `action: 'draining'` in the type, but the endpoint is `/stop`, not `/drain`.
- **Impact**: Likely a bug. If the server only accepts `POST /sessions/:id/stop`, `drainSession` will return a 405 Method Not Allowed silently (because `onDrainSession` has no error callback — see Issue 3).
- **Recommendation**: Clarify the actual API contract. If drain is a separate operation from stop, it needs a `/drain` endpoint. If it is the same endpoint, use `POST` consistently.

---

## Minor Issues

- `api.types.ts:837–838`: Three trailing blank lines at end of file. Clean up.
- `project.component.ts:64`: `private readonly destroy$ = new Subject<void>()` is used for `searchInput$` debounce via `takeUntil`, while all other subscriptions use `takeUntilDestroyed(this.destroyRef)`. The dual teardown patterns (`destroy$` + `destroyRef`) are inconsistent. The `destroy$` pattern can be replaced entirely with `takeUntilDestroyed(this.destroyRef)` to unify teardown.
- `project.component.html:389`: The model filter button has `[attr.aria-expanded]="false"` hardcoded instead of binding to `modelDropdownOpen()`. All other filter buttons correctly bind to their respective signals. This is likely a copy-paste error.
- `sessions-panel.component.ts:82`: `session.startedAt.slice(11, 16)` is correctly precomputed in the `startedAtLabels` computed map. But the `heartbeatStatusMap` computed signal creates a new `Map` on every signal tick (every 30s). For small session counts this is fine, but the pattern is documented in `frontend.md` as a known performance concern. The implementation is correct but worth flagging.
- `session-detail.component.ts:110–115`: `confirmDrain()` subscribes with `catchError` but does not reset `isDraining` to `false` in the success path (only in the error path). If the drain request succeeds, `isDraining` stays `true` permanently until the component is destroyed. The drain button will remain in loading state.
- `api.types.ts:496–506`: `CreateCustomFlowRequest` and `UpdateCustomFlowRequest` use non-readonly fields (mutable `name`, `description`, etc.) while all other types in the file are fully readonly. This inconsistency is pre-existing but worth noting.
- `CortexPhase`, `CortexReview`, `CortexFixCycle`, `CortexEvent`, `CortexTaskTrace` at lines 579–630 use non-readonly fields across the board. This is a pre-existing pattern inconsistency relative to the new session types which are all fully readonly.

---

## File-by-File Analysis

### `api.types.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 2 minor

The new session types (`SupervisorConfig`, `CreateSessionRequest`, `CreateSessionResponse`, `UpdateSessionConfigRequest`, `UpdateSessionConfigResponse`, `SessionStatusResponse`, `SessionActionResponse`, `ListSessionsResponse`, `LoopStatus`, `ProviderType`, `PriorityStrategy`) are clean, properly readonly, correctly scoped under a named section header. Type unions for `LoopStatus` and `ProviderType` are appropriately narrow.

Specific concerns:
1. File is 838 lines (limit: 80 lines for model files; 300 lines maximum by "files over 300 lines signal a missing abstraction"). This is a pre-existing problem, not introduced by this task, but the 11 new types push it further in the wrong direction.
2. Trailing blank lines at EOF (lines 837–838).

### `api.service.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 0 minor

The 7 new methods follow the established HTTP method pattern. URL encoding, explicit return types, and method visibility (`public`) are all correct.

Specific concerns:
1. `drainSession` uses `PATCH` against `/stop` while `stopAutoSession` uses `POST` against the same path (lines 413–435). This is likely a protocol bug.
2. `cortexBase` duplicates `base` at lines 107–108 and remains in the file unused by any new code.

### `project.component.ts`

**Score**: 3/10
**Issues Found**: 3 blocking, 2 serious, 2 minor

This file is the main problem in the changeset. The session management addition itself (lines 77–82, 305–334, 859–955) is well-structured: signals are readonly, teardown uses `takeUntilDestroyed`, localStorage handling has appropriate `try/catch`, `loadSessions()` is called reactively from WS events. The new code is conceptually correct. But it was dropped into a file that was already oversized and then made worse by 280 lines of test harness methods.

Specific concerns:
1. 1,019-line file — 280 lines of test methods must be removed (blocking).
2. `as CreateSessionRequest` cast on localStorage data (blocking).
3. Four fire-and-forget session actions with no error callbacks (blocking).
4. `applyFiltersAndSort`, `compareTasks`, `sortTasks` are `public` only to support test methods; if test methods are removed, these become `private` (serious).
5. Mixed `destroy$` + `destroyRef` teardown patterns (minor).

### `project.component.html`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

The new session form and `app-sessions-panel` wiring is clean. All form fields have `id`/`for` pairs. Buttons have `aria-label`. The `@if`/`@for` control flow is used throughout. Keyboard handler patterns (`keydown.enter`, `keydown.space`) are consistent with the rest of the template.

Specific concerns:
1. Model filter `[attr.aria-expanded]="false"` is hardcoded (line 389) — should be `[attr.aria-expanded]="modelDropdownOpen()"` to match other filter buttons.

### `sessions-panel.component.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 0 minor

The computed maps (`heartbeatStatusMap`, `startedAtLabels`) correctly precompute per-session derived values to avoid method calls in the template. The 30s interval is properly cleaned up via `takeUntilDestroyed`. Constructor injection is avoided (`inject()` only).

Specific concerns:
1. `@Input()/@Output()` decorator pattern instead of `input()`/`output()` signals (serious — new component should use current standard).
2. `@Input() sessions: SessionStatusResponse[] = []` has no `readonly` modifier on the property, and uses a mutable default `[]` that will be overwritten. With signal-based `input()`, this concern disappears.

### `sessions-panel.component.html`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

Template is well-structured. `@if`/`@for` control flow throughout. Action buttons have `aria-label` attributes. Stop-propagation on the controls wrapper is correctly placed. The `[attr.role]="'button'"` pattern on the session card should ideally use `role="button"` (static attribute), not attribute binding — though both work, binding a static string adds unnecessary overhead.

### `session-detail.component.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 2 serious, 0 minor

The migration to `getAutoSession()` and `SessionStatusResponse` is clean. `toSignal` with no `initialValue` is used correctly (undefined = loading, null = error from catchError). The `statusColor` private method is appropriately typed.

Specific concerns:
1. `EnrichedDetail` interface defined inside the component file (serious — anti-pattern: interfaces must go in `*.model.ts`).
2. `isDraining` is set to `true` in `confirmDrain()` but never set back to `false` on the success path (minor → serious: the drain button stays in pending state permanently after a successful drain request).

### `sessions-list.component.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 1 minor

`toSignal` usage, `computed()` enrichment, and `statusColor` private method all follow the same pattern as `session-detail.component.ts`. The absence of a `DestroyRef` injection is correct — no manual subscriptions.

Specific concerns:
1. `EnrichedSession` interface defined inside the component file (serious — same anti-pattern as Issue 6).
2. `supervisorModel: s.config.prep_model || '—'` accesses snake_case field silently (minor, but flagged above).

---

## Pattern Compliance

| Pattern                        | Status | Concern                                                                                   |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------- |
| Signal-based state             | PASS   | All new state uses `signal()` and `computed()`                                            |
| `OnPush` change detection      | PASS   | All components declare `ChangeDetectionStrategy.OnPush`                                   |
| `inject()` DI (no constructor) | FAIL   | `SessionsPanelComponent` uses constructor (line 38) for interval setup — acceptable, but the constructor could be eliminated by moving the interval to a field initializer with `takeUntilDestroyed` |
| Signal-based I/O               | FAIL   | `SessionsPanelComponent` uses `@Input()/@Output()` decorator pattern                     |
| No method calls in templates   | PASS   | Computed maps used for all per-item derivations in sessions-panel                        |
| `readonly` on signals          | PASS   | All `signal()` and `computed()` fields are `public readonly`                              |
| Explicit access modifiers      | FAIL   | `@Input() sessions`, `@Output() pauseSession` have no access modifier                    |
| Interfaces in model files      | FAIL   | `EnrichedDetail` and `EnrichedSession` defined in component files                        |
| Error surface on mutations     | FAIL   | Four session action handlers have no error callbacks                                     |
| No `as` assertions             | FAIL   | `parsed as CreateSessionRequest` in `loadSavedConfig()`                                   |
| File size limits               | FAIL   | `project.component.ts` at 1,019 lines (limit: 150); `api.types.ts` at 838 lines (limit: 80 for model files) |

---

## Technical Debt Assessment

**Introduced**:
- 280 lines of test harness methods in the production component class. This sets a precedent: the next developer may add more test helpers inline, continuing the pattern.
- `@Input()/@Output()` in a freshly-written component creates a two-pattern codebase for component I/O, increasing the cognitive overhead of every future component.
- `as` assertion on localStorage creates a latent type-safety hole that will not surface until a config schema change.

**Mitigated**:
- Presentational `SessionsPanelComponent` correctly removes dual API calls (design decision in handoff is sound).
- WebSocket + interval fallback is a good reliability pattern.
- `heartbeatStatusMap` and `startedAtLabels` as precomputed maps correctly eliminates template method calls (learned from prior review lessons).

**Net Impact**: Slightly negative. The session feature logic is correct but the surrounding code quality regressed the component file significantly.

---

## Verdict

**Recommendation**: NEEDS_FIXES
**Confidence**: HIGH
**Key Concern**: Three blocking issues must be resolved before merge: test harness methods must be removed from the production component, the `as CreateSessionRequest` cast on localStorage must be replaced with validation, and the four session action handlers must have error callbacks. The serious issues (component size, I/O pattern, interface placement, drain PATCH vs POST) should be addressed in the same pass since the file needs to be touched anyway.

---

## What Excellence Would Look Like

A 9/10 implementation would:
- Have `project.component.ts` under 300 lines by extracting filter/sort logic to a `ProjectFilterService` and session form state to a dedicated sub-component or service.
- Use `input()` / `output()` signals on `SessionsPanelComponent`.
- Validate `localStorage` contents field-by-field with known union types before constructing `CreateSessionRequest`.
- Have error callbacks on all four session action handlers, feeding a `sessionActionError` signal that the template renders near the sessions panel.
- Move `EnrichedDetail` and `EnrichedSession` to `*.model.ts` files.
- Verify and align `drainSession` HTTP verb with the actual server API contract.
- Have zero test methods in the production component class.
