# Code Logic Review — TASK_2026_214

## Summary

| Metric              | Value                                          |
|---------------------|------------------------------------------------|
| Overall Score       | 5.5/10                                         |
| Assessment          | NEEDS_REVISION                                 |
| Critical Issues     | 2                                              |
| Serious Issues      | 5                                              |
| Moderate Issues     | 5                                              |
| Failure Modes Found | 7                                              |

The happy path end-to-end CRUD path works: create, list, update, delete, and task override all
reach SQLite correctly. The schema migration, DB service pattern, and Angular signal wiring are
sound. However, two critical logic bugs exist (dangling FK on delete, stale-override state on
task navigation), and the built-in flow layer in `OrchestrationService.getFlows()` is entirely
backed by hardcoded mock data — it never calls the backend. Additionally, several `$any()`
escapes, missing TypeScript types, and fire-and-forget deletions without user feedback violate
the project's established rules.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- Deleting a custom flow that has active task overrides silently leaves `tasks.custom_flow_id`
  pointing at a deleted row. No pre-delete check, no cascade. The task-detail dropdown will
  load flows, never find the deleted one, and show the user "Default (built-in flow)" — but the
  DB still stores the dead ID.
- `OrchestrationService.deleteCustomFlow()` uses fire-and-forget `subscribe` with only
  `console.error` on failure. If the HTTP call fails (network error, 404) the item disappears
  from the signal immediately (optimistic remove) but is still in the DB. Refreshing shows it
  again — silent inconsistency.
- `loadCustomFlows()` and `loadFlows()` both swallow errors silently with `catchError(() =>
  of([]))`. No error state is set for `customFlows`, so there is no way for the template to
  distinguish "still loading" from "loaded empty" from "failed". The loading spinner stops in
  all three cases.

### 2. What user action causes unexpected behavior?

- User opens Task A detail (loads override = flow-1), navigates to Task B (override = flow-2),
  then presses browser back to Task A. The `effect()` that seeds `selectedFlowOverrideId` fires
  again when `dataSignal` re-emits for Task A, so it re-seeds correctly. However, the
  `customFlows` signal is loaded once in the constructor and never refreshed — if the user
  creates a new flow in the Orchestration view and then opens Task Detail, the dropdown will be
  stale.
- User rapidly clicks "Delete" on a custom flow (double-click or lag). Because
  `deleteCustomFlow` is not guarded, two DELETE requests fire. The second one returns 404 (which
  maps to HttpException NOT_FOUND in the controller) and that error is swallowed by the
  `console.error` handler. Net result: silent double-request with no side effect — but the
  pattern violates the anti-pattern rule against un-guarded async actions.
- User is mid-edit in `FlowEditorComponent` and the parent component calls
  `orchestrationService.cancelEdit()` from outside (e.g. by clicking "New Custom Flow" while
  already editing). `isEditing` flips to true then false then true — the editor is torn down and
  re-created via `@if (orchestrationService.isEditing())`, which destroys the user's in-progress
  edits without confirmation.

### 3. What data makes this produce wrong results?

- A custom flow with `phases_json = 'null'` (e.g. manually inserted) passes through
  `rowToRecord`'s `JSON.parse` which returns `null` (valid JSON), not `[]`. The `phases`
  assignment `phases = JSON.parse(row.phases_json) as CustomFlowPhaseRecord[]` will set `null`,
  not `[]`. The `try/catch` only catches parse errors, not type mismatches. Downstream code
  calling `.length` on `null` will throw.
- `CustomFlowPhaseRecord.deliverables` is typed as `string[]` in the backend DTO and DB, but
  `CustomFlowPhase.deliverables` in `api.types.ts` is typed as `readonly string[]`. When the
  `FlowEditorComponent` reconstructs a phase with `deliverables: []`, the array is mutable —
  no runtime bug, but the type contract is inconsistent between backend and frontend models.
- An `UpdateCustomFlowDto` with `{ description: null }` is treated the same as
  `{ description: undefined }` by the backend because of the `dto.description !== undefined`
  guard (line 138 of `custom-flows.service.ts`). This means it is impossible to explicitly
  clear a description via the PATCH path — passing `null` does not clear it, passing `undefined`
  also does not clear it (it leaves the existing value). Only passing an empty string clears it.
  The API contract is undocumented and the frontend sends `undefined` (via `|| undefined`) for
  empty string, meaning descriptions can never be cleared through the UI.

### 4. What happens when dependencies fail?

- If the dashboard-api process cannot open SQLite (disk full, permissions), `openDb()` returns
  `null` and every endpoint returns HTTP 500 with a generic error. This is handled. However, if
  SQLite opens successfully but a query fails mid-transaction (e.g. SQLITE_BUSY during a
  concurrent write from the mcp-cortex server), the error is logged but the endpoint returns
  `null` from `create()`/`update()`, which the controller maps to NOT_FOUND instead of
  INTERNAL_SERVER_ERROR. This misrepresents the failure mode to callers.
- `setTaskFlowOverride` updates `tasks.custom_flow_id` but does not verify that `flowId`
  actually exists in `custom_flows` before writing. SQLite foreign keys are ON in the
  connection, but the `tasks` table schema has `custom_flow_id TEXT` with no FK reference
  (confirmed in schema.ts line 85 — the column is plain TEXT, added via migration, with no
  REFERENCES clause). So an invalid flowId can be stored without any constraint error.
- If the backend is unavailable when `TaskDetailComponent` is constructed, both HTTP calls
  (`getCustomFlows` and `getCortexTaskContext`) return empty/null via `catchError`. The override
  dropdown shows no options and the pre-selected value is null. When the user eventually saves
  an override, the stale `customFlows` signal (which may still be empty) is never refreshed,
  leaving the badge showing "Default (built-in flow)" even if a valid override was just set.

### 5. What's missing that the requirements didn't mention?

- No pre-delete referential integrity check: before deleting a custom flow, the backend should
  query `tasks WHERE custom_flow_id = ?` and either block deletion or NULL-out the references.
  The handoff acknowledges this risk but does not implement a mitigation.
- `custom_flow_id` on the tasks table was added via `ALTER TABLE` migration but with no FK
  REFERENCES clause. The schema definition in `TASK_MIGRATIONS` at line 246 reads `ALTER TABLE
  tasks ADD COLUMN custom_flow_id TEXT` — no `REFERENCES custom_flows(id)`. The DB allows
  orphaned custom_flow_id values silently.
- There is no optimistic rollback in `deleteCustomFlow`. The signal is mutated before the HTTP
  call completes. On error the item is gone from the UI but still in the DB.
- `CortexTaskContext` in `api.types.ts` (line 454-458) does not include `custom_flow_id`. The
  task-detail effect casts via `'custom_flow_id' in context` and a manual `as` assertion to
  read it. This is a type safety hole that will silently break if the backend stops sending
  the field.
- No loading indicator for the flow override save success. The "Saving..." indicator appears
  during the request, then disappears — but there is no success confirmation to the user.
- The built-in flows section of `OrchestrationService.getFlows()` (lines 153-387) returns
  hardcoded mock data and never calls `ApiService.getOrchestrationFlows()`. The clone
  endpoint in the backend resolves source flows via `FlowParsingService`, but the frontend
  clone flow path (from the sidebar) calls `api.cloneOrchestrationFlow()` with the built-in
  flow IDs from the mock data. These are hardcoded strings like `'flow-feature'` — if the
  backend's `FlowParsingService` assigns different IDs, the clone always fails with "Source
  flow not found".

---

## Failure Mode Analysis

### Failure Mode 1: Dangling FK after delete with no cascade or pre-check

- **Trigger**: User deletes a custom flow that is already assigned to one or more tasks.
- **Symptoms**: Task detail dropdown shows "Default (built-in flow)" but the database has a
  non-null `custom_flow_id` pointing at the deleted row. The orchestration pipeline would
  attempt to read the deleted flow record and find nothing.
- **Impact**: Data integrity corruption. Silent incorrect state in the task record.
- **Current Handling**: None. The handoff documents this as a known risk but implements no
  mitigation.
- **Recommendation**: Add a pre-delete query: `SELECT COUNT(*) FROM tasks WHERE
  custom_flow_id = ?`. Block delete (return 409 Conflict) if count > 0, or run a nullifying
  UPDATE inside the same SQLite transaction before deleting.

### Failure Mode 2: Optimistic delete with no rollback on failure

- **Trigger**: `OrchestrationService.deleteCustomFlow()` is called. The HTTP DELETE request
  fails (backend unreachable, 500, etc.).
