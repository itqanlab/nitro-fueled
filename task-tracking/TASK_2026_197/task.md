# Task: Prevent get_tasks(status: "COMPLETE") Overflow in Supervisor

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P2-Medium   |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

The supervisor calls `get_tasks(status: "COMPLETE")` to verify task completion, returning 395k characters (all 142+ complete tasks). This overflows the MCP response limit, wastes tokens, and fills context.

Fix:
1. The supervisor should never call `get_tasks(status: "COMPLETE")` — it only needs to check if a specific task is complete
2. Use `get_task_context(task_id)` for single-task status checks instead
3. Add a `limit` parameter to `get_tasks` to cap results (e.g., `limit: 10`)
4. Or add a `count_tasks` MCP tool that returns only counts by status without full task data

## Dependencies

- None

## Acceptance Criteria

- [ ] Supervisor no longer calls `get_tasks(status: "COMPLETE")`
- [ ] Single-task completion checks use `get_task_context` or `update_task` response
- [ ] `get_tasks` supports a `limit` parameter
- [ ] No MCP response overflow errors in supervisor loop

## Parallelism

✅ Can run in parallel — supervisor logic + MCP tool enhancement.

## References

- Auto-pilot trace: get_tasks COMPLETE returned 395k chars
- Cortex MCP: `packages/mcp-cortex/src/tools/tasks.ts`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`

## File Scope

- packages/mcp-cortex/src/tools/tasks.ts (add limit param)
- .claude/skills/auto-pilot/SKILL.md (use get_task_context for checks)
