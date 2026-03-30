# Task: Replace console.log/console.error with Structured Logger

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

Replace all `console.log` and `console.error` calls in production code with a structured logger (e.g., NestJS Logger, pino, or a custom wrapper). Found in 6 task reviews (086, 087, 089, 092, 110, 143) across backend, CLI, and MCP server code. Console calls provide no structured output, no log levels, and no correlation IDs.

Scope: `apps/dashboard-api/`, `apps/cli/`, `packages/mcp-cortex/`. Exclude test files and scripts.

## Dependencies

- None

## Acceptance Criteria

- [ ] Zero `console.log` or `console.error` calls in production source files (excluding tests/scripts)
- [ ] Structured logger used consistently (NestJS `Logger` for dashboard-api, appropriate choice for CLI/MCP)
- [ ] Log levels used appropriately (debug, info, warn, error)
- [ ] No loss of existing log information during migration

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Proposed Lessons
- Review files: TASK_2026_086, 087, 089, 092, 110, 143

## File Scope

- apps/dashboard-api/src/**/*.ts
- apps/cli/src/**/*.ts
- packages/mcp-cortex/src/**/*.ts

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_131, 132, 156 (dashboard-api tasks), TASK_2026_163 (mcp-cortex task)
Suggested wave: Wave 3, after active backend tasks complete
