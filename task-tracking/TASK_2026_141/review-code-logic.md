# Code Logic Review - TASK_2026_141

## Review Summary

| Metric              | Value                                        |
| ------------------- | -------------------------------------------- |
| Overall Score       | 5.5/10                                       |
| Assessment          | NEEDS_REVISION                               |
| Critical Issues     | 2                                            |
| Serious Issues      | 4                                            |
| Moderate Issues     | 3                                            |
| Failure Modes Found | 9                                            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **Task with invalid `type` or `priority` in task.md gets silently replaced by hardcoded defaults.** `getMetadataField(content, 'Type') ?? 'CHORE'` swallows any unrecognised value (e.g. `INVESTIGATION`, `SPIKE`) and stores `'CHORE'` in the DB without any warning. The operator has no idea the metadata was coerced. This applies to priority too (`'P2-Medium'`).
- **`syncTasksFromFiles` runs inside a single transaction.** If any task's `upsert.run()` throws a CHECK constraint violation (e.g., an invalid status read from the file), the **entire transaction rolls back** — all previously processed tasks in that batch are discarded — but `runSync()` re-throws and the outer try/catch in `runCortexStep` returns `null`. No partial progress is visible; the count stays at zero. The contract says "graceful failure per task" — this violates it.
- **Session and handoff hydration errors are swallowed into `skipped` with no surface path to the caller.** `HydrationResult` has no error field for sessions or handoffs. The operator sees "0 sessions" and cannot distinguish "no sessions on disk" from "sessions directory unreadable".
- **`dropHydratableTables` does `DELETE FROM tasks` before `DELETE FROM handoffs`.** Since `handoffs.task_id` has a FK referencing `tasks(id)` with `foreign_keys = ON`, the DELETE on tasks will throw `SQLITE_CONSTRAINT_FOREIGNKEY`. This makes `db:rebuild` **always fail** unless there are no handoffs in the DB.

### 2. What user action causes unexpected behavior?

- Running `update` on a project that **already has a DB but has never had tasks** (e.g., freshly initialised project): `dbWasNew = false`, so `reconcileStatusFiles` runs, does nothing (0 rows in tasks table), and the command prints "Database in sync with files". A user who then queries the DB finds it empty — the update command never hydrated it. This path is reachable any time someone has manually created the DB or the MCP server has already initialised it.
- Running `db:rebuild` will always crash (see Failure Mode 1) when any handoffs rows exist, leaving the DB in a partially-deleted state because the `DELETE FROM tasks` already ran before the FK violation.
- Running `update` twice after a `db:rebuild` that succeeded (no existing DB): second run hits the `dbWasNew = false` branch and only reconciles. But since `db:rebuild` already hydrated everything, this is actually correct — though the message "Database in sync with files" is shown even after a rebuild, which is confusing.

### 3. What data makes this produce wrong results?

- A `task.md` with a `Type` field of `INVESTIGATION` (not in the CHECK constraint) causes `upsert.run()` to throw `SQLITE_CONSTRAINT_CHECK`. Because this happens inside the shared transaction in `runSync()`, the transaction rolls back and **all tasks** in that scan are lost, not just the offending one.
- A `status` file containing `FIXING` (documented as removed from `VALID_STATUSES`) passes the `VALID_STATUSES` check cleanly (it is not there), so the task is silently skipped during reconcile. But at initial hydration in `syncTasksFromFiles`, the status is read from the file without validation against `VALID_STATUSES` — it is passed directly to `upsert.run()`, which throws a DB CHECK constraint error, causing a full transaction rollback.
- A `task.md` where the title line uses `# Task — ` (em-dash, common in older files) instead of `# Task: ` produces `title = 'Untitled'` with no warning.
- `getSection` regex uses `[\s\S]*?` which is correct, but the dependencies regex `/\bTASK_\d{4}_\d{3}\b/g` does not guard against malformed IDs like `TASK_20260_023` — actually the `\b` anchor is there, so this is fine. However, `parseDependencies` and `parseFileScope` both silently return empty arrays when the sections are missing.
- A `task.md` file over ~50 MB (degenerate case) is read entirely into memory via `readFileSync`. With 100+ tasks this is low risk but not bounded.

### 4. What happens when dependencies fail?

