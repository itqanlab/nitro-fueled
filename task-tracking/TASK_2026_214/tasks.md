# Development Tasks — TASK_2026_214
## Orchestration Flow Editor — CRUD & Persistence

---

## Batch 1: DB Schema + Backend Service — COMPLETE**Developer**: nitro-backend-developer

### Task 1.1: Add custom_flows table and custom_flow_id migration to schema

**File**: `packages/mcp-cortex/src/db/schema.ts`
**Status**: COMPLETE

Add `CUSTOM_FLOWS_TABLE` DDL constant:

```sql
CREATE TABLE IF NOT EXISTS custom_flows (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  source_flow_id TEXT,
  phases_json   TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)
```

Add index:
```sql
CREATE INDEX IF NOT EXISTS idx_custom_flows_source ON custom_flows(source_flow_id)
```

Add to `TASK_MIGRATIONS`:
```typescript
{ column: 'custom_flow_id', ddl: 'ALTER TABLE tasks ADD COLUMN custom_flow_id TEXT REFERENCES custom_flows(id)' }
```

Call `db.exec(CUSTOM_FLOWS_TABLE)` and the index in `initDatabase()`.

### Task 1.2: Create CustomFlowsService

**File**: `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts` (new)
**Status**: COMPLETE

Injectable NestJS service. Inject the DB via constructor (use the same injection token
as other dashboard-api DB-accessing services — check `cortex.service.ts` for the pattern).

Implement all methods listed in plan.md §2:
- `create`, `findAll`, `findOne`, `update`, `updatePhases`, `delete`
- `setTaskFlowOverride(taskId, flowId | null)`, `getTaskFlowOverride(taskId)`

`phases_json` is serialized/deserialized with `JSON.parse/stringify`. Return plain objects
matching `CustomFlowRecord` shape.

### Task 1.3: Add new types to types.ts

**File**: `apps/dashboard-api/src/dashboard/orchestration/types.ts`
**Status**: COMPLETE

Add interfaces:
- `CustomFlowRecord` — DB row shape
- `CreateCustomFlowDto` — input for create
- `UpdateCustomFlowDto` — input for update (all optional fields)
- `TaskFlowOverrideRequest` — `{ flowId: string }`

### Task 1.4: Register CustomFlowsService in OrchestrationModule

**File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.module.ts`
**Status**: COMPLETE

Add `CustomFlowsService` to both `providers` and `exports`.

---

## Batch 2: API Controller Extensions — COMPLETE

**Developer**: nitro-backend-developer

### Task 2.1: Add CRUD endpoints to OrchestrationController

**File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts`
**Status**: COMPLETE

Inject `CustomFlowsService`. Add the following methods:

```
POST   /custom-flows              → createCustomFlow(@Body dto)
GET    /custom-flows              → listCustomFlows()
GET    /custom-flows/:id          → getCustomFlowById(@Param id)
PUT    /custom-flows/:id          → updateCustomFlow(@Param id, @Body dto)
DELETE /custom-flows/:id          → deleteCustomFlow(@Param id) → HttpStatus.NO_CONTENT
PUT    /custom-flows/:id/phases   → updateCustomFlowPhases(@Param id, @Body { phases })
POST   /tasks/:taskId/flow-override   → setFlowOverride(@Param taskId, @Body req)
DELETE /tasks/:taskId/flow-override   → clearFlowOverride(@Param taskId)
```

Each method wraps in try/catch and throws `HttpException` on error (consistent with
existing pattern in the controller).

### Task 2.2: Update clone endpoint to persist via CustomFlowsService

**File**: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts`
**Status**: COMPLETE

In the existing `cloneFlow` handler, replace the TODO comment and in-memory response
with a call to `this.customFlowsService.create({ name, description, sourceFlowId, phases })`.
Return the DB-persisted record cast to `CreateFlowResponse`.

---

## Batch 3: Frontend Types + API Service — COMPLETE

**Developer**: nitro-frontend-developer

### Task 3.1: Add CustomFlow types to api.types.ts

**File**: `apps/dashboard/src/app/models/api.types.ts`
**Status**: COMPLETE

Add under `// ── Orchestration flow types` section:

```typescript
export interface CustomFlowPhase {
  readonly order: number;
  readonly agentName: string;
  readonly agentTitle: string;
  readonly optional: boolean;
  readonly estimatedDuration: number;
  readonly deliverables: readonly string[];
}

export interface CustomFlow {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly sourceFlowId?: string;
  readonly phases: readonly CustomFlowPhase[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCustomFlowRequest {
  name: string;
  description?: string;
  sourceFlowId?: string;
  phases?: CustomFlowPhase[];
}

export interface UpdateCustomFlowRequest {
  name?: string;
  description?: string;
  phases?: CustomFlowPhase[];
}
```

