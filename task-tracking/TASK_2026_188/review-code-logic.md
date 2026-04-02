# Code Logic Review — TASK_2026_188

## Score: 6/10

## Summary

The core orphan-recovery logic is correctly conceived and the happy path works. However, the implementation has a serious atomicity gap in `release_orphaned_claims` (releases are not wrapped in a transaction), a stale-state race between detection and release, and a missing `event_type` field in the CLAIM_RELEASED event that breaks the task specification. The TTL elapsed-time reporting is also slightly incorrect. None of these are crash risks, but the atomicity gap can produce partial releases under concurrent load — the primary scenario this feature is designed for.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `handleReleaseOrphanedClaims` runs individual UPDATE and INSERT statements inside a plain loop with no transaction. If the process is killed between iteration N and N+1, some tasks are released and logged while others remain claimed. The function returns `{ released: 3, tasks: [...] }` even for partial completions — the caller has no way to know the operation was interrupted.
- `handleCreateSession` wraps `handleReleaseOrphanedClaims` in a try/catch that silently swallows parse errors. If JSON.parse fails for any reason (e.g., the content array is malformed), `recoveryResult` stays `null` and the session is returned without the `orphan_recovery` field — the caller cannot distinguish "no orphans" from "recovery silently failed".
- The `UPDATE tasks ... WHERE id = ?` inside `handleReleaseOrphanedClaims` has no `info.changes` check. If the WHERE clause matches zero rows (task was concurrently deleted or reclaimed), it silently succeeds, the task ID is added to `releasedTaskIds`, and a CLAIM_RELEASED event is logged for a task that was not actually released.

### 2. What user action causes unexpected behavior?

- A supervisor session starts (S1). While `create_session` is executing orphan recovery, a second supervisor starts concurrently (S2). Both call `detectOrphanedClaims` at approximately the same time, see the same set of orphaned tasks, and then both issue `UPDATE ... SET session_claimed = NULL` for the same tasks. This is safe for the UPDATE (both set to NULL), but it produces duplicate `CLAIM_RELEASED` events for each task — the event log will show the same task released twice by two "system" entries, corrupting telemetry and misleading future `query_events` consumers.
- A user calls `release_orphaned_claims` manually while a `create_session` auto-recovery is in-flight. Same double-release/double-event problem.

### 3. What data makes this produce wrong results?

- **`claimed_at` is NULL.** The code handles this with `const claimedAt = task.claimed_at ? new Date(task.claimed_at).getTime() : 0`, substituting epoch (0) when `claimed_at` is missing. This means `stale_for_ms` becomes `Date.now() - 0 = ~1.7 trillion milliseconds` for any task with a NULL `claimed_at`. The value is technically harmless (will match the orphan condition), but it is wildly misleading in the `stale_for_ms` field returned to callers.
- **`claim_timeout_ms` is set, session is still running, but `claimed_at` is NULL.** `isTtlExpired` evaluates to `(now - 0) > claim_timeout_ms`, which is always true. A task with a NULL `claimed_at` and any `claim_timeout_ms` will perpetually appear as TTL-expired, even when genuinely active.
- **`claimed_at` contains a non-parseable string.** `new Date("garbage").getTime()` returns `NaN`. `(now - NaN) > claimTimeout` is `false` (NaN comparison), so the TTL check silently fails and the task is orphaned only by the session-dead check — not by TTL. No error is surfaced.
- **`stale_for_ms` is recalculated in `handleReleaseOrphanedClaims` instead of reusing the value from `detectOrphanedClaims`.** The `orphaned` objects already carry `stale_for_ms`, but the release function calls `Date.now()` again. This means the logged `stale_for_ms` in the CLAIM_RELEASED event will always be slightly larger than the value returned by `get_orphaned_claims`, and in extreme cases (slow DB, many orphans) can diverge significantly.

### 4. What happens when dependencies fail?

- **SQLite throws during the release loop.** There is no try/catch in `handleReleaseOrphanedClaims`. If any UPDATE or INSERT throws (e.g., SQLITE_CONSTRAINT, SQLITE_BUSY), the exception propagates up through `handleCreateSession`'s try/catch, which only catches JSON parse errors — the SQLite exception will propagate uncaught and crash the MCP request handler. Because better-sqlite3 is synchronous, SQLITE_BUSY is uncommon in single-process WAL mode, but `SQLITE_CONSTRAINT` on the events INSERT (e.g., if `task_id` FK is violated) is a real risk.
- **`detectOrphanedClaims` is called twice** — once in `handleGetOrphanedClaims`/`handleReleaseOrphanedClaims`, and in `handleCreateSession` the return value of `handleReleaseOrphanedClaims` is JSON-parsed. The try/catch in `handleCreateSession` is narrowly scoped to `JSON.parse`. A DB exception inside `handleReleaseOrphanedClaims` itself will not be caught there and will surface as an unhandled MCP tool error.

### 5. What's missing that the requirements didn't mention?

