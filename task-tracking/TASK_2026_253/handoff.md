# Handoff — TASK_2026_253

## Files Changed
- packages/mcp-cortex/src/tools/task-creation.ts (modified, +15 -0)

## Commits
- (see implementation commit)

## Decisions
- Added `INVALID_TITLES` as a `Set<string>` for O(1) lookup and easy future extension (e.g. adding 'New Task', 'TODO')
- Validation is create-time only — existing tasks in the DB/filesystem are unaffected
- `bulk_create_tasks` rejects individual bad-title tasks and continues processing the rest (non-blocking)
- Error message matches spec exactly: `Task title cannot be empty or "Untitled" — provide a descriptive title.`

## Known Risks
- None — purely additive validation, no existing behavior changed
