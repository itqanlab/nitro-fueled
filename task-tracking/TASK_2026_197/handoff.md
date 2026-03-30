# Handoff - TASK_2026_197

## Files Changed
- `packages/mcp-cortex/src/tools/tasks.ts` (added `limit` argument handling and SQL `LIMIT` clause)
- `packages/mcp-cortex/src/index.ts` (added `limit` schema for `get_tasks` and `query_tasks`)
- `packages/mcp-cortex/src/tools/tasks.spec.ts` (added tests for requested and capped limits)
- `.claude/skills/auto-pilot/references/cortex-integration.md` (switched single-task checks to `get_task_context`)
- `.claude/skills/auto-pilot/references/parallel-mode.md` (explicitly avoid `get_tasks(status: "COMPLETE")`)
- `apps/cli/scaffold/.claude/skills/auto-pilot/references/cortex-integration.md` (scaffold sync)
- `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md` (scaffold sync)

## Commits
- Pending

## Decisions
- Implemented `limit` as a bounded integer (`1..200`) to prevent oversized payloads while preserving existing tool behavior.
- Kept single-task completion checks on `get_task_context(task_id)` guidance rather than broad `get_tasks(status: "COMPLETE")` calls.
- Synced guidance changes to scaffold copies to keep new project templates aligned with runtime docs.

## Known Risks
- `packages/mcp-cortex/src/index.ts` currently includes additional unrelated in-progress changes in the workspace; commit scope should remain task-focused when possible.
