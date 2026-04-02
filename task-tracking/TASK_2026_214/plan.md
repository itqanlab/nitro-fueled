# Implementation Plan — TASK_2026_214
## Orchestration Flow Editor — CRUD & Persistence

---

## Architecture Overview

This task builds on top of the read-only flow visualization from TASK_2026_167.
The implementation adds three layers:

1. **DB persistence layer** — `custom_flows` table + `custom_flow_id` FK on `tasks`
2. **Backend CRUD layer** — `CustomFlowsService` + extended `OrchestrationController`
3. **Frontend editor** — `FlowEditorComponent` + store/API updates + task override UI

### Dependency Chain

```
packages/mcp-cortex/src/db/schema.ts   ← DB migrations (add tables)
         ↓
apps/dashboard-api/.../custom-flows.service.ts  ← CRUD logic
         ↓
apps/dashboard-api/.../orchestration.controller.ts  ← HTTP endpoints
         ↓
apps/dashboard/src/app/services/api.service.ts  ← Frontend HTTP client
         ↓
apps/dashboard/src/app/views/orchestration/  ← Flow editor UI
apps/dashboard/src/app/views/task-detail/    ← Per-task override UI
```

---

## Key Architectural Decisions

### Decision 1: DB in mcp-cortex, not a separate store
Custom flows are configuration that lives alongside tasks, sessions, and workers.
Adding a `custom_flows` table to the existing `better-sqlite3` DB in
`packages/mcp-cortex/src/db/schema.ts` keeps all persisted state in one file and
reuses the existing migration pattern.  
Alternative (separate JSON file or localStorage) was rejected because it would not
survive multi-instance deployments or be queryable alongside task data.

### Decision 2: phases stored as JSON, not a separate table
Flow phases are always read/written as a complete ordered list. A denormalized
`phases_json TEXT` column on `custom_flows` avoids N+1 queries and keeps updates
atomic. The volume of flows and phases is small (dozens, not thousands).

### Decision 3: per-task override as a nullable FK column on tasks
`ALTER TABLE tasks ADD COLUMN custom_flow_id TEXT` is a simple non-breaking
migration. The FK enforces referential integrity with `custom_flows.id`.  
Alternative (separate `task_flow_overrides` table) adds unnecessary complexity for
a nullable one-to-one relationship.

### Decision 4: list-based phase editor, not diagram editing
TASK_2026_167 uses D3 for pipeline visualization. The editor uses a plain ordered
list with ▲/▼ reorder buttons and an "+ Add Phase" footer. This avoids D3 drag
complexity and keeps scope tight. Users view the D3 diagram and edit in the list
panel side-by-side.

### Decision 5: update clone endpoint to delegate to CustomFlowsService
The `POST /flows/clone` endpoint in `OrchestrationController` already has the right
request/response contract. In 167 it was a stub (no DB write). In 214, it calls
`customFlowsService.create(...)` directly, making it a first-class custom flow.

---

## Backend Implementation

### 1. Schema Changes (`packages/mcp-cortex/src/db/schema.ts`)

Add two DDL constants:

```sql
CREATE TABLE IF NOT EXISTS custom_flows (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  source_flow_id TEXT,
  phases_json  TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_flows_source ON custom_flows(source_flow_id);
```

Add a TASK migration entry to add `custom_flow_id`:

```
{ column: 'custom_flow_id', ddl: 'ALTER TABLE tasks ADD COLUMN custom_flow_id TEXT REFERENCES custom_flows(id)' }
```

### 2. CustomFlowsService (`apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts`)

Injectable NestJS service. Receives the DB instance via constructor injection (same
pattern as other dashboard-api services that access the DB).

Methods:
- `create(dto: CreateCustomFlowDto): CustomFlowRecord`
- `findAll(): CustomFlowRecord[]`
- `findOne(id: string): CustomFlowRecord | null`
- `update(id: string, dto: UpdateCustomFlowDto): CustomFlowRecord`
- `updatePhases(id: string, phases: FlowPhase[]): CustomFlowRecord`
- `delete(id: string): void`
- `setTaskFlowOverride(taskId: string, flowId: string | null): void`
- `getTaskFlowOverride(taskId: string): string | null`

### 3. OrchestrationController Extensions

New endpoints added (alongside existing GET endpoints from 167):

| Method | Route | Handler |
|--------|-------|---------|
| POST | `/api/dashboard/orchestration/custom-flows` | `createCustomFlow` |
| GET | `/api/dashboard/orchestration/custom-flows` | `listCustomFlows` |
| GET | `/api/dashboard/orchestration/custom-flows/:id` | `getCustomFlow` |
| PUT | `/api/dashboard/orchestration/custom-flows/:id` | `updateCustomFlow` |
| DELETE | `/api/dashboard/orchestration/custom-flows/:id` | `deleteCustomFlow` |
| PUT | `/api/dashboard/orchestration/custom-flows/:id/phases` | `updateCustomFlowPhases` |
| POST | `/api/dashboard/tasks/:taskId/flow-override` | `setFlowOverride` |
| DELETE | `/api/dashboard/tasks/:taskId/flow-override` | `clearFlowOverride` |

