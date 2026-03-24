# Implementation Plan - TASK_2026_002

## Codebase Investigation Summary

### Patterns Identified

- **Skill Pattern** (`.claude/skills/orchestration/SKILL.md`): YAML frontmatter with `name` and `description`, then markdown body organized as: Role Definition, Quick Start, Core Loop, Reference Index, Key Principles. Sub-skills live in the same folder (e.g., `ui-ux-designer/` has `SKILL.md` + 5 sub-skill files). Evidence: `.claude/skills/orchestration/SKILL.md:1-10`, `.claude/skills/ui-ux-designer/SKILL.md`.

- **Command Pattern — Skill-Invoking** (`orchestrate.md`): Short file. Purpose, Usage, Execution (loads skill, lists references), Quick Reference, Skill Path. Evidence: `.claude/commands/orchestrate.md:1-36`.

- **Command Pattern — Self-Contained** (`create-task.md`, `project-status.md`): Longer file. Purpose, Usage, numbered Execution Steps (Step 1, Step 2...), Important Rules, References. Evidence: `.claude/commands/create-task.md:1-93`, `.claude/commands/project-status.md:1-130`.

- **Task ID Format**: `TASK_YYYY_NNN`. Evidence: `.claude/skills/orchestration/references/task-tracking.md:8-18`.

- **Registry Format**: Markdown table with columns `Task ID | Status | Type | Description | Created`. Status values: CREATED, IN_PROGRESS, COMPLETE, BLOCKED, CANCELLED. Evidence: `task-tracking/registry.md:3-6`, `.claude/skills/orchestration/references/task-tracking.md:72-80, 219-229`.

- **Task.md Structure**: Metadata table (Type, Priority, Complexity), Description, Dependencies, Acceptance Criteria, References. Evidence: `task-tracking/task-template.md:1-56`.

- **Priority Enum**: P0-Critical, P1-High, P2-Medium, P3-Low. Evidence: `task-tracking/task-template.md:10`.

- **Completion Signal**: `completion-report.md` in the task folder indicates a task is done. Evidence: `.claude/skills/orchestration/SKILL.md:259-309`, `docs/claude-orchestrate-package-design.md:53-58`.

### MCP Tool Signatures (from `docs/mcp-session-orchestrator-design.md`)

| Tool | Parameters | Key Returns |
|------|-----------|-------------|
| `spawn_worker` | `prompt: string`, `working_directory: string`, `label: string`, `model?: string`, `allowed_tools?: string[]` | `worker_id: string`, `pid: number`, `session_id: string`, `iterm_tab: string` |
| `list_workers` | `status_filter?: 'active' \| 'completed' \| 'failed' \| 'all'` | `workers: [{ worker_id, label, status, pid, started_at, duration_minutes, total_tokens, context_percent, cost_estimate_usd }]` |
| `get_worker_stats` | `worker_id: string` | `{ worker_id, label, status, tokens: {...}, cost: {...}, progress: {...}, health: 'healthy' \| 'high_context' \| 'compacting' \| 'stuck' \| 'finished' }` |
| `get_worker_activity` | `worker_id: string`, `last_n_messages?: number` | `{ summary: string }` (5-10 line compact summary) |
| `kill_worker` | `worker_id: string`, `reason?: string` | `{ success: boolean, final_stats: {...} }` |

Evidence: `docs/mcp-session-orchestrator-design.md:71-223`.

**Health States**: `healthy`, `high_context`, `compacting`, `stuck`, `finished`. Evidence: `docs/mcp-session-orchestrator-design.md:176, 306-312`.

**Health Detection Logic**: `finished` = PID not running; `compacting` = 2+ compactions; `high_context` = >80% context; `stuck` = last_action_age > 120s; else `healthy`. Evidence: `docs/mcp-session-orchestrator-design.md:306-312`.

### Integration Points

- **Auto-pilot wraps `/orchestrate`**: Workers invoke `/orchestrate TASK_YYYY_NNN` inside their session. Auto-pilot never re-implements strategy selection, agent sequencing, or phase detection. Evidence: `task-description.md:101-106, 218`.
- **Registry is shared state**: Auto-pilot reads it to build the dependency graph and writes it to update task statuses. Workers write `completion-report.md` as the completion signal; only auto-pilot writes registry status transitions. Evidence: `task-description.md:141-148, 259`.
- **`orchestrator-state.md` is auto-pilot's private state**: Persists loop state for compaction survival. Not read by workers or the orchestration skill. Evidence: `docs/claude-orchestrate-package-design.md:115-123`.
- **Task.md fields drive auto-pilot decisions**: Type determines the prompt strategy, Priority determines queue ordering, Dependencies determine unblocked status. Evidence: `docs/task-template-guide.md:89-102`.

