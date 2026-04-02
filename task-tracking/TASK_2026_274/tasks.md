# TASK_2026_274 — Task Batch

## Batch: preferred_tier Routing Enforcement
**Status**: IN PROGRESS - Assigned to nitro-systems-developer
**Session**: SESSION_2026-03-31T16-14-56

---

## Sub-Tasks

### Task 1: Auto-derive preferred_tier in nitro-create-task.md
**Status**: COMPLETE
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/nitro-create-task.md`
**Changes**:
- Added Step 3d: Auto-derive preferred_tier between Step 3c (sizing validation) and Step 4 (create folder)
- Derives preferred_tier from complexity: Simple → light, Medium → balanced, Complex → heavy
- Updated Step 5 note to explicitly require Preferred Tier reflect derived value, not `auto`

---

### Task 2: Add preferred_tier hard-routing (5a/5b) in parallel-mode.md
**Status**: COMPLETE
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Changes**:
- Replaced Step 5 "Resolve provider/model" block with new 5a/5b structure
- Step 5a: hard-routes on preferred_tier (light/balanced/heavy), applies to ALL worker types
- Step 5a: blocks task with TIER_UNAVAILABLE log if tier provider is unavailable — no silent fallback
- Step 5b: preserves all prior worker-type defaults verbatim, applies only when preferred_tier is `auto` or absent

---

### Task 3: Update Key Principle #11 in SKILL.md
**Status**: COMPLETE
**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Changes**:
- Appended preferred_tier hard-routing note to end of Key Principle #11
- States: if preferred_tier=light|balanced|heavy, use that tier's model for ALL workers; no silent fallback; block and log TIER_UNAVAILABLE if tier unavailable
