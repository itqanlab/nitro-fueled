# Development Tasks — TASK_2026_162

## Batch 1: Shared UI Components + View Refactoring — COMPLETE

**Developer**: nitro-frontend-developer

### Task 1.1: Create FormFieldComponent

**File**: apps/dashboard/src/app/shared/form-field/form-field.component.ts (new)
**Status**: COMPLETE

Standalone component with `label`, `error`, `hint` inputs. Content projection for actual control.
Uses `ChangeDetectionStrategy.OnPush`, ARIA `role="alert"` for errors.

### Task 1.2: Create ExpandablePanelComponent

**File**: apps/dashboard/src/app/shared/expandable-panel/expandable-panel.component.ts (new)
**Status**: COMPLETE

Standalone component with `title`, `expanded`, `icon` inputs and `toggle` output.
Chevron rotation animation, `aria-expanded` on header button, content projection for body.

### Task 1.3: Create ButtonGroupComponent

**File**: apps/dashboard/src/app/shared/button-group/button-group.component.ts (new)
**Status**: COMPLETE

Standalone component with `options`, `selected`, `size` inputs and `selectionChange` output.
`aria-pressed` on each button, mutual exclusion via active class, `sm`/`md` size variants.

### Task 1.4: Refactor new-task.component to use new components

**File**: apps/dashboard/src/app/views/new-task/new-task.component.ts (modified)
**File**: apps/dashboard/src/app/views/new-task/new-task.component.html (modified)
**Status**: COMPLETE

Replaced inline advanced-toggle+body with `<app-expandable-panel>`. Replaced `.field-group` divs with `<app-form-field>`. Added `onAdvancedToggle` handler and component imports.

### Task 1.5: Refactor analytics.component to use ButtonGroupComponent

**File**: apps/dashboard/src/app/views/analytics/analytics.component.ts (modified)
**File**: apps/dashboard/src/app/views/analytics/analytics.component.html (modified)
**Status**: COMPLETE

Replaced period-group buttons with `<app-button-group>`. Added `periodOptions` property and `onPeriodChange` adapter method.
