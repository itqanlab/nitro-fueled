# Code Logic Review - TASK_2026_168

## Review Summary

| Metric              | Value                                        |
| ------------------- | -------------------------------------------- |
| Overall Score       | 4/10                                         |
| Assessment          | NEEDS_REVISION                               |
| Critical Issues     | 3                                            |
| Serious Issues      | 5                                            |
| Moderate Issues     | 4                                            |
| Failure Modes Found | 10                                           |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **URL persistence is entirely broken** at the router level. `updateURL()` calls `router.navigate()` with both `replaceUrl: true` AND `skipLocationChange: true` simultaneously. These flags are contradictory: `skipLocationChange: true` tells the Angular router to update internal state but NOT write the URL to the browser's `location` object. The URL in the address bar never changes. A user who copies the URL shares nothing. The acceptance criterion "Filter state reflected in URL query params" cannot pass with `skipLocationChange: true` set.

- **`removeChip()` calls `updateURL()` after `chip.clear()`**. The `chip.clear()` already calls `updateURL()` internally (e.g., `clear: () => this.selectedStatuses.set([])` triggers no URL update — wait, it does NOT call `updateURL()` itself). Actually the chip `clear` lambdas only call `signal.set([])` and then `removeChip` calls `updateURL()` — but the `clear*Filter` methods also each call `updateURL()`. The chip lambdas are inline and do NOT call `updateURL()`, so the double-call in `removeChip` is benign. However this double-call pattern is fragile and will be a bug the moment any chip clear lambda is changed to call `updateURL()` internally.

- **The `testModelFilter` method has a broken assertion**: it considers a task with `task.model === null` as a pass even when no null-model tasks are in the selected set, because the check is `models.includes(task.model || '') || task.model === null`. This means the test method always returns `true` for tasks with null models, masking the real filter behavior. The actual filter in `applyFiltersAndSort` correctly excludes null-model tasks — but the manual test method says they pass. Silent incorrect validation.

- **`announceToScreenReader` leaks DOM nodes on rapid filter changes**. Each filter interaction appends a `div` to `document.body` and removes it after 1000ms via `setTimeout`. If the user changes 5 filters quickly, 5 nodes accumulate in the DOM simultaneously. No cleanup guard exists. The `setTimeout` callback calls `document.body.removeChild(announcement)` but if the component is destroyed before the timeout fires, this will throw "Node was not found".

- **`applyFiltersAndSort` is called as a public method in the template via `filteredTasks` computed signal, but it also has a `performance.now()` side-effect and a `console.warn` that fires in production** whenever filtering more than ~20-30 tasks takes over 50ms. This is a debug artifact shipping to production.

### 2. What user action causes unexpected behavior?

- **Pressing Enter or Space in the search input clears it** (lines 69-71: `keydown.enter` and `keydown.space` both call `clearSearch()`). This is the opposite of expected behavior. A user types a query, presses Space to add a space or Enter to confirm, and their entire query disappears.

- **Pressing Escape on a task row navigates to the task detail page** (line 369: `keydown.escape` on `.task-row` calls `onTaskClick(task)`). Standard UX convention is Escape closes / cancels. The user presses Escape to dismiss something and instead navigates away.

- **Opening multiple filter dropdowns simultaneously is possible**. Each dropdown has its own independent `open` signal. Clicking Status then Type opens both simultaneously. There is no close-others logic in the toggle methods and no outside-click handler to close open dropdowns. Users are left with all dropdowns open at once with no way to close them except clicking each button again.

- **`clearAllFilters()` calls `updateURL()` after calling `clearSearch()`, `clearStatusFilter()`, etc., each of which already calls `updateURL()`**. This triggers 7 separate `router.navigate()` calls in rapid succession for a single "Clear All" action. Angular's router queues these, but this is unnecessary thrashing and causes 7 change-detection cycles.

