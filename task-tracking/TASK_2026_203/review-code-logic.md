# Code Logic Review - TASK_2026_203

## Review Summary

| Metric              | Value                        |
| ------------------- | ---------------------------- |
| Overall Score       | 5/10                         |
| Assessment          | NEEDS_REVISION               |
| Critical Issues     | 3                            |
| Serious Issues      | 3                            |
| Moderate Issues     | 3                            |
| Failure Modes Found | 6                            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The most significant silent failure: **`lastHeartbeat` never reaches the component for real sessions**. The `getActiveSessionsEnhanced()` method in `SessionsService` builds its response from in-memory `SessionData` objects and does not include `lastHeartbeat` in its return type at all. The `ActiveSessionSummary` model has `lastHeartbeat?: string | null` (optional), but the server side never populates it. The entire heartbeat staleness UI (`heartbeatStatusMap` computed signal) will always fall through to "No heartbeat" or show nothing, silently showing every running session as red-stale regardless of actual heartbeat state.

A second silent failure: `closeStaleSession` in the service opens the DB without `readonly: true` (correct for writes) but has no transaction wrapper. If the process is killed mid-loop across multiple stale sessions, some sessions are marked stopped and some are not. The caller receives no indication of partial success — `{ closed_sessions: N }` where N reflects only completed updates.

### 2. What user action causes unexpected behavior?

A user who opens the sessions view immediately after it first mounts will see every running session with a red "No heartbeat" indicator even if the supervisor is alive and actively sending heartbeats — because `lastHeartbeat` is never included in the `getActiveSessionsEnhanced()` response. The red badge creates a false alarm that looks like the supervisor has crashed.

A user who navigates to the sessions view, leaves it, and navigates back gets a fresh component constructor, which registers a **new** `interval(5 * 60_000)` subscription. Because `takeUntilDestroyed` is correctly wired, the old one cleans up. This is fine — but the 5-minute timer resets on every navigation, meaning if the user browses around quickly, the `close-stale` call may never fire within a real session window.

### 3. What data makes this produce wrong results?

**`ageMs < 0` edge case is handled, but incorrectly placed.** In `heartbeatStatusMap`, the `ageMs < 0` branch maps to `cssClass: ''` (healthy). This happens when the server clock is ahead of the browser clock. However the label "just now" is also used for `ageMinutes < 1`, making it ambiguous. More importantly, `ageMs < 0` could also indicate a corrupt or future-dated `last_heartbeat` written by a misbehaving supervisor. Treating a future-dated heartbeat as healthy rather than flagging it is wrong.

**The amber threshold boundary is off-by-one in the spec.** The task says "amber when `>2min`". The implementation applies amber at `ageMinutes >= 2` (i.e., the condition `ageMinutes < 10` is entered when `ageMinutes >= 2`). `ageMinutes` is `Math.floor(ageMs / 60_000)`, so a session at exactly 2 minutes 0 seconds gets `ageMinutes = 2`, which falls into the amber band. The description says "older than 2 minutes", which means the implementation is technically correct (exactly 2 minutes is indeed older than 2 minutes). This is fine.

**`ttl` query param: `Number('0')` is `0`, which is falsy** but `Number.isFinite(0)` is true, so `0 > 0` is false and the fallback of `30` is used. That is the right safety behavior. However `Number('')` is `0` and `Number(null)` is `0`, so a caller passing `?ttl=` (empty string) would get the default 30 rather than an error. Acceptable but worth noting.

**The `sessions` table has no `updated_at` column referenced** in `SESSION_COLS` or `RawSession`. The `closeStaleSession` method writes `updated_at = ?`. If the column does not exist in the real schema, this is a silent SQL error caught by the catch block, returning `null`, which the controller converts to a 503. This cannot be confirmed without checking the schema migration but is a risk.

### 4. What happens when dependencies fail?

**Backend POST /api/sessions/close-stale fails:** The component uses `catchError(() => EMPTY)` inside the `switchMap`. This swallows the error completely with no user feedback and no log. The `subscribe()` has no next/error handler. On 503 (DB unavailable), 500 (SQL error), or a network timeout, the user sees nothing and the dashboard continues displaying stale ghost sessions indefinitely. This violates the anti-pattern: "NEVER swallow errors in fire-and-forget calls. At minimum, log them."

