# Prep Handoff — TASK_2026_176

## Implementation Plan Summary

Migrate 3 `*ngIf` structural directives to `@if` control flow blocks in a single file. Angular 19.2.20, standalone component, no module system. The component's imports array does not include `NgIf` or `CommonModule` — the `*ngIf` usages are technically using an unregistered directive. Migration to `@if` fixes this implicitly (built-in control flow needs no imports). No TypeScript changes. Manual edit is the right approach (3 occurrences, schematic overkill).

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| `apps/dashboard/src/app/views/project/project.component.html` | modify | Replace 3 `*ngIf` attributes with `@if` block wrappers on lines ~178, ~220, ~262 |

## Batches

- Batch 1: Replace all 3 `*ngIf` directives in `project.component.html` — files: `apps/dashboard/src/app/views/project/project.component.html`

## Key Decisions

- **Manual replacement over Angular schematic**: Only 3 occurrences in 1 file. The `ng generate @angular/core:control-flow-migration` schematic is overkill here. Direct Edit tool changes are faster and produce a cleaner, auditable diff.
- **No NgIf import**: Do NOT add `NgIf` to the component's `imports` array. The new `@if` syntax is Angular's built-in control flow — zero imports required. Adding `NgIf` would be unnecessary and inconsistent with the rest of the codebase.
- **Indentation**: Use 2-space indent for `@if` block body, matching the existing template style. The `@if (condition) {` line sits at the same indentation level as the original `<span>` element.

## Gotchas

- The 3 `*ngIf` occurrences are all on `<span class="filter-dropdown-count">` elements inside `<button>` elements. The `@if` block wrapper must stay **inside** the `<button>` (between `<span class="filter-dropdown-label">` and `<span class="filter-dropdown-arrow">`). Do not accidentally restructure the button's children.
- Do NOT use `@if (count(); as c)` style — simply wrap with `@if (expr()) { <span>...</span> }`. The interpolation inside the span already calls the method directly.
- After editing, verify line numbers shift predictably — the 3 changes are ~40 lines apart, so each edit must account for prior line number shifts if editing sequentially.
- Run `grep -r '\*ngIf\|\*ngFor\|\*ngSwitch' apps/dashboard/src/app --include="*.html"` after the edit to confirm zero matches remain.
