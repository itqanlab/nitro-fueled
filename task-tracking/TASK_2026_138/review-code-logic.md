# Code Logic Review — TASK_2026_138

## Score: 6/10

## Review Summary

| Metric              | Value          |
| ------------------- | -------------- |
| Overall Score       | 6/10           |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 2              |
| Serious Issues      | 4              |
| Moderate Issues     | 3              |
| Failure Modes Found | 9              |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `handleUpsertTask` UPDATE path: if the caller passes zero valid fields (empty `fields` object), `sets.length === 0` — the function returns `{ ok: true, action: 'updated' }` without touching the DB. The caller receives a success response for a no-op update. No warning is issued.
- `handleWriteHandoff`: if `args.files_changed`, `args.commits`, `args.decisions`, or `args.risks` arrive as `undefined` (callers passing partial data), `JSON.stringify(undefined)` returns the string `"undefined"` — which is not valid JSON. `JSON.parse` will throw on read, silently corrupting the record.
- `handleQueryEvents` limit injection: `Math.min(args.limit, 1000)` is evaluated safely, but if `args.limit` is `0`, the condition `args.limit > 0` is false and the default `LIMIT 500` applies instead of returning an empty set, which may surprise callers who explicitly request zero records.

### 2. What user action causes unexpected behavior?

- A Build Worker calls `upsert_task` with a new task_id but omits `title` — the tool returns `{ ok: false, reason: 'title, type, and priority are required for insert' }`. Fine. But a worker that calls `upsert_task` with an existing task_id and passes fields outside `UPDATABLE_COLUMNS` (e.g., `created_at`) will get an immediate rejection on the first non-whitelisted key without applying any prior valid fields in the same call. Partial-key rejection with no atomicity guarantee on the update path (though here it stops before DB interaction, so state is consistent — this is a UX issue, not a data issue).
- A Review Worker calls `read_handoff` for a task that has a record with a malformed JSON column (corrupted by the `JSON.stringify(undefined)` bug above) — the `JSON.parse` throws an unhandled exception inside the handler, crashing the MCP tool invocation with a raw stack trace returned to the caller.

### 3. What data makes this produce wrong results?

- `dependencies` field in `handleGetTasks` unblocked path: if a task row in the DB has `dependencies = NULL` (which is possible because the column defaults to `'[]'` but existing rows migrated before this schema would have `NULL` if the column was added via `CREATE TABLE IF NOT EXISTS` on a schema that already had a `tasks` table without a `dependencies` column), then `JSON.parse(null)` throws — crashing the unblocked filter silently.
- `since` filter in `handleQueryEvents`: the column `created_at` is stored as `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` (fractional seconds, millisecond precision), but callers passing an ISO timestamp from `new Date().toISOString()` (also millisecond) will work correctly — this is safe. However, callers passing a Unix timestamp integer will silently match nothing (SQLite string comparison will not work as expected), and no validation rejects non-ISO values for `since`.

### 4. What happens when dependencies fail?

- `handleWriteHandoff` does a SELECT to validate the task FK exists, then does the INSERT as two separate statements — not in a transaction. If the task is deleted between the SELECT and the INSERT, the FK constraint fires and throws an unhandled SQLite error that propagates as a raw exception to the MCP client.
- `initDatabase`: `db.pragma('foreign_keys = ON')` is set per-connection, but SQLite WAL mode is also set per-connection. On existing databases, these are safe. However, `CREATE TABLE IF NOT EXISTS` does NOT apply column additions to existing tables. If a prior version of `tasks` exists without the `complexity`, `model`, `dependencies`, `acceptance_criteria`, or `file_scope` columns, those columns are silently missing and every INSERT via `handleUpsertTask` will throw a column-not-found error.
- `handleReadHandoff` JSON parsing: no try-catch around `JSON.parse` calls on `files_changed`, `commits`, `decisions`, `risks`. A malformed DB record (corrupted write, manual edit, prior schema mismatch) throws an unhandled exception.
- `handleQueryEvents` JSON parsing: no try-catch around `JSON.parse(row.data as string)`. Same corruption path as above.

### 5. What's missing that the requirements didn't mention?