**Dashboard API loses connection to the SQLite file (file moved/unmounted):** The `openDb()` path checks `existsSync` but there is a TOCTOU race between the check and the `new Database()` call. The `closeStaleSession` method in `CortexService` has its own `existsSync` guard separately from `openDb()` (it does not call `openDb()`). This is deliberate and handles the case, but the pattern is inconsistent — if the DB disappears between the `existsSync` check and `new Database()`, the catch block handles it and returns `null`. Acceptable.

**`getActiveSessionsEnhanced()` returns an empty array:** The component falls back to `loadMockData()`. Mock sessions do not have `lastHeartbeat`. The `heartbeatStatusMap` computed will emit `{ label: 'No heartbeat', cssClass: 'heartbeat-stale' }` for the mock running sessions. The dashboard in development will always show red heartbeat badges on mock data. This is misleading and could cause developers to report false bugs.

### 5. What's missing that the requirements didn't mention?

**AC-1 (supervisor loop calls `update_heartbeat`) is not implemented at all.** The task description explicitly calls for adding `update_heartbeat` to the auto-pilot `SKILL.md` monitoring loop. The `session-lifecycle.md` reference file was updated with the `close_stale_sessions` zombie flush step (Step 3a in Startup Sequence) and the zombie flush log entry. But **no call to `update_heartbeat` appears anywhere in `SKILL.md` or any other auto-pilot skill file.** Grepping for `update_heartbeat` in `.claude/skills/auto-pilot/` returns only a single hit in `parallel-mode.md` (which was pre-existing). The main call site 1 (heartbeat every poll cycle) was not wired.

**`ActiveSessionSummary.lastHeartbeat` is marked optional (`?`) rather than required.** Because the field is optional, TypeScript does not enforce that the server always includes it. The server currently never includes it. Making it optional creates a permanent out for whoever fills in the server side, but also means the component must defensively handle `undefined` forever.

**No loading state while `close-stale` runs.** The background cleanup fires silently. If it takes 2-3 seconds (unlikely but possible on slow I/O), there is no user indication.

**The `summary` column referenced in `closeStaleSession` SQL may not exist.** The task spec and the MCP tool (`handleCloseStaleSessions` in `sessions.ts`) write to `summary`. The `RawSession` interface does not include a `summary` column. The dashboard-api `CortexService.closeStaleSession` mirrors this. If the column is missing in the DB schema file, both the MCP tool and the dashboard-api endpoint silently fail and return `null` / `{ ok: true, closed_sessions: 0 }` — which would be an invisible non-operation.

---

## Failure Mode Analysis

### Failure Mode 1: Heartbeat field never flows to the UI

- **Trigger**: `SessionsService.getActiveSessionsEnhanced()` builds its response without `lastHeartbeat`. The return type of that method does not include the field. The `ActiveSessionSummary` model has it as optional, but the server response never populates it.
- **Symptoms**: All running sessions show "No heartbeat" in red permanently. Developers see a broken dashboard that makes every live session look like a ghost.
- **Impact**: The primary deliverable of this task (staleness indicator) is non-functional for real sessions. It works only with manually crafted data that includes `lastHeartbeat`.
- **Current Handling**: The component treats `undefined`/`null` heartbeat as "No heartbeat" stale — so it degrades gracefully from a crash standpoint, but silently shows wrong data.
- **Recommendation**: `getActiveSessionsEnhanced()` must be rewritten or supplemented to pull `last_heartbeat` from the cortex DB (via `CortexService.getSessions()`), or the `close-stale` / sessions endpoints must be refactored so the enhanced endpoint reads from cortex directly. At minimum, `lastHeartbeat` must be in the return type and populated.

### Failure Mode 2: `update_heartbeat` never called — AC-1 not implemented

