# Code Logic Review — TASK_2026_172

## Score: 6/10

## Review Summary

| Metric              | Value                                    |
| ------------------- | ---------------------------------------- |
| Overall Score       | 6/10                                     |
| Assessment          | NEEDS_REVISION                           |
| Critical Issues     | 1                                        |
| Serious Issues      | 3                                        |
| Moderate Issues     | 3                                        |
| Failure Modes Found | 4                                        |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The kanban grid CSS declares `repeat(7, ...)` columns but the TypeScript `KANBAN_COLUMNS` array now has 9 statuses. The browser will reflow the extra 2 columns (FIXING, CANCELLED) into the same `overflow-x: auto` container but they will be narrower than intended on constrained viewports. No error is thrown — the UI just looks broken without any warning.

The `cortex-db-init.ts` workers table provider CHECK constraint still only lists `('claude','glm','opencode')` — missing `'codex'`. The main `schema.ts` already has `'codex'`. When the CLI's copy of the database is used in an environment where a codex worker is spawned, INSERTs will fail with a SQLite CHECK constraint violation. Because `cortex-db-init.ts` is an inlined copy explicitly maintained separately, this drift will cause silent insertion failures for codex workers in CLI-initialized databases.

### 2. What user action causes unexpected behavior?

A user switching the project board to Kanban view will see 9 columns rendered into a grid sized for 7. On a 1440px screen the columns are fine because `overflow-x: auto` kicks in, but on any screen under ~1260px the columns overflow and the user must scroll horizontally — which was already the case for 7 but is now worse with 9 columns. There is no visual indication that FIXING and CANCELLED columns were added, so a user who last saw the board with 7 columns may be confused by the layout change.

### 3. What data makes this produce wrong results?

Tasks with type `REFACTORING`, `DOCUMENTATION`, `RESEARCH`, `DEVOPS`, `OPS`, `CREATIVE`, `CONTENT`, `SOCIAL`, or `DESIGN` will be silently downgraded to `CHORE` by `cortex-sync-tasks.ts` (`VALID_TYPES` only contains the old 6-value set: `FEATURE`, `BUG`, `REFACTOR`, `DOCS`, `TEST`, `CHORE`). This is a pre-existing bug but the current task touched `cortex-sync-tasks.ts` and did not align it with the canonical type list in `schema.ts` (`CANONICAL_TASK_TYPES`). Tasks written with the new canonical types in `task.md` will be misclassified on every sync.

### 4. What happens when dependencies fail?

`migrateTasksCheckConstraint` in `schema.ts` runs inside a transaction but **drops the `claim_timeout_ms` column** during migration: the `tasks_new` table is created without a `claim_timeout_ms` column (it is not in the explicit DDL of the migration block at line 281–299 of schema.ts), then the data copy uses only the column intersection. Any task that had `claim_timeout_ms` populated loses that data silently after migration. A task that was claimed with a timeout will have its timeout data destroyed the first time the DB is opened after this migration runs.

### 5. What's missing that the requirements didn't mention?

The `cortex-db-init.ts` inlined schema is out of sync in two ways:
1. The workers table is missing the `'codex'` provider (covered above).
2. The tasks table in `cortex-db-init.ts` does NOT apply `migrateTasksCheckConstraint` — it has no equivalent migration function. For existing CLI databases that were created before FIXING was added to the CHECK constraint, inserting or updating a task to FIXING status will fail with a SQLite CHECK constraint violation. The comment in the file says "Keep this file in sync with packages/mcp-cortex/src/db/schema.ts" but the migration logic was not ported over.

---

## Failure Mode Analysis

### Failure Mode 1: Kanban Board CSS/Logic Mismatch (Layout Corruption)

- **Trigger**: User opens the Project board in Kanban mode.
- **Symptoms**: 9 columns render into a grid declared for 7. At viewport widths below ~1620px the last 2 columns (FIXING, CANCELLED) are rendered at ~140px instead of the minimum 180px, or the grid forces horizontal scroll at a threshold that didn't exist before.
- **Impact**: Visual regression. Does not cause data loss but will be immediately visible to all users on non-wide screens.
- **Current Handling**: `overflow-x: auto` masks it but the layout is wrong.
- **Recommendation**: Update `.kanban-board` CSS to `repeat(9, minmax(180px, 1fr))` to match the 9-column `KANBAN_COLUMNS` constant.

### Failure Mode 2: cortex-db-init.ts Missing Constraint Migration (Silent Insert Failure)

