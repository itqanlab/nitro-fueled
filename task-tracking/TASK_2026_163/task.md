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
   - **Sizing validation MANDATORY** — before creating any files, validate against `task-tracking/sizing-rules.md`:
     - Description > 150 lines → reject with `{ error: 'oversized', reason: '...', suggestion: 'use bulk_create_tasks to split' }`
     - Acceptance criteria > 5 groups → reject
     - File scope > 7 files → reject
     - Multiple unrelated functional areas → reject
   - If sizing passes: auto-generate next task ID by scanning `task-tracking/` folders (collision-guard)
   - Creates `task-tracking/TASK_YYYY_NNN/` directory
   - Writes `task.md` populated from `task-tracking/task-template.md` template
   - Writes `status` file with `CREATED`
   - Upserts task into cortex SQLite DB
   - Git commits the new task folder
   - Returns `{ taskId, folder, status: 'CREATED' }`

2. **`get_next_task_id`** — Utility tool:
   - Scans `task-tracking/` for highest `TASK_YYYY_NNN` folder
   - Returns `{ nextId: 'TASK_2026_NNN' }`
   - Used by `create_task` internally and available standalone

3. **`bulk_create_tasks`** — For auto-split scenarios:
   - Accepts array of task definitions
   - **Each task individually validated** against sizing rules before creation
   - Creates all tasks with sequential IDs and proper dependency wiring between them
   - Git commits all created tasks in a single commit
   - Returns array of `{ taskId, folder, status }` summaries

4. **`validate_task_sizing`** — Standalone sizing check:
   - Accepts: `{ description, acceptanceCriteria, fileScope, complexity }`
   - Reads `task-tracking/sizing-rules.md` and validates
   - Returns `{ valid: boolean, violations: string[], suggestedSplitCount?: number }`
   - Called by `create_task` internally, also available standalone for the skill to pre-check before calling create

**After building tools:** Update `.claude/commands/nitro-create-task.md` to prefer MCP `create_task` tool when available, falling back to file operations if cortex is unavailable.

## Dependencies

- None

## Acceptance Criteria

- [ ] `create_task` MCP tool creates folder, task.md, status file, DB record, and git commit in one call
- [ ] `create_task` rejects oversized tasks with sizing violation details
- [ ] `validate_task_sizing` standalone tool checks against sizing-rules.md
- [ ] `get_next_task_id` returns correct next ID by scanning task-tracking/ folders
- [ ] `bulk_create_tasks` creates multiple tasks with sequential IDs, wired dependencies, and single git commit
- [ ] `bulk_create_tasks` validates each task individually against sizing rules
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
