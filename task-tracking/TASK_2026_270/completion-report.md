# Completion Report — TASK_2026_270

## Files Modified
- packages/mcp-cortex/src/tools/workers.ts — added `launcher?: string` param to handleSpawnWorker; overrides provider when launcher='codex' or 'opencode'
- packages/mcp-cortex/src/tools/providers.ts — added toClientLauncherName() normalizing 'claude'/'glm' → 'claude-code' in provider output
- packages/mcp-cortex/src/index.ts — added launcher param to spawn_worker MCP tool schema, updated description
- packages/mcp-cortex/src/tools/workers.spec.ts — added 3 unit tests for launcher param behavior

## Review Scores
| Review | Score |
|--------|-------|
| Code Style | skipped |
| Code Logic | skipped |
| Security | skipped |

## Findings Fixed
- No review run (skipped per user instruction)

## New Review Lessons Added
- none

## Integration Checklist
- [x] All existing tests pass (17 existing + 3 new = 20 total)
- [x] Backward compatible: `provider` param still works as before; `launcher` is additive
- [x] `probeLauncher('glm')` internal probe key unchanged — only the display name changes
- [x] Index.ts schema updated — MCP tool exposes the new param to callers

## Verification Commands
```bash
# Run unit tests:
cd packages/mcp-cortex && npx vitest run src/tools/workers.spec.ts

# Verify launcher param in schema:
grep -A5 "launcher" packages/mcp-cortex/src/index.ts | grep "claude-code"

# Verify providers normalization:
grep "toClientLauncherName" packages/mcp-cortex/src/tools/providers.ts
```
