# Task: MCP Integrations view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Medium          |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the MCP Integrations view at route `/mcp` matching the N.Gine mockup. Tab navigation bar: "MCP Servers" (active) and "Integrations". MCP Servers tab: server list table with columns Server name, Status (colored dot — green connected, yellow warning, red error), Tools count badge, Provider Type badge (MCP/API/etc.) — rows: Filesystem (8 tools, connected), GitHub (12 tools, connected), Context7 (15 tools, error). Compatibility matrix: a grid table with agent names as rows (team-leader, architect, backend-dev, code-logic-reviewer, code-style-reviewer, ui-ux-designer) and tool names as columns (Filesystem, GitHub, Context7, Figma, Playwright) — cells show checkmark (enabled) or ✗ (disabled). Add Server card below the table: NPM package/path text input, transport type dropdown, "Browse MCP Directory" link. Integrations tab: 5 provider cards in a responsive grid (GitHub Connected, Slack Connected, Jira Not connected, Figma Connected via MCP, Notion Not connected) — each card shows icon, name, status badge, config detail text, auto-feature toggle, and action buttons. All data from MockDataService.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] Tab navigation switches between MCP Servers and Integrations panels
- [ ] Server table renders rows with correct status dot colors (green/yellow/red)
- [ ] Compatibility matrix renders as a 6×5 grid with checkmark/X cells
- [ ] Add Server card renders with text input, transport select, and directory link
- [ ] Integrations tab renders 5 provider cards with status badges and action buttons

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/mcp-integrations.html

## File Scope

- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.html
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.scss
- apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts
- apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts
