# Code Logic Review - TASK_2026_003

## Review Summary

| Metric              | Value                                |
| ------------------- | ------------------------------------ |
| Overall Score       | 7.5/10                               |
| Assessment          | NEEDS_REVISION                       |
| Critical Issues     | 2                                    |
| Serious Issues      | 5                                    |
| Moderate Issues     | 4                                    |
| Failure Modes Found | 7                                    |

## The 5 Paranoid Questions

### 1. How does this fail silently?

**Registry write conflicts between concurrent workers.** Two workers finishing simultaneously both read `registry.md`, both write their state update. One write overwrites the other. The losing worker's state transition is silently lost. The Supervisor then sees "no transition" and treats a successful worker as failed, wasting a retry. There is no file-level locking or atomic compare-and-swap on `registry.md`. This is the single most dangerous silent failure in the design.

**Build Worker sets IMPLEMENTED but Review Worker is not spawned due to dependency check.** The READY_FOR_REVIEW classification requires "no deps OR all deps COMPLETE" (SKILL.md line 204). But a task that just reached IMPLEMENTED might have a dependency on another task that is only IMPLEMENTED itself (not COMPLETE). The task sits in IMPLEMENTED forever, never picked up for review, with no log message indicating why. The Supervisor silently skips it each iteration.

### 2. What user action causes unexpected behavior?

**Running `/auto-pilot TASK_X` on a task in IN_PROGRESS state.** The command pre-flight (auto-pilot.md line 57-60) says "If status is IN_PROGRESS or IN_REVIEW, the Supervisor will spawn the appropriate worker type to resume." But this means the Supervisor spawns a Build Worker for a task that already has a Build Worker running (from a previous all-tasks session or a parallel `/auto-pilot` invocation). The Concurrent Session Guard only prevents duplicate *supervisor* sessions, not duplicate workers for the same task across different supervisor sessions.

**User manually sets registry to IMPLEMENTED and runs `/auto-pilot`.** The Supervisor spawns a Review Worker. But if no implementation code exists (user jumped the state), the Review Worker runs reviewers on nothing and either crashes or produces empty reviews, then marks COMPLETE.

### 3. What data makes this produce wrong results?

**A task with dependencies listed as free-text instead of TASK_YYYY_NNN format.** Step 3 says "parse the Dependencies field into a list of task IDs." If the field says "Depends on the auth system being ready" instead of "TASK_2026_005", the parser either ignores it (silently dropping a real dependency) or fails to parse (skipping the task with no useful error).

**Registry with inconsistent whitespace or formatting.** The Supervisor parses markdown tables. A row with extra spaces, missing columns, or slightly different formatting could cause parse failures that silently skip tasks. No schema validation is mentioned for the registry format itself.

### 4. What happens when dependencies fail?

**MCP spawn_worker succeeds but the worker dies immediately.** The Supervisor records the worker in state and waits for the next monitoring interval (10 minutes by default). During those 10 minutes, no progress happens. The stuck detection then requires TWO consecutive intervals (20 more minutes minimum) before killing. A worker that dies at spawn wastes 30+ minutes before the Supervisor retries. The `get_worker_activity` / `get_worker_stats` calls should detect `finished` health state at the first check, but the 10-minute gap to first check is still a significant delay.

**Registry file becomes corrupted or deleted mid-loop.** Step 7a says "Read current registry state for the task." If `registry.md` is corrupted or missing at this point, the completion handler fails. The error handling section mentions "Unexpected Error" at line 734-740, which saves state and surfaces the error, but this stops the entire loop rather than gracefully handling one task.

### 5. What's missing that the requirements didn't mention?

**No mechanism to prevent two workers from writing to the same registry.md simultaneously.** This is the elephant in the room. Workers write registry updates (Build Worker sets IMPLEMENTED, Review Worker sets IN_REVIEW then COMPLETE). With concurrency 3, multiple workers could write `registry.md` at the same time. Markdown file writes are not atomic. There is zero mention of file locking, write ordering, or conflict resolution.

