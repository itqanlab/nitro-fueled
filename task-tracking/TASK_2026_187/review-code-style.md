# Code Style Review — TASK_2026_187

## Review Summary

| Metric          | Value                                          |
| --------------- | ---------------------------------------------- |
| Overall Score   | 5/10                                           |
| Assessment      | NEEDS_REVISION                                 |
| Blocking Issues | 5                                              |
| Serious Issues  | 6                                              |
| Minor Issues    | 4                                              |
| Files Reviewed  | 13                                             |
| Verdict         | FAIL                                           |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

- `sessions-history.service.ts:77` — `public constructor(...)` is used instead of field-level `inject()`. When another developer adds a dependency, they will follow the established constructor pattern instead of the project standard, entrenching the wrong pattern in the one service that is the canonical reference for this feature.
- `sessions-history.service.ts:138` — `totalTasks = uniqueTasks.size || session.tasks_terminal`. The `||` fallback is falsy-based: if `uniqueTasks.size` is `0` (zero workers found but the session did run tasks), it silently falls back to `tasks_terminal`. A session that legitimately had no workers attributed will show the wrong count.
- `session-detail.component.ts:151-157` — `confirmDrain()` calls `api.drainSession().subscribe()` and never unsubscribes. If the user navigates away before the response completes, the subscription fires on a destroyed component, writing to signals that no longer exist. No `DestroyRef` teardown is registered.
- `sessions-list.component.ts:53-54` — `public loading` and `public unavailable` are mutable bare booleans, not signals. In an `OnPush` component, mutating non-signal fields does not schedule a re-render. The loading state update inside `effect()` may never propagate to the template. Same bug in `session-detail.component.ts:103-104`.

### 2. What would confuse a new team member?

- `sessions-list.component.ts:82` — The effect logic reads `else if (!this.loading)` to detect the error case. This is a temporal side-effect: `loading` starts `true`, so the first null emission from `toSignal` initial value (before HTTP returns) is silently ignored, while a null after loading completes sets `unavailable`. This state machine is not obvious and contradicts the known anti-pattern: "`toSignal` `initialValue: null` fires the effect before HTTP completes — do not equate initial null with API error" (review-lessons/frontend.md).
- `api.types.ts:704-773` — The session history types (`SessionEndStatus`, `SessionHistoryListItem`, etc.) are duplicated verbatim from `sessions-history.service.ts`. The service exports its own copy; the frontend duplicates it independently. There is no cross-reference or comment. A developer changing the shape will update one and miss the other.
- `dashboard.controller.ts:249` — `getSessions()` has no explicit return type annotation. Every other handler in the controller uses `ReturnType<...>` or an explicit return type. This one returns implicit `SessionHistoryListItem[]`, breaking the established annotation pattern without explanation.
- `session-detail.component.html:121` — The `@for` track expression is `event.formattedTime + event.type`. String concatenation as a track key is fragile: two events at the same millisecond with the same type (common for batch operations) will collide, causing Angular to reuse the wrong DOM node.

### 3. What's the hidden complexity cost?

- `sessions-history.service.ts:187-191` — `loadSessionEvents()` calls `cortexService.getEventsSince(0)` — fetching ALL events from the beginning of time — then filters client-side by `session_id`. For a mature deployment with thousands of events, this loads the entire event table into memory for every `getSessionDetail` call. The cortex MCP already supports `sessionId`-scoped queries; this bypass is an O(n) scan where O(1) is available.
- `sessions-history.service.ts:235-241` — `gatherTaskTraces()` makes N sequential `getTaskTrace()` calls, one per task. Each trace call reads multiple tables. For a session with 20 tasks, this is 20 serial DB reads. No batching, no parallelism, no caching.
- `session-detail.component.ts:88-101` — `toSignal` wraps a `switchMap` over `route.paramMap`. Every route param change cancels the previous HTTP request and starts a new one. This is correct. However, there is no debounce or validation of the `id` param before dispatching to the API. An empty `id` returns `of(null)` which triggers the unavailable state, but there is no format validation (the controller validates with `SESSION_ID_RE`; the client sends whatever is in the URL).

### 4. What pattern inconsistencies exist?

