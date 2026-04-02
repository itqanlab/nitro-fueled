# Handoff — TASK_2026_195

## Implementation Summary

Added TTL-based heartbeat mechanism to automatically clean up dead supervisor sessions that never call `end_session`.

## Changes Made

### 1. Schema Migration
- **File**: `packages/mcp-cortex/src/db/schema.ts`
- Added `last_heartbeat` column to `SESSION_MIGRATIONS` array
- Column stores ISO 8601 timestamp, nullable (new sessions start with NULL)

### 2. MCP Tools
- **File**: `packages/mcp-cortex/src/tools/sessions.ts`
- Added `handleUpdateHeartbeat()`: Updates `last_heartbeat` to current ISO timestamp
- Added `handleCloseStaleSessions()`: Marks running sessions with `last_heartbeat` older than TTL as `stopped`
  - Default TTL: 30 minutes
  - Query: `loop_status = 'running' AND (last_heartbeat IS NULL OR last_heartbeat < cutoff)`
  - Sets `ended_at`, `summary = 'stale: no heartbeat'`

- **File**: `packages/mcp-cortex/src/index.ts`
- Registered `update_heartbeat` tool
- Registered `close_stale_sessions` tool

### 3. Supervisor Integration
- **File**: `.claude/commands/nitro-auto-pilot.md`
- Added Step 4a.6a: Call `close_stale_sessions()` before `create_session()`

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md`
- Updated Step 6: Added `update_heartbeat(session_id)` call after sleep

- **File**: `apps/cli/scaffold/.claude/commands/nitro-auto-pilot.md`
- Same changes as above (scaffold sync)

- **File**: `apps/cli/scaffold/.claude/skills/auto-pilot/references/parallel-mode.md`
- Same changes as above (scaffold sync)

### 4. Tests
- **File**: `packages/mcp-cortex/src/tools/sessions.spec.ts`
- Added `handleUpdateHeartbeat` test suite (3 tests)
- Added `handleCloseStaleSessions` test suite (4 tests)
- All 32 session tests passing ✓

## Acceptance Criteria Met

- ✅ Sessions table has `last_heartbeat` column
- ✅ Supervisor updates heartbeat each poll cycle (Step 6 in parallel-mode.md)
- ✅ `close_stale_sessions` marks old sessions as stopped (configurable TTL, default 30m)
- ✅ Stale sessions cleaned up on new session startup (Step 4a.6a in auto-pilot)

## Testing

- All 32 session tests pass
- Build completes successfully
- Manual verification:
  - Sessions created via `create_session` get `last_heartbeat = NULL`
  - `update_heartbeat` sets timestamp to current ISO time
  - `close_stale_sessions` with TTL=0 closes sessions with no heartbeat or older timestamp
  - Active sessions (recent heartbeat) are not closed

## Known Limitations

- Default TTL of 30 minutes may need adjustment for long-running single-task sessions
- Consider making TTL configurable via CLI flag for different workloads