**No timeout on individual worker sessions.** The Supervisor monitors health and has two-strike stuck detection, but there is no maximum wall-clock time for a worker. A worker that makes just enough progress to avoid stuck detection but never finishes will run forever. There should be a max worker lifetime (e.g., 60 minutes for Build, 30 minutes for Review).

**No validation that the Review Worker prompt correctly scopes the orchestration.** The Review Worker prompt says "Run /orchestrate TASK_YYYY_NNN" and then adds instructions to skip PM/Architect/Dev. But `/orchestrate` with a task ID triggers CONTINUATION mode, which uses phase detection. If the orchestration skill's phase detection sees `tasks.md (all COMPLETE)` it goes to "Team-leader MODE 3 OR QA choice" -- which is correct. But if a retry Review Worker finds partial review files, the phase detection table has no entry for "some review files present but not all." It falls through to the most recent match, which might route incorrectly.

**No handling of partial state transitions.** What if a Review Worker sets IN_REVIEW in the registry (step 7 of the prompt) but then crashes before completing reviews? The Supervisor sees IN_REVIEW, spawns a Review Worker (correct). But what if the retry Review Worker's prompt says "If registry does not yet show IN_REVIEW, set it to IN_REVIEW" (line 566) -- it skips setting IN_REVIEW because it is already set. This is fine. But consider: what if the first Review Worker set IN_REVIEW AND wrote partial review files that are incomplete/truncated? The retry worker is told "Do NOT re-run reviews that already have output files" (line 559). It skips the review that has a truncated file, potentially missing critical findings.

---

## Failure Mode Analysis

### Failure Mode 1: Registry Write Race Condition

- **Trigger**: Two workers finish near-simultaneously and both write to `registry.md`
- **Symptoms**: One worker's state transition is silently overwritten. Supervisor sees "no transition" for the overwritten task and counts it as a failure.
- **Impact**: CRITICAL -- wastes retries, can cause a successfully-completed task to be marked BLOCKED after retry exhaustion
- **Current Handling**: None. No file locking, no atomic writes, no conflict detection.
- **Recommendation**: Either (a) workers write to per-task state files instead of a shared registry, (b) workers use a lock file protocol, or (c) the Supervisor mediates all registry writes (contradicts the "workers update registry" principle but is safer). At minimum, document this risk and recommend concurrency 1 for safety.

### Failure Mode 2: IMPLEMENTED Task Stuck Due to Dependency Check

- **Trigger**: Task A depends on Task B. Both are being built. Task A finishes first (IMPLEMENTED). Task B is still IN_PROGRESS.
- **Symptoms**: Task A sits at IMPLEMENTED and never enters the Review Queue because Task B is not COMPLETE.
- **Impact**: SERIOUS -- Task A is blocked from review until Task B completes its entire lifecycle (build + review). This could be correct behavior IF the dependency is truly a code dependency, but in many cases reviews are independent of upstream code.
- **Current Handling**: The dependency check at Step 3 (line 204) applies the same rule to READY_FOR_REVIEW as READY_FOR_BUILD. No distinction is made.
- **Recommendation**: Consider whether review-phase dependencies should be relaxed. A task that is IMPLEMENTED has its code committed. If a downstream task depends on it, the dependency is already satisfied at the code level. The review of the upstream task should not block the review of the downstream task. At minimum, document this design decision explicitly.

### Failure Mode 3: Retry Review Worker Skips Truncated Review Files

- **Trigger**: Review Worker crashes mid-review, leaving a truncated `code-style-review.md`. Retry Review Worker spawns.
- **Symptoms**: Retry worker sees the file exists and skips re-running that review. Truncated/incomplete review is treated as complete.
- **Impact**: SERIOUS -- review findings are lost, quality gate is undermined
- **Current Handling**: Retry prompt says "Do NOT re-run reviews that already have output files" (line 559). No validation of file completeness.
- **Recommendation**: Add a check: review files must contain a "Verdict" or "Score" section to be considered complete. If missing, re-run that review.

### Failure Mode 4: Build Worker Sets IN_PROGRESS, Supervisor Doesn't Know

