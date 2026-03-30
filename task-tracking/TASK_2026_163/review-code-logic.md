# Code Logic Review — TASK_2026_163

## Review Summary

| Metric | Value |
| --- | --- |
| Files Reviewed | 4 |
| Findings | 2 |
| Verdict | FAIL |

---

## Findings

### 1. Serious: `bulk_create_tasks` invents sequential dependencies even when split tasks should be parallelizable

- **Files**:
- `packages/mcp-cortex/src/tools/task-creation.ts:463-466`
- `task-tracking/TASK_2026_163/task.md:46-48`
- `task-tracking/TASK_2026_163/task.md:68-69`
- **Why this fails**: The task requires `bulk_create_tasks` to create tasks with proper dependency wiring for auto-split scenarios. The current implementation silently adds the immediately previous created task as a dependency whenever the caller omits `dependencies`.
- **Impact**: Independent split tasks are forced into a linear chain, which changes execution order and blocks valid parallel work. That is not "proper dependency wiring"; it is unconditional serialization.
- **Evidence**: `if (createdIds.length > 0 && depsWithWiring.length === 0) { depsWithWiring.push(createdIds[createdIds.length - 1]); }` wires every later task to the previous one with no analysis of whether order actually matters.
- **Recommendation**: Only persist dependencies explicitly provided by the caller, or add an explicit wiring strategy input that distinguishes sequential splits from parallelizable splits.

### 2. Moderate: MCP task creation still allows task files with no `## Parallelism` section

- **Files**:
- `packages/mcp-cortex/src/tools/task-creation.ts:26`
- `packages/mcp-cortex/src/tools/task-creation.ts:295-297`
- `packages/mcp-cortex/src/index.ts:499`
- `packages/mcp-cortex/src/index.ts:516`
- `.claude/commands/nitro-create-task.md:82-89`
- `.claude/commands/nitro-create-task.md:113-117`
- **Why this fails**: The updated `/nitro-create-task` command now says parallelism analysis is mandatory and that every created task must include a `## Parallelism` section. But the MCP schemas keep `parallelism` optional, and `buildTaskMd()` only appends that section when a value is supplied.
- **Impact**: The documented MCP-first path can still create incomplete task artifacts that do not satisfy the command's own required output shape, especially for callers using `create_task` or `bulk_create_tasks` directly.
- **Evidence**: `parallelism?: string` remains optional in the task definition and tool schemas, and `if (def.parallelism) { content = `${content}\n\n## Parallelism\n\n${def.parallelism}`; }` skips the section entirely when omitted.
- **Recommendation**: Make `parallelism` required for both creation tools, or always emit a `## Parallelism` section with an explicit default/fallback value.

---

## Notes

- `create_task`, `bulk_create_tasks`, `get_next_task_id`, and `validate_task_sizing` are registered and reachable from `packages/mcp-cortex/src/index.ts`.
- `packages/mcp-cortex/src/db/schema.ts` already contains the task columns needed by these tools; I did not find an additional schema-level blocker in the reviewed scope.
