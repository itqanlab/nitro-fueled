# Task: nitro-cortex — Package Scaffold + SQLite Schema + Task Tools (Part 1 of 3)

## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE                                                                       |
| Priority              | P0-Critical                                                                   |
| Complexity            | Complex                                                                       |
| Model                 | claude-opus-4-6                                                               |
| Testing               | required                                                                      |
| Poll Interval         | default                                                                       |
| Health Check Interval | default                                                                       |
| Max Retries           | 2                                                                             |

## Description

Part 1 of 3 — original request: nitro-cortex MCP server, the shared intelligence layer that gives agents queryable tools for task state, session coordination, and worker management instead of reading markdown files.

Create the `nitro-cortex` MCP server as a new Nx package at `packages/mcp-cortex/` inside the nitro-fueled workspace. This is the foundational layer: package scaffold, SQLite database schema, and all task management tools.

**Package scaffold:**
- `packages/mcp-cortex/` with TypeScript, `@modelcontextprotocol/sdk`, `better-sqlite3`
- `package.json` with name `@itqanlab/nitro-cortex`, build scripts
- `tsconfig.json`, `project.json` for Nx integration
- MCP server entry point at `src/index.ts`

**SQLite schema** at `.nitro/cortex.db` (project-local):
- `tasks` table: id, title, type, priority, status, complexity, model, dependencies (JSON array), description, acceptance_criteria, file_scope (JSON array), session_claimed, claimed_at, created_at, updated_at
- `sessions` table: id, source, started_at, config (JSON), loop_status, task_limit, tasks_terminal, updated_at
- `workers` table: id, session_id, task_id, worker_type, label, status, spawn_time, last_health, stuck_count, compaction_count, expected_end_state

**Task management MCP tools:**
- `get_tasks(status?, type?, priority?, unblocked?)` — filtered task list; when `unblocked=true`, resolves dependency graph and returns only tasks whose dependencies are all COMPLETE
- `claim_task(task_id, session_id)` — atomic `BEGIN EXCLUSIVE` transaction; returns `{ok: true}` or `{ok: false, claimed_by: session_id}`
- `release_task(task_id, new_status)` — clears claim, sets new status
- `update_task(task_id, fields)` — partial update any task fields
- `get_next_wave(session_id, slots)` — returns up to N unclaimed, dependency-resolved CREATED tasks; atomically excludes tasks claimed by other active sessions
- `sync_tasks_from_files()` — bootstrap: scan `task-tracking/TASK_*/` folders, import task.md fields and status files into DB; safe to re-run (upsert by task_id)

**Setup:**
- Add `.nitro/` to `.gitignore`
- Add `nitro-cortex` server entry to `.claude/settings.json` MCP servers block

## Dependencies

- None

## Acceptance Criteria

- [ ] `nx build mcp-cortex` completes without errors
- [ ] MCP server starts and all task tools appear when Claude Code loads the config
- [ ] `sync_tasks_from_files()` imports all existing tasks and their current statuses correctly
- [ ] `get_tasks(status="CREATED", unblocked=true)` returns only unblocked CREATED tasks
- [ ] `claim_task()` is atomic — two concurrent calls for the same task_id result in exactly one `ok: true`
- [ ] `get_next_wave(session_id, slots=4)` returns up to 4 ready tasks, excluding those claimed by other sessions
- [ ] `.nitro/cortex.db` is created on first run and listed in `.gitignore`
- [ ] All tools return structured JSON, never markdown

## References

- Existing Nx package for structure reference: `packages/cli/`
- MCP SDK: `@modelcontextprotocol/sdk`
- SQLite bindings: `better-sqlite3`
- Session orchestrator (existing MCP, for reference): `/Volumes/SanDiskSSD/mine/session-orchestrator/`

## File Scope

- `packages/mcp-cortex/package.json` (created)
- `packages/mcp-cortex/tsconfig.json` (created)
- `packages/mcp-cortex/project.json` (created)
- `packages/mcp-cortex/src/index.ts` (created)
- `packages/mcp-cortex/src/db/schema.ts` (created)
- `packages/mcp-cortex/src/tools/tasks.ts` (created)
- `packages/mcp-cortex/src/tools/wave.ts` (created)
- `packages/mcp-cortex/src/tools/sync.ts` (created)
- `.mcp.json` (modified — needs manual update, permission denied during build)
- `.gitignore` (modified)
- `package.json` (modified — added packages/* to workspaces)

## Parallelism

✅ Can run in parallel — all files are new (`packages/mcp-cortex/` does not exist). Edits to `.claude/settings.json` and `.gitignore` are additive only. No overlap with any CREATED task file scopes.
