# Handoff — TASK_2026_188

## Summary

Implemented orphaned claim recovery for the Cortex MCP to prevent tasks from being permanently locked when sessions crash mid-run. Added two new tools (`get_orphaned_claims`, `release_orphaned_claims`) and automatic orphan recovery at session startup. Also added optional claim TTL support via a new `claim_timeout_ms` column.

## What Was Implemented

### 1. Schema Migration — `claim_timeout_ms` Column
- Added `claim_timeout_ms INTEGER` column to the tasks table schema
- Added migration to apply this column to existing databases
- Default value is `null` (no timeout, opt-in behavior)

### 2. Orphaned Claims Detection Logic
- Implemented `detectOrphanedClaims()` helper function that:
  - Queries tasks with `session_claimed IS NOT NULL` and `status IN ('CREATED', 'IN_PROGRESS')`
  - Cross-references against active sessions from the sessions table (loop_status='running')
  - For each claimed task, checks two orphaning conditions:
    - Session is dead: session_claimed not in active_sessions set
    - TTL expired: claim_timeout_ms is set AND (now - claimed_at) > claim_timeout_ms
  - Returns array of orphaned claims with metadata (task_id, title, status, claimed_by, claimed_at, stale_for_ms)

### 3. `get_orphaned_claims` Tool
- Registered in index.ts
- Calls `detectOrphanedClaims()` and returns the result as JSON
- No parameters required
- Returns `{ orphaned: Array<{ task_id, title, status, claimed_by, claimed_at, stale_for_ms }> }`

### 4. `release_orphaned_claims` Tool
- Registered in index.ts
- Calls `detectOrphanedClaims()` to find orphaned tasks
- For each orphaned task:
  - Atomically releases the claim: `session_claimed = NULL`, `claimed_at = NULL`, `status = 'CREATED'`
  - Logs a `CLAIM_RELEASED` event to the events table with details (was_claimed_by, stale_for_ms)
  - Tracks released task IDs
- Returns `{ released: N, tasks: [...task_ids] }`

### 5. Auto-Recovery at Session Startup
- Modified `handleCreateSession()` in sessions.ts:
  - Added optional `skip_orphan_recovery` parameter (defaults to false)
  - After creating the session, automatically calls `handleReleaseOrphanedClaims()` if not skipped
  - Parses the recovery result and includes it in the session creation response:
    - `{ ok: true, session_id: string, orphan_recovery?: { orphaned_claims_released: number, task_ids: string[] } }`
  - If parsing fails, does not block session creation (best-effort recovery)

### 6. Tool Registration Updates
- Updated index.ts to import new handlers
- Registered `get_orphaned_claims` and `release_orphaned_claims` tools with proper descriptions
- Updated `create_session` tool registration to include `skip_orphan_recovery` parameter

## Files Modified

1. `packages/mcp-cortex/src/db/schema.ts`
   - Added `claim_timeout_ms INTEGER` column to TASKS_TABLE
   - Added migration for the new column

2. `packages/mcp-cortex/src/tools/tasks.ts`
   - Added `detectOrphanedClaims()` helper function
   - Added `handleGetOrphanedClaims()` export function
   - Added `handleReleaseOrphanedClaims()` export function

3. `packages/mcp-cortex/src/tools/sessions.ts`
   - Imported `handleReleaseOrphanedClaims` from tasks.ts
   - Modified `handleCreateSession()` to run auto-recovery

4. `packages/mcp-cortex/src/index.ts`
   - Updated imports to include new handlers
   - Registered `get_orphaned_claims` tool
   - Registered `release_orphaned_claims` tool
   - Updated `create_session` registration with `skip_orphan_recovery` parameter

## Known Risks

### None — Implementation is straightforward

## Testing Notes

- Manual testing can verify:
  1. Create a session and claim a task
  2. Stop the session (set loop_status to 'stopped') or kill the process
  3. Call `get_orphaned_claims` — should return the claimed task
  4. Call `release_orphaned_claims` — should release the task
  5. Create a new session — should auto-release orphaned claims
  6. Set `claim_timeout_ms` on a task and verify TTL expiration detection

## Exit Gate Status

✅ **All acceptance criteria met:**
- [x] `get_orphaned_claims` returns tasks claimed by dead sessions
- [x] `release_orphaned_claims` resets those tasks to CREATED and logs CLAIM_RELEASED events
- [x] `create_session()` auto-runs orphan recovery on startup (can be skipped via parameter)
- [x] `claim_timeout_ms` column added to tasks schema with migration
- [x] TTL-expired claims appear in orphan results even if the session is technically still active
- [x] TypeScript compiles without errors
