# Code Logic Review - TASK_2026_060

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 5/10                                 |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 2                                    |
| Serious Issues      | 4                                    |
| Moderate Issues     | 3                                    |
| Failure Modes Found | 9                                    |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The "unknown" worker status is set in the Active Workers table but Step 6 (Monitor Active Workers) has no branch for it. When the supervisor re-enters the monitoring loop after setting workers to "unknown", it calls `get_worker_activity(worker_id)` for each active worker in state. Those worker IDs may not exist in MCP after a restart, so the MCP call will either fail or return a non-existent worker response. The skill has no instruction for how Step 6 handles a worker whose status is "unknown" — it silently falls through to normal health-state handling, potentially producing an MCP error that is logged and discarded, and leaving the unknown workers spinning forever without ever incrementing `mcp_empty_count` a second time.

### 2. What user action causes unexpected behavior?

If a human operator manually spawns a worker (for diagnostics) between the first and second empty `list_workers` checks, MCP will return a non-empty list on the second check. The reconciliation logic's third bullet (non-empty list, specific worker missing) then fires and triggers the completion handler for the still-"unknown" workers — treating a manual human worker appearing as proof that the supervisor's workers genuinely finished. This misidentification escalates a non-event into spurious completion triggers.

### 3. What data makes this produce wrong results?

A state.md that already has `mcp_empty_count = 1` from a PREVIOUS compaction recovery cycle (i.e., from an earlier session that ended mid-grace-period and was serialized to disk) will start the new session one count away from triggering Worker Recovery Protocol on the very first empty response. The spec says `mcp_empty_count` resets to 0 when workers reappear, but it does NOT say the field resets to 0 at the start of a fresh recovery after compaction, nor does it specify that `mcp_empty_count` is reset when a new session bootstraps from state.md. This is an off-by-one waiting to declare a false MCP restart failure on session resume.

### 4. What happens when dependencies fail?

If the file-system evidence checks themselves fail (e.g., registry.md is locked/missing, task folder is unreadable mid-check) there is no fallback defined. The current logic assumes evidence checks either return "found" or "not found." A file-read error collapses both outcomes: the supervisor cannot distinguish "no evidence because worker didn't finish" from "no evidence because the file is temporarily unreadable." With no error path defined, the behavior defaults to whichever code path the AI follows — most likely treating read errors as "no evidence found," thereby triggering the MCP RESTART SUSPECTED path and delaying correct completion handling.

### 5. What's missing that the requirements didn't mention?

The spec does not address what happens when MCP returns empty AND Step 4's registry reconciliation (Case 1 through Case 6) runs simultaneously. Step 4 runs unconditionally after Step 1 for ALL active workers. A worker with a status file showing IMPLEMENTED (Case 4: "Build Worker succeeded, queue Review Worker") will be processed by Step 4 AND the new Step 1 completion-handler logic. This creates a double-handling risk: Step 1 triggers the completion handler, and Step 4 also queues a review worker for the same task. Two simultaneous code paths for the same task will collide.

---

## Failure Mode Analysis

### Failure Mode 1: "Unknown" Status Workers Are Invisible to Step 6

- **Trigger**: MCP returns empty on check 1. Workers are set to status "unknown". Supervisor continues to loop. On next iteration, Step 6 calls `get_worker_activity(worker_id)` for each active worker.
- **Symptoms**: MCP call for a non-existent worker ID returns error or empty. Step 6 has no "unknown" health state in its handling table. The supervisor either throws an unhandled MCP error or defaults to no action.
- **Impact**: `mcp_empty_count` is NEVER incremented on the second check because the increment logic lives in Step 1's reconcile branch, which only runs once at session startup or on compaction recovery — not on every loop iteration. The 2-check grace period described in the spec cannot function because Step 1 is not re-executed each loop.
- **Current Handling**: None. Step 6 health-state table has: healthy, high_context, compacting, stuck, finished. "Unknown" is absent.
- **Recommendation**: Either re-execute the reconciliation in Step 6 when workers are in "unknown" state (call `list_workers` again and re-run the three-branch check), OR add an "unknown" row to Step 6's health table that re-calls `list_workers` and re-runs the MCP empty logic.

### Failure Mode 2: Double-Handling When Step 4 and Step 1 Both Process the Same Worker