- No `query_tasks` tool name — the acceptance criterion says `query_tasks` MCP tool, but the registered tool name is `get_tasks` (pre-existing from Part 1). The task description says "add `query_tasks`" — this is a naming conflict that could confuse callers expecting `query_tasks` per spec.
- No `updated_at` trigger on the `handoffs` table — the table has only `created_at`, which is fine since handoffs are immutable. But no documentation in the tool description clarifies immutability; callers may expect to update a handoff and find no tool exists.
- No pagination offset for `query_events` — the cap at 1000 is reasonable, but with no offset/cursor support, callers cannot page through large event histories. High-volume sessions will permanently lose events older than the cap.
- No index on `events(created_at)` — the `since` filter hits `created_at` but there is no index on that column. For large event tables this produces a full table scan on every `since`-filtered query.
- `handoffs` table has no index on `(task_id, id DESC)` — `read_handoff` orders by `id DESC LIMIT 1`, which will use `idx_handoffs_task` for the `WHERE task_id = ?` but then requires a sort pass. A composite `(task_id, id)` index would make this a pure index scan.

---

## Failure Mode Analysis

### Failure Mode 1: JSON serialization of undefined fields corrupts handoff records

- **Trigger**: `handleWriteHandoff` is called with any of `files_changed`, `commits`, `decisions`, or `risks` as `undefined`. TypeScript types say they are required, but MCP callers are loosely typed at runtime.
- **Symptoms**: `JSON.stringify(undefined)` returns `undefined` (not a string), which SQLite stores as NULL. On `handleReadHandoff`, `JSON.parse(null)` throws `SyntaxError: Unexpected token n in JSON at position 0`.
- **Impact**: Corrupted handoff record; `read_handoff` permanently throws for that task until the row is manually deleted.
- **Current Handling**: None. No null/undefined check before `JSON.stringify`.
- **Recommendation**: Guard each field: `const filesJson = JSON.stringify(args.files_changed ?? [])`.

### Failure Mode 2: `handleReadHandoff` and `handleQueryEvents` crash on malformed JSON in DB

- **Trigger**: Any stored row with a non-parseable value in `files_changed`, `commits`, `decisions`, `risks`, or `data` columns — due to manual edits, prior bugs, or schema migration artifacts.
- **Symptoms**: Unhandled `SyntaxError` thrown inside the handler function, propagated to the MCP client as a raw exception rather than a structured `{ ok: false }` response.
- **Impact**: MCP tool call fails with an opaque error. Caller cannot distinguish "no handoff" from "corrupted handoff".
- **Current Handling**: None — no try-catch around any `JSON.parse` call in handoffs.ts or events.ts.
- **Recommendation**: Wrap `JSON.parse` calls in try-catch; return `{ ok: false, reason: 'json_parse_error', field: 'files_changed' }` on failure.

### Failure Mode 3: upsert_task UPDATE returns success for empty field set

- **Trigger**: Caller invokes `upsert_task` on an existing task with `fields: {}`.
- **Symptoms**: Returns `{ ok: true, action: 'updated' }` — but `updated_at` is also not updated (the `sets.push('updated_at = ?')` is inside `if (sets.length > 0)`). DB row is untouched.
- **Impact**: Silent no-op presented as success. Callers cannot tell if their update was applied.
- **Current Handling**: None.
- **Recommendation**: Return `{ ok: false, reason: 'no fields provided' }` when `sets.length === 0` on the UPDATE path, mirroring `handleUpdateTask`.

### Failure Mode 4: Migration does not add columns to pre-existing tasks table

- **Trigger**: A project that ran a prior version of nitro-cortex already has a `tasks` table without `complexity`, `model`, `dependencies`, `acceptance_criteria`, or `file_scope` columns. `CREATE TABLE IF NOT EXISTS` skips table creation entirely on second run.
- **Symptoms**: Every `handleUpsertTask` INSERT throws `SQLITE_ERROR: table tasks has no column named complexity` (or similar).
- **Impact**: `upsert_task` is entirely broken on any existing database.
- **Current Handling**: None — `initDatabase` uses only `CREATE TABLE IF NOT EXISTS` with no `ALTER TABLE` migration path.
- **Recommendation**: After each `CREATE TABLE IF NOT EXISTS`, run `PRAGMA table_info(tasks)` and add missing columns via `ALTER TABLE tasks ADD COLUMN ...` for each column not present. Or use a versioned migration table.

