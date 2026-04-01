# Handoff — TASK_2026_303

## Files Changed
- apps/dashboard-api/src/dashboard/mcp.service.ts (new, ~130 lines) — McpService reading/writing ~/.claude/mcp_config.json
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (modified) — 5 new MCP endpoints + Delete import
- apps/dashboard-api/src/dashboard/dashboard.module.ts (modified) — McpService registered

## Commits
- (see implementation commit)

## Decisions
- Data source is `~/.claude/mcp_config.json` (user-level) + `.mcp.json` (project-level, read-only). User config is writable; project config is read-only.
- Server ID = server name in the config. Validated with `/^[a-zA-Z0-9_.\-]{1,64}$/`.
- Restart is a no-op acknowledgment — stdio servers are managed by Claude Code CLI, not this NestJS process. Returns a note that restart takes effect on next Claude Code session.
- Tool-access matrix returns all agents with full access to all configured servers (no per-agent restrictions in config format).
- resolveProjectRoot() used to locate project-level .mcp.json consistently.

## Known Risks
- No authentication on these endpoints (consistent with the rest of the API — localhost-only server).
- No env var masking: the GET /api/mcp/servers response includes env vars. Sensitive tokens could be exposed if the dashboard is accessible to others.
