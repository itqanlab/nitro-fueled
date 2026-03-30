# Task: Wire Heartbeat Lifecycle

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | BUGFIX                       |
| Priority              | P1-High                      |
| Complexity            | Simple                       |
| Preferred Tier        | light                        |
| Model                 | default                      |
| Testing               | optional                     |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

The heartbeat infrastructure is fully built (`update_heartbeat` and `close_stale_sessions` MCP tools, `last_heartbeat` column on `sessions` table) but nothing calls it. This means supervisor crashes leave ghost sessions marked `running` forever, and there is no way to detect when a supervisor died or how long ago.

This task wires all four call sites:

**1. Supervisor loop — call `update_heartbeat` every poll cycle**

In `.claude/skills/auto-pilot/SKILL.md`, add a step to the monitoring loop: after each `sleep` + worker check cycle, call `update_heartbeat(session_id)`. This is a single MCP call that takes <1ms and costs nothing. Without it, `last_heartbeat` stays `NULL` and stale session detection never fires.

**2. Auto-pilot startup — call `close_stale_sessions(ttl_minutes=5)` before creating a new session**

In `.claude/skills/auto-pilot/SKILL.md`, add a pre-flight step: before calling `create_session`, call `close_stale_sessions({ ttl_minutes: 5 })`. This flushes any zombie sessions from previous crashed runs before the new session begins, preventing the dashboard from showing multiple ghost "running" sessions.

**3. Dashboard sessions list — show staleness indicator**

In the sessions list component, display a "last seen Xm ago" label next to each running session using the `last_heartbeat` field. Apply an amber warning style when `last_heartbeat` is older than 2 minutes (session may be stuck) and a red stale style when older than 10 minutes (session almost certainly dead). Sessions with `last_heartbeat = null` and `loop_status = running` should show "No heartbeat" in red.

**4. Dashboard auto-refresh — call `close_stale_sessions` every 5 minutes**

Add a background interval in the sessions view that calls `POST /api/sessions/close-stale` (or equivalent) every 5 minutes while the page is open. This ensures ghost sessions are cleaned up automatically during normal dashboard usage without requiring a page reload.

The backend needs a `POST /api/sessions/close-stale` endpoint in `dashboard-api` that proxies to the cortex `close_stale_sessions` tool with a configurable TTL (default 30 minutes; startup uses 5 minutes).

## Dependencies

- None

## Acceptance Criteria

- [ ] Supervisor loop calls `update_heartbeat` on every poll cycle (every 30s); `last_heartbeat` is no longer `NULL` for active sessions
- [ ] Auto-pilot startup calls `close_stale_sessions(ttl=5)` before creating a new session; previously crashed sessions are marked `stopped` before the new one begins
- [ ] Sessions list shows "last seen Xm ago" for running sessions using `last_heartbeat`
- [ ] Sessions with stale heartbeat (>2min) show amber warning; sessions with no heartbeat or >10min show red stale indicator
- [ ] Dashboard calls `close_stale_sessions` every 5 minutes in the background while sessions view is open
- [ ] `POST /api/sessions/close-stale` endpoint exists and proxies to cortex `close_stale_sessions`
- [ ] A session that crashes (no heartbeat for 30min) is automatically marked `stopped: stale: no heartbeat` by the next close-stale call

## References

- `packages/mcp-cortex/src/tools/sessions.ts:165` — `handleUpdateHeartbeat` implementation
- `packages/mcp-cortex/src/tools/sessions.ts:186` — `handleCloseStaleSessions` implementation (TTL default 30min)
- `packages/mcp-cortex/src/index.ts:238` — both tools registered as `update_heartbeat` and `close_stale_sessions`
- `.claude/skills/auto-pilot/SKILL.md` — supervisor loop instructions (call sites 1 and 2)
- TASK_2026_195 — Ghost session detection (companion task; this task provides the data that 195 uses)
- TASK_2026_202 — Graceful Session Termination (also touches sessions view and api.service.ts)

## Parallelism

🚫 **Do NOT run in parallel with TASK_2026_202** — both modify the sessions view component and `api.service.ts`.

🚫 **Do NOT run in parallel with TASK_2026_200 or TASK_2026_201** — all three touch `api.service.ts` and `api.types.ts`.

✅ Safe to run in parallel with TASK_2026_199 (analytics module — no file overlap).

Suggested execution wave: Wave 4, after TASK_2026_200, TASK_2026_201, and TASK_2026_202 complete. Alternatively Wave 1 if none of those are running concurrently (the SKILL.md changes are fully independent).

## File Scope

- .claude/skills/auto-pilot/SKILL.md (modified — add update_heartbeat + close_stale_sessions call sites)
- apps/dashboard-api/src/sessions/sessions.controller.ts (modified — add POST /close-stale endpoint)
- apps/dashboard/src/app/views/sessions/session-list.component.ts (modified — staleness indicator logic)
- apps/dashboard/src/app/views/sessions/session-list.component.html (modified — staleness UI)
- apps/dashboard/src/app/services/api.service.ts (modified — add closeStale() method)