| Dependency                    | Failure Mode                                | Current Handling               | Assessment                                                             |
|-------------------------------|---------------------------------------------|--------------------------------|------------------------------------------------------------------------|
| `initCortexDatabase` throws   | DB file locked, permission denied           | Caught in outer try/catch, returns `null` | OK — `null` is handled in callers                          |
| `readdirSync(trackingDir)`    | Permission denied, EMFILE                   | Not caught — throws through transaction, returns `null` | Acceptable, but no specific error message surfaced   |
| `readFileSync(taskPath)`      | File deleted between `existsSync` and read  | Caught per-task in inner try/catch — error pushed to `errors[]` | OK — but only if not inside the transaction rollback scenario |
| `upsert.run()` throws CHECK constraint | Invalid enum value from file content | Transaction rolls back, ALL tasks lost | CRITICAL — see Issue 1                                    |
| `db.close()` throws           | Rare DB lock                                | `try { db.close() } catch {}` — silently ignored | Acceptable                                              |
| `DELETE FROM tasks` (rebuild) | FK violation from handoffs                  | Propagates, caught as null return | CRITICAL — db:rebuild is broken                             |

### 5. What's missing that the requirements didn't mention?

- **`acceptance_criteria` field is never hydrated.** The `upsert` statement in `syncTasksFromFiles` (line 80-93) does not include `acceptance_criteria` in the INSERT columns, even though `getSection(content, 'Acceptance Criteria')` exists. The schema has the column. The task spec says "extract metadata". This field is silently dropped.
- **No input validation on `type` or `priority` values before INSERT.** The DB CHECK constraint is the only guard, and it throws inside a transaction, causing whole-batch rollback.
- **No validation that the status value read from disk is a member of `VALID_STATUSES` at hydration time** (only at reconcile time). See the FIXING status issue above.
- **`db:rebuild` does not preserve sessions.** The spec says "Does NOT drop sessions/workers tables". The implementation uses `DELETE FROM tasks` which cascades concern only to FK children — sessions are not deleted. This is correct. However, `DELETE FROM handoffs` before `DELETE FROM tasks` would be required to respect FK ordering — and the current order is reversed (tasks deleted first).
- **No schema version / metadata table.** The task spec says "Check schema version in DB metadata table" for the migration path. The implementation skips this entirely — there is no `metadata` table, no version number stored, no explicit version check. The `applyMigrations` function using `PRAGMA table_info` is a reasonable substitute, but it does not produce the log message "Applied N schema migrations" that the spec requires.
- **Task description mentions `db:rebuild` as the command ID but the implementation registers it as `db-rebuild`** — the oclif command ID produces `nitro-fueled db-rebuild` not `nitro-fueled db:rebuild`. The handoff acknowledges this but the spec acceptance criteria says `db:rebuild`. The help output will show `db-rebuild`, which is user-visible divergence from the spec.

---

## Failure Mode Analysis

### Failure Mode 1: db:rebuild Always Fails When Handoffs Exist (FK Violation)

- **Trigger**: User runs `npx nitro-fueled db-rebuild` on a DB that has any rows in the `handoffs` table.
- **Symptoms**: Command prints "Error: Could not open cortex database." — completely wrong message, real error is a SQLite FK constraint violation.
- **Impact**: `db:rebuild` is the recovery mechanism for DB corruption. It is broken in any non-trivial project that has previously had workers run.
- **Current Handling**: `DELETE FROM tasks` fires first (`dropHydratableTables`). Since `handoffs.task_id REFERENCES tasks(id)` and `PRAGMA foreign_keys = ON`, SQLite rejects the DELETE. The exception propagates to the outer try/catch, which returns `null`. The command prints the wrong error.
- **Recommendation**: Reorder to `DELETE FROM handoffs` before `DELETE FROM tasks`, and add `DELETE FROM events` after (events has no FK to tasks). The correct order is: events, handoffs, tasks.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 297-301.

### Failure Mode 2: Single-Transaction Wraps All Tasks — One Bad Task Kills All

