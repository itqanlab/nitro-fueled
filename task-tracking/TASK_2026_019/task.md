# Task: Fix Print Mode Token/Cost Tracking

## Metadata

| Field      | Value      |
|------------|------------|
| Type       | BUGFIX     |
| Priority   | P1-High    |
| Complexity | Medium     |

## Description

The MCP session-orchestrator reports $0 and 0 tokens for every worker spawned in `--print` mode. All 20 completed workers in the last auto-pilot run show identical zeroes for input_tokens, output_tokens, and cost.

**Root cause**: The orchestrator's JSONL watcher (`jsonl-watcher.ts`) expects to find session logs at `~/.claude/projects/<hash>/<session-id>.jsonl`, resolved via `~/.claude/sessions/<pid>.json`. However, `--print` mode (headless) workers don't write these session files. The 60-second background resolution silently times out, so stats stay at zero permanently.

**Fix approach**:
1. Change `--output-format text` to `--output-format stream-json` in `print-launcher.ts` so Claude Code emits structured JSONL to stdout
2. Build a real-time stdout parser that extracts token usage from the subprocess pipe (stdout is already captured — just not parsed for tokens)
3. Feed parsed token data into the existing `WorkerRegistry.updateTokens()` and `updateCost()` methods
4. Keep the existing session JSONL approach as fallback for iTerm mode only
5. Ensure the token-calculator pricing table is used for cost computation from the parsed data

**Key files in session-orchestrator repo** (`/Volumes/SanDiskSSD/mine/session-orchestrator/`):
- `src/core/print-launcher.ts` — spawn args (change output format here)
- `src/core/jsonl-watcher.ts` — current JSONL polling logic (add stdout parsing path)
- `src/core/token-calculator.ts` — pricing table and cost calculation
- `src/core/worker-registry.ts` — in-memory worker state
- `src/index.ts` — MCP tool definitions, spawn_worker handler

## Dependencies

- None

## Acceptance Criteria

- [ ] Workers spawned in `--print` mode report non-zero token counts (input, output, cache)
- [ ] Workers spawned in `--print` mode report non-zero cost (input_usd, output_usd, total_usd)
- [ ] `get_worker_stats` returns accurate token/cost data for print-mode workers
- [ ] iTerm mode continues to work with existing session JSONL approach
- [ ] Token data updates in real-time during worker execution (not only at completion)
- [ ] Cost calculation uses the correct model pricing from token-calculator.ts

## References

- Session orchestrator repo: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- MCP session orchestrator design doc: `docs/mcp-session-orchestrator-design.md`