### Task 3.2: Add CRUD methods to ApiService

**File**: `apps/dashboard/src/app/services/api.service.ts`
**Status**: COMPLETE

Add to `ApiService`:

```typescript
getCustomFlows(): Observable<CustomFlow[]>
createCustomFlow(dto: CreateCustomFlowRequest): Observable<CustomFlow>
updateCustomFlow(id: string, dto: UpdateCustomFlowRequest): Observable<CustomFlow>
deleteCustomFlow(id: string): Observable<void>
updateCustomFlowPhases(id: string, phases: CustomFlowPhase[]): Observable<CustomFlow>
setTaskFlowOverride(taskId: string, flowId: string): Observable<void>
clearTaskFlowOverride(taskId: string): Observable<void>
```

Use the existing `http.post/put/delete` pattern from the service. Base path:
`/api/dashboard/orchestration`.

---

## Batch 4: Flow Editor Component — COMPLETE

**Developer**: nitro-frontend-developer

### Task 4.1: Create FlowEditorComponent

**Files**:
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts` (new)
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html` (new)
**Status**: COMPLETE

Standalone Angular component. Inputs/outputs:
- `@Input() flow: CustomFlow | null` — null = new flow mode
- `@Output() saved = new EventEmitter<CustomFlow>()`
- `@Output() cancelled = new EventEmitter()`

Internal state: `editedFlow = signal<CustomFlow>()`, `isSaving = signal(false)`.

Template:
- Name field (required) + description textarea
- Phase list (`@for (phase of editedFlow().phases; track phase.order)`):
  - Phase name, agent name (editable inline), optional checkbox
  - ▲ button (disabled at index 0), ▼ button (disabled at last), × remove
- "+ Add Phase" row: text input + "Add" button
- Save / Cancel buttons with `isSaving` spinner guard

No external drag-and-drop dependency. Reorder via index swap.

### Task 4.2: Update orchestration.store.ts with CRUD state

**File**: `apps/dashboard/src/app/views/orchestration/services/orchestration.store.ts`
**Status**: COMPLETE

Add signals: `customFlows`, `selectedCustomFlowId`, `isEditing`.

Add methods: `loadCustomFlows()`, `selectFlowForEdit(id)`, `cancelEdit()`,
`saveCustomFlow(dto)` (create or update depending on whether `selectedCustomFlowId` is set),
`deleteCustomFlow(id)`.

Each method calls the relevant `ApiService` method and updates the signal state.

### Task 4.3: Wire FlowEditorComponent into OrchestrationComponent

**File**: `apps/dashboard/src/app/views/orchestration/orchestration.component.ts`
**File**: `apps/dashboard/src/app/views/orchestration/orchestration.component.html`
**Status**: COMPLETE

- Add "New Custom Flow" button (visible when custom flows tab/filter is active)
- When `store.isEditing()` is true, render `<app-flow-editor>` in the right panel
  instead of the read-only `FlowDetailsComponent`
- Wire `(saved)` and `(cancelled)` outputs to store methods
- Each custom flow in the list shows an "Edit" button → `store.selectFlowForEdit(id)`
- Each custom flow shows a "Delete" button with confirmation → `store.deleteCustomFlow(id)`

---

## Batch 5: Per-Task Flow Override UI — COMPLETE

**Developer**: nitro-frontend-developer

### Task 5.1: Add flow override section to task-detail view

**Files**:
- `apps/dashboard/src/app/views/task-detail/task-detail.component.ts`
- `apps/dashboard/src/app/views/task-detail/task-detail.component.html`
**Status**: COMPLETE

Note: If `task-detail.component.ts` does not exist yet, create a minimal component
file with just the override section and register the route.

Add a "Flow Override" section:
- Label: "Orchestration Flow Override"
- `<select>` dropdown: first option "Default (built-in flow)", then one option per custom flow
- On change: call `apiService.setTaskFlowOverride(taskId, flowId)` or
  `clearTaskFlowOverride(taskId)` if "Default" is selected
- On load: fetch custom flows list + read current `customFlowId` from task data
- Show current assignment with a chip/badge

The task's `customFlowId` should be included in the existing task-detail data fetching
(add to the `TaskDefinition` or `CortexTaskContext` shape if not already present).
