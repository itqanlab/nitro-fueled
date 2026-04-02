# Code Style Review — TASK_2026_183

| Verdict | PASS |
|---------|------|

---

## Findings

### 1. Model file duplicated verbatim between API and frontend
- **File**: `apps/dashboard/src/app/models/progress-center.model.ts` (lines 1–66)
- **Line**: 1–66
- **Severity**: major
- **Issue**: `progress-center.model.ts` in the frontend is a byte-for-byte copy of `progress-center.types.ts` in the API. Both define the same five types and four interfaces with identical field names, readonly modifiers, and union string values. There is no shared library bridging them, so the two files will drift the moment one side adds a field and the dev forgets to mirror it. This has already happened implicitly: the API type file lives at `dashboard-api/src/dashboard/` while the frontend copy is at `dashboard/src/app/models/`. The names differ (`*.types.ts` vs `*.model.ts`) but the content is identical — this is a maintenance trap.
- **Suggestion**: Extract shared types into `libs/shared/` or `libs/dashboard-api-types/` under the Nx monorepo. Both packages import from the lib. If a shared lib is out of scope for this task, add a `// KEEP IN SYNC WITH dashboard-api/src/dashboard/progress-center.types.ts` comment at the top of the frontend file and file a follow-up task to unify.

---

### 2. Constructor-based DI in `ProgressCenterService` (NestJS side uses constructor correctly, but Angular component does not follow DI rule — separate finding below)
- **File**: `apps/dashboard-api/src/dashboard/progress-center.service.ts`
- **Line**: 37
- **Severity**: info
- **Issue**: `public constructor(private readonly cortexService: CortexService) {}` uses constructor injection. This is correct NestJS style; NestJS does not support `inject()`. No violation here — flagging only so it is not confused with the Angular `inject()` requirement.
- **Suggestion**: No change needed on the NestJS side.

---

### 3. Angular component uses constructor for subscription setup (manual teardown pattern)
- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts`
- **Lines**: 52–62
- **Severity**: major
- **Issue**: The component manually calls `refreshSub.unsubscribe()` and `notificationSub.unsubscribe()` inside `destroyRef.onDestroy`. The project's established pattern (visible throughout the review lessons) is to use `takeUntilDestroyed(this.destroyRef)` as a pipe operator and avoid manual subscription management entirely. The current approach is verbose, easy to forget (if a third subscription is added), and is the exact footgun the `takeUntilDestroyed` helper was introduced to prevent. Additionally, inline subscription logic inside the constructor makes the reactive flow harder to trace.
- **Suggestion**: Replace with `merge(this.ws.events$, this.ws.cortexEvents$).pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef)).subscribe(...)` and similarly for `cortexEvents$`. Remove the manual `onDestroy` handler.

---

### 4. `getProgressCenter` controller method missing explicit return type annotation
- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts`
- **Line**: 262
- **Severity**: minor
- **Issue**: `public getProgressCenter()` has no return type annotation. All other controller methods in the file use explicit `ReturnType<...>` or inline type annotations. The new method is the only one that omits this, creating an inconsistency. TypeScript infers the type, so there is no runtime risk, but it breaks the codebase's type-documentation convention.
- **Suggestion**: Annotate as `public getProgressCenter(): ProgressCenterSnapshot` (importing the type) to match the pattern of every other method in the file.

---

### 5. `getSessions()` controller method also missing return type (pre-existing, worsened by this task)
- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts`
- **Line**: 249
- **Severity**: info
- **Issue**: `public getSessions()` also lacks a return type annotation and was present before this PR. Not introduced by this task, but the new `getProgressCenter` method directly above it follows the same bare-method pattern, making the omission look intentional when it is not. Two adjacent untyped methods will confuse future contributors.
- **Suggestion**: Annotate both while touching the file.

---

### 6. `buildPhaseAverages` silently maps `Review` phase from cortex to `QA` slot
- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts`
- **Lines**: 32–37
- **Severity**: major
- **Issue**: When `item.phase === 'Review'`, the code sets both `QA` and `Review` keys. When `item.phase === 'Completion'`, it overwrites `Review`. This mapping is implicit, undocumented, and relies on knowing that cortex's phase vocabulary does not align 1:1 with the UI phases. A developer reading this code without the domain context cannot determine whether the `QA`/`Review` double-write is intentional or a copy-paste error. The `Review` key ends up being set twice (once in the default seeding on line 26 and again conditionally on lines 34 and 37) with no comment explaining why.
- **Suggestion**: Add a brief comment block above the function explaining the cortex-phase-to-UI-phase mapping contract, particularly that cortex `Review` maps to UI `QA` and cortex `Completion` maps to UI `Review`.

