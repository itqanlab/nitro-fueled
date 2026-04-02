# Security Review — TASK_2026_195

| # | File | Line(s) | Finding | Severity |
|---|------|---------|---------|----------|
| 1 | `packages/mcp-cortex/src/tools/sessions.ts` | 193–207 | **TOCTOU race condition in `handleCloseStaleSessions`**: SELECT identifies stale sessions, then UPDATE closes them in a loop. The UPDATE WHERE clause (`WHERE id = ?`) does not re-check the stale condition (`last_heartbeat IS NULL OR last_heartbeat < cutoff`) or that `loop_status = 'running'`. If a heartbeat arrives between SELECT and UPDATE, the session is still closed. If `end_session()` already ran, the UPDATE overwrites `ended_at` and `summary` with stale-cleanup values, corrupting session metadata. Fix: add the full stale predicate to the UPDATE WHERE clause and check `info.changes` to count only actually-closed sessions. | warn |
| 2 | `packages/mcp-cortex/src/tools/sessions.ts` | 186–216 | **No authorization on `close_stale_sessions`** — any MCP client can close any running session. No caller identity check or session ownership validation. Mitigated by architecture: nitro-cortex runs as a local stdio process, so only the local supervisor has access. | info |
| 3 | `packages/mcp-cortex/src/tools/sessions.ts` | 190 | **TTL validation only at MCP registration layer** — `handleCloseStaleSessions` trusts `ttl_minutes` without handler-level bounds checking (e.g., negative, non-integer). The Zod schema in `index.ts:248` enforces `int().min(1).max(1440)`, but if the handler were called directly (e.g., from tests or future internal code paths), invalid values would produce a future cutoff that closes all running sessions. | info |
| 4 | `packages/mcp-cortex/src/tools/sessions.ts` | 173 | **Heartbeat timestamp is server-generated** — uses `new Date().toISOString()` at the handler level, not from caller input. Spoofing the timestamp value is not possible. Good. | info |
| 5 | `packages/mcp-cortex/src/tools/sessions.ts` | 165–184 | **`update_heartbeat` uses parameterized queries** throughout (`?` placeholders). No SQL injection risk. | info |
| 6 | `packages/mcp-cortex/src/tools/sessions.ts` | 193–194 | **`close_stale_sessions` uses parameterized queries**. No SQL injection risk. | info |
| 7 | `packages/mcp-cortex/src/db/schema.ts` | 242 | **Schema migration is static DDL** — `ALTER TABLE sessions ADD COLUMN last_heartbeat TEXT`. No user-controlled string interpolation. | info |
| 8 | `.claude/commands/nitro-auto-pilot.md` | 172 | **Stale cleanup ordering is correct** — `close_stale_sessions()` is called before `create_session()` in Step 4a.6a, preventing the new session from being immediately closed. | info |
| 9 | `packages/mcp-cortex/src/index.ts` | 248 | **Zod validation on TTL is well-bounded** — `z.number().int().min(1).max(1440)` prevents negative, zero, fractional, and >24h values. | info |

## Summary

The implementation uses parameterized queries throughout (no SQL injection risk) and server-side timestamp generation (no heartbeat spoofing). The schema migration is safe static DDL. The only substantive finding is a TOCTOU race condition in `handleCloseStaleSessions` where the SELECT-then-UPDATE loop lacks a re-check predicate, which could corrupt session metadata under concurrent access (e.g., overwriting a legitimately-ended session's summary). The authorization model is adequate for a local-only MCP server. TTL input is well-validated at the registration layer.

| Verdict | PASS |
|---------|------|
