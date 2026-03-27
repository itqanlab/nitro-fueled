# Code Logic Review — TASK_2026_049

**Reviewer:** code-logic-reviewer
**Date:** 2026-03-27
**Scope:** AI-Assisted Workspace Analysis for Stack Detection

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| Major    | 1     |
| Minor    | 4     |
| Info     | 2     |

**Overall:** Logic implementation is sound. The feature correctly collects workspace signals, runs AI analysis when available, falls back to heuristics, and merges proposals. Main concerns are convention violations (`as` assertions) and one edge case in subprocess handling.

---

## Issues

### MAJOR-1: Signal process termination not handled in runAIAnalysis

**File:** `packages/cli/src/utils/stack-detect.ts`
**Lines:** 439-444

```typescript
if (result.status !== 0) {
  const stderr = result.stderr?.toString().trim() ?? '';
  if (stderr !== '') {
    console.error(`  AI analysis failed: ${stderr.slice(0, 200)}`);
  }
  return null;
}
```

**Issue:** `spawnSync` returns `{ status: null, signal: 'SIGTERM' }` when the subprocess is killed by a signal (timeout, SIGKILL, etc.). The check `result.status !== 0` evaluates to `true` when `status` is `null`, so the error path is taken — but the logic continues past line 447 to attempt parsing if `status` happens to be exactly `0` while the process was interrupted.

Actually, on closer inspection, `status !== 0` does catch `null` because `null !== 0` is `true`. However, the semantics are confusing and a more explicit check for success would be clearer:

```typescript
if (result.status !== 0 || result.signal !== null) {
```

**Impact:** Low probability edge case — if the process is killed exactly at timeout (60s), error handling proceeds correctly but error message may be misleading. The code does return `null` which is correct fallback behavior.

**Recommendation:** Add explicit signal check for clarity and robustness.

---

### MINOR-1: Multiple `as` type assertions violate project conventions

**File:** `packages/cli/src/utils/stack-detect.ts`
**Lines:** 107, 395, 405-407

Per project conventions (CLAUDE.md, review-context.md): "No `as` type assertions — use type guards or generics instead."

**Instances:**
1. Line 107: `pkg = JSON.parse(content) as PackageJson;`
2. Line 395: `const obj = parsed as Record<string, unknown>;`
3. Line 405: `for (const raw of obj['agents'] as unknown[]) {`
4. Line 407: `const a = raw as Record<string, unknown>;`

The assertions at lines 395 and 405-407 are within `parseAIAnalysisResponse()` which does validate structure before use, but the assertions themselves still violate the stated convention.

**Recommendation:** Create type guard functions:
```typescript
function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}
```

---

### MINOR-2: Unused import in init.ts

**File:** `packages/cli/src/commands/init.ts`
**Line:** 10

```typescript
import { detectStack, proposeAgents, analyzeWorkspace } from '../utils/stack-detect.js';
```

`proposeAgents` is imported but never called directly in this file. After refactoring, `handleStackDetection()` calls `analyzeWorkspace()` which internally uses `proposeAgents`. The import is dead code.

**Recommendation:** Remove `proposeAgents` from the import statement.

---

### MINOR-3: File length exceeds 200-line limit

**File:** `packages/cli/src/utils/workspace-signals.ts`
**Lines:** 298

Per review-context.md: "Services: max 200 lines." The file is a utility/service at 298 lines.

**Recommendation:** Consider splitting into:
- `workspace-signals.ts` — core signal collection (~150 lines)
- `presence-markers.ts` — marker detection logic (~80 lines)

Or document exception if current structure is intentional.

---

### MINOR-4: GitHub Actions marker has no agent mapping

**File:** `packages/cli/src/utils/stack-detect.ts`
**Lines:** 319-325 (markerToAgent array)

The `detectPresenceMarkers()` function (workspace-signals.ts:165-167) detects `infrastructure:github-actions`, but `proposeAgentsFromMarkers()` has no rule mapping this marker to an agent proposal.

```typescript
const markerToAgent = [
  { prefix: 'infrastructure:terraform', ... },
  { prefix: 'infrastructure:kubernetes', ... },
  { prefix: 'infrastructure:docker', ... },
  // No rule for 'infrastructure:github-actions'
];
```

**Impact:** Workspaces with GitHub Actions but no other infrastructure markers won't get a DevOps agent proposal via markers. AI analysis may still propose one.

**Recommendation:** Either add mapping for `github-actions` marker or document that it's intentionally excluded from marker-based proposals.

---

## Info

### INFO-1: Confidence default in parseAIAnalysisResponse

**File:** `packages/cli/src/utils/stack-detect.ts`
**Lines:** 409-411

```typescript
const confidence = typeof a['confidence'] === 'string' && validConfidences.has(a['confidence'])
  ? a['confidence'] as 'high' | 'medium' | 'low'
  : 'medium';
```

The code defaults to `'medium'` confidence when AI response has invalid/missing confidence. This is reasonable behavior — documented here for visibility.

---

### INFO-2: Empty reason string handling

**File:** `packages/cli/src/utils/stack-detect.ts`
**Lines:** 415, 482

`parseAIAnalysisResponse()` sets `reason: ''` for missing reason fields:
```typescript
reason: typeof a['reason'] === 'string' ? a['reason'] : '',
```

Then `mergeProposals()` checks:
```typescript
if (existing !== undefined && aiProposal.reason !== undefined) {
```

An empty string passes this check, potentially setting `existing.reason = ''`. This is harmless but may not be the intended behavior (overwriting existing reason with empty string).

---

## Verification Checklist

| Item | Status |
|------|--------|
| Business logic correct | PASS |
| No stubs/placeholders | PASS |
| Complete implementations | PASS |
| Edge cases handled | PARTIAL (signal handling) |
| Error handling present | PASS |
| Null/undefined safe | PASS |
| State management correct | PASS |

---

## Files Reviewed

- `packages/cli/src/utils/workspace-signals.ts` (298 lines)
- `packages/cli/src/utils/stack-detect.ts` (529 lines)
- `packages/cli/src/utils/agent-map.ts` (49 lines)
- `packages/cli/src/commands/init.ts` (521 lines)
