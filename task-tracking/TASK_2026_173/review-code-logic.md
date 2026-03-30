# Code Logic Review — TASK_2026_173

## Review Summary

| Metric | Value |
| --- | --- |
| Files Reviewed | 4 |
| Findings | 1 |
| Verdict | FAIL |

---

## Findings

### 1. Serious: Global HTTP guard will also run for non-HTTP execution contexts

- **Files**: `apps/dashboard-api/src/app/app.module.ts:12-16`, `apps/dashboard-api/src/app/auth/http-auth.guard.ts:49-66`
- **Why this fails**: The task introduces the guard as a global `APP_GUARD`, but `canActivate()` unconditionally assumes an HTTP request exists and immediately reads `request.url`, `request.method`, and `request.headers`. In NestJS, global guards also execute for other context types such as WebSocket gateways. In those contexts, `context.switchToHttp().getRequest()` is not a normal HTTP request object, so this code can throw at runtime instead of cleanly skipping non-HTTP traffic.
- **Impact**: This breaks the stated rollout boundary between `HTTP_API_KEYS` and `WS_API_KEYS`. Enabling HTTP auth can unintentionally crash or block non-HTTP endpoints rather than leaving them to their own auth path.
- **Evidence**: `AppModule` registers `HttpAuthGuard` globally via `APP_GUARD`, and `HttpAuthGuard.canActivate()` does not check `context.getType()` before dereferencing the HTTP request.
- **Recommendation**: Gate the logic with `context.getType() === 'http'` (or otherwise handle non-HTTP contexts explicitly) before accessing the request, and add a test that exercises a non-HTTP execution context.

---

## Notes

- No explicit stubs, TODOs, or placeholder implementations were found in the scoped files.
- Review was limited to the files declared in `task-tracking/TASK_2026_173/handoff.md`.
