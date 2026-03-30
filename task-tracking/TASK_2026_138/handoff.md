# Handoff — TASK_2026_138

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified, +34 lines)
- packages/mcp-cortex/src/tools/tasks.ts (modified, +60 lines)
- packages/mcp-cortex/src/tools/handoffs.ts (new, 73 lines)
- packages/mcp-cortex/src/tools/events.ts (new, 62 lines)
- packages/mcp-cortex/src/index.ts (modified, +68 lines)

## Commits
- (see git log after commit)

## Decisions
- tasks table already existed with richer schema — no re-creation needed; added only missing indexes (priority, type)
- upsert_task handler: INSERT path requires title/type/priority; UPDATE path uses same whitelist as update_task
- events table has no FK on session_id (sessions may not exist in DB when events are logged by workers); task_id FK omitted for same reason
- query_events limit capped at 1000 to prevent memory exhaustion; default 500
- write_handoff validates task FK exists before inserting
- JSON fields (files_changed, commits, decisions, risks) stored as TEXT and parsed on read

## Known Risks
- events table has no FK constraints on session_id or task_id — caller must validate IDs if needed
- upsert_task INSERT path does not validate enum values for type/priority/status against DB CHECK constraints at the application layer (relies on SQLite CHECK); invalid values will bubble as DB errors
