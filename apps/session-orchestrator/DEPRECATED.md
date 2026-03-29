# DEPRECATED — session-orchestrator

This MCP server has been merged into `packages/mcp-cortex` (nitro-cortex).

All tools previously served by session-orchestrator are now available in nitro-cortex:

- `spawn_worker`
- `list_workers`
- `get_worker_stats`
- `get_worker_activity`
- `kill_worker`
- `emit_event`
- `subscribe_worker`
- `get_pending_events`

## Migration

Update your `.mcp.json` to use `nitro-cortex` only. Remove the `session-orchestrator` entry.

Run `npx nitro-fueled init --cortex-path <path>` to configure the new single MCP server,
where `<path>` points to the `packages/mcp-cortex` directory in this repository.
