# Security Review — TASK_2026_203

## Review Summary

| Metric           | Value                                |
|------------------|--------------------------------------|
| Overall Score    | 8/10                                 |
| Assessment       | APPROVED                             |
| Critical Issues  | 0                                    |
| Serious Issues   | 1                                    |
| Minor Issues     | 3                                    |
| Files Reviewed   | 6                                    |

## OWASP Checklist Results

| Category                 | Status | Notes |
|--------------------------|--------|-------|
| Input Validation         | FAIL   | TTL query parameter has no minimum floor — values like `0.001` pass the guard and would close healthy sessions immediately |
| Path Traversal           | PASS   | No user-controlled paths; DB path is always `cwd()/.nitro/cortex.db` — fixed at construction time |
| Secret Exposure          | PASS   | No credentials, tokens, or secrets in any in-scope file |
| Injection (shell/prompt) | PASS   | All SQL uses parameterized placeholders; no shell execution; no prompt injection vectors |
| Insecure Defaults        | PASS   | TTL defaults to 30 minutes; cap at 1440 is enforced; interval uses `takeUntilDestroyed` |

## Critical Issues

No critical issues found.

## Serious Issues

### Issue 1: TTL Parameter Has No Minimum Floor — Sub-Minute Values Close Healthy Sessions

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:249`
- **Problem**: The guard `Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? Math.min(ttlMinutes, 1440) : 30` accepts any positive finite number, including fractional minutes. A caller supplying `?ttl=0.001` produces a cutoff time of 60 milliseconds ago, which will match all sessions whose `last_heartbeat` was more than 60ms before the call. Any running session — including one that just updated its heartbeat moments ago — would be marked `stopped: stale: no heartbeat`.
- **Impact**: A single crafted POST request (or a misconfigured client) can close all currently running sessions. Because the dashboard background interval hard-codes `30`, this is not reachable from the normal UI flow, but it is reachable from any tool, script, or test that hits the endpoint directly. On a shared machine, this is a local denial-of-service against the orchestration pipeline.
- **Fix**: Add a minimum floor to the guard:
  ```typescript
  const safeTtl = Number.isFinite(ttlMinutes) && ttlMinutes >= 1 ? Math.min(ttlMinutes, 1440) : 30;
  ```
  A TTL of less than 1 minute has no legitimate use case given that heartbeats fire every 30 seconds.

## Minor Issues

### Minor Issue 1: Read-Write DB Open Path Is Not Isolated From the Read-Only `openDb()` Factory

- **File**: `apps/dashboard-api/src/dashboard/cortex.service.ts:219`
- **Problem**: All other methods call `this.openDb()`, which enforces `{ readonly: true, fileMustExist: true }`. The `closeStaleSession` method bypasses this factory and calls `new Database(this.dbPath, { fileMustExist: true })` inline, without `readonly: true`. This creates two divergent open patterns in the same service. A future refactor that merges the open call or copies the pattern may inadvertently open the DB for writing in a read-only context.
- **Impact**: Architectural fragility. Not currently exploitable, but raises the probability of an accidental write-mode regression in a read path.
- **Fix**: Extract a private `openDbWritable(): Database.Database | null` method mirroring `openDb()` but without `readonly`. This makes the intent explicit and keeps both patterns visible as named methods rather than one being an inline open call.

### Minor Issue 2: No Rate Limiting on the `POST /api/sessions/close-stale` Endpoint

- **File**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts:243-255`
- **Problem**: The endpoint performs a full-table scan on the `sessions` table plus N individual `UPDATE` statements (one per stale session). There is no rate limit, debounce, or minimum call interval enforced at the API layer. Any client that can reach the API can POST to this endpoint in a tight loop.
- **Impact**: On a machine with many historical sessions, a tight loop of close-stale calls would serialize on the SQLite write lock and contend with the MCP cortex server's own writes (heartbeat updates, worker spawns). This would degrade orchestration performance. The attack surface is localhost-only, limiting the realistic risk to local automation bugs or runaway scripts.
- **Fix**: For a localhost dev tool, a simple in-memory debounce (e.g., "do not execute if last call was within 30 seconds") at the service layer is sufficient. A NestJS `ThrottlerGuard` is also acceptable.

### Minor Issue 3: `new Date(hb).getTime()` on Unvalidated `last_heartbeat` String Produces Silent `NaN` Label

- **File**: `apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts:81`
- **Problem**: `const ageMs = nowMs - new Date(hb).getTime()` — if `hb` is not a valid ISO 8601 timestamp, `new Date(hb).getTime()` returns `NaN`. The subsequent `Math.floor(NaN / 60_000)` yields `NaN`, and all `if/else` comparisons against `NaN` evaluate to `false`, so the code falls through to the final `else` branch and renders `"NaN m ago"` in the heartbeat label.
- **Impact**: Cosmetic rendering defect, not a security vulnerability. However, it means a corrupted `last_heartbeat` value in the DB (e.g., a partial write) silently surfaces as a broken UI label rather than a handled error.
- **Fix**: Guard the computation: `if (!hb || isNaN(new Date(hb).getTime()))` → treat as missing heartbeat and apply the `'No heartbeat'` path.

## Verdict

**Recommendation**: APPROVE
**Confidence**: HIGH
**Top Risk**: TTL minimum floor — a `?ttl=0.001` call closes all active sessions. Add `>= 1` to the guard before the endpoint goes into any non-local use.