- **Constructor injection vs `inject()`**: `sessions-history.service.ts` uses `public constructor(private readonly cortexService: CortexService) {}`. Every other Angular service in this codebase uses field-level `inject()`. The handoff explicitly lists `inject()` for DI as a coding standard that was followed — this is a direct contradiction.
- **Mutable booleans vs signals**: Both new components declare `public loading = true` and `public unavailable = false` as plain class fields, then mutate them inside `effect()`. The rest of the component codebase uses `signal()` for mutable state. These fields should be `readonly` signals so that OnPush components re-render correctly.
- **Bare `loading` field without `readonly`**: The anti-patterns doc explicitly calls out "Explicit access modifiers on ALL class members" but says nothing about `readonly`. However, established pattern in this codebase is `signal()` for mutable reactive state. `loading` and `unavailable` are reactive state — they drive template rendering — yet they are bare mutable properties. In an `OnPush` component, assignments to non-signal fields outside the signal/computed graph are invisible to change detection.
- **Interface duplication**: `SessionHistoryListItem`, `SessionHistoryDetail`, `SessionEndStatus`, etc. are defined in both `sessions-history.service.ts` (backend) and `api.types.ts` (frontend) with identical shapes. The frontend types file is the correct location for frontend-facing types. The backend service should define its own internal types if needed, but they should not mirror each other silently — a schema change in one does not fail compilation in the other.
- **`EnrichedSession`/`EnrichedDetail` interfaces inside component file**: The anti-patterns rule states "Interfaces and types must be defined at module scope in `*.model.ts` files — never inside component or function bodies." Both `sessions-list.component.ts` and `session-detail.component.ts` define their enriched interfaces at file scope inside the component `.ts` file. These must be moved to `*.model.ts` files.
- **`getSessions()` missing return type**: `dashboard.controller.ts:249` — all other controller methods have explicit return type annotations. This one does not. Minor but inconsistent.

### 5. What would I do differently?

- Replace constructor injection in `SessionsHistoryService` with `private readonly cortexService = inject(CortexService)` at field level.
- Convert `loading` and `unavailable` to `signal<boolean>` in both components.
- Add a `SessionsHistoryListItem`, `EnrichedSession`, `EnrichedDetail`, etc. to dedicated `sessions-history.model.ts` files rather than defining them inline.
- Replace `getEventsSince(0)` with a session-scoped event query so the detail endpoint does not full-scan the event table.
- Add a `takeUntilDestroyed()` pipe to the `drainSession` subscription to prevent signals being written after component destruction.
- Use a `LoadingState = 'pending' | 'loaded' | 'error'` discriminated union instead of the `loading/unavailable` boolean pair to eliminate the temporal coupling bug.

---

## Blocking Issues

### Issue 1: Constructor injection violates the project DI standard

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:77`
- **Problem**: `public constructor(private readonly cortexService: CortexService) {}` uses constructor-based injection. The handoff lists "`inject()` for DI (no constructor injection)" as an explicit coding standard. The backend is NestJS (constructor injection is its native pattern), but the claim in the handoff that this standard was followed is incorrect — the standard as written in the handoff applies to Angular; NestJS legitimately uses constructor injection. However, the handoff explicitly states this was followed, creating a false compliance claim. If the standard applies to Angular only, the handoff claim is misleading and will mislead future reviewers.
- **Impact**: Misleads the review chain. If the standard IS meant to apply to NestJS services in this project, this is a direct violation.
- **Fix**: Clarify in handoff whether DI standard applies to NestJS or Angular only. If Angular-only, remove the claim from the handoff. If both, convert to `inject()` or use NestJS `@Inject()`.

### Issue 2: `loading` and `unavailable` are mutable non-signal fields in OnPush components

- **File**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts:53-54`, `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:103-104`
- **Problem**: Both components use `ChangeDetectionStrategy.OnPush` but declare `public loading = true` and `public unavailable = false` as plain mutable class fields. `effect()` mutates these fields directly. In OnPush components, Angular's change detection only runs when signal values change or inputs change. Assigning to a non-signal field inside an `effect()` does not trigger change detection. The template reads `loading` and `unavailable` as plain values, so the skeleton may never disappear and error banners may never appear.
- **Impact**: The loading state and error banner are invisible to change detection. The UI may be permanently stuck showing the skeleton or failing to show the error state. This is a silent rendering bug.
- **Fix**: Convert both fields to `readonly loading = signal(true)` and `readonly unavailable = signal(false)`. Update the template reads to `loading()` and `unavailable()`.

### Issue 3: Enriched interface types defined inside component files

