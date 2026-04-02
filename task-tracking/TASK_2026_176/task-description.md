# Task Description — TASK_2026_176

## Summary

Replace 3 deprecated `*ngIf` structural directive usages in `project.component.html` with Angular 19's built-in `@if` control flow syntax. This is a recurring anti-pattern flagged in 7 prior task reviews (079, 081, 082, 083, 084, 085, 155).

## Scope

After scanning all 46 `.html` template files across `apps/dashboard/src/app/`, only **one file** contains deprecated directives:

| File | Occurrences | Directive |
|------|-------------|-----------|
| `apps/dashboard/src/app/views/project/project.component.html` | 3 | `*ngIf` |

All other templates already use the new `@if`/`@for` control flow syntax. The `project.component.html` file already uses `@for` internally (for status, type, and priority dropdown options), confirming the new syntax is supported and enabled.

## Context

- **Angular version**: 19.2.20 — new control flow (`@if`, `@for`, `@switch`) has been stable since Angular 17
- **Component type**: Standalone (`standalone: true`, `ChangeDetectionStrategy.OnPush`)
- **Current imports**: `[FormsModule, NgClass, SessionsPanelComponent]` — `NgIf` is **not** imported
- The 3 `*ngIf` directives on `<span class="filter-dropdown-count">` elements are using a directive that is not in the component's imports array — this is a latent compile risk
- New `@if` control flow requires no additional imports in standalone components

## Affected Lines

All 3 occurrences are `<span class="filter-dropdown-count">` elements rendered only when the respective filter count > 0:

- Line 178: `*ngIf="statusSelectedCount() > 0"`
- Line 220: `*ngIf="typeSelectedCount() > 0"`
- Line 262: `*ngIf="prioritySelectedCount() > 0"`

## Acceptance Criteria

- [ ] Zero instances of `*ngIf` in `project.component.html`
- [ ] Each `*ngIf` replaced with equivalent `@if` block
- [ ] Application compiles without errors
- [ ] No `NgIf` import added (not needed — new control flow is built-in)
- [ ] No functional behavior changes

## Approach

Manual replacement (3 occurrences — running the Angular schematic is overkill for 3 lines). Each `*ngIf="expr"` attribute on a `<span>` becomes an `@if (expr) { <span> ... </span> }` block wrapping the element.
