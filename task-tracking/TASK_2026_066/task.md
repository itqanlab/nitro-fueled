# Task: Worker Compaction Circuit Breaker

## Metadata

| Field      | Value    |
|------------|----------|
| Type       | BUGFIX   |
| Priority   | P1-High  |
| Complexity | Simple   |
| Model      | default  |
| Testing    | skip     |

## Description

The Supervisor currently treats all worker compactions as completely normal — health state `compacting` triggers a log entry and nothing else. There is no counter, no warning threshold, and no kill mechanism triggered by excessive compaction. A worker that compacts 15 times keeps running indefinitely, burning tokens on every cycle.

This is the confirmed root cause of the $8–9 cost spike on Simple tasks: TASK_2026_052 (manifest.ts, ~3 files) triggered 2 compactions and cost $8.46 against an expected <$2. A worker compacting that many times on a simple task is almost certainly stuck in a loop or loading massive context repeatedly — not making useful progress.

The fix adds a per-worker `compaction_count` tracked in state.md, two thresholds (warn at 3, kill at 6), and mirrors the existing two-strike stuck detection pattern. Additionally, the 2-compaction limit on the Supervisor itself is incorrect and should be removed — the Supervisor only monitors and recovers cleanly from state.md, so it should compact freely without an artificial stop.

### Changes Required

1. **Active Workers table in state.md** — add `Compaction Count` column (integer, default 0).

2. **Step 6c health state handling** — update the `compacting` row:
   - Increment `compaction_count` for this worker in state.md.
   - **At 3**: log `COMPACTION WARNING — TASK_X: compacted 3 times, task may be oversized`
   - **At 6**: treat exactly like a two-strike stuck worker — log `COMPACTION LIMIT — TASK_X: compacted 6 times, killing`, call `kill_worker`, trigger Worker Recovery Protocol (Cleanup Worker → respawn). Increment `retry_count`.

3. **Step 7h worker-log** — add `Compaction Count: N` field to the Metadata table.

4. **Supervisor compaction limit** — remove the note: *"The supervisor session should compact at most 2 times. If the session has already compacted twice and context is still growing, gracefully stop the loop..."* The Supervisor recovers from state.md cleanly and should not stop itself due to compactions.

5. **Log event entries** — add two new log row formats:
   - `| {HH:MM:SS} | auto-pilot | COMPACTION WARNING — TASK_X: compacted {N} times |`
   - `| {HH:MM:SS} | auto-pilot | COMPACTION LIMIT — TASK_X: compacted {N} times, killing |`

## Dependencies

- None

## Parallelism

🚫 Do NOT run in parallel with TASK_2026_060 — both modify `.claude/skills/auto-pilot/SKILL.md`
🚫 Do NOT run in parallel with TASK_2026_064 — both modify `.claude/skills/auto-pilot/SKILL.md`
🚫 Do NOT run in parallel with TASK_2026_065 — both modify `.claude/skills/auto-pilot/SKILL.md`

Suggested execution wave: after TASK_2026_060, TASK_2026_064, and TASK_2026_065 complete.

## Acceptance Criteria

- [ ] `compaction_count` column exists in Active Workers table in state.md, starting at 0
- [ ] Every monitoring interval where health=`compacting` is observed increments `compaction_count` for that worker
- [ ] At 3 compactions: `COMPACTION WARNING` log entry written, no kill
- [ ] At 6 compactions: worker is killed, Cleanup Worker triggered, task queued for respawn (same as two-strike stuck handling)
- [ ] Worker-log Metadata table includes `Compaction Count: N`
- [ ] Supervisor 2-compaction limit removed — Supervisor no longer stops itself due to compaction count
- [ ] Existing stuck detection behavior is unchanged

## References

- `.claude/skills/auto-pilot/SKILL.md` — line 566 (compacting health state), line 145 (supervisor compaction limit), Step 6c, Step 7h, state.md format
- Memory: `project_build_worker_cost_spike.md` — documents $8.46 Simple task cost spike

## File Scope

- `.claude/skills/auto-pilot/SKILL.md` — Step 6c compaction handling, Step 7h worker-log metadata, state.md format spec, remove supervisor compaction limit
