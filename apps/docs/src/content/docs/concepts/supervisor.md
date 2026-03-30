---
title: Supervisor
description: The Auto-Pilot Supervisor that coordinates workers end-to-end.
---

The **Supervisor** is the orchestrator-of-orchestrators. It reads your task backlog, builds a dependency graph, spawns Build Workers and Review Workers via the `nitro-cortex` MCP server, monitors their health, handles failures, and loops until all tasks are complete or blocked. You do not need to watch it — it runs autonomously.

---

## The 9-Step Control Loop

The Supervisor executes the following loop continuously until all tasks are done or a stop condition is met:

**Step 1: Read state**

Read `task-tracking/registry.md` and all `task-tracking/TASK_YYYY_NNN/task.md` files. Read `task-tracking/plan.md` for the Planner's "Current Focus" guidance. Load `task-tracking/orchestrator-state.md` if recovering from a previous session.

**Step 2: Build dependency graph**

For each task, check its `Dependencies` field. A task is **actionable** only when all listed dependencies have status `COMPLETE`. Tasks with unmet dependencies are marked `BLOCKED`.

**Step 3: Find actionable tasks**

Collect tasks that are ready to run:
- `CREATED` tasks with all dependencies `COMPLETE` → candidates for a Build Worker
- `IMPLEMENTED` tasks → candidates for a Review Worker

Order candidates by priority (P0 first) and use `plan.md` ordering as a tiebreaker.

**Step 4: Apply concurrency limit**

Check how many workers are currently active. If the count is below the concurrency limit (default: 3), spawn new workers for the next candidates in the queue.

**Step 5: Spawn workers**

Call the MCP `spawn_worker` tool for each selected task. The tool opens a new iTerm2 tab, launches a fresh Claude Code session, and sends the orchestration prompt. Record the worker ID, PID, and task association in `orchestrator-state.md`.

**Step 6: Monitor health**

After the configured monitoring interval (default: 5 minutes), call `get_worker_stats` for each active worker. Evaluate health state (`healthy`, `high_context`, `compacting`, `stuck`, `finished`). Apply two-strike stuck detection. Log cost and context percentage.

**Step 7: Detect completions**

For each worker where health is `finished`:
- Read the task's `status` file
- Verify the expected state transition occurred (Build Worker should produce `IMPLEMENTED`; Review Worker should produce `COMPLETE` or `FAILED`)
- If no transition occurred, count as a failure and apply retry logic
- Kill the worker process if it is still running after completion

**Step 8: Update orchestrator state**

Write all current worker states, completed tasks, queue position, and configuration to `task-tracking/orchestrator-state.md`. This file survives context compaction — if the Supervisor's session is compacted, it re-reads this file to recover full context.

**Step 9: Loop**

Return to Step 1. Continue until the stop condition is met.

---

## Pre-Flight Validation

Before the first worker is spawned, the Supervisor performs these checks:

1. `task-tracking/registry.md` exists and is readable
2. At least one task is in `CREATED` or `IMPLEMENTED` state
3. The `nitro-cortex` MCP server is reachable
4. No circular dependencies exist in the dependency graph
5. iTerm2 is running (required for worker tab spawning)
6. The `task-tracking/` directory is writable

If any check fails, the Supervisor reports the issue and exits cleanly rather than spawning workers that will immediately fail.

---

## Dependency Graph

Dependencies are expressed in the `Dependencies` field of `task.md` using task IDs:

```markdown
## Dependencies

- TASK_2026_003 — database schema must be finalized first
- TASK_2026_005 — auth service must be live before this can be tested
```

The Supervisor builds a directed acyclic graph (DAG) from all task dependencies before each scheduling cycle. Tasks are executed in waves:

- **Wave 1** — all tasks with no dependencies (run in parallel up to concurrency limit)
- **Wave 2** — tasks whose only dependencies are in Wave 1
- **Wave N** — tasks whose dependencies are all in earlier waves

Circular dependency detection runs during pre-flight. If a cycle is detected, the Supervisor reports which tasks form the cycle and exits without spawning any workers.

---

## Concurrency and Configuration

Default configuration values:

| Parameter | Default | Maximum | Description |
|-----------|---------|---------|-------------|
| Concurrency | 3 | 5 | Maximum simultaneous workers |
| Monitoring interval | 5 min | — | Time between health checks |
| Retry limit | 2 | 5 | Maximum retries per failed task |

Configuration can be adjusted by passing flags to `npx @itqanlab/nitro-fueled run` (e.g., `--concurrency N`, `--interval Nm`, `--retries N`). Active configuration is written to the session state file at startup.

---

## Recovery via orchestrator-state.md

The Supervisor persists its full state after every worker event. The `orchestrator-state.md` file contains:

- Active workers: worker ID, task ID, current status, cost so far
- Completed tasks this session
- Next tasks in the queue
- Active configuration (concurrency, retry limits)
- Retry counter per task

When the Supervisor's Claude Code session is compacted (context reset), the Supervisor re-reads `orchestrator-state.md` on its next invocation to restore context and resume without losing track of in-flight workers.

---

## Stop Conditions

The Supervisor exits cleanly when any of the following conditions are met:

- All tasks in the registry are in a terminal state (`COMPLETE`, `FAILED`, or `CANCELLED`)
- All remaining tasks are `BLOCKED` with no actionable path forward
- All tasks are `FAILED` and the retry limit has been exhausted for each

The Supervisor also stops and reports if it detects the MCP server has become unreachable mid-session, rather than silently leaving workers unmonitored.

---

## See Also

- [Workers](workers/) — How workers execute tasks and communicate with the Supervisor
- [Auto-Pilot Guide](../../auto-pilot/) — Full configuration reference and recovery details
- [Tasks](tasks/) — Task state machine and dependency format
