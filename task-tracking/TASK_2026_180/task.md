# Task: Migrate @Input/@Output Decorators to Signal-Based input()/output()

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | REFACTORING |
| Priority              | P2-Medium   |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | optional    |

## Description

Migrate all remaining `@Input()` and `@Output()` decorator-based inputs/outputs to Angular's signal-based `input()` and `output()` functions. The decorator pattern is deprecated in Angular 17+. Currently 7 components still use the old pattern (17 decorator occurrences total), while 6+ components have already been migrated and serve as reference implementations.

This migration is a prerequisite for clean OnPush change detection (TASK_2026_178) — signal inputs work natively with OnPush without needing `markForCheck()`.

## Dependencies

- None (but should complete before TASK_2026_178)

## Acceptance Criteria

- [ ] Zero `@Input()` decorator imports or usages in dashboard source files
- [ ] Zero `@Output()` decorator imports or usages in dashboard source files
- [ ] All replaced with `input()`, `input.required()`, or `output()` from `@angular/core`
- [ ] Template bindings updated to use signal syntax where needed
- [ ] Application compiles and renders correctly

## References

- Retrospective: RETRO_2026-03-30 — flagged in 3 task reviews (081, 082, 083)
- Reference implementations: `provider-card.component.ts`, `model-table.component.ts`, `strategy-selector.component.ts`

## File Scope

- apps/dashboard/src/app/shared/badge/badge.component.ts
- apps/dashboard/src/app/shared/empty-state/empty-state.component.ts
- apps/dashboard/src/app/shared/stat-card/stat-card.component.ts
- apps/dashboard/src/app/shared/status-indicator/status-indicator.component.ts
- apps/dashboard/src/app/shared/task-card/task-card.component.ts
- apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts
- apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_176 (control flow migration), TASK_2026_178 (OnPush migration), or TASK_2026_161-162 (shared UI lib tasks that touch shared components)
Suggested wave: Wave 2, after shared UI lib tasks complete; before TASK_2026_178