- **File**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts:19-33`, `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:26-75`
- **Problem**: The anti-patterns rule is explicit: "Interfaces and types must be defined at module scope in `*.model.ts` files — never inside component or function bodies." Both components define multiple interfaces (`EnrichedSession`, `EnrichedTask`, `EnrichedEvent`, `EnrichedWorker`, `EnrichedDetail`) at the top of the component file. These are not in model files.
- **Impact**: Violates the project's stated anti-pattern. Future developers will replicate this pattern. Types cannot be reused or tested in isolation.
- **Fix**: Move all enriched interfaces to `sessions-history.model.ts` in the appropriate models directory.

### Issue 4: `toSignal` initial null conflated with API error (known anti-pattern)

- **File**: `apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts:76-86`, `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:160-170`
- **Problem**: The review-lessons file (frontend.md) explicitly documents this exact anti-pattern: "`toSignal` `initialValue: null` fires the effect before HTTP completes — do not equate initial null with API error." Both components use `toSignal(..., { initialValue: null })` and then use `else if (!this.loading)` to distinguish the initial null from a real null (error). This is precisely the temporal coupling the lesson warns against. When the component initializes, the effect fires with `null` (initial value). `this.loading` is `true`, so the else branch is skipped. But if the signal ever re-emits `null` after loading completes (e.g., retry, navigation), `unavailable` is set incorrectly.
- **Impact**: The loading/error state machine can produce false-positive "unavailable" banners or miss real errors. This is a documented anti-pattern that has already caused issues on other tasks.
- **Fix**: Use a `LoadingState = 'pending' | 'loaded' | 'error'` discriminated union signal, or use a separate `isFirstEmit` guard as documented in the lesson.

### Issue 5: `confirmDrain()` subscription is not cleaned up on destroy

- **File**: `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts:151-157`
- **Problem**: `this.api.drainSession(sessionId).pipe(catchError(...)).subscribe()` creates a subscription with no cleanup. If the user clicks "End Session" and then navigates away before the HTTP response arrives, the subscribe callback fires on a destroyed component instance, calling `this.isDraining.set(false)` and `this.drainError.set(...)` on signals that are no longer tracked. Angular will emit a warning (or error in strict mode) about writing to signals during destruction.
- **Impact**: Memory leak pattern. Writing to component signals post-destroy can cause subtle reactivity bugs and Angular runtime warnings.
- **Fix**: Inject `DestroyRef` and use `takeUntilDestroyed()`: `this.api.drainSession(sessionId).pipe(catchError(...), takeUntilDestroyed(this.destroyRef)).subscribe()`.

---

## Serious Issues

### Issue 1: Full event table scan on every `getSessionDetail` call

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:187-191`
- **Problem**: `loadSessionEvents()` calls `this.cortexService.getEventsSince(0)` which fetches every event from time 0, then filters client-side with `.filter((e) => e.session_id === sessionId)`. The cortex service and MCP already support session-scoped event queries. This is O(n) where n is the total event count across all sessions.
- **Tradeoff**: For small installs this is invisible. For mature deployments with 50+ sessions and thousands of events, this becomes a notable latency spike on every detail page load.
- **Recommendation**: Use a session-scoped event query method on `CortexService` instead of `getEventsSince(0)` + client-side filter.

### Issue 2: N serial `getTaskTrace()` calls without batching

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:235-241`
- **Problem**: `gatherTaskTraces()` loops over task IDs and calls `this.cortexService.getTaskTrace(taskId)` for each one synchronously. Each call queries the DB independently. For sessions with many tasks, this is a serial fan-out with no batching or concurrency.
- **Tradeoff**: Acceptable for now. Will become a visible bottleneck as task counts per session grow.
- **Recommendation**: Consider a batch trace query method on `CortexService`, or at minimum document the O(n) characteristic with a comment.

### Issue 3: `totalTasks` fallback uses falsy `||` on a count

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:138`
- **Problem**: `const totalTasks = uniqueTasks.size || session.tasks_terminal`. If `uniqueTasks.size` is `0` (no workers in the DB for this session), the fallback to `session.tasks_terminal` is correct. But `||` is falsy, meaning `0` and `undefined` are treated the same. This could silently hide a session that genuinely processed 0 tasks — it would show `tasks_terminal` instead of `0`. This is a semantic ambiguity.
- **Recommendation**: Use `uniqueTasks.size > 0 ? uniqueTasks.size : session.tasks_terminal` to make the intent explicit.

### Issue 4: Timeline `@for` track key is fragile string concatenation