---

## Architecture Design (Codebase-Aligned)

### Design Philosophy

**Chosen Approach**: Skill-with-command pattern (same as orchestration skill).
**Rationale**: The auto-pilot is a complex loop requiring a dedicated skill file with full logic, plus a thin command entry point. This matches the orchestration skill pattern exactly: `orchestrate.md` (command) loads `orchestration/SKILL.md` (skill). The auto-pilot command will load `auto-pilot/SKILL.md`.
**Evidence**: `.claude/commands/orchestrate.md:14` loads SKILL.md; `.claude/skills/orchestration/SKILL.md` contains the full orchestration logic.

---

### Component Specifications

#### Component 1: `.claude/skills/auto-pilot/SKILL.md`

**Purpose**: The core autonomous loop skill. Contains all logic for reading the task backlog, building dependency graphs, spawning workers, monitoring health, handling completions, and persisting state. This is the "brain" of the auto-pilot system.

**Pattern**: Skill file with YAML frontmatter + structured markdown body. Follows `.claude/skills/orchestration/SKILL.md` structure.
**Evidence**: `.claude/skills/orchestration/SKILL.md:1-10` (frontmatter pattern), `.claude/skills/orchestration/SKILL.md:39-62` (role definition pattern).

**Content Structure**:

```
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

[One-line summary: Autonomous loop that processes the task backlog by
spawning, monitoring, and managing worker sessions.]

## Quick Start

  /auto-pilot                          # Process all unblocked tasks
  /auto-pilot TASK_YYYY_NNN            # Process single task
  /auto-pilot --dry-run                # Show plan without spawning

## Your Role: Orchestrator of Orchestrators

  [Explanation: You are the session running the auto-pilot loop.
   You do NOT implement tasks. You spawn workers that invoke /orchestrate.
   You monitor those workers, handle completions, and loop.]

  Primary Responsibilities:
  1. Read registry + task.md files -> build dependency graph
  2. Identify unblocked tasks and order by priority
  3. Spawn workers via MCP session-orchestrator
  4. Monitor worker health on a configurable interval
  5. Handle completions and failures
  6. Persist state for compaction survival
  7. Loop until backlog is drained

  What You Never Do:
  - Write code or implement tasks
  - Modify the orchestration skill
  - Re-implement agent sequencing
  - Write completion-report.md (workers do that)

## Configuration

  [Table of configurable parameters with defaults]

  | Parameter           | Default     | Override Flag    | Description                                         |
  |---------------------|-------------|------------------|-----------------------------------------------------|
  | Concurrency limit   | 2           | --concurrency N  | Maximum simultaneous workers                        |
  | Monitoring interval | 10 minutes  | --interval Nm    | Time between health checks                          |
  | Stuck threshold     | 5 minutes   | --stuck Nm       | Inactivity duration before worker considered stuck   |
  | Retry limit         | 2           | --retries N      | Maximum retry attempts for a failed task            |
  | MCP retry backoff   | 30 seconds  | (not overridable)| Wait time between MCP retry attempts                |

  When the loop starts, merge command-line overrides with these defaults.
  Write the active configuration into orchestrator-state.md.

## Core Loop

  ### Step 1: Read State (Recovery Check)

    IF task-tracking/orchestrator-state.md exists:
      Read it and restore loop state (active workers, completed tasks,
      failed tasks, retry counters, configuration).
      Validate active workers still exist by calling MCP `list_workers`.
      Reconcile discrepancies:
        - Worker in state but not in MCP list -> treat as finished,
          trigger completion handler
        - Worker in MCP list but not in state -> ignore (not ours)
    ELSE:
      Initialize fresh state.

  ### Step 2: Read Registry and Task Folders

    Read task-tracking/registry.md.
    Parse every row: extract Task ID, Status, Type, Description.
    For each task with status CREATED or IN_PROGRESS:
      Read task-tracking/TASK_YYYY_NNN/task.md
      Extract: Type, Priority, Complexity, Dependencies list
    If a task.md is missing or malformed:
      Log warning: "Skipping TASK_YYYY_NNN: task.md missing or unreadable"
      Continue with remaining tasks.

  ### Step 3: Build Dependency Graph

    For each task, parse the Dependencies field into a list of task IDs.
    Classify each task:

    UNBLOCKED: status is CREATED AND (no dependencies OR all dependencies
               have status COMPLETE)
    IN_PROGRESS: status is IN_PROGRESS (worker already running)
    BLOCKED: status is BLOCKED
    COMPLETE: status is COMPLETE

    Dependency validation:
      - If a dependency references a task ID not in the registry:
        Mark the task BLOCKED in the registry.
        Log: "TASK_X blocked: dependency TASK_Y not found in registry"
      - Cycle detection: For each unresolved task, walk the dependency
        chain. If a task is encountered twice in the same walk, a cycle
        exists. Mark ALL tasks in the cycle as BLOCKED in the registry.
        Log: "Dependency cycle detected: TASK_A -> TASK_B -> TASK_A"

  ### Step 4: Order Task Queue

    From the unblocked list, sort by:
      1. Priority: P0-Critical > P1-High > P2-Medium > P3-Low
      2. Tiebreaker: Task ID (lower NNN first = older tasks first)

    Calculate available spawn slots:
      slots = concurrency_limit - count(active workers from state)

    Select the first `slots` tasks from the sorted queue.
    If slots <= 0, skip to Step 6 (monitoring).

  ### Step 5: Spawn Workers

    For each selected task:

    5a. Generate Orchestration Prompt:

      [PROMPT TEMPLATE — this is the exact prompt passed to spawn_worker]

      ```
      Run /orchestrate TASK_YYYY_NNN

      Important: Run autonomously. Do not pause for user validation
      checkpoints — auto-approve all checkpoints and continue. There is
      no human at this terminal.

      Working directory: {project_root}
      Task folder: task-tracking/TASK_YYYY_NNN/
      ```

      IF the task has a retry count > 0 in orchestrator-state.md (previous
      attempt failed), append to the prompt:

      ```
      RETRY CONTEXT: This task was previously attempted {N} time(s).
      Check the task folder for existing deliverables (context.md,
      implementation-plan.md, tasks.md, etc.) and resume from where
      the previous attempt left off. Do not restart from scratch.
      ```

    5b. Call MCP spawn_worker:
      - prompt: [generated prompt from 5a]
      - working_directory: [project root absolute path]
      - label: "TASK_YYYY_NNN-TYPE" (e.g., "TASK_2026_003-FEATURE")

    5c. On successful spawn:
      - Update registry: set task status to IN_PROGRESS
      - Record in orchestrator-state.md active workers:
        worker_id, task_id, label, status="running", spawn_time, retry_count

    5d. On spawn failure (MCP error):
      - Log: "Failed to spawn worker for TASK_X: {error}"
      - Leave task status as CREATED (will retry next loop iteration)
      - Continue with remaining tasks

    5e. Write orchestrator-state.md after all spawns complete.

  ### Step 6: Monitor Active Workers

    Wait for the configured monitoring interval.

    For each active worker in orchestrator-state.md:

    6a. Call MCP `get_worker_activity` (worker_id) for routine checks.
        This returns a compact summary — context-efficient.

    6b. Parse the summary for health indicators.
        If the summary indicates potential issues (stuck, finished),
        call MCP `get_worker_stats` (worker_id) for detailed health.

    6c. Health state handling:

      `healthy`:
        Log activity summary. No action needed.

      `high_context`:
        Log: "TASK_X worker at high context usage — still progressing"
        No action. Worker will compact automatically.

      `compacting`:
        Log: "TASK_X worker is compacting context"
        No action. This is normal for long tasks.

      `stuck`:
        Check orchestrator-state.md for this worker's stuck_count.
        IF stuck_count == 0 (first detection):
          Set stuck_count = 1 in state.
          Log: "WARNING: TASK_X worker appears stuck (strike 1/2)"
          Wait one more monitoring interval.
        IF stuck_count >= 1 (second consecutive detection):
          Log: "TASK_X worker stuck for 2 consecutive checks — killing"
          Call MCP `kill_worker` (worker_id, reason="stuck for 2 checks")
          Set task status to CREATED in registry (for retry)
          Increment retry_count in state for this task
          IF retry_count > retry_limit:
            Set task status to BLOCKED in registry
            Log: "TASK_X exceeded retry limit — marked BLOCKED"
          Remove worker from active workers in state.

      `finished`:
        Trigger completion handler (Step 7).

    6d. Reset stuck_count to 0 for any worker NOT in `stuck` state.

    6e. Write orchestrator-state.md after monitoring pass.

  ### Step 7: Handle Completions

    For each worker with health `finished` (or discovered missing during
    reconciliation):

    7a. Check for completion-report.md:
      Read task-tracking/TASK_YYYY_NNN/completion-report.md

    7b. IF completion-report.md EXISTS:
      Update registry: set task status to COMPLETE
      Move worker from active to completed list in state
      Record: task_id, completion_timestamp
      Log: "TASK_X completed successfully"

    7c. IF completion-report.md DOES NOT EXIST:
      Treat as incomplete/failed.
      Set task status to CREATED in registry (for retry)
      Increment retry_count for this task in state
      IF retry_count > retry_limit:
        Set task status to BLOCKED in registry
        Log: "TASK_X failed {N} times — marked BLOCKED"
      ELSE:
        Log: "TASK_X finished without completion report — will retry
              (attempt {N}/{retry_limit})"
      Move worker from active to failed list in state

    7d. After processing all completions, immediately re-evaluate:
        A completed task may unblock downstream tasks.
        Go back to Step 2 (read registry, rebuild graph).

    7e. Edge case — worker still running after completion-report.md exists:
        If get_worker_stats shows worker is still running but
        completion-report.md exists, wait one monitoring interval.
        If still running after next check, kill it:
        call kill_worker(worker_id, reason="stuck post-completion").

  ### Step 8: Loop Termination Check

    IF no unblocked tasks AND no active workers:
      Log: "All tasks complete or blocked. Auto-pilot stopping."
      Write final orchestrator-state.md with loop_status: STOPPED
      and session summary (total completed, total failed, total time).
      STOP.

    IF no unblocked tasks BUT active workers exist:
      Log: "No unblocked tasks. Waiting for {N} active workers..."
      Go to Step 6 (monitor, wait for completions that may unblock).

    IF unblocked tasks exist:
      Go to Step 4 (select and spawn).

## orchestrator-state.md Format

  [This is the exact markdown format for the state file.
   Written to task-tracking/orchestrator-state.md.
   Must be parseable after compaction — uses clear section headers
   and markdown tables.]

  ```markdown
  # Orchestrator State

  **Loop Status**: RUNNING | STOPPED
  **Last Updated**: YYYY-MM-DD HH:MM:SS
  **Session Started**: YYYY-MM-DD HH:MM:SS

  ## Configuration

  | Parameter           | Value      |
  |---------------------|------------|
  | Concurrency Limit   | 2          |
  | Monitoring Interval | 10 minutes |
  | Stuck Threshold     | 5 minutes  |
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
  ```

  Key design properties:
  - Full file overwrite on every update (atomic write, no appending)
  - All tables use standard markdown (parseable by any agent after compaction)
  - Retry Tracker persists across loop iterations (not just for active workers)
  - Task Queue is informational (recalculated each loop, but useful after compaction)

## MCP Tool Usage Reference

  [When to use each MCP tool in the loop]

  | Tool                 | Used In      | Purpose                                              |
  |----------------------|--------------|------------------------------------------------------|
  | `spawn_worker`       | Step 5       | Launch a new worker session for a task               |
  | `list_workers`       | Step 1       | Reconcile state after compaction/recovery             |
  | `get_worker_activity`| Step 6       | Routine monitoring (compact, context-efficient)       |
  | `get_worker_stats`   | Step 6       | Detailed check when stuck/finished suspected          |
  | `kill_worker`        | Step 6, 7    | Terminate stuck or post-completion workers            |

  Context Efficiency Rule:
  - DEFAULT to `get_worker_activity` for routine checks (returns ~5-10 lines)
  - ESCALATE to `get_worker_stats` only when activity summary indicates
    issues (stuck, finished, or health unclear)
  - NEVER call `get_worker_stats` on every worker every interval

## Error Handling

  ### Worker Failure
  A single worker failure NEVER stops the loop.
  Log the failure, update the task status, continue with remaining tasks.

  ### MCP Unreachable
  If any MCP call fails:
    Retry up to 3 times with 30-second backoff between attempts.
    If still failing after 3 retries:
      Write current state to orchestrator-state.md.
      Log: "MCP session-orchestrator unreachable after 3 retries.
            Auto-pilot paused. State saved. Resolve MCP connection
            and re-run /auto-pilot to resume."
      STOP the loop (do not crash — graceful pause).

  ### Malformed Task Data
  If task.md is missing, unparseable, or has invalid fields:
    Skip that task. Log a warning. Continue with other tasks.

  ### Unexpected Error
  On any unexpected error:
    Write current state to orchestrator-state.md FIRST.
    Then surface the error with context.
    State is preserved for recovery on next /auto-pilot invocation.

  ### Dependency Cycle
  Mark all tasks in the cycle as BLOCKED. Log the cycle chain.
  Continue processing non-cyclic tasks.

## Key Principles

  1. You are the orchestrator of orchestrators — spawn, monitor, loop
  2. Workers invoke /orchestrate — you never re-implement agent logic
  3. Registry is the source of truth for task status
  4. orchestrator-state.md is your private memory across compactions
  5. Only YOU write registry status transitions. Workers write completion-report.md
  6. Prefer get_worker_activity over get_worker_stats for context efficiency
  7. Never spawn duplicate workers — check both registry (IN_PROGRESS) and state (active workers)
  8. A completed task triggers immediate re-evaluation of the dependency graph
  9. Graceful degradation — one failure never crashes the loop
  10. Zero project assumptions — works in any Nitro-Fueled project
```

