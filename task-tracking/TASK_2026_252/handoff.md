# Handoff — TASK_2026_252

## Files Changed
- packages/mcp-cortex/src/tools/tasks.ts (modified: +readFileSync import, +writeTitleToTaskMd fn, +title sync in handleUpdateTask and handleBulkUpdateTasks)

## Commits
- (see implementation commit)

## Decisions
- Added `writeTitleToTaskMd` alongside existing `writeStatusFile` — same best-effort pattern (catch, log nothing, return)
- Uses regex `^# Task:.*$/m` to replace only the title line — safe for any task.md content below
- Skips write entirely if task.md doesn't exist (existsSync guard) to avoid creating spurious files
- Applied title sync to `handleBulkUpdateTasks` too for consistency with status sync
- `generateRegistryFromDb` call condition broadened from `statusChanges.length > 0` to `statusChanges.length > 0 || titleChanges.length > 0` so registry stays in sync on title-only updates

## Known Risks
- Regex replacement is line-based (multiline flag `m`) — if task.md has multiple `# Task:` lines, only the first match is replaced (correct behavior)
- If task.md was never created (e.g., task created purely via DB), the write is silently skipped — correct per best-effort spec