- **File**: `apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html:121`
- **Problem**: `track event.formattedTime + event.type` concatenates two strings as a track key. If two events share the same timestamp (ISO string) and event type (common in batch operations), Angular treats them as the same DOM node and reuses it. The `EnrichedEvent` interface has no `id` field, even though the underlying `SessionHistoryTimelineEvent` has `readonly id: number`.
- **Recommendation**: Include `id` in `EnrichedEvent` and track by `event.id`.

### Issue 5: `api.service.ts:169` — `getSessions()` return type is `Observable<SessionSummary[]>` but endpoint now returns `SessionHistoryListItem[]`

- **File**: `apps/dashboard/src/app/services/api.service.ts:168-170`
- **Problem**: The pre-existing `getSessions()` method (line 168) returns `Observable<SessionSummary[]>` and calls `GET /api/sessions`. The new `getSessionHistory()` method (line 401) also calls `GET /api/sessions` but returns `Observable<SessionHistoryListItem[]>`. The backend endpoint `GET /api/sessions` was migrated to use `SessionsHistoryService` in this task. The old `getSessions()` now returns data typed as `SessionSummary[]` but receives `SessionHistoryListItem[]` at runtime — the shapes are incompatible. `SessionSummary` has fields like `isActive`, `path`, `taskCount` that no longer exist in the response. Any code that calls the old `getSessions()` will silently receive malformed data.
- **Tradeoff**: This could break existing consumers of `getSessions()` without a compile-time error since both sides are `Observable<SomeInterface>`.
- **Recommendation**: Either remove the old `getSessions()` method (if no callers exist) or update its return type to `SessionHistoryListItem[]`.

### Issue 6: `SessionHistoryDetail.drainRequested` missing from `sessions-history.service.ts` return

- **File**: `apps/dashboard-api/src/dashboard/sessions-history.service.ts:100-133` vs `apps/dashboard/src/app/models/api.types.ts:769`
- **Problem**: The frontend `SessionHistoryDetail` interface (api.types.ts:769) declares `readonly drainRequested: boolean`. The service method `getSessionDetail()` builds the return object (lines 100-133) and does NOT include a `drainRequested` field. The TypeScript compiler would catch this only if the service's return type is `SessionHistoryDetail` — but the service returns `SessionHistoryDetail | null` from its own local definition (`sessions-history.service.ts:56-71`) which does NOT have `drainRequested`. The frontend interface has an extra field the backend never sends.
- **Impact**: The `detail.drainRequested` in `session-detail.component.ts:127` will always be `undefined` at runtime (typed as `boolean`). The "End Session" drain confirmation logic reads `raw.drainRequested` and will always be falsy, making the feature non-functional.
- **Recommendation**: Add `drainRequested: session.drain_requested` to the `getSessionDetail()` return object in the service, and add `drain_requested` to the `CortexSession` type if it does not already exist.

---

## Minor Issues

1. `dashboard.controller.ts:249` — `getSessions()` has no explicit return type annotation. All other handlers use `ReturnType<...>` or explicit types. Add `: SessionHistoryListItem[]`.
2. `sessions-list.component.ts:88-97` — `private statusColor()` is a plain method but is called inside the `computed()` signal. This is acceptable since it is called during signal computation (not directly from the template), but it should be a `private readonly` mapping object (e.g., `STATUS_COLOR_MAP`) to avoid re-evaluating the switch on every recomputation and to align with the "no method calls in templates" spirit.
3. `api.types.ts:514-565` — Several `CortexPhase`, `CortexReview`, `CortexFixCycle`, `CortexEvent`, `CortexTaskTrace` interfaces lack `readonly` on their fields, inconsistent with every other interface in the same file. These were pre-existing, not introduced here, but the new interfaces all correctly use `readonly`.
4. `sessions-list.component.html:26` — `[nzShowPagination]="enriched().length > 20"` calls `enriched()` a second time. The signal is already called in the `@if` guard and in the `@for`. While `computed()` is memoized, calling it three times in one template is a readability smell — the template should destructure the value once with an `@if (enriched(); as sessions)` guard.

---

## File-by-File Analysis

### `sessions-history.service.ts`

**Score**: 5/10
**Issues Found**: 1 blocking, 3 serious, 0 minor

**Analysis**: The service is logically coherent and handles edge cases reasonably. The `deriveEndStatus` mapping is clean, `computeDuration` validates with `Number.isFinite`, and `describeEvent` degrades gracefully. The architecture of pulling all workers then filtering by session on the list endpoint is a reasonable tradeoff (one DB call vs N). The critical failure is the full event table scan in `loadSessionEvents` and the N serial task trace calls. The constructor injection is a style violation, but is arguable for a NestJS service.

