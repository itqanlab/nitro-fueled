# Handoff — TASK_2026_189

## Files Changed
- packages/mcp-cortex/src/tools/wave.ts (modified, +8 -1)
- packages/mcp-cortex/src/tools/context.ts (modified, +2 -2)

## Commits
- (pending): fix(cortex): wrap unguarded JSON.parse in try/catch with safe defaults

## Decisions
- Added `Array.isArray()` check in wave.ts parse to handle non-array JSON values (e.g. `"None"` string or `null`)
- Replaced silent `/* ignore */` catch comments with `console.error` warnings in context.ts for better observability while keeping safe defaults
- Did not modify already-guarded calls in spawn.ts (streaming JSONL), providers.ts (config parsing), telemetry.ts (per-worker aggregation), events.ts (event data), handoffs.ts (already in try/catch), index.ts (already in try/catch), tasks.ts (already in try/catch), workers.ts (already has parseTokens/parseCost/parseProgress helpers)

## Known Risks
- wave.ts: malformed dependency data is treated as "no dependencies" which means the task may be picked up when it shouldn't be — however, this matches the behavior already used in tasks.ts and is safer than crashing the entire MCP server
- The console.error warnings in context.ts will appear in stderr but won't be visible to MCP callers — this is intentional (safe default returned to caller, diagnostic logged server-side)