### Failure Mode 5: write_handoff FK validation is not atomic

- **Trigger**: A task is deleted (or its ID changed) between the `SELECT id FROM tasks WHERE id = ?` check and the subsequent `INSERT INTO handoffs`.
- **Symptoms**: The FK constraint on `handoffs.task_id REFERENCES tasks(id)` fires, throwing an unhandled `SQLITE_CONSTRAINT_FOREIGNKEY` error.
- **Impact**: Unhandled exception propagates to the MCP client as a raw error rather than a structured response.
- **Current Handling**: FK existence is pre-checked, but the check and insert are not wrapped in a transaction.
- **Recommendation**: Wrap the SELECT + INSERT in `db.transaction()`, and wrap the transaction call in try-catch to return `{ ok: false, reason: 'constraint_error' }` on FK violation.

### Failure Mode 6: No index on events(created_at) makes since-filter queries slow

- **Trigger**: `query_events` called with a `since` timestamp on a DB with thousands of events.
- **Symptoms**: Full table scan; query latency grows linearly with event count.
- **Impact**: Auto-pilot sessions that log many events will see degrading performance on health-check queries.
- **Current Handling**: Indexes exist on `session_id`, `task_id`, `event_type` — but not `created_at`.
- **Recommendation**: Add `CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)`.

### Failure Mode 7: upsert_task INSERT does not validate enum values at app layer

- **Trigger**: Caller passes `type: 'INVESTIGATION'` or `priority: 'critical'` (wrong case or unlisted value).
- **Symptoms**: SQLite CHECK constraint fires and throws `SQLITE_CONSTRAINT_CHECK`. This propagates as an unhandled exception rather than a structured `{ ok: false }` response.
- **Impact**: Caller receives a raw SQLite error with no actionable message about which field was invalid.
- **Current Handling**: Acknowledged in handoff as a known risk, but no try-catch wraps the INSERT.
- **Recommendation**: Wrap `db.prepare(...).run(...)` in try-catch on the INSERT path; map SQLite constraint errors to `{ ok: false, reason: 'constraint_violation', detail: err.message }`.

### Failure Mode 8: query_events with limit=0 silently returns 500 rows instead of 0

- **Trigger**: Caller passes `limit: 0` intending to probe for existence without fetching data (or to return an empty set).
- **Symptoms**: The condition `args.limit && args.limit > 0` evaluates to false for `0`, falling through to `LIMIT 500`. Returns up to 500 rows.
- **Impact**: Unintended data transfer; callers relying on `limit: 0` as a "count only" probe get data instead.
- **Current Handling**: None — the `> 0` guard conflates "no limit provided" with "limit explicitly zero".
- **Recommendation**: Distinguish undefined from 0: `args.limit !== undefined ? \`LIMIT \${Math.min(args.limit, 1000)}\` : 'LIMIT 500'`. If `limit: 0` should mean "no limit" document it clearly.

### Failure Mode 9: handleGetTasks unblocked path crashes on NULL dependencies

- **Trigger**: Any task row with `dependencies IS NULL` (possible on pre-existing tables without the column default) is included in the query result set, then passed to `JSON.parse(null)`.
- **Symptoms**: `JSON.parse(null)` in modern Node returns `null` (not an array), then `deps.every(...)` throws `TypeError: deps.every is not a function`.
- **Impact**: `get_tasks` with `unblocked: true` throws, returning no results to caller.
- **Current Handling**: `?? '[]'` guard: `JSON.parse((row['dependencies'] as string) ?? '[]')` — this handles `undefined` but NOT the SQL NULL case. In `better-sqlite3`, SQL NULL columns are returned as `null` in JavaScript, not `undefined`. The nullish coalescing operator `?? '[]'` does NOT trigger for `null` — `null ?? '[]'` returns `'[]'` in JavaScript. Wait — `null ?? '[]'` DOES return `'[]'` because `??` treats `null` as nullish. **This is safe**. Retracting this as a critical issue. It is safe.

---