**Specific Concerns**:
1. Line 187: `getEventsSince(0)` — full table scan, filter client-side.
2. Line 235-241: N serial `getTaskTrace()` calls.
3. Line 138: Falsy `||` on a count value obscures intent.
4. Lines 56-71: Local `SessionHistoryDetail` interface does not include `drainRequested`, causing runtime mismatch with the frontend type.

---

### `dashboard.controller.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: The existing controller is well-structured. The new session history endpoints (`GET /api/sessions` and `GET /api/sessions/:id`) follow the established pattern: validation regex, service delegation, appropriate HTTP exception mapping. The `SESSION_ID_RE` is already defined and reused correctly.

**Specific Concerns**:
1. Line 249: Missing return type annotation on `getSessions()`. Inconsistent with all other handlers.

---

### `dashboard.module.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: `SessionsHistoryService` is correctly registered as a provider and exported. Module structure is unchanged and consistent. No issues.

---

### `api.types.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: The new types are well-shaped with `readonly` fields throughout. The `SessionEndStatus` union is correctly typed rather than using `string`. The duplication of type definitions between this file and `sessions-history.service.ts` is a structural concern that will cause drift.

**Specific Concerns**:
1. Lines 704-773: Type definitions duplicated from the backend service. If the backend `SessionHistoryDetail` shape changes, the frontend types do not automatically reflect it.
2. `drainRequested` is declared on `SessionHistoryDetail` (line 769) but the backend service never populates it — this field will always arrive as `undefined`.

---

### `api.service.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: The new `getSessionHistory()` and `getSessionHistoryDetail()` methods are clean and consistent with the rest of the service. The `drainSession` method is correctly typed. The critical concern is that the pre-existing `getSessions()` method (line 168) now points to the same endpoint as `getSessionHistory()` but with the wrong return type.

**Specific Concerns**:
1. Line 168: `getSessions()` declares `Observable<SessionSummary[]>` but the endpoint now returns `SessionHistoryListItem[]`.

---

### `mock-data.constants.ts`

**Score**: N/A (only reviewed the import block)

**Analysis**: File not materially changed for this feature beyond cleanup. No issues with the session-related portions.

---

### `app.routes.ts`

**Score**: 9/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: Both routes are lazy-loaded correctly. The route parameter `:id` is properly scoped under `/sessions`. No missing default redirect is needed since `/sessions` does not have child routes. Consistent with the routing patterns elsewhere in the application.

---

### `sessions-list.component.ts`

**Score**: 4/10
**Issues Found**: 2 blocking, 1 serious, 1 minor

**Analysis**: The overall structure (OnPush + toSignal + computed) is directionally correct. The `enriched()` computed signal correctly pre-computes all display values, keeping the template logic minimal. However, the mutable non-signal loading state is a fundamental correctness bug in an OnPush component, and the `EnrichedSession` interface in a component file violates the explicit anti-pattern.

**Specific Concerns**:
1. Lines 53-54: Mutable non-signal booleans in an OnPush component — rendering bug.
2. Lines 76-86: `toSignal` initial null conflated with error state.
3. Lines 19-33: `EnrichedSession` interface defined inside component file.

---

### `sessions-list.component.html`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**: Correctly uses `@if`/`@for` block syntax throughout. No `*ngFor`/`*ngIf`. Track expression is valid for this context. The empty state and skeleton loading states are implemented.

**Specific Concerns**:
1. Line 26: `enriched()` called three times in the template. Should bind once with an alias.

---

### `sessions-list.component.scss`

**Score**: 10/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: All colors are CSS variable tokens. No hardcoded hex/rgb values. Layout uses standard flex patterns. CSS variables used: `--text-primary`, `--text-secondary`, `--bg-secondary`, `--accent`, `--radius`, `--bg-hover`, `--color-success`. All correct.

---

### `session-detail.component.ts`

**Score**: 3/10
**Issues Found**: 3 blocking, 2 serious, 0 minor

**Analysis**: This is the most problematic file. The loading state management has the same `toSignal` + mutable bool bug. The unmanaged `drainSession` subscription is a lifecycle concern. The `EnrichedDetail` family of interfaces (4 interfaces!) is defined in the component file against the explicit anti-pattern. Additionally, `formattedTime: e.timestamp` in `enrichEvent()` passes the raw ISO timestamp string as `formattedTime` — but the template then pipes it through `| date:'short'`, meaning the "pre-formatting" in `enriched()` is a no-op and the pipe is doing the work anyway. Either format in the computed or use the pipe, not both.