- **Trigger**: MCP returns empty. Worker has file-system evidence (e.g., registry shows IMPLEMENTED). Step 1 triggers the completion handler. Step 4 (reconcile state vs registry) then also runs the same loop — Case 4 says "IMPLEMENTED (status file), worker NOT in MCP: Build Worker succeeded, queue Review Worker."
- **Symptoms**: Completion handler is triggered twice for the same worker. A Review Worker is spawned by Step 1's completion handler AND another is queued by Step 4. Duplicate workers run on the same task. This mirrors the dual-trigger bug guarded by the "evaluation complete" marker in Step 7's combined ReviewLead+TestLead logic — but no equivalent guard exists here.
- **Impact**: Duplicate worker spawns cause duplicate review artifacts, duplicate state transitions, and potential registry corruption.
- **Current Handling**: No guard. Step 4 cases 1-6 run unconditionally. The skill does not state that Step 4 should skip workers already handled by Step 1's completion trigger in the same loop pass.
- **Recommendation**: After Step 1 triggers the completion handler for any worker, mark that worker as "processed this pass" so Step 4 skips it. Alternatively, explicitly state that Step 4 only runs for workers NOT already handled by Step 1.

### Failure Mode 3: Stale `mcp_empty_count` from Prior Session Compaction

- **Trigger**: Session saves state.md with `mcp_empty_count = 1` after one grace-period check. Claude compacts and restores from state.md. On the very first `list_workers` call of the recovered session, MCP still returns empty.
- **Symptoms**: `mcp_empty_count` is incremented to 2 immediately. The spec says "if mcp_empty_count reaches 2 AND still no file-system evidence, treat as failed and trigger Worker Recovery Protocol." The supervisor triggers Worker Recovery Protocol on the very first empty response of the recovered session — skipping the full 2-check grace period.
- **Impact**: Premature Worker Recovery Protocol launch. Cleanup Workers spawned unnecessarily for workers that may still be running. Valid running workers are declared failed.
- **Current Handling**: The spec states reset to 0 when workers reappear or file-system evidence is found. It does NOT state reset to 0 on session recovery bootstrap.
- **Recommendation**: Add explicit rule: "On compaction recovery bootstrap, reset `mcp_empty_count` to 0 before running reconciliation." OR define `mcp_empty_count` as a purely transient counter that is never persisted across compaction boundaries (i.e., always initialize to 0 when reading state.md during bootstrap).

### Failure Mode 4: "Unknown" Status Survives into Step 3 Dependency Graph

