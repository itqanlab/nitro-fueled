# Handoff — TASK_2026_142

## Files Changed
- packages/mcp-cortex/src/tools/types.ts (modified — added `isError?: boolean` to ToolResult)
- packages/mcp-cortex/src/events/subscriptions.spec.ts (modified — pass EmitQueue to handleGetPendingEvents)
- apps/cli/src/commands/init.ts (modified — remove session-orchestrator flags/config, single nitro-cortex MCP)
- libs/worker-core/src/types.ts (modified — add `allow_file_fallback` to NitroFueledConfig)
- apps/session-orchestrator/DEPRECATED.md (new — deprecation notice)
- .claude/skills/auto-pilot/SKILL.md (modified — update MCP requirement + cortex availability check)

## Commits
- (implementation commit — see git log)

## Decisions
- `EmitQueue` and `handleEmitEvent` were already present in `packages/mcp-cortex/src/events/subscriptions.ts` and `index.ts` from prior work; only the `ToolResult` type needed `isError?: boolean` added to fix the build
- `detectMcpConfig` import removed from `init.ts` as session-orchestrator detection is no longer needed
- `printSummary` simplified to single `skipCortex` parameter — `mcpConfigured` and `skipMcp` removed
- `allow_file_fallback` is optional with undefined = false semantics (no default= needed)
- auto-pilot SKILL.md: cortex check changed from soft (proceed either way) to hard (STOP unless allow_file_fallback=true)

## Known Risks
- Users with existing `.mcp.json` containing `session-orchestrator` entry will need to remove it manually — no migration tool provided
- The `apps/cli/src/utils/mcp-configure.ts` still exports `configureMcp` (not removed) — existing users who manually call it won't break, but `init` no longer invokes it
- session-orchestrator app itself is not deleted, only deprecated — can be removed in a follow-up task
