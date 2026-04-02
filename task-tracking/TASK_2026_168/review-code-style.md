# Code Style Review - TASK_2026_168

## Review Summary

| Metric          | Value                                              |
| --------------- | -------------------------------------------------- |
| Overall Score   | 3/10                                               |
| Assessment      | NEEDS_REVISION                                     |
| Blocking Issues | 7                                                  |
| Serious Issues  | 6                                                  |
| Minor Issues    | 5                                                  |
| Files Reviewed  | 5                                                  |

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `updateURL()` method sets `skipLocationChange: true` on every navigation call (`project.component.ts:888`). This tells the Angular router to update its internal state without ever touching the browser's location bar. The URL persistence feature — the entire stated value proposition of the search/filter work — silently does nothing in every browser. A developer inheriting this code will look at the `queryParams` wiring and assume it works; only a manual browser test would reveal it. Six months from now, when someone files "filters don't survive page refresh", no one will trace it back to a single flag.

Additionally, the `onSortChange` handler at `project.component.ts:345` splits the combined `field-direction` string by `-`. For `SortField.CREATED_AT` (value `'createdAt'`), the split yields a three-element array: `['createdAt', 'desc']` — no split corruption there, but if the enum value were ever changed to contain a hyphen (e.g., `'created-at'`), the destructure silently assigns the wrong values. This is a latent correctness risk with zero compiler protection.

### 2. What would confuse a new team member?

A new developer opening `project.component.ts` is confronted with 935 lines combining: filter state management, URL persistence, sort logic, auto-pilot lifecycle, polling, DOM manipulation for screen-reader announcements, and ten `test*` methods that look like public API but are actually manual-testing scaffolding. There is no clear seam between these concerns. The file also declares two teardown mechanisms — `DestroyRef.onDestroy()` at line 307 and a `destroy$` Subject driven by `takeUntil(this.destroy$)` at line 314 — with no comment explaining why both are needed. A new developer modifying the subscription logic will reasonably think either mechanism alone is sufficient and may break the other.

The `testURLPersistence()` method at line 736 will always return `false` in every real Angular environment because it depends on `this.router.url` changing, but `updateURL()` sets `skipLocationChange: true`, which guarantees the router URL never reflects the query params. A new developer trusting this test method to validate URL persistence will waste significant time.

### 3. What's the hidden complexity cost?

The `activeFilterChips` computed signal at line 229 embeds arrow functions (`clear: () => this.selectedStatuses.set([])`) as properties on the chip objects. Arrow functions created inside `computed()` are recreated on every signal evaluation — which is every time any filter changes. The template then tracks chips by `chip.type + chip.label`. When a user types in the search box, `filteredTasks` recomputes, `resultCountText` recomputes, `activeFilterChips` recomputes, and all the chip arrow functions are discarded and recreated. In a 50-item chip list this is negligible, but the pattern is architecturally wrong: `computed()` is for pure derivation, not for constructing closures that close over component methods.

The `applyFiltersAndSort` method at line 91 is a public instance method called by `filteredTasks = computed(() => this.applyFiltersAndSort(...))`. This means the sorting-and-filtering logic is never testable in isolation without instantiating the full component. It also means any future developer who adds a parameter to `applyFiltersAndSort` breaks the `computed()` call site invisibly.

### 4. What pattern inconsistencies exist?

The project's established pattern (documented in `frontend.md` review lessons) is that template expressions must use `computed()` signals, never method calls. This component violates that rule in at least six places: `statusSelectedCount()`, `typeSelectedCount()`, `prioritySelectedCount()`, `isStatusSelected(status)`, `isTypeSelected(type)`, `isPrioritySelected(priority)`, and `isModelSelected(model)` are all plain methods invoked directly in the template. Each call fires on every change detection cycle, for every item in every `@for` loop.

The model file (`project-queue.model.ts`) mixes readonly and mutable field declarations. `QueueTask` correctly uses `readonly` throughout. `QueueTaskExtended` at line 54 mixes `readonly` and bare mutable fields (`description?`, `created?`) with no documented reason for the asymmetry. `FilterChips` uses mutable arrays. This is not a consistency choice — it is an inconsistency.

