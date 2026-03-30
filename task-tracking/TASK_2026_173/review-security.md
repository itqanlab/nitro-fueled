# Security Review — TASK_2026_173

## Summary

| Metric | Value |
|---|---|
| Verdict | FAIL |
| Scope | `apps/dashboard-api/src/app/auth/http-auth.guard.ts`, `apps/dashboard-api/src/app/auth/index.ts`, `apps/dashboard-api/src/app/app.module.ts`, `apps/dashboard-api/test/app/http-auth.guard.spec.ts` |
| Findings | 1 |

## Findings

### FINDING-001: HIGH — Global HTTP auth guard fails open by default

- **File**: `apps/dashboard-api/src/app/auth/http-auth.guard.ts:24-26,49-52`
- **Related File**: `apps/dashboard-api/src/app/app.module.ts:12-17`
- **Issue**: The guard is registered globally via `APP_GUARD`, but it unconditionally allows every request unless `AUTH_ENABLED === 'true'`. That makes authentication opt-in rather than secure-by-default. Any deployment that ships this change without also setting `AUTH_ENABLED=true` leaves all HTTP endpoints unauthenticated, even if operators expect the new global guard to protect them.
- **Impact**: Full unauthorized access to the dashboard API when the environment flag is omitted or misconfigured.
- **Remediation**: Invert the default so HTTP auth is enabled unless explicitly disabled for local development, or fail startup when protected deployments do not provide an explicit auth configuration. At minimum, treat presence of `HTTP_API_KEYS` as enabling auth and log a startup error when the guard is globally installed but disabled.

## Files Reviewed

| File | Verdict | Notes |
|---|---|---|
| `apps/dashboard-api/src/app/auth/http-auth.guard.ts` | FAIL | Insecure default: `AUTH_ENABLED` must be explicitly set to `true` before any request is authenticated. |
| `apps/dashboard-api/src/app/auth/index.ts` | PASS | Re-export only. |
| `apps/dashboard-api/src/app/app.module.ts` | PASS | Correctly installs the guard globally; no additional issue beyond the guard's fail-open default. |
| `apps/dashboard-api/test/app/http-auth.guard.spec.ts` | PASS | Tests confirm the insecure default behavior and other guard paths; no direct vulnerability in the test file itself. |

## Verdict

`FAIL` — the task introduces a global authentication guard with an insecure default that leaves the API fully open unless operators remember to opt in via environment configuration.
