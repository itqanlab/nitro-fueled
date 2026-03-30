---
title: Workers
description: Build Workers and Review Workers in the Nitro-Fueled architecture.
---

A **worker** is an isolated Claude Code session running in its own iTerm2 tab with a fresh 1 million token context window. Workers are the execution units of Nitro-Fueled — they read the task folder, invoke specialist agents, produce artifacts, and update task state. When a worker finishes, the iTerm2 tab closes automatically.

The isolation is deliberate: each worker starts with a clean context, preventing token bleed between tasks and keeping costs predictable.

---

## Worker Types

| Worker Type | Spawned When | What It Does | Exit State |
|-------------|-------------|--------------|------------|
| **Build Worker** | Task status is `CREATED` | Runs `/orchestrate` — drives the PM → Architect → Team-Leader → Developer pipeline. Writes code, creates commits, produces `completion-report.md`. | `IMPLEMENTED` |
| **Review Worker** (Review Lead + Test Lead) | Task status is `IMPLEMENTED` | Spawns two parallel workers: a Review Lead that runs logic, style, and security checks; and a Test Lead that runs the test suite. Both write their findings to the task folder. | `COMPLETE` or `FAILED` |
| **Fix Worker** | Review Worker finds blocking issues (`FAILED` state) | Applies the reviewer findings, re-runs QA checks, writes updated review output. Spawned automatically when Review Lead or Test Lead finds issues. | `COMPLETE` |
| **Completion Worker** | Review and tests are clean | Writes `completion-report.md`, sets task status to `COMPLETE`, and updates `plan.md`. Spawned automatically when both Review Lead and Test Lead produce clean results. | `COMPLETE` |
| **Cleanup Worker** | Build Worker is killed mid-task with uncommitted work | Salvages any uncommitted work from the killed worker, creates a recovery commit, and prepares the task for retry. | Resets to `CREATED` for retry |

---

## How Workers Communicate

Workers communicate with the Supervisor and with each other through two channels:

**1. Status file**

Every task has a `task-tracking/TASK_YYYY_NNN/status` file. The Build Worker writes `IN_PROGRESS` when it starts and `IMPLEMENTED` when it finishes. The Review Worker writes `IN_REVIEW` when it starts and either `COMPLETE` or `FAILED` when it finishes. The Supervisor polls this file to detect state transitions.

**2. Git commits**

The Team-Leader agent (inside the Build Worker) owns all git commits. Each batch of implementation work is committed with a structured message referencing the task ID. The Supervisor can inspect `git log` to verify a Build Worker made progress even if the status file has not been updated yet.

---

## Worker Health States

The `nitro-cortex` MCP server monitors each worker's token usage and activity in real time by watching the worker's JSONL conversation file. Health is assessed on every monitoring interval (default: 5 minutes):

| Health State | Condition | Supervisor Action |
|-------------|-----------|------------------|
| `healthy` | Active, context under 80%, no long gaps | Continue monitoring |
| `high_context` | Context usage above 80% | Log warning, continue |
| `compacting` | Context window is being compacted (normal — Claude Code auto-compaction activated) | Wait for compaction to complete; do not count as stuck |
| `stuck` | No tool calls in last 120 seconds | First strike: warn and continue |
| `finished` | Worker process has exited | Check state transition |

---

## Two-Strike Stuck Detection

If the Supervisor detects a worker is `stuck` on two consecutive monitoring cycles, it takes action:

1. **First strike** — Log a warning, record the stuck state in `orchestrator-state.md`, continue monitoring
2. **Second strike** — Kill the worker (SIGTERM → SIGKILL after 5 seconds), reset the task status to `CREATED`, increment the retry counter

If the retry counter reaches the configured limit (default: 2, max: 5), the task is marked `FAILED` and added to the manual review queue.

---

## Worker Context Window

Each worker starts with a full 1 million token context window. The `nitro-cortex` tracks context usage as a percentage and reports it on every health check. When context usage exceeds 80%, Claude Code's automatic context compaction may activate.

The Supervisor detects compaction events by monitoring for a significant drop in token count between conversation turns (a drop of more than 30% signals compaction). The compaction count is tracked in worker stats and reported in `orchestrator-state.md`.

---

## Spawning a Worker Manually

The Supervisor spawns workers automatically via the MCP `spawn_worker` tool, but you can also spawn one manually using nitro-cortex tools or by running the command directly:

```bash
# Run a Build Worker for a single task
npx @itqanlab/nitro-fueled run TASK_2026_001

# Or from inside Claude Code
/orchestrate TASK_2026_001
```

When spawned manually, the worker runs in the current terminal session rather than a new iTerm2 tab.

---

## Worker Cost Profile

Each worker consumes tokens for its entire agent pipeline. Typical costs based on task complexity:

| Complexity | Typical Build Worker Cost | Typical Review Worker Cost |
|------------|--------------------------|---------------------------|
| Simple | $2–4 | $1–2 |
| Medium | $4–8 | $2–4 |
| Complex | $8–15 | $4–8 |

These are estimates based on Claude Sonnet 4.6 pricing. Costs increase if the worker triggers context compaction, as compaction cycles burn additional input tokens.

---

## See Also

- [Supervisor](supervisor/) — How the Supervisor spawns and monitors workers
- [Auto-Pilot Guide](../../auto-pilot/) — Configuration, health monitoring, recovery
- [Core Concepts Overview](../) — The full architecture diagram
