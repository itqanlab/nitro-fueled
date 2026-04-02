# Task: Remove Task .md File Generation — DB-Only Task State

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

Remove all task .md file generation from the system. The Cortex DB becomes the single source of truth for task data. No more dual file+DB sync.

**What to change:**

1. **Task Creator** (`.claude/commands/nitro-create-task.md`) — stop writing `task.md`, `status`, and folder creation. Only call `upsert_task` MCP tool. Task ID comes from DB auto-increment or `get_next_task_id`.

2. **Auto-Pilot Supervisor** (`.claude/skills/auto-pilot/SKILL.md`) — stop reading `task.md` files. Use `get_task_context` MCP tool exclusively. Stop writing `status` files. Use `upsert_task` to update state.

3. **Orchestration Skill** (`.claude/skills/orchestration/SKILL.md`) — stop reading/writing task files. Use MCP tools for all task data access.

4. **Build Workers** — ensure all worker prompts reference MCP tools for task data, not file reads.

**What to keep:**
- `task-tracking/` directory can remain for backwards compatibility but is no longer written to
- Existing task .md files are not deleted (historical reference)

**What NOT to touch:**
- `.claude/agents/*.md` — these are Claude Code's native format, not our generated files
- `.claude/skills/*/SKILL.md` — same

## Dependencies

- TASK_2026_222 — DB schema must support all task data fields first

## Acceptance Criteria

- [ ] Task creation writes to DB only, no .md files generated
- [ ] Auto-pilot reads task data from MCP only, no file reads
- [ ] Task status updates go to DB only, no status file writes
- [ ] All existing MCP task tools work as the sole data interface
- [ ] No regression in task creation or auto-pilot functionality

## References

- Current task creator: `.claude/commands/nitro-create-task.md`
- Current auto-pilot: `.claude/skills/auto-pilot/SKILL.md`
- Cortex task tools: `upsert_task`, `get_task_context`, `query_tasks`

## File Scope

- `.claude/commands/nitro-create-task.md` (modified)
- `.claude/skills/auto-pilot/SKILL.md` (modified)
- `.claude/skills/orchestration/SKILL.md` (modified)

## Parallelism

MUST RUN ALONE — modifies core orchestration files that many other tasks depend on. Run after all current CREATED tasks using these files are complete.