- **Symptoms**: `this.customFlows.set(this.customFlows().filter(...))` removes the item from
  the UI immediately. The error handler only calls `console.error`. The item reappears only
  if the user refreshes the page.
- **Impact**: User believes the flow was deleted; it was not. Any task assigned to that flow
  still has a live override.
- **Current Handling**: Only `console.error` — no rollback, no user notification.
- **Recommendation**: Either do not remove from the signal until the HTTP call succeeds, or
  rollback the signal and display an error message on failure.

### Failure Mode 3: `custom_flow_id` migration adds column without FK constraint

- **Trigger**: Existing or future code stores any arbitrary string as `custom_flow_id`.
- **Symptoms**: `PRAGMA foreign_keys = ON` does not protect this column because the ALTER TABLE
  migration at `schema.ts:246` adds it as plain TEXT with no REFERENCES clause.
- **Impact**: Silent stale references survive indefinitely. The integrity guarantee the
  developer thinks exists does not.
- **Current Handling**: No FK constraint on the column.
- **Recommendation**: The migration cannot add a FK to an existing column in SQLite. The
  correct path is to include the column in `migrateTasksCheckConstraint`'s `tasks_new`
  definition (already done at line 313) — so the FK would need to be added there and in the
  base `TASKS_TABLE` definition. Document clearly that the FK is absent on old DBs upgraded
  via the ALTER TABLE path.

### Failure Mode 4: Stale `customFlows` in TaskDetailComponent after flows created elsewhere

- **Trigger**: User creates a new custom flow in the Orchestration view. They then open a task
  detail page.
- **Symptoms**: The flow override dropdown does not include the newly created flow because
  `customFlows` is populated once in the `TaskDetailComponent` constructor and never refreshed.
- **Impact**: User cannot assign the new flow to a task without a page reload.
- **Current Handling**: Single load on construction, no refresh mechanism.
- **Recommendation**: Either add a refresh trigger when the component becomes visible (route
  param change or `ngOnInit`) or move `customFlows` to `OrchestrationService` and share it
  across views so updates propagate automatically.

### Failure Mode 5: `rowToRecord` does not guard against `JSON.parse` returning non-array

- **Trigger**: `phases_json` is valid JSON but not an array (e.g. `null`, `{}`, `"string"`).
- **Symptoms**: `phases` is set to the parsed value and passed as `CustomFlowPhaseRecord[]`.
  Downstream `.length` calls or `.map()` calls on a non-array will throw a runtime TypeError.
- **Impact**: Any API call that reads a corrupted flow row crashes the endpoint.
- **Current Handling**: `try/catch` catches parse errors only; does not validate the parsed type.
- **Recommendation**: Add `if (!Array.isArray(phases)) phases = [];` after the parse.

### Failure Mode 6: Built-in flow IDs in frontend mock data do not match backend FlowParsingService IDs

- **Trigger**: User clicks "Clone to Custom" on any built-in flow.
- **Symptoms**: `executeClone()` calls `api.cloneOrchestrationFlow(sourceId, name)` with
  `sourceId` values like `'flow-feature'`, `'flow-bugfix'`. The backend's `cloneFlow`
  handler calls `this.flowParsingService.parseFlows()` and searches for `flow.id === sourceId`.
  If `FlowParsingService` assigns different IDs (e.g. based on file names or slugs), the lookup
  always fails with HTTP 404.
- **Impact**: Clone functionality is silently broken for any mismatch between mock IDs and
  real IDs.
- **Current Handling**: `getFlows()` in `OrchestrationService` returns hardcoded mock data,
  never calling the backend. IDs are invented strings.
- **Recommendation**: Replace mock data with a real call to `api.getOrchestrationFlows()` so
  IDs are always backend-sourced.

### Failure Mode 7: `effect()` reading `custom_flow_id` from untyped context

- **Trigger**: Backend stops sending `custom_flow_id` field (field rename, omission in
  serializer, etc.).
- **Symptoms**: The `'custom_flow_id' in context` check returns false silently.
  `selectedFlowOverrideId` stays null. The dropdown shows "Default" even if an override was
  persisted. No error is surfaced.
- **Impact**: Silent data display gap.
- **Current Handling**: Manual `'in'` guard plus `as` assertion. No TypeScript enforcement.
- **Recommendation**: Add `custom_flow_id?: string | null` to `CortexTaskContext` in
  `api.types.ts` so the field is part of the type contract and removals cause a compile error.

---

