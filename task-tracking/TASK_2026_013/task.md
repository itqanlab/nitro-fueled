# Task: MCP Server Dependency Handling

## Metadata

| Field      | Value   |
|------------|---------|
| Type       | DEVOPS  |
| Priority   | P1-High |
| Complexity | Medium  |

## Description

The Supervisor requires the MCP session-orchestrator server to spawn and manage worker sessions. The CLI needs to handle this dependency gracefully — checking if it's configured, guiding setup if not, and verifying connectivity before running.

**What to build:**

1. **MCP configuration check**: Read Claude Code's MCP settings to verify session-orchestrator is configured. Check `~/.claude/settings.json` or project-level `.claude/settings.json` for MCP server entries.

2. **Connectivity test**: Before `run` command, call `list_workers` to verify the MCP server responds. Handle timeout/connection-refused gracefully.

3. **Setup guide**: If MCP server is not configured, display step-by-step setup instructions:
   - Where to get/install session-orchestrator
   - How to configure it in Claude Code settings
   - How to verify it works

4. **Integration with init**: During `npx nitro-fueled init`, ask if the user wants to configure the MCP server. If yes, add the configuration to settings.

## Dependencies

- TASK_2026_008 — CLI scaffold must exist

## Acceptance Criteria

- [ ] CLI detects if MCP session-orchestrator is configured
- [ ] CLI tests MCP connectivity before starting Supervisor
- [ ] Clear setup instructions displayed when MCP is not configured
- [ ] `init` offers to configure MCP server
- [ ] Graceful error message on connection failure (not a crash)
- [ ] Works with both global and project-level MCP settings

## References

- MCP design: `docs/mcp-session-orchestrator-design.md`
- Session orchestrator: `/Volumes/SanDiskSSD/mine/session-orchestrator/`
- Claude Code MCP settings format
