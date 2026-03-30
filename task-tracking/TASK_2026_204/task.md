# Task: Refactor Supervisor to Multi-Session Architecture

## Metadata

| Field                 | Value          |
|-----------------------|----------------|
| Type                  | REFACTORING    |
| Priority              | P0-Critical    |
| Complexity            | Medium         |
| Preferred Tier        | heavy          |
| Model                 | default        |
| Testing               | optional       |
| Poll Interval         | default        |
| Health Check Interval | default        |
| Max Retries           | 2              |

## Description

Refactor the persistent SupervisorService from a singleton (one session at a time) to a multi-session architecture where each session is an independent `SessionRunner` with its own loop, config, and workers.

**Root cause**: The current `SupervisorService` holds a single `state` object — only one session can run at a time. For a web-app-driven product, users need to:
- Create multiple concurrent sessions with different configs
- Change model/provider/concurrency per session mid-flight
- Manage all sessions from the dashboard independently

**Architecture change:**

```
Current (singleton):
  SupervisorService
    └── state: SupervisorState (one session)
    └── loopTimer: single interval

Target (multi-session):
  SessionManagerService (singleton NestJS service)
    └── runners: Map<sessionId, SessionRunner>

  SessionRunner (plain class, one per session)
    ├── config: mutable (model, provider, concurrency, priority)
    ├── loopTimer: own setInterval
    ├── state: own retry/stuck counters
    └── workers: scoped to this session
```

**Key behaviors:**

1. `SessionManagerService` is the NestJS singleton — manages the Map of runners
2. `SessionRunner` is a plain class (not injectable) — instantiated per session
3. Config is mutable per session: `runner.updateConfig({ build_model: 'claude-opus-4-6' })` takes effect on next tick
4. Each runner reads `this.config` on every tick, so config changes are immediate
5. Sessions are isolated — runner A's retry counters don't affect runner B

**Files to modify/create:**

- `session-runner.ts` (NEW) — extract the tick/loop/spawn/health logic from `supervisor.service.ts` into a self-contained class
- `session-manager.service.ts` (NEW) — the NestJS singleton that manages `Map<sessionId, SessionRunner>`
- `supervisor.service.ts` → DELETE (replaced by session-manager + session-runner)
- `auto-pilot.types.ts` — add `SessionRunnerState`, update `SupervisorConfig` with mutable fields
- `auto-pilot.service.ts` — update facade to delegate to `SessionManagerService`
- `auto-pilot.controller.ts` — update endpoints: `PATCH /sessions/:id/config`, multi-session `GET /sessions`
- `auto-pilot.model.ts` — update DTOs for multi-session API

**REST API after refactor:**

```
POST   /api/sessions              → Create & start session (with config)
GET    /api/sessions              → List all active sessions
GET    /api/sessions/:id          → Session detail + workers
PATCH  /api/sessions/:id/config   → Update config (model, provider, concurrency)
POST   /api/sessions/:id/pause    → Pause session loop
POST   /api/sessions/:id/resume   → Resume session loop
POST   /api/sessions/:id/stop     → Stop session gracefully
```

## Dependencies

- None

## Acceptance Criteria

- [ ] Multiple sessions can run concurrently, each with independent loops and workers
- [ ] Each session's config (model, provider, concurrency, priority) can be changed via PATCH and takes effect on next tick
- [ ] Stopping one session does not affect other running sessions
- [ ] `GET /api/sessions` returns all active sessions with live status
- [ ] TypeScript compiles clean with no regressions

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_200 (Session Run Configuration Panel) — both modify `auto-pilot.model.ts` and `auto-pilot.service.ts`
🚫 Do NOT run in parallel with TASK_2026_202 (Graceful Session Termination) — both modify `auto-pilot.service.ts`

Suggested execution: Run TASK_2026_204 FIRST, then TASK_2026_200 and TASK_2026_202 can build on the new session-centric API.

## References

- Current supervisor implementation: `apps/dashboard-api/src/auto-pilot/supervisor.service.ts`
- Worker manager: `apps/dashboard-api/src/auto-pilot/worker-manager.service.ts`
- Supervisor DB: `apps/dashboard-api/src/auto-pilot/supervisor-db.service.ts`

## File Scope

- apps/dashboard-api/src/auto-pilot/session-runner.ts (new)
- apps/dashboard-api/src/auto-pilot/session-manager.service.ts (new)
- apps/dashboard-api/src/auto-pilot/supervisor.service.ts (deleted — replaced)
- apps/dashboard-api/src/auto-pilot/auto-pilot.types.ts (modified)
- apps/dashboard-api/src/auto-pilot/auto-pilot.service.ts (modified)
- apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts (modified)
- apps/dashboard-api/src/auto-pilot/auto-pilot.model.ts (modified)
