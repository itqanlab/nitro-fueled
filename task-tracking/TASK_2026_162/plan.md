# Plan — TASK_2026_162

## Components to Create

### 1. FormFieldComponent (`shared/form-field/form-field.component.ts`)
Inline template + styles (same pattern as stat-card). Inputs: `label`, `error?`, `hint?`. Content projection for the actual control.

### 2. ExpandablePanelComponent (`shared/expandable-panel/expandable-panel.component.ts`)
Inline template. Inputs: `title`, `expanded`, `icon?`. Output: `toggle`. CSS animation for expand/collapse. Content projection for body.

### 3. ButtonGroupComponent (`shared/button-group/button-group.component.ts`)
Inline template. Inputs: `options: {id, label}[]`, `selected: string`, `size: 'sm'|'md'`. Output: `selectionChange`. Radio-like mutual exclusion.

## Views to Update
- `new-task.component.html` + `.ts`: Use FormFieldComponent for advanced fields, ExpandablePanelComponent for advanced section toggle
- `analytics.component.html` + `.ts`: Use ButtonGroupComponent for period selector

## Key Decisions
- provider-card has too-custom header for ExpandablePanelComponent — skip (not in acceptance criteria)
- New components use inline template/styles (consistent with existing shared/ pattern from TASK_2026_160)
- ButtonGroupComponent uses `@Input() options` not `signal` (analytics uses class properties, not signals)
- ExpandablePanelComponent uses `output()` function API (consistent with newer Angular components)
