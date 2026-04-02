# Handoff — TASK_2026_287

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified — added 7 table constants, 7 index entries, 7 db.exec calls in initDatabase)
- packages/mcp-cortex/src/db/migrations/001_task_artifact_tables.sql (new — reference SQL for the 7 new tables)

## Commits
- 8bee765: feat(mcp-cortex): add task artifact tables to cortex DB schema

## Decisions
- Used CREATE TABLE IF NOT EXISTS pattern — no separate migration arrays needed for new tables
- No TypeScript types exported for these tables — they are pure schema additions; consumers query via SQL
- task_subtasks uses a separate PENDING status set (not TaskStatus) since subtasks are not top-level cortex tasks
- Migration .sql file is reference-only; actual application happens through initDatabase() on startup

## Known Risks
- task_subtasks.status enum is distinct from TaskStatus (no PREPPED/IMPLEMENTING/etc.) — intentional but callers must be aware
- No MCP tools exist yet to write/read these tables — they are schema-only additions pending tool implementation