**Key Design Decisions**:

1. **Prompt template is minimal**: Only `/orchestrate TASK_ID` plus autonomous-mode instruction. The orchestration skill already handles everything else (strategy selection, agent invocation, phase detection). Adding retry context only when retrying. Evidence: requirement 5 (task-description.md:96-107), orchestration skill handles continuation via existing phase detection (SKILL.md:107-134).

2. **Two-strike stuck detection**: First stuck detection = warning. Second consecutive = kill. This avoids premature kills for slow tasks while catching truly stuck workers. `stuck_count` resets to 0 when worker is not stuck, ensuring non-consecutive stuck readings don't accumulate. Evidence: requirement 7 (task-description.md:128-133).

3. **`get_worker_activity` as default, `get_worker_stats` as escalation**: Routine monitoring uses the compact activity summary (~5-10 lines) to minimize orchestrator context consumption. Only escalate to full stats when the summary indicates health issues. Evidence: requirement 7.6 (task-description.md:133), MCP design doc `get_worker_activity` returns a summary string (mcp-session-orchestrator-design.md:181-204).

4. **Atomic state file**: Full overwrite on every update. No append-based log that grows unboundedly. State file must be small enough to read after compaction without consuming excessive context. Evidence: requirement 9 (task-description.md:156-167).

