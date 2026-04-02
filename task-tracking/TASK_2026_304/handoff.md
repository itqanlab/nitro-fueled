# Handoff — TASK_2026_304

## Files Changed
- apps/dashboard/src/app/services/api.service.ts (modified, +47 lines)
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts (rewritten, 174 lines)
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.html (modified, +2 click handlers)

## Commits
- (included in implementation commit)

## Decisions
- Exported `McpServerEntry`, `McpInstallRequest`, `McpToolAccessMatrix` from `api.service.ts` (co-located with their API methods, consistent with other API types in the file)
- `mapServerEntry()` pure function converts backend shape → frontend display model; defaults icon/teams/tools since backend doesn't carry those display fields
- `activeServerCount` and `totalToolCount` converted from `readonly` class fields to getters — required because `servers` is now mutable state updated after API response
- `takeUntilDestroyed(this.destroyRef)` used for all subscriptions (Angular 16+ pattern, consistent with rest of dashboard)
- `MOCK_MCP_INTEGRATIONS` retained for the Integrations tab since no backend for integrations exists yet (only Servers tab was in scope)

## Known Risks
- Restart action uses `server.name` as the ID — backend `McpServerEntry` has an `id` field but the component's `McpServer` display model doesn't carry it; if backend enforces UUID-based routing for restart/remove, this will fail. A future task should propagate `id` through the display model.
- Tool access matrix rows are empty on initial load until `getMcpToolAccess()` resolves; `CompatibilityMatrixComponent` must handle empty `toolAccess` gracefully.
