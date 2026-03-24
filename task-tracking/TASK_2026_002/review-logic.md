# Code Logic Review - TASK_2026_002

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 7/10                                 |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 2                                    |
| Serious Issues      | 4                                    |
| Moderate Issues     | 3                                    |
| Failure Modes Found | 7                                    |

## The 5 Paranoid Questions

### 1. How does this fail silently?

- **Cycle detection algorithm is underspecified and can miss transitive cycles.** Step 3 says "walk the dependency chain. If a task is encountered twice in the same walk, a cycle exists." But the walk is only described from the perspective of "each unresolved task." If TASK_A depends on TASK_B, TASK_B depends on TASK_C, TASK_C depends on TASK_A, a naive walk starting from TASK_A would visit A -> B -> C -> A and detect the cycle. But the walk starting from TASK_B would visit B -> C -> A -> B. This works for simple cases, but the algorithm does not describe what "unresolved" means precisely. More critically, if a task in a cycle also has a COMPLETE dependency mixed in, the walk logic could skip the COMPLETE dependency branch and never discover the cycle. The algorithm says nothing about how to handle mixed dependency lists (some COMPLETE, some not).

- **`get_worker_activity` returns a `summary: string` -- a free-text blob.** Step 6b says "Parse the summary for health indicators. If the summary indicates potential issues (stuck, finished, or health unclear), escalate." But this is parsing natural language. There is no structured health field in `get_worker_activity`'s return value. The orchestrator must infer health from a 5-10 line text summary. If the summary does not contain the words "stuck" or "finished" but the worker IS stuck, the escalation never triggers. The monitoring loop silently treats a stuck worker as healthy indefinitely.

- **Retry counter persistence gap during reconciliation.** Step 1 says when a worker is in state but NOT in MCP list, treat it as finished and trigger Step 7 (completion handler). Step 7c increments `retry_count`. But if the orchestrator session was compacted and restored, and the worker crashed during compaction, the completion handler fires during reconciliation. If `orchestrator-state.md` was written BEFORE the worker crashed (with retry_count = 0), the retry counter is correct. But if the state file was written and then the orchestrator compacted before writing an updated state, the retry counter could be stale. The state says "write after every significant event" but compaction can happen between the event and the write.

### 2. What user action causes unexpected behavior?

- **User runs `/auto-pilot TASK_YYYY_NNN` on a task with status IN_PROGRESS.** The command file (Step 3c) says "If not CREATED, warn and confirm." But the SKILL.md single-task mode path does not have any special handling for IN_PROGRESS tasks. If the user confirms, the auto-pilot would attempt to spawn a second worker for the same task, violating the "never spawn duplicate workers" principle. The command warns but the skill has no guard for this case in single-task mode.

- **User runs `/auto-pilot` while a previous auto-pilot session's `orchestrator-state.md` exists with `loop_status: RUNNING`.** Step 1 reads and restores state but never checks `loop_status`. If another auto-pilot session is actively running (in a different terminal or after a crash), this new session would read the state, adopt the same active workers, and start making duplicate decisions (monitoring the same workers, potentially spawning duplicates for queued tasks). There is no lock or mutual exclusion mechanism.

- **User runs `/auto-pilot --dry-run` but the registry has IN_PROGRESS tasks from a crashed previous session.** Dry-run shows the dependency graph but does not reconcile stale IN_PROGRESS statuses. The user sees tasks as "in progress" that are actually dead. The dry-run output gives a misleading picture.

### 3. What data makes this produce wrong results?

- **A task.md with Dependencies field containing free-text instead of task IDs.** For example: `Dependencies: Requires the database schema work to be complete`. Step 3 says "parse the Dependencies field into a list of task IDs" but provides no regex or parsing guidance. If the parser fails to extract any IDs, the task appears to have no dependencies and is classified as UNBLOCKED -- it will be spawned immediately even though it has an actual dependency.

- **A task.md with a Priority field that does not match the P0/P1/P2/P3 enum.** For example: `Priority: High` instead of `Priority: P1-High`. Step 4 sorts by priority but provides no handling for unparseable priority values. The task could sort to the top or bottom unpredictably.

- **Registry with CANCELLED tasks that have dependents.** Step 3's classification table handles CREATED, IN_PROGRESS, BLOCKED, and COMPLETE. A task depending on a CANCELLED task is never classified. Its dependency is not COMPLETE, so it would be classified as... what? Not UNBLOCKED (dependency is not COMPLETE). Not explicitly BLOCKED (only missing/cyclic dependencies trigger BLOCKED). The task would simply never be picked up and never be flagged -- it sits in CREATED status forever with no explanation.

