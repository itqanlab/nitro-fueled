# Auto-Pilot -- Supervisor Task Processing

Start the Supervisor loop. Reads the task backlog, spawns Build Workers
and Review Workers via MCP session-orchestrator, monitors state transitions,
and loops until all tasks are complete or blocked.

## Usage

```
/auto-pilot                                    # Process all unblocked tasks
/auto-pilot TASK_YYYY_NNN                      # Process single task only
/auto-pilot --dry-run                          # Show plan without spawning
/auto-pilot --concurrency 3 --interval 5m      # Override defaults
/auto-pilot --force                            # Override stale RUNNING state
```

### Parameters

| Parameter       | Format        | Default | Description                   |
|-----------------|---------------|---------|-------------------------------|
| [TASK_ID]       | TASK_YYYY_NNN | (all)   | Process single task only      |
| --dry-run       | flag          | false   | Show execution plan, no spawn |
| --concurrency   | integer       | 3       | Max simultaneous workers      |
| --interval      | Nm            | 10m     | Monitoring interval           |
| --retries       | integer       | 2       | Max retries per task          |
| --force         | flag          | false   | Override stale RUNNING state  |

## Execution Steps

### Step 1: Load Skill

Read `.claude/skills/auto-pilot/SKILL.md` -- this contains the full
Supervisor loop logic, worker type determination, state management,
and monitoring protocol.

### Step 2: Parse Arguments

Parse $ARGUMENTS for:
- A task ID (matches `/^TASK_\d{4}_\d{3}$/`) -> single-task mode
- `--dry-run` flag -> dry-run mode
- `--concurrency N` -> override concurrency limit
- `--interval Nm` -> override monitoring interval
- `--retries N` -> override retry limit
- `--force` flag -> override stale RUNNING state from a previous session

### Step 3: Pre-Flight Checks

**3a.** Verify `task-tracking/registry.md` exists.
If missing: ERROR -- "Registry not found. Run /initialize-workspace first."

**3b.** Verify MCP session-orchestrator is available:
Call MCP `list_workers` (status_filter: 'all').
If MCP call fails or the tool does not exist: **STOP IMMEDIATELY.**
Display: "FATAL: MCP session-orchestrator is not configured or not running.
The Supervisor REQUIRES the MCP session-orchestrator to spawn separate
worker sessions in their own terminal windows. Without it, tasks cannot
be processed. Do NOT use the Agent tool as a fallback — sub-agents share
context and break the architecture. Configure the MCP server in
.claude/settings.json and restart."
**EXIT. Do not continue to Step 4.**

**3c.** If single-task mode: verify the task ID exists in the registry
and its status is CREATED or IMPLEMENTED. If status is IN_PROGRESS or
IN_REVIEW, the Supervisor will spawn the appropriate worker type to resume.
If COMPLETE, warn and confirm. If BLOCKED or CANCELLED, error.

### Step 4: Display Summary

Before entering the loop, display:

```
SUPERVISOR STARTING
-------------------
Total tasks in registry: {N}
Ready for build (CREATED): {N}
Building (IN_PROGRESS): {N}
Ready for review (IMPLEMENTED): {N}
Reviewing (IN_REVIEW): {N}
Complete: {N}
Blocked/Cancelled: {N}
Concurrency limit: {N}
Monitoring interval: {N} minutes
Mode: {all | single-task TASK_ID | dry-run}
```

### Step 5: Handle Mode

**IF `--dry-run`:**

Display the dependency graph, task classifications by state,
and the planned execution order with worker types. Format:

```
DRY RUN -- Execution Plan
========================

Dependency Graph:
  TASK_2026_003 -> [no dependencies] (READY_FOR_BUILD)
  TASK_2026_004 -> TASK_2026_003 (WAITING)
  TASK_2026_005 -> [no dependencies] (READY_FOR_REVIEW)

Execution Order:
  Wave 1 (immediate):
    Review: TASK_2026_005 (P1-High, FEATURE) -- Review Worker
    Build:  TASK_2026_003 (P0-Critical, FEATURE) -- Build Worker
  Wave 2 (after 003):
    Build:  TASK_2026_004 (P1-High, BUGFIX) -- Build Worker
  Blocked: TASK_2026_006 (dependency cycle)

No workers spawned (dry run).
```

STOP. Do not enter the loop.

**IF single-task mode (TASK_ID provided):**

Determine worker type from current registry state.
Spawn appropriate worker (Build or Review).
Monitor until that worker completes and state transitions.
If state transitioned to IMPLEMENTED (Build Worker done),
automatically spawn Review Worker and monitor until COMPLETE.
STOP after task reaches COMPLETE or failure.

**IF all-tasks mode (no task ID, no `--dry-run`):**

Enter the full Supervisor loop from SKILL.md (Steps 1-8).

## Quick Reference

**Worker Types**: Build Worker (CREATED -> IMPLEMENTED), Review Worker (IMPLEMENTED -> COMPLETE)
**Modes**: all-tasks (default), single-task, dry-run
**MCP Tools**: spawn_worker, list_workers, get_worker_activity,
              get_worker_stats, kill_worker
**State File**: task-tracking/orchestrator-state.md
**Skill Path**: .claude/skills/auto-pilot/SKILL.md

## References

- Supervisor skill: `.claude/skills/auto-pilot/SKILL.md`
- Orchestration skill (used by workers): `.claude/skills/orchestration/SKILL.md`
- Task tracking conventions: `.claude/skills/orchestration/references/task-tracking.md`
- MCP session-orchestrator design: `docs/mcp-session-orchestrator-design.md`
- Task template guide: `docs/task-template-guide.md`
