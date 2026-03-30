# Task Description — TASK_2026_173

## User Request
Add an authentication guard to all NestJS HTTP endpoints in `apps/dashboard-api` so the dashboard API is not left unauthenticated outside local development.

## Task Type
BUGFIX - security hardening for unauthenticated HTTP routes

## Scope
- Add a reusable HTTP auth guard for the dashboard API
- Register the guard globally so existing REST controllers are protected without per-route duplication
- Accept credentials from either `Authorization` or `x-api-key`
- Allow auth enforcement to be toggled with environment configuration
- Exclude health endpoints from auth so health probes still work
- Add tests that cover enabled, disabled, valid, invalid, and exempt-route behavior

## Out of Scope
- User accounts, sessions, JWT issuance, or RBAC
- Frontend login flows or dashboard UI auth
- WebSocket auth changes already covered by `TASK_2026_131`
- Rate limiting, audit logging, or secret rotation workflows

## Dependencies
- `TASK_2026_131` - completed; provides related WebSocket auth behavior to align with

## Requirements Clarified
- Local development should remain usable by default with auth disabled
- Production should fail closed when auth is enabled but no API key is configured
- Both `/health` and the existing versioned health route must remain publicly reachable
- Swagger should remain accessible only when the global guard explicitly exempts docs routes or when auth is disabled; implementation should choose one approach deliberately rather than leaving it accidental

## Risk Level
HIGH - the API currently exposes task, session, analytics, and supervisor operations without any HTTP authentication

## Estimated Effort
3-5 hours (Medium complexity)
