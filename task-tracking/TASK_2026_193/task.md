# Task: Auto-Release Orphaned Task Claims on Session Startup

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

When auto-pilot starts a new session, tasks claimed by dead/missing sessions remain locked. The supervisor currently handles this manually: claim fails → get_session → session_not_found → release_task → re-claim. This wastes 4 MCP calls per orphaned task and adds startup latency.

Add an automatic orphan release step to the supervisor startup sequence:

1. After `sync_tasks_from_files` and `reconcile_status_files`, query all tasks with `session_claimed IS NOT NULL`
2. For each claimed task, check if the claiming session exists and is still `running`
3. If session is missing (`session_not_found`) or stopped/ended → auto-release the task to its pre-claim status
4. Log each release: `[orphan-release] TASK_X released from dead session SESSION_Y`

This could also be a cortex MCP tool (`release_orphaned_claims`) that does it in one call.

## Dependencies

- None

## Acceptance Criteria

- [ ] Orphaned claims are auto-released during supervisor startup
- [ ] No manual release-reclaim cycle needed for dead session claims
- [ ] Released tasks return to their correct pre-claim status
- [ ] Orphan releases are logged

## Parallelism

✅ Can run in parallel — touches supervisor startup logic only.

## References

- Auto-pilot trace showing 3 orphaned claims requiring manual release
- Cortex MCP: `packages/mcp-cortex/src/`
- Auto-pilot skill: `.claude/skills/auto-pilot/`

## File Scope

- packages/mcp-cortex/src/tools/ (new release_orphaned_claims tool)
- .claude/skills/auto-pilot/SKILL.md (startup sequence update)
