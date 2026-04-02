# Code Style Review — TASK_2026_176

| Verdict | PASS |
|---------|------|

## Summary

Three `*ngIf` structural directives on `filter-dropdown-count` spans were replaced with Angular's built-in `@if` block syntax. The migration is mechanically correct, indentation is consistent with the surrounding template, no deprecated `NgIf` import was introduced, and the logic condition is preserved verbatim. The scope of the change is narrow and low-risk.

There are no blocking issues introduced by this change. Two minor observations are noted below — both are pre-existing conditions unrelated to the migration itself, but worth tracking.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

Nothing introduced by this change. The `@if` block has identical runtime semantics to `*ngIf` for simple truthy conditions. The signal call (`statusSelectedCount() > 0`) inside `@if` is already the same expression that was used in the old attribute, so no behavioural drift is possible.

### 2. What would confuse a new team member?

The template has mixed indentation levels that pre-date this change. Lines 56–57 and 131–132 show `<div class="toolbar">` and `<div class="toolbar-row toolbar-filters">` with zero indentation relative to their parent `<main class="task-queue-main">`, which itself carries 4-space indent. This creates a visually misleading nesting depth that a new developer would need to mentally reconcile. This is not introduced by TASK_2026_176 but remains a readability hazard.

### 3. What's the hidden complexity cost?

None for this change. The migration reduces complexity by removing the need to import `NgIf` from `@angular/common` and eliminating a pattern the Angular team has marked for eventual removal.

### 4. What pattern inconsistencies exist?

The file now has zero remaining `*ngIf`/`*ngFor` directives. All control flow uses the `@if`/`@for`/`@switch` block syntax, which is consistent with project standards as documented in `frontend.md` and `anti-patterns.md`.

One pre-existing inconsistency not touched by this task: `[ngClass]` is still in use at lines 360, 378, 391, 403, and 464. The project style guide does not currently mandate migration of `[ngClass]` to `@class` block alternatives, so this is not a violation, but it is worth noting as a future migration candidate.

### 5. What would I do differently?

Nothing specific to the migration itself. The approach — wrapping the `<span>` inside an `@if` block and removing the `*ngIf` attribute — is the correct pattern. The indentation (2-space, with the `@if` at the same depth as its sibling `<span>` elements) matches the surrounding template exactly.

---

## Findings

### Minor: Signal call duplicated between `[attr.aria-label]` and `@if` condition

- **File**: `apps/dashboard/src/app/views/project/project.component.html`, lines 172, 178 (and equivalents at 216/222, 260/266)
- **Observation**: `statusSelectedCount()` is called twice per render pass: once in the `[attr.aria-label]` ternary expression and once in the `@if` condition, then a third time for the interpolated value inside the block. This is three signal reads per change detection cycle per dropdown. For a signal-based component with `OnPush`, each read is cheap and memoized between renders, so this is not a correctness or performance problem in practice. However, a `computed()` exposing `statusSelectedCount()` as a named signal (e.g., `readonly hasStatusSelection = computed(() => this.statusSelectedCount() > 0)`) would reduce the template's cognitive load and be more explicit about intent.
- **Severity**: Minor. Pre-existing before this task. Not introduced by this migration.
- **Action**: Track for a future signal hygiene task.

### Minor: Pre-existing indentation inconsistency in toolbar section

- **File**: `apps/dashboard/src/app/views/project/project.component.html`, lines 56–57, 131–132
- **Observation**: `<div class="toolbar">` and `<div class="toolbar-row toolbar-filters">` are dedented to column 0 inside a `<main>` element that has 4-space indentation. This predates the current task and is not changed by it. A future maintainer editing the toolbar region may propagate the wrong indentation depth.
- **Severity**: Minor. Out of scope for this task.
- **Action**: Track for a template cleanup pass.

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `@if` / `@for` block syntax | PASS | All 3 occurrences migrated; no `*ngIf` remains |
| Indentation consistency | PASS | New `@if` blocks use 8-space indent matching siblings |
| No new NgIf import | PASS | Confirmed; no import added |
| Signal condition preserved | PASS | Condition identical to original `*ngIf` expression |
| `@else` branch absent | PASS | Original `*ngIf` had no `else`; omission is correct |

---

## Technical Debt Assessment

**Introduced**: None.
**Mitigated**: Removes three instances of a deprecated structural directive pattern. No `NgIf` import was ever present (the spans likely relied on `CommonModule` being globally available), so the import surface is unchanged.
**Net Impact**: Slight positive — moves the template fully onto the supported control flow syntax, eliminating one class of future deprecation warnings.

---

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Key Concern**: None introduced by this change. The two observations above are pre-existing and out of scope.

## What Excellence Would Look Like

A 10/10 version of this migration would accompany the `@if` syntax change with `computed()` derivations for the boolean conditions (e.g., `readonly hasStatusSelection = computed(() => this.statusSelectedCount() > 0)`), reducing signal reads in the template and improving readability. It would also address the pre-existing toolbar indentation inconsistency. Neither of these is required for the migration task to be correct and mergeable.
