# Prep Handoff — TASK_2026_241

## Implementation Plan Summary

Doc-only changes to the auto-pilot Supervisor skill. The fix adds a supervisor-side reconciliation protocol that activates when a worker exits without emitting a `TASK_STATE_CHANGE` event. The Supervisor independently checks the actual DB task state, compares it to the expected post-exit state for that worker type, and either auto-advances (if handoff artifact exists for build workers) or marks FAILED. A duplicate spawn guard is also added to Step 5 to prevent the false-retry pattern. Two files change: `parallel-mode.md` (Step 7 protocol + Step 5 cross-reference) and `SKILL.md` (Key Principles + Core Loop step summary).

## Files to Touch

| File | Action | Why |
|------|--------|-----|
| `.claude/skills/auto-pilot/references/parallel-mode.md` | modify | Add `Worker-Exit Reconciliation` subsection to Step 7 preferred path; add duplicate spawn guard; add Step 5 forward-reference; add RECONCILE_DISCREPANCY event schema |
| `.claude/skills/auto-pilot/SKILL.md` | modify | Add Key Principle 14 (Supervisor authoritative for state on worker exit); update Core Loop Step 7 one-liner summary |

## Batches

- **Batch 1**: Reconciliation protocol in `parallel-mode.md` — tasks 1.1 and 1.2 — files: `.claude/skills/auto-pilot/references/parallel-mode.md`
- **Batch 2**: SKILL.md updates — tasks 2.1 and 2.2 — files: `.claude/skills/auto-pilot/SKILL.md`

Both batches are independent (separate files). Can run sequentially or in either order.

## Key Decisions

- **Supervisor-side reconciliation, not worker-side**: Workers are untrusted on abnormal exit. The Supervisor uses `get_task_context()` + `list_workers()` — tools it already calls — to detect and resolve stale state. No new MCP tools needed.
- **handoff.md heuristic for Build/Implement workers**: If `handoff.md` is present, auto-advance to IMPLEMENTED (worker likely committed but missed the status update). If absent, mark FAILED. This is a heuristic — the Review Worker will catch any incomplete implementation.
- **Prep and Review/Fix workers always mark FAILED on missing transition**: No partial output heuristic; retry is always safe for these worker types.
- **Duplicate spawn guard lives in Step 5 with a cross-reference to Step 7**: The check is a pre-spawn guard (`list_workers` for running worker with same task_id), not a post-spawn rollback.
- **Event schema uses a flat JSON block**: Consistent with existing cortex event logging pattern documented elsewhere in the skill.

## Gotchas

- `parallel-mode.md` Step 7 currently has two paths (preferred and fallback). The new reconciliation sub-protocol applies to the **preferred path only** (`cortex_available = true`). The fallback path uses file-based status reads — the fallback already handles stale state differently (it polls `status` files). Do not add reconciliation to the fallback section.
- The Step 7 preferred path items 2–4 are currently numbered and reference each other. Insert the reconciliation subsection **after** the existing items 2–4, not between them — the existing event-driven path stays intact, the reconciliation is a fallback branch.
- In the duplicate spawn guard, the check is scoped to `running` workers only (not `stopped`/`exited`). A stopped worker with the same task_id is the exact scenario that triggers reconciliation — don't skip the reconciliation by treating the stopped worker as "still active."
- The SKILL.md Core Loop section references `parallel-mode.md` for the full 8-step details. The one-liner summary in SKILL.md is informational — keep it concise (one sentence, not a full protocol description).
- Do not change the Hard Constraints section of `parallel-mode.md` — reconciliation uses only MCP tools (`get_task_context`, `update_task`, `release_task`) that are already permitted.
