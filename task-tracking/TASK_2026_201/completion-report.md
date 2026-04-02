# Completion Report — TASK_2026_201

## Task
Provider Quota Panel — surface per-provider subscription usage in the dashboard.

## Review Outcome

Three parallel reviews were run (code style, code logic, security). All three initially returned FAIL/NEEDS_REVISION.

### Findings Addressed

| # | Reviewer | Severity | Finding | Fix Applied |
|---|----------|----------|---------|-------------|
| 1 | Style/Logic | Blocking | Missing `imports` array in standalone component — `DecimalPipe`/`DatePipe` not declared | Added `imports: [DecimalPipe, DatePipe]` to `@Component` |
| 2 | Style/Logic | Blocking | `Math.min()` called directly in Angular template — global `Math` not accessible | Replaced with `cardBarWidths` computed signal; template uses `cardBarWidths().get(card.provider) ?? 0` |
| 3 | Style | Blocking | `takeUntilDestroyed()` called inside `loadQuota()` which is invoked from `onRefresh()` (outside injection context) → NG0203 crash on Refresh | Replaced with explicit `Subscription` field (`loadSub`); `loadSub?.unsubscribe()` before each new load; `destroyRef` injected as class field |
| 4 | Security | Serious | Error messages from internal `reason` field exposed raw `Error.message` in API response | `unavailable()` now returns a static public reason (`"Provider API returned HTTP 4xx"` or `"Provider API unavailable"`); raw message only logged server-side |
| 5 | Logic | Medium | `card.remaining > 0` guard did not protect against `card.limit === 0` — division produces `Infinity` | Guard changed to `card.limit > 0 && card.remaining > 0` |
| 6 | Logic | Low | GLM `used = total - remaining` can produce negative value on plan upgrade | Changed to `Math.max(0, total - remaining)` |

### Accepted / Won't Fix

| # | Reviewer | Severity | Finding | Rationale |
|---|----------|----------|---------|-----------|
| 7 | Security | Medium | Financial endpoint accessible without auth in non-production | Existing architectural decision — `HttpAuthGuard` is opt-in by env config across all endpoints; changing auth model is out of scope for this task |
| 8 | Logic | Medium | Anthropic usage endpoint path may differ from actual Admin API | Risk acknowledged in handoff; endpoint will return `unavailable` gracefully if path is wrong; Admin API docs are not publicly confirmed — can be corrected when tested with a real key |
| 9 | Logic | Medium | Concurrent refresh race via multiple subscriptions | Fixed by explicit subscription tracking (finding #3 fix covers this) |
| 10 | Logic | Low | All-unavailable cache uses full 5-min TTL | Acceptable tradeoff; env vars are set at startup and rarely change |

## Status
All blocking and serious findings resolved. Task is COMPLETE.