### 5. What would I do differently?

- Extract filter state and logic into a `ProjectFilterService` (or NgRx signal store), leaving the component as a thin coordinator under 150 lines.
- Delete all `test*` methods from the production component — move them to a `project-filter.utils.spec.ts` file as proper unit tests.
- Convert `statusSelectedCount`, `typeSelectedCount`, `prioritySelectedCount`, `isStatusSelected`, `isTypeSelected`, `isPrioritySelected`, `isModelSelected` to `computed()` signals.
- Fix `skipLocationChange: true` — it should be `false` (or omitted) for URL persistence to work.
- Delete `QueueTaskExtended`, `FilterChips`, `QueueFilter` — they are unused and add noise.
- Extract SCSS into logical partials (toolbar, badges, list-view, kanban-view) to bring each under 300 lines.
- Consolidate the two duplicate SCSS rule blocks for `.toolbar`, `.filter-badge`, `.filter-dropdown-btn`, `.filter-dropdown-menu`, `.filter-option`, `.active-chip`, `.clear-all-btn`.

---

## Blocking Issues

### Issue 1: URL Persistence Is Silently Broken

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:888`
- **Problem**: `updateURL()` passes `skipLocationChange: true` to `router.navigate()`. This flag instructs the router to update its internal state without propagating the change to the browser's location bar. The URL query params never appear in the address bar, cannot be bookmarked, cannot be shared, and do not survive a page reload. The entire URL persistence feature is non-functional.
- **Impact**: Core feature from the task requirements silently does nothing. Shared links have no filter state. Page refresh loses all filters.
- **Fix**: Remove `skipLocationChange: true`. The default behavior (`skipLocationChange: false`) is what URL persistence requires.

### Issue 2: Component File Exceeds Size Limit by 6x

- **File**: `apps/dashboard/src/app/views/project/project.component.ts` (935 lines)
- **Problem**: Project maximum for a component is 150 lines. This file is 935 lines — a 6x violation. It contains: filter state management, URL sync, sort/filter logic, auto-pilot lifecycle, polling, DOM manipulation for accessibility, Kanban computed columns, and 10 manual-testing methods.
- **Impact**: Unmaintainable. Every new feature requires reading and understanding 935 lines of unrelated concerns. The file will grow further without an enforced boundary.
- **Fix**: Extract filter + sort logic into `project-filter.service.ts` or a dedicated signal store. Extract `test*` methods into a `project.component.spec.ts` file. The component should own only template coordination and user interaction dispatch.

### Issue 3: Template Method Calls on Every Change Detection Cycle

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:353–363` and `project.component.html:178, 216, 267, 199, 240, 285, 535`
- **Problem**: `statusSelectedCount()`, `typeSelectedCount()`, `prioritySelectedCount()`, `isStatusSelected(status)`, `isTypeSelected(type)`, `isPrioritySelected(priority)`, `isModelSelected(model)` are all plain component methods invoked directly in the template. These execute on every change detection cycle. `isStatusSelected`, `isTypeSelected`, and `isPrioritySelected` fire once per item inside `@for` loops — nine status items, six type items, four priority items — meaning 19 method calls on every change cycle just for the checkbox state.
- **Impact**: Unnecessary computation on every user interaction. Violates the project's established anti-pattern rule: "Template expressions must not call methods — use `computed()` signals."
- **Fix**: Convert to `computed()` signals. For per-item checks in loops, precompute a `Set` inside the `computed()` and pass it as a template variable using `@let`, or replace with a `Map`-based lookup signal.

