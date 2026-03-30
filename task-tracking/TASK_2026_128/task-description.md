# Task Description — TASK_2026_128

## Goal

Move inline view-model interfaces out of the dashboard analytics and agent-editor source files into shared model modules.

## Requirements

- Keep `dashboard.component.ts` free of inline interface declarations.
- Add named analytics view-model interfaces to `apps/dashboard/src/app/models/analytics.model.ts`.
- Add `AgentMetadata` to `apps/dashboard/src/app/models/agent-editor.model.ts`.
- Update consuming files to import the extracted types.
- Preserve current dashboard behavior.

## Acceptance Criteria

- No inline interface/type definitions remain in `analytics.component.ts` and `agent-editor.store.ts`.
- `DailyCostBar`, `TeamCardView`, `AgentRow`, and `ClientBar` are defined in `analytics.model.ts` and used in `analytics.component.ts`.
- `AgentMetadata` is defined in `agent-editor.model.ts` and imported in `agent-editor.store.ts`.
- `dashboard.component.ts` remains compliant with the module-scope model rule in the current codebase.
