# Task: Add Authentication Guard to All NestJS HTTP Endpoints

## Metadata

| Field                 | Value       |
|-----------------------|-------------|
| Type                  | BUGFIX      |
| Priority              | P1-High     |
| Complexity            | Medium      |
| Preferred Tier        | balanced    |
| Model                 | default     |
| Testing               | required    |

## Description

Add an authentication guard to all NestJS HTTP endpoints in the dashboard-api. Currently no authentication exists — flagged as "acceptable for dev-tool" in 7 task reviews (087, 088, 092, 109, 117, 118, 145) but accumulating as real tech debt. TASK_2026_131 covers the WebSocket gateway specifically; this task covers all REST/HTTP controllers.

Implement a simple API key or token-based guard that can be enabled/disabled via environment variable (default: disabled for local dev, required for production). Apply it globally via `APP_GUARD` or per-controller.

## Dependencies

- TASK_2026_131 — WebSocket gateway auth guard (parallel concern, shared auth module)

## Acceptance Criteria

- [ ] NestJS `AuthGuard` implemented and registered as global guard
- [ ] Guard checks for API key in `Authorization` header or `x-api-key` header
- [ ] Guard can be disabled via `AUTH_ENABLED=false` env var (default: false for dev)
- [ ] All existing controllers protected when guard is enabled
- [ ] Health check endpoint (`/health`) excluded from auth

## References

- Retrospective: `task-tracking/retrospectives/RETRO_2026-03-30.md` — Acknowledged-but-Unfixed
- TASK_2026_131 — WebSocket gateway auth (related)
- Security review lesson: `.claude/review-lessons/security.md` — CORS/WebSocket section

## File Scope

- apps/dashboard-api/src/app/auth/ (new guard module)
- apps/dashboard-api/src/app/app.module.ts
- apps/dashboard-api/src/main.ts

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_131 (WS auth guard — shared auth module), TASK_2026_132 (DTO validation — same API layer)
Suggested wave: Wave 1, alongside or after TASK_2026_131
