# Task: MCP Server — Persist Worker Registry to Disk

## Metadata

| Field      | Value       |
|------------|-------------|
| Type       | BUGFIX      |
| Priority   | P1-High     |
| Complexity | Simple      |

## Description

The `WorkerRegistry` in the session-orchestrator MCP server stores all worker state in an in-memory `Map`. When the MCP server restarts (e.g., due to a crash, Claude session switch, or manual restart), the registry is wiped. Supervisors running in a different Claude session call `list_workers` and get an empty response, even though worker processes (iTerm or print-mode) are still running. This breaks cross-session visibility and causes the supervisor to misclassify live workers as finished.

The fix is to add disk persistence to `WorkerRegistry`. On every mutation, serialize the registry to a JSON file. On startup, load the registry from that file and resume from the saved state. Worker processes that were running before the restart may or may not still be alive — the caller (supervisor) is responsible for deciding what to do with stale entries; the registry just preserves them.

### What to build

1. **`WorkerRegistry` persistence** in `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/worker-registry.ts`:
   - Add a `persistPath: string` constructor parameter (absolute path to `worker-registry.json`, e.g. in the OS temp dir or a fixed config path like `~/.session-orchestrator/registry.json`).
   - After every mutating operation (`register`, `updateStatus`, `updateSession`, `updateJsonlPath`, `updateTokens`, `updateCost`, `updateProgress`, `remove`), call a private `_persist()` method that writes the full registry as JSON to `persistPath` (synchronous `writeFileSync` is fine — the registry is small).
   - On construction, if `persistPath` exists, read it and hydrate `this.workers` from the saved data. Any worker with `status: 'running'` from the previous session should be loaded as-is (the supervisor will reconcile liveness).

2. **Wire the path** in `index.ts` (wherever `WorkerRegistry` is instantiated): choose a stable path, e.g. `path.join(os.homedir(), '.session-orchestrator', 'registry.json')`. Create the directory if it does not exist.

3. **No breaking changes** to any MCP tool signatures or return shapes.

## Dependencies

- None

## Parallelism

Can run in parallel with TASK_2026_060. Both are independent — one is in the MCP server, the other in the supervisor skill.

## Acceptance Criteria

- [ ] On MCP server restart, `list_workers` returns all workers that were registered before the restart
- [ ] Workers loaded from disk after restart appear with their last-known status (`running`, `completed`, etc.)
- [ ] Every mutation flushes to disk (register, kill, status update, token update)
- [ ] If `registry.json` is missing or corrupt on startup, the registry starts empty (graceful degradation — no crash)
- [ ] TypeScript compiles cleanly with no new errors

## File Scope

- `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/worker-registry.ts` — add constructor param + `_persist()` + hydration on load
- `/Volumes/SanDiskSSD/mine/session-orchestrator/index.ts` — wire persist path when instantiating registry