- **Trigger**: Build Worker starts, transitions registry from CREATED to IN_PROGRESS. Supervisor reads registry on next loop.
- **Symptoms**: No issue in normal flow. BUT: if the Supervisor reads registry between the worker being spawned and the worker updating the registry, the task is still CREATED. The Supervisor might try to spawn a second Build Worker for the same task.
- **Impact**: SERIOUS -- duplicate workers for the same task
- **Current Handling**: Principle 7 says "Never spawn duplicate workers -- check both registry (IN_PROGRESS/IN_REVIEW) and state (active workers)". The state check should catch this since the worker is in the active workers table. But this relies on the state check being evaluated BEFORE the registry-based classification.
- **Recommendation**: Step 3 should explicitly exclude tasks that have active workers in the state table, regardless of registry status. Add this as a formal classification rule, not just a principle.

### Failure Mode 5: Concurrent Session Guard Bypass

- **Trigger**: User starts `/auto-pilot` in terminal A. Before it writes RUNNING to state, user starts `/auto-pilot` in terminal B.
- **Symptoms**: Both sessions enter the loop, both spawn workers, competing for the same tasks.
- **Impact**: SERIOUS -- duplicate workers, conflicting state writes
- **Current Handling**: The guard checks if `Loop Status` is `RUNNING` on startup. But there is a TOCTOU window between reading and writing the state file.
- **Recommendation**: This is inherent to file-based locking. Document the limitation. Consider adding a PID or timestamp to the lock to detect stale locks more reliably.

### Failure Mode 6: Single-Task Mode Chains Build to Review Without Re-validating

- **Trigger**: `/auto-pilot TASK_X` where TASK_X is CREATED. Build Worker finishes, state transitions to IMPLEMENTED. Command logic automatically spawns Review Worker.
- **Symptoms**: If the Build Worker introduced a build-breaking change that only manifests during review (e.g., deleted a file referenced by tests), the Review Worker immediately runs into it.
- **Impact**: MODERATE -- this is expected behavior but there is no pause between Build and Review to let the user inspect the implementation.
- **Current Handling**: The command description (auto-pilot.md line 113-117) says this is automatic. No opt-out.
- **Recommendation**: Consider adding a `--build-only` flag for single-task mode that stops at IMPLEMENTED. This gives users an inspection point.

### Failure Mode 7: Compaction Count Not Reset on Re-run

- **Trigger**: Supervisor session compacts twice, saves state, stops. User re-runs `/auto-pilot`.
- **Symptoms**: The SKILL.md says "if the session has already compacted twice ... gracefully stop the loop" (line 105). If the compaction count is persisted in `orchestrator-state.md` and not reset on a fresh `/auto-pilot` invocation, the new session immediately stops.
- **Impact**: MODERATE -- user cannot continue processing without manually editing state file
- **Current Handling**: The state file format (line 655) shows `Compaction Count: 0` but there is no explicit instruction to reset this on a new session start.
- **Recommendation**: Step 1 recovery should reset `Compaction Count` to 0 when starting a new supervisor invocation (reading existing state for recovery, but resetting session-scoped counters).

---

## Critical Issues

### Issue 1: Registry Write Race Condition -- No Concurrency Protection

- **File**: `.claude/skills/auto-pilot/SKILL.md` (throughout, especially lines 47, 267, 514, 519-520)
- **Scenario**: With concurrency > 1, two workers can write to `registry.md` simultaneously. Worker A reads the file, Worker B reads the file, Worker A writes IMPLEMENTED for its task, Worker B writes COMPLETE for its task -- overwriting Worker A's change.
- **Impact**: Silent state loss. The Supervisor treats the overwritten task as "no transition" and wastes retries. Can cause a successfully-completed task to reach BLOCKED status.
- **Evidence**: The design explicitly states "Workers update the registry themselves" (line 47, 757) and supports concurrency up to N workers. Registry is a single shared markdown file. No locking or conflict resolution is mentioned anywhere.
- **Fix**: Either (1) switch to per-task state files (e.g., `TASK_YYYY_NNN/status.md`) that only one worker writes, (2) have the Supervisor mediate all registry writes via a queue, or (3) document this as a known limitation and recommend `--concurrency 1` until file-level locking is implemented.

