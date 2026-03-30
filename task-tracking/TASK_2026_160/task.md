# Task: Shared UI Lib — Badge, Status Indicator, Empty State Components

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | REFACTORING    |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Part 1 of 3 — original request: Shared UI Component Library.

Extract the most frequently duplicated UI patterns into shared components. These 3 components are used 5+ times across views and currently have inconsistent inline implementations.

**Components to create:**

1. **BadgeComponent** (`shared/badge/`)
   - Inputs: `label: string`, `variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'`, `size: 'sm' | 'md'`
   - Supports type badges (api/oauth/cli/feature/bugfix/refactor/docs), status badges (success/warning/error), version badges, count badges
   - Uses existing CSS variables: `--success`, `--warning`, `--error`, `--accent`
   - Replace inline badge HTML in: dashboard, analytics, new-task, providers, agent-editor, mcp views

2. **StatusIndicatorComponent** (`shared/status-indicator/`)
   - Inputs: `status: 'running' | 'completed' | 'paused' | 'failed' | 'offline'`, `pulse: boolean`, `size: 'sm' | 'md'`
   - Colored dot with optional pulse animation for active/running states
   - Uses existing CSS variables: `--running`, `--completed`, `--paused`, `--failed`
   - Replace inline status dots in: dashboard, analytics, mcp, providers views

3. **EmptyStateComponent** (`shared/empty-state/`)
   - Inputs: `icon: string`, `message: string`, `actionLabel?: string`
   - Outputs: `action: EventEmitter<void>`
   - Centered placeholder with icon, message text, optional action button
   - Replace inline empty state divs in: settings, dashboard views

**After creating components:** Update 2-3 existing views to use the new shared components as proof of adoption (dashboard + one other).

## Dependencies

- None

## Acceptance Criteria

- [ ] BadgeComponent supports status, type, version, and count variants
- [ ] StatusIndicatorComponent renders colored dots with optional pulse animation
- [ ] EmptyStateComponent displays icon, message, and optional action button
- [ ] At least 2 existing views are refactored to use the new shared components
- [ ] Components use existing CSS theme variables (no hardcoded colors)

## References

- Existing shared components: `apps/dashboard/src/app/shared/stat-card/`, `apps/dashboard/src/app/shared/task-card/`
- Global theme variables: `apps/dashboard/src/styles.scss`
- Badge usage examples: `apps/dashboard/src/app/views/analytics/analytics.component.html`, `apps/dashboard/src/app/views/providers/provider-card/provider-card.component.html`
- Status dot examples: `apps/dashboard/src/app/views/dashboard/dashboard.component.html`, `apps/dashboard/src/app/views/mcp/mcp-integrations.component.html`

## File Scope

- `apps/dashboard/src/app/shared/badge/badge.component.ts` (new)
- `apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts` (new)
- `apps/dashboard/src/app/shared/empty-state/empty-state.component.ts` (new)
- `apps/dashboard/src/app/views/dashboard/dashboard.component.html` (modified — adopt shared components)
- `apps/dashboard/src/app/views/dashboard/dashboard.component.ts` (modified — import shared components)
- `apps/dashboard/src/app/views/analytics/analytics.component.html` (modified — adopt badge)

## Parallelism

✅ Can run in parallel — creates new shared/ files, only modifies dashboard and analytics views which don't overlap with other CREATED tasks' file scopes.