- **The sort select uses a combined `field-direction` value format** (e.g., `"id-asc"`, `"createdAt-asc"`). `onSortChange` splits on `-`. For `SortField.CREATED_AT = 'createdAt'`, the value `"createdAt-asc"` splits correctly to `['createdAt', 'asc']`. However this parse is entirely fragile: any future sort field containing a hyphen (e.g., a hypothetical `last-activity`) would silently split incorrectly. The select `[value]` binding is `sortField() + '-' + sortDirection()`, and the option `value` attribute is `{{ opt.value }}-asc` which uses template string interpolation inside an HTML attribute — this is fine but creates an implicit contract between the two that has no compile-time enforcement.

### 3. What data makes this produce wrong results?

- **URL params with invalid enum values are cast without validation**. `initializeFromURL()` does `params.get('status')!.split(',') as QueueTaskStatus[]` — a bookmarked URL like `?status=INVALID` will set `selectedStatuses` to `['INVALID']`. The status filter then uses `statusSet.has(task.status)` which will never match any task (silently returning zero results). The user sees "No tasks match your filters" with no indication the URL is malformed. Same vulnerability applies to `type`, `priority`, `sort`, `dir`, and `view` params.

- **Date boundary: `new Date('2026-03-30').getTime()`** parses as midnight UTC on that date. If the user's browser timezone is UTC+5:30 (India), a task with `createdAt: '2026-03-30T01:00:00Z'` (which is 6:30 AM IST) will pass a `startDate = '2026-03-30'` filter. But a task with `createdAt: '2026-03-29T22:00:00Z'` (which is 3:30 AM IST on March 30) will be excluded. Users choosing a date expect local-date semantics but get UTC-midnight semantics. This produces wrong results for ~40% of the world's timezones.

- **`PRIORITY_ORDER` and `STATUS_ORDER` lookup maps will throw a runtime exception** (return `undefined`, producing `NaN` in comparison) if a task has a `priority` or `status` value not present in the map. The `QueueTask` interface uses typed string unions, so TypeScript prevents this at compile time — but `initializeFromURL` casts URL strings directly to `QueueTaskStatus` without validation, so a URL-injected bad status could produce a task that passes the filter but then crashes the sort comparator silently.

- **The `resultCountText` computed signal checks `!query && this.activeFilterCount() === 0`** for the "Showing all N tasks" branch, but the template independently renders the same count inside the toolbar-filters div with its own `@if (searchQuery())` chain. These two implementations can diverge: if `searchQuery()` returns `'  '` (only spaces), `resultCountText()` will trim and show "Showing all N tasks" (because `query = ''` after trim), but the template `@if (searchQuery())` will evaluate `'  '` as truthy and show the "matching" branch. A user typing only spaces sees a "matching" banner with no actual filter applied.

### 4. What happens when dependencies fail?

- **`router.navigate()` in `updateURL()` is not awaited and errors are not caught**. If the router is destroyed or in an error state, the `void` discard means any navigation failure is silently swallowed. No fallback, no error logged.

- **`document.body.removeChild(announcement)` in `announceToScreenReader`** will throw `DOMException: Node was not found` if the component is destroyed before the 1000ms timeout fires (e.g., user navigates away). There is no guard (`document.body.contains(announcement)` check before removal).

- **The `apiService.startAutoPilot()` and `getAutoPilotStatus()` error paths** set `autoPilotState` back to `'idle'` — this is correct. However the `startPolling` method never transitions `autoPilotState` to `'running'` when status is anything other than `'running'`; it leaves it as `'starting'` indefinitely if the API returns an unexpected value (e.g., `'stopped'` or `'unknown'`). The state machine gets stuck in `'starting'` with no timeout or escape.

- **`allTasks` is a static readonly array from `MOCK_QUEUE_TASKS`**. There is no API call, no loading state, no error state. If this is later connected to a real API endpoint, the entire filter computed chain would need to be rewired because `filteredTasks` is `computed(() => this.applyFiltersAndSort(this.allTasks))` where `allTasks` is a plain class property, not a signal. Changing it to an API-sourced signal later will require more than a drop-in replacement.

