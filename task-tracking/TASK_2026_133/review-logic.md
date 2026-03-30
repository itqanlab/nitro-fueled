# Code Logic Review — TASK_2026_133

**Reviewer**: nitro-code-logic-reviewer
**Score**: 6/10

---

## Review Summary

| Metric              | Value                |
|---------------------|----------------------|
| Overall Score       | 6/10                 |
| Assessment          | NEEDS_REVISION       |
| Critical Issues     | 2                    |
| Serious Issues      | 3                    |
| Moderate Issues     | 3                    |
| Failure Modes Found | 5                    |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The most dangerous silent failure: SKILL.md Step 5 (Build sequential task queue) explicitly excludes IMPLEMENTED tasks with the comment "sequential mode does not run review workers." However, the SKILL.md Sequential Mode Flow Step 6e handles the case where a task ends up in `IMPLEMENTED` or `IN_REVIEW` status, labeling it `SEQUENTIAL PARTIAL`. The agent executing inline via the orchestration skill *should* drive the task all the way to COMPLETE — but what happens if the orchestration skill stops at IMPLEMENTED (e.g., the review phase is optional or skipped for that task type)? The partial-state handling is documented in Step 6e, but there is no explicit instruction to the subagent to push through to COMPLETE. The subagent receives "read SKILL.md and execute the full pipeline" — it might stop at IMPLEMENTED if the task's `Testing: skip` metadata triggers a different terminal state.

A second silent failure: Step 7 (teardown) commits session artifacts with `git commit`. If git is in a dirty state (uncommitted work from a previous operation), this commit may sweep in unrelated files. There is no `git add` scoping instruction — only a commit message template. No guard against accidental commits of non-session files.

### 2. What user action causes unexpected behavior?

`/auto-pilot --sequential TASK_X` where TASK_X exists but has status IMPLEMENTED (not CREATED). The command's Step 3d validates that single-task mode allows CREATED *or* IMPLEMENTED, and handles IN_PROGRESS/IN_REVIEW as "spawn appropriate worker." But the SKILL.md Sequential Flow Step 5 explicitly states: *"Filter: include only CREATED tasks (IMPLEMENTED tasks are skipped — sequential mode does not run review workers)"* and *"If single_task_mode: verify it is CREATED or error."*

This creates a direct conflict: the command entry point (Step 3d) allows IMPLEMENTED in single-task mode; the SKILL.md sequential flow rejects it (or more precisely, the queue-building step would exclude it). The user passing `--sequential TASK_X` where TASK_X is IMPLEMENTED gets inconsistent behavior — no clear error, and the queue is empty, so execution silently does nothing or errors without a useful message.

### 3. What data makes this produce wrong results?

`--sequential --limit 0` is documented as "unlimited" (`sequential_limit = N`, `0 = unlimited`) in the SKILL.md flag parsing section. However, the Configuration table in the same SKILL.md says `--limit N` means "stop after N tasks reach a terminal state (COMPLETE/FAILED/BLOCKED). 0 = process entire backlog." The Key Differences table in the Sequential section says: *"--limit N | Tasks to COMPLETE terminal state | Tasks to start."* So `--limit 0` in sequential mode means unlimited tasks to *start*, while in parallel mode it means unlimited tasks to *reach a terminal state*. That asymmetry is documented in the table, but the *semantics of 0* (unlimited) are shared. This is fine for `--limit 0` specifically, but it exposes a latent confusion: `--limit 3` in sequential mode caps how many tasks are *started*, not how many reach a terminal state. A task that retries twice counts as 1 against the limit even though it ran 3 times. This is not wrong per the documented behavior, but the "tasks to start" vs "tasks to complete" distinction creates a surprising experience when retries are involved.

### 4. What happens when dependencies fail?

