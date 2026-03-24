# Completion Report — TASK_2026_019

## Task: Fix Print Mode Token/Cost Tracking

## Summary

Fixed the MCP session-orchestrator to correctly track token usage and costs for print-mode (headless) Claude Code workers. The core problem was that `--print` mode workers don't write JSONL session files, so the existing JSONL file polling approach reported $0/0 tokens for all print-mode workers.

## Implementation

### Approach
Changed the output format from `text` to `stream-json` in print-launcher, added a real-time stdout JSON parser, and wired parsed messages into the existing accumulator system via a new `feedMessage()` bridge method.

### Key Changes (session-orchestrator repo)
1. **`print-launcher.ts`**: Changed `--output-format text` to `stream-json`, added line-buffered stdout parser with `onMessage` callback, added stdout buffer flush on close
2. **`jsonl-watcher.ts`**: Added `feedMessage()` public method for print-mode workers, added print-mode branching in poll loop, extracts authoritative cumulative totals from `result` message
3. **`index.ts`**: Removed 30s session resolution loop, registers worker with synthetic session ID, wires `onMessage` callback to `feedMessage`
4. **`types.ts`**: Added `'starting'` to HealthStatus, made cache token fields optional
5. **`get-worker-activity.ts` / `get-worker-stats.ts`**: Added starting health status (dead code — noted for future cleanup)

### Review Fixes Applied
- Guarded `child.pid` spawn failure with descriptive error
- Flushed stdout buffer on close to capture final messages
- Added null guard on `assistant.message?.usage`
- Made cache token fields optional in TokenUsage
- Cleaned up accumulators for completed workers (memory leak fix)
- Used `crypto.randomUUID()` for print session IDs (collision fix)
- Added path traversal guard in `resolveJsonlPath`
- Removed unused imports and dead variables
- Extracted authoritative token totals from `result` message (stream-json has placeholder output_tokens in assistant messages)

## Review Results

| Reviewer | Verdict | Blocking | Serious | Minor |
|----------|---------|----------|---------|-------|
| Style    | PASS_WITH_NOTES | 3 | 5 | 5 |
| Logic    | FAIL→PASS (after fixes) | 2 | 5 | 3 |
| Security | PASS_WITH_NOTES | 0 | 0 | 7 |

All blocking and serious findings were fixed. Remaining notes (not fixed — pre-existing or out of scope):
- Health logic triplication (extract to shared utility) — pre-existing architecture debt
- Dead `src/tools/` module files — pre-existing, never imported
- `appendFileSync` in hot path — low priority, acceptable for current load

## Commits (session-orchestrator repo)
1. `926b21a` — Original implementation
2. `4d1dbbc` — Review fixes (guard, flush, null check, optional types, memory leak, collision, traversal)
3. `a90309a` — Extract authoritative totals from result message

## Status
COMPLETE