- **Trigger**: Any task with a `type`, `priority`, or `status` value that violates the DB CHECK constraint (e.g., `type: INVESTIGATION`, `status: FIXING`).
- **Symptoms**: `runCortexStep` returns `null`. Log shows `cortex-hydrate: DB error: SQLITE_CONSTRAINT: CHECK constraint failed: tasks`. Zero tasks hydrated.
- **Impact**: A single malformed task.md in a 200-task project silently erases the entire hydration. User sees no cortex data. The promise of "graceful failure per task" is broken.
- **Current Handling**: The inner `try/catch` per task pushes to `errors[]`, but that runs inside the transaction callback `runSync`. If `upsert.run()` throws a CHECK constraint, SQLite throws synchronously and the transaction is aborted on `runSync()` call — the per-task catch does NOT prevent transaction rollback.
- **Recommendation**: Either (a) validate `type`, `priority`, `status` against their valid sets before calling `upsert.run()` and fall back to defaults with a warning, or (b) move each task's upsert into its own separate transaction so one failure does not roll back others.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 79-134.

### Failure Mode 3: Status Not Validated at Hydration Time

- **Trigger**: A `status` file on disk contains a value that is not in the CHECK constraint (e.g., the historical value `FIXING`, `PENDING`, or any value from a project with different conventions).
- **Symptoms**: `upsert.run()` throws CHECK constraint inside the transaction, rolling back all tasks (see Failure Mode 2).
- **Current Handling**: `reconcileStatusFiles` validates against `VALID_STATUSES` before writing. `syncTasksFromFiles` does NOT — it reads `status` from the file and passes it directly to the DB.
- **Recommendation**: Apply the same `VALID_STATUSES` guard in `syncTasksFromFiles` that exists in `reconcileStatusFiles`. Default to `'CREATED'` and push a warning to `errors[]` if the status is unrecognised.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, line 109.

### Failure Mode 4: Existing DB with No Tasks Gets No Hydration

- **Trigger**: MCP server was started before `update`, creating the DB. User then runs `update`.
- **Symptoms**: `dbWasNew = false` (DB file exists). `init-or-migrate` mode takes the `else` branch and only calls `reconcileStatusFiles`. Since tasks table is empty, 0 drifts found. Log: "Database in sync with files". DB remains empty.
- **Impact**: Users who install the MCP server first and then run `update` get an empty cortex DB permanently (until they discover `db-rebuild`).
- **Current Handling**: No detection of "DB exists but is empty" case.
- **Recommendation**: Add a check: if `dbWasNew === false` AND `SELECT COUNT(*) FROM tasks` returns 0 AND there are task directories on disk, run full hydration instead of reconcile-only.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 339-345.

### Failure Mode 5: `acceptance_criteria` Silently Not Hydrated

- **Trigger**: Any hydration run.
- **Symptoms**: The `acceptance_criteria` column in the tasks table is always NULL after hydration, even for tasks that have a well-formed `## Acceptance Criteria` section in their task.md.
- **Impact**: Any query or tool that uses `acceptance_criteria` returns NULL for all historically hydrated tasks.
- **Current Handling**: Not handled — field is absent from the upsert statement.
- **Recommendation**: Add `acceptance_criteria` to the INSERT column list and `getSection(content, 'Acceptance Criteria')` to the `upsert.run()` call. The schema already has this column.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 79-93, 113-124.

### Failure Mode 6: Schema Drift Between Inlined and Source Schema — `phases` CHECK Constraint Missing

- **Trigger**: `phases` table is created by `cortex-db-init.ts`. In the source `packages/mcp-cortex/src/db/schema.ts`, the `phases` table has:
  ```
  phase TEXT NOT NULL CHECK(phase IN ('PM','Architect','Dev','Review','Fix','Completion','other'))
  outcome TEXT CHECK(outcome IN ('COMPLETE','FAILED','SKIPPED','STUCK') OR outcome IS NULL)
  ```
  In `cortex-db-init.ts`, both columns are declared without CHECK constraints (`phase TEXT NOT NULL`, `outcome TEXT`). This is a schema drift defect — the inlined copy is already missing CHECK constraints from the canonical source.