When the subagent invoked in Step 6d (inline orchestration) crashes or throws an unhandled exception (e.g., context limit exceeded mid-task), the Agent tool returns an error. Step 6e only checks the task's status file for `IN_PROGRESS` or `CREATED` (unchanged) and treats that as a failure to retry. However, there is no guard against the case where the Agent tool itself fails to return at all (hard context limit hit, Claude exits the subagent without writing any status). The subagent may leave the task in `IN_PROGRESS` permanently if it exits abnormally. The retry logic re-queues and re-invokes, but it will keep retrying a fundamentally broken state. The retry limit provides an upper bound, but there is no instruction to reset the task status back to CREATED before retrying — so the subagent on retry may see `IN_PROGRESS` and either treat it as a resume (if orchestration SKILL handles that) or start fresh but leave the previous partial work in an indeterminate state.

### 5. What's missing that the requirements didn't mention?

**Window close during sequential execution**: if the user closes the Claude Code session while a subagent is running inline, the session artifacts (log.md, state.md) are never finalized. The task status is left as IN_PROGRESS with no recovery path. Neither SKILL.md nor the command describe what happens on session interruption in sequential mode. The Stale Archive Check (Step 3a) would handle the log.md on next startup, but the IN_PROGRESS task status requires manual intervention — there is no instruction to detect "task was IN_PROGRESS when session started and sequential mode is about to run it" vs "task was left IN_PROGRESS by a crashed prior sequential run."

**Concurrent Session Guard interaction**: the SKILL.md Sequential Mode Flow (Step 3 Session Setup) correctly registers in `active-sessions.md` with source `auto-pilot-sequential`. However, the Concurrent Session Guard in SKILL.md reads `active-sessions.md` and looks for rows with Source `auto-pilot`. If `auto-pilot-sequential` is a different source string, the guard may not detect a running sequential session as a conflict. This could allow a user to start a second sequential (or parallel) supervisor against the same task queue without the expected warning.

---

## Failure Mode Analysis

### Failure Mode 1: IMPLEMENTED-task conflict between command and SKILL

- **Trigger**: User runs `/auto-pilot --sequential TASK_X` where TASK_X status is IMPLEMENTED
- **Symptoms**: Command Step 3d accepts the invocation (IMPLEMENTED is allowed in single-task mode). SKILL.md Sequential Flow Step 5 then either silently empties the queue (because it filters to CREATED only) or errors with an unclear message ("verify it is CREATED or error")
- **Impact**: User expects the task to proceed, gets silent no-op or ambiguous error. Task remains IMPLEMENTED indefinitely.
- **Current Handling**: Conflicting — Step 3d in command allows IMPLEMENTED; SKILL Step 5 rejects it
- **Recommendation**: Either extend sequential mode to handle IMPLEMENTED tasks (invoke review phase inline) or make Step 3d explicitly reject IMPLEMENTED tasks when `--sequential` is set, with a clear error: "Sequential mode only handles CREATED tasks. TASK_X is IMPLEMENTED — use parallel mode or run review manually."

### Failure Mode 2: Task status not reset before retry

- **Trigger**: Subagent for TASK_X exits abnormally, leaving status as IN_PROGRESS. Retry is triggered.
- **Symptoms**: On retry, subagent reads task folder and sees IN_PROGRESS. The orchestration skill may attempt to resume a partial state, or may start fresh and double-apply work. Either way, the supervisor cannot detect this inconsistency.
- **Impact**: Corrupted task state (partially applied changes, duplicate commits). In the worst case, the task appears to fail all retries and gets BLOCKED without a clear reason.
- **Current Handling**: Not addressed. Step 6d re-invokes the Agent without resetting task status to CREATED first.
- **Recommendation**: Before re-invoking the Agent on retry (Step 6d), explicitly reset task status file to CREATED. Log: `SEQUENTIAL RETRY RESET — TASK_X: reset status to CREATED for attempt {N}`.

### Failure Mode 3: Concurrent Session Guard blind to sequential mode source

