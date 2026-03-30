# Task: Extract inline interfaces from dashboard/analytics/agent-editor components to model files

## Metadata

| Field                 | Value        |
|-----------------------|--------------|
| Type                  | REFACTORING  |
| Priority              | P2-Medium    |
| Complexity            | Simple       |
| Preferred Tier        | light        |
| Model                 | default      |
| Testing               | skip         |

## Description

Part 2 of 2 — original request: Extract inline constants and interfaces to dedicated model/constants files in dashboard Angular app (TASK_2026_092 follow-on, findings C4, C5, C6).

Three components define interfaces or anonymous types inline, violating the "one interface/type per file" rule:

**C4 — dashboard.component.ts**: `QuickAction` and `TeamGroup` interfaces are defined at lines 19–28 inside the component file. Move them to `apps/dashboard/src/app/models/dashboard.model.ts` (create the file if it does not exist). Update the import in the component.

**C5 — analytics.component.ts**: Four public fields use anonymous inline array element types (`dailyCostBars`, `teamCardsView`, `agentRows`, `clientBars`). Extract each shape as a named interface (`DailyCostBar`, `TeamCardView`, `AgentRow`, `ClientBar`) into `apps/dashboard/src/app/models/analytics.model.ts`. Update field declarations to use the new named types.

**C6 — agent-editor.store.ts**: `AgentMetadata` interface is defined at lines 13–23 inside the store file. Move it to `apps/dashboard/src/app/models/agent-editor.model.ts` (already exists). Update all references in the store.

## Dependencies

- TASK_2026_092 — provides the component files to refactor

## Acceptance Criteria

- [ ] QuickAction and TeamGroup defined in dashboard.model.ts and imported in dashboard.component.ts
- [ ] DailyCostBar, TeamCardView, AgentRow, ClientBar named interfaces in analytics.model.ts; used in analytics.component.ts field declarations
- [ ] AgentMetadata defined in agent-editor.model.ts and imported in agent-editor.store.ts
- [ ] No inline interface/type definitions remain in the three component/store files
- [ ] No behaviour change — component functionality is identical

## Parallelism

✅ Can run in parallel with TASK_2026_127 — no file scope overlap between the two split tasks.

## References

- apps/dashboard/src/app/views/dashboard/dashboard.component.ts
- apps/dashboard/src/app/views/analytics/analytics.component.ts
- apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts
- apps/dashboard/src/app/models/
- TASK_2026_092 review findings C4, C5, C6

## File Scope

- apps/dashboard/src/app/views/dashboard/dashboard.component.ts (VERIFIED — already compliant; no inline `QuickAction`/`TeamGroup` remain)
- apps/dashboard/src/app/models/dashboard.model.ts (NOT NEEDED — no dashboard model extraction required in current worktree)
- apps/dashboard/src/app/views/analytics/analytics.component.ts (MODIFIED — inline types replaced with named types)
- apps/dashboard/src/app/models/analytics.model.ts (MODIFIED — 4 named interfaces added)
- apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts (MODIFIED — AgentMetadata removed)
- apps/dashboard/src/app/models/agent-editor.model.ts (MODIFIED — AgentMetadata added)