### 5. What's missing that the requirements didn't mention?

- **No model filter UI rendered in the template**. The task description (item 6) explicitly requires a Model filter. `toggleModel()`, `selectedModels` signal, `availableModels` computed, and `isModelSelected()` are all implemented in the component class, but there is zero HTML in the template for a model filter dropdown. The filter logic works, URL persistence for models works, the chips show model chips — but users have no way to activate the model filter through the UI. The feature is implemented but not exposed.

- **No click-outside handler for filter dropdowns**. Multi-select dropdowns with no outside-click-to-close behavior require the user to re-click the button to close them. Standard dropdown UX closes on outside click.

- **No keyboard navigation inside filter dropdowns**. Arrow keys, Home, End, and Enter for checkbox selection are expected on a multi-select listbox (the template uses `role="listbox"` which has these ARIA keyboard requirements). The `role="listbox"` is applied but the keyboard contract is not implemented.

- **Search input input value binding**: The `[value]="searchQuery()"` binding on the search input will cause a UX issue. When the user types, `onSearchInput` pushes to `searchInput$` which is debounced 300ms before updating `searchQuery()`. During those 300ms, the signal has the old value. Angular's OnPush change detection will not re-render the input during typing (which is correct — the native input controls its own value). However if a filter chip is cleared while the user is mid-type, `searchQuery()` is set to `''` and the `[value]` binding will reset the input to `''`, discarding the in-progress typed query. The debounced subject and the signal are out of sync during the debounce window.

- **`QueueTaskExtended` interface in the model file is unused and differs from `QueueTask`**. `description` is optional in `QueueTaskExtended` but required in `QueueTask`. The `QueueFilter` interface (with `statusFilter: QueueTaskStatus | 'ALL'`) is also unused. These dead interfaces add confusion and contradict the `QueueTask` shape without explanation.

---

## Failure Mode Analysis

### Failure Mode 1: URL Never Updates (skipLocationChange)

- **Trigger**: Any filter change calls `updateURL()` which passes `skipLocationChange: true` to `router.navigate()`
- **Symptoms**: Address bar shows the base URL at all times regardless of active filters. Sharing or bookmarking the URL gives an unfiltered view. Browser back/forward does not restore filter state.
- **Impact**: Critical — the URL persistence acceptance criterion is entirely non-functional
- **Current Handling**: Code calls `replaceUrl: true` alongside `skipLocationChange: true`, but `skipLocationChange` takes precedence and prevents location updates
- **Recommendation**: Remove `skipLocationChange: true`. The comment says "reduce overhead" but URL writes are not meaningfully expensive compared to the navigation they replace.

### Failure Mode 2: Search Input Clear on Space/Enter

- **Trigger**: User presses Space or Enter while typing in the search field
- **Symptoms**: Entire search query is erased silently
- **Impact**: Critical UX regression — basic text input is broken
- **Current Handling**: `(keydown.space)="clearSearch()"` and `(keydown.enter)="clearSearch()"` are explicitly bound on the `<input type="search">`
- **Recommendation**: Remove both `keydown.enter` and `keydown.space` bindings from the search input. Escape-to-clear is the only appropriate keyboard shortcut; Enter on a search should be a no-op (debounce already handles live filtering).

### Failure Mode 3: Model Filter Has No UI

- **Trigger**: Any user wanting to filter by model
- **Symptoms**: The model filter chip appears (if set via URL), the filter logic works, but there is no dropdown in the toolbar to select a model
- **Impact**: Critical — a stated requirement (item 6 of task description) is fully absent from the template
- **Current Handling**: Backend logic complete, template absent
- **Recommendation**: Add a model filter dropdown to the toolbar-filters section, following the same pattern as status/type/priority dropdowns.