5. **Registry write protocol**: Only auto-pilot writes registry status. Workers signal completion via `completion-report.md`. This prevents concurrent write conflicts. Evidence: risk assessment in task-description.md:259.

6. **Retry tracker persists across iterations**: The retry count for a task survives loop restarts and compactions because it's in `orchestrator-state.md`. After exceeding the retry limit, the task is BLOCKED permanently (manual intervention required). Evidence: requirement 8 (task-description.md:139-149).

**Files Affected**:
- `.claude/skills/auto-pilot/SKILL.md` (CREATE)

---

#### Component 2: `.claude/commands/auto-pilot.md`

**Purpose**: The `/auto-pilot` slash command entry point. Thin wrapper that loads the auto-pilot skill, performs pre-flight checks, and starts the loop.

**Pattern**: Skill-invoking command (like `orchestrate.md`) but with parameter handling and pre-flight checks. Hybrid of the short orchestrate.md pattern and the self-contained create-task.md pattern.
**Evidence**: `.claude/commands/orchestrate.md:1-36` (skill-invoking pattern), `.claude/commands/create-task.md:1-93` (parameter handling pattern).

**Content Structure**:

```
# Auto-Pilot — Autonomous Task Processing

Start the autonomous task processing loop. Reads the task backlog, spawns
workers via MCP session-orchestrator, monitors progress, and loops until
all tasks are complete or blocked.

## Usage

  /auto-pilot                                    # Process all unblocked tasks
  /auto-pilot TASK_YYYY_NNN                      # Process single task only
  /auto-pilot --dry-run                          # Show plan without spawning
  /auto-pilot --concurrency 3 --interval 5m      # Override defaults

### Parameters

  | Parameter       | Format     | Default     | Description                   |
  |-----------------|------------|-------------|-------------------------------|
  | [TASK_ID]       | TASK_YYYY_NNN | (all)    | Process single task only      |
  | --dry-run       | flag       | false       | Show execution plan, no spawn |
  | --concurrency   | integer    | 2           | Max simultaneous workers      |
  | --interval      | Nm         | 10m         | Monitoring interval           |
  | --retries       | integer    | 2           | Max retries per task          |

## Execution Steps

### Step 1: Load Skill

  Read `.claude/skills/auto-pilot/SKILL.md` — this contains the full
  loop logic, state management, and monitoring protocol.

### Step 2: Parse Arguments

  Parse $ARGUMENTS for:
  - A task ID (matches /^TASK_\d{4}_\d{3}$/) -> single-task mode
  - --dry-run flag -> dry-run mode
  - --concurrency N -> override concurrency limit
  - --interval Nm -> override monitoring interval
  - --retries N -> override retry limit

### Step 3: Pre-Flight Checks

  3a. Verify task-tracking/registry.md exists.
      If missing: ERROR — "Registry not found. Run /initialize-workspace first."

  3b. Verify MCP session-orchestrator is available:
      Call MCP `list_workers` (status_filter: 'all').
      If MCP call fails: ERROR — "MCP session-orchestrator not reachable.
      Ensure the MCP server is running. See docs/mcp-session-orchestrator-design.md
      for configuration."

  3c. If single-task mode: verify the task ID exists in the registry
      and its status is CREATED. If not CREATED, warn and confirm.

### Step 4: Display Summary

  Before entering the loop, display:

  ```
  AUTO-PILOT STARTING
  -------------------
  Total tasks in registry: {N}
  Unblocked (ready to run): {N}
  Already in progress: {N}
  Blocked/Cancelled: {N}
  Concurrency limit: {N}
  Monitoring interval: {N} minutes
  Mode: {all | single-task TASK_ID | dry-run}
  ```

### Step 5: Handle Mode

  IF --dry-run:
    Display the dependency graph, unblocked tasks in priority order,
    and the planned execution order (which tasks would spawn first,
    which would queue). Format:

    ```
    DRY RUN — Execution Plan
    ========================

    Dependency Graph:
      TASK_2026_003 -> [no dependencies] (UNBLOCKED)
      TASK_2026_004 -> TASK_2026_003 (WAITING)
      TASK_2026_005 -> TASK_2026_003, TASK_2026_004 (WAITING)
      TASK_2026_006 -> [cycle: TASK_2026_007] (BLOCKED — cycle)

    Execution Order:
      Wave 1 (immediate):  TASK_2026_003 (P0-Critical, FEATURE)
      Wave 2 (after 003):  TASK_2026_004 (P1-High, BUGFIX)
      Wave 3 (after 003+004): TASK_2026_005 (P2-Medium, FEATURE)
      Blocked:             TASK_2026_006 (dependency cycle)

    No workers spawned (dry run).
    ```
    STOP. Do not enter the loop.

  IF single-task mode (TASK_ID provided):
    Spawn one worker for the specified task.
    Monitor until that worker completes.
    Handle completion.
    STOP (do not loop to other tasks).

  IF all-tasks mode (no task ID, no --dry-run):
    Enter the full auto-pilot loop from SKILL.md (Steps 1-8).

## Quick Reference

  **Modes**: all-tasks (default), single-task, dry-run
  **MCP Tools**: spawn_worker, list_workers, get_worker_activity,
                 get_worker_stats, kill_worker
  **State File**: task-tracking/orchestrator-state.md
  **Skill Path**: .claude/skills/auto-pilot/SKILL.md

## References

  - Auto-pilot skill: `.claude/skills/auto-pilot/SKILL.md`
  - Orchestration skill (used by workers): `.claude/skills/orchestration/SKILL.md`
  - Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
  - MCP session-orchestrator design: `docs/mcp-session-orchestrator-design.md`
  - Task template guide: `docs/task-template-guide.md`
```

