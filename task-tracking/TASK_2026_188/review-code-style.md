# Code Style Review — TASK_2026_188

## Score: 6/10

## Summary

The orphaned claim recovery implementation is functionally coherent but carries three problems that matter past day one: a silent data-loss risk in the constraint migration path, no transaction wrapping on multi-row releases, and a fragile parse-your-own-JSON coupling between `sessions.ts` and `tasks.ts`. The new code also diverges from the existing codebase pattern for DB row typing (introduced as a lesson in TASK_2026_138) and leaves `claim_timeout_ms` out of the updatable column whitelist with no comment explaining the omission.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The `migrateTasksCheckConstraint` function (`schema.ts:281-299`) reconstructs `tasks_new` without the `claim_timeout_ms` column. Any database that hits this migration path (because `FIXING` or `OPS`/`DESIGN` are not yet in the CHECK constraint) will silently lose every `claim_timeout_ms` value during the table recreation. The column is added back afterward via `applyMigrations`, but it is added empty — any previously set TTLs are permanently gone. This path is exercised on first startup for databases created before TASK_2026_188 landed.

### 2. What would confuse a new team member?

`handleCreateSession` in `sessions.ts` (lines 27-33) calls `handleReleaseOrphanedClaims`, then parses its `content[0].text` JSON to extract the result. A new contributor reading this would not expect a public function to be called as a sub-routine and then have its serialized MCP response re-parsed. The existing pattern in this file for all other multi-step logic is direct function calls with typed return values, not MCP-layer coupling. This is the only place in the file that does this.

### 3. What's the hidden complexity cost?

`handleReleaseOrphanedClaims` calls `detectOrphanedClaims` (which runs two SQL queries) and then issues one UPDATE and one INSERT per orphaned task — all outside a transaction. If the process is killed after the first two UPDATEs and before the last INSERT, the DB is in a partially released state with no event log entries for the released tasks. The next `get_orphaned_claims` call will not report them (claim is gone) and the `CLAIM_RELEASED` events will be missing, making post-mortem debugging impossible.

### 4. What pattern inconsistencies exist?

TASK_2026_138 review lesson: "DB row types must be modeled as typed interfaces, not cast field-by-field." `detectOrphanedClaims` casts the SQLite result with an inline anonymous type on `.all()` (line 286-293) — the established pattern. However, it then builds a second anonymous type for the `orphaned` array (lines 299-306) as a duplicate shape. The function signature's return type (lines 271-278) defines a third copy of the same shape. Three copies of the same 6-field object structure across 35 lines, with no named interface. If a field is added to orphaned claims (e.g., `session_source`), three separate type declarations need updating.

`stale_for_ms` is computed twice for each orphaned task: once in `detectOrphanedClaims` (line 322: `now - claimedAt`) and again in `handleReleaseOrphanedClaims` (line 346-347: `Date.now() - claimedAt`). The second computation happens after a loop that may include DB writes, so the two values are guaranteed to differ. The event log receives the second value; the caller receives the first. This inconsistency will mislead operators reading event logs vs calling `get_orphaned_claims` back-to-back.

### 5. What would I do differently?

- Add `claim_timeout_ms` to the `tasks_new` column list inside `migrateTasksCheckConstraint` to prevent data loss.
- Wrap the entire `handleReleaseOrphanedClaims` loop in a `db.transaction()` for atomicity.
- Extract a named interface `OrphanedClaim` at module scope and use it in place of the three inline anonymous types.
- Make `detectOrphanedClaims` return `stale_for_ms` and reuse it in `handleReleaseOrphanedClaims` instead of recomputing.
- In `handleCreateSession`, call a direct helper that returns a typed struct rather than calling `handleReleaseOrphanedClaims` and re-parsing its serialized JSON response.

---

## Issues Found

### Critical

**1. `migrateTasksCheckConstraint` drops `claim_timeout_ms` data on migration**

- **File**: `packages/mcp-cortex/src/db/schema.ts:281-299`
- **Problem**: The `tasks_new` table DDL inside `migrateTasksCheckConstraint` does not include the `claim_timeout_ms` column. The `shared` column intersection logic on line 308 will exclude it from the `INSERT INTO tasks_new SELECT ... FROM tasks` copy because `tasks_new` does not have that column. After `ALTER TABLE tasks_new RENAME TO tasks`, `claim_timeout_ms` is re-added via `applyMigrations` as a new empty column. Any previously set TTL values are silently zeroed out. This migration runs on startup for any database that predates the FIXING/OPS/DESIGN enum additions, which covers every database deployed before those enum changes were made.
- **Fix**: Add `claim_timeout_ms INTEGER` to the `tasks_new` DDL inside `migrateTasksCheckConstraint`, directly after `claimed_at TEXT`.

