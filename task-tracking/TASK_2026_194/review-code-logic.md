# Code Logic Review — TASK_2026_194

## Score: 6/10

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 6/10                                 |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 2                                    |
| Serious Issues      | 2                                    |
| Moderate Issues     | 3                                    |
| Failure Modes Found | 7                                    |

The normalization helper itself is correct and the canonical format is defined in one place. The happy path — passing a legacy ID to any MCP tool and having it resolve to the T-format row — works. The gaps are in coverage of less-obvious paths: orphaned-claim detection, the `get_pending_events` event drain filter, `handleEndSession` legacy coverage, and silent pass-through for malformed IDs.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

`normalizeSessionId` returns the input unchanged when it matches neither regex. A typo like `SESSION_2026-03-30 05-41-42` (space instead of underscore) or a truncated ID silently passes through, hits the DB with the wrong value, and returns `session_not_found` with no indication that the input was malformed. The caller cannot distinguish "session does not exist" from "your ID was garbage."

### 2. What user action causes unexpected behavior?

A supervisor that still has legacy `session_claimed` values written into the tasks table before this fix runs `get_orphaned_claims` or session startup recovery. The `detectOrphanedClaims` function loads active sessions from DB (canonical T-format) and compares them raw against `task.session_claimed` which may still be in legacy underscore format. The set lookup fails, and the running session's tasks are falsely reported as orphaned and released. This is a data-integrity failure, not just a UX issue.

### 3. What data makes this produce wrong results?

Any row in `tasks.session_claimed` that was written before the fix with the underscore format will trigger false-positive orphan detection. The `detectOrphanedClaims` function at `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/tasks.ts:295-316` does `!activeSessions.has(task.session_claimed)` with no normalization on the DB value being checked.

### 4. What happens when dependencies fail?

The `handleGetPendingEvents` function at `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/events/subscriptions.ts:321` accepts `sessionId?: string` from the MCP layer and passes it directly to `drainEvents` and `emitQueue.drain`. Events stored in the in-memory queues carry the `session_id` as it was stored when the worker was spawned. If a supervisor passes a legacy underscore ID to `get_pending_events` to filter, no events are returned even though matching events exist (they are stored with the canonical format from the time `handleSpawnWorker` normalized the ID on insert).

### 5. What's missing that the requirements didn't mention?

The requirement said "apply normalization at MCP tool boundaries." It did not account for the in-memory `FileWatcher` and `EmitQueue` classes in `subscriptions.ts` which store and filter `session_id` values. These are tool-adjacent boundaries that also need normalization. Likewise, existing rows in `session_claimed` are not retroactively normalized on startup, so legacy DB state survives the migration.

---

## Failure Mode Analysis

### Failure Mode 1: False-Positive Orphan Detection

- **Trigger**: DB contains tasks with `session_claimed = 'SESSION_2026-03-30_05-41-42'` (legacy format written before the fix). A new session starts and calls `create_session`, which triggers `handleReleaseOrphanedClaims`. `detectOrphanedClaims` loads active sessions with T-format IDs into a Set, then checks `activeSessions.has(task.session_claimed)` where the value is the legacy underscore format. The Set lookup returns `false`.
- **Symptoms**: Running tasks are silently released back to CREATED and re-queued. Workers already executing those tasks continue unaware while new workers pick them up. Duplicate execution, corrupted work, lost progress.
- **Impact**: Data integrity failure. Possible duplicate task execution. Highest severity.
- **Current Handling**: None. `detectOrphanedClaims` at `tasks.ts:312` does a raw Set lookup with no normalization on the `session_claimed` column value.
- **Recommendation**: Normalize `task.session_claimed` before the Set lookup: `const normalized = normalizeSessionId(task.session_claimed); const isSessionDead = !activeSessions.has(normalized);`

### Failure Mode 2: `get_pending_events` Session Filter Miss

- **Trigger**: Supervisor calls `get_pending_events` with `session_id: 'SESSION_2026-03-30_05-41-42'` (legacy format). Events in `FileWatcher` and `EmitQueue` were stored with the canonical T-format session ID (because `handleSpawnWorker` normalizes before insertion). The string comparison in `drainEvents` and `EmitQueue.drain` does `ev.session_id === sessionId` — exact string match. No events are returned.
- **Symptoms**: Supervisor believes no events are pending. Workers appear stuck. Events accumulate in memory until queue overflow.
- **Impact**: Supervisor liveness failure. Session-scoped event filtering is broken for legacy callers.
- **Current Handling**: None. `handleGetPendingEvents` at `subscriptions.ts:321` passes the raw `sessionId` argument through.
- **Recommendation**: Normalize the incoming `sessionId` parameter in `handleGetPendingEvents` before passing to `drainEvents` and `emitQueue.drain`.

### Failure Mode 3: `handleEndSession` Has No Legacy Test Coverage