**Key Design Decisions**:

1. **Hybrid command pattern**: Follows the skill-invoking pattern (loads SKILL.md) but adds parameter parsing and pre-flight checks like the self-contained commands. This keeps the command file focused on entry-point concerns while the skill has the full loop logic. Evidence: `orchestrate.md` loads SKILL.md (line 14), `create-task.md` has Step-based execution (lines 16-76).

2. **Pre-flight checks verify both registry and MCP**: Calling `list_workers` serves as a health check for the MCP server. If it fails, the user gets actionable guidance. Evidence: requirement 2.4 (task-description.md:65).

3. **Dry-run shows dependency graph + wave-based execution plan**: Displays what would happen without spawning. Groups tasks into "waves" based on dependency resolution order. This gives the user full visibility into the auto-pilot's planned execution. Evidence: requirement 2.3 (task-description.md:64).

4. **Single-task mode is fire-and-forget**: Spawns one worker, monitors to completion, stops. No looping to other tasks. This is useful for re-running a single failed task. Evidence: requirement 2.2 (task-description.md:63).

**Files Affected**:
- `.claude/commands/auto-pilot.md` (CREATE)

---

#### Component 3: `CLAUDE.md` Update

**Purpose**: Mark "Build auto-pilot skill/command" as DONE in the Development Priority list.

