---
title: Auto-Pilot Guide
description: Run the Supervisor loop to process your entire task backlog autonomously.
---

Auto-Pilot is the Supervisor mode that processes your entire task backlog without manual intervention. You run one command, walk away, and come back to completed tasks with code committed, reviews done, and completion reports written.

---

## Starting Auto-Pilot

```bash
# CLI
npx nitro-fueled run

# Slash command (from inside Claude Code)
/auto-pilot
```

Both start the same Supervisor loop. The CLI version runs in the terminal; the slash command version runs inside your Claude Code session.

---

## Configuration

Auto-Pilot configuration lives in `task-tracking/orchestrator-state.md`. Edit this file before starting a session to override defaults.

| Parameter | Default | Maximum | Description |
|-----------|---------|---------|-------------|
| `concurrency` | `3` | `5` | Maximum simultaneous workers |
| `monitoring_interval_minutes` | `10` | — | Time between health checks per worker |
| `retry_limit` | `2` | `5` | Maximum retries before a task is marked `FAILED` |

Example configuration section in `orchestrator-state.md`:

```markdown
## Active Configuration

| Parameter | Value |
|-----------|-------|
| concurrency | 3 |
| monitoring_interval_minutes | 10 |
| retry_limit | 2 |
```

---

## Pre-Flight Validation

Before spawning any workers, the Supervisor validates:

1. `task-tracking/registry.md` exists and is readable
2. At least one task is in an actionable state (`CREATED` or `IMPLEMENTED`)
3. The `session-orchestrator` MCP server responds to a test call
4. No circular dependencies exist in the task dependency graph
5. iTerm2 is running and accepts AppleScript commands
6. The `task-tracking/` directory is writable

If any check fails, the Supervisor prints the failing check and exits without spawning workers. Fix the reported issue and re-run.

---

## Dependency Graph

Express task dependencies in the `Dependencies` field of `task.md`:

```markdown
## Dependencies

- TASK_2026_003 — database schema must exist before this task
- TASK_2026_005 — auth service required for integration tests
- None
```

The Supervisor builds a directed acyclic graph (DAG) before each scheduling cycle. Tasks are organized into waves:

- **Wave 1:** Tasks with no dependencies — run in parallel immediately
- **Wave 2:** Tasks whose only dependencies are in Wave 1 — run after Wave 1 completes
- **Wave N:** Tasks whose dependencies are all in earlier waves

**Circular dependency detection** runs during pre-flight. If a cycle is detected (e.g., Task A depends on Task B, and Task B depends on Task A), the Supervisor reports the specific task IDs that form the cycle and exits.

---

## Worker Health Monitoring

The Supervisor checks worker health on every monitoring interval by calling `get_worker_stats` on the MCP server. The MCP server reads the worker's JSONL conversation file in real time.

| Health State | Condition | Action |
|-------------|-----------|--------|
| `healthy` | Active, context under 80%, tool calls within last 120s | Continue monitoring |
| `high_context` | Context usage over 80% | Log warning, continue |
| `stuck` | No tool calls in last 120 seconds | First strike: log and continue |
| `finished` | Worker process has exited | Verify state transition |

### Two-Strike Stuck Handling

- **Strike 1:** Log the stuck state in `orchestrator-state.md`, continue to next monitoring cycle
- **Strike 2:** Kill the worker (`kill_worker` MCP call with SIGTERM → SIGKILL), reset task status to `CREATED`, increment retry counter

If retries are exhausted (counter reaches `retry_limit`), the task is marked `FAILED` and added to the blocked queue. The Supervisor continues processing other tasks.

---

## File Overlap Detection

Before spawning a new worker, the Supervisor checks whether the task's referenced files overlap with files currently being modified by an active worker. If overlap is detected, the new task is delayed until the conflicting worker finishes.

This prevents two workers from modifying the same file simultaneously and creating merge conflicts.

---

## orchestrator-state.md

`task-tracking/orchestrator-state.md` is the Supervisor's persistent memory. It is written after every worker event — spawn, health check, completion, and failure.

Contents:

```markdown
## Active Workers

| Worker ID | Task ID | Status | Context % | Cost USD | Started |
|-----------|---------|--------|-----------|----------|---------|
| abc-123 | TASK_2026_004 | running | 34% | $1.20 | 14:32 |
| def-456 | TASK_2026_006 | running | 18% | $0.80 | 14:45 |

## Completed This Session

- TASK_2026_001 — COMPLETE (Build + Review, $4.20 total)
- TASK_2026_002 — COMPLETE (Build + Review, $3.60 total)

## Next in Queue

1. TASK_2026_007 (P1-High) — waiting for slot
2. TASK_2026_008 (P2-Medium) — waiting for TASK_2026_005 to complete

## Active Configuration

| Parameter | Value |
|-----------|-------|
| concurrency | 3 |
| monitoring_interval_minutes | 10 |
| retry_limit | 2 |
```

**Recovery from compaction:** When the Supervisor's Claude Code session is compacted, the Supervisor re-reads `orchestrator-state.md` on its next invocation to restore context and continue monitoring in-flight workers without losing state.

---

## Stop Conditions

The Supervisor exits cleanly when any of the following are true:

- All tasks in the registry are in a terminal state (`COMPLETE`, `FAILED`, or `CANCELLED`)
- All remaining tasks are `BLOCKED` with no path to becoming actionable
- All `FAILED` tasks have exhausted their retry limit
- The MCP server becomes unreachable mid-session

When the Supervisor stops, it prints a summary of what was accomplished and any tasks that require manual attention.

---

## Troubleshooting

**Supervisor exits immediately with "no actionable tasks"**

Check that at least one task has status `CREATED` or `IMPLEMENTED`. Run `npx nitro-fueled status` to verify. If tasks exist but are `BLOCKED`, check their `Dependencies` field — the dependency tasks may not be `COMPLETE`.

**Workers spawn but never transition to IMPLEMENTED**

Open the worker's iTerm2 tab and look for error output. Common causes:
- The worker hit a permission prompt and is waiting (should not happen with `--dangerously-skip-permissions`)
- The codebase has a build error that prevents the Developer from completing
- The MCP server lost connection and the worker stopped mid-task

**Retry limit exhausted for a task**

The task is marked `FAILED`. Read `task-tracking/TASK_YYYY_NNN/` for any partial completion-report or error files. Fix the underlying issue (ambiguous task description, missing dependency, codebase error) then reset the status file to `CREATED` and manually re-run:

```bash
echo -n "CREATED" > task-tracking/TASK_YYYY_NNN/status
npx nitro-fueled run TASK_YYYY_NNN
```

---

## See Also

- [Supervisor Concept](../concepts/supervisor/) — The 9-step control loop explained
- [Workers Concept](../concepts/workers/) — Worker health states and communication
- [Commands Reference](../commands/) — `/auto-pilot`, `npx nitro-fueled run`
- [Tasks Concept](../concepts/tasks/) — State machine and dependency format
