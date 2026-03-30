# Task: Add CANCELLED Status to All Type Unions and Switch Statements

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | optional    |

## Description

Add `CANCELLED` to every status union type, switch statement, lookup table, and template condition across the entire codebase. This status value has been flagged in 4 separate task reviews (090, 092, 147, 155) as missing — each reviewer marks it as "not introduced by this task" and it remains unfixed. Components that render status badges, filter by status, or route based on status all silently ignore CANCELLED tasks, producing incorrect counts and hidden data.

Scope: search for all `TaskStatus`, `Status`, or equivalent union/enum definitions and their consumers across `apps/dashboard/`, `apps/dashboard-api/`, `apps/cli/`, `packages/mcp-cortex/`, and `.claude/` files.

## Dependencies

- None

## Acceptance Criteria

- [ ] Every TypeScript union/enum that defines task status includes `CANCELLED`
- [ ] Every `switch` statement and lookup table that handles status has a `CANCELLED` case
- [ ] Dashboard status badge component renders CANCELLED with appropriate styling
- [ ] Dashboard filters include CANCELLED as a filterable option
- [ ] No TypeScript compiler errors after changes

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Recurring Pattern, 4 tasks
- Review files: TASK_2026_090, 092, 147, 155

## File Scope

- apps/dashboard/src/app/models/*.model.ts
- apps/dashboard/src/app/views/**/*.ts (status-related components)
- apps/dashboard-api/src/dashboard/*.ts
- packages/mcp-cortex/src/db/schema.ts
- packages/mcp-cortex/src/tools/*.ts

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_127, TASK_2026_128 (model file refactors), TASK_2026_166-171 (dashboard feature views that reference status types)
Suggested wave: Wave 1 — foundational type fix, should complete before new dashboard features