- **Impact**: The MCP server's DB enforces value constraints on `phase` and `outcome`; the CLI-created DB does not. If the CLI-created DB is then used by the MCP server, corrupted phase/outcome values can be inserted without rejection.
- **Recommendation**: The inlined schema must reproduce the CHECK constraints verbatim from the source.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-db-init.ts`, lines 114-128.

### Failure Mode 7: `reviews` Table Missing `review_type` CHECK Constraint

- **Trigger**: Same schema drift as Failure Mode 6.
- **Source schema**: `review_type TEXT NOT NULL CHECK(review_type IN ('code-style','code-logic','security','visual','other'))`.
- **Inlined schema** (`cortex-db-init.ts` line 133): `review_type TEXT NOT NULL` — no CHECK constraint.
- **Impact**: Same as Failure Mode 6 — values outside the valid set can be inserted via the CLI-created DB.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-db-init.ts`, line 133.

### Failure Mode 8: No "Applied N schema migrations" Log Message

- **Trigger**: Running `update` on an existing DB that needs column migrations.
- **Symptoms**: Migrations are silently applied. User sees "Database in sync with files" or hydration counts but never "Applied N schema migrations".
- **Impact**: The task acceptance criterion "Logs progress: Applied N schema migrations" is not met. Operators cannot tell if migrations ran.
- **Current Handling**: `applyMigrations` runs inside `initCortexDatabase`, which is called before the result is returned. No count of applied migrations is surfaced.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-db-init.ts`, lines 10-24 (no return value from `applyMigrations`).

### Failure Mode 9: `type` / `priority` Coercion Silently Stores Wrong Data

- **Trigger**: A `task.md` with `Type: INVESTIGATION` or any value not in the CHECK set.
- **Symptoms**: Under the current transaction-wraps-all behavior, this causes a rollback (Failure Mode 2). If fixed by per-task transactions, it would silently store `'CHORE'` / `'P2-Medium'` without warning.
- **Impact**: DB contains wrong metadata for the task. Downstream queries filtering by `type` or `priority` return inaccurate results.
- **Recommendation**: Validate extracted values against their valid sets and push a warning to `errors[]` when coercion occurs.

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 116-117.

---

## Critical Issues

### Issue 1: `dropHydratableTables` Deletes in FK-Violating Order — `db:rebuild` Broken

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 297-301
- **Scenario**: Any project with existing handoff rows in the DB. `db-rebuild` command calls `runCortexStep(cwd, 'rebuild')`. `dropHydratableTables` runs `DELETE FROM tasks` first. SQLite rejects with FK constraint because `handoffs.task_id` references `tasks(id)`. The outer catch returns `null`. Command prints "Error: Could not open cortex database." — an incorrect error message.
- **Impact**: The primary recovery command for DB corruption is permanently broken for any project that has had workers run.
- **Evidence**: `cortex-hydrate.ts` lines 297-301:
  ```typescript
  function dropHydratableTables(db: Database.Database): void {
    db.exec('DELETE FROM tasks');     // FK violation if handoffs exist
    db.exec('DELETE FROM handoffs');
    db.exec('DELETE FROM events');
  }
  ```
  Schema: `handoffs.task_id TEXT NOT NULL REFERENCES tasks(id)` with `PRAGMA foreign_keys = ON`.
- **Fix**: Reorder to `DELETE FROM handoffs`, then `DELETE FROM events`, then `DELETE FROM tasks`.

### Issue 2: All-or-Nothing Transaction Breaks "Graceful Failure Per Task" Guarantee

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 95-134
- **Scenario**: 150-task project where one task has `Type: INVESTIGATION`. The per-task try/catch on lines 106-129 catches `readFileSync` I/O errors but does NOT prevent a SQLite CHECK constraint throw from aborting the wrapping transaction (`runSync`). All 150 tasks are lost.
- **Impact**: Violates the stated acceptance criterion "Graceful failure: if one task.md is malformed, skip it with warning and continue". The whole-batch transaction means a single bad value destroys all progress.
- **Evidence**: `upsert.run(entry.name, title, getMetadataField(...) ?? 'CHORE', ...)` — if the extracted type is not in the CHECK set, SQLite throws inside the transaction body, aborting the transaction.
- **Fix**: Either validate extracted values before `upsert.run()` (guard against invalid CHECK values), or use a separate `db.transaction()` per task instead of wrapping the entire scan.

---

## Serious Issues

### Issue 3: `acceptance_criteria` Not Hydrated Despite Schema Column Existing

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 79-93, 113-124
- **Scenario**: Every hydration run.
- **Impact**: `acceptance_criteria` is always NULL in the DB. The spec says to extract metadata. The column exists in the schema. This is a partial implementation of the spec.
- **Fix**: Add `acceptance_criteria` as a column in the INSERT and a corresponding `getSection(content, 'Acceptance Criteria')` value in `upsert.run()`.

### Issue 4: Schema Drift — `phases` and `reviews` Missing CHECK Constraints

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-db-init.ts`, lines 114-128 (phases), 130-145 (reviews)
- **Scenario**: CLI creates a new DB via `initCortexDatabase`. The inlined DDL for `phases.phase`, `phases.outcome`, and `reviews.review_type` omits the CHECK constraints present in the canonical source at `packages/mcp-cortex/src/db/schema.ts`.
- **Impact**: The MCP server reads this DB. If the CLI-side hydration ever writes phase or review rows (future extension), constraint violations will appear only in the MCP server's stricter DB, not in the CLI-created one. Schema divergence is live on day one.
- **Fix**: Copy the CHECK constraint definitions verbatim from the canonical source.