- **Trigger**: The supervisor auto-pilot loop has no instruction to call `update_heartbeat(session_id)`. Only the zombie-flush pre-flight step was added to `session-lifecycle.md`.
- **Symptoms**: `last_heartbeat` remains `NULL` for all active sessions. The staleness indicator can never show "just now" or "Xm ago" — it can only show "No heartbeat" (red) for every session.
- **Impact**: The entire heartbeat data pipeline has no producer. The dashboard UI correctly renders what the DB says, but the DB column is never written.
- **Current Handling**: None.
- **Recommendation**: Add `update_heartbeat(session_id)` to the SKILL.md monitoring loop (Step 7 poll cycle), marked as best-effort (failure → log warning, continue).

### Failure Mode 3: `closeStaleSession` has no transaction — partial updates

- **Trigger**: Multiple stale sessions to close; process killed or DB locked partway through the loop.
- **Symptoms**: Some sessions are marked `stopped`, some remain `running`. Dashboard shows a mix of ghost and properly-closed sessions.
- **Impact**: Ghost sessions persist until the next `close-stale` call runs (5 minutes later if the dashboard is open), but the partial update is silently treated as full success.
- **Current Handling**: No transaction. Each `updateStmt.run()` is a separate write. Error in mid-loop is caught by the outer try/catch but `closedCount` reflects partial updates.
- **Recommendation**: Wrap the loop in a `db.transaction()` so all-or-nothing semantics apply. The MCP tool `handleCloseStaleSessions` has the same issue — both should be fixed together.

### Failure Mode 4: Background `close-stale` errors swallowed with no log

- **Trigger**: Dashboard API is down, DB is locked, or endpoint returns 503.
- **Symptoms**: No error in console, no user notification, ghost sessions stay. Developer/operator has no signal that cleanup is failing.
- **Current Handling**: `catchError(() => EMPTY)` — complete silence.
- **Recommendation**: At minimum `catchError((err) => { console.warn('close-stale failed', err); return EMPTY; })` to comply with the anti-pattern rule. Optionally update a signal to surface a UI warning if it fails repeatedly.

### Failure Mode 5: `ageMs < 0` (future-dated heartbeat) treated as healthy

- **Trigger**: System clock skew between supervisor machine and dashboard machine; or a buggy supervisor writes a future-dated ISO string.
- **Symptoms**: A session whose heartbeat is 10 minutes in the future shows "just now" (healthy), masking a potentially crashed or misconfigured supervisor.
- **Current Handling**: `ageMs < 0` → `cssClass: ''` (green/neutral). No staleness indication.
- **Recommendation**: Add a sanity cap: if `ageMs < -60_000` (more than 1 minute in the future), flag as a clock skew warning rather than treating it as healthy.

### Failure Mode 6: Mock data sessions display false red heartbeat badges

- **Trigger**: Dashboard API unreachable at startup → `loadMockData()` called. Mock sessions have `status: 'running'` but no `lastHeartbeat`.
- **Symptoms**: Every mock "running" session shows a red "No heartbeat" badge in development. Developers see alarming UI that looks like a production bug rather than mock data.
- **Impact**: Developer confusion; potential for false bug reports.
- **Current Handling**: Mock sessions simply omit `lastHeartbeat`, so the computed maps them to `heartbeat-stale`.
- **Recommendation**: Add `lastHeartbeat: new Date(Date.now() - 30_000).toISOString()` to mock running sessions so the development fallback shows realistic healthy state. Or add a `isMockData` guard.

---

## Critical Issues

### Issue 1: AC-1 not implemented — `update_heartbeat` never called in supervisor loop

- **File**: `.claude/skills/auto-pilot/SKILL.md` (and `session-lifecycle.md`)
- **Scenario**: Any time a supervisor runs. Without this call, `last_heartbeat` stays NULL forever in the DB.
- **Impact**: The entire staleness detection system is broken at the source. Every session looks like a ghost because the producer was never wired. The dashboard shows every running session as "No heartbeat" (red), which is a permanent false alarm.
- **Evidence**: `grep -r "update_heartbeat" .claude/skills/auto-pilot/` returns zero results in SKILL.md. The `session-lifecycle.md` zombie-flush step was added but the poll-cycle heartbeat call was not.
- **Fix**: Add to SKILL.md monitoring loop (immediately after the sleep and worker status checks): call `update_heartbeat({ session_id: SESSION_ID })` — best-effort, log warning on failure, do not abort the loop.

