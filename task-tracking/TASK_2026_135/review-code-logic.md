# Code Logic Review — TASK_2026_135

## Review Summary

| Metric              | Value                        |
|---------------------|------------------------------|
| Overall Score       | 6/10                         |
| Assessment          | PASS WITH NOTES              |
| Critical Issues     | 1                            |
| Serious Issues      | 3                            |
| Moderate Issues     | 3                            |
| Failure Modes Found | 7                            |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The Cached Status Map is updated incrementally in Step 7f, but the BLOCKED writes in Step 3 (dependency validation — missing dep, cancelled dep, cycle detection) are **not explicitly told to update the Cached Status Map row**. Step 3 writes the `status` file and calls `update_task()`, but the map in `state.md` is left stale for the rest of that loop iteration. On the next loop-back from Step 7f to Step 4, Step 3 is re-entered — but only in file-system fallback mode does it re-read status files; in cached mode it trusts the map. Because the map still says `CREATED`, the supervisor will continue attempting to classify and eventually queue a task that it just wrote as BLOCKED, until an external event clears the map row.

### 2. What user action causes unexpected behavior?

A user invoking the supervisor with `--reprioritize` triggers both the Task Roster refresh (Step 2) and the Plan Guidance refresh (Step 3b). However, Step 2 in startup mode writes a fresh `## Cached Task Roster` and `## Cached Status Map`. If plan.md is updated to add new task IDs that do not yet have entries in the registry (a Planner created them after the registry was written), the fresh roster will include them. That is correct behavior. The unexpected path: if `--reprioritize` is NOT passed, but the Planner writes new tasks to registry.md mid-session, the "new task folder detected" mechanism catches this (via the `ls` count check at Step 4 start). However, the count check compares against the Cached Task Roster row count, which comes from the last Step 2 read — NOT the count of subdirectories under `task-tracking/`. A Planner could add a registry row for a task and not create the folder immediately, or the supervisor could observe the folder before the registry is updated. This creates a window where the detected count diverges from reality, possibly triggering a spurious roster refresh.

### 3. What data makes this produce wrong results?

A task with `BLOCKED` status in state.md but `CREATED` in the Cached Status Map (because the map was not updated when the BLOCKED write occurred) will be classified as `READY_FOR_BUILD` in Step 3 and queued in Step 4. A Build Worker will be spawned. The Build Worker will write `IN_PROGRESS`, immediately overwriting the `BLOCKED` status file written by Step 3. The blocking condition that should have been surfaced to the operator is silently erased.

### 4. What happens when dependencies fail?

The compaction recovery path for the **cortex fallback** (Step 1, fallback path) relies on finding the correct session row in `active-sessions.md`. If the match is ambiguous (two auto-pilot sessions with overlapping timestamps), the spec says to use the most recently created session directory as a last resort. This is a best-guess and could restore the wrong session state, causing double-spawning of already-completed tasks. The cortex-available path (`get_session(session_id)`) does not have this problem because session_id is uniquely scoped. The risk is confined to cortex-unavailable environments, which are explicitly the fallback path.

### 5. What's missing that the requirements didn't mention?

The Cache Invalidation Rules table says the Status Map is "never fully re-read mid-session." But what happens at **session recovery** when the map is partially populated? Step 1 (fallback path, last row of Status Map invalidation detail) correctly specifies a fallback: if a row is missing from the restored map, read that task's individual status file. However, the recovery path does not explicitly say to then **write the newly read status back into the map**. If it doesn't, every loop after recovery will repeatedly trigger file reads for those missing rows rather than caching them.

---

## Failure Mode Analysis

### Failure Mode 1: BLOCKED Write Not Reflected in Cached Status Map

