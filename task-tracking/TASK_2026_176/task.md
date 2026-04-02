# Task: Replace Deprecated *ngIf/*ngFor with @if/@for Control Flow

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

Replace all deprecated `*ngIf`, `*ngFor`, and `*ngSwitch` structural directives with Angular's built-in `@if`, `@for`, `@switch` control flow syntax across the entire dashboard application. This was flagged in 7 task reviews (079, 081, 082, 083, 084, 085, 155) as a recurring pattern. Angular 19 supports the new syntax natively and the old directives are deprecated.

Use `ng generate @angular/core:control-flow-migration` if available, or perform manual replacement.

## Dependencies

- None

## Acceptance Criteria

- [ ] Zero instances of `*ngIf` in any `.html` template file
- [ ] Zero instances of `*ngFor` in any `.html` template file
- [ ] Zero instances of `*ngSwitch` in any `.html` template file
- [ ] All `@for` blocks use a stable `track` expression (not `$index` unless appropriate)
- [ ] Application compiles and renders correctly after migration

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Proposed Lessons
- Angular docs: Control flow migration guide

## File Scope

- apps/dashboard/src/app/views/project/project.component.html

## Parallelism

⚠️ MUST RUN ALONE — touches template files across all dashboard views; conflicts with every dashboard feature task (TASK_2026_151, 156-171)
Suggested wave: Run in isolation window, no concurrent dashboard tasks