**2. `handleReleaseOrphanedClaims` is not transactional**

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:344-377`
- **Problem**: The loop issues one UPDATE and one INSERT per orphaned task without a wrapping transaction. A process kill or exception mid-loop produces a state where some tasks are released with no event log entry, and others are not released at all. The function returns counts only after the full loop — callers cannot distinguish partial release from full release from the return value.
- **Fix**: Wrap the loop body in `db.transaction(() => { ... })()`, consistent with the atomicity pattern used in `handleClaimTask` (line 112).

### Serious

**3. `handleCreateSession` re-parses its own sibling function's serialized output**

- **File**: `packages/mcp-cortex/src/tools/sessions.ts:27-33`
- **Problem**: `handleReleaseOrphanedClaims` returns a `ToolResult` (MCP wire format). `handleCreateSession` then accesses `releaseResult.content[0].text` and `JSON.parse()`s it to read the release count. This is the only instance in the codebase of a function calling a peer function and then decoding its serialized MCP response. If `handleReleaseOrphanedClaims` ever changes its response shape, this parse will silently fail — the `catch {}` on line 31 suppresses the error and the recovery result is omitted from the session creation response with no log. The try/catch is advertised as "best-effort logging only" but what it actually silences is the entire recovery result.
- **Recommendation**: Extract the core detection+release logic into a private function that returns a typed struct `{ released: number; tasks: string[] }`. Both `handleReleaseOrphanedClaims` and `handleCreateSession` call the private function directly. No re-parsing needed.

**4. `claim_timeout_ms` is not in `UPDATABLE_COLUMNS`**

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:53-57`
- **Problem**: `UPDATABLE_COLUMNS` does not include `claim_timeout_ms`. There is no comment explaining whether this omission is intentional (e.g., managed only at task creation) or an oversight. Callers who want to set a TTL on an existing task via `update_task` will get `{ ok: false, reason: "column 'claim_timeout_ms' not updatable" }` with no indication that this is by design. If intentional, it should be documented.
- **Recommendation**: Either add `claim_timeout_ms` to `UPDATABLE_COLUMNS` or add a comment above the set explaining why it is excluded.

**5. `stale_for_ms` computed twice with different timestamps**

- **File**: `packages/mcp-cortex/src/tools/tasks.ts:322` and `346-347`
- **Problem**: `detectOrphanedClaims` computes `stale_for_ms: now - claimedAt` using a `now` captured at function entry (line 279). `handleReleaseOrphanedClaims` recomputes `staleForMs` on line 346-347 using a fresh `Date.now()` call after iterating through DB writes. The value written to the event log differs from the value returned to the caller. For tasks with many orphans, the drift can be seconds. Operators comparing the event log to the tool response will see different numbers for the same claim.
- **Recommendation**: Pass `stale_for_ms` through from `detectOrphanedClaims` (it is already in the returned struct) and use it in the event log INSERT instead of recomputing.

**6. Unused `args` parameter in two tool registrations**

- **File**: `packages/mcp-cortex/src/index.ts:132` and `137`
- **Problem**: Both `get_orphaned_claims` and `release_orphaned_claims` are registered with `(args) => handler(db)`. `args` is declared but never used. TypeScript may not warn if `noUnusedLocals` is off, but it is inconsistent with how zero-parameter tools are registered elsewhere (e.g., `sync_tasks_from_files` on line 107 uses `() =>`). The inconsistency signals the pattern was not checked against existing registration style.
- **Fix**: Change `(args) =>` to `() =>` for both registrations to match the established zero-input-schema pattern.

### Minor

- `detectOrphanedClaims` defines its return type three times (function signature lines 271-278, local array declaration lines 299-306, and implicit via the push on line 317). Extract a named `OrphanedClaim` interface at module scope to eliminate the duplication and make future field additions a single-point change. This is consistent with the TASK_2026_138 lesson: "DB row types must be modeled as typed interfaces, not cast field-by-field."

- The event `source` field in `handleReleaseOrphanedClaims` is `'orphan_recovery'` (line 366) but the task spec says the event should be `event: 'orphan_recovery'` with `event_type: 'CLAIM_RELEASED'`. The inserted row uses `event_type = 'CLAIM_RELEASED'` (implicit, this is correct) but `source = 'orphan_recovery'` rather than `source = 'system'`. The spec at task.md:32 says `session_id: 'system'` which is already correct, but `source` being `'orphan_recovery'` deviates from the pattern where `source` identifies the agent/service role, not the operation name. Compare with `handleLogEvent` where source is `'auto-pilot'` or a worker_id. Minor inconsistency that may confuse event log queries filtering by source.

- `handleCreateSession` builds `recoveryResult` as typed `null` initially, then the conditional on line 40 assigns it. The result type `typeof recoveryResult` resolves to `{ orphaned_claims_released: number; task_ids: string[] } | null`. This works but is unusual TypeScript — the type of the variable changes after assignment via reassignment in the branch, leaving the outer object type annotation awkward. Explicitly type the variable upfront: `let recoveryResult: { orphaned_claims_released: number; task_ids: string[] } | null = null`.

---

## Passed Checks

- `detectOrphanedClaims` correctly handles `claimed_at = null` by falling back to epoch 0 (line 309), preventing NaN in the stale_for_ms calculation.
- The `skip_orphan_recovery` parameter defaulting to `false` (opt-out, not opt-in) is the correct default for production behavior.
- `claim_timeout_ms` TTL check (`isTtlExpired`, line 313) correctly handles the `null` case — no timeout when null.
- The orphan query correctly scopes to `status IN ('CREATED', 'IN_PROGRESS')` — terminal tasks are correctly excluded.
- Migration entry for `claim_timeout_ms` is correctly placed at the end of `TASK_MIGRATIONS` (line 232), preserving migration order.
- Index `idx_tasks_claimed` already exists for `session_claimed` (schema.ts:202), so `detectOrphanedClaims`'s first query is indexed.
- `handleGetOrphanedClaims` and `handleReleaseOrphanedClaims` correctly export with the `export` keyword and are properly imported in `index.ts`.
- Tool descriptions in `index.ts` are clear and consistent with the response shapes.
- `create_session` tool description updated to mention auto-recovery with the skip parameter documented.