### Failure Mode 4: DOM Leak on Component Destroy During Screen Reader Announcement

- **Trigger**: User changes a filter and immediately navigates away within 1000ms
- **Symptoms**: `document.body.removeChild(announcement)` throws `DOMException: Node was not found` in the console. In a strict CSP environment this could surface as an unhandled error.
- **Impact**: Moderate — runtime exception on navigate-away, DOM node leak if the throw is caught silently
- **Current Handling**: No guard before `removeChild`. No cleanup on `destroyRef.onDestroy`.
- **Recommendation**: Replace `document.body.removeChild(announcement)` with `announcement.remove()` (no-op if already detached) and register the timeout ID with `destroyRef` for cancellation.

### Failure Mode 5: Escape Key Navigates to Task Detail

- **Trigger**: User presses Escape anywhere on a task row
- **Symptoms**: Browser navigates to `/project/task/:id` — opposite of user intent
- **Impact**: Serious — destructive keyboard behavior with no undo
- **Current Handling**: `(keydown.escape)="onTaskClick(task)"` is explicitly bound on `.task-row` and `.kanban-card`
- **Recommendation**: Remove the `keydown.escape` binding from both task row and kanban card. Escape should not trigger navigation.

### Failure Mode 6: Whitespace-Only Search Desynchronizes Result Count Display

- **Trigger**: User types spaces in the search input
- **Symptoms**: `resultCountText()` (used in `computed`) trims and sees empty query, showing "Showing all N tasks". Template's `@if (searchQuery())` sees non-empty string (truthy), shows "matching" banner. Two count displays show inconsistent messages simultaneously.
- **Impact**: Moderate — confusing UX, no data loss
- **Current Handling**: `resultCountText` trims but template does not
- **Recommendation**: Template condition should match the service: `@if (searchQuery().trim())`.

### Failure Mode 7: All Dropdowns Open Simultaneously

- **Trigger**: Click Status, then click Type without closing Status first
- **Symptoms**: Both dropdowns render open at once, overlapping each other. No outside-click dismissal.
- **Impact**: Serious UX — visually broken, no standard escape path other than clicking each button
- **Current Handling**: Three independent boolean signals with no mutual exclusion
- **Recommendation**: Toggle methods should close other dropdowns: `this.typeDropdownOpen.set(!this.typeDropdownOpen()); this.statusDropdownOpen.set(false); this.priorityDropdownOpen.set(false)`. Also add a global click handler that closes all dropdowns when clicking outside `.filter-dropdown`.

### Failure Mode 8: Invalid URL Params Silently Zero Out Results

- **Trigger**: User navigates to `?status=INVALID_STATUS` or a bookmark becomes stale after a status rename
- **Symptoms**: `selectedStatuses` is set to `['INVALID_STATUS']`. Status filter runs, no task matches, user sees "No tasks match your filters" with no indication that the URL is malformed. The "Clear all filters" button is the only escape.
- **Impact**: Serious — data appears missing, user has no diagnostic information
- **Current Handling**: No URL param validation in `initializeFromURL()`
- **Recommendation**: Validate each URL param value against the allowed set before applying it. Silently drop unknown values.

### Failure Mode 9: Auto-Pilot State Stuck in 'starting'

- **Trigger**: Auto-Pilot polling receives a status other than `'running'` (e.g., `'stopped'`, `'queued'`, `'unknown'`)
- **Symptoms**: `autoPilotState` stays as `'starting'` indefinitely. Button remains disabled. No timeout or escape.
- **Impact**: Serious — UI is permanently locked until page reload
- **Current Handling**: `startPolling` only transitions to `'running'` or `'starting'`; there is no terminal non-running state handler
- **Recommendation**: Add a timeout (e.g., 30s) after which stuck `'starting'` reverts to `'idle'` with an error message. Also handle non-`'running'` terminal statuses explicitly.