- **Trigger**: Workers are left in "unknown" status. The supervisor loops. Step 3 builds a dependency graph. Worker status "unknown" is not in the classification table (READY_FOR_BUILD, BUILDING, READY_FOR_REVIEW, REVIEWING, FIXING, BLOCKED, COMPLETE, CANCELLED).
- **Symptoms**: Tasks associated with "unknown" workers fall through the dependency graph classification with no defined behavior. They may be classified as READY_FOR_BUILD (status doesn't match any "active" state) and have a duplicate worker spawned in Step 5.
- **Impact**: A new Build Worker is spawned for a task that already has an active (if unreachable) worker. When MCP recovers, two workers race on the same task.
- **Current Handling**: "Unknown" is never mentioned in the dependency graph classification table or Step 3's logic.
- **Recommendation**: Add "unknown" to the worker status handling in Step 3 or explicitly state that tasks with active workers in "unknown" status are treated as BUILDING/REVIEWING (blocking new spawns).

### Failure Mode 5: `mcp_empty_count` Increment Timing Is Ambiguous

- **Trigger**: There are 3 active workers in state. All 3 are absent from MCP empty response. Check 1 increments count to 1. Check 2: only 1 of the 3 workers reappears. MCP is non-empty now.
- **Symptoms**: The non-empty branch fires: "missing worker genuinely finished or crashed, trigger completion handler." This resets `mcp_empty_count` to 0. But the 2 other "unknown" workers were not reappearing — they were missed only because MCP returned a partial list. The reset-to-0 on any non-empty response means a partial MCP recovery wipes the counter and restarts the grace period indefinitely.
- **Impact**: With 3 workers and partial MCP recoveries, the 2-check grace period can never be reached. Supervisor loops forever in a partial-recovery state, never triggering Worker Recovery Protocol.
- **Current Handling**: Reset to 0 is stated for the non-empty branch only. No instruction for partial recovery (some workers reappear, others don't).
- **Recommendation**: The reset-to-0 logic should apply only to the workers that reappear, not globally. Workers that reappear reset their individual status from "unknown" to "running." `mcp_empty_count` resets to 0 only when ALL active workers have reappeared.

### Failure Mode 6: `mcp_empty_count` Is Not Incremented on Subsequent Passes

- **Trigger**: This is the structural issue identified in Failure Mode 1, stated separately for clarity. The `mcp_empty_count` increment logic appears inside Step 1 (Read State / Recovery Check). Step 1 only executes once per session startup or compaction recovery. Normal monitoring loops go: Step 2 -> Step 3 -> Step 4 -> Step 5 -> Step 6 -> Step 7 -> Step 8 -> back to Step 6. There is no path back to Step 1.
- **Symptoms**: After the first "MCP RESTART SUSPECTED" log, the supervisor waits one monitoring interval, but when it checks again, it is not in Step 1 — it is in Step 6. Step 6 calls `get_worker_activity` per worker, not `list_workers`. The second count never increments.
- **Impact**: The 2-check grace period is mechanically impossible to complete. The grace period becomes infinite — workers stay in "unknown" forever.
- **Current Handling**: The spec says "On the next monitoring interval, re-call `list_workers`." But there is no step in the monitoring loop that re-calls `list_workers` for the "unknown" check. The instruction is stated but has no execution path.
- **Recommendation**: Add explicit instruction in Step 6: "If any active worker has status `unknown`, call `list_workers` and re-run the three-branch reconciliation check from Step 1 before calling `get_worker_activity`."

### Failure Mode 7: Worker Recovery Protocol Launched Without retry_count Increment

- **Trigger**: `mcp_empty_count` reaches 2. Worker Recovery Protocol is triggered. `mcp_empty_count` is reset to 0.
- **Symptoms**: The Worker Recovery Protocol is invoked, but the retry_count for the affected tasks is never incremented. Compare with the stuck-worker path (Step 6) which explicitly calls "Increment `retry_count` in state for this task" and checks against retry_limit. The MCP restart path has no equivalent guard.
- **Impact**: If Worker Recovery Protocol fails or the situation repeats (MCP restarts again and again), the supervisor will trigger Worker Recovery Protocol every 2 checks indefinitely, spawning unlimited Cleanup Workers, never escalating to BLOCKED.
- **Current Handling**: No retry_count increment. No retry_limit check. No BLOCKED escalation path from this code path.
- **Recommendation**: After triggering Worker Recovery Protocol from the MCP empty path, increment retry_count for each affected task and check against retry_limit, same as the stuck-worker path.

### Failure Mode 8: "Unknown" Status Not in Active Workers Table Schema

- **Trigger**: When workers are set to "unknown" status, the supervisor writes state.md with Status = "unknown" in the Active Workers table.
- **Symptoms**: The state.md format defines Status values by example only ("running" in all example rows). "Unknown" is a new value not previously present in the format spec. On compaction recovery, another AI session reads state.md. If it encounters status "unknown", it has no behavioral definition for what to do with it. This is the same class of bug guarded by the review-general.md lesson: "New status/enum values must be added to the canonical reference first."
- **Impact**: Compaction recovery behavior for "unknown" workers is undefined. The recovered session may treat them as running (monitor normally), as finished (trigger completion), or as an error.
- **Current Handling**: "Unknown" status appears in the prose of Step 1 but nowhere in the state.md format schema or the status lifecycle definition.
- **Recommendation**: Add "unknown" to the valid Status enum in the Active Workers table documentation, with an explicit behavioral note: "On recovery, unknown-status workers trigger re-check via `list_workers` before any other action."

### Failure Mode 9: File-System Evidence Check Has No Error Handling

- **Trigger**: During reconciliation, the supervisor checks the registry for IMPLEMENTED/COMPLETE status or checks for review artifact files. If these reads fail (file locked, corrupt, permission error), the check returns neither true nor false — it errors.
- **Symptoms**: No error handling is defined for evidence-check failures. The supervisor may treat a file-read error as "no evidence found" and enter the MCP RESTART SUSPECTED path. Alternatively it may throw an unhandled error that halts the supervisor.
- **Impact**: A transient file-system issue (common during active development) triggers a false MCP restart diagnosis, delaying completion handling and potentially triggering Worker Recovery Protocol unnecessarily.
- **Current Handling**: None. No fallback or error logging is defined for evidence-check failures.
- **Recommendation**: Wrap evidence checks: "If reading the registry or artifact files fails, log a warning and treat as indeterminate (do not use as evidence in either direction). Wait for the next pass."

---

## Critical Issues

### Issue 1: The 2-Check Grace Period Cannot Execute — Step 6 Has No Path to Re-increment mcp_empty_count

- **Section**: SKILL.md line 321-322 (Step 1 prose) and line 566 (Step 6 loop)
- **Scenario**: After check 1 logs "MCP RESTART SUSPECTED" and sets workers to "unknown", the next pass enters Step 6 (monitor active workers). Step 6 calls `get_worker_activity` per worker — not `list_workers`. There is no instruction to re-call `list_workers` during monitoring. The second count increment never happens.
- **Impact**: The 2-check grace period is a specification fiction. In practice the grace period is infinite. Workers set to "unknown" never reach the Worker Recovery Protocol trigger. They are stuck indefinitely, blocking the slot they occupy in the concurrency limit and preventing new tasks from spawning.
- **Evidence**: Step 6 (lines 566-608): the only MCP calls are `get_worker_activity` and `get_worker_stats`. `list_workers` does not appear in Step 6. Step 1's reconciliation block (lines 304-323) is only executed during startup/compaction recovery — it is not in the main monitoring loop.
- **Fix**: Add to Step 6, before the per-worker health checks: "If any active worker has status `unknown`, call `list_workers` (not `get_worker_activity`). Re-run the three-branch reconciliation from Step 1 for all unknown-status workers. Only after resolving their status proceed to per-worker health checks."

### Issue 2: Double-Handling — Step 1 Completion Handler and Step 4 Case 4 Both Fire for the Same Worker

- **Section**: SKILL.md lines 316 (Step 1 completion trigger) and 330 (Step 4 Case 4)
- **Scenario**: MCP returns empty. Worker has IMPLEMENTED in registry. Step 1 triggers the completion handler. Step 4 then runs, reads IMPLEMENTED (status file), and — following Case 4 — queues a Review Worker for the same task.
- **Impact**: Duplicate Review/Test workers spawned for a single task. Duplicate review artifacts. State corruption. In the ReviewLead+TestLead combined completion path, the "evaluation complete" marker guards against dual-trigger within Step 7 itself — but there is no equivalent guard between Step 1 and Step 4.
- **Evidence**: Step 4 runs as a numbered sub-step of Step 1 (lines 326-333) immediately after the reconcile-vs-MCP section (lines 304-325), making it structural — it ALWAYS runs after Step 1's reconciliation, with no conditional skip for workers already handled in the same pass.
- **Fix**: After Step 1 triggers the completion handler for a worker, mark that worker as "processed this pass" (e.g., a local set of processed_worker_ids). Step 4 must skip any worker in this set. Document explicitly: "Step 4 does not re-process workers whose completion was already triggered in Step 1 of this pass."

---

## Serious Issues

### Issue 3: Stale mcp_empty_count on Compaction Recovery Can Trigger Premature Worker Recovery Protocol

- **Section**: SKILL.md lines 318, 322 and state.md format at line 1497
- **Scenario**: Session ends mid-grace-period with `mcp_empty_count = 1`. Next session recovers state.md. First `list_workers` call still returns empty. Count increments to 2. Worker Recovery Protocol fires immediately.
- **Fix**: Add to the Compaction Recovery Bootstrap section (lines 334-341): "After restoring state, reset `mcp_empty_count` to 0. The counter is transient state and does not persist meaningfully across compaction boundaries."

### Issue 4: "Unknown" Status Is Undefined in the Active Workers Schema and Not in Step 3's Classification Table

- **Section**: SKILL.md line 320 (introduces "unknown"), state.md format at line 1454, Step 3 classification table at line 388
- **Scenario**: Worker status is set to "unknown". Step 3 builds the dependency graph and classifies each task. "Unknown" is not a recognized classification. The task's behavior is undefined — it may be re-classified as READY_FOR_BUILD and have a new worker spawned, racing against the potentially-alive original.
- **Fix**: (a) Add "unknown" as a valid Status value in the Active Workers table documentation. (b) Add it to Step 3's classification table as equivalent to BUILDING/REVIEWING (i.e., blocked from spawning new workers). (c) Add it to the compaction recovery bootstrap behavior.

### Issue 5: Worker Recovery Protocol Triggered Without retry_count Increment or BLOCKED Escalation

- **Section**: SKILL.md line 322 (Worker Recovery Protocol trigger from MCP empty path)
- **Scenario**: MCP restarts repeatedly. Each time: workers hit "unknown", grace period (when it works) reaches 2, Worker Recovery Protocol fires, count resets to 0. retry_count is never incremented. BLOCKED is never written. The supervisor loops forever spawning Cleanup Workers.
- **Fix**: After triggering Worker Recovery Protocol from the MCP empty path, add: "Increment `retry_count` for each affected task in state.md. If `retry_count > retry_limit`, write BLOCKED to `task-tracking/TASK_YYYY_NNN/status` and remove from active workers."

### Issue 6: reset-to-0 on Non-Empty Response Is Overbroad — Partial MCP Recovery Resets Counter Globally

- **Section**: SKILL.md line 323
- **Scenario**: 3 workers in state. MCP returns empty (count = 1). On next check, MCP returns 1 of the 3 workers. Non-empty branch fires: "trigger completion handler for missing worker, reset `mcp_empty_count` to 0." The 2 still-missing workers are now handled by the non-empty/missing branch (treated as genuinely finished). The counter reset was triggered by a partial recovery that should not have discharged the grace period for the still-missing workers.
- **Fix**: Define reset-to-0 to trigger only when ALL previously-unknown workers have reappeared in MCP, not when any single worker appears. Alternatively, track per-worker unknown status and resolve each independently.

---

## Moderate Issues

### Issue 7: Manual External Worker Appearing Between Checks Triggers False Completion Handler

- **Section**: SKILL.md lines 304-323
- **Scenario**: Check 1: MCP empty, 3 workers set to "unknown", count = 1. Between check 1 and check 2, a human operator manually spawns a diagnostic worker. Check 2: MCP returns non-empty (the manual worker). Branch 3 fires: supervisor treats all 3 "unknown" workers as genuinely crashed and calls the completion handler.
- **Impact**: Three tasks receive spurious completion handling. Depending on their state, this may spawn Review Workers for tasks mid-build, or trigger Completion Workers prematurely.
- **Fix**: The non-empty branch should first attempt to match the visible workers against the supervisor's own worker IDs. Only workers whose IDs are in state.md and absent from MCP should trigger the completion handler. Workers from external sources do not constitute evidence about unrelated workers.

### Issue 8: Evidence Table Omits ReviewLead + TestLead Combined Completion Case

- **Section**: SKILL.md lines 309-314 (evidence of completion table)
- **Scenario**: A task has both ReviewLead and TestLead running. MCP goes empty. Evidence check fires. The evidence table covers each worker type individually. But the combined completion path (both done, spawn FixWorker or CompletionWorker) has a subtle case: if ReviewLead evidence is found but TestLead evidence is not (or vice versa), what does the supervisor conclude?
- **Impact**: The supervisor may trigger the completion handler for the ReviewLead only, leaving TestLead in "unknown". Later the TestLead evidence is also found, triggering a second completion handler call. The "evaluation complete" marker in Step 7 may catch this, but only if the marker is written before the second trigger — a race condition within a single pass.
- **Fix**: Add a note to the evidence table: "For tasks with both ReviewLead and TestLead active, check evidence for BOTH before triggering any completion handler. If only partial evidence exists, treat as incomplete and do not trigger completion for either."

### Issue 9: Log Format for "MCP RESTART SUSPECTED" Includes mcp_empty_count Before the Increment

- **Section**: SKILL.md lines 318-319
- **Scenario**: Step 1 says: (1) increment `mcp_empty_count`, (2) log with `(empty_count={mcp_empty_count})`. The log message uses the post-increment value, which is correct. However, if the AI interprets the ordering loosely and logs before incrementing, the count shown in the log is one behind actual state.
- **Impact**: Minor: log is misleading for debugging. First check logs "(empty_count=0)" when it should show "(empty_count=1)".
- **Fix**: Restate the ordering unambiguously: "First increment `mcp_empty_count` to N, then log with the new value N."

---

## Data Flow Analysis

```
COMPACTION RECOVERY:
  read active-sessions.md / scan sessions/ → find SESSION_DIR
  read {SESSION_DIR}state.md
    → restores active workers (status may be "unknown" from prior run)
    → restores mcp_empty_count (NOT reset — ISSUE 3)

STEP 1 RECONCILIATION (runs once at startup / post-compaction):
  call list_workers → may return []
  for each worker in state not in MCP list:
    check file-system evidence [no error path — ISSUE 9]
    IF evidence: trigger completion handler
      → Step 4 ALSO processes same worker [double-handling — ISSUE 2]
    IF no evidence + empty list:
      increment mcp_empty_count [stale count risk — ISSUE 3]
      set workers to status="unknown" [undefined in schema — ISSUE 4]
      [no path back to this branch in normal loop — ISSUE 1/ISSUE 6]
    IF no evidence + non-empty list:
      trigger completion handler
      reset mcp_empty_count to 0 [overbroad reset — ISSUE 6]

STEP 3 DEPENDENCY GRAPH (runs every loop):
  classify tasks by status
  "unknown" worker → no classification defined [ISSUE 4]
  → may spawn duplicate worker [double spawn — ISSUE 4]

STEP 6 MONITORING (runs every loop):
  for each active worker:
    call get_worker_activity(worker_id)
    "unknown" health state → NOT in handling table [ISSUE 1]
    → mcp_empty_count NEVER incremented again [ISSUE 1/6]
    → grace period never completes

Gap Points Identified:
1. mcp_empty_count increment only lives in Step 1 — not in Step 6 where the second check must happen
2. "unknown" status workers are not excluded from Step 3 spawn logic — duplicate workers possible
3. Worker Recovery Protocol triggered with no retry_count increment or BLOCKED escalation path
4. No file-read error handling in evidence checks
5. Step 4 Cases 1-6 run after Step 1 completion trigger with no guard — double-handling guaranteed
```

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| AC1: MCP empty + active workers + no evidence → log "MCP RESTART SUSPECTED", no completion handler | PARTIAL | Log and no-completion-handler are specified, but the follow-on loop has no execution path to re-check |
| AC2: After 2 consecutive empty checks + no evidence → Worker Recovery Protocol | PARTIAL | The 2-check logic is written but mechanically cannot execute (no path back to Step 1 in the monitoring loop — see Critical Issue 1) |
| AC3: MCP empty + evidence found → trigger completion handler | COMPLETE | Implemented correctly in Step 1 evidence branch |
| AC4: MCP non-empty + specific worker missing → existing behavior unchanged | COMPLETE | Third branch preserves original behavior; `mcp_empty_count` reset also specified |
| AC5: mcp_empty_count in state.md, resets to 0 when workers reappear | PARTIAL | Field added to format. Reset-to-0 is overbroad (resets globally on partial reappearance — Failure Mode 5) |
| AC6: No regression for normal compaction recovery | PARTIAL | Double-handling risk (Issue 2) may affect normal compaction recovery where workers have evidence |

### Implicit Requirements NOT Addressed:

1. The `mcp_empty_count` counter must reset to 0 on compaction recovery bootstrap — otherwise stale values from prior sessions prematurely fire Worker Recovery Protocol.
2. Workers in "unknown" status must be excluded from Step 3's spawn logic — otherwise duplicate workers are spawned during the grace period.
3. Worker Recovery Protocol triggered via the MCP empty path must increment retry_count and respect retry_limit — otherwise the supervisor enters an infinite recovery loop.
4. The second `list_workers` call for the grace-period check must happen inside Step 6, not only in Step 1 — otherwise the check never runs.
5. Step 4 (state-vs-registry reconciliation) must skip workers already handled in Step 1's completion path within the same pass.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| MCP returns empty, no workers in state | YES | No workers to reconcile — no action taken | None |
| MCP returns empty, all workers have file-system evidence | YES | Evidence found → trigger completion handler for each | Double-handling with Step 4 (Issue 2) |
| MCP returns empty, partial evidence (some workers done, some not) | PARTIAL | Evidence check per worker; but "unknown" branch fires for all absent workers when list is empty | Mixed evidence scenario is not distinguished |
| mcp_empty_count already > 0 from prior session | NO | Not reset on compaction recovery bootstrap (Issue 3) | |
| Partial MCP recovery (some workers reappear, some don't) | NO | Non-empty branch triggers completion for ALL missing workers (Issue 6) | |
| Manual external worker appears between checks | NO | Non-empty list triggers completion handler for supervisor's missing workers (Issue 7) | |
| "Unknown" status worker survives into Step 3 | NO | No classification defined; may cause duplicate spawn (Issue 4) | |
| File-system evidence read fails | NO | No error path defined (Issue 9) | |
| Both ReviewLead + TestLead in "unknown" state, partial evidence | PARTIAL | Individual evidence checks may fire partial completion (Issue 8) | |
| Worker Recovery Protocol fires repeatedly (MCP restarts multiple times) | NO | No retry_count increment or BLOCKED escalation (Issue 5) | |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| list_workers call in Step 1 → MCP restart | HIGH (this is the scenario being fixed) | HIGH | New logic handles it, but grace period execution path is broken |
| get_worker_activity in Step 6 for "unknown" workers | HIGH (unknown worker IDs may not exist in MCP) | HIGH | No handling defined; likely silent error |
| File-system evidence checks → locked/missing files | MEDIUM | MEDIUM | No error handling; false "no evidence" result |
| Step 1 completion handler + Step 4 Case 4 → same worker | HIGH (fires whenever MCP empty + evidence exists) | HIGH | No guard between the two paths |
| mcp_empty_count persisted across compaction → stale count | MEDIUM | HIGH | Premature Worker Recovery Protocol on next session |

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: The 2-check grace period (the core deliverable of this task) is mechanically inoperable because the second `list_workers` call and `mcp_empty_count` increment have no execution path in the monitoring loop. The first check logs the suspicion and then the supervisor silently never checks again. All downstream behavior — Worker Recovery Protocol trigger, reset-to-0 on recovery, retry_count escalation — depends on a second check that cannot happen.

---

## What Robust Implementation Would Include

1. **Step 6 "unknown" worker handling**: A dedicated branch in Step 6's health-state logic for workers with status "unknown": re-call `list_workers` (not `get_worker_activity`) and re-run the three-branch reconciliation check from Step 1.

2. **Explicit double-handling guard**: After Step 1 triggers the completion handler for any worker in this pass, flag those workers so Step 4 skips them. Document the interaction explicitly: "Step 4 cases 1-6 apply only to workers NOT already processed by Step 1's completion trigger in the current pass."

3. **mcp_empty_count reset on bootstrap**: Compaction recovery bootstrap section explicitly resets `mcp_empty_count` to 0 before running reconciliation. Field is documented as "transient within a session."

4. **"Unknown" status in schema**: Add "unknown" to the Active Workers Status enum in state.md format. Add "unknown" to Step 3's dependency graph classification table (treat as BUILDING/REVIEWING — do not spawn new workers).

5. **retry_count increment from MCP empty path**: After Worker Recovery Protocol is triggered via the MCP empty grace period, increment `retry_count` for each affected task. Check against `retry_limit` and write BLOCKED if exceeded.

6. **Per-worker unknown tracking**: Instead of a single global `mcp_empty_count`, track unknown status per worker so partial MCP recovery correctly resolves only the workers that reappeared, leaving others in their grace period.

7. **Evidence-check error handling**: Define a fallback: "If reading registry or task artifacts fails during evidence checking, treat as indeterminate — do not use as evidence in either direction. Log the read failure and wait for the next monitoring pass."

---

## Review Lessons

The following patterns found in this review are new and should be appended to `.claude/review-lessons/review-general.md`:

- **Grace-period logic that increments a counter in Step N must also define the re-execution path within the monitoring loop** — writing "on the next interval, re-call X" in a startup-only step (Step 1) is not executable unless there is an explicit instruction in the monitoring loop (Step 6) to re-invoke that check. Behavioral specs for retry/grace logic must specify WHERE in the loop the subsequent checks happen, not just WHAT they should do. (TASK_2026_060)
- **New status values introduced by a fix must be added to the canonical schema, to the dependency graph classification table, and to compaction recovery bootstrap behavior before the fix is considered complete** — a status value that appears only in prose but not in the state.md format enum or Step 3's classification table is undefined behavior for any subsequent AI session recovering from state. (TASK_2026_060)
- **When a fix introduces a new code path that triggers the same downstream action (e.g., completion handler) as an existing code path (e.g., Step 4 registry reconciliation), a double-handling guard must be defined** — the spec must explicitly state which path takes precedence and how the other path is suppressed within the same loop pass. Absence of a guard makes duplicate worker spawning deterministic, not hypothetical. (TASK_2026_060)
