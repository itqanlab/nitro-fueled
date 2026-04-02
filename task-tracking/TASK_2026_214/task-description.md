# Task Description — TASK_2026_214
## Orchestration Flow Editor — CRUD & Persistence

### Overview

Build the editing and persistence layer for orchestration flows on top of the
read-only visualization delivered in TASK_2026_167. Users must be able to create
custom flows from scratch or by cloning a built-in, edit any phase (add, remove,
reorder), and persist their work to the database. A per-task flow override
feature lets individual tasks deviate from the global default.

This task explicitly does **not** include auto-pilot integration (that is split 2/2,
handled separately).

---

### User Stories

1. **As a developer** I want to edit an existing custom flow — adding, removing,
   or reordering phases — so I can tailor the pipeline to my project's needs.

2. **As a developer** I want to create a brand-new custom flow from a blank
   template or by cloning a built-in, so I can start from a known baseline.

3. **As a developer** I want to persist my custom flows to the database so they
   survive server restarts and are shared across team sessions.

4. **As a developer** I want to assign a specific custom flow to a task as an
   override so that individual tasks can use different pipelines.

5. **As a developer** I want to delete custom flows I no longer need.

---

### Scope

#### In scope
- Flow Editor UI: add phase, remove phase, reorder phases (up/down), rename phase
- Custom flow CRUD: create (from scratch or clone), read, update (phases + metadata), delete
- Flow persistence via a new `custom_flows` table in the cortex SQLite DB
- Per-task flow override: a `custom_flow_id` FK column on the tasks table, plus UI on
  the task-detail page to select/clear a flow override
- New REST endpoints on `OrchestrationController` to support all CRUD operations
- `CustomFlowsService` (NestJS) with DB-backed implementation

#### Out of scope
- Auto-pilot using custom flows at runtime (split 2)
- Visual pipeline diagram editing (phases are edited as a list, not by dragging diagram nodes)
- Sharing/exporting flows between projects

---

### Acceptance Criteria

- [ ] Custom flows can be created (new or clone), edited, and deleted via the UI
- [ ] Flow phases can be added, removed, and reordered in the editor
- [ ] All mutations are persisted to the DB and survive a server restart
- [ ] A task's detail page has a "Flow Override" selector to assign/clear a custom flow
- [ ] The task's assigned `custom_flow_id` is stored and returned by the API
- [ ] Built-in flows remain read-only (cannot be edited or deleted)
- [ ] All new API endpoints return appropriate HTTP status codes and error bodies

---

### Technical Constraints

- Must use the existing `better-sqlite3` DB in `packages/mcp-cortex/`
- The `OrchestrationController` prefix `api/dashboard/orchestration` must be retained
- Frontend uses Angular with NgRx Signal Store (same pattern as 167)
- No new npm packages unless strictly necessary

---

### Data Model

#### `custom_flows` table (new)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | `custom-{slug}-{ts}` |
| name | TEXT NOT NULL | display name |
| description | TEXT | optional |
| source_flow_id | TEXT | original built-in flow ID if cloned |
| phases_json | TEXT NOT NULL | JSON array of FlowPhase objects |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

#### `tasks` table (alter)
| Column | Type | Notes |
|--------|------|-------|
| custom_flow_id | TEXT | FK → custom_flows.id (nullable) |

---

### API Contract (new endpoints)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/dashboard/orchestration/custom-flows | Create a new custom flow |
| GET | /api/dashboard/orchestration/custom-flows | List all custom flows |
| GET | /api/dashboard/orchestration/custom-flows/:id | Get one custom flow |
| PUT | /api/dashboard/orchestration/custom-flows/:id | Full update (name, description, phases) |
| DELETE | /api/dashboard/orchestration/custom-flows/:id | Delete a custom flow |
| PUT | /api/dashboard/orchestration/custom-flows/:id/phases | Replace phase list |
| POST | /api/dashboard/tasks/:taskId/flow-override | Assign flow override to task |
| DELETE | /api/dashboard/tasks/:taskId/flow-override | Clear flow override from task |

The existing `POST /flows/clone` endpoint is updated to actually persist the cloned
flow to the DB via `CustomFlowsService`.