### Failure Mode 10: clearAllFilters Triggers 7 Router Navigations

- **Trigger**: User clicks "Clear All" button
- **Symptoms**: 7 sequential `router.navigate()` calls are queued. Functionally correct but creates unnecessary thrashing. If `skipLocationChange: true` is later removed, this produces 7 history entries.
- **Impact**: Moderate — performance and history pollution
- **Current Handling**: `clearAllFilters()` calls 6 individual clear methods (each calling `updateURL()`) then calls `updateURL()` again at the end
- **Recommendation**: Reset all signals first (without calling `updateURL()` from each individual clear), then call `updateURL()` once at the end. Split the signal-setting part from the URL-update part.

---

## Critical Issues

### Critical Issue 1: `skipLocationChange: true` Breaks URL Persistence

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:888`
- **Scenario**: Any filter change — user selects a status, types a search term, sets a date range
- **Impact**: URL never reflects filter state. Acceptance criterion "Filter state reflected in URL query params" is not met. Sharing or bookmarking gives unfiltered view.
- **Evidence**:
  ```typescript
  void this.router.navigate([], {
    relativeTo: this.route,
    queryParams: params,
    replaceUrl: true,
    skipLocationChange: true, // This prevents URL from updating
  });
  ```
- **Fix**: Remove `skipLocationChange: true`. The flags `replaceUrl: true` and `skipLocationChange: true` are mutually contradictory — `skipLocationChange` wins and prevents any location update.

### Critical Issue 2: Search Input Clears on Space and Enter Keypress

- **File**: `apps/dashboard/src/app/views/project/project.component.html:69-71`
- **Scenario**: User types "search term" — pressing space after a word erases the query
- **Impact**: Fundamental text input is broken for multi-word searches
- **Evidence**:
  ```html
  (keydown.escape)="clearSearch()"
  (keydown.enter)="clearSearch()"
  (keydown.space)="clearSearch()"
  ```
- **Fix**: Remove `(keydown.enter)` and `(keydown.space)` bindings. Keep only `(keydown.escape)="clearSearch()"`.

### Critical Issue 3: Model Filter UI Is Missing From Template

- **File**: `apps/dashboard/src/app/views/project/project.component.html` (entire filter section)
- **Scenario**: User wants to filter by model — impossible through the UI
- **Impact**: Task requirement 6 ("Model Filter — Filter by assigned model") is unimplemented in the UI
- **Evidence**: Searching the entire template for `toggleModel`, `availableModels`, `isModelSelected` yields zero results. The filter dropdowns section contains only Status, Type, Priority, and Date Range.
- **Fix**: Add a model filter dropdown following the same pattern as the existing Status/Type/Priority dropdowns.

---

## Serious Issues

### Serious Issue 1: Escape Key on Task Row Triggers Navigation

- **File**: `apps/dashboard/src/app/views/project/project.component.html:369` and `:454` (kanban)
- **Scenario**: User presses Escape while a task row has focus
- **Impact**: Unwanted navigation to task detail page; no undo
- **Fix**: Remove `(keydown.escape)="onTaskClick(task)"` from `.task-row` and `.kanban-card`.

### Serious Issue 2: No URL Param Validation in initializeFromURL

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:892-912`
- **Scenario**: Stale bookmark, manually crafted URL, or future status rename
- **Impact**: Silent zero results with no user-visible diagnosis
- **Fix**: Validate each parsed value against the allowed set (e.g., `KANBAN_COLUMNS`) before setting.

### Serious Issue 3: No Mutual Exclusion Between Filter Dropdowns

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:329-339` (toggle methods)
- **Scenario**: User clicks two dropdown buttons in sequence
- **Impact**: Multiple overlapping open dropdowns; no click-outside close
- **Fix**: Toggle methods should close sibling dropdowns. Add a document click handler for outside-click dismissal, cleaned up via `destroyRef`.

### Serious Issue 4: Auto-Pilot State Machine Has No Timeout / Escape from 'starting'

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:916-930`
- **Scenario**: API returns an unexpected status value
- **Impact**: Button permanently disabled until page reload
- **Fix**: Add a maximum polling duration (e.g., 30s) and a fallback transition to `'idle'` with error message.

