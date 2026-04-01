# Task: Wire MCP Integrations frontend to real API


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

McpIntegrationsComponent (/mcp) is 100% mock. Wire it to the real backend endpoints created in TASK_2026_303.

## Current state
- Uses MOCK_MCP_SERVERS, MOCK_MCP_TOOL_ACCESS, MOCK_MCP_INTEGRATIONS
- File: apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts

## What to do
1. Add ApiService methods: getMcpServers(), addMcpServer(), removeMcpServer(), restartMcpServer(), getMcpToolAccess()
2. Wire Servers tab to real API
3. Wire add server form submit to POST endpoint
4. Wire restart/remove actions
5. Remove all MOCK_MCP_* imports

## Acceptance Criteria
- Servers tab shows real MCP servers from API
- Add server form calls POST endpoint
- Restart/remove actions work
- All MOCK_MCP_* constants removed

## Dependencies

- TASK_2026_303

## Acceptance Criteria

- [ ] Servers tab loads from GET /api/mcp/servers
- [ ] Add server form submits to POST /api/mcp/servers
- [ ] Remove action calls DELETE /api/mcp/servers/:id
- [ ] MOCK_MCP_* constants removed from component

## References

- task-tracking/task-template.md

## File Scope

- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts
- apps/dashboard/src/app/services/api.service.ts


## Parallelism

Depends on TASK_2026_303 (MCP backend). Can run in parallel with settings and agent tasks.
