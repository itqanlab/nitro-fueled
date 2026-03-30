# Task: Audit All JSON.parse Calls in mcp-cortex for try/catch Guards

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

RETRO_2026-03-30_2 found that 4 tasks (133, 138, 143, 146) hit unguarded `JSON.parse` crashes on malformed DB data. Audit all `JSON.parse` calls in `packages/mcp-cortex/src/` and wrap any unguarded ones in try/catch with safe defaults.

Fields stored as JSON strings in SQLite (dependencies, acceptance_criteria, file_scope, handoff data) can be empty strings, truncated, or legacy format. Every parse must handle this gracefully.

## Dependencies

- None

## Acceptance Criteria

- [ ] All `JSON.parse` calls in `packages/mcp-cortex/src/` wrapped in try/catch
- [ ] Parse failures return safe defaults (empty array/object) and log a warning
- [ ] No unguarded `JSON.parse` remains in any MCP tool handler

## Parallelism

✅ Can run in parallel — touches only mcp-cortex internals, no overlap with other CREATED tasks.

## References

- RETRO_2026-03-30_2 — recurring pattern across 4 tasks
- Review lesson: `.claude/review-lessons/backend.md` — MCP Tool Data Safety section

## File Scope

- packages/mcp-cortex/src/tools/
- packages/mcp-cortex/src/db/