### Serious Issue 5: DOM Leak / Exception in announceToScreenReader on Navigate-Away

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:509-521`
- **Scenario**: Filter changed, then user navigates away within 1 second
- **Impact**: `DOMException: Node was not found` thrown from `document.body.removeChild`
- **Fix**: Use `announcement.remove()` (idempotent) and cancel the timeout in `destroyRef.onDestroy`.

---

## Moderate Issues

### Moderate Issue 1: `testModelFilter` Validation Logic Is Wrong

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:633`
- **Scenario**: Any call to `testModelFilter` where dataset contains tasks with `model === null`
- **Impact**: Test method always returns true for null-model tasks regardless of selected filter, masking real behavior
- **Evidence**: `models.includes(task.model || '') || task.model === null` — the second condition is unconditionally true for null-model tasks

### Moderate Issue 2: Production console.warn in applyFiltersAndSort

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:165-167`
- **Scenario**: Any filter operation on a medium-to-large task list
- **Impact**: Debug logging shipped to production; noise in prod console
- **Fix**: Remove or gate behind a development-only flag.

### Moderate Issue 3: clearAllFilters Triggers 7 Router Navigations

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:493-501`
- **Impact**: Unnecessary router thrashing; will pollute history if `skipLocationChange` is corrected
- **Fix**: Reset signals first, call `updateURL()` once.

### Moderate Issue 4: Date Filter Uses UTC Midnight, Not Local Date

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:146-152`
- **Impact**: Tasks may appear in or out of date range depending on user's timezone, producing wrong results for non-UTC users
- **Fix**: Parse date strings as local midnight by appending `T00:00:00` before constructing the `Date`.

---

## Data Flow Analysis

```
User types in search
  → onSearchInput() → searchInput$ Subject
  → debounce(300ms) + distinctUntilChanged()
  → searchQuery.set(query)
  → updateURL()                              [BROKEN: skipLocationChange prevents URL write]
  → filteredTasks computed reacts
  → applyFiltersAndSort() runs
    → query filtered against id/title/description (OR)
    → status/type/priority/model filtered (OR per dimension, AND across dimensions)
    → date range filtered (AND)             [CONCERN: UTC midnight vs local date]
    → sortTasks() applied
  → template re-renders

User loads page with query params
  → ngOnInit → initializeFromURL()
  → snapshot queryParamMap read (one-time, not reactive)  [CONCERN: no validation of values]
  → signals set → filteredTasks reacts → correct initial filter applied

Filter chip removed
  → removeChip(chip) → chip.clear() [sets signal to []]
  → updateURL()                              [BROKEN: see above]

All filters cleared
  → clearAllFilters()
  → clearSearch() → updateURL()             [navigation 1]
  → clearStatusFilter() → updateURL()       [navigation 2]
  → clearTypeFilter() → updateURL()         [navigation 3]
  → clearPriorityFilter() → updateURL()     [navigation 4]
  → clearModelFilter() → updateURL()        [navigation 5]
  → clearDateRange() → updateURL()          [navigation 6]
  → updateURL()                             [navigation 7]
