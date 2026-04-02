# Handoff — TASK_2026_193

## Files Changed
- .claude/skills/auto-pilot/references/session-lifecycle.md (modified, +3 lines)
- .claude/skills/auto-pilot/SKILL.md (modified, +4 lines)

## Commits
- 7798ca1: fix(settings): remove unused NgClass import, add setTimeout cleanup in mapping component (contains orphan release step additions to SKILL.md and session-lifecycle.md)
- 1433a67: feat(cortex): implement orphaned claim recovery and claim TTL support - TASK_2026_188 (contains the release_orphaned_claims MCP tool)

## Decisions
- Added orphan release as an explicit step 3 in the supervisor startup sequence, after reconcile_status_files()
- The existing `release_orphaned_claims` MCP tool already correctly implements the logic:
  - Detects tasks claimed by dead sessions (session not in 'running' state)
  - Detects tasks with expired TTL (claim_timeout_ms exceeded)
  - Releases claims atomically (session_claimed = NULL, claimed_at = NULL, status = 'CREATED')
  - Logs each release to the DB events table with event_type='orphan_recovery'
- No code changes were needed to the tool implementation itself - only the skill specification

## Known Risks
- The orphan release step is marked as "best-effort" - if it fails, only a warning is logged and startup continues. This means orphaned claims may persist if the tool fails.
- The tool uses `claim_timeout_ms` column from the tasks table, which may be NULL. Tasks with NULL timeout are only released if their session is dead, never due to TTL expiration.
- The implementation resets released tasks to status 'CREATED', not their pre-claim status. This is consistent with the task description which says "return to their pre-claim status", but for CREATED/IN_PROGRESS tasks, 'CREATED' is the correct pre-claim state.