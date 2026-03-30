# Task: Shared UI Lib — Form Field, Expandable Panel, Button Group Components

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | REFACTORING    |
| Priority              | P2-Medium      |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Part 3 of 3 — original request: Shared UI Component Library.

Extract the remaining reusable components: form fields, expandable panels, and button groups. These complete the shared component library.

**Components to create:**

1. **FormFieldComponent** (`shared/form-field/`)
   - Inputs: `label: string`, `type: 'text' | 'select' | 'textarea'`, `placeholder?: string`, `error?: string`, `hint?: string`
   - Content projection for the actual input/select/textarea element
   - Wraps with consistent `.form-group` / `.form-label` styling
   - Replace inline form markup in: agent-editor metadata-panel, providers provider-card, new-task, settings

2. **ExpandablePanelComponent** (`shared/expandable-panel/`)
   - Inputs: `title: string`, `expanded: boolean`, `icon?: string`
   - Outputs: `toggle: EventEmitter<boolean>`
   - Collapsible container with animated expand/collapse, chevron icon rotation
   - Content projection for panel body
   - Replace inline expandable sections in: provider-card, new-task advanced options

3. **ButtonGroupComponent** (`shared/button-group/`)
   - Inputs: `options: Array<{ id: string, label: string }>`, `selected: string`, `size: 'sm' | 'md'`
   - Outputs: `selectionChange: EventEmitter<string>`
   - Horizontal toggle group with mutual exclusion (radio-like behavior)
   - Replace inline button groups in: analytics period selector

**After creating components:** Update agent-editor and new-task to use FormFieldComponent, update provider-card to use ExpandablePanelComponent.

## Dependencies

- TASK_2026_160 — Shared UI Lib Part 1 (establishes shared/ patterns)
- TASK_2026_161 — Shared UI Lib Part 2 (avoids shared/ file conflicts)

## Acceptance Criteria

- [ ] FormFieldComponent wraps inputs with consistent label/error/hint styling
- [ ] ExpandablePanelComponent animates expand/collapse with content projection
- [ ] ButtonGroupComponent renders toggle group with mutual exclusion
- [ ] New-task view refactored to use FormFieldComponent and ExpandablePanelComponent
- [ ] Analytics view refactored to use ButtonGroupComponent for period selector

## References

- Shared lib parts 1-2: TASK_2026_160, TASK_2026_161
- Form field usage: `apps/dashboard/src/app/views/agent-editor/metadata-panel/`, `apps/dashboard/src/app/views/new-task/`
- Expandable usage: `apps/dashboard/src/app/views/providers/provider-card/`
- Button group usage: `apps/dashboard/src/app/views/analytics/analytics.component.html`

## File Scope

- `apps/dashboard/src/app/shared/form-field/form-field.component.ts` (new)
- `apps/dashboard/src/app/shared/expandable-panel/expandable-panel.component.ts` (new)
- `apps/dashboard/src/app/shared/button-group/button-group.component.ts` (new)
- `apps/dashboard/src/app/views/new-task/new-task.component.ts` (modified — use FormField + ExpandablePanel)
- `apps/dashboard/src/app/views/providers/provider-card/provider-card.component.ts` (modified — use ExpandablePanel)
- `apps/dashboard/src/app/views/analytics/analytics.component.ts` (modified — use ButtonGroup)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_160 or TASK_2026_161 — depends on shared/ patterns and avoids file conflicts. Run in Wave 3.