- **Trigger**: Any code path that calls `end_session` with a legacy underscore ID. The function body does normalize correctly (calls `normalizeSessionId`), so the logic is right.
- **Symptoms**: If the normalization logic ever regresses, there is no test to catch it for this path.
- **Impact**: Silent regression risk. Lower immediate severity.
- **Current Handling**: `handleEndSession` normalizes correctly but has zero legacy-ID test coverage in `sessions.spec.ts`. `handleGetSession`, `handleUpdateSession`, and `handleUpdateHeartbeat` all have legacy tests. `handleEndSession` does not.
- **Recommendation**: Add `it('accepts legacy underscore session IDs when ending')` mirroring the pattern used for the other three operations.

### Failure Mode 4: Malformed IDs Pass Through Silently

- **Trigger**: Caller passes a syntactically invalid session ID — space-separated, truncated, lowercase, or entirely wrong pattern.
- **Symptoms**: `normalizeSessionId` returns the input unchanged. The DB query finds no row and returns `{ ok: false, reason: 'session_not_found' }`. Caller cannot distinguish "valid ID, session deleted" from "ID was malformed."
- **Impact**: Debugging difficulty. Masked input bugs. Moderate severity.
- **Current Handling**: `session-id.ts:17` — falls through to `return sessionId`. No validation, no error signal.
- **Recommendation**: Either add a third return path that signals malformed input, or validate at the MCP schema layer with a stricter regex pattern on the `z.string()` inputs.

### Failure Mode 5: `buildSessionId` Timezone Dependence

- **Trigger**: `buildSessionId` calls `new Date().toISOString()`. `Date.toISOString()` always returns UTC, so this is safe. However, two workers spawning within the same second produce the same session ID if called back-to-back. `create_session` is not expected to be called more than once per second in practice, but there is no uniqueness guard.
- **Symptoms**: Duplicate primary key constraint violation on `sessions.id`. `db.prepare(...).run(...)` throws, crashing the MCP tool call. There is no try/catch around the INSERT in `handleCreateSession`.
- **Impact**: Unhandled exception propagates to the MCP framework. Moderate severity but narrow timing window.
- **Current Handling**: None. `sessions.ts:21-23` — raw `db.prepare(...).run(...)` with no error handling.
- **Recommendation**: Wrap the INSERT in a try/catch, or append a short random suffix (4 hex chars) to the generated ID.

### Failure Mode 6: `session_claimed` in DB Not Retroactively Normalized

- **Trigger**: Existing rows in `tasks.session_claimed` retain the legacy underscore format after deploying this fix. Only new claims (via `claim_task` or `get_next_wave`) write normalized IDs going forward.
- **Symptoms**: Queries like `handleClaimTask` that do `session_claimed = ?` with the normalized ID will not match legacy-format claims. A re-claim of a task claimed before the fix will report `{ ok: false, claimed_by: ... }` with the legacy ID (though `normalizeSessionId` is applied on that return value at `tasks.ts:122`).
- **Impact**: Partial backward compatibility. Claims made before the fix are not re-claimable by the same normalized session. Moderate severity.
- **Current Handling**: Partial — `claimed_by` in the conflict response is normalized, but the DB row itself remains in legacy format.
- **Recommendation**: Add a DB migration script or one-shot UPDATE statement to normalize all existing `session_claimed` values on startup.

### Failure Mode 7: `handleStageAndCommit` Strips T from Session ID in Commit Footer

- **Trigger**: `handleStageAndCommit` at `context.ts:357` sanitizes the session_id with `replace(/[^\w-]/g, '')`. The T-separator in a canonical ID like `SESSION_2026-03-30T05-41-42` is alphanumeric (`\w` matches `T`), so no data is lost. But this is subtle — if the format ever changed to use a colon or slash, the sanitizer would corrupt the value silently.
- **Symptoms**: Commit footer shows wrong session ID. Traceability broken.
- **Impact**: Minor — current format is safe, but the sanitizer logic is fragile by design.
- **Current Handling**: Works accidentally because `T` is in `\w`.
- **Recommendation**: Acknowledge this as a known fragility or use a dedicated allowlist pattern for session IDs in the commit footer sanitizer.

---

## Critical Issues