### Issue 4: Production Component Contains 10 Test Methods

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:550–844`
- **Problem**: `testFullTextSearch`, `testStatusFilter`, `testTypeFilter`, `testPriorityFilter`, `testModelFilter`, `testDateRangeFilter`, `testSort`, `testActiveFilterChips`, `testURLPersistence`, `testResultCountDisplay`, `testFilterPerformance`, `testAccessibility`, `testResponsiveDesign` — 294 lines of manual-testing scaffolding are embedded as public methods on the production class. These are not unit tests (no testing framework), not stubs (they mutate component state), and not utilities (they are specific to this component). They will be callable from the browser console and from templates.
- **Impact**: Dead production code that ships to users. Public methods on the component class pollute the public API. Each method mutates signal state and calls `updateURL()`, creating side effects when called accidentally.
- **Fix**: Delete from the production class. Write proper Angular unit tests in `project.component.spec.ts` using `TestBed`.

### Issue 5: `onSortChange` Uses Unsafe Type Assertion on Split String

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:345`
- **Problem**: `const [field, direction] = value.split('-') as [SortField, SortDirection]`. The `as` assertion silently accepts any string from the `<select>` value, with no runtime validation. The split also assumes exactly one hyphen — which holds for current `SortField` values (`id`, `status`, `priority`, `type`) but `SortField.CREATED_AT = 'createdAt'` splits cleanly only by coincidence. More importantly, `as` type assertions are an established blocking rule in the project's review lessons.
- **Impact**: If an invalid option value is in the DOM (e.g., during incremental rendering or a browser autofill), the signal state is silently set to an unvalidated string. The general "No `as` type assertions" rule is violated.
- **Fix**: Validate the parsed field against `Object.values(SortField)` before assigning. Use a `find()` lookup or a guard function instead of `as`.

### Issue 6: `clearAllFilters` Double-Calls `updateURL()`

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:493–501`
- **Problem**: `clearAllFilters()` calls `clearSearch()`, `clearStatusFilter()`, `clearTypeFilter()`, `clearPriorityFilter()`, `clearModelFilter()`, `clearDateRange()` — each of which individually calls `updateURL()` — then calls `updateURL()` again explicitly on line 500. This triggers seven URL navigations for a single user action.
- **Impact**: Seven `router.navigate()` calls fire in one synchronous frame. If `skipLocationChange: true` is removed (fix for Issue 1), this produces seven browser history entries or seven `replaceUrl` replacements in rapid succession — observable as a router state inconsistency.
- **Fix**: Have each individual `clear*` method update only the signal state. Merge URL sync to the `clearAllFilters()` caller, or batch the signal resets and call `updateURL()` once at the end of `clearAllFilters`.

### Issue 7: `announceToScreenReader` Leaks DOM Nodes on Error

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:509–521`
- **Problem**: `document.body.appendChild(announcement)` followed by `setTimeout(() => document.body.removeChild(announcement), 1000)`. If the component is destroyed within 1 second of a filter change (e.g., user navigates away), `removeChild` throws because the element may have already been removed or the `document.body` context is gone. There is also no `clearTimeout` on component destroy, so the timer fires on a dead component.
- **Impact**: DOM leak and potential `NotFoundError` on navigate-away. Violates the cleanup requirement in review lessons: "Every `addEventListener`/`on()` must have removal."
- **Fix**: Track the timeout ID and clear it in `destroyRef.onDestroy()`. Guard `removeChild` with `announcement.isConnected`.

---

## Serious Issues

### Issue 1: Dual Teardown Mechanisms With No Documented Intent

- **File**: `project.component.ts:307–321`
- **Problem**: The constructor registers `destroyRef.onDestroy()` (lines 307–321) AND sets up a `destroy$` Subject with `takeUntil(this.destroy$)` (line 317). `DestroyRef.onDestroy()` is the Angular 16+ idiomatic approach and subsumes the `Subject + takeUntil` pattern. Using both creates a hidden ordering dependency — `destroy$` must emit before `destroyRef.onDestroy()` or subscriptions won't be torn down. The `destroy$` Subject is initialized as a class field but never exposed; there is no documented reason to maintain two mechanisms.
- **Tradeoff**: Removing `destroy$` and converting the `searchInput$` pipe to use `takeUntilDestroyed(this.destroyRef)` is straightforward and eliminates the ambiguity.
- **Recommendation**: Use `takeUntilDestroyed(this.destroyRef)` from `@angular/core/rxjs-interop`. Remove `destroy$`, remove the `searchInput$` Subject entirely, and wire the debounce via an Angular `afterNextRender` or `effect`.