- **CLAIM_RELEASED event `event_type` field is wrong.** The task specification (task.md) says the event should be: `{ task_id, session_id: 'system', event: 'orphan_recovery', details: { was_claimed_by, stale_for_ms } }`. The implementation inserts `event_type = 'CLAIM_RELEASED'` (from the tool description in index.ts), but the data JSON does not use the `event` key or the `details` wrapper — it uses a flat `{ task_id, was_claimed_by, stale_for_ms }` structure. The spec's `session_id: 'system'` is correctly implemented. The `event_type` value and event data shape deviate from spec.
- **No test coverage for the new orphan tools.** The spec file `sessions.spec.ts` only covers pre-existing session tools. There are no tests for `handleGetOrphanedClaims`, `handleReleaseOrphanedClaims`, TTL expiration logic, the double-release scenario, or the `skip_orphan_recovery` parameter.
- **`migrateTasksCheckConstraint` recreates `tasks_new` without `claim_timeout_ms`.** The table recreation SQL at line 282-299 of schema.ts does not include `claim_timeout_ms` in the `tasks_new` DDL. Any database that requires this migration path (i.e., one that has not yet run the ALTER TABLE migration and still has outdated CHECK constraints) will lose the `claim_timeout_ms` column during the constraint migration, after which the `applyMigrations` call will re-add it as empty. Data in that column for pre-existing rows will be dropped silently.
- **`release_orphaned_claims` always resets status to `CREATED`.** The task specification says status reset to `CREATED`. But a task in `IN_PROGRESS` that gets orphaned may have already completed partial work. Resetting to `CREATED` is correct per spec, but there is no guard preventing a `COMPLETE`, `IMPLEMENTED`, or `IN_REVIEW` task from being reset if it somehow has a non-NULL `session_claimed` (e.g., from a direct `update_task` call). The WHERE clause in `detectOrphanedClaims` filters `status IN ('CREATED', 'IN_PROGRESS')` so this is contained — but it is worth noting the implicit reliance.

---

## Issues Found

### Critical (must fix)

**1. Missing transaction in `release_orphaned_claims` — partial releases possible**

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/tasks.ts` lines 338-378

The loop issuing individual UPDATEs and INSERTs is not wrapped in a `db.transaction()`. If the process dies or SQLite throws mid-loop, some tasks are released with logged events while others remain claimed. The function returns a success-shaped response with partial `tasks` array even for interrupted runs. The backend review lessons explicitly call out "Multi-step DB writes must be in a transaction."

Fix: Wrap the entire loop body in a single `db.transaction(() => { ... })()` call.

**2. `claim_timeout_ms` column missing from `migrateTasksCheckConstraint` recreation DDL**

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/db/schema.ts` lines 282-299

The `tasks_new` table created during the constraint migration (triggered when the existing `tasks` table lacks `'FIXING'` or `'OPS'` in its CHECK) does not include the `claim_timeout_ms INTEGER` column. Because `applyMigrations` runs after table creation and copies only the *intersection* of columns, any `claim_timeout_ms` data present before the migration is silently dropped.

Fix: Add `claim_timeout_ms INTEGER` to the `tasks_new` DDL inside `migrateTasksCheckConstraint`, matching the authoritative `TASKS_TABLE` definition.

**3. CLAIM_RELEASED event shape deviates from specification**

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/tasks.ts` lines 356-367

The task spec (`task.md`) defines the event as:
```json
{ "task_id": "...", "session_id": "system", "event": "orphan_recovery", "details": { "was_claimed_by": "...", "stale_for_ms": 0 } }
```
The implementation uses `event_type = 'CLAIM_RELEASED'` and a flat data payload `{ task_id, was_claimed_by, stale_for_ms }` — no `event` key, no `details` wrapper. Callers querying events by `event_type` will find nothing if they filter on `'orphan_recovery'` as the spec implies.

Fix: Either align `event_type` to `'orphan_recovery'` and wrap the payload in `details`, or update the task spec to reflect the actual contract. Pick one and be consistent.

**4. No test coverage for any new functionality**

File: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sessions.spec.ts`

`handleGetOrphanedClaims`, `handleReleaseOrphanedClaims`, TTL expiration, `skip_orphan_recovery`, and the auto-recovery integration path have zero test coverage. The acceptance criteria state "TypeScript compiles without errors" but the task metadata says `Testing: required`. The handoff claims all acceptance criteria are met but no tests validate: dead-session detection, TTL-expired detection, atomic release, event logging, or the `orphan_recovery` field in `create_session` response.

Fix: Add tests for at minimum: (a) `get_orphaned_claims` with a dead session, (b) TTL expiration with an active session, (c) `release_orphaned_claims` returns correct count and logs events, (d) `create_session` response includes `orphan_recovery` when releases occurred, (e) `skip_orphan_recovery: true` suppresses recovery.

### Moderate

**5. `stale_for_ms` is `~1.7 trillion` when `claimed_at` is NULL**

File: `tasks.ts` line 309

