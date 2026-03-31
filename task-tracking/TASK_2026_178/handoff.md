# Handoff — TASK_2026_178

## Files Changed
- apps/dashboard/src/app/app.component.ts (modified, +1 -1)
- apps/dashboard/src/app/layout/header/header.component.ts (modified, +2 -1)
- apps/dashboard/src/app/layout/layout.component.ts (modified, +2 -1)
- apps/dashboard/src/app/layout/sidebar/sidebar.component.ts (modified, +2 -1)
- apps/dashboard/src/app/layout/status-bar/status-bar.component.ts (modified, +4 -2)
- apps/dashboard/src/app/views/mcp/compatibility-matrix/compatibility-matrix.component.ts (modified, +2 -1)
- apps/dashboard/src/app/views/mcp/integrations-tab/integrations-tab.component.ts (modified, +2 -1)
- apps/dashboard/src/app/views/mcp/mcp-integrations.component.ts (modified, +2 -1)
- apps/dashboard/src/app/views/models/assignments-table/assignments-table.component.ts (modified, +2 -1)
- apps/dashboard/src/app/views/models/model-assignments.component.ts (modified, +2 -1)
- apps/dashboard/src/app/views/models/preset-cards/preset-cards.component.ts (modified, +2 -1)
- apps/dashboard/src/app/views/placeholder-view.component.ts (modified, +2 -1)

## Commits
- (pending implementation commit)

## Decisions
- status-bar.component.ts uses effect() to update regular class properties (indicators, mcpCount, budget). With OnPush, these mutations don't trigger re-render automatically. Added ChangeDetectorRef.markForCheck() at end of the effect instead of converting properties to signals — minimal change, preserves existing template syntax.
- All other components already use signal inputs, async pipe, or immutable data — safe for OnPush without additional changes.

## Known Risks
- mcp-integrations.component.ts has mutable activeTab and serverFormModel properties, but all mutations are triggered by DOM events (click, submit) so OnPush's event-based CD trigger covers them.
- assignments-table.component.ts has mutable subAgentsExpanded toggled by click events — covered by OnPush's event trigger.
