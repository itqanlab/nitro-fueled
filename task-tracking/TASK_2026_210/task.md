# Task: Migrate Dashboard Frontend to Session-Centric API

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | FEATURE        |
| Priority              | P0-Critical    |
| Complexity            | Medium         |
| Preferred Tier        | balanced       |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | 2              |

## Description

Migrate the Angular dashboard frontend from the old `/api/auto-pilot/*` singleton endpoints to the new `/api/sessions/*` multi-session resource API introduced in TASK_2026_204.

**What changed in the backend (TASK_2026_204):**
- `POST /api/auto-pilot/start` → `POST /api/sessions` (create session with full config)
- `POST /api/auto-pilot/stop` → `POST /api/sessions/:id/stop`
- `GET /api/auto-pilot/status/:id` → `GET /api/sessions/:id`
- NEW: `GET /api/sessions` (list all active sessions)
- NEW: `PATCH /api/sessions/:id/config` (update config mid-flight)
- NEW: `POST /api/sessions/:id/pause` and `POST /api/sessions/:id/resume`

**Frontend changes needed:**

1. **api.service.ts** — Replace `startAutoPilot()`, `stopAutoPilot()`, `getAutoPilotStatus()` with:
   - `createSession(config)` → `POST /api/sessions`
   - `listSessions()` → `GET /api/sessions`
   - `getSession(id)` → `GET /api/sessions/:id`
   - `stopSession(id)` → `POST /api/sessions/:id/stop`
   - `pauseSession(id)` → `POST /api/sessions/:id/pause`
   - `resumeSession(id)` → `POST /api/sessions/:id/resume`
   - `updateSessionConfig(id, config)` → `PATCH /api/sessions/:id/config`

2. **api.types.ts** — Replace old `StartAutoPilotRequest/Response`, `StopAutoPilotRequest/Response`, `AutoPilotStatusResponse` with types matching new backend DTOs: `CreateSessionRequest`, `CreateSessionResponse`, `SessionStatusResponse`, `SessionActionResponse`, `UpdateSessionConfigRequest`, `ListSessionsResponse`

3. **project.component.ts/html** — Update the "Start Auto-Pilot" flow:
   - Session creation form with config fields (concurrency, provider, model, priority, retries)
   - Show multiple active sessions (not just one)
   - Per-session status display
   - Persist last-used config to localStorage

4. **sessions-panel component** — Add per-session controls:
   - Pause/Resume button per session
   - Stop button per session
   - Config edit (opens inline or modal with PATCH support)
   - Session status badge (running/paused/stopped)

**Note:** TASK_2026_200 (Session Run Configuration Panel) was created before this refactor and references old API types. This task supersedes the backend portion of TASK_2026_200. The frontend config panel described there should be built here against the new API.

## Dependencies

- TASK_2026_204 — backend multi-session API (IMPLEMENTED)

## Acceptance Criteria

- [ ] All old `/api/auto-pilot/*` calls replaced with `/api/sessions/*` calls
- [ ] Users can create sessions with config (concurrency, model, provider, priority)
- [ ] Session list shows all active sessions with live status
- [ ] Per-session controls: pause, resume, stop work correctly
- [ ] Config can be updated mid-flight via PATCH
- [ ] TypeScript compiles clean, no broken imports

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_200 (Session Run Config Panel) — this task supersedes 200's backend scope and shares file scope
🚫 Do NOT run in parallel with TASK_2026_201 (Provider Quota Panel) — both modify api.service.ts and api.types.ts
🚫 Do NOT run in parallel with TASK_2026_202 (Graceful Session Termination) — both modify api.service.ts and api.types.ts

Suggested execution: Run TASK_2026_210 FIRST, then 200 (frontend-only remnants), 201, 202 can build on the new types.

## References

- Backend implementation: apps/dashboard-api/src/auto-pilot/ (TASK_2026_204)
- Current frontend API: apps/dashboard/src/app/services/api.service.ts
- Current types: apps/dashboard/src/app/models/api.types.ts
- Project component: apps/dashboard/src/app/views/project/
- Sessions panel: apps/dashboard/src/app/views/project/sessions-panel/

## File Scope

- apps/dashboard/src/app/services/api.service.ts (modified)
- apps/dashboard/src/app/models/api.types.ts (modified)
- apps/dashboard/src/app/views/project/project.component.ts (modified)
- apps/dashboard/src/app/views/project/project.component.html (modified)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts (modified)
- apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.html (modified)
