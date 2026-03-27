# Completion Report — TASK_2026_067

## Files Created
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts` (164 lines)
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/subscribe-worker.ts` (68 lines)
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-pending-events.ts` (25 lines)

## Files Modified
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/types.ts` — added WatchCondition (discriminated union) and WatchEvent types
- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts` — imported FileWatcher, registered subscribe_worker and get_pending_events tools, added fileWatcher.closeAll() to shutdown handlers
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` — added Step 5e-ii (subscribe after spawn), rewrote Step 6 with event-driven + polling modes, updated MCP Tool Reference and session log tables
- `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/cli/scaffold/.claude/skills/auto-pilot/SKILL.md` — kept in sync (hardlinked)

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | 5/10 |
| Code Logic | 5.5/10 |
| Security | 3/10 |

## Findings Fixed

### Critical (all resolved)
- **Path traversal**: Added `resolve()` + `startsWith(resolvedBase + sep)` boundary check before any watch is set up
- **Caller-supplied working_directory**: Removed `working_directory` from `subscribe_worker` tool parameters entirely; the tool now always reads `worker.working_directory` from the registry
- **Symlink escape**: Added `followSymlinks: false` to chokidar watch options

### Blocking (all resolved)
- **ignoreInitial missing**: Added `ignoreInitial: false` so watchers fire for files that already exist at watch time (critical for fast workers)
- **EMFILE crash**: Wrapped `chokidar.watch()` in try-catch; failed watchers are logged and skipped rather than crashing the server
- **TOCTOU double-event**: Moved `sub.satisfied = true` to synchronous lock in `onEvent`; reset to false if file read fails or condition not met

### Serious (all resolved)
- **Resource exhaustion**: Added `MAX_CONDITIONS_PER_WORKER = 20` cap in subscribe(), `.max(20)` on Zod array
- **Unbounded event queue**: Added `MAX_EVENT_QUEUE_SIZE = 1000` with drop-and-log
- **file_exists optimization**: Short-circuit — add/change event proves existence; no readFile needed
- **Structured failure response**: subscribe_worker now returns `{ subscribed: bool, error?, watched_paths }` JSON so supervisor can detect silent failures

## New Review Lessons Added
- Security lessons for TASK_2026_067 were pre-added by the security reviewer to `.claude/review-lessons/security.md` (lines 50-53):
  - `path.join` path traversal must use `path.resolve` boundary check
  - MCP tools must derive working_directory from registry, not from caller
  - Zod array schemas for resource-creating ops must include `.max()`
  - Free-text fields reflected in events should be constrained to safe character sets

## Integration Checklist
- [x] TypeScript build passes clean (`npm run build` in session-orchestrator)
- [x] FileWatcher is instantiated in index.ts and passed to both new tools
- [x] Shutdown handlers call `fileWatcher.closeAll()`
- [x] SKILL.md updated with subscribe step, event-driven monitoring loop, and MCP reference
- [x] Scaffold copy kept in sync

## Verification Commands
```bash
# Confirm new MCP tools registered
grep -n "subscribe_worker\|get_pending_events" /Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts

# Confirm FileWatcher exists
ls /Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts

# Confirm ignoreInitial: false in watcher
grep "ignoreInitial" /Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts

# Confirm path boundary check
grep "startsWith" /Volumes/SanDiskSSD/mine/session-orchestrator/src/core/file-watcher.ts

# Confirm Step 5e-ii in auto-pilot skill
grep "5e-ii" /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md

# Confirm event-driven Step 6
grep "event_driven_mode" /Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md
```