`const claimedAt = task.claimed_at ? new Date(task.claimed_at).getTime() : 0` falls back to epoch zero. This produces a nonsensical `stale_for_ms` value in the output that will confuse operators reading orphan reports.

Fix: Return `null` for `stale_for_ms` when `claimed_at` is NULL, or explicitly document the sentinel value.

**6. Double-release race condition under concurrent sessions**

Two concurrent `create_session` calls both trigger `detectOrphanedClaims` → both see the same orphaned tasks → both release the same tasks → duplicate CLAIM_RELEASED events emitted. The UPDATE is idempotent (setting NULL twice is harmless) but the event INSERT is not — the events table will have two rows for the same task with `source = 'orphan_recovery'`, creating misleading audit history.

Fix: Add a `WHERE session_claimed IS NOT NULL` guard to the release UPDATE and skip the event INSERT when `info.changes === 0`.

**7. `stale_for_ms` recalculated instead of reused in `handleReleaseOrphanedClaims`**

File: `tasks.ts` lines 346-348

`detectOrphanedClaims` already computes and stores `stale_for_ms` on each orphan object. `handleReleaseOrphanedClaims` ignores it and re-derives it with a second `Date.now()` call. The released event will log a different (always larger) staleness than what `get_orphaned_claims` would report for the same task.

Fix: Use `task.stale_for_ms` directly instead of recomputing.

**8. `handleCreateSession` try/catch only guards JSON.parse, not DB errors**

File: `sessions.ts` lines 27-34

The catch block around `handleReleaseOrphanedClaims` is labeled "If parsing fails, don't block session creation." But `handleReleaseOrphanedClaims` can throw SQLite exceptions (no try/catch inside it). A DB throw will escape this catch (which only catches parse errors conceptually) — actually in JavaScript all exceptions are caught regardless of type, so this is safe in practice. However, the comment is misleading and if the intent was to make all DB errors best-effort, the catch should be explicit (`catch (err) { /* swallow: best-effort recovery */ }`).

This is a minor code clarity issue, not a functional bug.

---

## Acceptance Criteria Checklist

- [x] `get_orphaned_claims` returns tasks claimed by dead sessions — implemented correctly; cross-references `loop_status = 'running'`
- [x] `release_orphaned_claims` resets those tasks to CREATED and logs CLAIM_RELEASED events — functional but event shape deviates from spec (Critical #3) and missing transaction (Critical #1)
- [x] `create_session()` auto-runs orphan recovery on startup — implemented; `skip_orphan_recovery` parameter wired correctly
- [x] `claim_timeout_ms` column added to tasks schema with migration — column present in `TASKS_TABLE` and `TASK_MIGRATIONS`; **however** the column is absent from `migrateTasksCheckConstraint`'s `tasks_new` DDL (Critical #2)
- [x] TTL-expired claims appear in orphan results even if session is still active — logic correct: `isTtlExpired = claimTimeout !== null && (now - claimedAt) > claimTimeout`
- [~] TypeScript compiles without errors — reported by developer, not independently verified in this review; logic issues noted are runtime, not compile-time

---

## Passed Checks

- `detectOrphanedClaims` correctly handles both orphan conditions (dead session OR TTL expired) as an OR, not AND — matches spec intent.
- `activeSessions` is built as a `Set<string>` before the loop — O(1) lookup per task, efficient even for large task sets.
- `handleClaimTask` existing atomicity (SQLite transaction + conditional SELECT) is preserved and not disturbed by this change.
- `skip_orphan_recovery: true` parameter correctly prevents any DB write at session startup — testing/scripted callers can opt out cleanly.
- `handleReleaseOrphanedClaims` is correctly called as a function (not a tool invocation) from `handleCreateSession`, avoiding MCP serialization overhead.
- Schema migration correctly uses `applyMigrations` pattern and `PRAGMA table_info` to avoid duplicate `ALTER TABLE` on subsequent starts.
- `event_type` on the events table insert uses `source` and `event_type` columns that exist and are indexed (`idx_events_type`).
- `session_id = 'system'` on the released events is a valid sentinel that will not match any real session ID.
- Tool registrations in `index.ts` use empty `inputSchema: {}` for no-parameter tools — consistent with MCP SDK conventions.

---

## What Robust Implementation Would Include

- `handleReleaseOrphanedClaims` wrapped in a single `db.transaction()` so all releases are atomic.
- A `WHERE session_claimed IS NOT NULL` guard in the release UPDATE, with `info.changes === 0` check to skip event logging for tasks concurrently reclaimed.
- `stale_for_ms: null` when `claimed_at` is NULL rather than the epoch sentinel.
- `claim_timeout_ms` column included in the `migrateTasksCheckConstraint` table recreation DDL.
- Event shape aligned to spec: `event_type = 'orphan_recovery'` with `details: { was_claimed_by, stale_for_ms }`.
- At least 5 unit tests covering the new code paths (see Critical #4 above).
- A comment or index on `(session_claimed, status)` to make the orphan detection query efficient at scale (current indexes cover `session_claimed` and `status` separately but not the compound case).
