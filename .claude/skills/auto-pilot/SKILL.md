---
name: auto-pilot
description: >
  Autonomous task processing loop for Nitro-Fueled orchestration.
  Use when: Running batch task execution, processing a task backlog,
  or spawning parallel workers for multiple tasks.
  Reads the task registry and task folders, builds a dependency graph,
  spawns workers via MCP session-orchestrator, monitors health, and loops.
  Invoked via /auto-pilot command.
---

# Auto-Pilot Skill

Autonomous loop that processes the task backlog by spawning, monitoring, and managing worker sessions via MCP session-orchestrator.

## Quick Start

```
/auto-pilot                          # Process all unblocked tasks
/auto-pilot TASK_YYYY_NNN            # Process single task only
/auto-pilot --dry-run                # Show plan without spawning
```

---

## Your Role: Orchestrator of Orchestrators

**CRITICAL**: You are the **orchestrator of orchestrators**, NOT the implementer. You spawn worker sessions that each run `/orchestrate TASK_YYYY_NNN`. You monitor those workers, handle completions and failures, and loop until the backlog is drained.

### Primary Responsibilities

1. **Read registry + task.md files** -- build the dependency graph
2. **Identify unblocked tasks** and order them by priority
3. **Spawn workers** via MCP session-orchestrator
4. **Monitor worker health** on a configurable interval
5. **Handle completions and failures** -- update registry, trigger retries
6. **Persist state** to `orchestrator-state.md` for compaction survival
7. **Loop** until the backlog is drained or all remaining tasks are blocked

### What You Never Do

- **Write code or implement tasks** -- workers do that
- **Modify the orchestration skill** -- it is used as-is by workers
- **Re-implement agent sequencing** -- the orchestration skill handles PM, Architect, Dev, QA
- **Write completion-report.md** -- workers write that as their completion signal

---

## Configuration

| Parameter           | Default     | Override Flag    | Description                                          |
|---------------------|-------------|------------------|------------------------------------------------------|
| Concurrency limit   | 3           | --concurrency N  | Maximum simultaneous workers                         |
| Monitoring interval | 10 minutes  | --interval Nm    | Time between health checks                           |
| Retry limit         | 2           | --retries N      | Maximum retry attempts for a failed task             |
| MCP retry backoff   | 30 seconds  | (not overridable)| Wait time between MCP retry attempts                 |

> **Note on stuck detection**: Stuck detection is server-side -- the MCP session-orchestrator determines the `stuck` health state based on worker inactivity (hardcoded at 120 seconds). The auto-pilot does not configure this threshold; it reacts to the `stuck` health state via two-strike detection.

When the loop starts, merge command-line overrides with these defaults. Write the active configuration into `orchestrator-state.md`.

---

## Session Log

The auto-pilot MUST maintain a session log in `orchestrator-state.md` under a `## Session Log` section. Every significant event gets a timestamped entry. This is how you (and the user) know what happened during the session.

**Events to log** (append one line per event):