### Issue 2: No Guard Against Spawning Duplicate Workers for the Same Task

- **File**: `.claude/skills/auto-pilot/SKILL.md:204-210` (Step 3 classification) and lines 241-277 (Step 5 spawning)
- **Scenario**: The Supervisor's Step 3 classifies tasks by registry status. If a Build Worker was just spawned but has not yet updated the registry from CREATED to IN_PROGRESS, the next loop iteration sees the task as READY_FOR_BUILD and spawns another worker.
- **Impact**: Two Build Workers working on the same task simultaneously, producing conflicting commits and state.
- **Evidence**: Principle 7 (line 758) says to check "both registry and state (active workers)" but Step 3 classification (lines 200-210) only uses registry status. Step 5 does not include an explicit "skip if task has active worker in state" check.
- **Fix**: Add an explicit step between Step 3 and Step 4: "Exclude any task from the Build Queue or Review Queue if it already has an active worker in `orchestrator-state.md`." Make this a formal rule in the classification table, not just a principle.

---

## Serious Issues

### Issue 3: READY_FOR_REVIEW Dependency Check May Block Reviews Unnecessarily

- **File**: `.claude/skills/auto-pilot/SKILL.md:204`
- **Scenario**: Task A depends on Task B. Task A is IMPLEMENTED. Task B is IN_PROGRESS (or IMPLEMENTED but not yet COMPLETE). Task A cannot enter the Review Queue.
- **Impact**: Reviews are delayed until ALL dependencies complete their full lifecycle (including review), even though the code dependency is already satisfied at IMPLEMENTED.
- **Evidence**: Line 204: `READY_FOR_REVIEW | Status is IMPLEMENTED AND (no dependencies OR all dependencies have status COMPLETE)`. No nuance between build-time and review-time dependencies.
- **Fix**: Either relax the dependency check for reviews (deps only need to be IMPLEMENTED or later), or document this as intentional behavior with rationale.

### Issue 4: Retry Review Worker Told to Skip Existing Review Files Without Completeness Check

- **File**: `.claude/skills/auto-pilot/SKILL.md:559`
- **Scenario**: First Review Worker crashes mid-review, leaving a truncated review file. Retry worker skips it.
- **Impact**: Incomplete reviews are treated as complete. Quality gate is bypassed.
- **Evidence**: Line 559: "Do NOT re-run reviews that already have output files."
- **Fix**: Add instruction: "Verify each existing review file contains a Verdict/Score section. If truncated or missing final sections, re-run that review."

### Issue 5: Step 1 Reconciliation Has Redundant/Overlapping Sub-steps

- **File**: `.claude/skills/auto-pilot/SKILL.md:139-161`
- **Scenario**: Steps 4 and 5 in the recovery check overlap. Step 4 handles "Task active in state but COMPLETE in registry" and "Task active in state but CREATED in registry". Step 5 then handles the SAME "COMPLETE in registry" case again, plus IMPLEMENTED and IN_REVIEW cases.
- **Impact**: Confusing for the Supervisor agent. Ambiguous which reconciliation rule takes precedence. Could lead to double-processing of the same case.
- **Evidence**: Line 153-155 (step 4) and lines 156-160 (step 5) both cover "COMPLETE in registry" case.
- **Fix**: Merge steps 4 and 5 into a single reconciliation pass. Remove the duplicate COMPLETE case. The merged step should cover all registry states systematically.

### Issue 6: Review Worker Prompt Ordering -- IN_REVIEW Set Before Reviews Run