**Evidence**: Current line at `CLAUDE.md:41` reads: `3. Build auto-pilot skill/command`

**Change**: Replace line 41 with:
```
3. ~~Build auto-pilot skill/command~~ DONE
```

This matches the pattern used for items 1 and 2 on lines 39-40.

**Files Affected**:
- `CLAUDE.md` (MODIFY -- change one line in Development Priority section)

---

## Integration Architecture

### Data Flow

```
Developer invokes /auto-pilot
  |
  v
auto-pilot.md (command)
  |-- Pre-flight: verify registry.md exists
  |-- Pre-flight: verify MCP via list_workers
  |-- Parse arguments (mode, overrides)
  |-- Load auto-pilot/SKILL.md
  |
  v
SKILL.md Core Loop
  |
  |-- Step 1: Read orchestrator-state.md (if exists) -> restore state
  |            Call list_workers -> reconcile with state
  |
  |-- Step 2: Read registry.md + all TASK_*/task.md -> extract metadata
  |
  |-- Step 3: Build dependency graph -> classify tasks
  |            (unblocked, in_progress, blocked, complete)
  |
  |-- Step 4: Sort unblocked by Priority -> select next tasks
  |
  |-- Step 5: For each selected task:
  |            |-- Generate prompt: "/orchestrate TASK_ID" + autonomous mode
  |            |-- Call MCP spawn_worker(prompt, dir, label)
  |            |-- Update registry: CREATED -> IN_PROGRESS
  |            |-- Record worker in orchestrator-state.md
  |            v
  |            Worker Session (iTerm2 tab)
  |              |-- Runs /orchestrate TASK_YYYY_NNN
  |              |-- Orchestration skill drives PM->Architect->Dev->QA
  |              |-- Writes completion-report.md on success
  |              |-- Process exits
  |
  |-- Step 6: Wait monitoring interval
  |            For each active worker:
  |              Call get_worker_activity -> parse health
  |              If issues: call get_worker_stats -> detailed check
  |              Handle: healthy/high_context/compacting (log only)
  |                      stuck (2-strike kill)
  |                      finished (-> Step 7)
  |
  |-- Step 7: For finished workers:
  |            Check completion-report.md exists?
  |              YES -> registry: IN_PROGRESS -> COMPLETE
  |              NO  -> registry: IN_PROGRESS -> CREATED (retry)
  |                     or IN_PROGRESS -> BLOCKED (exceeded retries)
  |            Re-evaluate dependency graph (completions may unblock tasks)
  |
  |-- Step 8: Loop termination check
  |            No unblocked + no active -> STOP
  |            No unblocked + active workers -> monitor (Step 6)
  |            Unblocked tasks available -> spawn (Step 4)
  |
  v
Write final orchestrator-state.md (loop_status: STOPPED, summary)
```

