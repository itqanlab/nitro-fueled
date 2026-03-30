# Task: Agent Editor view

## Metadata

| Field      | Value           |
|------------|-----------------|
| Type       | FEATURE         |
| Priority   | P1-High         |
| Complexity | Complex         |
| Model      | claude-opus-4-6 |
| Testing    | skip            |

## Description

Implement the Agent Editor view at route `/agents` matching the N.Gine mockup. 3-column split layout: Left panel (~25% width) — metadata form: agent name ("team-leader"), version badge (v4), category badge (Engineering); form fields: Name, Display Name, Category dropdown, Tags input (chip-style: universal, coordination, git), Type dropdown (Base Template/Stack Module), Used In projects list, MCP Tool Access checkboxes (Filesystem ✓, GitHub ✓, Context7 ✓, Figma ✗, Playwright ✗), Knowledge Scope badges (Global, Project, Team), Version Changelog textarea, Breaking Change toggle, Compatibility list. Middle panel (~40%) — markdown editor: toolbar buttons (Bold, Italic, Heading, List, Code, Link), tab selector (Split active/Editor/Preview), text editor area with monospace font showing markdown with syntax coloring; integrate ngx-codemirror or a textarea with line numbers. Right panel (~35%) — live markdown preview rendered as HTML using ngx-markdown. Bottom action bar: editor status (Line/Col, total lines), "Preview Diff from v3" button, "Save Draft" button, "Save as v4" button. Agent list visible in left sidebar showing 14 agents; clicking one loads it.

## Dependencies

- TASK_2026_077 — provides the shell layout and MockDataService

## Acceptance Criteria

- [ ] 3-column layout renders at correct proportions matching the mockup
- [ ] Metadata panel renders all fields including MCP tool access checkboxes and knowledge scope badges
- [ ] Editor toolbar buttons insert correct markdown syntax at cursor position
- [ ] Tab switcher (Split/Editor/Preview) shows/hides panels correctly
- [ ] Preview panel renders live markdown to HTML (heading hierarchy, bold, lists, code blocks)
- [ ] Bottom action bar displays line/col status and Save Draft / Save as vN buttons

## References

- /Volumes/SanDiskSSD/mine/software-house/mockups/agent-editor.html

## File Scope

- apps/dashboard/src/app/views/agents/agent-editor.component.ts
- apps/dashboard/src/app/views/agents/agent-editor.component.html
- apps/dashboard/src/app/views/agents/agent-editor.component.scss
- apps/dashboard/src/app/views/agents/metadata-panel/metadata-panel.component.ts
- apps/dashboard/src/app/views/agents/markdown-editor/markdown-editor.component.ts
- apps/dashboard/src/app/views/agents/markdown-preview/markdown-preview.component.ts
