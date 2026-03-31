# Task: Graceful Session Termination

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

Allow users to gracefully terminate a running auto-pilot session from the dashboard. The session must drain cleanly — active workers are allowed to finish their current task, but no new workers are spawned after the drain is requested.

**Behavior spec:**

- **Running** → user clicks "End Session" → **Draining**
- **Draining** → all active workers finish → **Stopped** (loop_status = 'stopped', not 'failed')
- If the session is already idle (no active workers) when drain is requested, transition to Stopped immediately
- "End Session" button is only visible when `loop_status = 'running'` — hidden in all other states
- While draining: show "Stopping after current workers finish..." with a spinner and count of remaining active workers
- A drained session is distinct from a failed/killed session in the UI (neutral/amber, not red)

**Backend changes:**

1. Add `drain_requested` boolean column (default `false`) to the `sessions` table in cortex DB — add as a migration, not a schema rebuild
2. New `PATCH /api/sessions/:id/stop` endpoint in `dashboard-api` — sets `drain_requested = true`, returns updated session
3. Supervisor loop modification: at the top of the "spawn next worker" decision, check `drain_requested` on the current session; if `true`, skip spawning and wait for active workers to finish, then call `end_session` with `loop_status = 'stopped'`
4. `GET /api/sessions` and `GET /api/sessions/:id` responses must include `drain_requested` field

**Frontend changes:**

1. "End Session" button added to the session detail header — visible only when `loop_status === 'running'`
2. Clicking shows a confirmation dialog: "End this session? Active workers will finish their current task before stopping."
3. On confirm: call `PATCH /api/sessions/:id/stop`, optimistically update UI to show draining state
4. Draining state: button replaced with "Stopping..." badge + active worker count countdown
5. `loop_status === 'stopped'` renders as a distinct ended state (not error) — amber/neutral color, "Session ended by user" label

## Dependencies

- None

## Acceptance Criteria

- [ ] `sessions` table has `drain_requested` column (migration, not destructive rebuild)
- [ ] `PATCH /api/sessions/:id/stop` sets `drain_requested = true` and returns 200 with updated session
- [ ] Supervisor loop checks `drain_requested` before spawning new workers; skips spawn if true
- [ ] When drain is requested and no active workers remain, supervisor sets `loop_status = 'stopped'`
- [ ] "End Session" button visible only when `loop_status === 'running'`
- [ ] Confirmation dialog shown before drain is triggered
- [ ] UI shows "Stopping..." draining state with active worker count while drain is in progress
- [ ] `loop_status === 'stopped'` renders in amber/neutral (not red error color) with "Session ended by user" label
- [ ] Sessions that finish naturally (queue empty) remain unaffected by this feature

## References

- `packages/mcp-cortex/src/index.ts` — `end_session`, `update_session` tools; sessions table schema
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` — supervisor loop spawn logic
- `apps/dashboard/src/app/views/sessions/` — session detail view (or project view session panel)
- TASK_2026_200 — Session Run Config Panel (touches auto-pilot.service.ts and api.service.ts; coordinate file scope)
- TASK_2026_201 — Provider Quota Panel (touches api.service.ts and api.types.ts; coordinate file scope)

## Parallelism

🚫 **Do NOT run in parallel with TASK_2026_200** — both modify `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` and `apps/dashboard/src/app/services/api.service.ts`.

🚫 **Do NOT run in parallel with TASK_2026_201** — both modify `apps/dashboard/src/app/services/api.service.ts` and `apps/dashboard/src/app/models/api.types.ts`.

✅ Safe to run in parallel with TASK_2026_199 (analytics module — no file overlap).

Suggested execution wave: Wave 3, after TASK_2026_200 and TASK_2026_201 complete. Alternatively Wave 1 if neither of those is running concurrently.

## File Scope

- packages/mcp-cortex/src/db/schema.ts (modified — add drain_requested to SESSION_MIGRATIONS)
- apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts (modified — add setDrainRequested/getDrainRequested)
- apps/dashboard-api/src/auto-pilot/session-runner.ts (modified — drain guard in tick(), populate drainRequested in getStatus())
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (modified — add drainRequested to SessionStatusResponse)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (modified — add drainSession() method)
- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (modified — add 'draining' to SessionActionResponse.action)
- apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts (modified — add PATCH :id/stop endpoint)
- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (modified — add drainSession())
- apps/dashboard-api/src/dashboard/cortex.types.ts (modified — add drain_requested to CortexSession and RawSession)
- apps/dashboard-api/src/dashboard/cortex-queries-task.ts (modified — add drain_requested to SESSION_COLS, mapSession)
- apps/dashboard-api/src/dashboard/sessions-history.service.ts (modified — add 'stopped' to SessionEndStatus, update deriveEndStatus)
- apps/dashboard/src/app/models/api.types.ts (modified — add 'stopped' to SessionEndStatus, drainRequested to SessionHistoryDetail, CortexSession)
- apps/dashboard/src/app/services/api.service.ts (modified — add drainSession() PATCH method)
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.ts (modified — drain signals, drain methods, statusColor 'stopped')
- apps/dashboard/src/app/views/sessions/session-detail/session-detail.component.html (modified — End Session button, confirmation dialog, draining badge)
- apps/dashboard/src/app/views/sessions/sessions-list/sessions-list.component.ts (modified — add 'stopped' → gold in statusColor)
