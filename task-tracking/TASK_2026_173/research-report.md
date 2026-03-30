# Research Report — TASK_2026_173

## Goal
Anchor the HTTP auth plan to the current `dashboard-api` codebase and the already-shipped WebSocket auth work.

## Current Codebase Findings

### Existing HTTP Surface
- `apps/dashboard-api/src/dashboard/dashboard.controller.ts` exposes the bulk of versioned read and mutation endpoints under `@Controller({ path: 'api', version: '1' })`
- `apps/dashboard-api/src/dashboard/logs.controller.ts` exposes versioned log endpoints under the same `api/v1` surface
- `apps/dashboard-api/src/auto-pilot/auto-pilot.controller.ts` exposes non-versioned session control routes under `api/sessions`
- `apps/dashboard-api/src/tasks/tasks.controller.ts` exposes non-versioned task creation under `api/tasks`
- `apps/dashboard-api/src/app/health.controller.ts` exposes a versioned `GET /health`
- `apps/dashboard-api/src/dashboard/dashboard.controller.ts` also exposes `GET /api/v1/health`

### Existing Auth Pattern
- `apps/dashboard-api/src/dashboard/auth/ws-auth.guard.ts` already implements a simple environment-driven token check for WebSocket traffic
- The WebSocket guard accepts bearer or plain token input and validates against a configured token set
- The WebSocket implementation currently throws on startup when keys are missing, which is acceptable there but too rigid for HTTP because this task requires disabled-by-default local dev

### Module Wiring
- `apps/dashboard-api/src/app/app.module.ts` currently imports `DashboardModule`, `TasksModule`, and `AutoPilotModule`, with no auth provider registered
- `apps/dashboard-api/src/main.ts` already centralizes global Nest setup, but `APP_GUARD` registration belongs in module providers rather than bootstrap logic

### Test Baseline
- `apps/dashboard-api` already has Jest configured and includes a WebSocket auth spec: `test/dashboard/dashboard.gateway.spec.ts`
- There is no existing HTTP auth test coverage, so this task should add focused guard tests rather than depend only on manual validation

## Implementation Implications
- A shared HTTP auth module under `apps/dashboard-api/src/app/auth/` is the cleanest location because it can protect all modules without coupling to dashboard-specific code
- `APP_GUARD` is preferred over per-controller decoration because the acceptance criteria require protecting all existing controllers and future controllers by default
- Route exemption should be implemented centrally from the request path so health checks are safe even on non-versioned and versioned URLs
- The guard should read a dedicated HTTP key env var rather than reusing `WS_API_KEYS`; this avoids accidentally coupling rollout and operational semantics between HTTP and WebSocket auth

## Decisions Recommended From Research
- Use `AUTH_ENABLED` with default false semantics in the guard, not in controller code
- Use a dedicated HTTP key variable such as `API_KEYS` or `HTTP_API_KEYS`; keep the exact name stable once selected in implementation
- Treat missing configured keys as deny-all only when auth is enabled
- Exempt `/health`, `/api/health`, and `/api/v1/health` explicitly; decide whether Swagger docs should also be exempted or intentionally protected and document that choice