### Issue 1: Orphan Detection Does Not Normalize `session_claimed` from DB

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/tasks.ts:312`
- **Scenario**: Any task row with `session_claimed` in legacy underscore format (written before this fix) will have `activeSessions.has(task.session_claimed)` return `false`, because `activeSessions` is populated from `sessions.id` which is stored in canonical T-format. The task is treated as orphaned even if the session is running.
- **Impact**: False-positive orphan detection releases in-progress tasks. Workers running those tasks continue to completion while new workers also pick up the same tasks. Duplicate work, potential file corruption, status corruption.
- **Evidence**:
  ```typescript
  // tasks.ts:295-316
  const activeSessions = new Set(
    (db.prepare("SELECT id FROM sessions WHERE loop_status = 'running'").all()
      as Array<{ id: string }>).map(s => s.id),
  );
  // ...
  const isSessionDead = !activeSessions.has(task.session_claimed); // NO normalization on task.session_claimed
  ```
- **Fix**: `const isSessionDead = !activeSessions.has(normalizeSessionId(task.session_claimed));`

### Issue 2: `handleGetPendingEvents` Passes Raw Session ID to In-Memory Queues

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/events/subscriptions.ts:321-326`
- **Scenario**: Events are stored in `FileWatcher` and `EmitQueue` with the canonical T-format session ID (because `handleSpawnWorker` normalizes on write). When a caller passes a legacy underscore ID to `get_pending_events`, the exact-match filter finds no events.
- **Impact**: Supervisor loses visibility into all worker events for that session. Workers appear permanently stuck. Session cannot be managed.
- **Evidence**:
  ```typescript
  export function handleGetPendingEvents(fileWatcher: FileWatcher, emitQueue: EmitQueue, sessionId?: string): ToolResult {
    const fileEvents = fileWatcher.drainEvents(sessionId);   // raw, unnormalized
    const emitEvents = emitQueue.drain(sessionId);            // raw, unnormalized
  ```
- **Fix**: `const normalizedId = sessionId ? normalizeSessionId(sessionId) : undefined;` then use `normalizedId` in both drain calls.

---

## Serious Issues

### Issue 3: `handleEndSession` Missing Legacy Test

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sessions.spec.ts`
- **Scenario**: `handleEndSession` normalizes the session ID correctly, but there is no test asserting legacy underscore IDs work. All three sibling operations (`get_session`, `update_session`, `update_heartbeat`) have this test; `end_session` does not. A future refactor that misses `normalizeSessionId` in `handleEndSession` will not be caught.
- **Impact**: Regression safety gap.
- **Fix**: Add `it('accepts legacy underscore session IDs when ending')` in the `handleEndSession` describe block.

### Issue 4: No Startup Migration for Existing Legacy `session_claimed` Rows

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/db/schema.ts` (migration layer)
- **Scenario**: All tasks claimed before this fix have `session_claimed` in legacy underscore format. The fix only normalizes on new writes (via `claim_task`, `get_next_wave`). Old rows remain unrepaired. Re-claim attempts by a normalized session ID will hit the conflict check at `tasks.ts:114` with `session_claimed = ?` where `?` is normalized but the stored value is legacy — they won't match, so the re-claim is allowed, which could cause double-claiming.
- **Impact**: Pre-existing data inconsistency is not cleared. The fix is forward-only.
- **Fix**: Add a migration step: `UPDATE tasks SET session_claimed = REPLACE(session_claimed, '_', 'T') WHERE session_claimed LIKE 'SESSION_____-__-____%' AND session_claimed NOT LIKE 'SESSION_____-__-__T%'` (or apply `normalizeSessionId` logic in a migration script).

---

## Moderate Issues

### Issue 5: `normalizeSessionId` Returns Input Unchanged for Malformed IDs

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/session-id.ts:17`
- **Issue**: When neither regex matches, the function silently returns the raw input. All downstream DB queries return `session_not_found`, which is indistinguishable from a valid ID for a deleted session.
- **Suggestion**: Add a third branch or export a `isValidSessionId(id: string): boolean` helper so callers can validate before querying, or add a structured `{ valid: false }` response path in the MCP handlers.

### Issue 6: `buildSessionId` Has No Collision Guard

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/session-id.ts:4-6`
- **Issue**: Two calls within the same second produce the same ID. The `INSERT INTO sessions` at `sessions.ts:21-23` has no try/catch. A PRIMARY KEY constraint violation would throw and propagate as an unhandled exception.
- **Suggestion**: Append a 4-character random hex suffix, or wrap the INSERT in try/catch and return `{ ok: false, reason: 'collision' }`.

### Issue 7: Test Assertion in Legacy Lookup Uses `replace('T', '_')` — Fragile Pattern

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/packages/mcp-cortex/src/tools/sessions.spec.ts:111`
- **Issue**: `sessionId.replace('T', '_')` only replaces the FIRST occurrence of `T`. If the generated ID ever contained a `T` elsewhere before the date-time separator (e.g., in some edge-case locale), the test would silently replace the wrong character.
- **Suggestion**: Use a more specific replacement: `sessionId.replace(/(\d{4}-\d{2}-\d{2})T(\d{2})/, '$1_$2')` to target only the date-time separator.

---

## Data Flow Analysis

```
Caller passes session_id (potentially legacy underscore format)
       |
       v
MCP layer (index.ts) — passes raw string to handler
       |
       v