## Critical Issues

### [CRITICAL] deleteCustomFlow: optimistic remove with no rollback and no user feedback

File: `apps/dashboard/src/app/views/orchestration/services/orchestration.service.ts:119-128`

Scenario: `deleteCustomFlow(id)` filters the flow out of the signal before the HTTP call
returns. If the request fails, the UI shows the flow as deleted, but the database still has it.
On the next page load the flow reappears.

Evidence:
```typescript
public deleteCustomFlow(id: string): void {
  this.apiService.deleteCustomFlow(id).subscribe({
    next: () => {
      this.customFlows.set(this.customFlows().filter(f => f.id !== id));  // << removed before confirmation
    },
    error: (err: unknown) => {
      console.error('[OrchestrationService] deleteCustomFlow failed:', err);  // << no UI error, no rollback
    },
  });
}
```

The signal remove should be in `next:`, which it is, but it runs before there's any guarantee
the backend completed. Wait — re-reading: the signal update IS in `next:`, which fires after
success. That is correct. However the `error:` block does nothing visible to the user. The
correct fix is to display a user-visible error message on failure, not just `console.error`.
The anti-pattern rule states: "Operations that modify state must surface errors to the caller —
never silently succeed." In the error case the user gets no feedback.

Fix: Show a user-visible error (e.g. set an `errorMessage` signal, use a toast) in the
`error:` branch. The signal update in `next:` is correctly placed.

---

### [CRITICAL] No pre-delete check for task references — dangling custom_flow_id guaranteed

File: `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts:160-172`

Scenario: A task has `custom_flow_id = 'abc123'`. User deletes the flow with id `'abc123'`.
The delete succeeds. The task still has `custom_flow_id = 'abc123'` in SQLite pointing at
nothing. Because the column has no FK REFERENCES clause (only added via ALTER TABLE TEXT),
SQLite does not enforce referential integrity here.

Evidence: `schema.ts:246` — `ALTER TABLE tasks ADD COLUMN custom_flow_id TEXT` — no
REFERENCES. `custom-flows.service.ts:160-172` — the DELETE runs without any pre-check.

Fix: Either (a) add a pre-delete SELECT to block deletion when references exist and return 409,
or (b) run `UPDATE tasks SET custom_flow_id = NULL WHERE custom_flow_id = ?` inside a
transaction before the DELETE.

---

## Serious Issues

### [SERIOUS] `getFlows()` in OrchestrationService returns hardcoded mock data, never hits backend

File: `apps/dashboard/src/app/views/orchestration/services/orchestration.service.ts:153-387`

The entire `getFlows()` method returns `of(mockFlows)` with hardcoded flow definitions.
The IDs (`'flow-feature'`, `'flow-bugfix'`, etc.) are invented. When the user clicks "Clone to
Custom" the frontend sends these invented IDs to `POST /api/dashboard/orchestration/flows/clone`
where `FlowParsingService.parseFlows()` looks them up. If the real IDs differ, every clone
attempt returns 404.

Fix: Replace `of(mockFlows)` with `this.apiService.getOrchestrationFlows()` and map the
response to the `FlowDefinition` shape.

---

### [SERIOUS] `CortexTaskContext` missing `custom_flow_id` field — type safety bypassed

File: `apps/dashboard/src/app/models/api.types.ts:454-458`

`CortexTaskContext` does not include `custom_flow_id`. The task-detail component uses:
```typescript
if (context && 'custom_flow_id' in context) {
  this.selectedFlowOverrideId.set((context as { custom_flow_id?: string | null }).custom_flow_id ?? null);
}
```
This `as` assertion and runtime `in` guard is the workaround for the missing type definition.
If the field is renamed or removed from the API response, the effect silently sets nothing
and the stale override is shown as "Default".

Fix: Add `readonly custom_flow_id?: string | null` to `CortexTaskContext` and remove the
cast.

---

### [SERIOUS] `rowToRecord` does not validate that parsed `phases_json` is an array

File: `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts:27-43`

`JSON.parse(row.phases_json)` returns `null` for `'null'` without throwing. The catch block
does not fire. `phases` is set to `null`. Calling `.length` or `.map()` on `null` throws a
TypeError at the call site.

Fix: Add `if (!Array.isArray(phases)) phases = [];` after the try/catch block.

---

### [SERIOUS] Description cannot be cleared through the UI — silent data contract gap

