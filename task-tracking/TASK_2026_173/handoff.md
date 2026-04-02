# Handoff — TASK_2026_173

## Files Changed
- apps/dashboard-api/src/app/auth/http-auth.guard.ts (new, 104 lines)
- apps/dashboard-api/src/app/auth/index.ts (new, 1 line)
- apps/dashboard-api/src/app/app.module.ts (modified, +7 -1)
- apps/dashboard-api/test/app/http-auth.guard.spec.ts (new, 138 lines)

## Commits
- (pending): feat(auth): add HTTP auth guard for all NestJS endpoints

## Decisions
- Used `HTTP_API_KEYS` env var (comma-separated) separate from `WS_API_KEYS` — keeps HTTP and WS rollout concerns isolated per prep handoff guidance.
- Guard is disabled by default (`AUTH_ENABLED` defaults to false). When enabled without keys, it fails closed — all protected routes return 401.
- Exempt routes are matched by URL prefix in the guard itself (not via `@Public()` decorator) to keep the implementation simple and avoid requiring controller changes.
- Swagger docs routes (`/api/docs`, `/api/docs-json`, `/api/docs-yaml`) are exempted so API documentation remains accessible.
- `main.ts` required no changes — the guard handles exemption internally and all existing routes are covered.

## Known Risks
- The exempt-route list is hardcoded in the guard. If new public endpoints are added, they must be added to `EXEMPT_PATH_PREFIXES`.
- No rate limiting on auth failures — an attacker could brute-force keys if the API is exposed beyond localhost.
- The guard uses synchronous key matching. For large key sets, a more efficient lookup structure may be needed.