normalizeSessionId() called in:
  - handleGetSession        [sessions.ts:51]   COVERED
  - handleUpdateSession     [sessions.ts:78]   COVERED
  - handleEndSession        [sessions.ts:130]  COVERED
  - handleUpdateHeartbeat   [sessions.ts:157]  COVERED
  - handleClaimTask         [tasks.ts:110]     COVERED
  - handleGetNextWave       [wave.ts:22]       COVERED
  - handleSpawnWorker       [workers.ts:96]    COVERED (on write)
  - handleListWorkers       [workers.ts:169]   COVERED
  - handleLogEvent          [events.ts:16]     COVERED
  - handleQueryEvents       [events.ts:42]     COVERED
  - handleGetSessionSummary [telemetry.ts:343] COVERED
       |
       +-- GAP 1: handleGetPendingEvents [subscriptions.ts:321] -- NO normalization
       |          Legacy session ID → exact-match filter misses all events
       |
       +-- GAP 2: detectOrphanedClaims [tasks.ts:312]
                  session_claimed read from DB (may be legacy) is NOT normalized
                  before Set lookup against canonical active sessions
```

### Gap Points Identified

1. `subscriptions.ts:321` — `handleGetPendingEvents` passes raw `sessionId` to in-memory queue drain functions.
2. `tasks.ts:312` — `detectOrphanedClaims` compares raw `task.session_claimed` (may be legacy format from DB) against `activeSessions` (canonical T-format).
3. No startup migration — existing rows with legacy `session_claimed` values are not repaired.

---

## Requirements Fulfillment

| Requirement                                                | Status   | Concern                                                |
|------------------------------------------------------------|----------|--------------------------------------------------------|
| Pick canonical T-separator format                          | COMPLETE | `buildSessionId` always produces T-format             |
| Add normalization for backward compatibility               | PARTIAL  | Applied at DB read/write boundaries; not in-memory queues |
| Apply normalization at MCP tool boundaries                 | PARTIAL  | `get_pending_events` boundary missed                   |
| Correctness of normalization regex                         | COMPLETE | Logic verified; slice(0,18)+'T'+slice(19) is correct  |
| No regressions for T-format IDs                           | COMPLETE | Canonical IDs pass through unchanged                  |
| Single source of truth for canonical format               | COMPLETE | `session-id.ts` is the one place                      |
| Test coverage for legacy format                           | PARTIAL  | `end_session` legacy path untested                     |

### Implicit Requirements Not Addressed

1. Retroactive normalization of existing `session_claimed` DB values — the fix is forward-only.
2. In-memory event queues (`FileWatcher`, `EmitQueue`) store session IDs and filter by exact match — they need the same normalization applied at the boundary.
3. Input validation feedback — callers cannot tell whether `session_not_found` means "deleted session" or "malformed ID."

---

## Edge Case Analysis

| Edge Case                          | Handled | How                                      | Concern                                        |
|------------------------------------|---------|------------------------------------------|------------------------------------------------|
| Canonical T-format ID              | YES     | Regex match → passthrough                | None                                           |
| Legacy underscore-format ID        | YES     | Regex match → slice+replace              | Correct                                        |
| Empty string                       | NO      | Neither regex matches → passthrough      | Silent, DB returns not_found                  |
| Null/undefined                     | N/A     | Zod schema rejects at MCP layer          | Not an issue in production path                |
| Malformed ID (wrong length, etc.)  | NO      | Passthrough → session_not_found          | No feedback that input was invalid             |
| ID with T before the date position | YES     | CANONICAL regex requires exact date+time format | Correctly rejected to passthrough          |
| Two sessions created same second   | NO      | Duplicate PK → unhandled SQLite throw    | No try/catch in handleCreateSession            |
| Legacy DB rows in session_claimed  | NO      | Not migrated; orphan detector false-positives | Critical data integrity risk              |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: `detectOrphanedClaims` compares un-normalized `task.session_claimed` values from DB against a canonical-format active sessions Set. Any pre-fix task row with a legacy session claim will be falsely treated as orphaned and released during the next session startup recovery. This can cause in-progress tasks to be re-queued and picked up by new workers while existing workers continue executing them — silent duplicate execution with no error surfaced.

## What Robust Implementation Would Include

- `normalizeSessionId` call on `task.session_claimed` inside `detectOrphanedClaims` before the `activeSessions.has()` check.
- `normalizeSessionId` call at the top of `handleGetPendingEvents` on the optional `sessionId` parameter before passing to `drainEvents` / `emitQueue.drain`.
- A DB migration (one-shot UPDATE) to normalize all existing `session_claimed` values on first startup with this version.
- A legacy-format test for `handleEndSession` matching the coverage pattern of the three other session operations.
- A uniqueness guard or try/catch in `buildSessionId` / `handleCreateSession` for the same-second collision case.
