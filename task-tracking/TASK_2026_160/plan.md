# Implementation Plan — TASK_2026_160

## Architecture Overview

Create 3 standalone shared components following the existing patterns established by `stat-card/` and `task-card/`:
- Standalone components with inline template/styles
- `@Input()` decorators for configuration
- CSS variables from `styles.scss` for theming
- `@if`/`@for` block syntax (Angular 17+)

## Component Design

### 1. BadgeComponent (`shared/badge/badge.component.ts`)
- Inputs: `label: string`, `variant: BadgeVariant`, `size: BadgeSize`
- Types: `BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'`, `BadgeSize = 'sm' | 'md'`
- CSS classes driven by variant via `[ngClass]`
- Rounded pill shape matching existing badge patterns

### 2. StatusIndicatorComponent (`shared/status-indicator/status-indicator.component.ts`)
- Inputs: `status: StatusType`, `pulse: boolean`, `size: StatusSize`
- Types: `StatusType = 'running' | 'completed' | 'paused' | 'failed' | 'offline'`, `StatusSize = 'sm' | 'md'`
- Colored dot with CSS pulse animation for running state
- Uses `--running`, `--completed`, `--paused`, `--failed` CSS variables

### 3. EmptyStateComponent (`shared/empty-state/empty-state.component.ts`)
- Inputs: `icon: string`, `message: string`, `actionLabel: string`
- Output: `actionEvent: EventEmitter<void>`
- Centered layout with icon, message, optional action button

## Adoption Plan

### Dashboard view (dashboard.component.html)
- Replace inline `.empty-state` divs with `<app-empty-state>`
- Replace inline `.session-status-indicator` with `<app-status-indicator>`

### Analytics view (analytics.component.html)
- Replace inline `.status-dot` with `<app-status-indicator>`
- Replace inline `.badge` spans with `<app-badge>`

## File Impact
- 3 new files in `shared/`
- 2 modified view files (dashboard + analytics)
- Types defined inline in each component file (following existing pattern)