- **File**: `.claude/skills/auto-pilot/SKILL.md:514`
- **Scenario**: Review Worker prompt step 7 says "Update registry.md: set task status to IN_REVIEW BEFORE starting reviews." But the Exit Gate (step 9) expects registry to show COMPLETE. If the worker crashes after setting IN_REVIEW but before completing, the Supervisor sees IN_REVIEW and spawns a retry Review Worker -- which is correct. However, if the worker sets IN_REVIEW, runs reviews, then crashes before setting COMPLETE, the Supervisor sees IN_REVIEW and checks expected_end_state (COMPLETE). State did not transition to COMPLETE, so it counts as failure.
- **Impact**: This is actually correct behavior per the design (retry the worker). But the `expected_end_state` tracking needs to handle the intermediate IN_REVIEW transition. The Supervisor records expected_end_state=COMPLETE for Review Workers. If the worker sets IN_REVIEW (intermediate state), the Supervisor should NOT treat this as the expected transition.
- **Evidence**: Step 7b (line 332-335): "Look up expected_end_state from orchestrator-state.md for this worker. Read current state from registry." If current is IN_REVIEW and expected is COMPLETE, it falls into 7d (no transition). This is correct.
- **Fix**: This is actually working as designed. Downgrading from Serious to a documentation note: clarify in the SKILL.md that IN_REVIEW is an intermediate state and the Supervisor only considers COMPLETE as the successful end state for Review Workers. The current logic handles it correctly but the intent should be documented.

### Issue 7: Build Worker Prompt Does Not Instruct Setting IN_PROGRESS

- **File**: `.claude/skills/auto-pilot/SKILL.md:399-439`
- **Scenario**: The Build Worker prompt instructs the worker to set IMPLEMENTED after completion (step 3b, line 416-417). But it does NOT instruct the worker to set IN_PROGRESS when starting. The state transition table (implementation-plan.md line 57) says "Build Worker" sets CREATED -> IN_PROGRESS.
- **Impact**: If the Build Worker never sets IN_PROGRESS, the registry stays at CREATED during the entire build. If the Supervisor loops and checks (and the active-worker state check fails for any reason), it could spawn a duplicate.
- **Evidence**: First-Run Build Worker Prompt (lines 399-438): no instruction to set registry to IN_PROGRESS. Retry Build Worker Prompt (lines 442-482): also no instruction to set IN_PROGRESS.
- **Fix**: Add to the Build Worker prompt: "FIRST: Update registry.md to set task status to IN_PROGRESS (so Supervisor knows you started)." This mirrors the Review Worker prompt which explicitly sets IN_REVIEW first (line 514).

---

## Moderate Issues

### Issue 8: Compaction Count Not Explicitly Reset on New Session

- **File**: `.claude/skills/auto-pilot/SKILL.md:105, 655`
- **Scenario**: Compaction count persisted in state file. New `/auto-pilot` invocation reads state but may inherit the old compaction count.
- **Impact**: New session could immediately stop if previous session hit the compaction limit.
- **Fix**: Add to Step 1: "Reset Compaction Count to 0 when starting a new supervisor session."

### Issue 9: No Maximum Worker Lifetime

- **File**: `.claude/skills/auto-pilot/SKILL.md` (Step 6 monitoring section)
- **Scenario**: A worker that makes minimal progress each interval avoids stuck detection but never completes.
- **Impact**: Worker runs indefinitely, consuming a concurrency slot forever.
- **Fix**: Add a max lifetime parameter (e.g., 60 minutes). If exceeded, kill the worker regardless of health state.

### Issue 10: Exit Gate "Findings Fixed" Check Is Ambiguous

- **File**: `.claude/skills/orchestration/SKILL.md:350-351`
- **Scenario**: Review Worker Exit Gate says "Check review files for BLOCKING/SERIOUS items" and expects "All blocking/serious items resolved." But how does the worker verify items are "resolved"? The review file is a static document. The worker would need to re-read the review, check each finding, and verify the code was changed.
- **Impact**: The check is aspirational but not mechanically verifiable. The worker likely just checks if the review file exists, not that every finding was addressed.
- **Fix**: Either make the check concrete (e.g., "review file Verdict section says APPROVED or NEEDS_REVISION with no CRITICAL issues remaining") or acknowledge this is a best-effort human-readable check.

### Issue 11: Orchestration SKILL.md Phase Detection Table Missing IMPLEMENTED Status at tasks.md Level