Existing `POST /flows/clone` → delegates to `customFlowsService.create()` instead of
the in-memory stub.

### 4. types.ts additions

```typescript
export interface CustomFlowRecord {
  id: string; name: string; description?: string;
  sourceFlowId?: string; phases: FlowPhase[];
  createdAt: string; updatedAt: string;
}
export interface CreateCustomFlowDto {
  name: string; description?: string;
  sourceFlowId?: string; phases?: FlowPhase[];
}
export interface UpdateCustomFlowDto {
  name?: string; description?: string; phases?: FlowPhase[];
}
export interface TaskFlowOverrideRequest { flowId: string; }
```

---

## Frontend Implementation

### 5. api.types.ts additions

Mirror backend types on the frontend:
- `CustomFlow`, `CreateCustomFlowRequest`, `UpdateCustomFlowRequest`
- `TaskFlowOverrideRequest`

### 6. api.service.ts additions

New methods in `ApiService`:
- `getCustomFlows(): Observable<CustomFlow[]>`
- `createCustomFlow(dto): Observable<CustomFlow>`
- `updateCustomFlow(id, dto): Observable<CustomFlow>`
- `deleteCustomFlow(id): Observable<void>`
- `updateCustomFlowPhases(id, phases): Observable<CustomFlow>`
- `setTaskFlowOverride(taskId, flowId): Observable<void>`
- `clearTaskFlowOverride(taskId): Observable<void>`

### 7. FlowEditorComponent
(`apps/dashboard/src/app/views/orchestration/flow-editor/`)

Two files: `flow-editor.component.ts` + `flow-editor.component.html`.

Inputs:
- `@Input() flow: CustomFlow` — the flow being edited
- `@Output() saved = new EventEmitter<CustomFlow>()` — emits after save
- `@Output() cancelled = new EventEmitter()` — cancel signal

Template structure:
- Name/description editable fields at top
- Ordered phase list: each phase shows name, agent, optional badge; ▲/▼ buttons, × remove
- "+ Add Phase" button → opens inline form for phase name + agent selection
- Save/Cancel buttons at bottom

No D3, no drag-and-drop library. Plain `@for` loop with index-based swap operations.

### 8. orchestration.store.ts additions

New signals/computed:
- `customFlows: Signal<CustomFlow[]>`
- `selectedCustomFlow: Signal<CustomFlow | null>`
- `isEditing: Signal<boolean>`

New methods:
- `loadCustomFlows()`
- `createCustomFlow(dto)`
- `updateCustomFlow(id, dto)`
- `deleteCustomFlow(id)`
- `selectFlowForEdit(id)`
- `cancelEdit()`

### 9. orchestration.component updates

Wire editor panel into existing layout:
- When `isCustom` filter is active and a custom flow is selected, show `FlowEditorComponent`
  as a side panel (replacing the read-only `FlowDetailsComponent`)
- "New Custom Flow" button → triggers `createCustomFlow` with empty phases, enters edit mode

### 10. Task Detail / Flow Override UI

The existing task-detail view (`apps/dashboard/src/app/views/task-detail/`) gets a new
"Flow Override" section:
- Dropdown: "Default (built-in)" + all custom flow names
- On change → calls `setTaskFlowOverride` or `clearTaskFlowOverride`
- Shows which flow is currently assigned

---

## Batch Decomposition

### Batch 1: DB Schema + Backend Service (backend-developer)
- `packages/mcp-cortex/src/db/schema.ts` — add `custom_flows` table + `custom_flow_id` migration
- `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts` — new service
- `apps/dashboard-api/src/dashboard/orchestration/types.ts` — add new types
- `apps/dashboard-api/src/dashboard/orchestration/orchestration.module.ts` — register service

### Batch 2: API Controller Extensions (backend-developer)
- `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts` — add CRUD + override endpoints
- Update `POST /flows/clone` to persist via `CustomFlowsService`

### Batch 3: Frontend Types + API Service (frontend-developer)
- `apps/dashboard/src/app/models/api.types.ts` — add `CustomFlow` and related types
- `apps/dashboard/src/app/services/api.service.ts` — add CRUD + override methods

### Batch 4: Flow Editor Component (frontend-developer)
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts` — new
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html` — new
- `apps/dashboard/src/app/views/orchestration/services/orchestration.store.ts` — add CRUD state
- `apps/dashboard/src/app/views/orchestration/orchestration.component.ts` — wire editor

### Batch 5: Per-Task Flow Override UI (frontend-developer)
- `apps/dashboard/src/app/views/task-detail/task-detail.component.ts` — add override section
- `apps/dashboard/src/app/views/task-detail/task-detail.component.html` — flow override dropdown

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| 167 orchestration page not yet in `views/orchestration/` | Medium | High | Build flow-editor as a standalone component; wire into whichever directory 167 used |
| `custom_flow_id` FK on tasks breaks existing data | Low | Medium | Use `applyMigrations()` pattern; column is nullable so no existing row is affected |
| Phase JSON deserialization errors | Low | Medium | Validate JSON shape on read; return empty array on parse failure |
| Task-detail view doesn't exist yet | Low | Medium | Check before implementing; if absent, create minimal component |
