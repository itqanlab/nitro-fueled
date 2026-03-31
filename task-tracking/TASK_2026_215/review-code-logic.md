# Code Logic Review — TASK_2026_215

## Findings

### Finding 1 (Moderate) — `migrateTasksCheckConstraint` drops `custom_flow_id` on existing databases

**File**: `packages/mcp-cortex/src/db/schema.ts`

The schema check-constraint migration function (`migrateTasksCheckConstraint`) recreates the `tasks` table using `tasks_new` and copies only the column intersection between old and new schemas. The new `tasks_new` DDL (line 295–313 in `initDatabase`) does **not** include `custom_flow_id` — it is the same DDL string as `TASKS_TABLE` at the top of the file, and `TASKS_TABLE` does not declare `custom_flow_id` in its CREATE statement (line 68–86). The column is added later via `applyMigrations`.

The execution order in `initDatabase` is:
1. `migrateTasksCheckConstraint(db)` — may recreate the table WITHOUT `custom_flow_id`
2. `db.exec(TASKS_TABLE)` — no-op (table exists)
3. `applyMigrations(db, 'tasks', TASK_MIGRATIONS)` — adds `custom_flow_id` if missing

For a **fresh install** this is fine — the table is created by `TASKS_TABLE` (no `custom_flow_id`), then the migration adds it.

For an **existing database that has not yet had the FIXING/PREPPED status migration applied**: `migrateTasksCheckConstraint` will fire, recreate `tasks` using the column intersection, and because `custom_flow_id` is not in `TASKS_TABLE` DDL, it will not be present in `tasks_new`, so **it is excluded from the `colList` intersection and the data is silently dropped during the copy**. `applyMigrations` then re-adds the column as an empty column.

Risk: Any user who applies this patch to a database that still needs the CHECK-constraint migration (older installs) will lose all `custom_flow_id` assignments in a single startup.

Mitigation path: The recreation DDL inside `migrateTasksCheckConstraint` should be updated to match the full current `TASKS_TABLE` DDL, which now includes `custom_flow_id`. Because the column intersection logic copies only shared columns, adding `custom_flow_id` to the recreation DDL without updating the copy logic would add it but leave it NULL — that is the safe fallback, since `custom_flow_id` is nullable.

---

### Finding 2 (Moderate) — `spawnForCandidate` calls `getCustomFlow()` before `claimTask()` but the flow lookup adds a synchronous SQLite read per candidate on every tick

**File**: `apps/dashboard-api/src/auto-pilot/session-runner.ts`, lines 385–401

