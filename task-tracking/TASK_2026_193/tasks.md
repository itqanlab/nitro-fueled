# Development Tasks - TASK_2026_193

## Batch 1: Orphan Release Integration - COMPLETE

**Developer**: nitro-backend-developer

### Task 1.1: Verify release_orphaned_claims MCP tool exists

**File**: packages/mcp-cortex/src/index.ts (line 134), packages/mcp-cortex/src/tools/tasks.ts
**Status**: COMPLETE

The `release_orphaned_claims` MCP tool was implemented in TASK_2026_188 (commit 1433a67). It:
- Detects tasks claimed by dead sessions (session not in 'running' state)
- Detects tasks with expired TTL (claim_timeout_ms exceeded)
- Releases claims atomically (session_claimed = NULL, claimed_at = NULL, status = 'CREATED')
- Logs each release to the DB events table with event_type='orphan_recovery'

### Task 1.2: Add orphan release step to supervisor startup sequence in SKILL.md

**File**: .claude/skills/auto-pilot/SKILL.md (lines 239-242)
**Status**: COMPLETE

Added the orphan release note after the reconcile_status_files paragraph:
- Documents that `release_orphaned_claims()` should be called after `reconcile_status_files()` completes
- Describes the purpose: eliminate manual release-reclaim cycle
- Marked as best-effort

### Task 1.3: Add orphan release step to session-lifecycle.md

**File**: .claude/skills/auto-pilot/references/session-lifecycle.md (lines 61-66)
**Status**: COMPLETE

Updated the startup sequence documentation:
- Added step 3: `release_orphaned_claims()` to the ordered startup call list
- Updated "Both calls" to "All three calls" in the best-effort note
