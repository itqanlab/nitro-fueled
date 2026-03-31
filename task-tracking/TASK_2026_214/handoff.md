# Handoff — TASK_2026_214
## Orchestration Flow Editor — CRUD & Persistence

**Status**: IMPLEMENTED
**Date**: 2026-03-31
**Agent**: nitro-frontend-developer
**Session**: SESSION_2026-03-31T04-03-16

---

## What Was Built

Full CRUD & persistence layer for custom orchestration flows across 5 batches:

**Batch 1 — DB Schema + Backend Service**
- `packages/mcp-cortex/src/db/schema.ts`: Restored deleted constants (HANDOFFS_TABLE, EVENTS_TABLE, PHASES_TABLE, REVIEWS_TABLE, FIX_CYCLES_TABLE, INDEXES, TASK_MIGRATIONS, applyMigrations, migrateTasksCheckConstraint). CUSTOM_FLOWS_TABLE was already in HEAD. Added `idx_custom_flows_source` index. `custom_flow_id` migration in TASK_MIGRATIONS.
- `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts` (new): Injectable NestJS service with open-per-call SQLite pattern. CRUD: `create`, `findAll`, `findOne`, `update`, `updatePhases`, `delete`. Task override: `setTaskFlowOverride`, `getTaskFlowOverride`. Uses `node:crypto.randomUUID()` for IDs.
- `apps/dashboard-api/src/dashboard/orchestration/types.ts`: Added `CustomFlowPhaseRecord`, `CustomFlowRecord`, `CreateCustomFlowDto`, `UpdateCustomFlowDto`, `TaskFlowOverrideRequest`.
- `apps/dashboard-api/src/dashboard/orchestration/orchestration.module.ts`: Registered `CustomFlowsService` in providers and exports.

**Batch 2 — Controller**
- `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts`: Updated clone endpoint to persist via `CustomFlowsService`. Added 8 new endpoints: `POST/GET/PUT/DELETE /custom-flows`, `PUT /custom-flows/:id/phases`, `POST/DELETE /tasks/:taskId/flow-override`.

**Batch 3 — Frontend Types + API Service**
- `apps/dashboard/src/app/models/api.types.ts`: Added `CustomFlowPhase`, `CustomFlow`, `CreateCustomFlowRequest`, `UpdateCustomFlowRequest`.
- `apps/dashboard/src/app/services/api.service.ts`: Added 7 methods: `getCustomFlows`, `createCustomFlow`, `updateCustomFlow`, `deleteCustomFlow`, `updateCustomFlowPhases`, `setTaskFlowOverride`, `clearTaskFlowOverride`.

**Batch 4 — Flow Editor Component + Orchestration Wiring**
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts` (new): Standalone Angular component with `@Input() flow`, `@Output() saved`, `@Output() cancelled`. List-based phase editor (up/down/remove/add). No external drag library.
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html` (new): Editor template with name/description fields, phase list with reorder controls, add-phase row.
- `apps/dashboard/src/app/views/orchestration/services/orchestration.service.ts`: Added `customFlows`, `customFlowsLoading`, `selectedCustomFlowId`, `isEditing` signals + CRUD state methods.
- `apps/dashboard/src/app/views/orchestration/orchestration.component.ts`: Injected `OrchestrationService`, imported `FlowEditorComponent`, added `confirmDeleteCustomFlow` and track helpers.
- `apps/dashboard/src/app/views/orchestration/orchestration.component.html`: Added Custom Flows section with New/Edit/Delete buttons and conditional `<app-flow-editor>`.

**Batch 5 — Per-Task Flow Override UI**
- `apps/dashboard/src/app/views/task-detail/task-detail.component.ts`: Added `customFlows` signal (loaded on init), `selectedFlowOverrideId`, `overrideSaving`, `handleFlowOverrideChange`, `selectedFlowOverrideName`.
- `apps/dashboard/src/app/views/task-detail/task-detail.component.html`: Added "Orchestration Flow Override" section with select dropdown and active assignment badge.

---

## Key Decisions

1. **schema.ts repair**: Previous worker accidentally deleted HANDOFFS_TABLE through migrateTasksCheckConstraint body (178 lines removed). Restored all deleted content plus added `idx_custom_flows_source` index per plan.
2. **DB pattern**: Open-per-call (like CortexService but writable) — avoids shared connection state complexity.
3. **No orchestration.store.ts**: `orchestration.service.ts` naming retained per review lesson (`.store.ts` implies NgRx Signal Store).
4. **Phase editor**: List-based with up/down index swap — no external drag dependency, per plan.md key decision.

---

## File Scope

- `packages/mcp-cortex/src/db/schema.ts`
- `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts`
- `apps/dashboard-api/src/dashboard/orchestration/types.ts`
- `apps/dashboard-api/src/dashboard/orchestration/orchestration.module.ts`
- `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts`
- `apps/dashboard/src/app/models/api.types.ts`
- `apps/dashboard/src/app/services/api.service.ts`
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts`
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html`
- `apps/dashboard/src/app/views/orchestration/services/orchestration.service.ts`
- `apps/dashboard/src/app/views/orchestration/orchestration.component.ts`
- `apps/dashboard/src/app/views/orchestration/orchestration.component.html`
- `apps/dashboard/src/app/views/task-detail/task-detail.component.ts`
- `apps/dashboard/src/app/views/task-detail/task-detail.component.html`

---

## Risks / Notes for Review

- The `custom_flow_id` FK on tasks references `custom_flows(id)` without CASCADE — deleting a custom flow while tasks reference it will leave `custom_flow_id` pointing to a deleted row. A review might want to add cascade or a pre-delete check.
- `OrchestrationService` constructor now calls both `loadFlows()` and `loadCustomFlows()` — both are fire-and-forget HTTP observables. If the backend is unavailable, errors are caught and both signals default to `[]`.
- `effect()` in task-detail constructor reads `this.dataSignal()` — Angular requires effects to track signals they read. The `custom_flow_id` field is read from `contextData` which is part of `CortexTaskContext`; adding it to the interface would make this type-safe.