### Issue 5: Existing-but-Empty DB Not Hydrated

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 322-345
- **Scenario**: MCP server runs first (creates the DB), then user runs `npx nitro-fueled update`.
- **Impact**: `dbWasNew = false`, reconcile runs, finds 0 drift, prints "Database in sync with files". DB has 0 tasks despite 100+ task files on disk.
- **Fix**: After `initCortexDatabase`, if `mode === 'init-or-migrate'` and `dbWasNew === false`, check `SELECT COUNT(*) FROM tasks`. If 0 and task directories exist, run full hydration.

### Issue 6: Status Value Not Validated at Initial Hydration Time

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, line 109
- **Scenario**: A status file contains a legacy or unrecognised value.
- **Impact**: Triggers a DB CHECK constraint throw inside the transaction, rolling back all tasks (Failure Mode 2 makes this a critical amplifier). Even if transactions are fixed to be per-task, the CHECK error is swallowed and the task is silently skipped without a useful error message.
- **Fix**: Apply the `VALID_STATUSES` check before passing the value to `upsert.run()`. Default to `'CREATED'` and push a warning when overriding.

---

## Moderate Issues

### Issue 7: `db:rebuild` Command ID Is `db-rebuild`, Not `db:rebuild`

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/commands/db-rebuild.ts`, line 4
- **Impact**: The acceptance criterion and task description say `npx nitro-fueled db:rebuild`. The oclif command file at `db-rebuild.ts` produces `nitro-fueled db-rebuild`. Users following the spec will get "command not found". The handoff documents this as a known limitation but it is a user-visible spec divergence.
- **Fix**: Either rename the file to `db/rebuild.ts` (oclif topic syntax) or add an alias `aliases: ['db:rebuild']` to the command class.

### Issue 8: No "Applied N Migrations" Log Message

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-db-init.ts`, lines 10-24; `cortex-hydrate.ts` lines 323-324
- **Impact**: Acceptance criterion "Applied N schema migrations" log message is not emitted. Operators cannot verify that migrations ran on an existing DB.
- **Fix**: Return the count of applied migrations from `initCortexDatabase` (or `applyMigrations`) and log it in `runCortexStep` / `update.ts`.

