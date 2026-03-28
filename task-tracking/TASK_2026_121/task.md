# Task: nitro-cortex — Session + Worker Tools (Part 2 of 3)

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

Part 2 of 3 — original request: nitro-cortex MCP server, the shared intelligence layer that gives agents queryable tools for task state, session coordination, and worker management instead of reading markdown files.

Extend `nitro-cortex` with session state management tools and worker lifecycle tools. Migrate all worker spawning and monitoring capabilities from the existing `session-orchestrator` MCP server into `nitro-cortex`, making it the single MCP server agents need.

**Session management tools:**
- `create_session(source, config, task_count)` — inserts session row, returns session_id
- `get_session(session_id)` — returns full session state including active workers, completed/failed lists, config, counters
- `update_session(session_id, fields)` — partial update (loop_status, tasks_terminal, config, etc.)
- `list_sessions(status?)` — list all sessions or filter by loop_status
- `end_session(session_id, summary)` — mark complete, write final counters

**Worker lifecycle tools (migrated from session-orchestrator):**
- `spawn_worker(session_id, task_id, worker_type, prompt, model?, provider?)` — launch Claude Code process, track in workers table
- `list_workers(session_id?, status_filter?)` — list workers with token usage, cost, health
- `get_worker_stats(worker_id)` — detailed stats for one worker
- `get_worker_activity(worker_id)` — compact activity summary
- `kill_worker(worker_id)` — terminate process, update status in DB
- `subscribe_worker(worker_id, conditions)` — event subscription for completion signals
- `get_pending_events(session_id?)` — poll for worker completion events

**Cross-session coordination:** `claim_task()` from Part 1 already handles this atomically via SQL transactions — no additional coordination layer needed.

## Dependencies

- TASK_2026_120

## Acceptance Criteria

- [ ] `create_session()` + `get_session()` round-trip stores and retrieves full session state correctly
- [ ] `spawn_worker()` launches a Claude Code process and tracks it in the workers table
- [ ] `list_workers()` returns workers with status, token usage, and cost data
- [ ] `kill_worker()` terminates the process and updates worker status in DB
- [ ] `subscribe_worker()` / `get_pending_events()` event flow works end-to-end
- [ ] `list_sessions()` returns all active sessions — enables cross-session awareness without file reads
- [ ] All session-orchestrator tools are functionally equivalent in nitro-cortex
- [ ] Two supervisors using `claim_task()` concurrently never claim the same task

## References

- Session orchestrator source: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- TASK_2026_120 — foundation package (must be complete first)

## File Scope

- `packages/mcp-cortex/src/tools/sessions.ts`
- `packages/mcp-cortex/src/tools/workers.ts`
- `packages/mcp-cortex/src/process/spawn.ts`
- `packages/mcp-cortex/src/events/subscriptions.ts`
- `packages/mcp-cortex/src/index.ts`

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_120 — depends on foundation package.
✅ No conflicts with any other CREATED task — all files are within `packages/mcp-cortex/`.
Wave 2: after TASK_2026_120 completes.
