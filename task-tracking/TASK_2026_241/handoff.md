# Handoff — TASK_2026_241

## Files Changed
- `.claude/skills/auto-pilot/references/parallel-mode.md` (modified, +62 -2)
- `.claude/skills/auto-pilot/SKILL.md` (modified, +4 -2)

## Commits
- 8dc2acd: docs(auto-pilot): add supervisor worker-exit reconciliation protocol for TASK_2026_241

## Decisions
- Reconciliation subsection inserted after Step 7 items 1–4 (event-driven path intact), not between them; reconciliation is a fallback branch for the event-missing case.
- RECONCILE_OK path emits a log event and continues as if the completion event was received — no retry needed.
- Build/Implement Worker uses `handoff.md` presence as the heuristic for auto-advancing to IMPLEMENTED; Prep and Review/Fix workers always FAIL on discrepancy (no safe heuristic).
- Duplicate spawn guard lives in the Step 7 subsection with a forward-reference sentence at Step 5 item 6; the guard checks `running` workers only — `stopped`/`exited` workers route to reconciliation, not skip.
- Hard Constraints section of `parallel-mode.md` left untouched; reconciliation uses only already-permitted MCP tools (`get_task_context`, `update_task`, `release_task`).

## Known Risks
- The `handoff.md` heuristic is probabilistic: a Build Worker that wrote `handoff.md` but failed mid-commit may leave a partially-committed state. The Review Worker will catch incomplete implementation.
- The reconciliation subsection is under the Step 7 preferred-path heading but is separated from the numbered items (1–4) by a `###` heading, which may cause a reader to miss the flow continuation at item 5. The NOTE about NEVER calling `get_tasks` now appears after the subsection, which is correct.