- **Trigger**: Step 3 dependency validation writes `BLOCKED` to a task's status file (missing dep, cancelled dep, or cycle). The `## Cached Status Map` in state.md is not updated. The map still shows `CREATED`.
- **Symptoms**: On the next loop iteration (Step 7f -> Step 4), the task appears as `READY_FOR_BUILD`. A Build Worker is spawned. The Build Worker overwrites the BLOCKED status, losing the blocking signal.
- **Impact**: High. Operator never sees the block; tasks in an invalid state are silently executed.
- **Current Handling**: Not mentioned. Step 7f (line 830-841) only updates rows for tasks "just completed." Step 3 BLOCKED writes have no corresponding map update instruction.
- **Recommendation**: Immediately after writing BLOCKED in Step 3 dependency validation, also update the corresponding row in `## Cached Status Map` in state.md. This should be added as a mandatory sub-step in each of the three BLOCKED-write scenarios in Step 3.

### Failure Mode 2: REPRIORITIZE Anti-Loop Guard is Placed at Description, Not Enforcement Point

- **Trigger**: Plan Guidance is REPRIORITIZE after re-read. The guard ("treat as PROCEED to avoid loop") is documented in the **Cache Invalidation Rules** section, not inside the Step 3b "Apply guidance" table.
- **Symptoms**: An implementer reading the Step 3b "Apply guidance" table sees only `REPRIORITIZE → force startup mode: re-read plan.md` with no loop guard. The guard is described two sections later under Cache Invalidation Rules. The two locations can fall out of sync if either is edited independently.
- **Impact**: Medium. If the guard is missed during implementation, a Planner that leaves `Supervisor Guidance: REPRIORITIZE` in plan.md causes an infinite re-read loop that blocks all spawning indefinitely.
- **Current Handling**: Guard is specified in Cache Invalidation Rules (line 328): "If the new guidance is still REPRIORITIZE... treat it as PROCEED for this iteration." It is NOT in the Step 3b guidance table where it would be read during implementation.
- **Recommendation**: Move the loop guard statement into the Step 3b "Apply guidance" table directly, as a sub-note on the REPRIORITIZE row: "If re-read still returns REPRIORITIZE, treat as PROCEED (log reason) to avoid infinite loop." Keep the Cache Invalidation Rules reference as a cross-reference, not the sole authority.

### Failure Mode 3: Status Map Restored Rows Not Written Back on Recovery

- **Trigger**: Session compacts. Supervisor recovers via Step 1 fallback path. `## Cached Status Map` is restored from state.md. A task was added mid-session (before the last roster refresh), so its row is absent from the map. The supervisor reads its individual status file per the fallback rule.
- **Symptoms**: On every subsequent loop iteration, that task's status is re-read from disk instead of from the map — silent performance hit and inconsistency if the file changes between reads (a worker writes a new status). More critically, the map never reflects this task's status, so Step 7f's incremental updates will skip updating it (7f only writes rows it knows about).
- **Impact**: Medium. For large backlogs with many mid-session tasks, repeated file reads negate the caching goal. Worse, Step 7f does not insert new rows — it only updates existing ones — so the map stays perpetually incomplete for those tasks.
- **Current Handling**: Step 1 fallback: "fall back to reading that task's individual status file and inserting it into the map" (line 330). The word "inserting" implies writing it back, but this is in an adjunct sentence and the write-back is not confirmed as a requirement in the Step 7f section.
- **Recommendation**: Explicitly state in Step 1 (Status Map fallback) that after reading the status file, the row MUST be inserted into `## Cached Status Map` in state.md before the loop continues. Also confirm in Step 7f that it handles rows for tasks that were not present at startup.

### Failure Mode 4: New Task Detection Uses Task-Folder Count, Not Registry Count

