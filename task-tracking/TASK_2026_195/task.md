# Task: Auto-Close Dead Sessions — TTL-Based Expiry

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P2-Medium   |
| Complexity            | Simple      |
| Preferred Tier        | light       |
| Model                 | default     |
| Testing               | optional    |

## Description

7 out of 9 DB sessions show `loop_status: "running"` with `ended_at: null`, but only 1 is actually active. Dead sessions never get cleaned up because:
- The supervisor process exits without calling `end_session`
- No TTL or heartbeat mechanism exists

Fix:
1. Add a `last_heartbeat` column to the sessions table
2. Supervisor writes a heartbeat on each poll cycle (update `last_heartbeat` timestamp)
3. Add a `close_stale_sessions` MCP tool that marks sessions as `stopped` if `last_heartbeat` is older than a configurable TTL (default: 30 minutes)
4. Call `close_stale_sessions` during supervisor startup (before orphan release)

## Dependencies

- None

## Acceptance Criteria

- [ ] Sessions table has `last_heartbeat` column
- [ ] Supervisor updates heartbeat each poll cycle
- [ ] `close_stale_sessions` marks old sessions as stopped
- [ ] Stale sessions cleaned up on new session startup

## Parallelism

✅ Can run in parallel — DB schema + supervisor heartbeat logic.

## References

- list_sessions showing 7 ghost "running" sessions
- Cortex MCP: `packages/mcp-cortex/src/`

## File Scope

- packages/mcp-cortex/src/db/schema.ts (add column)
- packages/mcp-cortex/src/tools/sessions.ts (heartbeat + close_stale)
- .claude/skills/auto-pilot/SKILL.md (heartbeat in poll loop)
