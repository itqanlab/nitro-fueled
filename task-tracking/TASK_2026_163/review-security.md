# Security Review — TASK_2026_163

## Review Summary

| Metric | Value |
|--------|-------|
| Assessment | REJECTED |
| Critical Issues | 0 |
| Serious Issues | 1 |
| Minor Issues | 0 |
| Files Reviewed | 2 |

## Scope

- `task-tracking/TASK_2026_163/handoff.md`
- `packages/mcp-cortex/src/tools/task-creation.ts`
- `packages/mcp-cortex/src/index.ts`

## Focus Areas

| Category | Status | Notes |
|----------|--------|-------|
| Input Validation | PASS | The MCP schemas bound string and array sizes, and task type/priority/complexity are enum-constrained before reaching the filesystem or git paths. |
| Filesystem Writes | FAIL | Task ID selection is not atomic, and the subsequent directory/file writes are not exclusive. Concurrent callers can target the same computed `TASK_YYYY_NNN` and overwrite `task.md`/`status` for an existing task folder. |
| Git / Process Execution | PASS | Git is executed with `execFileSync()` and argument arrays, with `--` used for `git add`/`git reset`, so the scoped code does not introduce shell-injection risk. |

| Verdict | FAIL |
|---------|------|

## Critical Issues

No critical issues found.

## Serious Issues

1. Non-atomic task ID allocation allows concurrent overwrite of task folders

   - Files: `packages/mcp-cortex/src/tools/task-creation.ts:42-80`, `packages/mcp-cortex/src/tools/task-creation.ts:221-229`, `packages/mcp-cortex/src/tools/task-creation.ts:287-301`
   - Impact: `getNextTaskIdFromDisk()` computes the next free ID by scanning `task-tracking/`, but neither `handleCreateTask()` nor `handleBulkCreateTasks()` reserve that ID atomically. Both then call `mkdirSync(taskDir, { recursive: true })`, which succeeds even if another caller created the directory after the scan, and immediately `writeFileSync()` the task files. In a concurrent MCP environment, two callers can race on the same ID; the later writer can replace the earlier task's `task.md` and `status` contents and then commit them under the shared path. This is an integrity issue in the exact filesystem-write safety area requested.
   - Recommendation: Make task creation fail closed when the target directory already exists and reserve IDs atomically, for example by using non-recursive directory creation as the lock point and retrying ID selection on `EEXIST`, plus exclusive file creation semantics where appropriate.

## Minor Issues

No minor issues found.

## Notes

The scoped git/process execution path is otherwise solid: it avoids shell interpolation and limits staged paths to internally generated `task-tracking/<taskId>/...` entries. The primary security concern is the missing concurrency guard around disk allocation and writes.
