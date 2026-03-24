# Code Style Review — TASK_2026_019

## Summary

The print-mode token tracking fix works but introduces significant code duplication: the health-assessment logic is copy-pasted 3 times across 3 files, `shortenPath` is duplicated in 2 files, and the `src/tools/` module files appear to be entirely dead code (never imported). There are also unused variables, a non-null assertion on a potentially-undefined value, and inconsistent naming between duplicate implementations.

## Findings

### [BLOCKING] `isPrintProcessAlive` imported but never used in index.ts
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:9`
- **Issue**: `isPrintProcessAlive` is imported from `print-launcher.js` but never called anywhere in the file. The code uses `isProcessAlive` from `iterm-launcher.js` for both modes (as the comment on line 247 confirms). This is a dead import.
- **Fix**: Remove `isPrintProcessAlive` from the import statement on line 9.

### [BLOCKING] `alive` variable assigned but never used (2 locations)
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:188` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:21`
- **Issue**: `const alive = isProcessAlive(w.pid)` is assigned but the variable `alive` is never referenced. The health check calls `isProcessAlive` internally, making this call redundant. With strict TS/lint configs this would be an error; without them it is wasted computation (a syscall) and misleading dead code.
- **Fix**: Remove the `alive` variable assignment from both files.

### [BLOCKING] Non-null assertion on `child.pid` without guard
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:82,90`
- **Issue**: `child.pid!` uses a non-null assertion. If `spawn` fails to launch the process (e.g., `claude` binary not found on PATH), `child.pid` is `undefined`. Line 85 checks `if (child.pid)` for the Map insertion, proving the author knows it can be undefined, yet line 90 (`pid: child.pid!`) blindly asserts it exists in the return value. The caller in `index.ts` then registers this `undefined` as a PID, causing `isProcessAlive(undefined)` to throw or behave unpredictably.
- **Fix**: After spawn, check `if (!child.pid)` and throw a descriptive error or return an error result rather than using `!` assertions.

### [SERIOUS] Health assessment logic duplicated 3 times with inconsistencies
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:246-254` (`getHealth`), `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts:58-67` (`assessHealth`), `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:25-30` (inline ternary)
- **Issue**: Three independent implementations of the same health logic. The `index.ts` version and `get-worker-stats.ts` version use lowercase `HealthStatus` type values (`'compacting'`, `'high_context'`). The `get-worker-activity.ts` version uses SCREAMING_CASE strings (`'COMPACTING'`, `'HIGH_CONTEXT'`, `'STARTING'`, `'STUCK'`) but lowercase for `'finished'` and `'healthy'` -- inconsistent even within itself. The function names also differ: `getHealth` vs `assessHealth` vs inline. Any future change to health logic requires updating 3 places.
- **Fix**: Extract a single `assessHealth(worker: Worker): HealthStatus` function into a shared utility (e.g., `src/core/health.ts`) and import it everywhere. Use the `HealthStatus` type from `types.ts` consistently.

### [SERIOUS] `src/tools/get-worker-activity.ts` and `src/tools/get-worker-stats.ts` are dead code
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts` (entire file), `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts` (entire file)
- **Issue**: Neither `getWorkerActivityTool` nor `getWorkerStatsTool` is imported anywhere. Grep confirms zero imports from `tools/` across the whole `src/` tree. The actual tool implementations live inline in `index.ts` (lines 144-205). These files are vestigial -- likely a pre-refactor version that was never cleaned up.
- **Fix**: Either delete both files or migrate the inline implementations in `index.ts` to use them. Having two diverging implementations of the same tools is a maintenance trap: someone will edit the wrong one.

### [SERIOUS] `shortenPath` utility duplicated in 2 files
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:318-322` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:47-51`
- **Issue**: Identical implementations of `shortenPath`. The inline version in `index.ts` (lines 191-194) also does the same thing manually without calling a function.
- **Fix**: Export `shortenPath` from a shared utility and import it everywhere.

