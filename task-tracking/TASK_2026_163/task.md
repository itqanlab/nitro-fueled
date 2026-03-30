# Task: Cortex MCP — Full Task Creation Tools (create_task, bulk_create_tasks, get_next_task_id)

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

The `/nitro-create-task` skill currently uses raw bash commands (`mkdir`, `ls`) and file writes to create tasks. The cortex MCP server has `upsert_task` for DB sync but no tool that handles the full creation flow. Add MCP tools so the skill can call one tool instead of doing manual file operations.

**Tools to add:**

1. **`create_task`** — Full lifecycle task creation:
   - Accepts: `{ title, description, type, priority, complexity, model, dependencies, acceptanceCriteria, fileScope, parallelism }`
   - Auto-generates next task ID by scanning `task-tracking/` folders (same collision-guard logic as current skill)
   - Creates `task-tracking/TASK_YYYY_NNN/` directory
   - Writes `task.md` populated from `task-tracking/task-template.md` template
   - Writes `status` file with `CREATED`
   - Upserts task into cortex SQLite DB
   - Returns `{ taskId, folder, status: 'CREATED' }`

2. **`get_next_task_id`** — Utility tool:
   - Scans `task-tracking/` for highest `TASK_YYYY_NNN` folder
   - Returns `{ nextId: 'TASK_2026_NNN' }`
   - Used by `create_task` internally and available standalone

3. **`bulk_create_tasks`** — For auto-split scenarios:
   - Accepts array of task definitions
   - Creates all tasks with sequential IDs and proper dependency wiring between them
   - Returns array of `{ taskId, folder, status }` summaries

**After building tools:** Update `.claude/commands/nitro-create-task.md` to prefer MCP `create_task` tool when available, falling back to file operations if cortex is unavailable.

## Dependencies

- None

## Acceptance Criteria

- [ ] `create_task` MCP tool creates folder, task.md, status file, and DB record in one call
- [ ] `get_next_task_id` returns correct next ID by scanning task-tracking/ folders
- [ ] `bulk_create_tasks` creates multiple tasks with sequential IDs and wired dependencies
- [ ] Collision guard: if folder exists, auto-increment ID
- [ ] `/nitro-create-task` command updated to use MCP tools when available with file fallback

## References

- Existing cortex tools: `packages/mcp-cortex/src/index.ts` (registerTool calls)
- Task template: `task-tracking/task-template.md`
- Current task creator command: `.claude/commands/nitro-create-task.md`
- Existing upsert_task tool for reference pattern

## File Scope

- `packages/mcp-cortex/src/tools/tasks.ts` (new — task creation tool implementations)
- `packages/mcp-cortex/src/index.ts` (modified — register new tools)
- `.claude/commands/nitro-create-task.md` (modified — prefer MCP tools)

## Parallelism

✅ Can run in parallel — cortex source files and the command file don't overlap with other CREATED tasks.