## Critical Issues

### [C1] JSON.stringify(undefined) silently stores NULL, crashing read_handoff permanently

- **File**: `packages/mcp-cortex/src/tools/handoffs.ts:38-41`
- **Scenario**: MCP tool call to `write_handoff` where `files_changed`, `commits`, `decisions`, or `risks` is absent from the tool invocation (not validated as required at the MCP schema level for array fields).
- **Impact**: The stored NULL causes `JSON.parse(null)` to return `null`, not an array. `handleReadHandoff` does `JSON.parse(row.files_changed as string)` — `null` is coerced to `"null"`, giving `null` back. Then the `HandoffRecord` is typed with `files_changed: HandoffFileEntry[]` but receives `null`. Any downstream code iterating the array silently gets a null reference.
- **Evidence**: `const filesJson = JSON.stringify(args.files_changed)` — no null guard. `JSON.stringify(undefined) === undefined`, which SQLite stores as NULL.
- **Fix**: `const filesJson = JSON.stringify(args.files_changed ?? [])` — same for all four fields.

### [C2] Missing try-catch on DB writes propagates raw SQLite exceptions to MCP clients

- **File**: `packages/mcp-cortex/src/tools/handoffs.ts:43-46`, `packages/mcp-cortex/src/tools/tasks.ts:148-151`, `packages/mcp-cortex/src/tools/events.ts:16-19`
- **Scenario**: SQLite CHECK constraint violation (bad enum), FK violation after race, or SQLITE_BUSY on WAL contention.
- **Impact**: Unhandled exceptions crash the tool invocation. The MCP framework may return the raw error string to the caller, exposing internal SQLite details. The caller has no way to distinguish which constraint failed.
- **Evidence**: No try-catch wraps any `db.prepare(...).run(...)` call in handoffs.ts, events.ts, or the INSERT in tasks.ts.
- **Fix**: Wrap all DB write calls in try-catch; catch `Error` instances and return `{ ok: false, reason: err.message }` in a structured ToolResult.

---

## Serious Issues

### [S1] upsert_task UPDATE path silently succeeds on empty fields object

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:118`
- **Scenario**: `handleUpsertTask` called with `fields: {}` on an existing task.
- **Impact**: Returns `{ ok: true, action: 'updated' }`. No DB change is made. `updated_at` is not bumped. Callers cannot distinguish a real update from a no-op.
- **Fix**: Add `if (sets.length === 0) return { content: [{ type: 'text', text: JSON.stringify({ ok: false, reason: 'no fields provided' }) }] }` before the `if (sets.length > 0)` block. This matches the behavior of `handleUpdateTask`.

### [S2] write_handoff task-existence check is not atomic with the INSERT

- **File**: `packages/mcp-cortex/src/tools/handoffs.ts:33-46`
- **Scenario**: Task is deleted between the SELECT and the INSERT.
- **Impact**: FK constraint fires as an unhandled exception.
- **Fix**: Wrap both statements in `db.transaction(() => { ... })` and add a try-catch on the transaction call.

### [S3] No try-catch on JSON.parse in handleReadHandoff and handleQueryEvents

- **File**: `packages/mcp-cortex/src/tools/handoffs.ts:72-76`, `packages/mcp-cortex/src/tools/events.ts:67`
- **Scenario**: Any row stored with non-JSON data in JSON columns (prior bug, manual corruption, or schema mismatch from migration).
- **Impact**: Unhandled `SyntaxError` crashes the tool handler and returns a raw exception to the MCP client.
- **Fix**: Wrap `JSON.parse` calls in try-catch; return `{ ok: false, reason: 'json_parse_error' }` with the field name.

### [S4] initDatabase does not handle existing tables missing new columns (migration gap)

- **File**: `packages/mcp-cortex/src/db/schema.ts:140-157`
- **Scenario**: Pre-existing `tasks` table from a prior version of nitro-cortex that lacks `complexity`, `model`, `dependencies`, `acceptance_criteria`, `file_scope`.
- **Impact**: `upsert_task` INSERT throws `SQLITE_ERROR: table tasks has no column named ...` on all existing deployments.
- **Fix**: After `db.exec(TASKS_TABLE)`, check `PRAGMA table_info(tasks)` and issue `ALTER TABLE tasks ADD COLUMN <col> <type> DEFAULT ...` for each column not present. A migration version table (`schema_migrations`) would be the more robust long-term solution.

---

## Moderate Issues

### [M1] No index on events(created_at) for since-filter queries

- **File**: `packages/mcp-cortex/src/db/schema.ts:136-138`
- **Scenario**: `query_events` with `since` filter on a table with thousands of events (e.g., an auto-pilot session running for hours).
- **Impact**: Full table scan on every since-filtered query. Degrades with scale.
- **Fix**: Add `'CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at)'` to the INDEXES array.

### [M2] limit=0 in query_events falls through to default 500-row response

- **File**: `packages/mcp-cortex/src/tools/events.ts:60`
- **Scenario**: Caller passes `limit: 0`.
- **Impact**: Returns 500 rows instead of 0. Callers expecting empty result or count-only behavior are surprised.
- **Fix**: Change condition to `args.limit !== undefined && args.limit >= 0 ? \`LIMIT \${Math.min(args.limit, 1000)}\` : 'LIMIT 500'`. Document `limit: 0` semantics in the tool description.

