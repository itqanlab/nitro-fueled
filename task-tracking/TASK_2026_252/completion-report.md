# Completion Report — TASK_2026_252

## Files Modified
- packages/mcp-cortex/src/tools/tasks.ts — added readFileSync import, writeTitleToTaskMd() function, title sync calls in handleUpdateTask and handleBulkUpdateTasks

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | — |
| Code Logic | — |
| Security | — |

(Reviewers skipped per user instruction)

## Findings Fixed
- update_task did not write title changes to task.md on disk — DB and files drifted out of sync
- bulk_update_tasks similarly did not sync title changes to disk

## New Review Lessons Added
- none

## Integration Checklist
- [x] writeTitleToTaskMd follows same best-effort pattern as writeStatusFile (catch silently)
- [x] existsSync guard prevents creating task.md files that don't exist
- [x] regex `^# Task:.*$/m` handles any content after the title line safely
- [x] handleBulkUpdateTasks condition broadened to trigger generateRegistryFromDb on title-only updates
- [x] Build passes (npx nx build mcp-cortex)

## Verification Commands
```
grep -n "writeTitleToTaskMd\|titleChanges" packages/mcp-cortex/src/tools/tasks.ts
# should show function definition and 3 call sites
```