- **Trigger**: User starts `/auto-pilot --sequential`, then (in another window or after a crash recovery) starts another `/auto-pilot` or `/auto-pilot --sequential`
- **Symptoms**: The Concurrent Session Guard checks for rows with Source `auto-pilot`. Sequential mode registers with Source `auto-pilot-sequential`. The guard does not match this source string, so concurrent sessions proceed without the expected warning.
- **Impact**: Two sessions process the same task queue simultaneously. The first session sets a task to IN_PROGRESS; the second session also picks it up (it was CREATED when the second session read the queue). Double execution.
- **Current Handling**: Guard only checks for `auto-pilot` source — `auto-pilot-sequential` is a different token.
- **Recommendation**: Expand the Concurrent Session Guard to also check for rows with Source matching `auto-pilot-sequential`. Both source strings represent a supervisor running. Alternatively, use `auto-pilot` as the source for sequential mode (distinguishing the session type in a separate column).

### Failure Mode 4: Step 5 Display Summary is not updated for sequential mode

- **Trigger**: User runs `/auto-pilot --sequential`
- **Symptoms**: Step 5 (Display Summary) always shows "Concurrency limit: {N}" and "Monitoring interval: {N} minutes" — both are inapplicable to sequential mode. It also shows "Mode: {all | single-task TASK_ID | dry-run}" with no option for `sequential`.
- **Impact**: Display is misleading and confusing. The mode line doesn't reflect sequential, and concurrency/interval numbers are meaningless.
- **Current Handling**: Step 5 has no sequential-mode branch and no instruction to omit or replace parallel-mode fields.
- **Recommendation**: Add a conditional display path in Step 5: if `sequential_mode = true`, replace concurrency/interval with `Sequential limit: {N or unlimited}` and set Mode to `sequential (inline)` or `sequential single-task TASK_X`.

### Failure Mode 5: Session teardown git commit scope undefined

- **Trigger**: Sequential session teardown (Step 7)
- **Symptoms**: The commit instruction says `git commit -m "docs: sequential session artifacts for {TASK_X} (and others if batch)"` but does not specify which files to `git add`. Without explicit staging, this either commits nothing (if no files are auto-staged) or commits everything staged from previous operations.
- **Impact**: Either silently produces an empty commit or accidentally commits unrelated staged files.
- **Current Handling**: No `git add` instruction before the commit. Parallel mode's teardown step (Step 8d) has the same issue but is a pre-existing gap. Sequential mode introduces a new commit path that inherits this unresolved problem.
- **Recommendation**: Before the commit in Step 7, explicitly stage only the session artifacts: `git add task-tracking/sessions/{SESSION_ID}/ task-tracking/active-sessions.md task-tracking/orchestrator-history.md`.

---

## Critical Issues

### Issue 1: IMPLEMENTED single-task mode conflict

- **File**: `.claude/commands/nitro-auto-pilot.md:101-104` and `.claude/skills/auto-pilot/SKILL.md:279`
- **Scenario**: `/auto-pilot --sequential TASK_X` where TASK_X is IMPLEMENTED
- **Impact**: Command proceeds (Step 3d passes), but sequential queue-builder silently excludes the task. User sees a session start, then an immediate STOPPED with 0 completed tasks, with no explanation.
- **Evidence**:
  - Command Step 3d: "verify the task ID exists in the registry and its status is CREATED **or IMPLEMENTED**"
  - SKILL.md Step 5: "Filter: include only CREATED tasks (IMPLEMENTED tasks are skipped — sequential mode does not run review workers)" and "If single_task_mode: scope to target_task_id only (verify it is **CREATED** or error)"
- **Fix**: Add an explicit guard in the command's `--sequential` parsing (Step 2 argument parsing): "If `single_task_mode = true` AND the task status is IMPLEMENTED: ERROR — 'Sequential mode processes CREATED tasks only. TASK_X is IMPLEMENTED. Run /auto-pilot TASK_X (parallel mode) to execute the review phase.'" Alternatively, define a clear sequential review path.

### Issue 2: No status reset before retry — potential double-execution

- **File**: `.claude/skills/auto-pilot/SKILL.md:313-320` (Step 6e retry branch)
- **Scenario**: Task subagent exits abnormally mid-execution, leaving status as IN_PROGRESS. Retry re-invokes the Agent.
- **Impact**: The orchestration subagent receives a task in IN_PROGRESS state. Depending on the orchestration SKILL's handling of existing IN_PROGRESS status, it may resume from an inconsistent partial state or apply changes twice.
- **Evidence**: Step 6e retry branch: "Increment retry count ... Re-add task to front of queue (retry immediately)" — no reset of status file.
- **Fix**: Insert before the re-queue step: "Write `task-tracking/TASK_X/status` = CREATED (reset for clean retry). Log: `SEQUENTIAL RETRY RESET — TASK_X: status reset to CREATED for attempt {N}/{retry_limit}`."

