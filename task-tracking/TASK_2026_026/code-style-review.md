# Code Style Review — TASK_2026_026

## Summary

This task adds per-worker cost tracking to the supervisor skill specification (SKILL.md). The changes are well-scoped: new Session Cost section in state file, cost columns in tables, cost logging in session events, and a new `starting` health state. The specification is functional and mostly consistent, but I found several inconsistencies in the example data, a terminology mismatch between log format definitions and example usage, and a missing `starting` health state log entry in the Session Log event table.

## Findings

### [MAJOR] Session Log example does not match updated log format for REVIEW DONE
- **File**: `.claude/skills/auto-pilot/SKILL.md:862`
- **Description**: Line 100 defines `REVIEW DONE` format as `REVIEW DONE — TASK_X: COMPLETE ($X.XX)` (with cost). However, the example Session Log at line 862 shows `REVIEW DONE — TASK_2026_004: COMPLETE` without the `($X.XX)` cost. The example data should demonstrate the new format so agents parsing this spec produce the correct output.
- **Recommendation**: Update line 862 to `REVIEW DONE — TASK_2026_004: COMPLETE ($0.45)` (or an appropriate example cost value).

### [MAJOR] Session Log example missing COST event entries
- **File**: `.claude/skills/auto-pilot/SKILL.md:853-868`
- **Description**: The new `Cost recorded` and `Cost unknown` events (lines 115-116) are never demonstrated in the example Session Log block. The example shows a complete worker lifecycle (spawn, health check, state transition, review done, stuck, kill, retry, replace) but omits cost events entirely. Since this is a specification that agents follow by example, the absence of cost events in the example weakens the instruction.
- **Recommendation**: Add at least one `COST — TASK_X: $X.XX (input: Xk, output: Xk, cache: Xk)` entry to the example Session Log, placed logically after the `STATE TRANSITIONED` or `REVIEW DONE` lines.

### [MINOR] Session Cost table missing cache token metrics
- **File**: `.claude/skills/auto-pilot/SKILL.md:843-848`
- **Description**: The Session Cost table tracks `Total Input Tokens` and `Total Output Tokens` but omits cache tokens. Meanwhile, Step 7a (line 399) explicitly extracts `tokens.total_cache_creation` and `tokens.total_cache_read`, and the `Cost recorded` log event (line 115) includes `cache: Xk`. The token data is collected but has no home in the Session Cost summary table.
- **Recommendation**: Either add `Total Cache Tokens` (or split into creation/read) to the Session Cost table, or document that cache tokens are only logged per-event and not accumulated in the summary. Consistency matters -- if you extract it, store it somewhere.

### [MINOR] `kill_worker` response format inconsistency: "Final cost: $X.XX" vs structured data
- **File**: `.claude/skills/auto-pilot/SKILL.md:380`
- **Description**: Line 380 says to `extract the "Final cost: $X.XX" from the kill response`, implying a string format. But the MCP signature at line 907-908 shows `kill_worker` returns `{ success: boolean, final_stats: {...} }` -- a structured object, not a formatted string. An agent following the spec literally would look for a string `"Final cost: $X.XX"` in the response and fail to find it.
- **Recommendation**: Change to `extract cost from the kill response's final_stats object` or similar phrasing that matches the structured return type.

### [MINOR] Build done log format says "spawning" but Step 7e says "queuing"
- **File**: `.claude/skills/auto-pilot/SKILL.md:100 vs 422`
- **Description**: The Session Log format table at line 100 defines: `BUILD DONE — TASK_X: IMPLEMENTED ($X.XX), spawning Review Worker`. But Step 7e at line 422 says: `"BUILD DONE — TASK_X: IMPLEMENTED ($X.XX), queuing Review Worker"`. These are semantically different -- "spawning" implies immediate action, "queuing" implies deferred. The actual behavior (per Step 7e bullet 3: "Task will be picked up as READY_FOR_REVIEW on next loop iteration") is queuing, not spawning.
- **Recommendation**: Align both to say "queuing Review Worker" since the Review Worker is not spawned immediately but picked up on the next iteration in Step 3.

### [MINOR] Session Cost note mentions "active" workers but no mechanism to update active costs into total
- **File**: `.claude/skills/auto-pilot/SKILL.md:850`
- **Description**: The note says `"The Total Cost is the sum of all worker costs (completed + failed + active)."` But the Session Cost section is only described as being updated at worker completion (Step 7a) and monitoring escalation (Step 6b, line 878). There is no explicit instruction to recalculate the total including active worker snapshot costs when writing Session Cost. An agent might only sum completed + failed costs and ignore active snapshots.
- **Recommendation**: Add an explicit instruction in the Session Cost update logic (Step 6e or 7a) specifying: "When updating Session Cost Total, sum costs from Completed Tasks + Failed Tasks + current Active Workers Cost column."

### [NOTE] `$?.??` sentinel value for unknown cost is unconventional
- **File**: `.claude/skills/auto-pilot/SKILL.md:403`
- **Description**: Using `$?.??` as a sentinel for unknown cost is creative but unusual. Question marks in a dollar-formatted field could confuse parsers or agents that expect numeric values. Consider whether `N/A` or `unknown` would be clearer, or at minimum document this as a sentinel value explicitly.
- **Recommendation**: This is a design choice, not a defect. Just flagging it as something a new contributor might misread. The carry-through instruction at line 513 handles it well.

### [NOTE] No `starting` health state log entry defined in Session Log event table
- **File**: `.claude/skills/auto-pilot/SKILL.md:88-123`
- **Description**: The health state handling table at line 363 defines what to log for `starting` state: `"TASK_X worker starting up (no messages yet)"`. But the Session Log event table (lines 88-123) has no corresponding row for a "Worker starting" event. Every other health state has a corresponding Session Log format row (healthy at line 92, high_context at line 93, compacting at line 94, stuck at lines 95-96). The `starting` state is the only one without a defined log format.
- **Recommendation**: Add a row: `| Worker starting | [HH:MM:SS] HEALTH CHECK — TASK_X: starting (no messages yet) |`

## Verdict

**PASS WITH NOTES**

The specification changes are comprehensive and well-integrated into the existing document structure. The cost tracking flow (collect at completion via Step 7a, snapshot during monitoring via Step 6b, fallback to last-known, sentinel for unknown) is sound. The two MAJOR findings are about the example data not reflecting the updated log formats, which matters because agents implementing this spec rely heavily on examples. The MINOR findings are terminology inconsistencies that could cause agent confusion. None are blocking for the specification's core intent.