### 4. What happens when dependencies fail?

- **MCP `get_worker_activity` fails for one worker but succeeds for others.** The MCP retry logic (3 retries with 30s backoff) applies to "any MCP call." But in the monitoring loop (Step 6), the auto-pilot iterates over multiple workers. If `get_worker_activity` fails for worker A after 3 retries, the entire loop pauses per the error handling section ("STOP the loop"). This means one unreachable worker (perhaps killed externally) stops monitoring of all other healthy workers. The error handling is too aggressive -- a single-worker MCP failure should not halt the entire loop.

- **Registry file becomes corrupted or locked mid-loop.** The auto-pilot writes to `registry.md` at multiple points: Step 3 (mark BLOCKED for cycles/missing deps), Step 5c (mark IN_PROGRESS), Step 6c (mark CREATED on stuck kill), Step 7 (mark COMPLETE or CREATED). If a write fails (disk full, permissions), there is no error handling specific to registry writes. The generic "unexpected error" handler writes state and surfaces the error, but the registry could be left in a half-updated state.

- **`kill_worker` returns `success: false`.** Step 6c and 7e call `kill_worker` but never check the return value. If the kill fails, the worker remains running, the task status is changed anyway (to CREATED for retry or the worker is removed from active list), and on the next loop iteration the auto-pilot may spawn a duplicate worker for the same task while the original is still running.

### 5. What's missing that the requirements didn't mention?

- **No mutual exclusion / lock for concurrent auto-pilot sessions.** Nothing prevents two `/auto-pilot` invocations from running simultaneously, both reading the same state file, both making decisions about the same tasks, both spawning duplicate workers.

- **No cost tracking or budget limit.** The `orchestrator-state.md` format in the requirements (Req 9, AC 1) specifies "worker cost" in completed tasks. The implemented state format omits cost entirely from the Completed Tasks table (only has `Task ID | Completed At`). The `list_workers` MCP tool returns `cost_estimate_usd` and `get_worker_stats` returns cost details, but neither the skill nor the state format captures this.

- **No handling for CANCELLED status in the dependency graph.** As noted in Question 3 above, CANCELLED tasks are classified but their dependents are in limbo.

- **No maximum loop iteration guard.** If the dependency graph is misconfigured such that tasks keep failing and retrying, the auto-pilot could loop indefinitely. There is no circuit breaker for "we've been running for 8 hours and nothing is completing."

- **No guidance on what "configurable monitoring interval" means in practice.** The skill says "Wait for the configured monitoring interval" but this is a markdown instruction for Claude Code, not executable code. Claude Code does not have a `sleep(10 minutes)` primitive. How does the orchestrator session actually wait? Does it poll? Does it set a timer? This is a fundamental implementation gap for a markdown-based skill.

---

## Failure Mode Analysis

### Failure Mode 1: Stuck Detection Relies on Natural Language Parsing

- **Trigger**: Worker becomes stuck but `get_worker_activity` summary does not contain keywords that indicate "stuck" or "finished"
- **Symptoms**: Auto-pilot logs "healthy" for the worker indefinitely. Worker never progresses, never gets killed.
- **Impact**: HIGH -- task is permanently stuck with no automatic recovery. Active worker slot is consumed, reducing effective concurrency.
- **Current Handling**: Step 6b says "Parse the summary for health indicators. If the summary indicates potential issues, escalate to get_worker_stats." This relies on the orchestrator session (Claude) correctly interpreting a free-text summary.
- **Recommendation**: The monitoring protocol should ALWAYS call `get_worker_stats` when a worker has been active longer than 2x the stuck threshold, regardless of `get_worker_activity` output. This provides a structured `health` field as a reliable fallback. Alternatively, define explicit keywords/patterns to look for in the activity summary.

### Failure Mode 2: Concurrent Auto-Pilot Sessions Cause Duplicate Workers

- **Trigger**: User starts `/auto-pilot` in two terminals, or starts a new session while a previous one's `orchestrator-state.md` still says RUNNING
- **Symptoms**: Both sessions read the same state, both try to manage the same workers, both spawn workers for queued tasks. Tasks get duplicate workers, registry statuses get overwritten by competing sessions.
- **Impact**: HIGH -- duplicate work, wasted API costs, potential registry corruption from concurrent writes
- **Current Handling**: None. No lock file, no `loop_status: RUNNING` check, no PID tracking.
- **Recommendation**: On startup, check `orchestrator-state.md` for `loop_status: RUNNING`. If found, warn the user and require `--force` flag to proceed. Write a session identifier (timestamp + random) into state so sessions can detect conflicts. This is not bulletproof but prevents accidental duplicates.

