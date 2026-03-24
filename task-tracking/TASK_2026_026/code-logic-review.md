# Code Logic Review — TASK_2026_026

## Summary

The implementation adds per-worker cost tracking to the supervisor skill specification (SKILL.md). The cost flow is: fetch via `get_worker_stats` at completion (Step 7a) or kill (Step 6), record in `orchestrator-state.md` tables, accumulate into Session Cost section, and propagate to `orchestrator-history.md` at session stop (Step 8b). The changes are well-structured and cover the primary happy paths. However, there are gaps around Cleanup Worker cost tracking, a missing acceptance criterion (worker log files), inconsistencies in the Session Cost template vs token breakdown fetched, and an ambiguous cost extraction mechanism from `kill_worker` responses.

## Findings

### [MAJOR] Acceptance criterion "Worker log files include final token count and cost" is not addressed

- **Location**: task.md acceptance criterion 5; SKILL.md has no mention of worker log files
- **Description**: The task.md explicitly requires: "Worker log files include final token count and cost." The diff adds no instructions for writing cost/token data to any worker log file. The SKILL.md does not appear to have a concept of per-worker log files at all — cost data goes to `orchestrator-state.md` tables and Session Log entries, but not to dedicated log files. Either the acceptance criterion is stale (and should be removed/updated), or the implementation missed it entirely.
- **Recommendation**: Clarify whether "worker log files" refers to the Session Log entries (in which case the `COST` log event satisfies this) or to separate per-worker files. If the former, update the acceptance criterion wording. If the latter, add instructions for writing a per-worker cost summary to the task folder (e.g., `task-tracking/TASK_YYYY_NNN/worker-cost-log.md`).

### [MAJOR] Cleanup Worker cost is never fetched or recorded

- **Location**: Worker Recovery Protocol (lines 455-466), history template (line 500)
- **Description**: The `orchestrator-history.md` template shows a Cleanup Worker row with `$X.XX` cost. However, the Worker Recovery Protocol has zero instructions to call `get_worker_stats` for the Cleanup Worker after it finishes, or to record its cost anywhere. Cleanup Workers are spawned, waited on, and then the supervisor proceeds — but their cost is silently lost. This contradicts Key Principle 13: "Track cost at every exit."
- **Recommendation**: Add an explicit instruction after "Wait for the Cleanup Worker to finish" in the Worker Recovery Protocol: call `get_worker_stats` on the Cleanup Worker, record its cost in the Session Cost accumulator, and store it for inclusion in the history's Workers Spawned table.

### [MINOR] `kill_worker` cost extraction references undocumented response format

- **Location**: Step 6, two-strike stuck detection (line 380)
- **Description**: The instruction says: `extract the "Final cost: $X.XX" from the kill response`. But the MCP Tool Signatures section (line 907) shows `kill_worker` returns `{ success: boolean, final_stats: {...} }`. The spec tells the supervisor to look for a string pattern `"Final cost: $X.XX"` rather than referencing the structured `final_stats` object. This is ambiguous — is `Final cost` a string in the response body, or should the supervisor read `final_stats.cost.total_usd`? If the MCP server changes the string format, this instruction silently breaks.
- **Recommendation**: Change to: "extract `final_stats.cost.total_usd` from the kill response" for consistency with the structured approach used everywhere else.

### [MINOR] Session Cost template omits cache tokens despite Step 7a extracting them

- **Location**: Session Cost section template (lines 843-848) vs Step 7a token extraction (lines 399)
- **Description**: Step 7a instructs the supervisor to extract `tokens.total_cache_creation` and `tokens.total_cache_read` from `get_worker_stats`. The `COST` session log event includes `cache: Xk`. But the Session Cost summary table in the `orchestrator-state.md` template only has `Total Input Tokens` and `Total Output Tokens` — no cache token rows. The fetched cache data has nowhere to be accumulated at the session level.
- **Recommendation**: Either add `Total Cache Tokens` (or separate creation/read rows) to the Session Cost table template, or remove the cache token extraction from Step 7a if session-level cache aggregation is not needed. The per-worker COST log event still captures it, but the summary table is incomplete.

### [MINOR] Reconciliation path (Step 1) may lose cost for vanished workers