- **Trigger**: Cache Invalidation Rules specify: "supervisor detects new task folders by comparing the task count in the Cached Task Roster against the actual `task-tracking/` directory at the START of each Step 4 pass."
- **Symptoms**: `task-tracking/` contains non-task directories (e.g., `sessions/`, `active-sessions.md` is a file not a folder, but if any non-TASK_ subdirectory exists, the count will be inflated). The supervisor triggers a spurious roster refresh on every single loop, defeating the cache entirely. Alternatively, a Planner might create a registry row before creating the task folder — the count will show no change even though there is a new task, and the roster will never refresh for it.
- **Impact**: Medium. Spurious refreshes waste context on large registries. Missed refreshes delay task pickup.
- **Current Handling**: The spec says "cheap ls — not a full registry read" without specifying to filter for `TASK_\d{4}_\d{3}` directories only. This is an ambiguity in the spec, not an implementation error.
- **Recommendation**: Specify that the `ls` count filters for subdirectories matching `TASK_\d{4}_\d{3}` pattern only. This makes the count match the registry row count format exactly.

### Failure Mode 5: Cortex vs Fallback Status Map Divergence After BLOCKED Write in Step 3

- **Trigger**: `cortex_available = true`. Step 3 writes BLOCKED via `update_task()` (DB) AND status file (filesystem). The `## Cached Status Map` in state.md is NOT updated (same as Failure Mode 1, but now the cortex and file are consistent while the map is stale).
- **Symptoms**: Step 7a reads the status via the cached task list from Step 2's `get_tasks()` result. But the BLOCKED write in Step 3 happened after that `get_tasks()` call. The in-memory task list returned at Step 2 is the cached snapshot — it is not the cortex DB. So Step 7a's "cached task list from Step 2's get_tasks() result" will also show the pre-BLOCKED status.
- **Impact**: High in theory, but mitigated: Step 7a specifies "if both are present and differ, the file takes precedence." So the status file written BLOCKED would win over the stale in-memory list. The issue is whether the Supervisor re-reads this status in Step 7a or if it looks at the stale in-memory map from Step 2.
- **Current Handling**: Partially mitigated by Step 7a's file-takes-precedence rule. However, Step 3b and Step 4 both operate from the Cached Status Map, not the Step 7a re-read. So the BLOCKED task can still be queued before Step 7a gets a chance to resolve the conflict.
- **Recommendation**: BLOCKED writes in Step 3 must update the `## Cached Status Map` immediately (same fix as Failure Mode 1). This eliminates the window.

### Failure Mode 6: Transitive Unblocking Depends on Completion Cascade Arriving in Order

- **Trigger**: Step 7f performs one-level dependency checks per completion event. A chain A -> B -> C where A completes. Step 7f unblocks B (direct dependent). B is now READY_FOR_BUILD. If B completes in a subsequent loop, Step 7f will then unblock C. This cascades correctly IF each task completes before the supervisor enters Step 8 (termination check).
- **Symptoms**: After A completes, the supervisor checks Step 8: are there actionable tasks? B is now READY_FOR_BUILD (just unblocked). C is still BLOCKED_BY_DEPENDENCY. The supervisor spawns B and monitors. When B completes, Step 7f runs again, unblocking C. This is correct behavior. However: if B was ALREADY in COMPLETE state at the time A completes (i.e., B was completed in a prior session and the Cached Status Map already shows COMPLETE), Step 7f checks only direct dependents of A (which is B), finds B is already COMPLETE, and does not walk further to check C. C would remain classified as BLOCKED_BY_DEPENDENCY until the next Step 3 rebuild (which only happens on startup or --reprioritize). C is silently stranded.
- **Impact**: Serious. A pre-completed dependency chain can leave the last task permanently stuck in BLOCKED_BY_DEPENDENCY within a single session where the first task completes.
- **Current Handling**: Step 7f note (line 837): "Transitive unblocking is handled naturally: when that next-level task completes, its dependents are checked in their own Step 7f pass." This is only true if the intermediate task hasn't already completed. The spec does not address the case where the intermediate is already COMPLETE.
- **Recommendation**: In Step 7f targeted downstream check, after finding a direct dependent that has ALL deps COMPLETE (ready to unblock), recursively continue the walk: if the newly-unblocked task's status is COMPLETE itself, also check its direct dependents. Continue until a non-COMPLETE task is found or the graph is exhausted. This closes the cascade gap.