```

### Gap Points Identified:
1. URL write path is broken — `skipLocationChange: true` prevents any location update
2. URL read path (initializeFromURL) has no validation — invalid enum values enter the signal system
3. Model filter has no read path from UI — the only write path to `selectedModels` is programmatic or via URL

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| Search bar filters by ID, title, description with debounce | PARTIAL | Logic correct; keydown.space and keydown.enter break multi-word search |
| Status/type/priority/date filters work independently and in combination | COMPLETE | Logic correct; OR per dimension, AND across dimensions |
| Active filters shown as removable chips | COMPLETE | Chips render and clear correctly |
| Filter state reflected in URL query params | FAIL | `skipLocationChange: true` prevents URL from ever updating |
| Sort by all available columns | COMPLETE | All 5 sort fields implemented correctly |
| Model filter (task description item 6) | PARTIAL | Backend logic complete; no UI exposed in template |

### Implicit Requirements NOT Addressed:
1. Close filter dropdowns on outside click — standard dropdown UX contract
2. Keyboard navigation inside `role="listbox"` dropdowns — ARIA listbox role requires arrow key navigation
3. URL params should be validated on load — stale/malformed bookmarks produce silent zero-results
4. Date filter should respect local timezone, not UTC midnight
5. Auto-Pilot state machine needs a timeout guard

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Empty search string | YES | `if (query)` guard skips filter | Whitespace-only string not trimmed in template condition |
| No tasks matching all filters | YES | Empty state with "Clear all filters" button | None |
| All filters active simultaneously | YES | filterFunctions.every() chains all | Correct AND-across-dimensions logic |
| Invalid URL param values | NO | Raw cast to enum type | Silent zero-results, no user feedback |
| Space/Enter in search input | NO | keydown bindings clear the search | Breaks multi-word search entirely |
| Escape on task row | NO | keydown.escape navigates to task detail | Opposite of expected behavior |
| Component destroyed mid-setTimeout | NO | announceToScreenReader timeout fires after destroy | DOMException thrown |
| Multiple dropdowns open | NO | No mutual exclusion | All dropdowns can be open simultaneously |
| Whitespace-only search | PARTIAL | Filter logic trims correctly | Template count display does not trim |
| Date filter with non-UTC timezone | NO | UTC midnight used for date boundary | Wrong results for most of world |
| Unknown sort field from URL | PARTIAL | Cast to SortField type | compareTasks switch has no default branch; unknown field returns cmp=0 (silent no-op) |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| Angular Router URL write | HIGH (confirmed bug) | Filter sharing/bookmarking impossible | Remove skipLocationChange |
| ActivatedRoute snapshot (one-time read) | LOW | Stale if query params change without navigation | Acceptable for this use case |
| document.body DOM manipulation in announceToScreenReader | MED | DOMException on navigate-away | Add contains() guard + clearTimeout on destroy |
| apiService.startAutoPilot / getAutoPilotStatus | MED | State stuck in 'starting' | Add polling timeout |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: `skipLocationChange: true` on line 888 makes the URL persistence acceptance criterion entirely non-functional. This is the literal inverse of the feature requirement and must be fixed before any approval.

**Second Risk**: `keydown.space` and `keydown.enter` clearing the search input mean multi-word searches are impossible — a user cannot type "fix pagination" without the space keystroke erasing the query.

**Third Risk**: The model filter UI is entirely absent from the template despite the logic being implemented, the requirement being explicit in the task description, and the model chip appearing in the active filters row if set via URL.

## What Robust Implementation Would Include

- `updateURL()` without `skipLocationChange`, so the address bar reflects filter state
- URL param validation in `initializeFromURL()` against the typed union sets before applying
- A single signal update path with one deferred `updateURL()` call (not one per filter operation)
- Mutual-exclusion dropdown toggle logic and a click-outside handler using `fromEvent(document, 'click')` with `takeUntilDestroyed`
- Local-date-boundary date range parsing instead of UTC midnight
- Removal of `keydown.space` and `keydown.enter` from the search input
- Removal of `keydown.escape` from task rows (navigation on escape is destructive)
- A model filter dropdown in the template to expose the already-implemented model filter logic
- `announceToScreenReader` using `announcement.remove()` with timeout ID registered on `destroyRef`
- Auto-Pilot polling with a maximum-duration timeout and clean state-machine transitions

---

| Verdict | FAIL |
|---|---|