### Failure Mode 3: `kill_worker` Failure Leaves Ghost Workers

- **Trigger**: `kill_worker` returns `success: false` (process already dead, permissions issue, MCP error)
- **Symptoms**: Auto-pilot removes worker from active list and sets task to CREATED. Next iteration, task is CREATED with no active worker in state, so auto-pilot spawns a new worker. Meanwhile the original worker might still be running (if the kill just returned a transient failure).
- **Impact**: MEDIUM-HIGH -- duplicate workers for same task, wasted resources, potential conflicting writes to task deliverables
- **Current Handling**: Neither Step 6c nor Step 7e check the return value of `kill_worker`.
- **Recommendation**: After `kill_worker`, verify the kill by calling `get_worker_stats` or `list_workers` to confirm the worker is no longer active. If still active, retry kill or log a critical warning and leave the worker in the active list (do not set task to CREATED).

### Failure Mode 4: CANCELLED Dependency Creates Silent Deadlock

- **Trigger**: Task A depends on Task B. Task B's status is CANCELLED.
- **Symptoms**: Task A has status CREATED. Its dependency (Task B) is not COMPLETE. Task A is not classified as UNBLOCKED. But it is also not flagged as BLOCKED (only cycles and missing deps trigger BLOCKED). Task A sits in CREATED status forever. The auto-pilot does not log any warning.
- **Impact**: MEDIUM -- task is silently stuck. User must manually investigate why a CREATED task is never picked up.
- **Current Handling**: Step 3 classification handles CREATED, IN_PROGRESS, BLOCKED, COMPLETE. CANCELLED is not in the dependency validation logic.
- **Recommendation**: Add to Step 3 dependency validation: "If a dependency has status CANCELLED, mark the dependent task as BLOCKED and log: 'TASK_X blocked: dependency TASK_Y is CANCELLED'."

### Failure Mode 5: Compaction Happens Between Event and State Write

- **Trigger**: Auto-pilot spawns a worker (event), then before writing `orchestrator-state.md`, the Claude session undergoes context compaction
- **Symptoms**: After compaction recovery, `orchestrator-state.md` does not contain the newly spawned worker. The worker is running (in MCP list) but not tracked. Step 1 reconciliation says "Worker in MCP list but NOT in state -> Ignore it -- it is not ours." So the auto-pilot ignores its own worker.
- **Impact**: HIGH -- orphaned worker runs indefinitely with no monitoring. The task's registry status is IN_PROGRESS (set before state write) but no auto-pilot session is tracking it. The task is stuck in IN_PROGRESS forever.
- **Current Handling**: Step 5e says "Write orchestrator-state.md after all spawns complete." But compaction can happen between 5c (registry update) and 5e (state write).
- **Recommendation**: Write `orchestrator-state.md` AFTER EACH individual spawn (not after all spawns). This minimizes the window between registry update and state persistence. Also, during reconciliation, if a worker in MCP list has a label matching the `TASK_YYYY_NNN-TYPE` pattern AND the corresponding task is IN_PROGRESS in the registry, adopt it rather than ignoring it.

### Failure Mode 6: Monitoring Interval Implementation Gap

- **Trigger**: Auto-pilot reaches Step 6 ("Wait for the configured monitoring interval")
- **Symptoms**: Claude Code has no built-in timer or sleep mechanism. The instruction "wait for 10 minutes" is ambiguous for an LLM session. The session might busy-loop polling, might emit a message and then immediately check, or might simply not know how to wait.
- **Impact**: MEDIUM -- either the monitoring interval is not respected (checking too frequently, wasting MCP calls and orchestrator context) or the session gets confused about how to implement "waiting."
- **Current Handling**: The skill says "Wait for the configured monitoring interval" with no implementation guidance.
- **Recommendation**: Add explicit guidance: "To wait for the monitoring interval, inform the user 'Waiting N minutes before next health check...' and then proceed to the next monitoring pass. In practice, the Claude Code session will re-read this instruction and proceed -- the 'wait' is conceptual, not a literal timer. The MCP `get_worker_activity` responses will naturally show elapsed time. Use the timestamp delta between 'Last Updated' in orchestrator-state.md and current time to determine if the interval has passed."

### Failure Mode 7: Single-Worker MCP Failure Halts Entire Loop

