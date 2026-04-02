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

- [x] Supervisor no longer calls `get_tasks(status: "COMPLETE")`
- [x] Single-task completion checks use `get_task_context` or `update_task` response
- [x] `get_tasks` supports a `limit` parameter
- [x] No MCP response overflow errors in supervisor loop

## Parallelism

✅ Can run in parallel — supervisor logic + MCP tool enhancement.

## References

- Auto-pilot trace: get_tasks COMPLETE returned 395k chars
- Cortex MCP: `packages/mcp-cortex/src/tools/tasks.ts`
- Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`

## File Scope

- packages/mcp-cortex/src/tools/tasks.ts (add and enforce `limit` in task queries)
- packages/mcp-cortex/src/index.ts (expose `limit` in `get_tasks` / `query_tasks` schemas)
- packages/mcp-cortex/src/tools/tasks.spec.ts (coverage for requested and capped limits)
- .claude/skills/auto-pilot/references/cortex-integration.md (single-task completion guidance)
- .claude/skills/auto-pilot/references/parallel-mode.md (avoid `get_tasks(status: "COMPLETE")` checks)
- apps/cli/scaffold/.claude/skills/auto-pilot/references/cortex-integration.md (scaffold sync)
- apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md (scaffold sync)