### Failure Mode 7: Plan Guidance Cache Does Not Track plan.md Modification Time

- **Trigger**: plan.md is updated by the Planner mid-session (the Planner changes guidance from PROCEED to REPRIORITIZE). The cached Plan Guidance in state.md still says PROCEED. No file-watch trigger is defined for plan.md modifications (only `--reprioritize` flag and "cached guidance = REPRIORITIZE" trigger re-reads).
- **Symptoms**: The supervisor runs for the rest of the session with stale guidance. The Planner's updated priorities are ignored until `--reprioritize` is passed externally.
- **Impact**: Medium. This is a known limitation (the design prioritizes cache efficiency). However, the spec does not explicitly acknowledge this limitation — an operator expecting plan.md changes to take effect immediately within a session will be surprised.
- **Current Handling**: Not addressed. The Cache Invalidation Rules table only lists two invalidation triggers for Plan Guidance and neither involves detecting plan.md modifications.
- **Recommendation**: Add a note in Cache Invalidation Rules (Plan Guidance row) stating explicitly: "plan.md changes during a session are NOT auto-detected. Pass `--reprioritize` to refresh mid-session." This sets correct operator expectations and prevents confusion.

---

## Critical Issues

### Issue 1: BLOCKED writes in Step 3 do not update Cached Status Map

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 3 dependency validation (lines 179-192) and Step 3b/Cache Invalidation Rules (lines 316-332)
- **Scenario**: Any task that is written BLOCKED during Step 3 dependency validation (missing dep, cancelled dep, cycle detection). On the next loop iteration, the stale map entry (CREATED) causes the supervisor to treat the task as READY_FOR_BUILD and spawn a Build Worker.
- **Impact**: Silent data corruption — BLOCKED tasks are executed, which either overwrites the BLOCKED signal or produces unexpected worker outcomes.
- **Evidence**: Step 3 BLOCKED-write instructions say "Write BLOCKED to status file" and optionally "call update_task()" but contain no instruction to update `## Cached Status Map` in state.md. Step 7f (line 830) explicitly limits its scope to "the task(s) just completed," not BLOCKED writes from Step 3.
- **Fix**: Add a mandatory sub-step to each of the three BLOCKED-write scenarios in Step 3: "Also update the task's row in `## Cached Status Map` in `{SESSION_DIR}state.md` to `BLOCKED`."

---

## Serious Issues

### Issue 1: REPRIORITIZE loop guard not in the guidance table (Step 3b)

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 3b Apply guidance table (line 267) vs Cache Invalidation Rules (line 328)
- **Scenario**: Implementer reads Step 3b guidance table and implements REPRIORITIZE handling without seeing the loop guard, which is in a different section.
- **Impact**: Infinite re-read loop blocks all worker spawning whenever Planner leaves guidance as REPRIORITIZE.
- **Fix**: Add the loop guard as a conditional note directly in the REPRIORITIZE row of the Step 3b guidance table.

### Issue 2: Transitive unblocking misses pre-completed intermediaries

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 7f (lines 834-841)
- **Scenario**: Chain A -> B -> C. A completes this session. B was already COMPLETE before this session. Step 7f checks A's direct dependents (B), finds B is COMPLETE, and stops. C stays BLOCKED_BY_DEPENDENCY permanently within this session.
- **Impact**: Task C is never queued. Operator sees BLOCKED_BY_DEPENDENCY with no path to resolution without manual intervention or a new session.
- **Fix**: In Step 7f, when a direct dependent is found to be already COMPLETE, continue the walk to its own dependents. This catches the cascade.

