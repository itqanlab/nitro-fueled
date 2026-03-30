# Implementation Plan — TASK_2026_185

## Overview
Extract all health-related magic numbers into a shared `constants.ts` module, add a `context_overflow` health state that distinguishes workers at >= 100% context from those merely "high", and update all consumers to import from the new constants.

## Metadata

| Field | Value |
|-------|-------|
| Task | TASK_2026_185 |
| Type | REFACTORING |
| Complexity | Medium |
| Estimated Steps | 5 |

## Implementation Steps

### Step 1: Create `packages/mcp-cortex/src/constants.ts`
**File**: `packages/mcp-cortex/src/constants.ts`
**Action**: create
**Details**:
- Export `HEALTH_CONTEXT_HIGH_THRESHOLD = 80` (percent)
- Export `HEALTH_CONTEXT_OVERFLOW_THRESHOLD = 100` (percent)
- Export `HEALTH_COMPACTION_TRIGGER_COUNT = 2`
- Export `HEALTH_STUCK_TIMEOUT_MS = 120_000` (2 min)
- Export `HEALTH_STARTUP_GRACE_MS = 300_000` (5 min)
- Export `COMPACTION_DETECT_DROP_RATIO = 0.3` (30% drop → compaction)
- Move `CONTEXT_WINDOWS: Record<string, number>` map (with all model entries) from `token-calculator.ts:8-21`
- Move `DEFAULT_CONTEXT_WINDOW = 200_000` from `token-calculator.ts:24`

### Step 2: Add `context_overflow` to `HealthStatus` type union
**File**: `packages/mcp-cortex/src/db/schema.ts`
**Action**: modify (line 32)
**Details**:
- Change `HealthStatus` type from:
  ```ts
  'healthy' | 'starting' | 'high_context' | 'compacting' | 'stuck' | 'finished'
  ```
  to:
  ```ts
  'healthy' | 'starting' | 'high_context' | 'context_overflow' | 'compacting' | 'stuck' | 'finished'
  ```

### Step 3: Refactor `getHealth()` in workers.ts
**File**: `packages/mcp-cortex/src/tools/workers.ts`
**Action**: modify
**Details**:
- **Remove** local `STARTUP_GRACE_MS` constant on line 12
- **Add import** of `HEALTH_CONTEXT_HIGH_THRESHOLD`, `HEALTH_CONTEXT_OVERFLOW_THRESHOLD`, `HEALTH_COMPACTION_TRIGGER_COUNT`, `HEALTH_STUCK_TIMEOUT_MS`, `HEALTH_STARTUP_GRACE_MS` from `'../constants.js'`
- **Rewrite `getHealth()`** (lines 48-58) to:
  ```ts
  function getHealth(row: WorkerRow): HealthStatus {
    if (!row.pid || !isProcessAlive(row.pid)) return 'finished';
    if (row.compaction_count >= HEALTH_COMPACTION_TRIGGER_COUNT) return 'compacting';
    const tokens = parseTokens(row.tokens_json);
    if (tokens.context_percent >= HEALTH_CONTEXT_OVERFLOW_THRESHOLD) return 'context_overflow';
    if (tokens.context_percent > HEALTH_CONTEXT_HIGH_THRESHOLD) return 'high_context';
    const progress = parseProgress(row.progress_json);
    const spawnMs = new Date(row.spawn_time).getTime();
    if (progress.message_count === 0 && Date.now() - spawnMs < HEALTH_STARTUP_GRACE_MS) return 'starting';
    if (Date.now() - progress.last_action_at > HEALTH_STUCK_TIMEOUT_MS) return 'stuck';
    return 'healthy';
  }
  ```
- Key change: `context_overflow` check (`>= 100`) comes **before** `high_context` check (`> 80`), fixing the logic gap where 120%+ context was indistinguishable from 85%.

### Step 4: Refactor `token-calculator.ts` to import from constants
**File**: `packages/mcp-cortex/src/process/token-calculator.ts`
**Action**: modify
**Details**:
- **Add import**: `import { CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW } from '../constants.js';`
- **Re-export** them so any existing imports from this module continue to work:
  ```ts
  export { CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW } from '../constants.js';
  ```
- **Remove** the local `CONTEXT_WINDOWS` map (lines 8-21) and `DEFAULT_CONTEXT_WINDOW` (line 24)
- **Remove** the associated JSDoc comments for those removed declarations
- Keep everything else unchanged (`PRICING`, `calculateCost`, etc.)

### Step 5: Refactor `jsonl-watcher.ts` to import from constants
**File**: `packages/mcp-cortex/src/process/jsonl-watcher.ts`
**Action**: modify
**Details**:
- **Replace line 4 import**:
  ```ts
  // OLD:
  import { CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW } from './token-calculator.js';
  // NEW:
  import { CONTEXT_WINDOWS, DEFAULT_CONTEXT_WINDOW, COMPACTION_DETECT_DROP_RATIO } from '../constants.js';
  ```
- **Line 200** — replace hardcoded `0.3` with `COMPACTION_DETECT_DROP_RATIO`:
  ```ts
  // OLD:
  if (acc.lastInputTokens > 0 && inputTokens < acc.lastInputTokens * 0.3) {
  // NEW:
  if (acc.lastInputTokens > 0 && inputTokens < acc.lastInputTokens * COMPACTION_DETECT_DROP_RATIO) {
  ```
- **Line 250** — same replacement in the opencode format handler:
  ```ts
  // OLD:
  if (acc.lastInputTokens > 0 && totalInput < acc.lastInputTokens * 0.3) {
  // NEW:
  if (acc.lastInputTokens > 0 && totalInput < acc.lastInputTokens * COMPACTION_DETECT_DROP_RATIO) {
  ```

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Circular import between constants.ts and other modules | None | constants.ts has zero imports — it is a leaf module |
| Existing imports of `CONTEXT_WINDOWS` from `token-calculator.ts` break | Low | Step 4 re-exports from constants so existing import paths still work |
| `context_overflow` not handled by downstream dashboard/consumers | Low | This is a type union change only; any `switch`/`if` chains that don't handle it will simply not match and fall to default — no runtime breakage. A future task can add dashboard support. |
| Re-export vs direct import confusion | Low | Both paths resolve to the same constant from constants.ts — no behavioral difference |

## Testing Approach

Testing is **optional** per task metadata. Verification via build check:

```bash
cd packages/mcp-cortex && npm run build
```

Manual validation (if desired):
1. Spawn a worker with a high-token prompt and verify `getHealth` returns `context_overflow` at >= 100% context
2. Verify workers at 80-99% still report `high_context`
3. Verify workers at < 80% report `healthy` (absent other conditions)

## Verification
- [ ] `npm run build` passes with no TypeScript errors
- [ ] `packages/mcp-cortex/src/constants.ts` exists and exports all 7 thresholds + CONTEXT_WINDOWS + DEFAULT_CONTEXT_WINDOW
- [ ] `HealthStatus` type includes `context_overflow`
- [ ] Workers at >= 100% context report `context_overflow`, not `high_context`
- [ ] No magic numbers remain in `getHealth()` (80, 100, 2, 120_000, 300_000 all replaced)
- [ ] No magic numbers remain in compaction detection (`0.3` replaced in both locations)
- [ ] `token-calculator.ts` re-exports `CONTEXT_WINDOWS` and `DEFAULT_CONTEXT_WINDOW` from constants
- [ ] `jsonl-watcher.ts` imports `COMPACTION_DETECT_DROP_RATIO`, `CONTEXT_WINDOWS`, `DEFAULT_CONTEXT_WINDOW` from constants
