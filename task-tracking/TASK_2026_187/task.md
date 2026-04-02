# Task: Session History & Results Dashboard

## Metadata

| Field                 | Value                        |
|-----------------------|------------------------------|
| Type                  | FEATURE                      |
| Priority              | P1-High                      |
| Complexity            | Medium                       |
| Preferred Tier        | balanced                     |
| Model                 | default                      |
| Testing               | optional                     |
| Poll Interval         | default                      |
| Health Check Interval | default                      |
| Max Retries           | default                      |

## Description

Build a dedicated page in the dashboard for browsing all past (completed/ended) auto-pilot and orchestration sessions with organized results per session.

**Current gap:** TASK_2026_158 covers active/running sessions only. TASK_2026_169 covers raw event logs. Neither provides a structured "what happened in session X" results view. Users currently have no way to see the outcome of sessions that have already ended.

**What to build:**

1. **Sessions History List** — `/sessions` route listing all past sessions:
   - Session ID, source (auto-pilot vs single orchestration), start/end time, duration
   - Summary counts: tasks completed, failed, blocked, total tasks
   - Total cost, model(s) used
   - Status badge (completed normally / killed / crashed)
   - Click row to open session detail

2. **Session Detail Page** — `/sessions/:id`:
   - Header: session metadata (ID, source, duration, total cost, worker count)
   - **Task Results table** — all tasks processed in this session with outcome (COMPLETE / FAILED / BLOCKED), per-task cost, duration, model used, review score if available
   - **Timeline** — chronological list of key events (worker spawned, phase changes, completions, failures, retries) sourced from cortex events table
   - **Session Log** — full log.md content rendered, collapsible section
   - **Workers** — all workers spawned in this session with their status, provider, model, and token stats

3. **Backend endpoints** in dashboard-api:
   - `GET /api/sessions` — paginated list of all sessions with summary stats (sources: cortex `list_sessions`)
   - `GET /api/sessions/:id` — full session detail (tasks, events, workers, log) (sources: cortex `get_session`, `query_events`, `get_task_context`)
   - All real data from cortex SQLite, no mocks needed

4. **Navigation** — add Sessions link to the sidebar nav

## Dependencies

- TASK_2026_157 — reuse session viewer component patterns and WebSocket service

## Acceptance Criteria

- [ ] `/sessions` route renders a paginated list of all past sessions with summary stats
- [ ] Clicking a session opens `/sessions/:id` with task results table, timeline, log, and workers
- [ ] Session detail shows accurate task outcome per session (COMPLETE / FAILED / BLOCKED counts)
- [ ] Backend `GET /api/sessions` and `GET /api/sessions/:id` return real data from cortex
- [ ] Sessions link appears in the sidebar nav

## References

- `packages/mcp-cortex/src/index.ts` — `list_sessions`, `get_session`, `query_events` tools
- TASK_2026_157 — Live Session Chat UI (IMPLEMENTED) — component/service patterns to reuse
- TASK_2026_158 — Active Sessions panel (covers running sessions, this task covers past sessions)
- TASK_2026_169 — Logs Dashboard (covers raw event logs; this covers structured per-session results)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_158 — both modify `apps/dashboard-api/src/sessions/sessions.controller.ts` and `sessions.service.ts`.

Suggested execution wave: Wave 2, after TASK_2026_158 completes (or coordinate to split the controller by endpoint).

## File Scope

- apps/dashboard-api/src/dashboard/sessions-history.service.ts (new)
- apps/dashboard-api/src/dashboard/dashboard.controller.ts (modified)
- apps/dashboard-api/src/dashboard/dashboard.module.ts (modified)
- apps/dashboard/src/app/models/api.types.ts (modified)
- apps/dashboard/src/app/services/api.service.ts (modified)
- apps/dashboard/src/app/services/mock-data.constants.ts (modified)
- apps/dashboard/src/app/app.routes.ts (modified)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts (new)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.html (new)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.scss (new)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts (new)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html (new)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.scss (new)