| Event | Log Format |
|-------|-----------|
| Loop started | `[HH:MM:SS] AUTO-PILOT STARTED — {N} tasks, {N} unblocked, concurrency {N}` |
| Worker spawned | `[HH:MM:SS] SPAWNED {worker_id} for TASK_X ({Type})` |
| Worker healthy | `[HH:MM:SS] HEALTH CHECK — TASK_X: healthy` |
| Worker high context | `[HH:MM:SS] HEALTH CHECK — TASK_X: high_context ({context_percent}%)` |
| Worker compacting | `[HH:MM:SS] HEALTH CHECK — TASK_X: compacting` |
| Worker stuck (strike 1) | `[HH:MM:SS] WARNING — TASK_X: stuck (strike 1/2)` |
| Worker stuck (strike 2, killing) | `[HH:MM:SS] KILLING — TASK_X: stuck for 2 consecutive checks` |
| Kill failed | `[HH:MM:SS] KILL FAILED — TASK_X: {error}` |
| Worker finished (success) | `[HH:MM:SS] COMPLETE — TASK_X: completion-report.md found` |
| Worker finished (no report) | `[HH:MM:SS] FAILED — TASK_X: no completion-report.md` |
| Retry scheduled | `[HH:MM:SS] RETRY — TASK_X: attempt {N}/{retry_limit}` |
| Task blocked (max retries) | `[HH:MM:SS] BLOCKED — TASK_X: exceeded {retry_limit} retries` |
| Task blocked (cycle) | `[HH:MM:SS] BLOCKED — TASK_X: dependency cycle with TASK_Y` |
| Task blocked (cancelled dep) | `[HH:MM:SS] BLOCKED — TASK_X: dependency TASK_Y is CANCELLED` |
| Task blocked (missing dep) | `[HH:MM:SS] BLOCKED — TASK_X: dependency TASK_Y not in registry` |
| MCP retry | `[HH:MM:SS] MCP RETRY — {tool_name}: attempt {N}/3` |
| MCP failure (per-worker) | `[HH:MM:SS] MCP SKIP — TASK_X: {tool_name} failed, will retry next interval` |
| MCP failure (global) | `[HH:MM:SS] MCP UNREACHABLE — pausing auto-pilot, state saved` |
| Spawn failure | `[HH:MM:SS] SPAWN FAILED — TASK_X: {error}` |
| State recovered | `[HH:MM:SS] STATE RECOVERED — {N} active workers, {N} completed` |
| Reconciliation | `[HH:MM:SS] RECONCILE — worker {id} missing from MCP, treating as finished` |
| Worker replaced | `[HH:MM:SS] REPLACING — TASK_X: spawning new worker (previous {reason})` |
| Compaction detected | `[HH:MM:SS] COMPACTION — reading orchestrator-state.md to restore context` |
| Loop stopped | `[HH:MM:SS] AUTO-PILOT STOPPED — {completed} completed, {failed} failed, {blocked} blocked` |

The log is part of `orchestrator-state.md` and survives compactions. Keep the last 100 entries max (trim older entries on write). After compaction, the log tells you exactly what happened before context was lost.

> **Compaction limit**: The auto-pilot session should compact at most 2 times. If the session has already compacted twice and context is still growing, gracefully stop the loop, save state, and instruct the user to re-run `/auto-pilot` to continue from saved state. This prevents degraded performance from excessive compaction.

---

## Modes

The auto-pilot operates in three modes, selected via the `/auto-pilot` command:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **All-tasks** | `/auto-pilot` (no args) | Full loop: Steps 1-8, processes entire backlog until drained or all blocked |
| **Single-task** | `/auto-pilot TASK_YYYY_NNN` | Spawn one worker for the specified task. Monitor until completion. Stop (no loop to other tasks). |
| **Dry-run** | `/auto-pilot --dry-run` | Display dependency graph and wave-based execution plan. No workers spawned. |

Single-task and dry-run modes are handled by the command entry point (`.claude/commands/auto-pilot.md`). The Core Loop below describes the all-tasks mode.

---

## Concurrent Session Guard

On startup, **before entering the loop**:

1. If `orchestrator-state.md` exists and `Loop Status` is `RUNNING`:
   - Log: `"WARNING: A previous auto-pilot session may still be running (state shows RUNNING)."`
   - Ask the user to confirm with `--force` flag, or abort.
   - If `--force` provided, continue (overwrite the previous session's state).
2. Write `Loop Status: RUNNING` to `orchestrator-state.md` immediately.

This prevents accidental duplicate auto-pilot sessions from competing for the same workers and tasks.

---

## Core Loop

### Step 1: Read State (Recovery Check)

**IF** `task-tracking/orchestrator-state.md` exists:

1. Read it and restore loop state:
   - Active workers (worker IDs, task IDs, labels, statuses, spawn times, stuck counts)
   - Completed tasks this session
   - Failed tasks this session
   - Retry counters for all tasks
   - Configuration (concurrency limit, monitoring interval, retry limit)
2. Validate active workers still exist by calling MCP `list_workers`.
3. Reconcile state vs MCP:
   - **Worker in state but NOT in MCP list**: Treat as finished. Trigger the completion handler (Step 7) for that worker's task.
   - **Worker in MCP list but NOT in state**: Ignore it -- it is not ours (belongs to a different session or manual invocation).
4. Reconcile state vs registry:
   - **Task marked active in state but COMPLETE in registry**: Remove from active workers (registry wins). A worker may have finished and another process updated the registry.
   - **Task marked active in state but CREATED in registry**: The previous session may have crashed before writing IN_PROGRESS. Re-mark as IN_PROGRESS if the worker is still running in MCP, otherwise treat as failed.

**ELSE** (no state file):

1. Initialize fresh state with default or overridden configuration.
2. Proceed to Step 2.

### Step 2: Read Registry and Task Folders

1. Read `task-tracking/registry.md`.
2. Parse every row: extract **Task ID**, **Status**, **Type**, **Description**.
3. For each task with status **CREATED** or **IN_PROGRESS**:
   - Read `task-tracking/TASK_YYYY_NNN/task.md`
   - Extract: **Type**, **Priority**, **Complexity**, **Dependencies** list
4. If a `task.md` is missing or malformed:
   - Log warning: `"Skipping TASK_YYYY_NNN: task.md missing or unreadable"`
   - Continue with remaining tasks.

### Step 2b: Validate Task Quality

For each CREATED task, verify its `task.md` has sufficient content for the orchestration pipeline to process it autonomously. A task is **well-described** if it has:

| Field | Minimum Requirement |
|-------|-------------------|
| **Type** | Must be one of: FEATURE, BUGFIX, REFACTORING, DOCUMENTATION, RESEARCH, DEVOPS, CREATIVE |
| **Priority** | Must be one of: P0-Critical, P1-High, P2-Medium, P3-Low |
| **Description** | Must be at least 2 sentences — enough for the PM agent to produce requirements without clarification |
| **Acceptance Criteria** | Must have at least 1 criterion |

**If a task fails validation:**
- Log: `"TASK_X: task.md incomplete — missing {fields}. Skipping."`
- Leave the task as CREATED but skip it this iteration.
- Do NOT mark it BLOCKED — the user needs to fill in the missing fields, then it will be picked up on the next loop.

**If validation passes**, the task proceeds to the dependency graph.

> This validation ensures the auto-pilot never spawns a worker for a vague task that will waste a session asking clarifying questions with no human to answer.

### Step 3: Build Dependency Graph

For each task, parse the **Dependencies** field into a list of task IDs. Classify each task:

| Classification | Condition |
|----------------|-----------|
| **UNBLOCKED**  | Status is CREATED **AND** (no dependencies OR all dependencies have status COMPLETE) |
| **IN_PROGRESS**| Status is IN_PROGRESS (worker already running) |
| **BLOCKED**    | Status is BLOCKED |
| **COMPLETE**   | Status is COMPLETE |
| **CANCELLED**  | Status is CANCELLED |

**Dependency validation**:

1. **Missing dependency**: If a dependency references a task ID not in the registry:
   - Mark the task as **BLOCKED** in the registry.
   - Log: `"TASK_X blocked: dependency TASK_Y not found in registry"`

2. **CANCELLED dependency**: If a dependency has status CANCELLED:
   - Mark the dependent task as **BLOCKED** in the registry.
   - Log: `"TASK_X blocked: dependency TASK_Y is CANCELLED"`

3. **Cycle detection**: For each unresolved task, walk the full dependency chain (including through COMPLETE dependencies). If a task is encountered twice in the same walk, a cycle exists. Track visited nodes with a set to detect both direct and transitive cycles.
   - Mark **ALL** tasks in the cycle as **BLOCKED** in the registry.
   - Log: `"Dependency cycle detected: TASK_A -> TASK_B -> TASK_A"`

### Step 4: Order Task Queue

1. From the unblocked list, sort by:
   - **Priority**: P0-Critical > P1-High > P2-Medium > P3-Low
   - **Tiebreaker**: Task ID (lower NNN first = older tasks first)

2. Calculate available spawn slots:
   ```
   slots = concurrency_limit - count(active workers from state)
   ```

3. Select the first `slots` tasks from the sorted queue.

4. If `slots <= 0`, skip to **Step 6** (monitoring).

### Step 5: Spawn Workers

For each selected task:

**5a. Generate Orchestration Prompt:**

```
Run /orchestrate TASK_YYYY_NNN

AUTONOMOUS MODE — follow these rules strictly:

1. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints (Scope, Requirements, Architecture, QA Choice)
   and continue immediately. There is no human at this terminal.

2. After ALL development is complete (all batches COMPLETE in tasks.md),
   run ALL available reviewers: style, logic, and security.
   Do not ask which reviewers to run — run all of them.

3. After reviews complete, fix ALL review findings. Do not skip any
   blocking or serious issues. Fix minor issues where practical.

4. After fixing review findings, create a git commit with the fixes.

5. IMPORTANT: Before developers write any code, they MUST read
   .claude/review-lessons/ (review-general.md, backend.md,
   frontend.md). These contain accumulated rules from past reviews.
   After reviews complete, reviewers MUST append new lessons to
   the appropriate review-lessons file.

6. Complete the orchestration Completion Phase:
   - Write completion-report.md
   - The auto-pilot will handle registry updates

7. If you encounter errors or blockers, document them in the task
   folder and exit cleanly so the auto-pilot can detect the state
   and decide whether to retry.

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

IF the task has a retry count > 0 in `orchestrator-state.md` (previous attempt failed), use this enhanced prompt instead:

```
Run /orchestrate TASK_YYYY_NNN

CONTINUATION MODE — This task was previously attempted {N} time(s).
The previous worker {reason: stuck / crashed / stopped / compacted}.

AUTONOMOUS MODE — follow these rules strictly:

1. Do NOT pause for any user validation checkpoints. Auto-approve
   ALL checkpoints and continue immediately. No human at this terminal.

2. FIRST: Read the session log in task-tracking/orchestrator-state.md
   to understand what happened in previous attempts.

3. SECOND: Check the task folder for existing deliverables:
   - context.md exists? -> PM phase already done
   - task-description.md exists? -> Requirements already done
   - implementation-plan.md exists? -> Architecture already done
   - tasks.md exists? -> Check task statuses to see dev progress
   - review-*.md exists? -> Reviews already done, check for findings
   The orchestration skill's phase detection will automatically
   determine where to resume based on which files exist.

4. Do NOT restart from scratch. Resume from the detected phase.

5. Before developers write code, ensure they read
   .claude/review-lessons/ for accumulated rules.

6. After ALL development is complete, run ALL reviewers (style,
   logic, security). Fix all findings. Commit fixes. Append new
   lessons to .claude/review-lessons/.

7. Complete the Completion Phase (completion-report.md).

Working directory: {project_root}
Task folder: task-tracking/TASK_YYYY_NNN/
```

**5b. Call MCP `spawn_worker`:**

- `prompt`: the generated prompt from 5a
- `working_directory`: project root absolute path
- `label`: `"TASK_YYYY_NNN-TYPE"` (e.g., `"TASK_2026_003-FEATURE"`)

**5c. On successful spawn:**

- Update registry: set task status to **IN_PROGRESS**
- Record in `orchestrator-state.md` active workers table:
  - worker_id, task_id, label, status=`"running"`, spawn_time, retry_count

**5d. On spawn failure (MCP error):**

- Log: `"Failed to spawn worker for TASK_X: {error}"`
- Leave task status as **CREATED** (will retry next loop iteration)
- Continue with remaining tasks

**5e. Write `orchestrator-state.md`** after **each** successful spawn (not after all spawns). This prevents orphaned workers if the session compacts mid-spawn sequence.

### Step 6: Monitor Active Workers

1. **Wait** for the configured monitoring interval.

2. For each active worker in `orchestrator-state.md`:

   **6a.** Call MCP `get_worker_activity`(worker_id) for routine checks. This returns a compact summary -- context-efficient (~5-10 lines).

   **6b.** Determine whether to escalate to `get_worker_stats`:
   - **Always escalate** if the activity summary mentions issues (stuck, error, failed, no progress)
   - **Always escalate** if the worker has been active for more than 3 monitoring intervals (long-running workers need periodic structured health checks)
   - **Always escalate** if the worker's `stuck_count > 0` from a previous check
   - Otherwise, trust the activity summary for healthy workers

   When escalating, call MCP `get_worker_stats`(worker_id) for the structured `health` field.

   **6c.** Health state handling:

   | Health State     | Action |
   |------------------|--------|
   | `healthy`        | Log activity summary. No action needed. |
   | `high_context`   | Log: `"TASK_X worker at high context usage -- still progressing"`. No action. Worker will compact automatically. |
   | `compacting`     | Log: `"TASK_X worker is compacting context"`. No action. This is normal for long tasks. |
   | `stuck`          | Apply two-strike detection (see below). |
   | `finished`       | Trigger completion handler (Step 7). |

   **Two-strike stuck detection**:

   - Check `orchestrator-state.md` for this worker's `stuck_count`.
   - **IF** `stuck_count == 0` (first detection):
     - Set `stuck_count = 1` in state.
     - Log: `"WARNING: TASK_X worker appears stuck (strike 1/2)"`
     - Wait one more monitoring interval.
   - **IF** `stuck_count >= 1` (second consecutive detection):
     - Log: `"TASK_X worker stuck for 2 consecutive checks -- killing"`
     - Call MCP `kill_worker`(worker_id, reason=`"stuck for 2 checks"`)
     - **Check return**: If `success: false`, log warning `"Failed to kill TASK_X worker -- will retry next interval"` and skip remaining cleanup (do not change registry or remove from state).
     - If kill succeeded, set task status to **CREATED** in registry (for retry)
     - Increment `retry_count` in state for this task
     - **IF** `retry_count > retry_limit`:
       - Set task status to **BLOCKED** in registry
       - Log: `"TASK_X exceeded retry limit -- marked BLOCKED"`
     - Remove worker from active workers in state.

   **6d.** Reset `stuck_count` to 0 for any worker **NOT** in `stuck` state.

   **6e.** Write `orchestrator-state.md` after monitoring pass.

### Step 7: Handle Completions

For each worker with health `finished` (or discovered missing during reconciliation in Step 1):

**7a. Check for completion-report.md:**

Read `task-tracking/TASK_YYYY_NNN/completion-report.md`

**7b. IF `completion-report.md` EXISTS:**

- Update registry: set task status to **COMPLETE**
- Move worker from active to completed list in state
- Record: task_id, completion_timestamp
- Log: `"TASK_X completed successfully"`

**7c. IF `completion-report.md` DOES NOT EXIST:**

- Treat as incomplete/failed.
- Set task status to **CREATED** in registry (for retry)
- Increment `retry_count` for this task in state
- **IF** `retry_count > retry_limit`:
  - Set task status to **BLOCKED** in registry
  - Log: `"TASK_X failed {N} times -- marked BLOCKED"`
- **ELSE**:
  - Log: `"TASK_X finished without completion report -- will retry (attempt {N}/{retry_limit})"`
- Move worker from active to failed list in state

**7d. After processing all completions, immediately re-evaluate:**

A completed task may unblock downstream tasks. Go back to **Step 2** (read registry, rebuild dependency graph).

**7e. Edge case -- worker still running after `completion-report.md` exists:**

If `get_worker_stats` shows worker is still running but `completion-report.md` exists:
- Wait one monitoring interval.
- If still running after next check, kill it: call `kill_worker`(worker_id, reason=`"stuck post-completion"`).

### Worker Recovery Protocol

When a worker stops, crashes, or gets killed for ANY reason without producing `completion-report.md`, the auto-pilot MUST be able to spawn a **replacement worker** that continues the task:

1. **Set task status back to CREATED** in the registry (unless retry limit exceeded).
2. **Log the event** with the reason (stuck, crashed, MCP reported failure, etc.).
3. **On next loop iteration**, the task is picked up again as an unblocked CREATED task.
4. **The replacement worker's prompt includes RETRY CONTEXT** (see Step 5a), which instructs it to read the session log and existing task folder deliverables to resume, not restart.
5. **The task folder preserves all partial work** — context.md, task-description.md, implementation-plan.md, tasks.md, partial code, review files. The replacement worker uses phase detection to determine where to resume.

This means any worker can be replaced at any time — the auto-pilot never depends on a specific worker session surviving. The task folder + session log contain all the context needed for a new worker to pick up where the previous one left off.

### Step 8: Loop Termination Check

| Condition | Action |
|-----------|--------|
| No unblocked tasks **AND** no active workers | Log: `"All tasks complete or blocked. Auto-pilot stopping."` Write final `orchestrator-state.md` with `loop_status: STOPPED` and session summary (total completed, total failed, total time). **STOP.** |
| No unblocked tasks **BUT** active workers exist | Log: `"No unblocked tasks. Waiting for {N} active workers..."` Go to **Step 6** (monitor, wait for completions that may unblock). |
| Unblocked tasks exist | Go to **Step 4** (select and spawn). |

---

## orchestrator-state.md Format

Written to `task-tracking/orchestrator-state.md`. Must be parseable after compaction -- uses clear section headers and markdown tables.

```markdown
# Orchestrator State

**Loop Status**: RUNNING | STOPPED
**Last Updated**: YYYY-MM-DD HH:MM:SS
**Session Started**: YYYY-MM-DD HH:MM:SS

## Configuration

| Parameter           | Value      |
|---------------------|------------|
| Concurrency Limit   | 3          |
| Monitoring Interval | 10 minutes |
| Retry Limit         | 2          |

## Active Workers

| Worker ID | Task ID       | Label                  | Status  | Spawn Time          | Last Health | Stuck Count |
|-----------|---------------|------------------------|---------|---------------------|-------------|-------------|
| abc-123   | TASK_2026_003 | TASK_2026_003-FEATURE  | running | 2026-03-24 10:00:00 | healthy     | 0           |

## Completed Tasks

| Task ID       | Completed At         |
|---------------|----------------------|
| TASK_2026_001 | 2026-03-24 10:45:00  |

## Failed Tasks

| Task ID       | Reason                    | Retry Count |
|---------------|---------------------------|-------------|
| TASK_2026_005 | No completion report (x2) | 2           |

## Task Queue (Next Unblocked)

| Task ID       | Priority    | Type    |
|---------------|-------------|---------|
| TASK_2026_004 | P1-High     | FEATURE |
| TASK_2026_006 | P2-Medium   | BUGFIX  |

## Retry Tracker

| Task ID       | Retry Count |
|---------------|-------------|
| TASK_2026_005 | 2           |

## Session Log

| Timestamp | Event |
|-----------|-------|
| 10:00:00 | AUTO-PILOT STARTED — 6 tasks, 3 unblocked, concurrency 3 |
| 10:00:05 | SPAWNED abc-123 for TASK_2026_003 (FEATURE) |
| 10:00:08 | SPAWNED def-456 for TASK_2026_004 (BUGFIX) |
| 10:10:00 | HEALTH CHECK — TASK_2026_003: healthy |
| 10:10:02 | HEALTH CHECK — TASK_2026_004: high_context (82%) |
| 10:20:00 | COMPLETE — TASK_2026_004: completion-report.md found |
| 10:20:01 | SPAWNED ghi-789 for TASK_2026_006 (FEATURE) |
| 10:30:00 | WARNING — TASK_2026_003: stuck (strike 1/2) |
| 10:40:00 | KILLING — TASK_2026_003: stuck for 2 consecutive checks |
| 10:40:01 | RETRY — TASK_2026_003: attempt 1/2 |
| 10:40:02 | REPLACING — TASK_2026_003: spawning new worker (previous stuck) |

**Compaction Count**: 0
```

**Key design properties**:

- **Atomic overwrite**: Full file overwrite on every update -- no appending. Prevents partial state corruption.
- **Standard markdown**: All tables use standard markdown syntax, parseable by any agent after compaction.
- **Retry persistence**: Retry Tracker persists across loop iterations and compactions -- not just for active workers.
- **Task Queue is informational**: Recalculated each loop iteration, but useful for context recovery after compaction.

---

## MCP Tool Usage Reference

| Tool                  | Used In      | Purpose                                               |
|-----------------------|--------------|-------------------------------------------------------|
| `spawn_worker`        | Step 5       | Launch a new worker session for a task                |
| `list_workers`        | Step 1       | Reconcile state after compaction/recovery              |
| `get_worker_activity` | Step 6       | Routine monitoring (compact, context-efficient)        |
| `get_worker_stats`    | Step 6       | Detailed check when stuck/finished suspected           |
| `kill_worker`         | Step 6, 7    | Terminate stuck or post-completion workers             |

### MCP Tool Signatures

```
spawn_worker(prompt: string, working_directory: string, label: string, model?: string, allowed_tools?: string[])
  -> { worker_id: string, pid: number, session_id: string, iterm_tab: string }

list_workers(status_filter?: 'active' | 'completed' | 'failed' | 'all')
  -> { workers: [{ worker_id, label, status, pid, started_at, duration_minutes, total_tokens, context_percent, cost_estimate_usd }] }

get_worker_activity(worker_id: string, last_n_messages?: number)
  -> { summary: string }

get_worker_stats(worker_id: string)
  -> { worker_id, label, status, tokens: {...}, cost: {...}, progress: {...}, health: 'healthy' | 'high_context' | 'compacting' | 'stuck' | 'finished' }

kill_worker(worker_id: string, reason?: string)
  -> { success: boolean, final_stats: {...} }
```

### Context Efficiency Rule

- **DEFAULT** to `get_worker_activity` for routine checks (returns ~5-10 lines).
- **ESCALATE** to `get_worker_stats` only when activity summary indicates issues (stuck, finished, or health unclear).
- **NEVER** call `get_worker_stats` on every worker every interval -- this wastes orchestrator context.

---

## Error Handling

### Worker Failure

A single worker failure **NEVER** stops the loop. Log the failure, update the task status (back to CREATED for retry, or BLOCKED if retries exhausted), and continue with remaining tasks.

### MCP Unreachable

If an MCP call fails, apply scoped retry logic:

**Per-worker MCP failure** (e.g., `get_worker_activity` or `get_worker_stats` for a specific worker):
1. Retry up to **3 times** with **30-second backoff**.
2. If still failing: log warning, skip that worker for this monitoring pass, continue with remaining workers.
3. The worker will be checked again on the next monitoring interval.

**Global MCP failure** (e.g., `list_workers` during reconciliation, or ALL worker checks fail in the same pass):
1. Retry up to **3 times** with **30-second backoff**.
2. If still failing:
   - Write current state to `orchestrator-state.md`.
   - Log: `"MCP session-orchestrator unreachable after 3 retries. Auto-pilot paused. State saved. Resolve MCP connection and re-run /auto-pilot to resume."`
   - **STOP** the loop (graceful pause -- do not crash).

### Malformed Task Data

If `task.md` is missing, unparseable, or has invalid fields:

- Skip that task.
- Log a warning with the task ID and reason.
- Continue with other tasks.

### Unexpected Error

On any unexpected error:

1. Write current state to `orchestrator-state.md` **FIRST** (state preservation is top priority).
2. Then surface the error with context.
3. State is preserved for recovery on next `/auto-pilot` invocation.

### Dependency Cycle

- Mark **all** tasks in the cycle as **BLOCKED** in the registry.
- Log the cycle chain (e.g., `"Dependency cycle: TASK_A -> TASK_B -> TASK_A"`).
- Continue processing non-cyclic tasks.

---

## Key Principles

1. **You are the orchestrator of orchestrators** -- spawn, monitor, loop
2. **Workers invoke /orchestrate** -- you never re-implement agent logic
3. **Registry is the source of truth** for task status
4. **orchestrator-state.md is your private memory** across compactions
5. **Only YOU write registry status transitions** -- workers write completion-report.md
6. **Prefer get_worker_activity over get_worker_stats** for context efficiency
7. **Never spawn duplicate workers** -- check both registry (IN_PROGRESS) and state (active workers)
8. **A completed task triggers immediate re-evaluation** of the dependency graph
9. **Graceful degradation** -- one failure never crashes the loop
10. **Zero project assumptions** -- works in any Nitro-Fueled project