- **Trigger**: `get_worker_activity` fails for one specific worker_id (worker was killed externally, MCP has stale reference)
- **Symptoms**: MCP retry logic triggers 3 retries with 30s backoff. After 90 seconds of retries, the entire auto-pilot loop pauses with "MCP session-orchestrator unreachable." All other healthy workers lose their monitor.
- **Impact**: MEDIUM-HIGH -- one bad worker reference stops the entire system
- **Current Handling**: Error handling section says "If any MCP call fails: Retry up to 3 times... If still failing: STOP the loop."
- **Recommendation**: Differentiate between systemic MCP failures (server down -- all calls fail) and per-worker failures (specific worker_id not found). For per-worker failures: treat the worker as finished/crashed, trigger completion handler. Only halt the loop if a non-worker-specific call (like `list_workers`) fails, indicating the MCP server itself is unreachable.

---

## Critical Issues

### Issue 1: `get_worker_activity` Returns Unstructured Text -- Health Detection is Unreliable

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:184-186`
- **Scenario**: Monitoring loop calls `get_worker_activity` which returns `{ summary: string }`. The skill says to "Parse the summary for health indicators" and escalate to `get_worker_stats` only when issues are detected.
- **Impact**: A stuck worker whose activity summary happens to read normally (e.g., "Worker is processing files...") will never be escalated. The structured `health` field is only available from `get_worker_stats`, but calling it for every worker every interval is explicitly prohibited by the Context Efficiency Rule. This creates a fundamental tension: context efficiency vs. reliable health detection.
- **Evidence**: MCP design doc shows `get_worker_activity` returns `{ summary: string }` with no structured health field. `get_worker_stats` returns `{ health: 'healthy' | 'high_context' | 'compacting' | 'stuck' | 'finished' }`. Step 6b relies on parsing the summary string to decide whether to escalate.
- **Fix**: Add a time-based escalation rule: "If a worker has been active for longer than `2 * stuck_threshold` since its last `get_worker_stats` check, call `get_worker_stats` regardless of activity summary." This ensures every worker gets a structured health check at least once every 10 minutes (with default 5-min stuck threshold), while still preferring `get_worker_activity` for routine checks.

### Issue 2: No Guard Against Concurrent Auto-Pilot Sessions

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:67-83` (Step 1: Read State)
- **Scenario**: User starts `/auto-pilot` while another session is already running the auto-pilot loop. Both sessions read the same `orchestrator-state.md`, both adopt the same active workers, both try to spawn workers for the same queued tasks.
- **Impact**: Duplicate workers spawned for the same tasks, conflicting registry writes, wasted API costs. This is a realistic scenario: user opens a new terminal and forgets auto-pilot is already running.
- **Evidence**: Step 1 reads and restores state but never checks if `loop_status` is already `RUNNING`. The command's pre-flight checks (Step 3) verify registry and MCP availability but do not check for an existing running auto-pilot.
- **Fix**: In the command's pre-flight checks (Step 3), add: "3d. Check `orchestrator-state.md` for `loop_status: RUNNING`. If found, display warning: 'An auto-pilot session appears to be running (last updated: {timestamp}). Starting a second session will cause duplicate workers and state conflicts. Use --force to override.' Abort unless --force is provided." In the skill's Step 1, when restoring from state with `loop_status: RUNNING`, validate via `list_workers` AND check if the timestamp is recent (within 2x monitoring interval). If stale, assume the previous session crashed and proceed.

---

## Serious Issues

### Issue 3: CANCELLED Dependencies Create Silent Deadlock

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:96-115` (Step 3: Build Dependency Graph)
- **Scenario**: Task A depends on Task B which has status CANCELLED. Task A remains CREATED but is never classified as UNBLOCKED (dependency not COMPLETE) or BLOCKED (only cycles and missing deps trigger BLOCKED).
- **Impact**: Task silently sits in CREATED forever. No warning logged. User has no indication why the task is not being processed.
- **Evidence**: Step 3 classification table has four rows: UNBLOCKED, IN_PROGRESS, BLOCKED, COMPLETE. CANCELLED is not mentioned in the dependency validation section. Only "missing dependency" and "cycle detection" trigger BLOCKED status.
- **Fix**: Add a third dependency validation rule: "If a dependency has status CANCELLED, mark the dependent task as BLOCKED in the registry. Log: 'TASK_X blocked: dependency TASK_Y is CANCELLED'."

### Issue 4: `kill_worker` Return Value Never Checked

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:207-208, 252-254`
- **Scenario**: `kill_worker` is called for stuck workers (Step 6c) and post-completion workers (Step 7e). The task status is immediately changed and the worker removed from active list, without verifying the kill succeeded.
- **Impact**: If the kill fails, an orphaned worker continues running while the auto-pilot has already removed it from tracking and may spawn a replacement. Two workers run the same task simultaneously.
- **Evidence**: MCP design doc shows `kill_worker` returns `{ success: boolean, final_stats: {...} }`. Neither Step 6c nor Step 7e references the `success` field.
- **Fix**: After calling `kill_worker`, check `success`. If false, retry once. If still false, log a critical warning and do NOT remove the worker from active list or change the task status. Leave it for manual intervention.

