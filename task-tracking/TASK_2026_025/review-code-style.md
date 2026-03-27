# Code Style Review -- TASK_2026_025

## Score: 3/10

## Review Summary

| Metric          | Value         |
| --------------- | ------------- |
| Overall Score   | 3/10          |
| Assessment      | REJECTED      |
| Blocking Issues | 2             |
| Serious Issues  | 2             |
| Minor Issues    | 1             |
| Files Reviewed  | 5             |

This fix was applied to **dead code**. The actual runtime entry point (`src/index.ts`) contains inline implementations of both `get_worker_stats` and `get_worker_activity` with their own `getHealth()` function (line 240), and that function was NOT updated with the startup grace period. The files in `src/tools/` are never imported -- they are orphaned modules. The bug remains unfixed in production.

---

## Findings

### [BLOCKING] Fix applied to dead code -- `src/index.ts:getHealth()` not updated

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts:240-247`
- **Issue**: The application entry point is `dist/index.js` (compiled from `src/index.ts`), confirmed by `package.json` `"main": "dist/index.js"`. The `index.ts` file defines `get_worker_stats` (line 140) and `get_worker_activity` (line 174) inline using `server.tool()`, and both call `getHealth()` defined at line 240. This function has **no startup grace period logic** -- it still maps any 120s inactivity directly to `'stuck'` regardless of message count or spawn time. The files `src/tools/get-worker-stats.ts` and `src/tools/get-worker-activity.ts` where the fix WAS applied are never imported by any module.
- **Impact**: The bug described in context.md (review workers killed during startup) is **not fixed**. The runtime code path is unchanged.
- **Fix**: Either (a) update `getHealth()` in `index.ts` to accept `messageCount` and `startedAt` parameters and add the grace period logic, matching what was done in the tools/ files, OR (b) refactor `index.ts` to import and use the tool functions from `src/tools/`, eliminating the duplication. Option (b) is strongly preferred.

### [BLOCKING] `STARTUP_GRACE_MS` duplicated as local constant in two files

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts:59` and `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:23`
- **Issue**: The magic number `300_000` is declared as a local `const STARTUP_GRACE_MS` independently in both files. There is also the related `120_000` stuck threshold that appears in three places (`index.ts:245`, `get-worker-stats.ts:65`, `get-worker-activity.ts:29`). When someone changes one, they will miss the others -- which is exactly what happened here (the index.ts copy was missed). This is a textbook DRY violation that already caused a bug.
- **Fix**: Extract both `STARTUP_GRACE_MS` and the stuck threshold (`STUCK_THRESHOLD_MS`) to a shared constants file or into the `assessHealth` function itself, then import from a single source of truth. All three health-assessment code paths should call the same function.

### [SERIOUS] Health string casing mismatch in `get-worker-activity.ts`

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:25-30`
- **Issue**: The `HealthStatus` type in `types.ts:37` defines lowercase/snake_case values: `'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished'`. But `get-worker-activity.ts` uses SCREAMING_CASE strings: `'COMPACTING'`, `'HIGH_CONTEXT'`, `'STARTING'`, `'STUCK'`. The file does not import `HealthStatus`, so the `health` variable is inferred as `string` and TypeScript cannot catch the mismatch. The supervisor's SKILL.md pattern-matches on lowercase values (`starting`, `stuck`, etc.), so if this code path were ever activated, the supervisor would fail to recognize health states and would not handle them correctly.
- **Fix**: Import `HealthStatus` from `../types.js`, type the `health` variable explicitly as `HealthStatus`, and use the correct lowercase values matching the type definition.

### [SERIOUS] Three parallel health-assessment implementations

- **File**: `src/index.ts:240` (`getHealth`), `src/tools/get-worker-stats.ts:58` (`assessHealth`), `src/tools/get-worker-activity.ts:25` (inline ternary)
- **Issue**: Health assessment logic exists in three independent places with divergent implementations: `index.ts` has no grace period, `get-worker-stats.ts` has it as a proper function, and `get-worker-activity.ts` has it as an inline ternary with wrong casing. This is unmaintainable. Any future change to health logic requires finding and updating three locations, and history shows this already caused a miss.
- **Fix**: Create a single `assessHealth()` function (the one in `get-worker-stats.ts` is the best candidate), export it, and have all three call sites use it. Delete the other two implementations.

### [MINOR] `alive` variable declared but unused in `get-worker-activity.ts`

- **File**: `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts:21`
- **Issue**: `const alive = isProcessAlive(w.pid);` is declared on line 21 but never referenced. The health ternary on line 25 calls `!alive` which uses it, but the `!alive` check uses the inline `isProcessAlive` call result indirectly via the variable. Wait -- actually `alive` IS used on line 25 (`!alive ? 'finished'`). Disregard, this is actually fine. However, `isProcessAlive` is imported but could be called once and reused, which is what `alive` does -- this is correct. No action needed.

**Correction**: Replacing the minor above.

### [MINOR] SKILL.md documentation references tool return type that does not match actual runtime

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:876`
- **Issue**: The tool signature documentation shows `health: 'healthy' | 'starting' | ...` including `'starting'`, but the actual runtime code (`index.ts:getHealth`) cannot return `'starting'`. The documentation describes the intended behavior but not the actual behavior. This will confuse anyone debugging why `starting` never appears in practice.
- **Fix**: After fixing the runtime code, verify the documentation matches. Until then, this documentation is misleading.