---

## Serious Issues

### Issue 3: Concurrent Session Guard does not cover `auto-pilot-sequential`

- **File**: `.claude/skills/auto-pilot/SKILL.md:1430-1439` (Concurrent Session Guard) and SKILL.md:266 (Sequential Setup)
- **Scenario**: A sequential session is running (registered with Source `auto-pilot-sequential`). User starts a second supervisor.
- **Impact**: Second supervisor proceeds without warning; both process the same task queue simultaneously.
- **Fix**: Change sequential session registration to use Source `auto-pilot` (with a type sub-field if needed), OR update the Concurrent Session Guard to match both `auto-pilot` and `auto-pilot-sequential`.

### Issue 4: Step 5 Display Summary has no sequential mode branch

- **File**: `.claude/commands/nitro-auto-pilot.md:238-255`
- **Scenario**: Any sequential mode invocation
- **Impact**: Misleading output showing concurrency limit and monitoring interval (both N/A for sequential mode). Mode field shows no sequential option.
- **Fix**: Add a conditional block: if `sequential_mode = true`, omit concurrency/interval lines, add `Sequential limit: {N | unlimited}`, set Mode to `sequential`.

### Issue 5: Session teardown git commit has no `git add` instruction

- **File**: `.claude/skills/auto-pilot/SKILL.md:328-329` (Step 7 teardown)
- **Scenario**: Sequential session completes and teardown runs
- **Impact**: Commit stages nothing (empty commit) or stages unrelated pending files.
- **Fix**: Add `git add task-tracking/sessions/{SESSION_ID}/ task-tracking/active-sessions.md` immediately before the `git commit` instruction in Step 7.

---

## Moderate Issues

### Issue 6: `--limit` semantics asymmetry not surfaced to user

- **File**: `.claude/skills/auto-pilot/SKILL.md:341` (Key differences table)
- **Scenario**: User runs `--sequential --limit 3` expecting 3 completed tasks
- **Impact**: Limit counts tasks *started*, not tasks *completed*. If 2 tasks fail (and exhaust retries and become BLOCKED), only 1 task actually completes — but the limit is still consumed. This is documented in the Key Differences table, but there is no warning at startup and no mention in the command's Parameters table description for `--sequential`.
- **Fix**: Add a note to the Parameters table row for `--sequential`: "When combined with `--limit N`, N counts tasks started (not completed)." Also display this in the startup summary when sequential + limit are both active.

### Issue 7: PARTIAL state (IMPLEMENTED after inline run) has no follow-up path

- **File**: `.claude/skills/auto-pilot/SKILL.md:309-311` (Step 6e partial branch)
- **Scenario**: Orchestration subagent builds the task but does not complete review; task ends at IMPLEMENTED
- **Impact**: Step 6e logs "SEQUENTIAL PARTIAL" and counts it toward `--limit` but provides no path to complete the review. The task is left in IMPLEMENTED with no scheduled follow-up. On the next `/auto-pilot --sequential` run, IMPLEMENTED tasks are excluded (Step 5 filter), so the task stays orphaned.
- **Fix**: Either: (a) instruct the subagent to drive through review inline (explicit instruction in Step 6d: "Do not stop at IMPLEMENTED — run the full pipeline including review until status is COMPLETE"), or (b) add an explicit follow-up queue for PARTIAL tasks that gets re-run at the end of the sequential batch.

### Issue 8: `plan.md` is read but no guidance on how it affects sequential ordering