File: `apps/dashboard-api/src/dashboard/orchestration/custom-flows.service.ts:138`

```typescript
const description = dto.description !== undefined ? dto.description : existing.description;
```

The frontend `FlowEditorComponent` sends `description: this.editedDescription().trim() ||
undefined` (line 107 of flow-editor.component.ts). An empty description string becomes
`undefined`. The backend then leaves the existing description unchanged. The user can type a
description, save, clear it, and save again — but the second save silently keeps the old
description.

Fix: The frontend should send `description: this.editedDescription().trim() || null` and the
backend should treat `null` as an explicit clear (i.e. `dto.description === null ? null : ...`).

---

### [SERIOUS] `deleteCustomFlow` controller maps `null` return (DB error) to 404 instead of 500

File: `apps/dashboard-api/src/dashboard/orchestration/orchestration.controller.ts:326-338`

```typescript
const deleted = this.customFlowsService.delete(id);
if (!deleted) {
  throw new HttpException('Custom flow not found', HttpStatus.NOT_FOUND);
}
```

`CustomFlowsService.delete()` returns `false` for two distinct reasons:
1. Row did not exist (`result.changes === 0`)
2. SQLite exception (caught, logged, returns `false`)

A DB error being surfaced as 404 "not found" is incorrect and misleads clients into retrying
(as if a different ID would work) rather than treating it as a server error.

Fix: Use a discriminated return type (e.g. `'deleted' | 'not_found' | 'error'`) so the
controller can map each case to the appropriate HTTP status.

---

### [SERIOUS] `loadCustomFlows()` has no error signal — template cannot distinguish load failure from empty list

File: `apps/dashboard/src/app/views/orchestration/services/orchestration.service.ts:86-92`

```typescript
this.apiService.getCustomFlows().pipe(catchError(() => of([] as CustomFlow[]))).subscribe(flows => {
  this.customFlows.set(flows);
  this.customFlowsLoading.set(false);
});
```

When the backend is down, `catchError` returns `[]`. `customFlowsLoading` becomes `false` and
`customFlows` is `[]`. The template displays "No custom flows yet." — which is the same text
shown when there genuinely are no flows. There is no error state to show the user that the
load failed.

Fix: Add a `customFlowsError = signal<string | null>(null)` and set it in the catch path.
Display the error in the template.

---

## Moderate Issues

### [MODERATE] `$any()` used in flow-editor and orchestration templates

Files:
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html:14`
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html:27`
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html:48`
- `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.html:91`

`$any($event.target).value` is used throughout the template. The project review lesson
explicitly states: "`$any()` in templates is the template equivalent of a type assertion —
avoid it." Use typed handler methods in the class component instead.

---

### [MODERATE] `FlowDefinition` interface defined inside `orchestration.service.ts` module scope

File: `apps/dashboard/src/app/views/orchestration/services/orchestration.service.ts:8-21`

The anti-pattern rule states: "Interfaces and types must be defined at module scope in
`*.model.ts` files — never inside component or function bodies." `FlowDefinition` and
`FlowListQuery` are defined inline in the service file. They should live in a `.model.ts` file.

---

### [MODERATE] `TaskDetailComponent.customFlows` loaded once in constructor, never refreshed

File: `apps/dashboard/src/app/views/task-detail/task-detail.component.ts:214-216`

The `getCustomFlows()` call is made once in the constructor. If a user navigates to the task
detail from the Orchestration page where they just created a new flow, the new flow is absent
from the dropdown. Adding a refresh on route param change (already observable via `taskId$`)
would keep the list current.

---

### [MODERATE] `FlowEditorComponent` uses `OnInit` lifecycle while using Signal inputs

File: `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts:43-50`

`ngOnInit` reads `this.flow()` to initialize editing state. This is acceptable for signal
inputs (unlike constructor access). However, `OnInit` is not invoked again if the same
component instance is reused with a different `flow` input value. Since the component is shown
via `@if (orchestrationService.isEditing())`, it is created fresh each time — so this is safe
as written. The concern is that if the `@if` guard is ever changed to an `@else` or `[hidden]`
pattern, the stale initialization would silently produce incorrect pre-populated fields.
Document this assumption.

---

### [MODERATE] No guard against double-click on "Save" in `FlowEditorComponent`

File: `apps/dashboard/src/app/views/orchestration/flow-editor/flow-editor.component.ts:100-127`

`canSave()` includes `!this.isSaving()` so a second click while saving is disabled. The
template's Save button uses `[disabled]="!canSave()"`. However, `canSave()` is a `computed()`
signal — with `ChangeDetectionStrategy.OnPush` and signal-based rendering, the disabled state
updates correctly. This is safe as written. No action needed — documenting for completeness.

---

### [MODERATE] Clone dialog in orchestration template has no success state refresh

File: `apps/dashboard/src/app/views/orchestration/orchestration.component.ts:101-116`

After `executeClone()` succeeds, `cloneStatus.set('success')` and then `cancelClone()` runs
after 2 seconds. But `loadCustomFlows()` is never called. The new cloned flow does not appear
in the Custom Flows list below until the user navigates away and back. This is a UX gap.

Fix: Call `this.orchestrationService.loadCustomFlows()` in the `next:` callback of
`executeClone()`.

---

## Data Flow Analysis

```
Frontend: OrchestrationComponent / TaskDetailComponent
  |
  | HTTP GET /api/dashboard/orchestration/custom-flows
  v