### Issue 3: Session recovery does not guarantee map write-back for missing rows

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Cache Invalidation Rules, Status Map detail (line 330)
- **Scenario**: Compaction occurs. Recovery finds a task row missing from the restored Cached Status Map. The spec says "fall back to reading that task's individual status file and inserting it into the map" — but "inserting" is not backed by an explicit state.md write instruction.
- **Impact**: Task status is re-read from disk on every loop, defeating the cache. Step 7f cannot update a row it never inserted, leaving the map permanently stale for those tasks.
- **Fix**: Make the write-back explicit: "After reading the status file, write the row into `## Cached Status Map` in `{SESSION_DIR}state.md` before proceeding."

---

## Moderate Issues

### Issue 1: New-task detection count is unfiltered

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Cache Invalidation Rules, Task Roster detail (line 326)
- **Scenario**: `task-tracking/` contains non-TASK_ subdirectories (e.g., `sessions/`). The `ls` count inflates and triggers spurious roster refreshes on every loop.
- **Fix**: Specify the `ls` count filters for `TASK_\d{4}_\d{3}` subdirectories only.

### Issue 2: plan.md mid-session update is silently ignored

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Cache Invalidation Rules, Plan Guidance row (line 323)
- **Scenario**: Planner updates plan.md during a running session. Supervisor continues with stale guidance.
- **Fix**: Add an explicit note in the Cache Invalidation Rules table documenting that plan.md mid-session changes require `--reprioritize` to take effect.

### Issue 3: cortex path Step 7a "cached task list" ambiguity

- **File**: `.claude/skills/auto-pilot/references/parallel-mode.md` — Step 7a (lines 727-735)
- **Scenario**: "use the cached task list from Step 2's get_tasks() result" — this is a snapshot taken at startup. Any BLOCKED writes by Step 3 during this session are reflected in the DB (via update_task) and the status file, but not in this in-memory snapshot. The file-takes-precedence rule partially mitigates this, but the flow reads the status file as "belt and suspenders" rather than as the primary source in cortex mode.
- **Fix**: Clarify the precedence rule explicitly: when status file and in-memory snapshot differ, the status file is always authoritative — not just "when both are present." Make this the default rule, not the exception.

---

## Data Flow Analysis

```
Step 2 (startup) → reads registry + status files
        ↓
  writes Cached Task Roster + Cached Status Map into state.md
        ↓
Step 3 → classifies tasks using Cached Status Map
        ↓ (BLOCKED write path — GAP HERE)
  writes BLOCKED to status file + update_task()
  [BUG: does NOT update Cached Status Map]
        ↓
Step 4 → reads Cached Status Map to queue tasks
  [Sees stale CREATED for just-blocked task → queues it]
        ↓
Step 5 → spawns Build Worker for blocked task
        ↓
Step 6 → monitors
        ↓
Step 7 → completion handler
        ↓
Step 7f → updates Cached Status Map for completed tasks only
        → checks direct dependents (one-level)
  [GAP: pre-completed intermediaries not walked — transitive miss]
        ↓
Step 4 (loop-back, no Step 2) → repeats from updated queue
```

### Gap Points Identified:

1. BLOCKED writes in Step 3 do not propagate to the Cached Status Map — the map is the routing source, so the block is invisible to Step 4.
2. Step 7f one-level walk misses chains where intermediate tasks were already COMPLETE before this session's completion event.
3. Post-recovery missing-row handling implies but does not require a write-back — leaving the map incomplete indefinitely.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Startup vs cached mode distinction | COMPLETE | Clear. Step 2 and Step 3b both document the two modes explicitly. |
| Refresh triggers defined | COMPLETE | File-watch and `--reprioritize` documented for Task Roster; REPRIORITIZE and `--reprioritize` for Plan Guidance. |
| Cortex and fallback paths covered | COMPLETE | Both modes described at Step 2, 3b, 4, 5, 6, 7. |
| Status Map written after startup read | COMPLETE | Step 2 fallback path (line 112) and cortex path (line 99) both write the map. |
| Status Map updated incrementally (Step 7f) | COMPLETE | Step 7f (line 830) explicitly updates completed task rows. |
| BLOCKED writes update Status Map | MISSING | Step 3 BLOCKED writes have no map update instruction. |
| Compaction recovery restores all 3 caches | PARTIAL | Both cortex and fallback paths restore state.md. Missing-row write-back not guaranteed. |
| REPRIORITIZE anti-loop guard | COMPLETE (placement issue) | Guard exists (line 328) but not co-located with the guidance table where it must be enforced. |
| Transitive unblocking via cascading completions | PARTIAL | Works for live completions. Fails for pre-completed intermediaries. |