---

### 7. Shadow variable: local `progressPercent` in `buildSessionSnapshot` masks imported function of same name
- **File**: `apps/dashboard-api/src/dashboard/progress-center.service.ts`
- **Lines**: 79 and import on line 30
- **Severity**: major
- **Issue**: Line 79 declares `const progressPercent = Math.round(...)`, which shadows the imported helper function `progressPercent` from `progress-center.helpers.ts` for the remainder of `buildSessionSnapshot`. TypeScript does not warn about this because both are `const` in different scopes. Any future developer trying to call the helper inside the latter half of `buildSessionSnapshot` will silently call the `number` instead, producing a runtime `not a function` error. Line 122 (inside `buildTaskSnapshot`) correctly calls the imported function, so the shadow is per-method, but the mismatch is still a readability hazard.
- **Suggestion**: Rename the local variable to `sessionProgressPercent` or `sessionProgress` to eliminate the shadow.

---

### 8. `activitySummary` accesses dynamic event data with bracket notation without `unknown` narrowing
- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts`
- **Lines**: 126–127
- **Severity**: minor
- **Issue**: `event.data['phase']` and `event.data['status']` are accessed with bracket notation. The inline `typeof` guards make these calls type-safe in terms of runtime behavior. However, if `CortexEvent.data` is typed as `Record<string, unknown>` or `object`, the bracket access is an implicit `unknown` read and the guards are doing the right thing. If `data` is typed as `any`, the guards are masking a broader type-safety gap. Worth verifying `CortexEvent.data`'s declared type.
- **Suggestion**: Confirm `CortexEvent.data` is typed as `Record<string, unknown>`, not `any`. If `any`, tighten it.

---

### 9. Template inline `@if` expression inside `<strong>` tag
- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.html`
- **Lines**: 53 and 75
- **Severity**: minor
- **Issue**: `<strong>@if (session.etaMinutes !== null) { {{ session.etaMinutes }} min } @else { n/a }</strong>` puts a block-level control flow construct inside an inline element. While Angular 17+ supports this, the rendered whitespace behavior can be unpredictable across browsers when control flow is inside `<strong>` or other phrasing content elements. More importantly, `etaMinutes` is already available on the signal-derived `sessions()` array — this comparison should be a `computed()` precomputed field per the anti-pattern rule: "Template expressions must not call methods — use `computed()` signals."
- **Suggestion**: Precompute an `etaLabel(minutes: number | null): string` as a pure function or extract per-session ETA display into a child component. Alternatively, a `computed()` mapped array of display-ready session objects eliminates all template expressions.

---

### 10. `trackBySession` and `trackByTask` accept `_index` but `@for` already passes the index — redundant signature
- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts`
- **Lines**: 83–93
- **Severity**: minor
- **Issue**: The `track` expression in the template (`track trackBySession($index, session)`) passes `$index` as the first argument. The `trackBySession` and `trackByTask` methods accept it but never use it (parameter is `_index`). Angular's `@for` `track` clause should take a simple expression (`track session.sessionId`) rather than calling a method with an unused argument. The method-call pattern is the Angular 14 `TrackByFunction` pattern; in Angular 17+, `track` accepts any expression directly.
- **Suggestion**: Replace `track trackBySession($index, session)` with `track session.sessionId` and remove the three `trackBy*` methods. This eliminates unnecessary method calls during rendering.

---

### 11. `activityToneMap` and `sessionStatusMap` declared as `public readonly` but are plain object literals, not signals
- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts`
- **Lines**: 69–81
- **Severity**: info
- **Issue**: Both maps are static lookup tables that never change. Declaring them as `public readonly` on the class instance is correct in that they are never reassigned, but they add to the component's memory footprint for every instance. More importantly, they are accessed in the template directly (`activityToneMap[item.tone]`), which is a bracket-access expression evaluated on every change detection pass. For an `OnPush` component, this is low risk but still technically a method-call-equivalent per the team's template purity rule.
- **Suggestion**: Convert both to module-level `const` objects and reference them via a `protected` or `public` alias in the component, or pass them as a `computed()` return. Alternatively, document that these are intentional static lookups outside signal concerns.

