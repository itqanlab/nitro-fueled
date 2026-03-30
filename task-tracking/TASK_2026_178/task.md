# Task: Add OnPush Change Detection to All Angular Components

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | REFACTORING |
| Priority              | P3-Low      |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | optional    |

## Description

Add `changeDetection: ChangeDetectionStrategy.OnPush` to all Angular components in the dashboard application that are missing it. This was flagged in 11 task reviews (079, 081, 082, 083, 084, 115, 147, 148, 153, 155) and has been added as a review lesson in frontend.md. OnPush prevents unnecessary re-renders and improves performance.

Components using OnPush must rely on signal inputs, observables with `async` pipe, or explicit `markForCheck()` — verify each component's data flow is compatible before adding OnPush.

## Dependencies

- None

## Acceptance Criteria

- [ ] All Angular components have `changeDetection: ChangeDetectionStrategy.OnPush` in their `@Component` decorator
- [ ] No broken change detection (all views still render correctly)
- [ ] Components with incompatible patterns (mutable state, imperative updates) are refactored to use signals or `markForCheck()`

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Recurring Pattern
- Review lesson: `.claude/review-lessons/frontend.md` — Change Detection section

## File Scope

- apps/dashboard/src/app/views/**/*.ts
- apps/dashboard/src/app/shared/**/*.ts

## Parallelism

⚠️ MUST RUN ALONE — touches all component `.ts` files; conflicts with every dashboard feature task
Suggested wave: Run in isolation window, no concurrent dashboard tasks
