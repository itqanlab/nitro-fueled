# Code Logic Review — TASK_2026_075

**Reviewer**: nitro-code-logic-reviewer
**Date**: 2026-03-28
**Task**: Refactor session-orchestrator to consume @nitro-fueled/worker-core

## Summary

| Metric | Result |
|--------|--------|
| Files Reviewed | 5 |
| Critical Issues | 0 |
| Major Issues | 0 |
| Minor Issues | 0 |
| Overall Status | **PASS** |

## Import Migration Verification

### package.json
- `@nitro-fueled/worker-core`: "*" — present in dependencies

### src/index.ts (259 lines)
- Imports from `@nitro-fueled/worker-core`: WorkerRegistry, JsonlWatcher, killProcess, closeItermSession, isProcessAlive, killPrintProcess, killOpenCodeProcess, FileWatcher, EventQueue, HealthStatus (type)
- No remaining `./core/` or `./types` imports

### src/tools/get-pending-events.ts (33 lines)
- Imports from `@nitro-fueled/worker-core`: FileWatcher (type), EventQueue (type), WatchEvent (type), EmittedEvent (type)
- No remaining local imports

### src/tools/spawn-worker.ts (180 lines)
- Imports from `@nitro-fueled/worker-core`: WorkerRegistry (type), JsonlWatcher (type), JsonlMessage (type), Provider (type), launchInIterm, launchWithPrint, launchWithOpenCode, resolveSessionId, resolveJsonlPath
- No remaining local imports

### src/tools/subscribe-worker.ts (69 lines)
- Imports from `@nitro-fueled/worker-core`: FileWatcher (type), WorkerRegistry (type)
- No remaining local imports

## Business Logic Analysis

### src/index.ts

**getHealth() function (lines 243-250):**
The health check logic is correctly ordered:
1. Process alive check (finished)
2. Compaction threshold (>=2)
3. Context threshold (>80%)
4. Startup grace period (5 min for 0-message workers)
5. Stuck detection (>120s since last action)
6. Default healthy

**Event handling (emit_event tool, lines 148-179):**
- Correctly queues events even for unknown workers (prevents race conditions with fast workers)
- Warning logged to stderr for unknown workers — appropriate behavior

**Signal handlers (lines 257-258):**
- SIGINT and SIGTERM properly stop watcher and close file watchers before exit

### src/tools/spawn-worker.ts

**Incompatible flag validation (lines 37-39):**
- Correctly rejects `use_iterm=true` with `provider=opencode`

**Session resolution polling (lines 52-59):**
- 10 iterations × 2s = 20s maximum wait
- Continues until both sessionId and jsonlPath are resolved
- Gracefully handles pending state if resolution fails

**workerRef pattern (lines 93, 100-101, 138, 146-147):**
- Captures worker_id for async callback before registry.register returns
- Correct closure pattern for feeding JSONL messages

### src/tools/subscribe-worker.ts

**Security consideration (line 52):**
- Uses worker's registered `working_directory`, not caller-provided input
- Prevents path traversal attacks

**Error handling (lines 53-59):**
- Catches and surfaces subscription errors

### src/tools/get-pending-events.ts

**Event merging (lines 19-24):**
- File-watcher events merged first (terminal conditions)
- Emitted phase events follow
- Comment documents deduplication handled by supervisor

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| `@nitro-fueled/worker-core` added to package.json | PASS |
| All imports in src/index.ts updated | PASS |
| All imports in src/tools/ updated | PASS |
| No remaining `./core/` imports | PASS |
| No remaining `./types` imports | PASS |

## Conclusion

The import migration is complete. All business logic is preserved and correct. No stubs, placeholders, or incomplete implementations detected. The refactor successfully consolidates local core modules into the shared `@nitro-fueled/worker-core` package.

**Verdict: APPROVED**
