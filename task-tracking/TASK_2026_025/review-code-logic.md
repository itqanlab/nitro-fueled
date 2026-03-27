# Code Logic Review — TASK_2026_025

## Review Summary

| Metric              | Value         |
| ------------------- | ------------- |
| Overall Score       | 7/10          |
| Assessment          | NEEDS_REVISION |
| Critical Issues     | 1             |
| Serious Issues      | 2             |
| Moderate Issues     | 1             |
| Failure Modes Found | 5             |

## The 5 Paranoid Questions

### 1. How does this fail silently?

A worker that has messages (`message_count > 0`) but whose JSONL file has not been polled yet (3-second poll interval hasn't fired, or session_id was still `'pending'`) will have `message_count === 0` in the registry despite actual activity. The grace period protects it, but the inverse edge case is: if the JSONL poll fires exactly once, pushing `message_count` to 1, and then the worker goes idle for 120s, it loses grace protection and gets flagged as `stuck` even if the idle period is still within the 5-minute startup window. This is an improvement over the original but still has a narrow window for false positives.

### 2. What user action causes unexpected behavior?

If a supervisor kills a `starting` worker manually (via `kill_worker`) and re-spawns it, the new worker gets a fresh `started_at` and a fresh 5-minute grace. This is correct behavior. No user-facing issue here.

### 3. What data makes this produce wrong results?

The health ternary in `get-worker-activity.ts` uses UPPER_CASE strings (`'STARTING'`, `'STUCK'`, `'COMPACTING'`, `'HIGH_CONTEXT'`) while `get-worker-stats.ts` uses lowercase (`'starting'`, `'stuck'`, etc.) and the `HealthStatus` type is lowercase. The supervisor SKILL.md checks for lowercase `starting` in its health state table. If the supervisor reads health from `get_worker_activity` and does a strict string comparison against `'starting'`, it will NOT match `'STARTING'`. This is a critical inconsistency.

### 4. What happens when dependencies fail?

If `isProcessAlive` throws an unexpected error (should not happen given the try/catch, but worth noting), the ternary falls through to the other checks. The implementation of `isProcessAlive` is safe -- it catches all exceptions.

If the JSONL watcher's 3-second poll skips a worker because `session_id === 'pending'`, `last_action_at` remains at spawn time and `message_count` stays 0. The grace period correctly covers this gap. This is the core fix working as designed.

### 5. What's missing that the requirements didn't mention?

- No configurable startup grace period. The 5-minute constant is hardcoded in two separate files. If someone needs to tune it, they must change it in both places.
- No logging when a worker transitions from `starting` to `healthy` or `starting` to `stuck`. The supervisor gets the state but there is no server-side event for this transition.
- The grace period uses wall clock since spawn, not since JSONL path resolution. A worker whose JSONL path takes 4 minutes to resolve only gets 1 minute of actual "working" grace.

## Failure Mode Analysis

### Failure Mode 1: Case Mismatch Between Activity and Stats Health Strings

- **Trigger**: Supervisor calls `get_worker_activity` (the default/preferred tool) and reads health as `'STARTING'`
- **Symptoms**: Supervisor may not recognize `'STARTING'` as a known health state, potentially treating it as an anomaly or escalating unnecessarily
- **Impact**: High -- defeats the purpose of the fix if the supervisor does string matching against lowercase `'starting'`
- **Current Handling**: The SKILL.md instructs the supervisor NOT to escalate for `starting`, but `get_worker_activity` returns `'STARTING'` (uppercase)
- **Recommendation**: Use the `HealthStatus` type values (lowercase) consistently in both tools

### Failure Mode 2: Hardcoded Grace Period Duplicated in Two Files

- **Trigger**: Developer changes the grace period in one file but not the other
- **Symptoms**: `get_worker_stats` and `get_worker_activity` disagree on when a worker transitions from `starting` to `stuck`
- **Impact**: Medium -- inconsistent health reporting between the two tools
- **Current Handling**: Both files independently define `STARTUP_GRACE_MS = 300_000`
- **Recommendation**: Extract the constant to a shared module (e.g., `src/core/constants.ts` or `src/types.ts`)

### Failure Mode 3: Single-Message Worker Loses Grace Protection

- **Trigger**: Worker produces exactly 1 assistant message (incrementing `message_count` to 1) but then goes idle during initial processing (e.g., reading a large task folder)
- **Symptoms**: After 120s of no tool_use activity, health becomes `stuck` even though the worker is still within its first 5 minutes
- **Impact**: Low-Medium -- narrow window, but review workers with large prompts are exactly the workers most likely to hit this
- **Current Handling**: Grace period only applies when `message_count === 0`
- **Recommendation**: Consider using `message_count < 2` or a time-based-only check for the first 5 minutes regardless of message count

### Failure Mode 4: Grace Period Measured From Spawn, Not From JSONL Resolution

- **Trigger**: JSONL path resolution takes 3-4 minutes (slow system, cold cache)
- **Symptoms**: Worker effectively gets only 1-2 minutes of grace after it can actually start producing output
- **Impact**: Low -- JSONL resolution is typically 10-30s per context.md, but on slow systems this could matter
- **Current Handling**: `Date.now() - startedAt` uses spawn time
- **Recommendation**: Acceptable for now; the 5-minute window is generous enough to absorb typical resolution delays

### Failure Mode 5: `get_worker_activity` Does Not Use `HealthStatus` Type

- **Trigger**: Any call to `get_worker_activity`
- **Symptoms**: The health variable is typed as a plain string, not `HealthStatus`. TypeScript cannot catch typos or invalid states.
- **Impact**: Low -- the code works at runtime, but there is no compile-time safety
- **Current Handling**: Inline ternary produces string literals
- **Recommendation**: Import and use the `HealthStatus` type, or call the shared `assessHealth` function

## Critical Issues

### Issue 1: Health String Case Mismatch Between get_worker_activity and get_worker_stats

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:25-30`
- **Scenario**: Supervisor calls `get_worker_activity` (the recommended default tool) and receives `'STARTING'` instead of `'starting'`. The SKILL.md health state table uses lowercase. The `HealthStatus` type uses lowercase.
- **Impact**: The entire fix may be ineffective if the supervisor does case-sensitive string matching. A `'STARTING'` health state could be treated as unrecognized, leading to unnecessary escalation or incorrect handling.
- **Evidence**:
  ```typescript
  // get-worker-activity.ts — UPPERCASE
  : (w.progress.message_count === 0 && Date.now() - w.started_at < STARTUP_GRACE_MS) ? 'STARTING'

  // get-worker-stats.ts assessHealth() — lowercase
  if (messageCount === 0 && Date.now() - startedAt < STARTUP_GRACE_MS) return 'starting';

  // types.ts — lowercase
  export type HealthStatus = 'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished';
  ```
- **Fix**: Change all health strings in `get-worker-activity.ts` to use lowercase values matching the `HealthStatus` type. Ideally, refactor to call the shared `assessHealth` function instead of duplicating the ternary.

## Serious Issues

### Issue 1: Duplicated Health Assessment Logic

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:25-30` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts:58-67`
- **Scenario**: The health assessment ternary is duplicated across two files with different casing conventions. Any future change to health logic must be applied in both places.
- **Impact**: High maintenance risk. The case mismatch (Critical Issue 1) is direct evidence that duplication already caused a bug.
- **Fix**: Export `assessHealth` from `get-worker-stats.ts` (or a shared module) and call it from both tools.

### Issue 2: STARTUP_GRACE_MS Constant Duplicated

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:23` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts:59`
- **Scenario**: Grace period is defined as a local constant in two separate files
- **Impact**: If one file is updated and not the other, the two health-check endpoints will disagree on startup grace behavior
- **Fix**: Move `STARTUP_GRACE_MS` to a shared constants file or into the `assessHealth` function that both tools should share

## Moderate Issues

### Issue 1: message_count === 0 Is a Fragile Grace Condition

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts:64`
- **Scenario**: A worker receives its first assistant message (the initial prompt acknowledgment) which sets `message_count = 1`, but then spends 2+ minutes reading files before producing tool_use blocks. The `last_action_at` is still at spawn time (since `last_action_at` is only updated by `extractToolCalls`). After 120s, health = `stuck`.
- **Impact**: This is a narrower version of the original bug. The first assistant message often contains text-only content (no tool_use), so `last_action_at` does not get updated by it. Only subsequent tool_use blocks update `last_action_at`.
- **Fix**: Consider checking `Date.now() - startedAt < STARTUP_GRACE_MS` as an independent condition (not gated on `message_count === 0`), or update `last_action_at` when any assistant message is processed (not just tool_use).

## Data Flow Analysis

```
Spawn Worker
  |
  v
Registry: started_at = Date.now(), message_count = 0, last_action_at = Date.now()
  |
  v
Background resolver: resolves session_id + jsonl_path (10-30s)
  |
  |  [JSONL watcher skips: session_id === 'pending']
  |  [message_count stays 0, last_action_at stays at spawn]
  v
JSONL path resolved, watcher starts reading
  |
  v
First assistant message (text only, no tool_use)
  -> message_count = 1
  -> last_action_at UNCHANGED (only tool_use updates it) <-- GAP
  |
  v
First tool_use in assistant message
  -> last_action_at = Date.now()
  -> Health transitions from starting/stuck to healthy
```

### Gap Points Identified:
1. Between spawn and JSONL resolution: `last_action_at` is stale -- COVERED by grace period (message_count === 0)
2. Between first assistant message and first tool_use: `message_count > 0` but `last_action_at` is stale -- NOT COVERED by grace period
3. The `STARTUP_GRACE_MS` constant exists in two files with no shared source of truth

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Add `starting` to HealthStatus type | COMPLETE | None |
| Update assessHealth for startup grace | COMPLETE | message_count === 0 is fragile (see Moderate Issue 1) |
| Update get_worker_activity health | COMPLETE | Case mismatch with HealthStatus type (Critical Issue 1) |
| Update SKILL.md for starting state | COMPLETE | Well documented, includes escalation guidance |
| Workers that die during startup detected | COMPLETE | `isProcessAlive` check is first in ternary -- correct |
| Workers exceeding 5min grace with 0 msgs flagged stuck | COMPLETE | Falls through to 120s stuck check after grace expires |

### Implicit Requirements NOT Addressed:
1. Consistent casing between the two health-reporting tools
2. Single source of truth for health assessment logic
3. Handling of the gap between first message and first tool_use

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Worker dies immediately (PID gone) | YES | `isProcessAlive` returns false -> `finished` | None |
| Worker has 0 msgs within 5 min | YES | Returns `starting` | Core fix, works correctly |
| Worker has 0 msgs after 5 min | YES | Falls through to `last_action_at > 120s` -> `stuck` | Correct |
| Worker has 1 msg but no tool_use | PARTIAL | `message_count > 0` so no grace, but `last_action_at` is stale | Could false-positive as stuck |
| Concurrent health checks | YES | Both tools read from same registry snapshot | No mutation conflict |
| Worker with 2+ compactions during startup | YES | `compacting` takes priority over `starting` in ternary | Unlikely during startup but handled |
| High context during startup | YES | `high_context` takes priority over `starting` | Unlikely but handled |

## Ternary Order Verification

The requested verification of ternary order: `finished > compacting > high_context > starting > stuck > healthy`

| Priority | State | Rationale | Correct? |
|----------|-------|-----------|----------|
| 1 | finished | Dead process overrides everything | YES |
| 2 | compacting | Active compaction is a known state | YES |
| 3 | high_context | Warning but not actionable | YES |
| 4 | starting | Grace period for new workers | YES |
| 5 | stuck | Inactivity detected | YES |
| 6 | healthy | Default | YES |

The order is logically sound. `finished` must be first (no point assessing health of a dead process). `compacting` and `high_context` before `starting` means a worker that somehow hits high context on message 0 would be reported as `high_context` rather than `starting` -- this is correct since `high_context` is a more informative state. `starting` before `stuck` is the core fix -- preventing false stuck detection.

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: The case mismatch between `get_worker_activity` (UPPERCASE) and `get_worker_stats` / `HealthStatus` type (lowercase) could cause the supervisor to not recognize the `STARTING` state, potentially defeating the entire purpose of this fix.

## What Robust Implementation Would Include

1. **Single `assessHealth` function** shared by both `get_worker_stats` and `get_worker_activity` -- eliminates duplication and the casing bug
2. **Shared constants module** for `STARTUP_GRACE_MS` and `STUCK_THRESHOLD_MS` (the 120_000 value is also hardcoded in both files)
3. **Update `last_action_at` on any assistant message**, not just tool_use -- this closes the gap where message_count > 0 but last_action_at is stale
4. **Type annotation on the health variable** in `get_worker_activity.ts` to catch casing issues at compile time
5. **Unit tests** for `assessHealth` covering: startup grace, grace expiry, dead process, first-message-no-tooluse scenario