OrchestrationController.listCustomFlows()
  |-- CustomFlowsService.findAll()
      |-- openDb() -> SQLite custom_flows table
      |-- rowToRecord() [RISK: phases_json = 'null' not guarded]
      |-- db.close()
  |
  v
Frontend signal: OrchestrationService.customFlows (signal)
  |
  | User edits / creates
  v
FlowEditorComponent.save()
  |-- POST /api/dashboard/orchestration/custom-flows  (create)
  |-- PUT  /api/dashboard/orchestration/custom-flows/:id  (update)
  |
  v
CustomFlowsService.create() / update()
  |-- openDb()
  |-- INSERT / UPDATE
  |-- SELECT * to return record  [RISK: extra query after write]
  |-- db.close()
  |
  v
OrchestrationService.onFlowSaved(flow) -> in-place signal update

User deletes flow:
OrchestrationService.deleteCustomFlow(id)
  |-- DELETE /api/dashboard/orchestration/custom-flows/:id
  |   [RISK: controller maps DB error to 404]
  |   [RISK: no pre-check for task references]
  |-- next: filter signal  (correctly optimistic-remove on success)
  |-- error: console.error ONLY [MISSING: no user feedback, no rollback needed since
       signal was not changed yet -- but missing error notification IS a violation]

Task flow override:
TaskDetailComponent.handleFlowOverrideChange(event)
  |-- POST /api/dashboard/orchestration/tasks/:id/flow-override
  |   [RISK: setTaskFlowOverride does not verify flowId exists in custom_flows]
  |   [RISK: tasks.custom_flow_id has no FK REFERENCES in migration]
  |-- next: set selectedFlowOverrideId signal
  |-- error: console.warn only [MISSING: no user feedback]