### Issue 9: Session Hydration Errors Not Surfaced to Callers

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/cli/src/utils/cortex-hydrate.ts`, lines 220-229; `HydrationResult` type lines 15-21
- **Impact**: Session and handoff failures are swallowed into the `skipped` counter and a `console.error`. The `update` command only surfaces `tasks.errors`. An operator with 0 sessions imported cannot distinguish "no session folders" from "session imports failed".
- **Fix**: Add `errors: string[]` to the sessions and handoffs sub-result in `HydrationResult`, and surface them in the update command output.

---

## Data Flow Analysis

```
update command (update.ts:278)
  └─> runCortexStep(cwd, 'init-or-migrate')  [cortex-hydrate.ts:314]
        ├─> dbWasNew = !existsSync(dbPath)    [RISK: false if MCP server ran first — see Issue 5]
        ├─> initCortexDatabase(dbPath)        [cortex-db-init.ts:31]
        │     ├─> mkdirSync (creates .nitro/) [OK]
        │     ├─> CREATE TABLE IF NOT EXISTS  [OK but phases/reviews missing CHECKs — see Issue 4]
        │     └─> applyMigrations             [no return value — migrations not logged — see Issue 8]
        │
        ├─> if dbWasNew: FULL HYDRATION
        │     ├─> syncTasksFromFiles          [RISK: whole-batch transaction — see Issue 2]
        │     │     ├─> per task: read status (no VALID_STATUSES guard — see Issue 6)
        │     │     ├─> per task: upsert      [RISK: CHECK violation kills whole batch — see Issue 2]
        │     │     └─> acceptance_criteria NOT hydrated — see Issue 3
        │     ├─> hydrateSessions             [errors -> console.error only, not returned — see Issue 9]
        │     └─> hydrateHandoffs             [errors -> console.error only, not returned — see Issue 9]
        │
        └─> if !dbWasNew: RECONCILE ONLY
              └─> reconcileStatusFiles        [OK — VALID_STATUSES guard present]

db-rebuild command (db-rebuild.ts:17)
  └─> runCortexStep(cwd, 'rebuild')
        ├─> initCortexDatabase(dbPath)        [OK]
        └─> dropHydratableTables(db)
              ├─> DELETE FROM tasks           [CRITICAL: FK violation if handoffs exist — see Issue 1]
              ├─> DELETE FROM handoffs        [never reached]
              └─> DELETE FROM events         [never reached]