### Source of Truth Boundaries

| Data | Source of Truth | Who Reads | Who Writes |
|------|----------------|-----------|------------|
| Task status (CREATED/IN_PROGRESS/COMPLETE/BLOCKED) | `registry.md` | Auto-pilot, workers (phase detection) | Auto-pilot only |
| Task completion signal | `completion-report.md` in task folder | Auto-pilot (Step 7) | Workers (orchestration skill completion phase) |
| Auto-pilot loop state | `orchestrator-state.md` | Auto-pilot (Step 1) | Auto-pilot (Steps 5, 6, 7, 8) |
| Task metadata (Type, Priority, Dependencies) | `task.md` in task folder | Auto-pilot (Step 2) | User or /create-task |
| Worker process state (PID, health) | MCP session-orchestrator (in-memory) | Auto-pilot via MCP tools | MCP server (automatic) |

### Worker Isolation Model

Each worker runs in:
- Its own iTerm2 tab (spawned by MCP `spawn_worker`)
- Its own Claude Code session with a fresh 1M context window
- Its own working directory (same project root, shared filesystem)
- Complete independence from the orchestrator session

Workers communicate with the auto-pilot ONLY through the filesystem:
- Workers write `completion-report.md` -> auto-pilot reads it
- Workers read `registry.md` for phase detection -> auto-pilot writes it
- No direct worker-to-orchestrator communication channel

