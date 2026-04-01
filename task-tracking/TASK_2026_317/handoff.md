# Handoff — TASK_2026_317

## Files Changed
- packages/mcp-cortex/src/db/schema.ts (modified, +4 -4)
- packages/mcp-cortex/src/tools/tasks.ts (modified, +1 -1)
- packages/mcp-cortex/src/tools/sync.ts (modified, +1 -1)
- packages/mcp-cortex/src/tools/context.ts (modified, +1 -1)
- packages/mcp-cortex/src/index.ts (modified, +3 -3)

## Commits
- (see commit)

## Decisions
- ARCHIVE added to all four enforcement layers: TypeScript type, DB CHECK constraint, runtime validation sets, and MCP tool schemas
- Migration detection updated so existing DBs automatically rebuild the tasks table on next startup (triggers when ARCHIVE missing from CHECK constraint SQL)
- ARCHIVE tasks are naturally excluded from Supervisor processing: get_next_wave only selects status='CREATED', and get_tasks filtering skips non-CREATED statuses
- ARCHIVE does NOT satisfy dependencies (consistent with CANCELLED behavior) — tasks depending on an ARCHIVE task remain blocked

## Known Risks
- Existing DBs will trigger table rebuild on next startup (migrateTasksCheckConstraint). This is the same migration path used for prior constraint additions (PREPPED, IMPLEMENTING, etc.) and has been proven safe