```

### Gap Points Identified:
1. FK-ordered delete is reversed — tasks deleted before handoffs (Issue 1)
2. Status values not validated before INSERT — can cause CHECK constraint abort of full batch (Issues 2+6)
3. `acceptance_criteria` field absent from upsert (Issue 3)
4. Empty-DB detection missing — existing-but-empty DB gets reconcile-only path (Issue 5)

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| `update` creates cortex DB if missing | COMPLETE | DB is created correctly |
| `update` hydrates from task-tracking files (tasks, sessions, handoffs) | PARTIAL | `acceptance_criteria` not hydrated; one bad task aborts all |
| `update` runs schema migrations if DB outdated | PARTIAL | Migrations run but no log message is emitted |
| `update` verifies file-DB sync and fixes drift | COMPLETE | `reconcileStatusFiles` works correctly |
| `db:rebuild` drops and re-hydrates task/handoff/event data | BROKEN | FK-ordered delete crashes the command |
| Hydration is idempotent | PARTIAL | `INSERT OR IGNORE` for sessions and `ON CONFLICT DO UPDATE` for tasks make it idempotent on success paths; but broken FK delete order means rebuild is not idempotent |
| Hydration logs progress: "Hydrated N tasks, M sessions" | COMPLETE | Log messages present |
| Graceful failure per task | BROKEN | Single transaction means one bad task kills all |
| Works with 0 tasks | COMPLETE | Empty `task-tracking/` returns 0 counts correctly |
| Works with 100+ tasks | PARTIAL | Broken by the single-transaction issue if any task has an invalid enum value |

### Implicit Requirements NOT Addressed:
1. Status values from disk must be validated before INSERT — not just at reconcile time
2. "Applied N schema migrations" log message is specified in the task but not emitted
3. The `db:rebuild` user-visible command ID `db:rebuild` vs actual `db-rebuild` is a spec deviation

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| 0 tasks (empty task-tracking/) | YES | `readdirSync` returns [], 0 imported | OK |
| Missing task-tracking/ directory | YES | Returns `{ imported: 0, skipped: 0, errors: [...] }` | OK |
| task.md exists, status file missing | YES | Defaults to `'CREATED'` | OK |
| status file contains invalid enum (e.g., FIXING) | NO | Passed directly to DB CHECK constraint, causes transaction rollback | Critical |
| type/priority field invalid in task.md | NO | Coerced to defaults, but if coercion is bypassed by future change, causes transaction rollback | Serious |
| DB exists but has 0 tasks | NO | Takes reconcile-only path, never hydrates | Serious |
| handoffs table has rows, db:rebuild called | NO | FK violation crashes the command | Critical |
| Session folder name doesn't match regex | YES | `skipped++` | OK |
| handoff.md missing for a task | YES | `continue` — task simply skipped | OK |
| task has handoff already in DB, rebuild not called | YES | `checkExisting.get()` returns early, skipped | OK |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| `initCortexDatabase` on locked DB | LOW | Returns null, update continues without cortex | Caught, returns null |
| Single-transaction batch + CHECK constraint violation | MEDIUM | All tasks lost silently | Not mitigated — needs fix |
| FK-ordered DELETE on rebuild | HIGH (any project with handoffs) | db:rebuild crashes | Not mitigated — needs fix |
| MCP server running concurrently during update | LOW-MEDIUM | SQLite WAL mode handles concurrent reads; concurrent write could SQLITE_BUSY | WAL mode reduces risk |
| Schema drift between CLI and MCP | ALREADY HAPPENED | CLI-created DB missing CHECK constraints on phases/reviews | Not mitigated |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: `db:rebuild` is broken for any project with existing handoffs data (FK delete ordering). This is the primary recovery command — it must work.

**Blockers before COMPLETE:**
1. Fix `dropHydratableTables` delete order (handoffs first, then tasks)
2. Fix the all-or-nothing transaction — either validate enum values before upsert, or use per-task transactions
3. Add `acceptance_criteria` to the upsert

**Should Address:**
4. Add empty-DB detection in `init-or-migrate` path
5. Apply `VALID_STATUSES` guard in `syncTasksFromFiles`
6. Add migration count to log output
7. Sync CHECK constraints in inlined schema (phases, reviews)

---

## What Robust Implementation Would Include

- **Per-task transactions** (or pre-flight enum validation) so one bad task.md produces a warning and skips, never aborts the batch
- **Empty DB detection**: `dbWasNew || taskCount === 0` → hydrate; else reconcile
- **Correct FK-ordered delete** in `dropHydratableTables`
- **Migration counter returned** from `initCortexDatabase` so callers can log "Applied N migrations"
- **`acceptance_criteria` included** in the hydration upsert
- **`VALID_STATUSES` guard at hydration time** (not just reconcile time)
- **`errors: string[]` on sessions and handoffs** in `HydrationResult` so callers can surface failures

---

## New Lessons for Review Files

The following patterns found in this task are new and should be appended to `backend.md`:

- **FK-ordered DELETEs must delete child tables before parent tables** — when `foreign_keys = ON`, executing `DELETE FROM parent` before `DELETE FROM child` throws `SQLITE_CONSTRAINT_FOREIGNKEY`. In a recovery/rebuild function that drops multiple related tables, always order deletes from most-dependent (leaf tables) to least-dependent (root tables). A reversed order makes the recovery command always fail when the DB has any data. (TASK_2026_141)
- **Hydration transactions that wrap an entire file scan must pre-validate enum values** — a single `upsert.run()` that throws a CHECK constraint violation inside a `db.transaction()` wrapper rolls back ALL previously processed rows in the batch, silently violating the "graceful failure per row" contract. Either validate all enum fields against their valid sets before calling `run()`, or use a per-row transaction so one failure cannot abort sibling rows. (TASK_2026_141)
- **Inlined schema copies must reproduce CHECK constraints verbatim** — when a schema is duplicated from a canonical source to avoid cross-package import restrictions, CHECK constraints on column values (e.g., `CHECK(phase IN (...))`) must be copied exactly. Silently dropping them creates a DB that accepts invalid values the canonical source would reject, and the two DBs behave differently for the same inputs. (TASK_2026_141)
- **File-to-DB hydration must validate disk-read enum values before INSERT, not just at reconcile time** — applying a `VALID_STATUSES` guard only in the reconcile path but not in the initial hydration path means a legacy or mistyped status value triggers a CHECK constraint exception at INSERT time rather than being caught and defaulted with a warning. The validation must be applied uniformly at every point where file content is used as a DB column value. (TASK_2026_141)
- **"DB exists" does not mean "DB has data" — empty-DB detection is required for hydration guards** — checking `!existsSync(dbPath)` to decide whether to run full hydration produces a false negative when the DB file was created by another process (e.g., the MCP server) before any tasks were hydrated. Gate the hydration decision on `dbWasNew OR SELECT COUNT(*) FROM tasks == 0` rather than file existence alone. (TASK_2026_141)
