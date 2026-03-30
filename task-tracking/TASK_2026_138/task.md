# Task: nitro-cortex schema extension — tasks, handoffs, and events tables

## Metadata

| Field                 | Value                |
|-----------------------|----------------------|
| Type                  | FEATURE              |
| Priority              | P1-High              |
| Complexity            | Medium               |
| Preferred Tier        | auto                 |
| Model                 | default              |
| Testing               | skip                 |
| Poll Interval         | default              |
| Health Check Interval | default              |
| Max Retries           | default              |

## Description

Part 2 of 4 — Supervisor-Worker Communication Overhaul.

Extend the nitro-cortex SQLite schema with three new tables that replace file-based supervisor queries and enable structured worker communication.

**New tables:**

1. **`tasks`** — replaces registry.md for supervisor queries
   - task_id (TEXT PK), status (TEXT), type (TEXT), priority (TEXT), complexity (TEXT)
   - dependencies (TEXT — comma-separated task IDs), model (TEXT)
   - created_at (TEXT), updated_at (TEXT)
   - Indexed on: status, priority, type

2. **`handoffs`** — structured Build-to-Review communication
   - id (INTEGER PK), task_id (TEXT FK), worker_type (TEXT)
   - files_changed (TEXT — JSON array of {path, action, lines})
   - commits (TEXT — JSON array of commit hashes)
   - decisions (TEXT — JSON array of strings)
   - risks (TEXT — JSON array of strings)
   - created_at (TEXT)

3. **`events`** — replaces log.md for queryable event history
   - id (INTEGER PK), session_id (TEXT), task_id (TEXT nullable)
   - source (TEXT — 'auto-pilot' | 'orchestrate' | worker_id)
   - event_type (TEXT — 'SPAWNED', 'HEALTH_CHECK', 'STATE_TRANSITIONED', etc.)
   - data (TEXT — JSON payload)
   - created_at (TEXT)
   - Indexed on: session_id, task_id, event_type

**MCP tools to add:**
- `query_tasks(status?, priority?, type?)` — filtered task query (replaces registry.md reads)
- `upsert_task(task_id, fields...)` — create or update task record
- `write_handoff(task_id, worker_type, files_changed, commits, decisions, risks)`
- `read_handoff(task_id)` — returns most recent handoff for task
- `log_event(session_id, task_id?, source, event_type, data)` — append event
- `query_events(session_id?, task_id?, event_type?, since?)` — filtered event query

## Dependencies

- TASK_2026_122 — nitro-cortex skill integration must be complete (already COMPLETE)

## Acceptance Criteria

- [ ] `tasks` table created with proper schema and indexes
- [ ] `handoffs` table created with JSON fields for structured data
- [ ] `events` table created with proper indexes for querying
- [ ] `query_tasks` MCP tool returns filtered results (status, priority, type filters)
- [ ] `upsert_task` MCP tool creates or updates task records
- [ ] `write_handoff` and `read_handoff` MCP tools work correctly
- [ ] `log_event` and `query_events` MCP tools work correctly
- [ ] Migration applies cleanly on existing nitro-cortex databases

## References

- nitro-cortex package: `libs/nitro-cortex/`
- Existing schema: `libs/nitro-cortex/src/schema.ts`
- MCP session-orchestrator: `apps/session-orchestrator/`

## File Scope

- `libs/nitro-cortex/src/schema.ts`
- `libs/nitro-cortex/src/tools/` (new tool files)
- `apps/session-orchestrator/src/` (register new tools)

## Parallelism

- Can run in parallel with TASK_2026_134-137 (different files — cortex vs skills)
