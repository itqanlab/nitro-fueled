# Handoff — TASK_2026_254

## Files Changed
- packages/mcp-cortex/src/tools/sessions.ts (modified, +40 -6)

## Commits
- (see implementation commit)

## Decisions
- Added `autoCloseStaleSessions` as a private function (not exported) — this is startup internal behavior, not a public MCP tool
- Uses `loop_status='completed'` (not 'stopped') per acceptance criteria — distinguishes auto-closed from manually stopped sessions
- 10-minute TTL constant `STARTUP_STALE_TTL_MINUTES = 10` at module level for easy configuration
- Active worker check per-session (SELECT COUNT per session.id) — avoids closing sessions that still have real work
- Auto-close runs BEFORE the INSERT for the new session — clean slate before new session starts
- Errors in auto-close are swallowed (best-effort) — never block session creation
- `auto_closed_sessions` only appears in response when > 0 (matches pattern of `orphan_recovery` field)

## Known Risks
- None — additive behavior, no existing query paths changed
