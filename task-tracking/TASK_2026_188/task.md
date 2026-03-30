# Task: Cortex MCP — Orphaned Claim Recovery & Multi-Session Health

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | BUGFIX                       |
| Priority              | P1-High                      |
| Complexity            | Medium                       |
| Preferred Tier        | balanced                     |
| Model                 | default                      |
| Testing               | required                     |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

The cortex MCP already has `claim_task`/`release_task` tools with atomic DB locking that prevent two concurrent auto-pilot sessions from picking the same task. However, if a session crashes or is killed mid-run, its `session_claimed` locks on tasks stay permanently — there is no TTL, no heartbeat, and no recovery mechanism. Tasks end up stuck as "claimed by a dead session" and won't be picked up by any future session.

**What to build:**

1. **`get_orphaned_claims` tool** — query tasks where `session_claimed` is set but the owning session is no longer active:
   - Get all tasks where `session_claimed IS NOT NULL` and `status IN ('CREATED', 'IN_PROGRESS')`
   - Cross-reference against active sessions from the sessions table
   - Return tasks whose `session_claimed` value does not match any active session ID
   - Response: `{ orphaned: Array<{ task_id, title, status, claimed_by, claimed_at, stale_for_ms }> }`

2. **`release_orphaned_claims` tool** — release all stale claims in one call:
   - Internally calls orphan detection logic
   - For each orphaned task: `session_claimed = NULL`, `claimed_at = NULL`, status reset to `CREATED`
   - Log a `CLAIM_RELEASED` event per task to the events table: `{ task_id, session_id: 'system', event: 'orphan_recovery', details: { was_claimed_by, stale_for_ms } }`
   - Return: `{ released: N, tasks: [...task_ids] }`

3. **Auto-recovery at session startup** — modify `create_session()` to automatically run orphan recovery before returning. Log results to the session's startup event stream. This ensures stale claims from any prior crash are cleaned up before the new session starts picking tasks. Make this behavior opt-out via a `skip_orphan_recovery: true` parameter for testing.

4. **Claim TTL support** — add optional `claim_timeout_ms` column to the tasks table (default: `null` = no timeout, opt-in). When set, `get_orphaned_claims` treats any claim held longer than `claim_timeout_ms` as orphaned regardless of session active status. Useful for tasks that should never be claimed longer than a known duration (e.g., 2 hours).

## Dependencies

- None

## Acceptance Criteria

- [ ] `get_orphaned_claims` returns tasks claimed by dead sessions
- [ ] `release_orphaned_claims` resets those tasks to CREATED and logs CLAIM_RELEASED events
- [ ] `create_session()` auto-runs orphan recovery on startup (can be skipped via parameter)
- [ ] `claim_timeout_ms` column added to tasks schema with migration
- [ ] TTL-expired claims appear in orphan results even if the session is technically still active
- [ ] TypeScript compiles without errors

## References

- `packages/mcp-cortex/src/tools/tasks.ts` — `claim_task` (lines 55-90), `release_task` (lines 82-92)
- `packages/mcp-cortex/src/db/schema.ts` — tasks schema, `session_claimed` column (line 56)
- `packages/mcp-cortex/src/index.ts` — tool registration (lines 63-75)
- `.claude/skills/auto-pilot/references/session-lifecycle.md` — Concurrent Session Guard context

## Parallelism

✅ Can run in parallel — no file scope conflicts with any currently CREATED task.

Suggested execution wave: Wave 1 (independent). Should be prioritized early since it unblocks reliable multi-session operation.

## File Scope

- packages/mcp-cortex/src/tools/tasks.ts
- packages/mcp-cortex/src/index.ts
- packages/mcp-cortex/src/db/schema.ts
