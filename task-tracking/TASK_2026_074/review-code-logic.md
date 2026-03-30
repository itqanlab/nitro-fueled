# Code Logic Review — TASK_2026_074

**Reviewer:** nitro-code-logic-reviewer
**Task:** Extract libs/worker-core from session-orchestrator
**Date:** 2026-03-28
**Scope:** 19 files (libs/worker-core/* + apps/session-orchestrator modified files)

---

## Summary

| Severity | Count |
|----------|-------|
| Blocking | 0 |
| Serious  | 0 |
| Minor    | 3 |
| Info     | 2 |

**Verdict:** PASS — No blocking or serious logic issues. The refactoring correctly extracts and re-exports all business logic from `apps/session-orchestrator` into `libs/worker-core`. All imports in the consuming app are properly updated.

---

## Findings

### Minor Issues

#### M01: Unbounded exit code Map in opencode-launcher.ts
**File:** `libs/worker-core/src/core/opencode-launcher.ts:19`
```typescript
const exitCodes = new Map<number, number>();
```
**Issue:** Exit codes are stored by PID but never cleaned up. Over time, if many opencode workers are spawned, this Map could grow indefinitely.

**Business impact:** Low — the Map only stores two numbers per worker, and workers are typically finite per session. Practical memory impact is negligible.

**Recommendation:** Consider clearing the exit code entry after `getOpenCodeExitCode()` returns it, or during worker registry removal.

---

#### M02: Catch-all union member allows untyped messages
**File:** `libs/worker-core/src/types.ts:91`
```typescript
export type JsonlMessage = JsonlAssistantMessage | JsonlUserMessage | JsonlSystemMessage | JsonlProgressMessage | { type: string };
```
**Issue:** The final union member `{ type: string }` acts as a catch-all that accepts any object with a `type` field. This weakens type safety when handling JSONL messages.

**Business impact:** Low — this is intentional forward-compatibility for unknown message types in the JSONL format. The code handles unknown types gracefully by skipping them.

**Recommendation:** Document that this is intentional. Consider narrowing to known types if the JSONL schema is stable.

---

#### M03: Defensive PID fallback in process-launcher.ts
**File:** `libs/worker-core/src/core/process-launcher.ts:79`
```typescript
opts.onExit?.(code, signal, pid ?? 0);
```
**Issue:** If `child.pid` is `undefined` at exit time, the callback receives `0` as the PID. This could mask an error condition.

**Business impact:** Low — in practice, if `child.pid` is undefined, the spawn would have failed earlier (line 82-86 throws). This fallback is defensive but unlikely to trigger.

**Recommendation:** No change required — the guard at line 82-86 ensures PID is defined before exit handlers run.

---

### Informational

#### I01: Type assertions used for JSON parsing
**Files:**
- `libs/worker-core/src/core/jsonl-watcher.ts:195-196` (`resultMsg.usage as Record<string, number>`)
- `libs/worker-core/src/core/jsonl-watcher.ts:251` (`input as Record<string, string>`)
- `libs/worker-core/src/core/worker-registry.ts:34` (`worker as Partial<Worker>`)
- `apps/session-orchestrator/src/tools/spawn-worker.ts:101,147` (`msg as JsonlMessage`)

**Note:** These assertions are necessary for handling parsed JSON from external sources (JSONL files, stdout). They are acceptable given the data comes from known Claude CLI output.

---

#### I02: Optimistic locking pattern in file-watcher.ts
**File:** `libs/worker-core/src/core/file-watcher.ts:89-92`
```typescript
sub.satisfied = true;
this.evaluateCondition(workerId, condition, absolutePath, sub).catch((err) => {
  process.stderr.write(`[file-watcher] error evaluating condition for ${workerId}: ${err}\n`);
});
```
**Note:** The optimistic lock pattern (set `satisfied = true` synchronously, reset if condition fails) is correct and prevents race conditions when multiple file events fire in quick succession.

---

## Verified Logic

The following business logic was reviewed and found correct:

1. **Event Queue** (`event-queue.ts`): `drain()` correctly empties and returns queue contents using `splice(0)`.

2. **File Watcher** (`file-watcher.ts`):
   - Path traversal protection validates all paths stay within `working_directory`
   - `followSymlinks: false` prevents symlink escape attacks
   - Retry logic for transient file read failures (atomic rename scenarios)

3. **Token Calculator** (`token-calculator.ts`): Pricing lookup with fallback to zero-cost for unknown models.

4. **Worker Registry** (`worker-registry.ts`): Atomic file writes (write .tmp then rename) for crash safety.

5. **JSONL Watcher** (`jsonl-watcher.ts`):
   - Compaction detection heuristic (70% drop threshold) is documented and intentional
   - Auto-close logic waits 10s after end_turn before killing worker
   - Final stats read before marking worker completed

6. **Import consolidation**: All modified files in `apps/session-orchestrator` correctly import from `@nitro-fueled/worker-core` instead of local paths.

---

## Files Reviewed

| File | Status |
|------|--------|
| libs/worker-core/package.json | OK |
| libs/worker-core/project.json | OK |
| libs/worker-core/tsconfig.json | OK |
| libs/worker-core/src/index.ts | OK |
| libs/worker-core/src/types.ts | Minor (M02) |
| libs/worker-core/src/core/event-queue.ts | OK |
| libs/worker-core/src/core/file-watcher.ts | OK |
| libs/worker-core/src/core/iterm-launcher.ts | OK |
| libs/worker-core/src/core/jsonl-watcher.ts | OK |
| libs/worker-core/src/core/opencode-launcher.ts | Minor (M01) |
| libs/worker-core/src/core/print-launcher.ts | OK |
| libs/worker-core/src/core/process-launcher.ts | Minor (M03) |
| libs/worker-core/src/core/token-calculator.ts | OK |
| libs/worker-core/src/core/worker-registry.ts | OK |
| apps/session-orchestrator/package.json | OK |
| apps/session-orchestrator/src/index.ts | OK |
| apps/session-orchestrator/src/tools/spawn-worker.ts | OK |
| apps/session-orchestrator/src/tools/subscribe-worker.ts | OK |
| apps/session-orchestrator/src/tools/get-pending-events.ts | OK |

---

## Conclusion

The refactoring is logically sound. All business logic from `apps/session-orchestrator/src/core/` has been correctly extracted to `libs/worker-core/src/core/` with no functional changes. The consuming application's imports are properly updated to use the new package. The 3 minor issues identified are low-impact edge cases that do not affect correctness.
