# Prep Handoff — TASK_2026_214

## Implementation Plan Summary

Build the CRUD & persistence layer for orchestration flows on top of the read-only
visualization from TASK_2026_167. Three-layer addition:

1. **DB layer**: New `custom_flows` table + `custom_flow_id` nullable FK column on
   `tasks` — both added to `packages/mcp-cortex/src/db/schema.ts` using the existing
   `applyMigrations()` pattern for the tasks column, and a new DDL constant + `db.exec()`
   call in `initDatabase()` for the custom_flows table.

2. **Backend CRUD layer**: New `CustomFlowsService` (NestJS Injectable) with full
   DB-backed CRUD + override helpers. Extend `OrchestrationController` with 8 new
   endpoints. Update the existing clone endpoint to persist instead of using an in-memory
   stub.

3. **Frontend editor layer**: New `FlowEditorComponent` (list-based, no D3) + store CRUD
   actions + API service methods + per-task override UI in task-detail.

The implement worker should NOT re-derive the data model or endpoint shape — both are
fully specified in plan.md and tasks.md.

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| `packages/mcp-cortex/src/db/schema.ts` | modify | Add custom_flows table DDL, index, custom_flow_id migration on tasks |
| `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts` | new | DB-backed CRUD for custom flows |
| `apps/dashboard-api/src/dashboard/orchestration/types.ts` | modify | Add CustomFlowRecord, CreateCustomFlowDto, UpdateCustomFlowDto, TaskFlowOverrideRequest |
| `apps/dashboard-api/src/dashboard/orchestration/orchestration.module.ts` | modify | Register CustomFlowsService in providers + exports |
| `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts` | modify | Add 8 new endpoints + update clone to persist |
| `apps/dashboard/src/app/models/api.types.ts` | modify | Add CustomFlow, CustomFlowPhase, CreateCustomFlowRequest, UpdateCustomFlowRequest |
| `apps/dashboard/src/app/services/api.service.ts` | modify | Add 7 new CRUD + override HTTP methods |
| `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts` | new | Standalone editor component (add/remove/reorder phases) |
| `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html` | new | Editor template |
| `apps/dashboard/src/app/views/orchestration/services/orchestration.store.ts` | modify | Add customFlows signal + CRUD methods |
| `apps/dashboard/src/app/views/orchestration/orchestration.component.ts` | modify | Wire FlowEditorComponent into right panel |
| `apps/dashboard/src/app/views/orchestration/orchestration.component.html` | modify | New/Edit/Delete buttons + conditional editor panel |
| `apps/dashboard/src/app/views/task-detail/task-detail.component.ts` | modify (or new) | Flow override dropdown section |
| `apps/dashboard/src/app/views/task-detail/task-detail.component.html` | modify (or new) | Flow override UI |

## Batches

- Batch 1: DB schema + CustomFlowsService + types.ts update + module registration — files: schema.ts, custom-flows.service.ts, types.ts, orchestration.module.ts
- Batch 2: Controller extensions (8 new endpoints + update clone endpoint) — files: orchestration.controller.ts
- Batch 3: Frontend types + ApiService CRUD methods — files: api.types.ts, api.service.ts
- Batch 4: FlowEditorComponent + store CRUD state + orchestration view wiring — files: flow-editor.component.ts/.html, orchestration.store.ts, orchestration.component.ts/.html
- Batch 5: Per-task flow override UI in task-detail — files: task-detail.component.ts/.html

## Key Decisions

- **phases stored as JSON column** (`phases_json TEXT`) on `custom_flows` — avoids N+1
  queries, flows are always read/written as a complete unit, volume is small
- **custom_flow_id as nullable FK column on tasks** (not a separate join table) — simplest
  non-breaking migration for a nullable one-to-one relationship; use `applyMigrations()`
- **List-based phase editor, not D3 drag** — 167 already owns D3 for visualization;
  editor uses a plain ordered list with ▲/▼ buttons; avoids new drag dependency
- **clone endpoint updated in-place** — the `POST /flows/clone` request/response contract
  from 167 is correct; only the body changes (call `customFlowsService.create()`)
- **Frontend path: views/orchestration/** — the app.routes.ts already imports from
  `./views/orchestration/`; use this location for the editor component

## Gotchas

- **167 is IN_REVIEW, not COMPLETE**: The orchestration frontend may live in
  `apps/dashboard/src/app/views/orchestration/` (as per the route) rather than
  `apps/dashboard/src/app/pages/orchestration/` (as per the 167 handoff). Check the
  actual directory before writing the editor component. If neither exists, create it
  under `views/orchestration/` to match the registered route.
- **DB injection pattern**: Check how existing dashboard-api services access the
  `better-sqlite3` DB — look at `cortex.service.ts` or `sessions.service.ts` for the
  injection token pattern. Do NOT open a new DB file; reuse the existing DB instance.
- **custom_flows table must be created in initDatabase()**: Add `db.exec(CUSTOM_FLOWS_TABLE)`
  and the index call alongside the other table creations. The `applyMigrations()` call
  for `custom_flow_id` on tasks must come AFTER the `custom_flows` table is created
  (FK constraint requires the referenced table to exist).
- **Batch ordering matters**: Batch 1 (DB + service) must be committed before Batch 2
  (controller), which must be committed before Batch 3+ (frontend). The implement
  worker should follow batch order.
- **Per-task override endpoint prefix**: The `@Controller` decorator uses
  `api/dashboard/orchestration`. The per-task override routes
  (`/tasks/:taskId/flow-override`) are also under this same controller prefix, making
  them `api/dashboard/orchestration/tasks/:taskId/flow-override`.
- **CustomFlowRecord vs FlowWithMetadata**: Custom flows are NOT `FlowWithMetadata`
  objects (those come from the flow-parsing service for built-ins). Custom flows are
  their own `CustomFlowRecord` shape. The frontend should use a separate signal and
  list to display them alongside (not merged with) built-in flows.
