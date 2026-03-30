# Implementation Plan — TASK_2026_176

## Approach

Manual replacement of 3 `*ngIf` directives in a single file. No schematic migration needed. No imports to add or remove.

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `apps/dashboard/src/app/views/project/project.component.html` | 178, 220, 262 | Replace `*ngIf` attribute with `@if` block wrapper |

**Total: 1 file, 3 changes**

## Migration Pattern

For each occurrence, the inline attribute form:
```html
<span class="filter-dropdown-count" *ngIf="someExpr()">
  {{ someExpr() }}
</span>
```

Becomes the block form:
```html
@if (someExpr()) {
  <span class="filter-dropdown-count">
    {{ someExpr() }}
  </span>
}
```

## Specific Changes

### Change 1 — Status filter count (line 178)

**Before:**
```html
<span class="filter-dropdown-count" *ngIf="statusSelectedCount() > 0">
  {{ statusSelectedCount() }}
</span>
```

**After:**
```html
@if (statusSelectedCount() > 0) {
  <span class="filter-dropdown-count">
    {{ statusSelectedCount() }}
  </span>
}
```

### Change 2 — Type filter count (line 220)

**Before:**
```html
<span class="filter-dropdown-count" *ngIf="typeSelectedCount() > 0">
  {{ typeSelectedCount() }}
</span>
```

**After:**
```html
@if (typeSelectedCount() > 0) {
  <span class="filter-dropdown-count">
    {{ typeSelectedCount() }}
  </span>
}
```

### Change 3 — Priority filter count (line 262)

**Before:**
```html
<span class="filter-dropdown-count" *ngIf="prioritySelectedCount() > 0">
  {{ prioritySelectedCount() }}
</span>
```

**After:**
```html
@if (prioritySelectedCount() > 0) {
  <span class="filter-dropdown-count">
    {{ prioritySelectedCount() }}
  </span>
}
```

## No Component TypeScript Changes

The `project.component.ts` does NOT import `NgIf` or `CommonModule`. The 3 `*ngIf` directives were technically using an unimported directive (a latent compile risk). After migration to `@if`, the templates use built-in control flow that requires no imports — no TypeScript changes needed.

## Verification

After implementing, run:
```bash
# Verify zero *ngIf remain
grep -r '\*ngIf\|\*ngFor\|\*ngSwitch' apps/dashboard/src/app --include="*.html"

# Verify Angular build compiles
nx build dashboard
```

## Key Decisions

1. **Manual over schematic**: Only 3 occurrences — running `ng generate @angular/core:control-flow-migration` would be slower and introduce untracked changes. Manual edit is faster and more auditable.
2. **No NgIf import**: Do NOT add `NgIf` to the component imports. The new `@if` syntax is built-in and import-free. Adding `NgIf` would be additive noise.
3. **Indentation style**: Match the existing template indentation style (2-space indent, `@if` block at the same level as the element it replaces).
