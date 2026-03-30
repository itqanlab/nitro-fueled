# Implementation Plan — TASK_2026_173

## Overview

Add a global HTTP authentication layer to `apps/dashboard-api` that is disabled by default for local development, enabled explicitly through environment configuration, and applied to all REST controllers through NestJS `APP_GUARD`. The implementation should mirror the simplicity of the existing WebSocket auth work without copying its stricter startup behavior.

## Architecture

### 1. Shared HTTP Auth Guard

**Target directory**: `apps/dashboard-api/src/app/auth/`

Create a small auth guard module centered on an `HttpAuthGuard` class.

**Responsibilities**:
- Inspect incoming HTTP requests via `context.switchToHttp().getRequest()`
- Short-circuit to `true` when auth is disabled
- Skip auth for health routes
- Extract credential from `Authorization` header or `x-api-key`
- Support both `Bearer <token>` and raw token values
- Compare against configured API key set from environment
- Return `false` or throw `UnauthorizedException` for missing/invalid credentials when auth is enabled

**Why this shape**:
- Keeps all auth behavior in one place
- Makes future shared auth helpers reusable for both HTTP and WebSocket if desired later
- Avoids per-controller duplication and future route drift

### 2. Global Registration With `APP_GUARD`

**Target file**: `apps/dashboard-api/src/app/app.module.ts`

Register the guard with the Nest global guard token:

- Add `HttpAuthGuard` as a provider
- Add `{ provide: APP_GUARD, useClass: HttpAuthGuard }`

**Why**:
- Protects all current HTTP controllers automatically
- Protects future controllers by default
- Centralizes the exempt-route logic in one guard instead of spreading decorators across modules

### 3. Environment Contract

**Primary behavior**:
- `AUTH_ENABLED=false` or unset: allow all requests
- `AUTH_ENABLED=true`: require a configured API key list and validate every non-exempt request

**Guard semantics**:
- Parse enabled state defensively so only explicit truthy configuration enables auth
- Parse a comma-separated key list into a trimmed `Set<string>`
- If auth is enabled and the key list is empty, fail closed for protected routes instead of silently allowing traffic

**Why**:
- Matches the task requirement for disabled-by-default local development
- Keeps production secure even if config is incomplete

### 4. Route Exemption Policy

Exempt the health endpoints at the guard layer:
- `/health`
- `/api/health` if present in deployment routing
- `/api/v1/health`

Also evaluate the Swagger route behavior:
- If docs must remain usable in protected environments, exempt `/api/docs` and related assets explicitly
- If docs should be protected, keep them behind the guard and note this in manual verification

**Chosen planning direction**:
- Health endpoints are mandatory exemptions
- Swagger handling must be implemented intentionally, not left to incidental path mismatches

### 5. Testing Strategy

Add Jest coverage under `apps/dashboard-api/test/` for the guard behavior.

Recommended test scope:
- auth disabled -> protected route allowed without headers
- auth enabled + valid `x-api-key` -> allowed
- auth enabled + valid `Authorization: Bearer ...` -> allowed
- auth enabled + invalid token -> rejected
- auth enabled + missing token -> rejected
- auth enabled + no configured keys -> rejected
- health route -> allowed even when auth enabled

Prefer focused unit tests around the guard over full e2e bootstrapping unless existing test helpers make app-level testing cheap.

## Files Expected To Change

| File | Action | Notes |
|------|--------|-------|
| `apps/dashboard-api/src/app/auth/http-auth.guard.ts` | new | Main global HTTP auth guard |
| `apps/dashboard-api/src/app/auth/index.ts` | new | Barrel export if useful for module wiring |
| `apps/dashboard-api/src/app/app.module.ts` | modify | Register `APP_GUARD` and guard provider |
| `apps/dashboard-api/src/main.ts` | maybe modify | Only if Swagger route handling or bootstrap notes require it |
| `apps/dashboard-api/test/app/http-auth.guard.spec.ts` or similar | new | Guard tests |

## Implementation Order

1. Create the guard and environment parsing behavior
2. Register the guard globally in `AppModule`
3. Finalize explicit route exemptions for health and docs
4. Add Jest coverage for enabled/disabled and exempt-route cases
5. Run build and targeted tests, then perform a quick manual route check

## Risks And Mitigations

### Risk: Guard unintentionally blocks health probes
- Mitigation: implement path-based exemption first and test both health URLs explicitly

### Risk: Guard does not cover non-versioned controllers
- Mitigation: use `APP_GUARD`, not per-controller decorators

### Risk: Swagger becomes unusable unexpectedly
- Mitigation: decide and document docs-route behavior during implementation, then validate manually

### Risk: HTTP and WebSocket auth drift
- Mitigation: align token extraction semantics with `WsAuthGuard`, but keep environment toggles separated

## Anti-Patterns To Avoid

- Do not duplicate auth checks across controllers
- Do not hardcode environment-dependent logic into controller methods
- Do not fail open when auth is enabled but keys are missing
- Do not exempt routes with broad substring matching that could accidentally expose unrelated endpoints