### Issue 2: Unused Dead Code in Model File

- **File**: `apps/dashboard/src/app/models/project-queue.model.ts:54–97`
- **Problem**: `QueueTaskExtended` (line 54), `FilterChips` (line 68), `DateRange` (line 75), `QueueFilterState` (line 80), and `QueueFilter` (line 93) are exported but never imported anywhere in the codebase. `QueueFilterState.activeChips` is optional (`activeChips?: FilterChips`) which contradicts the purpose of a filter state interface. `QueueTaskExtended` has `description?` and `created?` as mutable bare fields alongside `readonly` fields — the inconsistency has no documented intent.
- **Tradeoff**: Dead exports inflate the public API surface and create false documentation for future developers who will read the model file and assume these types are in use.
- **Recommendation**: Delete `QueueTaskExtended`, `FilterChips`, `DateRange`, `QueueFilterState`, and `QueueFilter`. If `DateRange` or `FilterChips` were intended for future use, add a comment marking them as forward-looking stubs.

### Issue 3: `filteredTasks` Is Computed Twice in the Template

- **File**: `apps/dashboard/src/app/views/project/project.component.html:135, 148, 152, 156, 347, 357`
- **Problem**: The template calls `filteredTasks()` approximately 8 times across both the filter-row result count section and the list/kanban views. While `computed()` memoizes the value, every `()` invocation re-reads the signal and re-evaluates the equality check. More critically, the template renders two independent empty-state messages — one in the toolbar (lines 135–161) and one in the list view (lines 347–356) — both calling `filteredTasks().length`. Any change to the empty-state messaging must be updated in two places.
- **Tradeoff**: The template-level result count in the toolbar is redundant with the list view's empty state — they display the same information with slightly different text.
- **Recommendation**: Deduplicate by using a single empty-state location. Assign `filteredTasks()` to an `@let` template variable once (Angular 18+ feature) or introduce a `readonly isEmpty = computed(() => this.filteredTasks().length === 0)` signal.

### Issue 4: SCSS File Has Duplicate Rule Blocks (900 Lines)

- **File**: `apps/dashboard/src/app/views/project/project.component.scss`
- **Problem**: The SCSS file is 900 lines with large sections of duplicate rules. `.toolbar` is defined at line 116 and again at lines 340–345. `.filter-badge` is defined at lines 132–144 and again at lines 839–843. `.filter-dropdown-btn` is defined at lines 176–192 and again at lines 851–860. `.filter-dropdown-menu` at lines 229–246 and again at lines 862–865. `.filter-option` at lines 294–303 and again at lines 867–873. `.active-chip` at lines 526–540 and again at lines 879–883. `.clear-all-btn` at lines 569–591 and again at lines 890–900.
- **Tradeoff**: Duplicate SCSS rules create a cascade conflict: whichever block appears last wins. Any developer editing the first block will see no effect because the second block overrides it. This is a maintenance trap.
- **Recommendation**: Delete the duplicate second-occurrence blocks (lines 838–901). The first definitions are complete. The second block appears to be a "Color Independence" section that merely restates properties already using CSS variables — it is entirely redundant.

### Issue 5: Hardcoded RGBA Colors in SCSS

- **File**: `apps/dashboard/src/app/views/project/project.component.scss:47, 93, 98, 238, 609, 613, 652, 664, 671, 672, 673, 799, 800`
- **Problem**: Multiple rules use hardcoded `rgba(16, 185, 129, 0.1)`, `rgba(16, 185, 129, 0.3)`, `rgba(16, 185, 129, 0.05)`, `rgba(16, 185, 129, 0.08)`, `rgba(16, 185, 129, 0.4)`, `rgba(0, 0, 0, 0.1)`, `rgba(0, 0, 0, 0)`. This is an explicit anti-pattern violation: "NEVER hardcoded hex/rgba colors — use CSS variables or the project's design token system."
- **Tradeoff**: The success color (`16, 185, 129` is `emerald-500`) is the only green in the palette today. If the brand color ever changes, every hardcoded `rgba(16, 185, 129, ...)` must be hunted down manually. The theme system exists precisely to prevent this.
- **Recommendation**: Define `--success-rgb: 16, 185, 129` in the theme file and use `rgba(var(--success-rgb), 0.1)` throughout. Or use existing `var(--success)` with an `opacity` property on dedicated wrapper elements.

