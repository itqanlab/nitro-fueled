# Prep Handoff — TASK_2026_173

## Implementation Plan Summary
Implement a small shared `HttpAuthGuard` under `apps/dashboard-api/src/app/auth/` and register it globally through `APP_GUARD` in `AppModule` so all HTTP controllers are protected by default. The guard should be disabled unless `AUTH_ENABLED=true`, accept bearer or raw API key credentials from `Authorization` or `x-api-key`, fail closed when enabled without configured keys, and explicitly exempt health routes while handling Swagger access intentionally.

## Files to Touch
| File | Action | Why |
|------|--------|-----|
| `apps/dashboard-api/src/app/auth/http-auth.guard.ts` | new | Add the shared HTTP auth guard |
| `apps/dashboard-api/src/app/auth/index.ts` | new | Export the auth guard cleanly for module wiring |
| `apps/dashboard-api/src/app/app.module.ts` | modify | Register the guard as global `APP_GUARD` |
| `apps/dashboard-api/src/main.ts` | modify | Adjust bootstrap only if docs-route behavior needs explicit handling |
| `apps/dashboard-api/test/app/http-auth.guard.spec.ts` | new | Cover guard enablement, credentials, and exemptions |

## Batches
- Batch 1: Build the shared HTTP auth guard and supporting auth exports — files: `apps/dashboard-api/src/app/auth/http-auth.guard.ts`, `apps/dashboard-api/src/app/auth/index.ts`
- Batch 2: Register the guard globally and finalize exempt-route behavior — files: `apps/dashboard-api/src/app/app.module.ts`, `apps/dashboard-api/src/main.ts`
- Batch 3: Add Jest verification for enabled/disabled and exempt-route behavior — files: `apps/dashboard-api/test/app/http-auth.guard.spec.ts`

## Key Decisions
- Use NestJS `APP_GUARD` instead of per-controller decorators so all current and future HTTP endpoints are protected by default.
- Keep HTTP auth env configuration separate from `WS_API_KEYS`; align extraction semantics with the WebSocket guard, but do not couple rollout toggles.
- Health endpoints must be exempted centrally in the guard, including both versioned and non-versioned health URLs.
- When `AUTH_ENABLED=true` and no keys are configured, the guard should deny protected routes rather than silently allowing access.

## Gotchas
- The API exposes both versioned and non-versioned controllers, so route coverage must be checked against more than `api/v1/*` paths.
- There are two existing health endpoints; exempting only one will break probes or acceptance criteria.
- `main.ts` already manages Swagger setup; if docs remain accessible, it must be because of explicit exemption logic, not a missing guard path.
- This task should not modify WebSocket auth from `TASK_2026_131`; keep HTTP and WS rollout concerns isolated.
