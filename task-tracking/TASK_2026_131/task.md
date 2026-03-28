# Task: Add Authentication Guard to NestJS WebSocket Gateway

## Metadata

| Field                 | Value        |
|-----------------------|--------------|
| Type                  | BUGFIX       |
| Priority              | P2-Medium    |
| Complexity            | Medium       |
| Preferred Tier        | balanced     |
| Model                 | default      |
| Testing               | required     |
| Poll Interval         | default      |
| Health Check Interval | default      |
| Max Retries           | default      |

## Description

The `DashboardGateway` (`apps/dashboard-api/src/dashboard/dashboard.gateway.ts`) accepts all WebSocket connections without any authentication check in `handleConnection`. Any client that knows the server address can connect and receive full session, cost, task, and analytics data. This was flagged as CRITICAL (OWASP A01 Broken Access Control) in TASK_2026_088 and as a MEDIUM finding in TASK_2026_092 — both deferred as out-of-scope pending an auth system. Now that the API contract layer is in place (TASK_2026_109), a minimal token-based guard must be added: validate a Bearer token or query-param API key on `handleConnection`, disconnect unauthorized clients immediately with `client.disconnect()`, and ensure the guard is wired via NestJS `@UseGuards()` or an explicit inline check so it cannot be bypassed.

## Dependencies

- TASK_2026_109 — API Contract Layer must be complete; DTO and ValidationPipe infrastructure needed

## Acceptance Criteria

- [ ] `handleConnection` validates a Bearer token or API key before emitting any data
- [ ] Unauthorized connections are immediately rejected with `client.disconnect()` and a log entry
- [ ] Authorized connections continue to receive all existing dashboard events unchanged
- [ ] NestJS guard approach used (`@UseGuards()` or `WsAuthGuard`) — not ad-hoc inline code
- [ ] Integration test confirms unauthenticated socket connection is refused
- [ ] Integration test confirms authenticated socket connection receives `connected` event

## References

- `apps/dashboard-api/src/dashboard/dashboard.gateway.ts` — target file
- TASK_2026_088 review-security.md — original CRITICAL finding (OWASP A01)
- TASK_2026_092 review-security.md — second instance flagged
- TASK_2026_109 — API contract layer, ValidationPipe, DTO infrastructure
- `backend.md` review lesson: "`@WebSocketGateway()` `handleConnection` must validate authentication before emitting any data"

## File Scope

- `apps/dashboard-api/src/dashboard/dashboard.gateway.ts`
- `apps/dashboard-api/src/auth/ws-auth.guard.ts` (new)
- `apps/dashboard-api/src/auth/auth.module.ts` (new or update)
- `apps/dashboard-api/src/app/app.module.ts`

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_120, TASK_2026_121, TASK_2026_122 (nitro-cortex tasks touch dashboard-api module structure).
Suggested execution wave: Wave after TASK_2026_109 COMPLETE (already done) and nitro-cortex series clears.