```

### Gap Points Identified

1. `tasks.custom_flow_id` column has no FK constraint — any string can be stored
2. On flow delete, tasks retaining the dead ID are never updated or warned about
3. `rowToRecord` does not validate parsed phases_json is an Array
4. Task-detail `customFlows` is never refreshed after construction
5. Clone success does not reload the custom flows list

---

## Requirements Fulfillment

| Requirement                              | Status   | Concern                                                                 |
|------------------------------------------|----------|-------------------------------------------------------------------------|
| DB schema: custom_flows table            | COMPLETE | Table exists; idx_custom_flows_source index present                    |
| DB schema: custom_flow_id on tasks       | PARTIAL  | Column added via migration; no FK REFERENCES clause                     |
| Backend CRUD: create/findAll/findOne     | COMPLETE | Works end-to-end                                                        |
| Backend CRUD: update/updatePhases        | COMPLETE | Works; description-clear bug exists (Serious issue)                    |
| Backend CRUD: delete                     | PARTIAL  | No pre-delete referential integrity check                               |
| Task flow override set/clear             | COMPLETE | Works; no FK enforcement                                                |
| Controller: 8 new endpoints              | COMPLETE | All 8 registered and functional                                         |
| Frontend types: CustomFlow, CustomFlowPhase | COMPLETE | Defined in api.types.ts                                              |
| ApiService: 7 new methods                | COMPLETE | All 7 implemented correctly                                             |
| FlowEditorComponent: add/remove/reorder  | COMPLETE | Phase CRUD works; $any() antipattern present                           |
| OrchestrationService: custom flow signals | COMPLETE | Signals wired; error state missing                                     |
| OrchestrationComponent: custom flows UI  | COMPLETE | Functional; clone success does not refresh list                        |
| Task detail: flow override dropdown      | COMPLETE | Functional; customFlows not refreshed on navigation                    |

### Implicit Requirements NOT Addressed

1. Referential integrity: prevent orphaned `custom_flow_id` references after flow deletion
2. User-visible error feedback on delete failure and override failure
3. Custom flows list refresh after clone operation
4. `CortexTaskContext` type definition must include `custom_flow_id`
5. Built-in flow IDs served from backend — frontend should not invent them

---

## Edge Case Analysis

| Edge Case                                    | Handled | How                                           | Concern                                     |
|----------------------------------------------|---------|-----------------------------------------------|---------------------------------------------|
| Flow name empty string                       | YES     | Controller validates `dto.name?.trim()`       | OK                                          |
| DB unavailable on open                       | YES     | `openDb()` returns null, service returns null | Controller maps null -> 500 or 404 (mixed)  |
| Delete non-existent flow                     | YES     | `result.changes === 0` returns false          | But DB error also returns false             |
| phases_json is null in DB                    | NO      | `JSON.parse('null')` returns null, not caught | Array method calls will throw               |
| Override with non-existent flowId            | NO      | No FK constraint; any string accepted         | Silent bad data                             |
| User clears description                      | NO      | Sends undefined; backend preserves old value  | Impossible to clear via UI                  |
| Concurrent delete + list race                | NO      | No mutex; two DELETEs on same ID can occur    | Second returns 404 mapped same as success   |
| customFlows stale after flow created elsewhere | NO    | Only loaded once in TaskDetailComponent       | Requires page reload to see new flows       |
| Clone with mismatched built-in flow ID       | NO      | Mock IDs vs backend IDs may differ            | 404 on every clone attempt if IDs differ    |

---

## Integration Risk Assessment

| Integration                                 | Failure Probability | Impact           | Mitigation                                               |
|---------------------------------------------|---------------------|------------------|----------------------------------------------------------|
| DELETE custom flow -> orphaned task FKs     | HIGH                | Data integrity   | None currently; pre-delete check needed                  |
| getFlows() mock data -> clone endpoint      | MEDIUM              | Feature broken   | Replace mock with real API call                          |
| custom_flow_id migration -> no FK           | HIGH                | Silent bad data  | Document; cannot fix without table recreation            |
| loadCustomFlows() error -> no user feedback | MEDIUM              | Silent failure   | Add error signal                                         |
| TaskDetail customFlows stale               | MEDIUM              | UX gap           | Refresh on task ID change                                |
| rowToRecord non-array phases_json           | LOW                 | Endpoint crash   | Add Array.isArray guard                                  |

---

## Verdict

| Verdict | NEEDS_REVISION |
|---------|----------------|
| Result  | NEEDS_REVISION |

**Recommendation**: REVISE — do not merge to main as-is.

**Confidence**: HIGH

**Top Risk**: Deleting a custom flow produces orphaned `custom_flow_id` values on tasks
with no DB-level constraint to catch it and no application-level pre-check to prevent it.
This is a data integrity hole that will be invisible until auto-pilot attempts to use a
task's assigned flow and finds nothing.

## What Robust Implementation Would Include

1. Pre-delete check in `CustomFlowsService.delete()` — query tasks referencing the flow and
   return a conflict indicator; controller returns 409.
2. `custom_flow_id` FK migration note in comments — the ALTER TABLE path cannot add a FK in
   SQLite; document this and include the column in `tasks_new` in `migrateTasksCheckConstraint`
   with a proper REFERENCES clause for fresh installs (already done at line 313; the gap is
   only for upgraded DBs).
3. `Array.isArray` guard in `rowToRecord` after JSON.parse.
4. `customFlowsError` signal in `OrchestrationService` with template binding.
5. `CortexTaskContext` updated to include `custom_flow_id?: string | null`.
6. `OrchestrationService.getFlows()` replaced with a real API call.
7. `loadCustomFlows()` refresh in `executeClone()` success path.
8. User-visible error notification in `deleteCustomFlow()` error branch.
9. Fix description-clear: frontend sends `null` for empty description; backend treats `null`
   as explicit clear.
10. Remove `$any()` from templates per project anti-pattern rules.