- **Location**: Step 1, reconcile state vs MCP (line 189)
- **Description**: When a worker is "in state but NOT in MCP list", it is treated as finished and routed to Step 7 (completion handler). Step 7a calls `get_worker_stats`, which will fail because the worker no longer exists in MCP. The fallback reads cost from the Active Workers table. But if the worker vanished before any `get_worker_stats` escalation occurred during monitoring (e.g., the worker was only checked via `get_worker_activity` and finished quickly), the Active Workers Cost column will be empty/never-populated. The `$?.??` fallback handles this, but for short-lived workers that finish within 1-2 monitoring intervals without escalation, cost will always be unknown.
- **Recommendation**: This is an inherent limitation of the context-efficiency rule (don't call `get_worker_stats` on every check). Consider adding: "When a worker is discovered missing during reconciliation with no recorded cost, attempt `get_worker_stats` once before falling back to `$?.??`." The worker may still be in MCP's completed records even if not in the active list. Alternatively, document this as a known limitation.

### [NOTE] `get_worker_activity` returns `summary: string` — does it ever mention "finished"?

- **Location**: Step 6a-6b, MCP Tool Signatures (line 902)
- **Description**: The escalation logic in Step 6b says to escalate if "activity summary mentions issues (stuck, error, failed, no progress)." For the completion flow to work, `get_worker_activity` must somehow signal that a worker has finished so that the supervisor escalates to `get_worker_stats` and discovers `health: finished`. But neither the activity summary format nor "finished" is listed as an escalation trigger keyword. If `get_worker_activity` for a finished worker returns something like "Worker completed successfully" without the word "finished", the supervisor might not escalate and would miss the completion until the 3-interval forced escalation kicks in.
- **Recommendation**: Add "finished" or "completed" to the escalation keyword list in Step 6b, or document that the 3-interval forced escalation is the expected path for detecting completion.

### [NOTE] Session Cost accumulator not initialized on fresh start

- **Location**: orchestrator-state.md template (lines 841-850), Step 1 (lines 198-201)
- **Description**: The fresh-start path (Step 1 "ELSE") says "Initialize fresh state with default or overridden configuration." The Session Cost section is shown in the template but not explicitly mentioned in the initialization instructions. An LLM supervisor would likely include it based on the template, but it is not called out the way Configuration is.
- **Recommendation**: Minor, but for completeness, add "Initialize Session Cost section with all zeroes" to the fresh-start initialization in Step 1.

### [NOTE] Step references are correct after renumbering

- **Location**: Steps 7a through 7h
- **Description**: The renumbering from the old 7a-7g to the new 7a-7h (with cost fetch inserted as new 7a) is internally consistent. All cross-references checked (Step 7 references from Step 1, Step 6, Step 8) point to the correct step. No broken references found.
- **Recommendation**: None — this is clean.

## Acceptance Criteria Check

- [x] Supervisor reads cost from `get_worker_stats` when worker completes or is killed
  - Step 7a covers completion. Step 6 two-strike covers kill. Both extract cost.
- [x] `orchestrator-state.md` Completed Tasks table includes cost per worker
  - Template updated with Cost and Total Tokens columns. Steps 7e explicitly says "include cost in Completed Tasks table."
- [x] `orchestrator-history.md` Workers Spawned table includes Cost column with real values
  - Step 8b template includes Cost column. Step 8b.3 says to populate from state tables.
- [x] `orchestrator-history.md` includes `**Total Cost**: $X.XX` with real value
  - Step 8b template includes it. Step 8b.3 says to pull from Session Cost section.
- [ ] Worker log files include final token count and cost
  - **NOT ADDRESSED.** No instructions added for writing cost to worker log files. See MAJOR finding above.
- [x] Total session cost is calculated and displayed at supervisor stop
  - Loop stopped log event includes `total cost: $X.XX`. Session Cost section accumulates. Step 8b propagates to history.

## Verdict

**PASS WITH NOTES**

The core cost tracking flow (fetch -> record -> accumulate -> report) is solid and covers the main paths. The step renumbering is clean, the fallback for unavailable stats is reasonable, and the history propagation is well-specified. However:

1. One acceptance criterion (worker log files) appears unaddressed — this needs clarification on whether it was intentionally descoped or missed.
2. Cleanup Worker cost is a real gap that will cause undercounting of session totals.
3. The `kill_worker` cost extraction should reference the structured response rather than a string pattern.

None of these are blocking for the spec to be usable by an LLM supervisor, but items 1 and 2 should be resolved before considering this task COMPLETE.