- **Trigger**: Any CLI-initialized database that existed before this commit receives a task update or insert with status `FIXING` — or a worker with provider `codex`.
- **Symptoms**: SQLite throws `CHECK constraint failed: tasks.status` or `CHECK constraint failed: workers.provider`. The error propagates up through `syncTasksFromFiles`, which catches it per-task and logs it to `errors[]`. Callers that do not inspect `errors[]` miss it entirely.
- **Impact**: Task sync silently fails for FIXING-status tasks. Codex workers cannot be inserted.
- **Current Handling**: `cortex-db-init.ts` has no migration function analogous to `migrateTasksCheckConstraint`.
- **Recommendation**: Port `migrateTasksCheckConstraint` and the codex provider migration from `schema.ts` into `cortex-db-init.ts`, or unify the two files to eliminate the duplication.

### Failure Mode 3: claim_timeout_ms Data Loss During Migration

- **Trigger**: First startup of `mcp-cortex` after applying this commit on an existing database where tasks have been claimed with a timeout.
- **Symptoms**: `claim_timeout_ms` is not listed in the DDL for `tasks_new` inside `migrateTasksCheckConstraint`. The column intersection logic excludes it from the copy. After migration, all `claim_timeout_ms` values are NULL.
- **Impact**: Tasks with active claim timeouts lose their TTL. The supervisor's timeout logic (`get_orphaned_claims`) will never expire these claims because their timeout is gone.
- **Current Handling**: No guard. The transaction completes successfully from SQLite's perspective.
- **Recommendation**: Add `claim_timeout_ms INTEGER` to the `tasks_new` DDL inside `migrateTasksCheckConstraint`, matching the `tasks` table definition in `TASKS_TABLE`.

### Failure Mode 4: cortex-sync-tasks.ts VALID_TYPES Out of Sync

- **Trigger**: Any `task.md` that uses a canonical type added after the old 6-value set (`REFACTORING`, `DOCUMENTATION`, `RESEARCH`, `DEVOPS`, `OPS`, `CREATIVE`, `CONTENT`, `SOCIAL`, `DESIGN`).
- **Symptoms**: `syncTasksFromFiles` silently downgrades the type to `CHORE` and logs an error into the returned `errors[]` array. Callers that do not surface `errors[]` to the user (e.g., `nitro-fueled status`) will show the task with the wrong type.
- **Impact**: Reporting, filtering, and model routing decisions that depend on task type are corrupted for all non-legacy types.
- **Current Handling**: Task touched this file (added `FIXING` to `VALID_STATUSES`) but did not update `VALID_TYPES`.
- **Recommendation**: Replace the hardcoded 6-value `VALID_TYPES` set with the canonical list from `schema.ts` (or a shared constant), and add the legacy aliases (`BUG`, `REFACTOR`, `DOCS`) as pass-through mappings rather than defaults.

---

## Critical Issues

### Issue 1: Kanban Grid CSS Column Count Mismatch

- **File**: `apps/dashboard/src/app/views/project/project.component.scss:324`
- **Scenario**: Any user who opens the Project board in Kanban view.
- **Impact**: Layout corruption. 9 columns rendered into a 7-column grid.
- **Evidence**: `grid-template-columns: repeat(7, minmax(180px, 1fr));` — the TypeScript constant `KANBAN_COLUMNS` at `project.component.ts:11` lists 9 statuses.
- **Fix**: Change `repeat(7, ...)` to `repeat(9, ...)`.

---

## Serious Issues

### Issue 1: cortex-db-init.ts Has No Constraint Migration for FIXING or Codex

- **File**: `apps/cli/src/utils/cortex-db-init.ts:58-111`
- **Scenario**: Existing CLI databases initialized before this commit; codex provider usage.
- **Impact**: INSERT/UPDATE for `FIXING` status tasks fail with SQLite CHECK constraint error. Codex workers cannot be recorded.
- **Evidence**: The tasks table in `cortex-db-init.ts` includes FIXING in the CHECK (line 63), but there is no migration function that would update the constraint for databases created before this commit. Additionally, the workers table at line 99 lists `CHECK(provider IN ('claude','glm','opencode'))` — missing `'codex'` which is present in `packages/mcp-cortex/src/db/schema.ts`.
- **Fix**: Add migration functions mirroring `migrateTasksCheckConstraint` and `migrateWorkersProviderConstraint` from `schema.ts`.

### Issue 2: claim_timeout_ms Column Dropped During Migration