### [SERIOUS] `STARTUP_GRACE_MS` constant defined 3 times
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:244`, `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts:59`, `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:23`
- **Issue**: The 300,000ms startup grace period is hardcoded in three separate locations. If the grace period needs tuning, someone will update one and miss the others.
- **Fix**: Define once in a shared constants file or alongside the shared health function.

### [SERIOUS] `onMessage` callback receives `Record<string, unknown>` but is cast to `JsonlMessage`
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:10` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:85`
- **Issue**: The `PrintLaunchOptions.onMessage` callback types its parameter as `Record<string, unknown>`, but the caller in `index.ts:85` casts it with `msg as import('./types.js').JsonlMessage`. This is a type assertion hiding a validation gap. A malformed JSON object from stdout (e.g., missing `type` field, or an unknown `type` value) silently becomes a `JsonlMessage` and flows into `processMessage`, where it falls through all conditionals doing nothing -- benign now, but fragile.
- **Fix**: Either type the callback parameter as `JsonlMessage` directly in the interface (accepting the coupling), or add a runtime type guard in `feedMessage` that validates `msg.type` before processing.

### [SERIOUS] `TokenUsage.cache_creation_input_tokens` is required in the interface but accessed with `?? 0`
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/types.ts:4-5` vs `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:189-190`
- **Issue**: The `TokenUsage` interface declares `cache_creation_input_tokens: number` and `cache_read_input_tokens: number` as required fields. But `processMessage` accesses them with `?? 0` fallback (`usage.cache_creation_input_tokens ?? 0`). This means either: (a) the interface is wrong and the fields should be optional (`number | undefined`), or (b) the `?? 0` is unnecessary noise. Given that the Claude API can omit these fields on older models, the interface is likely wrong.
- **Fix**: Mark both fields as optional in `TokenUsage`: `cache_creation_input_tokens?: number` and `cache_read_input_tokens?: number`.

### [MINOR] `hasToolUse` computed but its purpose partially overlaps with `extractToolCalls`
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:200-203`
- **Issue**: `hasToolUse` is computed via `.some()` on content blocks, then `extractToolCalls` iterates the same array. The tool-call count from `extractToolCalls` could provide the boolean check (i.e., `toolCallsBefore !== acc.toolCalls`), avoiding a double iteration.
- **Fix**: Refactor to check `acc.toolCalls` before/after `extractToolCalls` instead of a separate `.some()` pass.

### [MINOR] `{ ...process.env }` spread is unnecessary
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:43`
- **Issue**: `env: { ...process.env }` creates a shallow copy of the environment. Since no modifications are made, this is equivalent to `env: process.env` or simply omitting the `env` option (which inherits by default).
- **Fix**: Remove the `env` option entirely, or add a comment explaining why a copy is intentional.

### [MINOR] Empty catch blocks throughout
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/print-launcher.ts:105,117,137` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:157`
- **Issue**: Multiple `catch { }` blocks with no logging. While the inline comments explain intent (e.g., `/* already dead */`), these suppress all errors including unexpected ones (EPERM, etc.).
- **Fix**: At minimum, add `catch (_) { /* expected: process already exited */ }` with a typed expectation, or log at debug level.

### [MINOR] `index.ts` is growing into a god file
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts` (263 lines)
- **Issue**: All 5 MCP tool registrations plus the health function plus startup logic live in one file. The `src/tools/` directory exists with per-tool files that are never used. This file will only grow as more tools are added.
- **Fix**: Migrate tool handlers to `src/tools/` files and have `index.ts` wire them up. The existing tool files already have the right structure -- they just need to be imported and used.

### [MINOR] Inline `import()` type in function signature
- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/core/jsonl-watcher.ts:112`
- **Issue**: `private async autoCloseWorker(worker: import('../types.js').Worker)` uses a dynamic `import()` type expression instead of a top-level import. The `Worker` type is already available via the existing imports in this file (it is used via `this.registry` methods). This is inconsistent with the rest of the file.
- **Fix**: Add `Worker` to the existing type import from `'../types.js'` at the top of the file.

## Verdict

**PASS_WITH_NOTES**

The core logic is sound -- the stream-json stdout parsing approach is correct and the `feedMessage` bridge into the existing accumulator system is clean. However, the codebase has accumulated significant duplication debt (3x health logic, 2x shortenPath, 2x dead tool files) that will cause real bugs when someone updates one copy and misses the others. The type safety gaps (non-null assertion on `child.pid`, unvalidated cast to `JsonlMessage`) are real runtime risks. These should be addressed before the next feature touches these files.