### Issue 5: State Write After ALL Spawns Creates Orphan Window

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:176`
- **Scenario**: Auto-pilot spawns 2 workers (at concurrency limit). After spawn 1, registry is updated to IN_PROGRESS (Step 5c). After spawn 2, registry is updated. Only THEN is `orchestrator-state.md` written (Step 5e). If compaction or crash occurs between spawn 1 and Step 5e, the state file does not contain the spawned workers.
- **Impact**: After recovery, reconciliation ignores workers "not in state" (treats them as belonging to another session). Spawned workers become orphaned -- running but unmonitored. Registry shows IN_PROGRESS but no auto-pilot session is tracking them.
- **Evidence**: Step 5e: "Write orchestrator-state.md after all spawns complete." Step 1 reconciliation: "Worker in MCP list but NOT in state -> Ignore it."
- **Fix**: Write `orchestrator-state.md` after EACH individual spawn, not after all spawns. Change Step 5e to: "Write orchestrator-state.md after each successful spawn (5c)." Additionally, improve reconciliation: if a worker in MCP list has a label matching `TASK_YYYY_NNN-TYPE` format AND the corresponding task is IN_PROGRESS in the registry, adopt it into state rather than ignoring it.

### Issue 6: Per-Worker MCP Failure Triggers Full Loop Halt

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:371-378` (MCP Unreachable error handling)
- **Scenario**: During monitoring, `get_worker_activity` for a specific worker_id fails (worker was killed externally, MCP has stale reference). The 3-retry logic triggers, all fail, and the loop halts entirely.
- **Impact**: One dead worker reference stops monitoring of all other healthy workers. The entire auto-pilot pauses until user intervention.
- **Evidence**: Error handling says "If any MCP call fails: Retry up to 3 times with 30-second backoff. If still failing: Write state, STOP the loop."
- **Fix**: Differentiate between call types. For worker-specific calls (`get_worker_activity`, `get_worker_stats`, `kill_worker`): if the call fails after retries, treat that specific worker as crashed/finished and trigger the completion handler. Only halt the loop for infrastructure-level calls (`list_workers`, `spawn_worker` when not a worker-specific error) that indicate the MCP server itself is unreachable.

---

## Moderate Issues

### Issue 7: Cost Tracking Omitted from State Format

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:270-316` (orchestrator-state.md format)
- **Scenario**: Requirement 9 AC 1 specifies "worker cost" in completed tasks. The implemented Completed Tasks table only has `Task ID | Completed At`.
- **Impact**: No visibility into per-task or session-total costs. User cannot assess auto-pilot run expenses.
- **Evidence**: Requirements: "Completed tasks this session: task ID, completion timestamp, worker cost." Implemented format: `| Task ID | Completed At |` (no cost column).
- **Fix**: Add `Cost (USD)` column to Completed Tasks table. Capture from `get_worker_stats` or `list_workers` when handling completion.

### Issue 8: Monitoring Interval "Wait" Has No Implementation Guidance

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md:180`
- **Scenario**: Step 6 says "Wait for the configured monitoring interval." Claude Code is an LLM session, not a runtime with a sleep primitive. How does it actually wait 10 minutes?
- **Impact**: Without guidance, the session might busy-loop (wasting context), skip the wait entirely (overwhelming MCP with requests), or get confused.
- **Fix**: Add a note: "In practice, the orchestrator session should announce the wait ('Next health check in N minutes...'), then proceed to the monitoring check. Use timestamps in orchestrator-state.md to track actual elapsed time. The MCP tools' responses include elapsed time data that naturally spaces out the loop."

### Issue 9: Dry-Run Mode Does Not Show Stale IN_PROGRESS Tasks

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/commands/auto-pilot.md:74-99` (dry-run output)
- **Scenario**: Registry has tasks with IN_PROGRESS status from a previous crashed session. User runs `--dry-run` to see the backlog state.
- **Impact**: Dry-run shows IN_PROGRESS tasks as actively running, giving the user a misleading picture. No reconciliation against MCP `list_workers` happens in dry-run mode.
- **Evidence**: The command's Step 4 summary shows "Already in progress: {N}" but does not verify these are actually running.
- **Fix**: In dry-run mode, after displaying the summary, add a note: "Note: IN_PROGRESS tasks have not been verified against MCP. Some may be stale from a previous session. Run without --dry-run to trigger reconciliation."

---

## Data Flow Analysis

```
User invokes /auto-pilot [args]
  |
  v