- **File**: `.claude/skills/auto-pilot/SKILL.md:273-274` (Step 4)
- **Scenario**: `plan.md` exists and contains ordering hints
- **Impact**: Step 4 says "Read task-tracking/plan.md if it exists (for ordering hints)" but gives no instruction on how those hints affect the sequential queue order. The sort instruction in Step 5 says "sort by priority then dependency order (same as Core Loop Step 4)" — it does not mention plan.md. An agent reading this sequentially will read plan.md and then never apply it.
- **Fix**: Either specify how plan.md hints modify the sort order in Step 5, or remove the plan.md read from Step 4 if it is not used in sequential mode.

---

## Data Flow Analysis

```
/auto-pilot --sequential [TASK_X] [--limit N]
  |
  v
Step 2: Parse args -> sequential_mode=true, optional: target_task_id, sequential_limit
  |
  v
Step 3a: Stale archive check (best-effort, non-blocking)
  |
  v
Step 3b: Verify registry.md exists  <- FAIL if missing
  |
  v
Step 3c: SKIPPED (MCP validation skipped)
  |
  v
Step 3d: If single-task mode -> verify task exists and check status
          [BUG: allows IMPLEMENTED, but SKILL Step 5 rejects it]
  |
  v
Step 4: Pre-flight validation (all checks except 3c)
  |  -> Session dir created, log.md initialized, active-sessions.md registered
  |     [BUG: source string 'auto-pilot-sequential' bypasses Concurrent Guard]
  |
  v
Step 5: Display Summary  [BUG: no sequential branch, shows N/A fields]
  |
  v
Step 6 (SKILL.md Sequential Mode Flow):
  1. Re-parse flags (duplicate of command Step 2 — no conflict but redundant)
  2. Skip MCP (already skipped — double-skip, harmless)
  3. Session setup -> register active-sessions.md, log entry, state.md
  4. Read registry once + plan.md [BUG: plan.md read but ordering not specified]
  5. Build queue (CREATED only) -> sort by priority+deps -> cap at --limit
  |
  v
  For each task in queue:
    6a. Read each dep status file (incremental read, not full registry - GOOD)
    6b. Log start
    6c. Write status = IN_PROGRESS
    6d. Agent tool -> subagent reads orchestration SKILL, runs full pipeline
         [BUG: no status reset on retry - subagent sees IN_PROGRESS on 2nd attempt]
    6e. Read status file:
         COMPLETE -> increment counter, check --limit
         IMPLEMENTED/IN_REVIEW -> "PARTIAL" [BUG: no follow-up path]
         IN_PROGRESS/CREATED -> retry or BLOCKED
  |
  v
Step 7: Teardown -> log, remove from active-sessions.md, analytics
  [BUG: git commit with no git add scoping]
```

### Gap Points Identified:

1. Status file is never reset before retry — subagent receives IN_PROGRESS on retry
2. IMPLEMENTED tasks silently excluded when user specifies them in single-task mode
3. plan.md is read but ordering effect is undefined
4. active-sessions.md source string bypasses Concurrent Session Guard
5. Step 5 Display Summary never updated for sequential mode context

---

## Acceptance Criteria Coverage