- **File**: `packages/mcp-cortex/src/db/schema.ts:281-299` (the `tasks_new` DDL inside `migrateTasksCheckConstraint`)
- **Scenario**: Any database with claimed tasks that have a timeout set.
- **Impact**: Silent data loss. `claim_timeout_ms` is wiped to NULL for all tasks after the first startup post-migration.
- **Evidence**: `TASKS_TABLE` (line 68-86) defines `claim_timeout_ms INTEGER` but the `tasks_new` table DDL inside `migrateTasksCheckConstraint` (line 281-299) omits `claim_timeout_ms`. The column intersection code will exclude it from the data copy.
- **Fix**: Add `claim_timeout_ms INTEGER` to the `tasks_new` DDL in `migrateTasksCheckConstraint`.

### Issue 3: cortex-sync-tasks.ts VALID_TYPES Does Not Match Canonical Schema

- **File**: `apps/cli/src/utils/cortex-sync-tasks.ts:81`
- **Scenario**: Syncing any task whose `task.md` uses a post-2024 canonical type.
- **Impact**: Incorrect task type stored in DB. Reporting and model routing corrupted.
- **Evidence**: `VALID_TYPES = new Set(['FEATURE', 'BUG', 'REFACTOR', 'DOCS', 'TEST', 'CHORE'])`. The canonical schema has 11 types. The commit added FIXING to `VALID_STATUSES` in this same file but did not touch `VALID_TYPES`.
- **Fix**: Expand `VALID_TYPES` to match `CANONICAL_TASK_TYPES` from `schema.ts` and add legacy aliases.

---

## Moderate Issues

### Issue 1: FIXING and IN_REVIEW Share Same CSS Color Token — No Visual Distinction

- **File**: `apps/dashboard/src/app/views/dashboard/dashboard.component.scss:96-98` and `apps/dashboard/src/app/views/project/project.component.scss:208-209`
- **Scenario**: A user looking at the dashboard stat cards or the task board status badges.
- **Impact**: FIXING and IN_REVIEW are visually identical. A task in FIXING looks the same as a task IN_REVIEW. Users cannot distinguish them at a glance, defeating the purpose of adding FIXING as a distinct status.
- **Evidence**: Both `.stat-card-value.status-fixing` and `.stat-card-value.status-in-review` use `color: var(--warning)`. The handoff acknowledges this as a known decision ("FIXING uses the same `--warning` color token as IN_REVIEW") but does not justify why two conceptually distinct states should be indistinguishable.
- **Fix**: Use a distinct color for FIXING. Options: `var(--orange)`, an amber variant, or a distinct border/background pattern to differentiate it from IN_REVIEW.

### Issue 2: cortex-db-init.ts Missing `last_heartbeat` Session Migration

- **File**: `apps/cli/src/utils/cortex-db-init.ts:220-227`
- **Scenario**: CLI databases that need the `last_heartbeat` session column.
- **Impact**: `last_heartbeat` is present in `SESSION_MIGRATIONS` in `schema.ts` but absent from the CLI's inlined `applyMigrations` call for sessions. Session heartbeat data is unavailable in CLI-initialized databases.
- **Evidence**: `schema.ts` line 242: `{ column: 'last_heartbeat', ddl: 'ALTER TABLE sessions ADD COLUMN last_heartbeat TEXT' }`. The CLI file's session migrations end at `total_output_tokens` without `last_heartbeat`.
- **Fix**: Add `last_heartbeat` to the CLI's session migrations array.

### Issue 3: Mock Data for FIXING Count Is Non-Zero; CANCELLED Is Zero — Asymmetric Test Coverage

- **File**: `apps/dashboard/src/app/services/mock-data.constants.ts:936-940`
- **Scenario**: Developers relying on mock data to spot UI regressions.
- **Impact**: The CANCELLED stat card is always rendered with `0` in the mock. If the template has a rendering bug that only shows when the value is non-zero (e.g., a conditional that hides zero-count cards), that bug would not be caught by visual inspection against mock data.
- **Evidence**: `FIXING: 2, ... CANCELLED: 0` in the mock breakdown. CANCELLED was specifically called out as a newly added status; its mock value should be non-zero to exercise the full render path.
- **Fix**: Set mock `CANCELLED` to at least 1 so all 9 stat cards are exercised with non-zero values.

---

## Data Flow Analysis