Command: Load SKILL.md, parse arguments
  |  OK: Straightforward
  v
Command: Pre-flight checks (registry exists, MCP reachable)
  |  GAP: Does not check for concurrent auto-pilot session
  |  GAP: Does not validate MCP server version/capability
  v
Command: Display summary
  |  GAP: IN_PROGRESS count may be stale (no MCP reconciliation yet)
  v
Skill Step 1: Read orchestrator-state.md (if exists)
  |  GAP: No check for loop_status: RUNNING (concurrent session)
  |  OK: Reconciliation against MCP list_workers
  |  GAP: Reconciliation ignores workers with matching labels but not in state
  v
Skill Step 2: Read registry.md + task.md files
  |  OK: Handles missing/malformed task.md (skip + log)
  |  GAP: No validation of Priority field format
  |  GAP: No validation of Dependencies field format (could be free-text)
  v
Skill Step 3: Build dependency graph
  |  OK: Handles missing dependencies (mark BLOCKED)
  |  OK: Handles cycles (mark BLOCKED)
  |  GAP: CANCELLED dependencies not handled (silent deadlock)
  |  GAP: Cycle detection algorithm underspecified for complex graphs
  v
Skill Step 4: Order queue, calculate slots
  |  OK: Priority ordering clear
  |  OK: Slot calculation accounts for active workers
  v
Skill Step 5: Spawn workers
  |  OK: Prompt template includes autonomous mode instruction
  |  OK: Retry context for failed tasks
  |  GAP: State written after ALL spawns, not after each (orphan window)
  |  GAP: kill_worker return value not checked anywhere
  v
Skill Step 6: Monitor active workers
  |  GAP: Health detection relies on parsing free-text summary
  |  GAP: No time-based escalation to get_worker_stats
  |  GAP: "Wait for interval" has no implementation guidance
  |  OK: Two-strike stuck detection is well-specified
  |  OK: stuck_count reset for non-stuck workers
  v
Skill Step 7: Handle completions
  |  OK: completion-report.md as signal is well-defined
  |  OK: Retry with limit, escalate to BLOCKED
  |  OK: Re-evaluate dependency graph after completion
  |  OK: Post-completion stuck worker killing
  |  GAP: Cost not captured from completion stats
  v
Skill Step 8: Loop termination
  |  OK: Three-way check (no tasks + no workers = stop)
  |  OK: Final state with STOPPED status
  |  GAP: No maximum loop duration guard
