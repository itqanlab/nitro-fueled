# Task: Auto-Pilot Trigger — Backend Endpoint + Frontend Action

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P1-High        |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | default        |

## Description

Part 2 of 4 — original request: Web-based Auto-Pilot Control Center.

Build the backend endpoint and frontend wiring that allows users to fire an auto-pilot session from the web UI. The dashboard-api receives the request and spawns a session via the session-orchestrator MCP server.

**What to build:**

1. **Dashboard-API endpoint** — `POST /api/auto-pilot/start` in NestJS:
   - Accepts optional body: `{ taskIds?: string[], options?: { dryRun?: boolean } }`
   - Calls session-orchestrator MCP `spawn_worker` to start a Claude Code session with the auto-pilot command
   - Returns `{ sessionId: string, status: 'starting' }`
   - For now: mock the MCP call, return a fake session ID

2. **Dashboard-API endpoint** — `POST /api/auto-pilot/stop` to stop a running session:
   - Accepts `{ sessionId: string }`
   - Calls session-orchestrator MCP `kill_worker`
   - For now: mock response

3. **Frontend service method** — Add `startAutoPilot()` and `stopAutoPilot()` to API service.

4. **Wire the button** — Connect the "Start Auto-Pilot" button from the project page (TASK_2026_155) to the service method. Show a loading state while starting, then transition to "running" state.

5. **Status polling** — After starting, poll `GET /api/auto-pilot/status/:sessionId` for session state updates. Mock endpoint returns status transitions: starting → running → (stays running).

All mock responses for now. No real MCP calls or CLI spawning.

## Dependencies

- TASK_2026_155 — Project Page (provides the button to wire)

## Acceptance Criteria

- [ ] `POST /api/auto-pilot/start` endpoint exists and returns mock session ID
- [ ] `POST /api/auto-pilot/stop` endpoint exists and returns mock success
- [ ] `GET /api/auto-pilot/status/:sessionId` returns mock session status
- [ ] Frontend API service has `startAutoPilot()` and `stopAutoPilot()` methods
- [ ] "Start Auto-Pilot" button triggers the start flow with loading state
- [ ] After start, UI transitions to show running state

## References

- Dashboard API: `apps/dashboard-api/src/`
- Existing controllers: `apps/dashboard-api/src/dashboard/dashboard.controller.ts`
- API service: `apps/dashboard/src/app/services/api.service.ts`
- Session-orchestrator MCP: `docs/mcp-session-orchestrator-design.md`

## File Scope

- `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` (new)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts` (new)
- `apps/dashboard-api/src/auto-pilot/auto-pilot.module.ts` (new)
- `apps/dashboard-api/src/app/app.module.ts` (modified — import module)
- `apps/dashboard/src/app/services/api.service.ts` (modified — add methods)
- `apps/dashboard/src/app/views/project/project.component.ts` (modified — wire button)

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_155 — modifies `project.component.ts`. Run in Wave 2 after TASK_2026_155.
