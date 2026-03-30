# Context — TASK_2026_139

## User Intent

Migrate the auto-pilot supervisor's core loop to use nitro-cortex DB queries instead of file-based reads for structured data. This is Part 3 of 4 in the Supervisor-Worker Communication Overhaul.

## Strategy

REFACTORING

## Files in Scope

- `.claude/skills/auto-pilot/references/parallel-mode.md` — core loop (Steps 1-7)
- `.claude/skills/auto-pilot/references/sequential-mode.md` — sequential mode (Steps 4-7)
- `.claude/skills/auto-pilot/references/cortex-integration.md` — cortex summary reference
- `.claude/skills/auto-pilot/references/log-templates.md` — add cortex-path log events
- `.claude/skills/auto-pilot/references/worker-prompts.md` — inject handoff data from DB into Review Worker prompt
- `.claude/skills/auto-pilot/SKILL.md` — add `escalate_to_user` config option

## What Already Exists

- Step 2 (registry read): cortex path via `get_tasks()` — DONE
- Step 3 (dependency graph): cortex path using get_tasks response — DONE
- Step 3d (cross-session exclusion): removed for cortex path (DB atomic) — DONE
- Step 4 (queue ordering): cortex path via `get_next_wave()` — DONE
- Step 5e-pre (claim task): cortex path via `claim_task()` — DONE
- Step 5h (state persist): partial cortex path via `update_session()` — DONE
- Step 6 (mcp_empty_count): cortex path via `get_session()` — DONE
- Step 7a (status check): cortex path via `get_tasks()` — DONE
- Step 7c/7e (BLOCKED writes): cortex path via `update_task()` — DONE
- Step 7d (state transitions): cortex path via `release_task()` — DONE
- Step 1 (compaction recovery): cortex path via `get_session()` — DONE

## What's Missing (Must Be Implemented)

### 1. Event logging via `log_event` (AC #4 + #5)
- Every supervisor log entry currently appends to `{SESSION_DIR}log.md`
- Cortex path: call `log_event(session_id, task_id, source="auto-pilot", event_type, data)` ADDITIONALLY
- At session end: render log.md from `query_events(session_id)` for human audit trail
- This is additive — file-based log.md still exists as the primary human-readable format
- DB events are for queryable analytics

### 2. orchestrator-history.md replaced by query_events (AC #7)
- Currently auto-pilot writes session summary to `task-tracking/orchestrator-history.md`
- Cortex path: `log_event(event_type='SUPERVISOR_COMPLETE', data={completed, failed, blocked})`
- Analytics queries use `query_events(event_type='TASK_COMPLETE')` instead of reading the file
- Keep file-based path as fallback

### 3. `escalate_to_user` config option (AC #9)
- New config flag in SKILL.md configuration table (default: false)
- When false: workers fail autonomously, supervisor retries/blocks
- When true: workers can signal `log_event(event_type='NEED_INPUT', data={question})`; supervisor surfaces to user
- Signal check at phase boundaries (step between completion events)

### 4. Worker handoff from DB in Review Worker prompt (AC #6 partial)
- When spawning Review Worker: call `read_handoff(task_id)` if cortex_available
- Inject structured handoff data into the Review Worker prompt instead of requiring the worker to discover it
- Fallback: worker reads handoff.md file (current behavior)

### 5. Session teardown via cortex (AC #5/#6)
- At session end: call `end_session(session_id)` (existing cortex tool)
- Before ending: render log.md from `query_events(session_id)` for human audit trail
- Keep file-based session teardown as fallback

## nitro-cortex MCP Tool Reference

Available tools (from `packages/mcp-cortex/dist/tools/`):
- `log_event(session_id, task_id?, source, event_type, data?)` — log a structured event
- `query_events(session_id?, task_id?, event_type?, since?, limit?)` — query events
- `read_handoff(task_id)` — read handoff record for a task
- `end_session(session_id, summary?)` — end a session
- `get_tasks()` — already in use
- `update_task()` — already in use
- `get_session()` / `update_session()` — already in use
- `claim_task()` / `release_task()` — already in use
- `get_next_wave()` — already in use

## Dependencies

- TASK_2026_134 — COMPLETE (SKILL.md split into references/)
- TASK_2026_138 — COMPLETE (cortex schema — tables exist)