---

### 12. `DashboardModule` exports line is extremely long and unformatted
- **File**: `apps/dashboard-api/src/dashboard/dashboard.module.ts`
- **Line**: 49
- **Severity**: minor
- **Issue**: The `exports` array is a single 185-character line containing 12 exported tokens. The rest of the file is well-formatted with one item per line. The `ProgressCenterService` addition was appended to this already-long line rather than reformatting. This makes diffs harder to read and is inconsistent with the multi-line `providers` array directly above it.
- **Suggestion**: Reformat the `exports` array to one token per line, matching the `providers` block format.

---

### 13. `collectSessionTaskIds` silently drops workers with empty `task_id`
- **File**: `apps/dashboard-api/src/dashboard/progress-center.helpers.ts`
- **Line**: 49
- **Severity**: info
- **Issue**: `if (worker.task_id !== '') ids.add(worker.task_id)` guards against empty string but not `null` or `undefined`. If `CortexWorker.task_id` is typed as `string | null | undefined`, this guard may silently admit `null` into the `Set` and subsequently into the task lookup, causing `taskMap.get(null)` to return `undefined` and `buildTaskSnapshot` to produce a null-titled entry. Worth verifying the type definition.
- **Suggestion**: Use `if (worker.task_id)` instead of `!== ''` to guard against all falsy values, or use `worker.task_id != null && worker.task_id !== ''` for explicit null/undefined exclusion.

---

### 14. `new Notification(...)` result is discarded — no error handling
- **File**: `apps/dashboard/src/app/views/progress-center/progress-center.component.ts`
- **Line**: 110
- **Severity**: minor
- **Issue**: `new Notification(title, { body, tag })` fires and the result is discarded. The `Notification` constructor can throw in some browser contexts (e.g., when constructed inside an iframe or after permission revocation between the `permission === 'granted'` check and the constructor call). The anti-patterns doc requires: "Clipboard, file dialog, and network operations must handle failure with user feedback." Browser push notifications fall under the same category.
- **Suggestion**: Wrap `new Notification(...)` in a `try { } catch { }` block. Silently swallowing is acceptable here (notifications are non-critical), but log a `console.warn` per the "at minimum log them" rule.

---

### 15. `import` group ordering in `progress-center.service.ts` mixes `import type` with value imports non-sequentially
- **File**: `apps/dashboard-api/src/dashboard/progress-center.service.ts`
- **Lines**: 1–33
- **Severity**: info
- **Issue**: The import block starts with `import { Injectable }` (value), followed by `import { CortexService }` (value), then two `import type` blocks, then another value import block for helpers. The convention in this codebase is: value imports first, then `import type` blocks. The pattern here interleaves them: value, value, type, type, value. While ESLint may not flag this without an explicit rule configured, it diverges from how other service files in the same directory organize their imports.
- **Suggestion**: Reorder to group all value imports together (decorators, service classes, helpers), then all `import type` blocks.

---

## Summary

The implementation is functionally sound with correct use of Angular's `OnPush` strategy, `computed()` signals, `toSignal()`, and `DestroyRef`. The backend helper extraction is a good call and keeps the service under the 200-line limit. The types are consistent with full `readonly` coverage.

However, several style issues need attention:

The most significant concern is the **verbatim duplication** of the type model between the API and frontend (finding 1), which is a future maintenance hazard. The **variable shadowing** of the imported `progressPercent` helper (finding 7) is a latent bug — a developer adding code to `buildSessionSnapshot` after the `const progressPercent` declaration will silently call a number instead of a function. The **missing controller return type** (finding 4) breaks the file's established typing convention. The **manual subscription teardown** pattern (finding 3) deviates from the project norm of `takeUntilDestroyed`.

The template issues (findings 9, 10) are style and performance concerns rather than correctness bugs. The `trackBy` refactor to native `@for` track expressions is a straightforward cleanup.

Overall the code is readable and follows most project conventions. Addressing findings 1, 3, 4, and 7 before merge is recommended.