```
Task status update flow:
  1. task-tracking/{ID}/status file written (by worker or manually)
  2. cortex-sync-tasks.ts reads file → validates against VALID_STATUSES
     FIXING/CANCELLED: OK (added in this commit)
  3. cortex-db-init.ts tasks table CHECK constraint
     FIXING: OK (in CREATE TABLE IF NOT EXISTS DDL)
     FIXING on existing DB: FAIL — no migration function in this file
  4. packages/mcp-cortex/src/db/schema.ts CHECK constraint
     FIXING: OK — migrateTasksCheckConstraint handles existing DBs
  5. Dashboard API reads tasks from DB
  6. Dashboard frontend renders status
     FIXING/CANCELLED: OK in models, service, and component

Gap points:
  A. cortex-db-init.ts existing DBs can't store FIXING until migrated
  B. claim_timeout_ms lost during migrateTasksCheckConstraint
  C. Task type normalization in cortex-sync-tasks.ts silently corrupts
     all non-legacy task types
  D. Kanban CSS column count wrong — layout broken for all users
```

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| CANCELLED added to TypeScript type unions | COMPLETE | All model files updated |
| FIXING added to TypeScript type unions | COMPLETE | All model files updated |
| SQL CHECK constraints updated | PARTIAL | schema.ts OK; cortex-db-init.ts missing migration for existing DBs |
| Kanban columns include FIXING and CANCELLED | PARTIAL | TypeScript has 9 columns; CSS grid hardcoded to 7 |
| Filter dropdown complete | COMPLETE | All 9 statuses in filterOptions |
| statusClassMap and statusLabelMap exhaustive | COMPLETE | All Records typed against full union |
| Dashboard stat cards show FIXING and CANCELLED | COMPLETE | HTML and SCSS updated |
| MCP cortex tools updated | COMPLETE | release_task and context.ts updated |
| CSS styling for new statuses | PARTIAL | FIXING is visually identical to IN_REVIEW |
| CLI sync and db-init updated | PARTIAL | FIXING in CHECK; but migration gap for existing DBs; VALID_TYPES not updated |

### Implicit Requirements NOT Addressed:

1. Existing databases need a migration path for the new FIXING CHECK constraint in `cortex-db-init.ts`. The handoff notes this as a Known Risk but no migration was provided.
2. The inlined `cortex-db-init.ts` must remain in sync with `schema.ts` for all migration functions — not just the CREATE TABLE DDL.
3. `cortex-sync-tasks.ts` `VALID_TYPES` must match `CANONICAL_TASK_TYPES` from `schema.ts` (pre-existing gap, but touched by this commit).

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| FIXING status written to status file | YES | VALID_STATUSES in cortex-sync-tasks.ts | OK |
| FIXING on existing DB (mcp-cortex) | YES | migrateTasksCheckConstraint | OK |
| FIXING on existing CLI DB | NO | No migration in cortex-db-init.ts | FAIL — CHECK constraint error |
| CANCELLED count = 0 in mock | YES | Renders 0 | Minor — non-exercised code path |
| Kanban with 9 statuses on narrow screen | NO | CSS grid only sized for 7 | Layout broken |
| claim_timeout_ms after migration | NO | Dropped by tasks_new DDL | Silent data loss |
| Task type REFACTORING in sync | NO | VALID_TYPES excludes it | Silent corruption |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| cortex-db-init.ts existing DB + FIXING | HIGH | INSERTs fail on status update | None — needs migration |
| schema.ts migration + claim_timeout_ms | MED | Data loss on first startup after upgrade | None — needs DDL fix |
| cortex-sync-tasks.ts + canonical types | HIGH | Type corruption on every sync | Pre-existing, worsened by proximity |
| Kanban CSS 7 vs 9 columns | CERTAIN | Layout broken for all kanban users | Quick CSS fix |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: The kanban grid CSS mismatch (`repeat(7,...)` vs 9 columns) is immediately visible to every user who opens the board in kanban mode. Combined with the `cortex-db-init.ts` missing constraint migration — which causes silent INSERT failures for FIXING-status tasks in CLI-initialized databases — and the `claim_timeout_ms` data loss during the tasks table migration, this implementation has three concrete failure modes that need to be fixed before the task can be marked COMPLETE.

## What Robust Implementation Would Include

- Kanban grid CSS updated to match the column count in TypeScript (`repeat(9, ...)`).
- `cortex-db-init.ts` ported with equivalent migration functions for both the tasks CHECK constraint and the workers provider constraint.
- `migrateTasksCheckConstraint` DDL for `tasks_new` includes all columns from the original `TASKS_TABLE` definition, including `claim_timeout_ms`.
- `cortex-sync-tasks.ts` `VALID_TYPES` aligned with `CANONICAL_TASK_TYPES` from `schema.ts` (and legacy aliases preserved).
- FIXING given a distinct color token so it is visually differentiable from IN_REVIEW.
- Mock data for CANCELLED set to a non-zero value to exercise the full render path.