- **File**: `.claude/skills/orchestration/references/task-tracking.md:241-249`
- **Scenario**: The task-tracking reference adds IMPLEMENTED as a tasks.md-level status (line 247). The phase detection table (line 194) has an entry for "tasks.md (has IMPLEMENTED)" -> "Dev done, await verify". But the Build Worker is told to set all tasks.md entries to COMPLETE before marking the registry IMPLEMENTED. So when does tasks.md show IMPLEMENTED? Only during active development between batches.
- **Impact**: Potential confusion about the relationship between tasks.md IMPLEMENTED status and registry IMPLEMENTED status. They represent different things at different levels.
- **Fix**: Add a clarifying note distinguishing tasks.md-level IMPLEMENTED (sub-task code done, awaiting team-leader verification) from registry-level IMPLEMENTED (all development done, awaiting review phase).

---

## Data Flow Analysis

```
User runs /auto-pilot
  |
  v
Command (auto-pilot.md) -- parses args, pre-flight checks
  |
  v
Loads SKILL.md -- Supervisor loop logic
  |
  v
Step 1: Read orchestrator-state.md (if exists)
  |-- Reconcile state vs MCP (list_workers)
  |-- Reconcile state vs registry  <-- ISSUE: Redundant steps 4 and 5
  |
  v
Step 2: Read registry.md + task.md files
  |-- Parse task metadata
  |-- Step 2b: Validate CREATED tasks  <-- Good: prevents vague tasks
  |
  v
Step 3: Build dependency graph
  |-- Classify tasks into queues
  |-- ISSUE: No exclusion of tasks with active workers in state
  |
  v
Step 4: Order queues (Review priority > Build priority)  <-- Good design
  |
  v
Step 5: Spawn workers via MCP
  |-- Determine worker type from state
  |-- Generate prompt from template
  |-- Call spawn_worker
  |-- Record in state  <-- Good: writes after each spawn
  |
  v
Worker Session (independent process)
  |-- Runs /orchestrate TASK_ID
  |-- Updates registry.md  <-- ISSUE: No file locking, concurrent writes
  |-- Build: CREATED -> IN_PROGRESS -> IMPLEMENTED
  |     ^-- ISSUE: IN_PROGRESS transition not in prompt
  |-- Review: IMPLEMENTED -> IN_REVIEW -> COMPLETE
  |
  v
Step 6: Monitor workers (configurable interval)
  |-- get_worker_activity (routine)
  |-- get_worker_stats (escalation)
  |-- Two-strike stuck detection  <-- Good design
  |
  v
Step 7: Handle completions
  |-- Check expected_end_state vs actual registry state
  |-- Success: move to completed, trigger re-evaluation
  |-- Failure: increment retry, optionally BLOCKED
  |
  v
Step 8: Loop termination check
  |-- All done or all blocked -> STOP
  |-- Active workers -> monitor
  |-- Actionable tasks -> spawn
```

### Gap Points Identified:

1. **Registry concurrent write** -- workers write without locking (between Step 5 spawn and Step 7 completion check)
2. **Active worker exclusion** -- Step 3 classification does not cross-reference state's active workers table
3. **IN_PROGRESS not set by Build Worker** -- gap in state machine, task stays CREATED during build
4. **Review file completeness** -- retry workers skip existing files without verifying they are complete

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| Auto-pilot SKILL.md renamed to Supervisor | COMPLETE | Terminology consistent throughout |
| Task states expanded: CREATED -> IN_PROGRESS -> IMPLEMENTED -> IN_REVIEW -> COMPLETE | COMPLETE | States well-defined with clear ownership |
| Two worker session types defined | COMPLETE | Build and Review Workers have distinct prompts and scopes |
| Supervisor spawn logic: spawns correct worker type | COMPLETE | Step 5a correctly maps state to worker type |
| Supervisor failure handling: respawn same worker type | COMPLETE | Step 7d handles no-transition correctly |
| Orchestration SKILL.md updated with Exit Gate | COMPLETE | Both Build and Review gates defined |
| Build Worker prompt scoped to stop after IMPLEMENTED | COMPLETE | Prompt explicitly says "You do NOT run reviews" |
| Review Worker prompt scoped to reviews + completion | COMPLETE | Prompt correctly scopes QA + completion phase |
| Task-tracking reference updated with new states | COMPLETE | Registry and tasks.md status tables updated |
| Registry format supports new states | COMPLETE | Example shows IMPLEMENTED, IN_REVIEW |

