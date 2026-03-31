# Task: Refactor Session-Mode Supervisor — MCP Only

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | REFACTORING |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | auto        |
| Model                 | default     |
| Testing               | optional    |
| Worker Mode           | single      |

## Description

Refactor the existing session-mode auto-pilot (Claude Code skill) to use MCP tools exclusively for all data access. Remove all .md file reads and writes. The session-mode supervisor continues to work as before, but backed entirely by DB via MCP.

**Changes:**

1. **Task discovery** — replace filesystem scanning (`ls task-tracking/`) with `query_tasks` / `get_tasks` MCP calls
2. **Task reading** — replace `read task.md` with `get_task_context` MCP call
3. **Status updates** — replace writing `status` files with `upsert_task` MCP call
4. **Handoff data** — replace writing `handoff.md` with `write_handoff` MCP call
5. **Registry** — remove all references to `registry.md`, use `query_tasks` for listings
6. **Event logging** — ensure all events go through `log_event` MCP (already partially done)

**Session mode stays as a valid way to run the supervisor.** This refactor ensures both modes (session and server) use the same data layer (Cortex DB).

## Dependencies

- TASK_2026_223 — DB-only task state (removes file generation from task creator)

## Acceptance Criteria

- [ ] Auto-pilot skill has zero filesystem reads for task data
- [ ] Auto-pilot skill has zero filesystem writes for task state
- [ ] All data access goes through MCP tools
- [ ] Session-mode auto-pilot works end-to-end with DB-only data
- [ ] No references to registry.md, status files, or task.md reads

## References

- Current auto-pilot: `.claude/skills/auto-pilot/SKILL.md`
- MCP tools: `get_task_context`, `query_tasks`, `upsert_task`, `log_event`, `write_handoff`

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` (modified)
- `.claude/skills/auto-pilot/references/` (modified — update references)

## Parallelism

MUST RUN ALONE — modifies auto-pilot skill which is a core file. Run after TASK_2026_223.