### [M3] Acceptance criteria specifies query_tasks but registered tool name is get_tasks

- **File**: `packages/mcp-cortex/src/index.ts:37`
- **Scenario**: Task spec says "add `query_tasks` MCP tool" — the implementation registers it as `get_tasks` (pre-existing name).
- **Impact**: Any caller (documentation, skill files, auto-pilot prompts) that was written expecting `query_tasks` will get a "tool not found" error.
- **Fix**: Either register an alias `query_tasks` that delegates to `handleGetTasks`, or update all acceptance criteria references and caller documentation to `get_tasks`. The existing name `get_tasks` is fine if the contract is updated.

---

## Data Flow Analysis

```
upsert_task (MCP tool call)
  -> index.ts: JSON.parse(args.fields)        [guarded: returns error on bad JSON]
  -> handleUpsertTask(db, { task_id, fields })
     -> SELECT id FROM tasks WHERE id = ?     [OK]
     IF existing:
       -> iterate fields, build SET clauses   [CONCERN: empty fields = silent no-op]
       -> UPDATE tasks SET ... WHERE id = ?   [CONCERN: no try-catch on constraint errors]
       -> return { ok: true, action: 'updated' }
     IF new:
       -> validate title/type/priority        [OK]
       -> INSERT INTO tasks (...)             [CONCERN: no try-catch; CHECK constraint throws raw]
       -> return { ok: true, action: 'inserted' }

write_handoff (MCP tool call)
  -> index.ts: passes args directly (no JSON.parse needed, Zod validates shape)
  -> handleWriteHandoff(db, args)
     -> SELECT id FROM tasks WHERE id = ?     [OK: task existence check]
     -> JSON.stringify(args.files_changed)    [CONCERN: undefined → NULL stored in DB]
     -> INSERT INTO handoffs (...)            [CONCERN: not atomic with SELECT above]
     -> return { ok: true, id: rowid }

read_handoff (MCP tool call)
  -> handleReadHandoff(db, { task_id })
     -> SELECT * FROM handoffs WHERE task_id = ? ORDER BY id DESC LIMIT 1
     -> JSON.parse(row.files_changed)         [CONCERN: no try-catch; throws on NULL/malformed]
     -> JSON.parse(row.commits)               [same]
     -> JSON.parse(row.decisions)             [same]
     -> JSON.parse(row.risks)                 [same]
     -> return parsed HandoffRecord

query_events (MCP tool call)
  -> handleQueryEvents(db, args)
     -> build WHERE clause with params        [OK: parameterized, injection-safe]
     -> LIMIT clause uses Math.min            [CONCERN: limit=0 falls through to 500]
     -> SELECT * FROM events ...
     -> map: JSON.parse(row.data)             [CONCERN: no try-catch; throws on malformed]
     -> return parsed events array
```