---

## Quality Requirements (Architecture-Level)

### Context Efficiency
- Auto-pilot MUST prefer `get_worker_activity` (5-10 lines) over `get_worker_stats` (full JSON) for routine monitoring
- `orchestrator-state.md` MUST be concise: markdown tables, no prose, no logs
- The auto-pilot session should survive multiple compactions during long runs

### Reliability
- Single worker failure MUST NOT crash the loop
- MCP unavailability MUST trigger graceful pause with state preservation
- Compaction recovery MUST reconcile state against live MCP data
- Duplicate worker prevention: check BOTH registry (IN_PROGRESS) AND state (active workers list)

### Consistency
- Registry format, task ID format, and status values MUST match `.claude/skills/orchestration/references/task-tracking.md` exactly
- Command structure MUST follow existing patterns in `.claude/commands/`
- Skill structure MUST follow existing pattern in `.claude/skills/orchestration/SKILL.md`

### Project-Agnostic
- Zero assumptions about target project tech stack, languages, or directory structure
- Only assumption: Nitro-Fueled `task-tracking/` convention exists and MCP session-orchestrator is configured

---

## Team-Leader Handoff

### Developer Type Recommendation
**Recommended Developer**: backend-developer
**Rationale**: All deliverables are markdown files with precise structural requirements. Requires careful cross-referencing of existing documentation (MCP tool signatures, registry format, skill patterns). No frontend/UI work. The "backend" developer handles structure-sensitive, logic-heavy content work best.

### Complexity Assessment
**Complexity**: MEDIUM
**Estimated Effort**: 2-4 hours
**Rationale**: Three files to create/modify. The SKILL.md is substantial (~300-400 lines of structured loop logic with detailed state management, error handling, and monitoring protocol). The command file is moderate. CLAUDE.md change is trivial. Main effort is ensuring all cross-references are exact and the loop logic is complete and unambiguous.

### Files Affected Summary

**CREATE**:
- `.claude/skills/auto-pilot/SKILL.md` -- Core auto-pilot loop skill (largest deliverable)
- `.claude/commands/auto-pilot.md` -- `/auto-pilot` command entry point

**MODIFY**:
- `CLAUDE.md` -- Mark item 3 as DONE in Development Priority (line 41)

### Architecture Delivery Checklist
- [x] All components specified with evidence (skill pattern from orchestration/SKILL.md, command pattern from orchestrate.md + create-task.md)
- [x] All patterns verified from codebase (YAML frontmatter, section structure, registry format, status values)
- [x] All MCP tool signatures verified from design doc (5 tools with exact parameters and return types)
- [x] Quality requirements defined (context efficiency, reliability, consistency, project-agnostic)
- [x] Integration points documented (registry, orchestrator-state.md, completion-report.md, MCP tools)
- [x] Files affected list complete (2 CREATE, 1 MODIFY)
- [x] Developer type recommended (backend-developer)
- [x] Complexity assessed (MEDIUM, 2-4 hours)
- [x] orchestrator-state.md format fully designed (markdown tables, all fields specified)
- [x] Prompt template fully designed (minimal, autonomous mode, retry context)
- [x] Monitoring protocol fully specified (activity-first, stats-on-escalation, two-strike stuck)
- [x] Dry-run output format fully specified (dependency graph + wave-based execution plan)
- [x] Registry write protocol specified (only auto-pilot writes; workers signal via completion-report.md)
- [x] State machine defined: CREATED -> IN_PROGRESS -> COMPLETE | CREATED (retry) | BLOCKED (max retries)
- [x] No step-by-step implementation details (team-leader will decompose into atomic tasks)
