# Development Tasks — TASK_2026_176

## Batch 1: Migrate *ngIf to @if in project.component.html — PENDING

**Developer**: nitro-frontend-developer

### Task 1.1: Replace 3 *ngIf directives with @if blocks

**File**: `apps/dashboard/src/app/views/project/project.component.html`
**Status**: PENDING

Replace the 3 `*ngIf` occurrences on `<span class="filter-dropdown-count">` elements with `@if` block wrappers:

1. Line ~178: `*ngIf="statusSelectedCount() > 0"` → `@if (statusSelectedCount() > 0) { ... }`
2. Line ~220: `*ngIf="typeSelectedCount() > 0"` → `@if (typeSelectedCount() > 0) { ... }`
3. Line ~262: `*ngIf="prioritySelectedCount() > 0"` → `@if (prioritySelectedCount() > 0) { ... }`

See `plan.md` for exact before/after diff for each change.

**No TypeScript changes needed.** Do NOT add `NgIf` to imports.

**Verification**:
```bash
grep -r '\*ngIf\|\*ngFor\|\*ngSwitch' apps/dashboard/src/app --include="*.html"
# Expected: no matches
```
