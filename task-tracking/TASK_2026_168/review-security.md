# Security Review — TASK_2026_168

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 7/10                                 |
| Assessment       | NEEDS_REVISION                       |
| Critical Issues  | 0                                    |
| Serious Issues   | 2                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 4                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | URL query params cast to typed enums without runtime validation; sort value split without boundary check |
| Path Traversal           | PASS   | No file system operations in these files |
| Secret Exposure          | PASS   | No credentials, API keys, or tokens present |
| Injection (shell/prompt) | PASS   | No shell execution; DOM manipulation uses `.textContent`, not `.innerHTML`; Angular template escaping covers all bindings |
| Insecure Defaults        | FAIL   | Public test methods with side effects (window mutation, filter state mutation) shipped on production class |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: Unvalidated URL Query Parameters Cast Directly to Typed Enums

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:895-911`
- **Problem**: `initializeFromURL` reads six query parameters from the URL and casts them directly to typed unions and enums with `as QueueTaskStatus[]`, `as QueueTaskType[]`, `as QueueTaskPriority[]`, `as SortField`, `as SortDirection`, and `as QueueViewMode`. No allowlist check, pattern validation, or membership test is performed before setting the signals.
- **Impact**: A crafted URL (e.g., `?status=<script>&type=foo&sort=__proto__&dir=../../`) sets arbitrary strings into application signals. Those strings flow into Set lookups, `localeCompare` calls, URL reconstruction via `updateURL`, and back into `aria-label` attribute bindings. Angular's interpolation escaping prevents XSS in text nodes, but:
  1. Values propagated back into URL query params via `updateURL` can produce a persistent malformed URL distributed as a bookmark.
  2. `STATUS_ORDER[a.status]` and `PRIORITY_ORDER[a.priority]` (lines 180, 182) will return `undefined` for unrecognized values, making subtraction produce `NaN` and causing unpredictable sort behavior.
  3. `statusLabelMap[status]` (line 235) will return `undefined` for an unknown status, which Angular will render as an empty string — silently hiding the filter chip label.
  4. An unrecognized `view` value (e.g., `?view=admin`) will set `viewMode` to `'admin'` and both `@if (viewMode() === 'list')` and `@if (viewMode() === 'kanban')` blocks will be skipped, rendering a blank task area with no user-facing explanation.
- **Fix**: After reading each param, validate the value against the known set before calling `.set()`. Use a membership check: `const VALID_STATUSES = new Set<string>(KANBAN_COLUMNS); if (VALID_STATUSES.has(v)) ...` for each enum type. Discard or ignore any value that is not in the allowlist.

### Issue 2: Sort Value Split Without Boundary Validation

- **File**: `apps/dashboard/src/app/views/project/project.component.ts:344-348`
- **Problem**: `onSortChange` reads `event.target.value`, splits it on `'-'`, and casts the two parts to `[SortField, SortDirection]` with no length or membership check:
  ```
  const [field, direction] = value.split('-') as [SortField, SortDirection];
  ```
  A `<select>` value string such as `id-asc-injected` or `createdAt-asc` (three segments) will set `field = 'createdAt'` and `direction = 'asc'` correctly by destructuring, but `field = 'createdAt'` is not a valid enum entry — the enum uses `SortField.CREATED_AT = 'createdAt'`. More critically, the `optgroup`/`option` values in the template use `{{ opt.value }}-asc` where `opt.value` is a `SortField` enum member, so the template path is safe. However, if a URL param `?sort=__proto__` is present, `initializeFromURL` (line 909) sets `sortField` to `'__proto__'` via `params.get('sort') as SortField` before `onSortChange` ever runs — so the split issue is secondary to Issue 1. The two vulnerabilities share the same root cause and fix.
- **Impact**: `STATUS_ORDER['__proto__']` and `PRIORITY_ORDER['__proto__']` would return `undefined`, producing `NaN` comparisons in the sort, silently scrambling the task list order with no visible error.
- **Fix**: Validate that the parsed `field` value is a member of `Object.values(SortField)` and that `direction` is `'asc'` or `'desc'` before setting the signals. Reject and reset to defaults if either fails.

## Minor Issues

- **Public test methods with state side effects on the production class** (`project.component.ts:555-843`): Twelve `public test*` methods are attached to the production component. `testResponsiveDesign()` at line 829 calls `window.innerWidth = 768`, mutating a read-only browser property (this silently fails in strict mode or throws in some environments). `testFullTextSearch`, `testStatusFilter`, `testPriorityFilter`, `testURLPersistence`, etc. all mutate signal state as a side effect of calling them. Because they are `public`, they are accessible from browser DevTools, Angular test harnesses, or any directive/parent component that holds a reference. They should be moved to a separate spec file or removed from the production class entirely.

- **Performance telemetry leaked to browser console** (`project.component.ts:165-167`): `console.warn(\`Filter operation took ${duration.toFixed(2)}ms for ${tasks.length} tasks\`)` is inside a branch that fires whenever filtering takes more than 50ms. This leaks the task dataset size to the browser console, which is visible to any user who opens DevTools. In a project management dashboard where task counts may be confidential, this is an information disclosure concern. The comment says "can be removed in production" but there is no build-time guard — it fires in production builds.

- **`as` type cast on `HTMLInputElement` without `instanceof` check** (`project.component.ts:429, 435`): `(event.target as HTMLInputElement).value` in `onStartDateChange` and `onEndDateChange` uses an unchecked cast. If the event were somehow dispatched from a non-input element (e.g., a programmatic `dispatchEvent` from a test), `.value` would return `undefined` and `startDate` would be set to `null` silently. The same pattern is already used safely on line 371 with an `instanceof HTMLInputElement` guard. Apply the same guard here for consistency.

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Unvalidated URL query parameters are cast directly to enum types without membership checks. An unknown `status`, `sort`, or `view` value set via a crafted URL silently corrupts application state — producing `NaN` sort comparisons, blank render areas, and malformed bookmarkable URLs — with no error surfaced to the user.

| Verdict | NEEDS_REVISION |
|---------|---------------|