The custom flow is resolved before `claimTask()` (handoff decision #1), which is architecturally sound. However, `spawnForCandidate` is called once per selected candidate inside the `tick()` loop, and each call now issues an additional `SELECT ... FROM custom_flows WHERE id = ?` query even when `customFlowId` is present but the flow has already been fetched on a previous tick (e.g., for a candidate that failed to be claimed). For a small flow table and low-concurrency supervisor this is not a performance concern, but the result is not memoized at all within a session lifetime. If the flow is immutable once assigned (which is the intended semantics), a session-scoped cache (`Map<flowId, CustomFlow | null>`) would eliminate repeated reads. This is a minor efficiency gap, not a correctness bug.

---

### Finding 3 (Moderate) — Zero-step custom flow is accepted silently and produces an empty `CUSTOM FLOW OVERRIDE` block in the prompt

**File**: `apps/dashboard-api/src/auto-pilot/prompt-builder.service.ts`, line 57–59
**File**: `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts`, line 297

`getCustomFlow()` parses `steps` with `parseJson<CustomFlowStep[]>(row.steps, [])`. If the stored JSON is `"[]"` (a valid but empty steps array), the returned `CustomFlow` object has `steps: []`.

In `prompt-builder.service.ts`:
```typescript
const customFlowSection = opts.customFlow
  ? `\nCUSTOM FLOW OVERRIDE (flow: "${opts.customFlow.name}", id: ${opts.customFlow.id}):\n...${opts.customFlow.steps.map(...).join('\n')}\n...`
  : '';
```

When `steps` is empty, `map(...).join('\n')` produces an empty string, so the injected block reads:

```
CUSTOM FLOW OVERRIDE (flow: "My Flow", id: abc):
This task has a custom orchestration flow assigned. Use this agent sequence instead of the default type-based strategy:

Run the agents in this exact order. Do not use the default FEATURE/BUGFIX/etc. auto-detection strategy.
```

The worker receives a CUSTOM FLOW OVERRIDE section with no steps listed. The instruction "Run the agents in this exact order" with no agents is contradictory and may confuse the worker agent into either following the default strategy (undocumented fallback) or halting with ambiguity.

No validation at the `getCustomFlow()` return path checks for `steps.length === 0`. The caller in `session-runner.ts` treats any non-null return as a valid flow.

---

### Finding 4 (Minor) — `CustomFlowStep.agent` and `CustomFlowStep.label` are unvalidated bare strings

**File**: `apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts`, lines 64–67

```typescript
export interface CustomFlowStep {
  agent: string;
  label: string;
}
```

Both fields are untyped strings. `agent` is injected directly into the prompt text that a worker reads:

```
Step 1: ${s.agent} (${s.label})
```

If `agent` contains newline characters, backticks, or prompt-injection sequences, the constructed prompt string could produce unexpected or malformed instructions. Since `custom_flows` rows are written by the not-yet-shipped TASK_2026_214 CRUD endpoints, the injection surface will exist once those endpoints are live. The types file should document that these fields are user-controlled strings reaching prompt injection context.

No input truncation or sanitization is applied at the prompt-building step.

---

### Finding 5 (Minor) — `getTaskCandidates` LIMIT 1000 on the COMPLETE tasks set is an undocumented cap

**File**: `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts`, line 239

```typescript
const completeTasks = new Set(
  (db.prepare("SELECT id FROM tasks WHERE status = 'COMPLETE' LIMIT 1000").all() as Array<{ id: string }>).map(r => r.id),
);
```

This pre-existing cap was not introduced by TASK_2026_215, but `getTaskCandidates` is the method updated by this task (to add `custom_flow_id` to the SELECT). The LIMIT 1000 means dependency filtering will silently misclassify tasks as "blocked" once more than 1000 tasks are COMPLETE. At the current scale (~215 tasks) this is not triggered, but it is a latent correctness hazard worth flagging while the method is under active review.

---

### Finding 6 (Minor) — Unused import warning flagged in the handoff itself

**File**: `apps/dashboard-api/src/auto-pilot/prompt-builder.service.ts`, handoff note

The handoff explicitly notes: "verify `unused import WorkerType` warning doesn't appear." `WorkerType` was already imported in `prompt-builder.service.ts` before this task. Looking at the current file: the import on line 9 is `import type { ProviderType, WorkerType, SupervisorConfig, CustomFlow }`. `WorkerType` does not appear anywhere in the file body — it is used only in parameter type annotations if any method accepts it. Scanning the file: `BuildPromptOpts.provider` uses `ProviderType`, `ReviewPromptOpts.provider` uses `ProviderType`. `WorkerType` is not referenced in any type position in the file. This is a dead import that will trigger a `no-unused-vars` / `verbatimModuleSyntax` TypeScript warning in strict configurations.

---

### Finding 7 (Informational) — `CUSTOM_FLOWS_TABLE` has no `updated_at` trigger; `updated_at` will not auto-advance on UPDATE

**File**: `packages/mcp-cortex/src/db/schema.ts`, lines 127–135

The `custom_flows` table has `updated_at` with a DEFAULT clause, but SQLite DEFAULT only fires on INSERT. Unlike the `tasks` table, there is no corresponding UPDATE trigger for `custom_flows`. When TASK_2026_214 adds update endpoints, `updated_at` will remain frozen at the creation timestamp unless the update SQL explicitly sets it. This is an informational gap to carry into TASK_2026_214 review.

---

## Summary

The core custom flow routing logic is structurally sound:

- `custom_flow_id` is correctly added to `TaskRow` and the `getTaskCandidates` SELECT.
- `getCustomFlow()` correctly returns `null` for missing flows, and `spawnForCandidate` falls back gracefully with a warning log and a `CUSTOM_FLOW_FALLBACK` event.
- `claimTask()` is called after the flow lookup, keeping the claim/spawn boundary clean.
- Review workers correctly receive no custom flow (the `isBuild` guard is correct).
- No TODO comments, no placeholder returns, no console.log stubs.

Two moderate issues require attention before the feature is considered production-safe:

1. The `migrateTasksCheckConstraint` recreation DDL does not include `custom_flow_id`, which means the column — and any assigned flow IDs — would be silently dropped on databases that still need the CHECK-constraint migration to run.
2. A zero-step custom flow passes the null check in `session-runner.ts` and generates a malformed, contradictory prompt block that gives the worker no agents to run.

The remaining findings are minor or informational.

| Verdict | FAIL |
|---------|------|

**Blocking issues before APPROVED:**
- Finding 1: Add `custom_flow_id TEXT` to the recreation DDL inside `migrateTasksCheckConstraint` (the intersection copy logic will handle the null-safe migration automatically).
- Finding 3: Guard the `customFlow` truthy check in `prompt-builder.service.ts` (or in `session-runner.ts`) to treat a flow with zero steps as absent: `opts.customFlow && opts.customFlow.steps.length > 0`.
