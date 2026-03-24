# Auto-Pilot — Autonomous Task Processing

Start the autonomous task processing loop. Reads the task backlog, spawns
workers via MCP session-orchestrator, monitors progress, and loops until
all tasks are complete or blocked.

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

Read `.claude/skills/auto-pilot/SKILL.md` — this contains the full
loop logic, state management, and monitoring protocol.

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
If missing: ERROR — "Registry not found. Run /initialize-workspace first."

**3b.** Verify MCP session-orchestrator is available:
Call MCP `list_workers` (status_filter: 'all').
If MCP call fails: ERROR — "MCP session-orchestrator not reachable.
Ensure the MCP server is running. See docs/mcp-session-orchestrator-design.md
for configuration."

**3c.** If single-task mode: verify the task ID exists in the registry
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

**IF `--dry-run`:**

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

**IF single-task mode (TASK_ID provided):**

Spawn one worker for the specified task.
Monitor until that worker completes.
Handle completion.
STOP (do not loop to other tasks).

**IF all-tasks mode (no task ID, no `--dry-run`):**

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