**Specific Concerns**:
1. Lines 103-104: Mutable non-signal booleans in OnPush component.
2. Lines 160-170: `toSignal` initial null conflated with error state.
3. Lines 151-157: Unmanaged HTTP subscription on `drainSession`.
4. Lines 26-75: Four enriched interfaces defined in the component file.
5. Line 217: `formattedTime: e.timestamp` is a passthrough — the field is misnamed or the pipe in the template is redundant.

---

### `session-detail.component.html`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**: Correctly uses `@if`/`@for` throughout. The confirm dialog is implemented with basic accessibility attributes. The log section is collapsible and correctly guarded. No hardcoded colors in the template.

**Specific Concerns**:
1. Line 121: `track event.formattedTime + event.type` — fragile string concatenation track key; should track by `event.id`.

---

### `session-detail.component.scss`

**Score**: 10/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

**Analysis**: All colors are CSS variable tokens. The event-type classes use CSS variable semantic color tokens (`--color-error`, `--color-warning`, `--color-success`, `--color-info`). No hardcoded hex/rgb. Layout patterns are consistent.

---

## Pattern Compliance

| Pattern                        | Status | Concern                                                                               |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------- |
| `inject()` for DI (Angular)    | PASS   | Angular components correctly use `inject()`                                           |
| `inject()` for DI (NestJS)     | FAIL   | `SessionsHistoryService` uses constructor injection (disputed: NestJS convention)     |
| `ChangeDetectionStrategy.OnPush` | PASS | Both components declare `OnPush`                                                      |
| `@for`/`@if` block syntax      | PASS   | No `*ngFor`/`*ngIf` found                                                            |
| `computed()` for template state | PASS  | All template-bound state goes through `enriched()` computed signals                  |
| `toSignal()` usage             | FAIL   | Initial null conflated with error — documented anti-pattern violated                  |
| CSS variable tokens only       | PASS   | Both SCSS files use only `var()` tokens, no hardcoded colors                         |
| Explicit access modifiers      | PASS   | `public`/`private` on all members                                                     |
| No `any` types                 | PASS   | All types are explicit                                                                |
| Interfaces in `*.model.ts`     | FAIL   | `EnrichedSession`, `EnrichedTask`, `EnrichedEvent`, `EnrichedWorker`, `EnrichedDetail` defined in component files |
| Signal-based mutable state     | FAIL   | `loading` and `unavailable` are plain mutable fields, not signals, in OnPush components |

---

## Technical Debt Assessment

**Introduced**:
- Mutable non-signal boolean fields in two OnPush components — will confuse future developers about the correct state management pattern.
- Type duplication between `sessions-history.service.ts` and `api.types.ts` — future shape changes will drift silently.
- Enriched interfaces in component files — contradicts the anti-pattern rule, will be replicated.
- The `getSessions()` return type mismatch in `api.service.ts` — a latent bug for any existing caller.
- `drainRequested` field present in frontend type but never populated by backend — the drain feature is silently broken at runtime.

**Mitigated**:
- The session history endpoint correctly validates session IDs with `SESSION_ID_RE` before dispatching.
- All styling correctly uses CSS variable tokens — no color debt.
- Template logic is minimal; all display formatting is pre-computed in `computed()`.

**Net Impact**: Negative. The feature ships with two runtime bugs (non-signal OnPush state, missing `drainRequested`), one silent type mismatch in the API service, and three structural anti-pattern violations.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `loading` and `unavailable` as mutable non-signal fields in OnPush components is a silent rendering correctness bug — the loading skeleton may never disappear. Combined with the `drainRequested` field being silently absent from the backend response, two features (loading indication and drain confirmation) are broken at runtime despite the code appearing correct at a glance.

---

## What Excellence Would Look Like

A 9/10 implementation would:
1. Use `readonly loading = signal(true)` and `readonly unavailable = signal(false)` throughout, eliminating the temporal coupling with `toSignal`'s initial null via a `LoadingState` discriminated union.
2. Define `EnrichedSession`, `EnrichedDetail`, etc. in `sessions-history.model.ts` co-located in the feature folder.
3. Add `takeUntilDestroyed()` to the drain subscription.
4. Use a session-scoped event query instead of `getEventsSince(0)` + client-side filter.
5. Expose `drainRequested` from the backend `getSessionDetail()` return.
6. Either deprecate or update the type on the pre-existing `getSessions()` in `api.service.ts`.
7. Track timeline events by `event.id` rather than string concatenation.