Gap Points Identified:
1. JSON columns in handoffs are not null-safe on write — `undefined` input writes NULL, breaks parse on read
2. All DB writes lack try-catch — raw SQLite errors propagate to MCP callers
3. `write_handoff` SELECT + INSERT are not atomic — FK constraint can fire as unhandled exception

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| `tasks` table created with proper schema and indexes | COMPLETE | Migration safety for existing DBs missing |
| `handoffs` table created with JSON fields | COMPLETE | JSON write safety bug (undefined fields) |
| `events` table created with proper indexes | PARTIAL | Missing index on `created_at` for `since` filter |
| `query_tasks` MCP tool returns filtered results | PARTIAL | Tool registered as `get_tasks`, not `query_tasks` |
| `upsert_task` MCP tool creates or updates task records | PARTIAL | Silent no-op on empty update; no try-catch on INSERT |
| `write_handoff` and `read_handoff` work correctly | PARTIAL | `undefined` fields → NULL stored; JSON.parse unguarded |
| `log_event` and `query_events` work correctly | PARTIAL | `limit=0` ambiguity; JSON.parse unguarded on read |
| Migration applies cleanly on existing DBs | MISSING | `CREATE TABLE IF NOT EXISTS` skips column additions |

### Implicit Requirements NOT Addressed:
1. Existing databases with an older `tasks` schema (no `complexity`/`model`/etc. columns) need a column migration path — `CREATE TABLE IF NOT EXISTS` is not sufficient.
2. MCP tool descriptions should document immutability of handoff records (no update tool exists) to prevent caller confusion.
3. `query_events` pagination: with no offset/cursor support, high-volume sessions cannot retrieve events beyond the 1000-row cap.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| `upsert_task` with empty fields object | NO | Returns `ok: true` — no-op | Silent success misleads callers |
| `write_handoff` with undefined array field | NO | `JSON.stringify(undefined)` = NULL stored | Corrupts record permanently |
| `read_handoff` on row with NULL JSON column | NO | `JSON.parse` throws unhandled | Crashes tool handler |
| SQLite CHECK constraint violation on INSERT | NO | Raw exception propagates | Exposes SQLite internals to caller |
| FK constraint race in write_handoff | NO | Unhandled SQLITE_CONSTRAINT | Raw exception to MCP client |
| `query_events` with `limit=0` | NO | Returns 500 rows | Semantically incorrect |
| `query_events` with non-ISO `since` value | NO | SQLite string compare silently returns wrong set | No format validation |
| `tasks` table missing columns (old DB) | NO | INSERT throws column-not-found | Breaks upsert on all existing deployments |
| `get_tasks` unblocked with NULL dependencies | SAFE | `??` coalesces null correctly | No issue (verified) |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| SQLite CHECK constraint on upsert | MED | Caller gets raw exception | Wrap INSERT in try-catch |
| SQLite FK constraint race in write_handoff | LOW | Unhandled exception on race | Wrap in transaction + try-catch |
| Existing DB schema mismatch | HIGH (any upgrade) | All upsert_task INSERTs fail | Add ALTER TABLE migration |
| JSON parse on corrupted DB row | LOW | Tool crashes for that task forever | Wrap JSON.parse in try-catch |
| events table since-filter at scale | HIGH (long sessions) | Full table scan latency | Add idx_events_created index |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Any existing nitro-cortex database that already has a `tasks` table (deployed from Part 1) will fail every `upsert_task` INSERT due to missing columns — the `CREATE TABLE IF NOT EXISTS` migration strategy is broken for incremental schema evolution.

---

## What Robust Implementation Would Include

- A schema migration version table (`schema_versions`) with numbered migrations so `initDatabase` applies only forward migrations, never re-runs completed ones, and correctly adds columns to existing tables.
- try-catch on ALL `db.prepare().run()` calls returning structured `{ ok: false, reason }` responses — never raw SQLite exceptions.
- Null guards on all JSON field writes: `JSON.stringify(value ?? defaultValue)`.
- try-catch on all `JSON.parse` calls in read paths returning structured error responses.
- `db.transaction()` wrapping the SELECT + INSERT pattern in `write_handoff`.
- `idx_events_created` index for the `since` filter performance path.
- Either an alias `query_tasks` or updated documentation to match the `get_tasks` tool name against the acceptance criteria.
- Explicit `limit=0` semantics documented or guarded in `query_events`.