### Implicit Requirements NOT Addressed:

1. **Registry file concurrency control** -- the most critical gap, not mentioned in requirements but essential for correctness with concurrency > 1
2. **Build Worker setting IN_PROGRESS in registry** -- the state transition table defines it but the worker prompt does not instruct it
3. **Maximum worker lifetime** -- stuck detection handles frozen workers but not slow-but-progressing workers
4. **Review file completeness validation on retry** -- retry prompts skip existing files without quality check

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| Worker dies immediately after spawn | YES | First monitoring check sees `finished` health | 10-minute delay to detect |
| Two workers write registry simultaneously | NO | No file locking | **Critical -- data loss** |
| Task has circular dependency | YES | Cycle detection marks all as BLOCKED | Well-designed |
| MCP server unreachable mid-loop | YES | Scoped retry with graceful pause | Good |
| Worker stuck but making minimal progress | PARTIAL | Two-strike stuck detection | No max lifetime |
| Task.md missing or malformed | YES | Logged and skipped | Good |
| Registry corrupted | PARTIAL | Unexpected error handler saves state | Stops entire loop |
| Compaction during spawn sequence | YES | State written after each spawn | Good design |
| Supervisor compacts during monitoring | YES | orchestrator-state.md survives | Well-designed |
| Build Worker never sets IN_PROGRESS | NOT HANDLED | Prompt does not instruct it | Duplicate spawn risk |
| Retry Review Worker with truncated review files | NOT HANDLED | Prompt says skip existing files | Incomplete reviews |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Workers -> registry.md concurrent write | HIGH (with concurrency > 1) | Silent state loss | NONE -- needs file locking or per-task state |
| Supervisor -> MCP spawn_worker | LOW | Worker not spawned | Logged, retried next iteration |
| Supervisor -> MCP get_worker_activity | LOW | Health unknown | Scoped retry, skip worker for this pass |
| Worker -> /orchestrate phase detection | MEDIUM | Worker runs wrong phase | Phase detection is file-based, generally robust |
| Supervisor -> orchestrator-state.md | LOW | State lost on corruption | Written after each change, markdown format |
| Worker -> Exit Gate self-validation | MEDIUM | Worker exits without clean state | Supervisor detects missing transition |

---

## Verdict

**Recommendation**: NEEDS_REVISION
**Confidence**: HIGH
**Top Risk**: Registry concurrent write race condition with concurrency > 1

The state machine design is solid. The two-worker split, priority ordering (Review > Build), two-strike stuck detection, and recovery protocol are all well-thought-out. The prompts are clearly scoped and the Exit Gate concept adds a valuable safety net.

However, two issues need addressing before this design is production-ready:

1. **The registry write race condition** is a fundamental correctness issue that undermines the "workers update the registry" principle when concurrency > 1. This needs at minimum a documented mitigation strategy.

2. **The Build Worker prompt must instruct setting IN_PROGRESS** to close the gap in the state machine. Without this, the CREATED -> IN_PROGRESS transition defined in the state table is never executed, and the Supervisor's duplicate-spawn protection is weakened.

The remaining serious/moderate issues are worth fixing but are not blockers if the above two are resolved and the others are documented as known limitations.

## What Robust Implementation Would Include

Beyond what is currently implemented, a bulletproof version would add:

- **Per-task state files** (e.g., `TASK_YYYY_NNN/status`) instead of a shared registry for worker writes, eliminating all concurrent-write risks
- **Explicit IN_PROGRESS instruction** in the Build Worker prompt, mirroring the Review Worker's IN_REVIEW instruction
- **Review file completeness validation** in retry prompts (check for Verdict/Score section)
- **Maximum worker lifetime** parameter (kill workers exceeding a wall-clock limit)
- **Step 3 active-worker exclusion** as a formal classification rule, not just a principle
- **Merged reconciliation steps** (combine overlapping steps 4 and 5 in Step 1)
- **Compaction count reset** on new session start
- **Dependency relaxation for reviews** (IMPLEMENTED deps sufficient for READY_FOR_REVIEW)