### Issue 2: `lastHeartbeat` never included in `getActiveSessionsEnhanced()` response

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/sessions.service.ts` (lines 137–168)
- **Scenario**: Any user opening the sessions panel.
- **Impact**: The heartbeat staleness UI renders correctly in structure, but always shows "No heartbeat" (red stale) for all running sessions because the field is always `undefined`. The feature appears visually complete but is semantically broken.
- **Evidence**: The return type of `getActiveSessionsEnhanced()` does not include `lastHeartbeat`. The mapping at line 151–167 does not include the field. `ActiveSessionSummary.lastHeartbeat` is `?` (optional) so TypeScript does not catch the omission.
- **Fix**: Either (a) cross-join with `CortexService.getSessions()` to pull `last_heartbeat` from the DB and include it in the mapped response, or (b) create a new endpoint that reads cortex sessions directly (already available at `GET /api/cortex/sessions`) and wire the component to that.

### Issue 3: `closeStaleSession` writes to `summary` column — potential schema mismatch

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/cortex.service.ts` (lines 228–232)
- **Scenario**: Any call to `POST /api/sessions/close-stale`.
- **Impact**: If the `sessions` table schema does not have a `summary` column (it is not in `RawSession` or `SESSION_COLS`), the UPDATE statement throws `SQLITE_ERROR: table sessions has no column named summary`. This is caught by the try/catch, returning `null`, causing the controller to throw a 503. The cleanup silently never happens and the caller sees "Cortex DB unavailable" even though the DB is fine.
- **Evidence**: `SESSION_COLS` in `cortex-queries-task.ts` (line 24) does not include `summary`. `RawSession` does not include `summary`. The MCP tool `handleCloseStaleSessions` (which was presumably tested against the real schema) also writes to `summary` — if it works there, then the column must exist; but it is not reflected in the TypeScript types.
- **Fix**: Add `summary` to `RawSession` and `SESSION_COLS` to confirm it is a known column. If it does not exist in the schema, remove the `summary =?` clause from the UPDATE or add a migration.

---

## Serious Issues

### Issue 4: Background cleanup errors silently swallowed

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts` (lines 60–63)
- **Scenario**: API down, DB locked, network error on the close-stale POST.
- **Impact**: Zero signal to operator that cleanup is failing. Ghost sessions accumulate with no indication.
- **Evidence**: `catchError(() => EMPTY)` with no logging.
- **Fix**: `catchError((err) => { console.warn('[SessionsPanel] close-stale failed:', err); return EMPTY; })` at minimum.

### Issue 5: `closeStaleSession` has no DB transaction — partial update on multi-session close

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard-api/src/dashboard/cortex.service.ts` (lines 215–242)
- **Scenario**: Multiple stale sessions; process kill or DB lock between iterations.
- **Impact**: Inconsistent DB state — some sessions marked stopped, others not. The returned `closed_sessions` count silently reflects only the partial work done.
- **Evidence**: Individual `updateStmt.run()` calls in a plain `for` loop with no `db.transaction()` wrapper.
- **Fix**: Wrap the SELECT + loop in `db.transaction(() => { ... })()` for atomicity.