| Criterion | Status | Concern |
|-----------|--------|---------|
| `--sequential` flag added to Mode table in auto-pilot SKILL.md | PASS | Present in Modes table and Configuration table |
| Sequential mode skips MCP validation and worker spawning | PASS | Step 3c skip instruction is clear in both command and SKILL |
| Tasks execute inline via orchestration skill in dependency order | PASS | Step 6d describes Agent tool invocation with orchestration skill |
| `--limit N` works with sequential mode | PARTIAL | Semantics differ from parallel (tasks-started vs tasks-completed) and not surfaced to user at runtime |
| Single-task mode (`--sequential TASK_X`) works | PARTIAL | Command Step 3d allows IMPLEMENTED but SKILL Step 5 rejects it — inconsistency for IMPLEMENTED tasks |
| Registry/plan reads are minimized (once at start + incremental after each task) | PASS | Step 4 reads registry once; Step 6a reads only dep status files incrementally |
| Retry logic works without MCP (re-invoke orchestration on failure) | PARTIAL | Logic exists but no status reset before retry — potential double-execution |
| Session logging still works (log.md entries for each task processed) | PASS | All log events defined in Session Log table and echoed in Sequential Mode Flow |
| Command file (`nitro-auto-pilot.md`) updated with sequential usage examples | PASS | Three examples added to Usage block and Parameters table has `--sequential` row |
| Concurrent Session Guard still registers sequential sessions in active-sessions.md | PARTIAL | Registers correctly but uses source `auto-pilot-sequential` which the Guard does not match |

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|-----------|---------|-----|---------|
| `--sequential TASK_X` where TASK_X doesn't exist | YES | Step 3d checks registry existence | No concern |
| `--sequential TASK_X` where TASK_X is IMPLEMENTED | PARTIAL | Step 3d allows it; SKILL Step 5 rejects it | Conflict — silent no-op or ambiguous error |
| `--sequential TASK_X` where TASK_X is BLOCKED or CANCELLED | YES | Step 3d: "BLOCKED or CANCELLED, error" | No concern |
| `--sequential --limit 0` (unlimited) | YES | Documented as "0 = unlimited" | Semantics consistent with parallel mode for 0 specifically |
| `--sequential --limit 3` (tasks-started semantics) | PARTIAL | Documented in Key Differences table only | Not shown to user in startup summary |
| Task fails on first attempt (status unchanged) | YES | Step 6e retry path exists | But status not reset before retry — see Critical Issue 2 |
| Task fails all retries | YES | Step 6e: write BLOCKED, continue | No concern |
| Subagent exits abnormally (context limit, crash) | PARTIAL | Retry fires because status unchanged | Status not reset; subagent sees stale IN_PROGRESS on retry |
| Session interrupted mid-task (user closes window) | NO | Not addressed | Task left IN_PROGRESS with no recovery path documented |
| Two sequential sessions running concurrently | NO | Concurrent Guard uses `auto-pilot` source, not `auto-pilot-sequential` | Double-execution risk |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|-------------|---------------------|--------|------------|
| Agent tool (inline subagent) -> orchestration SKILL | MEDIUM | Task left IN_PROGRESS if subagent crashes | Retry fires, but no status reset — partial mitigation |
| Sequential session -> active-sessions.md | LOW | Stale row if session crashes | Stale archive check handles on next startup — adequate |
| Concurrent Session Guard -> sequential source string | HIGH | Double execution if user starts two supervisors | Not mitigated — source string mismatch is a hard gap |
| Step 7 teardown -> git commit | MEDIUM | Empty commit or accidental staging | No mitigation — no `git add` scoping |
| plan.md read -> queue ordering | LOW | Ordering hints silently ignored | Cosmetic unless plan.md has critical priority overrides |

---

## Summary

**8 findings total: 2 critical, 3 serious, 3 moderate.**

The core sequential execution path — read registry, build queue, invoke Agent, log results, teardown — is logically sound. The happy path works. The critical gaps are:

1. A direct semantic conflict between what the command entry point allows (IMPLEMENTED in single-task mode) and what the sequential flow accepts (CREATED only). This will silently do nothing for a common use case.
2. No status reset before retry, meaning the subagent on retry sees IN_PROGRESS and may corrupt partial work.

The Concurrent Session Guard gap (serious, not critical) is a latent double-execution risk that activates only when users run concurrent supervisors — uncommon but a real production scenario given this tool's purpose.

The implementation earns a 6/10: the design is correct in concept, the logging is thorough, and the acceptance criteria are mostly covered — but the IMPLEMENTED-task conflict and the retry-without-reset are bugs that will manifest in real usage.

---

## What Robust Implementation Would Include

- Guard in command argument parsing: if `--sequential` AND task status is IMPLEMENTED, reject with a clear error message before any session setup
- Status reset to CREATED before each retry invocation, with a log entry confirming the reset
- Concurrent Session Guard updated to recognize `auto-pilot-sequential` as a competing session source
- Step 5 Display Summary conditional branch for sequential mode (omit N/A fields, show sequential limit)
- Explicit `git add` scoping in Step 7 teardown commit
- Step 6d subagent instruction to drive task to COMPLETE (not stop at IMPLEMENTED)
- plan.md ordering semantics specified or the plan.md read removed from Step 4
