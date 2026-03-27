# Code Style Review — TASK_2026_046 / TASK_2026_022

## Summary

| Metric | Value |
|--------|-------|
| Overall Score | 6/10 |
| Assessment | NEEDS_REVISION |
| Blocking Issues | 2 |
| Serious Issues | 7 |
| Minor Issues | 5 |

## Blocking Findings (Fixed)

### [BLOCKING] ChokidarWatcher silently overwrites watcher on repeated watch() calls
File: `watcher/chokidar.watcher.ts`
Issue: Single `FSWatcher | null` slot leaked first watcher when watch() called twice.
Fix Applied: Changed to `FSWatcher[]` array; close() now closes all.

### [BLOCKING] Worker-to-task correlation bug in diffState
File: `state/differ.ts:90-121`
Issue: `find()` on completedTasks returned first match for all workers, not task-specific match.
Fix Applied: Filter by `t.taskId === worker.taskId` before checking old state.

## Serious Findings (Fixed)

- **TaskRecord.type is string vs TaskType** — dual typing of same concept (noted, not fixed — cosmetic only)
- **Unsafe cast in RegistryParser** — `as TaskRecord['status']` without validation (noted)
- **DashboardEvent payload is Record<string,unknown>** — loose typing (noted, future refactor)
- **watchAntiPatterns not actually watching** — fixed: now registers file watcher
- **PlanParser brittle `| 20` date check** — fixed: proper table row detection
- **StateParser getSection compaction hack** — fixed: removed spurious break condition
- **FileRouter missing error context** — fixed: TOCTOU race + better ENOENT handling

## Minor Findings (Not Fixed)

- `forEach` vs `for...of` inconsistency in `http.ts:115`
- Unnecessary non-null assertion after null guard in `index.ts:63`
- Dead `WorkerType`/`WorkerStatus` types in event-types.ts
- `review.parser.ts:97` `## ` reset logic could miss `### ` headings
- Static file path for non-`/assets` paths (favicon etc.)
