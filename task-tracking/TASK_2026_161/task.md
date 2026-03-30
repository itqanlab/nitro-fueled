# Task: Shared UI Lib — Progress Bar, Tab Nav, Loading Spinner Components

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

Part 2 of 3 — original request: Shared UI Component Library.

Extract the second tier of reusable components: progress bars, tab navigation, and loading states. These are used 3-5 times across views.

**Components to create:**

1. **ProgressBarComponent** (`shared/progress-bar/`)
   - Inputs: `value: number` (0-100), `label?: string`, `variant: 'accent' | 'success' | 'warning' | 'error'`, `showLabel: boolean`
   - Horizontal bar with fill width bound to percentage, optional label
   - Uses existing CSS variables for colors
   - Replace inline progress bars in: task-card, analytics budget bars

2. **TabNavComponent** (`shared/tab-nav/`)
   - Inputs: `tabs: Array<{ id: string, label: string, count?: number }>`, `activeTab: string`
   - Outputs: `tabChange: EventEmitter<string>`
   - Horizontal tab list with active state styling and optional badge count per tab
   - Replace inline tab nav in: settings (4 tabs), mcp-integrations (2 tabs)

3. **LoadingSpinnerComponent** (`shared/loading-spinner/`)
   - Inputs: `size: 'sm' | 'md' | 'lg'`, `mode: 'spinner' | 'skeleton'`, `text?: string`
   - Inline spinner for buttons/loading states, skeleton mode for content placeholders
   - Replace inline spinners in: new-task, session-comparison, model-performance, phase-timing

**After creating components:** Update settings and mcp views to use TabNavComponent, update task-card to use ProgressBarComponent.

## Dependencies

- TASK_2026_160 — Shared UI Lib Part 1 (establishes shared/ component patterns)

## Acceptance Criteria

- [ ] ProgressBarComponent renders horizontal bar with percentage and variant colors
- [ ] TabNavComponent renders tabs with active state and optional count badges
- [ ] LoadingSpinnerComponent supports spinner and skeleton modes
- [ ] Settings view refactored to use TabNavComponent
- [ ] Task-card refactored to use ProgressBarComponent

## References

- Shared lib part 1: TASK_2026_160
- Tab usage: `apps/dashboard/src/app/views/settings/settings.component.html`, `apps/dashboard/src/app/views/mcp/mcp-integrations.component.html`
- Progress bar usage: `apps/dashboard/src/app/shared/task-card/task-card.component.ts`
- Spinner usage: `apps/dashboard/src/app/views/new-task/new-task.component.html`

## File Scope

- `apps/dashboard/src/app/shared/progress-bar/progress-bar.component.ts` (new)
- `apps/dashboard/src/app/shared/tab-nav/tab-nav.component.ts` (new)
- `apps/dashboard/src/app/shared/loading-spinner/loading-spinner.component.ts` (new)
- `apps/dashboard/src/app/shared/task-card/task-card.component.ts` (modified — use ProgressBarComponent)
- `apps/dashboard/src/app/views/settings/settings.component.ts` (modified — use TabNavComponent)
- `apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts` (modified — use TabNavComponent)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_160 — depends on shared/ patterns established there. Run in Wave 2.
