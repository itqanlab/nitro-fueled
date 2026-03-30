# Handoff — TASK_2026_135

## Files Changed
- .claude/skills/auto-pilot/references/parallel-mode.md (modified, +160 -56 approx)

## Commits
- (pending — will be committed by orchestrator)

## Decisions
- All 5 changes made to a single file (parallel-mode.md), no other files touched
- Step 2 caching: "startup mode" vs "cached mode" pattern with explicit refresh triggers (--reprioritize or new task folder detected)
- Step 3b: replaced unconditional plan.md read with startup-cache + REPRIORITIZE refresh trigger
- Status Map: written to state.md under `## Cached Status Map` after startup reads; updated incrementally in Step 7f
- Step 7f: "Go back to Step 2" replaced with targeted one-level downstream check + "Go to Step 4"
- Cache Invalidation Rules: new dedicated section documents all 3 caches with invalidation conditions and compaction recovery behavior

## Known Risks
- The "one-level downstream check" in Step 7f (task 1.4) handles direct dependents only; transitive unblocking is handled naturally by cascading completions. This is by design, but reviewers should verify this is clear in the text.
- Plan Guidance REPRIORITIZE anti-loop guard: if re-read still returns REPRIORITIZE, treat as PROCEED to avoid infinite re-read loop — reviewers should verify this guard is correctly placed.
- Status Map consistency with BLOCKED writes: when dependency validation writes BLOCKED, it must also update the Cached Status Map row. Verify this is mentioned correctly in Change 3.