### Issue 6: `interval()` clock-tick (30s) resets `now` signal but the component also re-renders every 30s even when no sessions are running

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/views/project/sessions-panel/sessions-panel.component.ts` (lines 54–57)
- **Scenario**: Sessions panel is open with no running sessions. The `interval(30_000)` still fires and calls `this.now.set(Date.now())`, triggering `heartbeatStatusMap` recomputation even though it returns an empty map.
- **Impact**: Minor unnecessary computation, but the real concern is that `now` is updated even when no running sessions exist and `heartbeatStatusMap` iterates `sessions()` + `recentSessions()` on every tick. If session lists grow large (unlikely in practice), this compounds.
- **Recommendation**: Gate the `now` ticker on `sessions().length > 0` or let the computed lazily read `Date.now()` only when needed.

---

## Moderate Issues

### Issue 7: `getCortexSessionSummaries()` in ApiService calls a non-existent endpoint

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/apps/dashboard/src/app/services/api.service.ts` (lines 240–244)
- **Scenario**: Any caller that invokes `getCortexSessionSummaries()`.
- **Impact**: The endpoint `/api/cortex/sessions/summaries` does not exist in `DashboardController`. This is not added by this task, but it is a dead method that would produce a 404. Not introduced by this task but is adjacent dead code.
- **Recommendation**: Either add the endpoint or remove the method.

### Issue 8: `heartbeatStatusMap` skips sessions where `status !== 'running'` but shows heartbeat section only in active sessions list — consistent but undocumented

- **File**: `sessions-panel.component.ts` (line 75) + `sessions-panel.component.html` (line 43)
- **Scenario**: A session that was recently stopped still in `recentSessions` with a stale heartbeat — the map skips it (status check passes non-running). The heartbeat badge is only rendered in the active sessions block anyway (HTML line 43). Consistent design, but the computed silently iterates `recentSessions()` too and discards them. Low priority.
- **Recommendation**: Either remove `recentSessions()` from the iteration in `heartbeatStatusMap` (they are never used) or document why they are included.

### Issue 9: Mock data does not include `lastHeartbeat` — false red badge in development

- **File**: `sessions-panel.component.ts` (lines 136–167)
- **Scenario**: API unreachable (common in local development).
- **Impact**: Every mock running session shows red "No heartbeat" badge, creating misleading development UI.
- **Fix**: Add `lastHeartbeat: new Date(Date.now() - 45_000).toISOString()` to mock running sessions.

---

## Data Flow Analysis

```
Supervisor (SKILL.md poll loop)
    |
    | [MISSING] update_heartbeat(session_id)
    |                                          ← AC-1 not wired
    v
sessions table: last_heartbeat = ISO string
    |
    | CortexService.getSessions() / querySessionSummary()
    | SESSION_COLS includes last_heartbeat ✓
    v
CortexSession.last_heartbeat: string | null  ✓
    |
    | GET /api/cortex/sessions  ← BYPASSED by component
    |
    | getActiveSessionsEnhanced()  ← ACTUAL endpoint used by component
    |     SessionsService builds response from in-memory SessionData
    |     [MISSING] lastHeartbeat NOT in return type or mapping
    v
ActiveSessionSummary.lastHeartbeat: string | null | undefined
    |                                          ← always undefined
    | ApiService.getActiveSessionsEnhanced()
    v
SessionsPanelComponent.sessions signal
    |
    | heartbeatStatusMap computed()
    |   session.lastHeartbeat → always undefined/null
    |   → maps to { label: 'No heartbeat', cssClass: 'heartbeat-stale' }
    v
Template: always shows red badge for ALL running sessions ← wrong

Background cleanup:
interval(5min) → closeStaleSession(30) → POST /api/sessions/close-stale
    |
    | ttl validated: finite & >0 & <=1440 ✓
    | safeTtl = 30 (default) ✓
    v
CortexService.closeStaleSession(30)
    → opens DB in write mode ✓
    → writes loop_status='stopped', ended_at, summary, updated_at
    → [RISK] summary column may not exist in schema
    → [RISK] no transaction — partial update possible
    → catchError(() => EMPTY) — no logging ✗
```

### Gap Points Identified:

1. `last_heartbeat` has no producer — `update_heartbeat` is never called in the supervisor loop
2. `lastHeartbeat` is not included in the `getActiveSessionsEnhanced()` server response — data never flows from DB to component
3. `closeStaleSession` errors are silently discarded in the Angular component

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| AC-1: Supervisor calls `update_heartbeat` every poll cycle | MISSING | No call in SKILL.md monitoring loop |
| AC-2: Auto-pilot startup calls `close_stale_sessions(ttl=5)` before `create_session` | COMPLETE | Added to session-lifecycle.md Step 3a |
| AC-3: Sessions list shows "last seen Xm ago" using `last_heartbeat` | PARTIAL | UI renders correctly; data never flows from DB (AC-1 missing; endpoint gap) |
| AC-4: Amber >2min, red >10min / no heartbeat | PARTIAL | Thresholds correct; entire feature non-functional due to missing data flow |
| AC-5: Dashboard calls `close_stale_sessions` every 5 minutes | COMPLETE | `interval(5 * 60_000)` with `takeUntilDestroyed` ✓ |
| AC-6: `POST /api/sessions/close-stale` endpoint exists | COMPLETE | Endpoint added to `DashboardController` with TTL validation ✓ |
| AC-7: Crashed session with no heartbeat for 30min is auto-marked stopped | PARTIAL | Logic correct; but `summary` column risk and no transaction may cause silent failure |

### Implicit Requirements NOT Addressed:

1. The `getActiveSessionsEnhanced()` server method needs to include `last_heartbeat` — the data flow gap means heartbeat data never reaches the frontend even when AC-1 is fixed
2. Operator observability: the background cleanup job has no logging on failure; there is no way to diagnose why close-stale is not working without tracing HTTP calls manually
3. Schema validation for `summary` column — should be documented or the column added to `SESSION_COLS` and `RawSession`

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| `last_heartbeat IS NULL` | YES | Shows "No heartbeat" in red | But this is always the case since AC-1 is missing |
| Future-dated heartbeat (`ageMs < 0`) | YES | Shows "just now" (neutral) | Should show clock-skew warning instead |
| `ttl=0` in query param | YES | Falls back to 30 (default) | `0 > 0` is false → default. Correct. |
| `ttl=NaN` in query param | YES | `Number.isFinite(NaN)` is false → default 30 | Correct. |
| `ttl=1500` (>1440) | YES | `Math.min(ttlMinutes, 1440)` caps to 24h | Correct. |
| Concurrent `close-stale` requests | NO | No mutex in `closeStaleSession` | Two simultaneous POSTs run concurrent DB writes; no transaction means interleaved SELECTs and UPDATEs |
| Component destroyed before `close-stale` response returns | YES | `takeUntilDestroyed` cancels the observable | Correct. |
| Empty sessions list | YES | `heartbeatStatusMap` returns empty map | Correct. |
| DB locked during close-stale write | PARTIAL | try/catch returns null → 503 | Correct failure path, but no retry |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| Supervisor → `update_heartbeat` MCP call | N/A — not wired | HIGH — entire feature has no data | Must be implemented |
| `getActiveSessionsEnhanced()` → `lastHeartbeat` | HIGH — always missing | HIGH — heartbeat UI always shows wrong state | Endpoint must be updated |
| `closeStaleSession` → `summary` column | MEDIUM — column not in schema types | HIGH — entire close-stale silently fails with 503 | Verify schema; add to types |
| `catchError(() => EMPTY)` on close-stale | HIGH — will trigger on API errors | LOW — silent, ghost sessions stay | Add logging |
| No transaction in `closeStaleSession` | LOW — only on multi-session crash | MEDIUM — partial DB update | Add `db.transaction()` |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The primary deliverable — showing heartbeat staleness on running sessions — is end-to-end broken for real data. AC-1 (producer not wired) and the `getActiveSessionsEnhanced()` data flow gap (consumer never receives the field) independently each break the feature. Both must be fixed for the heartbeat indicator to function at all.

## What Robust Implementation Would Include

- `update_heartbeat` called on every supervisor poll cycle, with `best-effort` error handling (log + continue)
- `getActiveSessionsEnhanced()` cross-joining cortex DB sessions to attach `last_heartbeat` to each response record
- `db.transaction()` wrapping the stale-session close loop for atomicity
- `catchError` logging the error before swallowing it (anti-pattern compliance)
- `summary` column verified in schema and reflected in `RawSession` / `SESSION_COLS`
- Mock data updated to include realistic `lastHeartbeat` values to avoid developer false alarms
- Future-dated heartbeat detection (clock skew guard) in `heartbeatStatusMap`