---

## The 5 Critical Questions

### 1. What could break in 6 months?

The three-way duplication of health logic guarantees future divergence. The next person who adds a health state (e.g., `'warming_up'`, `'rate_limited'`) will update one or two of the three locations and miss the third. This pattern has already caused the exact bug this task was meant to fix.

### 2. What would confuse a new team member?

The existence of `src/tools/get-worker-stats.ts` and `src/tools/get-worker-activity.ts` alongside identical inline implementations in `src/index.ts` is deeply confusing. A developer would reasonably assume the `tools/` directory contains the active implementations. There is no comment explaining that these files are unused, nor any mechanism (like an import) connecting them.

### 3. What's the hidden complexity cost?

The casing mismatch between `HealthStatus` type values (lowercase) and the inline ternary in `get-worker-activity.ts` (SCREAMING_CASE) means these are effectively untyped strings. If someone later adds TypeScript strict checks or starts pattern-matching on health values, these mismatches will surface as silent failures.

### 4. What pattern inconsistencies exist?

- `get-worker-stats.ts` uses a named function `assessHealth` with proper typing; `get-worker-activity.ts` uses an inline ternary with wrong casing and no typing.
- `index.ts` uses `getHealth` (camelCase); `get-worker-stats.ts` uses `assessHealth` (camelCase but different name). Same concept, different names.
- `STARTUP_GRACE_MS` uses SCREAMING_SNAKE for a local constant, which is fine, but the project CLAUDE.md says constants should be `camelCase`.

### 5. What would I do differently?

1. Single `assessHealth()` function exported from a shared module (e.g., `src/core/health.ts`).
2. All constants (`STARTUP_GRACE_MS`, stuck threshold) co-located with that function.
3. Remove the dead code in `src/tools/` or refactor `index.ts` to use it.
4. Add a simple test: spawn a worker, check health immediately -- should be `'starting'`, not `'stuck'`.

---

## File-by-File Analysis

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/types.ts`

**Score**: 7/10
**Issues Found**: 0 blocking, 0 serious, 0 minor

The addition of `'starting'` to `HealthStatus` is clean and correctly placed in alphabetical-ish order (after `'healthy'`). The type is well-structured. No complaints with this file in isolation.

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-stats.ts`

**Score**: 5/10
**Issues Found**: 1 blocking (dead code), 1 serious (duplication)

The `assessHealth` function itself is well-written. The parameter list is clear, the guard order is logical (process alive > compacting > high context > starting > stuck > healthy), and the grace period logic is correct. But this file is never imported by the runtime entry point, making the entire change ineffective.

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/tools/get-worker-activity.ts`

**Score**: 3/10
**Issues Found**: 1 blocking (dead code), 1 serious (casing mismatch), 1 serious (duplication)

The health ternary uses SCREAMING_CASE strings that do not match the `HealthStatus` type. The `HealthStatus` type is not imported, so there is no compile-time safety. Even if this code were active, the supervisor would not recognize the health states because it pattern-matches on lowercase values.

### `/Volumes/SanDiskSSD/mine/session-orchestrator/src/index.ts` (lines 240-247)

**Score**: 2/10 (for the health function specifically)

This is the **actually executing** health function, and it was not touched by this task. It still has the original bug: no startup grace period, no `messageCount` parameter, no `startedAt` parameter. This is the root cause of the review failure.

### `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`

**Score**: 7/10
**Issues Found**: 0 blocking, 1 minor

The SKILL.md changes are well-written. The `starting` health state handling is clearly documented in the table (line 361), the grace period is mentioned in the note (line 62), and the escalation rule correctly says not to escalate for `starting` (line 885). The only issue is that this documents behavior that does not actually exist in the running code.

---

## Pattern Compliance

| Pattern            | Status | Concern                                                           |
| ------------------ | ------ | ----------------------------------------------------------------- |
| Type safety        | FAIL   | `get-worker-activity.ts` health variable untyped, casing mismatch |
| DRY principle      | FAIL   | Three independent health implementations                          |
| Dead code          | FAIL   | `src/tools/` files not imported by entry point                    |
| Naming conventions | WARN   | `STARTUP_GRACE_MS` uses SCREAMING_SNAKE vs project camelCase rule |
| Documentation sync | FAIL   | SKILL.md documents behavior not present in runtime                |

## Technical Debt Assessment

**Introduced**: Two additional dead-code files that appear to be active implementations but are not.
**Mitigated**: None. The original bug is not fixed in the runtime code path.
**Net Impact**: Negative. Technical debt increased with no bug fix delivered.

## Verdict

**Recommendation**: REJECT
**Confidence**: HIGH
**Key Concern**: The fix was applied to orphaned files that are not part of the runtime code path. The actual health assessment in `src/index.ts:240` remains unchanged. The bug described in context.md is still present.

## What Excellence Would Look Like

1. A single `assessHealth()` function in `src/core/health.ts`, exported and tested.
2. `index.ts` imports and calls `assessHealth()` instead of defining its own `getHealth()`.
3. The `src/tools/` files either become the canonical implementations (imported by index) or are deleted.
4. Constants (`STARTUP_GRACE_MS = 300_000`, `STUCK_THRESHOLD_MS = 120_000`) defined once alongside the health function.
5. `get-worker-activity.ts` uses proper `HealthStatus` typing with correct lowercase values.
6. A test that verifies a zero-message worker within 5 minutes returns `'starting'`.
