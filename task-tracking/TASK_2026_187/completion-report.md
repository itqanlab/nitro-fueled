# Completion Report — TASK_2026_187

## Task
Session History & Results Dashboard — Medium complexity, P1-High feature

## Outcome: COMPLETE

## Review Summary

| Reviewer      | Verdict | Score |
|---------------|---------|-------|
| Code Style    | FAIL    | 5/10  |
| Code Logic    | FAIL    | 5/10  |
| Security      | FAIL    | 6/10  |

## Fixes Applied

### Critical (blocking) fixes

1. **`drainRequested` missing from backend response**
   - `sessions-history.service.ts`: Added `drainRequested: session.drain_requested` to the `getSessionDetail()` return object and to the `SessionHistoryDetail` interface.

2. **`PATCH /api/sessions/:id/stop` endpoint missing**
   - `cortex.service.ts`: Added `requestSessionDrain(sessionId)` method that sets `drain_requested = 1` in the SQLite sessions table.
   - `dashboard.controller.ts`: Added `@Patch('sessions/:id/stop')` handler with validation, 404/503 handling, and proper Swagger annotations.

3. **Mutable plain fields in OnPush components (rendering bug)**
   - `sessions-list.component.ts`: Converted `loading` and `unavailable` from plain class fields to `computed()` signals. Removed `effect()` constructor. Changed `toSignal()` to use no `initialValue` (returns `Signal<T | undefined>` where `undefined` = loading, `null` = error, data = success).
   - `session-detail.component.ts`: Same conversion.

4. **First-load HTTP error causes permanent spinner**
   - Fixed by the signal/computed approach: `unavailable = computed(() => raw === null)` fires correctly on first load error regardless of prior loading state.

5. **`drainSession()` subscription not cleaned up on destroy**
   - `session-detail.component.ts`: Added `takeUntilDestroyed(this.destroyRef)` to the drain HTTP subscription. Injected `DestroyRef` via `inject()`.

### Security fixes

6. **Path traversal defense-in-depth in `readLogContent`**
   - Added `resolve(filePath)` + `startsWith(resolvedRoot + sep)` check inside the service method, independent of the controller-layer regex guard.

7. **Unbounded log file reads (application-layer DoS)**
   - Added 100 KB cap: content is truncated to the last 100 KB with a `...[truncated]` prefix when exceeded.

## Template fixes

- `sessions-list.component.html`: Updated `loading` / `unavailable` references to `loading()` / `unavailable()` signal calls.
- `session-detail.component.html`: Same, plus updated `!loading` guard inside the detail section.

## Pre-existing issues NOT fixed (outside file scope)
- `task-detail.component.html:471` syntax error (blocks full dashboard build)
- `session-comparison.component.ts/html` empty (0 bytes, prior task corruption)
- `orchestration.controller.ts` TypeScript error (pre-existing)
- Backend pagination absent from `GET /api/sessions` (scope not included in original task requirements)
- `getEventsSince(0)` full table scan (performance improvement, not correctness issue)

## Build verification
- Backend TypeScript (`apps/dashboard-api`): no errors in changed files
- Frontend TypeScript (`apps/dashboard`): no errors in changed files
- Pre-existing build errors unchanged