### Issue 6: URL Initialization Bypasses Type Safety

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:895–911`
- **Problem**: `initializeFromURL()` casts raw URL string values to typed enums with `as`: `params.get('status')!.split(',') as QueueTaskStatus[]`, `params.get('type')!.split(',') as QueueTaskType[]`, `params.get('sort') as SortField`, `params.get('dir') as SortDirection`, `params.get('view') as QueueViewMode`. A bookmarked URL with a typo or a manually crafted URL will silently inject an invalid enum value into the signal state. The component then uses these as indexes into `STATUS_ORDER`, `PRIORITY_ORDER`, and the `statusClassMap` records, all of which return `undefined` for unknown keys.
- **Tradeoff**: URL query params are external, untrusted input. The anti-pattern rule states: "Validate at system boundaries (user input, external APIs, IPC). Trust internal code."
- **Recommendation**: Add validation guards before setting each signal. For status/type/priority, filter the split array through the known-valid sets. For sort/direction, check against `Object.values(SortField)` and `['asc', 'desc']` before applying.

---

## Minor Issues

1. **`project.component.ts:55–58`**: `pollSubscription: Subscription | null` and `startSubscription: Subscription | null` are bare (no access modifier). The project rule requires explicit `private` on all class members.
2. **`project.component.ts:298`**: `sortFieldOptions` is declared with `public` but no `readonly`. It is never reassigned, so `readonly` should be present per the `computed()` signals rule that all exposed readonly fields must carry `readonly`.
3. **`project.component.html:69–71`**: `(keydown.enter)="clearSearch()"` and `(keydown.space)="clearSearch()"` on the search `<input>` element means pressing Enter or Space clears the input instead of confirming the search or inserting a space character. Space-to-clear destroys in-progress typing.
4. **`project-queue.model.ts:39–45`**: The `SortField` enum uses `PascalCase` for the type name (correct) but the `CREATED_AT` key name mixes `SCREAMING_SNAKE_CASE` for enum keys (correct per convention) while `SortConfig` is a named but unused interface — it exists alongside the individual `sortField` and `sortDirection` signals but is never referenced.
5. **`project.component.scss:189–198`**: `.filter-dropdown-btn:hover, .filter-dropdown-btn:focus` sets both `border-color: var(--accent)` and `outline: 2px solid var(--accent)`. The button also has `outline: none` at line 189 (via the base rule), which the hover/focus rule overrides. This `outline: none` default is an accessibility concern — it disables the focus ring for users who navigate without a mouse, then only partially restores it via the `:focus` selector (which also fires on click, not just keyboard). The proper approach is `:focus-visible`.

---

## File-by-File Analysis

### `project.component.ts`

**Score**: 2/10
**Issues Found**: 6 blocking, 4 serious, 2 minor

**Analysis**:
At 935 lines, this file fails the project's 150-line component limit by a factor of six. The primary structural problem is that the file is doing four distinct jobs: (1) filter state ownership and URL sync, (2) task display coordination (list/kanban), (3) auto-pilot lifecycle and polling, and (4) manual-testing scaffolding. None of these responsibilities has a clear boundary within the file.

The `applyFiltersAndSort` method is public and 79 lines long (lines 91–170), violating the 50-line function limit. Its `performance.now()` timing block at lines 92 and 161–166 is left-over debugging code that ships to production with an explicit "can be removed in production" comment — a comment that was not acted on.

The `destroyRef.onDestroy()` and `destroy$ Subject` coexist without explanation. The `testURLPersistence()` method will always return `false` because `skipLocationChange: true` prevents the URL from changing — the test validates a feature that was accidentally disabled.

**Specific Concerns**:
1. Lines 313–321: `searchInput$` Subject + `takeUntil(this.destroy$)` duplicates what `takeUntilDestroyed(this.destroyRef)` would do with no Subject needed.
2. Lines 550–844: 294 lines of `test*` methods that mutate live signal state and call `updateURL()` — these are not unit tests; they are manual debugging scripts committed to production code.
3. Lines 877–889: `updateURL()` with `skipLocationChange: true` renders the feature non-functional.
4. Line 345: `value.split('-') as [SortField, SortDirection]` — unsafe `as` assertion on user-controlled input.
5. Lines 307–310: `destroyRef.onDestroy(() => { this.startSubscription?.unsubscribe(); this.stopPolling(); this.destroy$.next(); this.destroy$.complete() })` — four operations in one teardown callback, no guard for double-call.
6. Lines 493–501: `clearAllFilters` triggers 7 `updateURL()` calls.

---

### `project.component.html`

**Score**: 5/10
**Issues Found**: 0 blocking, 1 serious, 2 minor

**Analysis**:
The template correctly uses `@if`/`@for`/`@switch` block syntax throughout — no `*ngIf` or `*ngFor` present. The template is 480 lines which exceeds the 50-line inline template guideline, but since it uses an external `.html` file, the applicable limit is component responsibility scope rather than a hard line count.

ARIA attributes are thoughtfully applied. The use of `aria-live="polite"` on filter counts and the running badge is correct. Role assignments are mostly correct, with one exception: `<label role="option">` on the filter checkboxes (lines 194, 239, 285) is semantically wrong. `role="option"` is for elements inside a `listbox` — it overrides the native label semantics without providing the expected keyboard behavior of a real `<option>`. The parent container uses `role="listbox"` which compounds this.

The duplicate empty-state message (toolbar at lines 135–161 and list view at lines 347–356) creates two independent sources of "no results" feedback that must be maintained in sync.

**Specific Concerns**:
1. Lines 194, 239, 285: `<label class="filter-option" role="option">` — `role="option"` is semantically wrong on a label element with a checkbox inside.
2. Lines 67–71: `(keydown.enter)="clearSearch()"` and `(keydown.space)="clearSearch()"` on the search input make Enter and Space trigger clear instead of their expected behaviors.

---

### `project.component.scss`

**Score**: 3/10
**Issues Found**: 0 blocking, 2 serious, 1 minor

**Analysis**:
The SCSS file is 900 lines with substantial duplication. Lines 838–901 are a "Color Independence for Filter State Indicators" section that re-declares properties already set in lines 116–591 using the same CSS variable references. This section adds no new information and will silently override any future edits made to the original blocks.

Hardcoded `rgba(16, 185, 129, ...)` values appear 13+ times for the success/green color. This is the most frequently-violated anti-pattern in the project's history per the review lessons.

The SCSS structure has no logical section grouping beyond comment headers. A 900-line SCSS file for a single component view violates the intent of the file-size rules even when they are not stated explicitly for SCSS files.

**Specific Concerns**:
1. Lines 838–901: Entire block is duplicate definitions. Delete it.
2. Lines 47, 93, 98, 238, 609, 613, 652, 664, 671, 672, 673, 799, 800: Hardcoded `rgba(16, 185, 129, ...)` and `rgba(0, 0, 0, ...)` values — anti-pattern violation.

---

### `project-queue.model.ts`

**Score**: 6/10
**Issues Found**: 0 blocking, 1 serious, 0 minor

**Analysis**:
The core types (`QueueTask`, `QueueTaskStatus`, `QueueTaskType`, `QueueTaskPriority`, `QueueViewMode`, `SortField`, `SortDirection`, `SortConfig`) are clean and well-typed. `QueueTask` correctly marks all fields `readonly`.

The dead types at lines 54–97 (`QueueTaskExtended`, `FilterChips`, `DateRange`, `QueueFilterState`, `QueueFilter`) were added for this task but are never used. `QueueTaskExtended` at line 54 is a near-duplicate of `QueueTask` with inconsistent `readonly` coverage and optional fields that lack documentation. The `QueueFilterState.activeChips?: FilterChips` optional field suggests incomplete design.

The file is 96 lines — within the 80-line guideline for model files only because the dead types were added. Without the dead types it would be 53 lines.

---

### `project.constants.ts`

**Score**: 8/10
**Issues Found**: 0 blocking, 0 serious, 1 minor

**Analysis**:
The mock data file is clean, correctly typed against `QueueTask`, and uses `readonly` on the array. All required fields are present. The `description` field on `QueueTask` is declared `readonly description: string` (non-optional), yet mock entries are valid.

The only concern is cosmetic: the `description` field value on several entries (e.g., `TASK_2026_156`) is truncated with `...` which matches the actual task descriptions, appropriate for mock data.

---

## Pattern Compliance

| Pattern                    | Status | Concern                                                                              |
| -------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Signal-based state         | PASS   | All filter state uses `signal()` and `computed()` correctly for the core signals     |
| Template method calls      | FAIL   | `statusSelectedCount()`, `isStatusSelected()`, et al. are methods, not `computed()`s |
| `OnPush` change detection  | PASS   | `ChangeDetectionStrategy.OnPush` present                                             |
| `inject()` for DI          | PASS   | All dependencies injected via `inject()`                                             |
| No `any` types             | PASS   | No `any` found                                                                       |
| No `as` type assertions    | FAIL   | `value.split('-') as [SortField, SortDirection]` and all URL param casts             |
| Explicit access modifiers  | FAIL   | `pollSubscription` and `startSubscription` lack access modifiers                     |
| No hardcoded colors        | FAIL   | 13+ `rgba(16, 185, 129, ...)` occurrences in SCSS                                   |
| File size limits           | FAIL   | Component 935 lines (limit 150), SCSS 900 lines (no explicit limit but duplicated)   |
| `@if`/`@for` block syntax  | PASS   | No structural directives found                                                       |
| Types in `.model.ts` files | PASS   | All interfaces and types are in the model file                                       |
| No unused exports          | FAIL   | `QueueTaskExtended`, `FilterChips`, `DateRange`, `QueueFilterState`, `QueueFilter`   |

---

## Technical Debt Assessment

**Introduced**:
- 294 lines of `test*` scaffolding committed to the production class. These will never be removed without an explicit task because they "seem like they might be useful."
- A non-functional URL persistence implementation that will confuse every developer who reads the code and assumes it works.
- Duplicate SCSS rule blocks that will silently override future edits.
- Five dead type exports in the model file.

**Mitigated**:
- None. The feature adds capabilities but the implementation style introduces more debt than the baseline component carried.

**Net Impact**: Negative. The component was already growing; this task added 6x overage with no decomposition.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Key Concern**: `updateURL()` sets `skipLocationChange: true`, making the core deliverable — URL persistence of filter state — silently non-functional. This is not a style issue; it is a feature bug. Combined with the 935-line component that cannot be reasonably maintained, this implementation needs restructuring before it can be considered complete.

## What Excellence Would Look Like

A 10/10 implementation would:
- Keep `project.component.ts` under 150 lines by extracting filter state and logic into `project-filter.service.ts` or a signal store.
- Have zero `test*` methods in the production class — proper unit tests in `project.component.spec.ts` instead.
- Convert `isStatusSelected`, `isTypeSelected`, `isPrioritySelected`, `isModelSelected`, `statusSelectedCount`, `typeSelectedCount`, `prioritySelectedCount` to `computed()` signals using Set-based lookups.
- Use `takeUntilDestroyed(this.destroyRef)` and eliminate the `destroy$` Subject.
- Use `rgba(var(--success-rgb), 0.1)` everywhere instead of hardcoded color values.
- Have `updateURL()` without `skipLocationChange: true` so the feature actually works.
- Have `initializeFromURL()` validate each URL param against the known-valid enum values before setting signal state.
- Consolidate the SCSS to a single definition per selector, under 400 lines.
- Delete the five dead type exports from the model file.

| Verdict | FAIL |
| ------- | ---- |