```

### Gap Points Identified:
1. No concurrent session protection
2. `get_worker_activity` health parsing is unreliable
3. CANCELLED dependency status creates silent deadlock
4. State write timing creates orphan window during spawning
5. `kill_worker` success not verified
6. Per-worker MCP failures halt entire loop
7. Cost tracking omitted from state format

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| R1.1: YAML frontmatter with name + description | COMPLETE | None |
| R1.2: Core loop steps a-j in order | COMPLETE | Steps map correctly: a=Step 2, b=Step 3, c=Step 3, d=Step 4, e=Step 4, f=Step 5a, g=Step 5b, h=Step 6, i=Step 7, j=Step 8 |
| R1.3: State persistence after every significant event | PARTIAL | State is written after spawn batch (not each spawn) and after monitoring pass, but compaction between event and write is not addressed |
| R1.4: orchestrator-state.md format with required fields | PARTIAL | Missing "worker cost" in Completed Tasks per requirement spec |
| R1.5: Reference MCP tools by exact names | COMPLETE | All 5 tools referenced correctly with accurate signatures |
| R2.1: /auto-pilot no args -> process all | COMPLETE | None |
| R2.2: /auto-pilot TASK_ID -> single task | COMPLETE | But no guard against spawning duplicate for IN_PROGRESS task |
| R2.3: /auto-pilot --dry-run -> show plan | COMPLETE | Dry-run output format is well-designed with wave visualization |
| R2.4: Pre-flight checks (registry, MCP) | PARTIAL | Missing concurrent session check |
| R2.5: Command follows existing pattern | COMPLETE | Matches orchestrate.md pattern: Usage, Steps, Quick Reference, References |
| R2.6: Display summary before loop | COMPLETE | Clear summary format with all required metrics |
| R3.1: Parse registry rows | COMPLETE | None |
| R3.2: Extract Dependencies from task.md | COMPLETE | But no format validation guidance |
| R3.3: Unblocked classification logic | COMPLETE | Correct: CREATED + all deps COMPLETE |
| R3.4: Cycle detection | COMPLETE | Algorithm described but underspecified for complex graphs |
| R3.5: Missing dependency detection | COMPLETE | Marks BLOCKED + logs warning |
| R3.6: IN_PROGRESS detection (no duplicates) | COMPLETE | Checked via both registry and state |
| R4.1: Priority ordering P0 > P1 > P2 > P3 | COMPLETE | None |
| R4.2: Tiebreaker by task ID | COMPLETE | Lower NNN first |
| R4.3: Respect concurrency limit | COMPLETE | Slot calculation is correct |
| R4.4: All complete/blocked -> stop | COMPLETE | Step 8 handles this |
| R4.5: No unblocked + active workers -> monitor | COMPLETE | Step 8 handles this |
| R5.1: Prompt includes /orchestrate command | COMPLETE | None |
| R5.2: Prompt includes working directory | COMPLETE | None |
| R5.3: Autonomous mode (no checkpoints) | COMPLETE | Explicit instruction in prompt template |
| R5.4: Retry context for previous attempts | COMPLETE | Appended when retry_count > 0 |
| R5.5: Prompt suitable for spawn_worker | COMPLETE | None |
| R6.1: spawn_worker with correct params | COMPLETE | prompt, working_directory, label all specified |
| R6.2: Update registry to IN_PROGRESS on spawn | COMPLETE | None |
| R6.3: Record worker in state on spawn | COMPLETE | None |
| R6.4: Spawn failure -> leave CREATED, continue | COMPLETE | None |
| R6.5: Queue when concurrency exceeded | COMPLETE | Slot calculation handles this |
| R7.1: Configurable monitoring interval (10m default) | COMPLETE | But "wait" implementation unclear |
| R7.2: Finished -> completion handler | COMPLETE | None |
| R7.3: Stuck -> two-strike detection | COMPLETE | Well-specified with strike count |
| R7.4: high_context/compacting -> log only | COMPLETE | None |
| R7.5: Update state after monitoring | COMPLETE | None |
| R7.6: Prefer get_worker_activity over get_worker_stats | COMPLETE | Context efficiency rule is clear |
| R8.1: Check completion-report.md | COMPLETE | None |
| R8.2: Report exists -> COMPLETE | COMPLETE | None |
| R8.3: No report -> retry with limit -> BLOCKED | COMPLETE | None |
| R8.4: Re-evaluate graph after completion | COMPLETE | Goes back to Step 2 |
| R8.5: Kill stuck post-completion worker | COMPLETE | Wait one interval then kill |
| R9.1: State contains all required fields | PARTIAL | Missing worker cost |
| R9.2: Resume from state on start | COMPLETE | Step 1 handles recovery |
| R9.3: Validate active workers via list_workers | COMPLETE | Reconciliation logic is clear |
| R9.4: Atomic write (full overwrite) | COMPLETE | Explicitly stated |
| R9.5: Final state with STOPPED + summary | COMPLETE | None |
| R10.1: Worker failure -> continue loop | COMPLETE | None |
| R10.2: MCP unreachable -> 3 retries -> pause | COMPLETE | But too aggressive (Issue 6) |
| R10.3: Cycle -> BLOCKED + continue | COMPLETE | None |
| R10.4: Malformed task.md -> skip + continue | COMPLETE | None |
| R10.5: Unexpected error -> save state first | COMPLETE | None |
| R11.1: Configuration with defaults | COMPLETE | All 5 params with defaults |
| R11.2: Override via command arguments | COMPLETE | --concurrency, --interval, --retries, --stuck |
| R11.3: Defaults when no overrides | COMPLETE | Merge logic described |

### Implicit Requirements NOT Addressed:
1. **Concurrent session protection**: No mechanism to prevent two auto-pilot sessions from conflicting
2. **CANCELLED dependency handling**: Tasks depending on CANCELLED tasks are in limbo
3. **Cost tracking in state**: Requirements mention "worker cost" but implementation omits it
4. **Maximum loop duration / circuit breaker**: No guard against infinite looping
5. **Structured health detection fallback**: Over-reliance on free-text parsing for health assessment

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Empty registry (no tasks) | YES | Step 8: no unblocked + no workers = stop | None |
| All tasks COMPLETE already | YES | Step 3: all classified COMPLETE, Step 8: stop | None |
| Single task with no dependencies | YES | Step 3: classified UNBLOCKED, spawned normally | None |
| All tasks BLOCKED | YES | Step 8: no unblocked + no workers = stop | None |
| Worker finishes between monitoring checks | YES | Step 6: get_worker_stats returns finished, triggers Step 7 | Relies on accurate health detection |
| Compaction during spawn sequence | NO | State written after ALL spawns, not each | Orphaned workers possible (Issue 5) |
| Registry has IN_PROGRESS from crashed session | PARTIAL | Step 1 reconciliation checks MCP list | Workers not in state are ignored, even if they match task labels |
| Dependencies on CANCELLED tasks | NO | N/A | Silent deadlock (Issue 3) |
| Free-text Dependencies field | NO | N/A | Task treated as having no dependencies |
| Non-standard Priority format | NO | N/A | Unpredictable sort order |
| Concurrent auto-pilot sessions | NO | N/A | Duplicate workers, state conflicts (Issue 2) |
| MCP returns stale worker_id | PARTIAL | Retry logic triggers | But halts entire loop (Issue 6) |
| Worker killed externally (not via auto-pilot) | YES | Step 1 reconciliation detects missing worker | Correct handling |
| Rapid completion (worker finishes in < 1 monitoring interval) | YES | Next monitoring pass detects finished state | None |
| All unblocked tasks fail on first attempt | YES | Retry logic respawns, eventually BLOCKED if limit exceeded | None |
| Task depends on itself | PARTIAL | Cycle detection would catch A -> A | But algorithm description focuses on multi-node cycles |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| SKILL.md <-> Command | LOW | LOW | Command correctly loads skill and delegates |
| Auto-pilot <-> Orchestration skill (in workers) | LOW | MEDIUM | Prompt template correctly invokes /orchestrate; autonomous mode instruction present |
| Auto-pilot <-> MCP spawn_worker | LOW | HIGH | Parameters match MCP spec; spawn failure handling is solid |
| Auto-pilot <-> MCP get_worker_activity | MEDIUM | HIGH | Free-text summary parsing is unreliable for health detection |
| Auto-pilot <-> MCP get_worker_stats | LOW | LOW | Structured health field is reliable when called |
| Auto-pilot <-> MCP kill_worker | MEDIUM | MEDIUM | Return value not checked; kill failure creates orphans |
| Auto-pilot <-> registry.md | MEDIUM | HIGH | Concurrent write risk from multiple sessions; no format validation on read |
| Auto-pilot <-> orchestrator-state.md | MEDIUM | HIGH | Compaction between event and write; no session locking |
| Auto-pilot <-> completion-report.md | LOW | LOW | Simple file existence check; clear success/failure paths |
| Auto-pilot <-> task.md | MEDIUM | MEDIUM | No validation of Priority/Dependencies field formats |

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: The combination of unstructured health detection (Issue 1) and the lack of concurrent session protection (Issue 2) creates a scenario where the auto-pilot can both fail to detect stuck workers AND spawn duplicates. These are the two most likely production failures.

## What Robust Implementation Would Include

The deliverables are well-structured, comprehensive, and clearly written. The core loop logic is sound and the state management design is thoughtful. The skill covers the happy path thoroughly and handles many error cases. However, to be production-ready:

1. **Time-based health escalation**: Always call `get_worker_stats` for workers active longer than 2x stuck threshold, regardless of `get_worker_activity` output. This ensures structured health data is used for critical decisions.

2. **Concurrent session guard**: Check `loop_status: RUNNING` and state freshness on startup. Require `--force` to override. Write a session identifier into state.

3. **CANCELLED dependency handling**: Treat CANCELLED dependencies the same as missing dependencies -- mark the dependent task BLOCKED.

4. **Per-spawn state writes**: Write `orchestrator-state.md` after each individual spawn, not after the batch. Minimizes orphan window.

5. **`kill_worker` verification**: Check `success` return value. Verify worker is actually dead before removing from active list.

6. **Differentiated MCP error handling**: Per-worker MCP failures should not halt the entire loop. Only infrastructure-level failures should trigger loop pause.

7. **Cost tracking**: Add cost column to Completed Tasks in state format, capture from MCP stats on completion.

8. **Maximum loop duration guard**: Add a configurable maximum runtime (default: 24 hours) after which the loop pauses with a summary, requiring user intervention to continue.

Items 1-3 are the highest priority. Items 4-6 are important for reliability. Items 7-8 are nice-to-have improvements.
