# Task: Add MCP server management API endpoints (backend)


## Metadata

| Field                 | Value                                                                         |
|-----------------------|-------------------------------------------------------------------------------|
| Type                  | FEATURE |
| Priority              | P1-High |
| Complexity            | Medium |
| Preferred Tier        | auto |
| Model                 | default |
| Testing               | optional |
| Poll Interval         | default |
| Health Check Interval | default |
| Max Retries           | default |
| Worker Mode           | [single | split]                                                              |







## Description

Add backend endpoints for MCP server management. Currently no API exists — McpIntegrationsComponent is 100% mock.

## Endpoints to add
- GET /api/mcp/servers — list installed MCP servers
- POST /api/mcp/servers — install new MCP server (NPM package or local path)
- DELETE /api/mcp/servers/:id — remove server
- POST /api/mcp/servers/:id/restart — restart server
- GET /api/mcp/tool-access — tool access compatibility matrix

## Data source
Read from Claude Code settings / MCP config file (claude_desktop_config.json or .mcp.json)

## Acceptance Criteria
- All 5 endpoints implemented and returning real data
- POST /api/mcp/servers validates input
- DELETE and restart actions work

## Dependencies

- None

## Acceptance Criteria

- [ ] GET /api/mcp/servers returns real server list
- [ ] POST /api/mcp/servers installs a server
- [ ] DELETE /api/mcp/servers/:id removes server
- [ ] POST /api/mcp/servers/:id/restart works
- [ ] GET /api/mcp/tool-access returns matrix data

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard-api/src/dashboard/dashboard.controller.ts


## Parallelism

Independent. Backend only. Can run in parallel with TASK_2026_304 (MCP frontend).