### Implicit Requirements NOT Addressed:

1. When plan.md changes mid-session without `--reprioritize`, the operator has no way to know the guidance is stale — the spec should document this as an explicit known limitation.
2. The "ls count" for new task detection should be scoped to `TASK_\d{4}_\d{3}` directories to avoid false triggers from non-task directories.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| First run (no state.md) | YES | Step 1 ELSE branch initializes fresh state | None |
| Compaction (cortex path) | YES | get_session() restores all three caches | None |
| Compaction (fallback path) | PARTIAL | state.md read, but missing-row write-back ambiguous | See Failure Mode 3 |
| New task added mid-session | PARTIAL | ls count triggers roster refresh, but count may be unfiltered | See Moderate Issue 1 |
| --reprioritize flag | YES | Forces startup mode on both Step 2 and Step 3b | None |
| REPRIORITIZE infinite loop | PARTIAL | Guard exists but is placed in wrong section | See Serious Issue 1 |
| BLOCKED write during dep validation | CRITICAL GAP | Status file and DB updated, but Cached Status Map stale | See Critical Issue 1 |
| Transitive unblocking | PARTIAL | One-level cascade works; pre-completed intermediaries missed | See Serious Issue 2 |
| plan.md changed mid-session | NOT HANDLED | No auto-detection; requires --reprioritize | See Moderate Issue 2 |
| Active worker but no state.md | YES | Step 1 MCP reconciliation handles it | None |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Cached Status Map → Step 3 BLOCKED write | HIGH (design gap) | HIGH (workers spawned for blocked tasks) | Fix: update map on BLOCKED writes |
| Step 7f → pre-completed intermediary chain | MED | MED (tasks stranded in session) | Fix: recursive walk when intermediate is COMPLETE |
| Recovery → missing-row write-back | LOW-MED | LOW-MED (repeated disk reads) | Fix: explicit write-back instruction |
| REPRIORITIZE guard misplacement | LOW (one-time impl error) | HIGH (infinite loop) | Fix: co-locate guard with guidance table |
| ls count false trigger | MED (depends on dir structure) | LOW (extra registry reads) | Fix: filter to TASK_ pattern |

---

## Verdict

PASS WITH NOTES

**Top Risk**: BLOCKED writes in Step 3 dependency validation do not update the Cached Status Map (Critical Issue 1). This is a functional design gap, not an ambiguity — the spec explicitly states the map is the authoritative routing source for Step 3 and Step 4, but the BLOCKED-write instructions do not update it. Without this fix, tasks blocked by missing/cancelled dependencies can be spawned anyway.

**Confidence**: HIGH

**What Robust Implementation Would Include**:
- Every state-file write (BLOCKED, IMPLEMENTED, COMPLETE, IN_PROGRESS) in any step must be accompanied by a corresponding Cached Status Map update — the map should never fall behind the file.
- Step 7f recursive walk for pre-completed intermediaries in the dependency chain.
- REPRIORITIZE loop guard co-located with the Step 3b guidance table (not only in Cache Invalidation Rules).
- Explicit write-back requirement for recovered missing-row entries.
- `ls` count scoped to `TASK_\d{4}_\d{3}` pattern to prevent false roster refreshes.
