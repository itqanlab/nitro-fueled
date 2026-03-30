---
name: supervisor
description: >
  Supervisor loop for Nitro-Fueled orchestration.
  Use when: Running batch task execution, processing a task backlog,
  or spawning parallel workers for multiple tasks.
  Reads the task registry and task folders, builds a dependency graph,
  spawns Build Workers and Review Workers via MCP nitro-cortex,
  monitors health and state transitions, and loops.
  Invoked via /auto-pilot command.
---

# Supervisor Skill

## HARD RULES — READ BEFORE ANYTHING ELSE

**Violating ANY of these rules is a critical failure. Re-read this block after every compaction.**

### NEVER DO (instant violations)
1. **NEVER use Bash to read files** — no `cat`, `head`, `tail`, `for` loops reading task.md/status files. Use the **Read tool** for files. Use **MCP tools** for task data.
2. **NEVER read task.md during pre-flight** — pre-flight uses registry columns ONLY. Task.md is read JIT at spawn time (one task at a time).
3. **NEVER load reference files during startup** — Steps 1-4 require ZERO reference files. Only load a reference at the moment it's needed (first spawn → worker-prompts.md, entering core loop → parallel-mode.md).
4. **NEVER hallucinate providers** — the ONLY available providers are what `get_available_providers()` returned. Do not invent names like "Cloudcode", "Codex", etc.
5. **NEVER print tables in the monitoring loop** — heartbeats are ONE LINE. No tables, no summaries, no analysis between heartbeat and `sleep`.
6. **NEVER think for >10 seconds without calling a tool** — if you're reasoning/planning, you're stalling. Call `Bash: sleep 30` immediately.
7. **NEVER go on tangents** — do not check for "newer tasks", explore the codebase, or investigate things not in the current step. Follow the steps sequentially.
8. **NEVER end your turn after spawning workers** — after the last `spawn_worker` call completes, your VERY NEXT action MUST be `Bash: sleep 30`. Not a summary. Not a table. Not text to the user. Just `sleep`. If you output text or end your turn here, workers run unmonitored and the session is dead. The sequence is: `spawn_worker` → `sleep 30` → `get_pending_events` → loop. This is the #1 cause of supervisor stalls.
9. **NEVER print wave tables, queue summaries, or notes to the conversation** — all structured output (tables, queues, routing plans, wave headers, explanatory paragraphs) goes to `log.md` or the DB only. Conversation output is ONE LINE per event maximum: `SPAWNED worker=X task=Y provider=Z`.

### ALWAYS DO
1. **Parallel tool calls** — read registry + active-sessions + config in ONE round, not three.
2. **Single timestamp capture** — call `date` once, reuse the result everywhere.
3. **Heartbeat → sleep → poll** — this is the monitoring loop. Nothing else between these three.
4. **Use MCP for provider info** — `get_available_providers()` and `get_provider_stats()` replace all config file reads.
5. **Spawn → sleep atomic sequence** — after the last `spawn_worker` in a wave, call `Bash: sleep 30` as the immediate next tool call. This is how you enter the monitoring loop. No text output between spawn and sleep.

---

Autonomous loop that processes the task backlog by spawning, monitoring, and managing **Build Workers** and **Review Workers** via MCP nitro-cortex.

## Quick Start

```
/auto-pilot                          # Process all unblocked tasks
/auto-pilot --limit N                # Process N tasks then stop (e.g. --limit 2 for e2e testing)
/auto-pilot TASK_YYYY_NNN            # Process single task only
/auto-pilot --dry-run                # Show plan without spawning
```

---

## Your Role: Supervisor

**CRITICAL**: You are the **Supervisor** (orchestrator of orchestrators), NOT the implementer. You spawn worker sessions that each run `/orchestrate TASK_YYYY_NNN`. You monitor those workers, handle completions and failures, and loop until the backlog is drained.

### Primary Responsibilities

1. **Read registry at startup; read task.md files just-in-time before each spawn** -- build the dependency graph
2. **Identify actionable tasks** (CREATED or IMPLEMENTED) and order by priority
3. **Spawn appropriate worker type** based on task state (Build Worker for CREATED/IN_PROGRESS, Review+Fix Worker for IMPLEMENTED/IN_REVIEW)
4. **Monitor worker health** on a configurable interval
5. **Handle completions**: check if state transitioned, decide next action
6. **Handle failures**: if state didn't transition, respawn same worker type (counts as retry)
7. **Persist state** to `{SESSION_DIR}state.md` for compaction survival
8. **Loop** until the backlog is drained, all remaining tasks are blocked, or `--limit` is reached

### What You Never Do

- Write code, implement tasks, verify code quality, or handle task artifacts — workers do all of that
- Modify the orchestration skill or re-implement agent sequencing
- Update the registry — workers update their own states

### CRITICAL: Data Access Rules

**NEVER use Bash, Read, Grep, or Glob to read task data when MCP tools are available.**

| Need | Use THIS | NEVER use |
|------|----------|-----------|
| Task list/status | `list_workers(status_filter)` or `get_tasks()` MCP | `npx nitro-fueled status`, `Read registry.md`, `Grep registry.md` |
| Task metadata before spawn | `get_task_context(task_id)` MCP | `cat task.md`, `Read task.md`, `Bash` on task files |
| Worker health | `get_worker_activity(worker_id)` MCP (5-line compact) | `get_worker_stats` (15+ lines), file reads |
| Task state | Per-task `status` file (single word) or MCP `get_tasks()` | Full `task.md` reads, registry.md grep |

**File reads are ONLY acceptable when:** MCP tools are confirmed unavailable (cortex_available = false).

**`npx nitro-fueled status` is PROHIBITED** inside the supervisor loop — it spawns a subprocess, reads all task files, and wastes context. Use MCP tools instead.

---

## Configuration

| Parameter           | Default     | Override Flag    | Description                                          |
|---------------------|-------------|------------------|------------------------------------------------------|
| Concurrency limit   | 3           | --concurrency N  | Maximum simultaneous workers                         |
| Monitoring interval | 5 minutes   | --interval Nm    | Time between health checks                           |
| Retry limit         | 2           | --retries N      | Maximum retry attempts for a failed task. Maximum allowed value: 5. Values above 5 are clamped to 5. |
| Task limit          | 0 (unlimited) | --limit N      | Stop gracefully after N tasks reach a terminal state (COMPLETE/FAILED/BLOCKED). 0 = process entire backlog. **Sequential mode**: cap the task queue to N tasks at startup (different semantic — see ## Sequential Mode). |
| Sequential mode     | false       | --sequential     | Process tasks inline in same session instead of spawning MCP workers. No concurrency, no health checks, no polling overhead. |
| Escalate to user    | false       | --escalate       | When true: supervisor checks for NEED_INPUT signals from workers at phase boundaries (after each TASK_STATE_CHANGE event). Requires cortex_available = true. When false (default): workers fail autonomously, supervisor retries or blocks. |
| MCP retry backoff   | 30 seconds  | (not overridable)| Wait time between MCP retry attempts                 |

> Stuck detection is server-side (120s inactivity). `escalate_to_user` requires cortex_available=true — auto-disabled otherwise. Merge overrides with defaults and write to `{SESSION_DIR}state.md` at startup.

> **2-session worker model**: Build Worker (CREATED → IMPLEMENTED) + Review+Fix Worker (IMPLEMENTED → COMPLETE). Each worker = 1 concurrency slot.

---

## Registry & Log

- **Registry** (`registry.md`) is a generated artifact — the Supervisor does NOT write to it. Workers write state to `task-tracking/TASK_YYYY_NNN/status` files only.
- **Session log** (`{SESSION_DIR}log.md`) is append-only. Load `references/log-templates.md` for format.
- **State** (`{SESSION_DIR}state.md`) holds structured worker/queue tables — fully overwritten on each update. Restore from here after compaction.

---

## Modes

The supervisor operates in these modes, selected via the `/auto-pilot` command:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **All-tasks** | `/auto-pilot` (no args) | Full loop: Steps 1-8, processes entire backlog until drained or all blocked |
| **Limited** | `/auto-pilot --limit N` | Same as all-tasks but stops gracefully after N tasks reach a terminal state. Useful for e2e testing and controlled batch runs. |
| **Single-task** | `/auto-pilot TASK_YYYY_NNN` | Spawn appropriate worker type based on current state. If CREATED or IN_PROGRESS, spawn Build Worker. If IMPLEMENTED, spawn Review Lead + Test Lead simultaneously (or Review Lead only if `Testing: skip`). If IN_REVIEW, spawn Review Lead (if reviews not done) and/or Test Lead (if test-report.md missing). Monitor until both leads complete. After both done, evaluate findings and spawn Fix Worker (→ FIXING) or Completion Worker (→ COMPLETE). If FIXING, spawn Fix Worker and monitor until COMPLETE. Stop after final state reached or failure. |
| **Dry-run** | `/auto-pilot --dry-run` | Display dependency graph and wave-based execution plan. No workers spawned. |
| **Pause** | `/auto-pilot --pause` | Run until current monitoring interval ends, then stop cleanly. Writes `Loop Status: PAUSED` to state.md and exits. Active workers continue running — they are NOT killed. Session can be resumed later with `--continue`. |
| **Continue** | `/auto-pilot --continue [SESSION_ID]` | Resume a previously paused or stopped session. Reads state.md from the specified session (or the most recent non-active session if SESSION_ID is omitted), reconciles with MCP, and enters the Core Loop. Skips pre-flight and session-directory creation — reuses existing SESSION_DIR. |
| **Evaluate** | `/auto-pilot --evaluate <model-id>` | Single-model evaluation mode. Loads benchmark tasks from `benchmark-suite/`, creates isolated worktree(s), spawns Evaluation Build Workers using the specified model, collects execution metrics (wall-clock time, success/failure, retry count), and stores results in `evaluations/<date>-<model>/`. Does NOT read the task registry or process real tasks. |
| **Evaluate A/B** | `/auto-pilot --evaluate <model-id> --compare <baseline-model>` | A/B comparison mode. Runs the same benchmark tasks for both models in separate worktrees, collects identical metrics, and stores results in `evaluations/<date>-<modelA>_vs_<modelB>/` with per-model subdirectories. |
| **Evaluate Role** | `/auto-pilot --evaluate <model-id> --role builder\|reviewer\|both` | Role testing mode. `builder` (default): model under test as Build Worker only — no review phase in A/B builder mode (see E5c). `reviewer`: baseline model builds, model under test reviews. `both`: two full passes — one as builder (E5c), one as reviewer (E5d). Requires `--compare` when `--role` is `reviewer` or `both`. |
| **Sequential** | `/auto-pilot --sequential` | Process tasks inline (same session). No MCP workers spawned. Reads registry once, builds dependency graph, picks highest-priority unblocked task, invokes orchestration skill inline via Agent tool. Re-reads only changed status files after each task. Supports `--limit N` and single-task (`--sequential TASK_X`). Retry on failure: re-invoke orchestration for same task up to retry limit. Session logging still works. |

Single-task, dry-run, sequential, and evaluation modes are handled by the command entry point (`.claude/commands/nitro-auto-pilot.md`). The Core Loop below describes the all-tasks mode.

### Load-on-Demand Protocol

**CRITICAL**: Load references ONLY at the moment they are needed, NOT during startup. The startup sequence (Steps 1-4) requires NO reference files — SKILL.md and the command file contain all startup logic. Loading references eagerly wastes context and causes compaction pressure.

**Rules**:
- Load exactly ONE reference per trigger event — never batch-load multiple references
- Never re-read a reference already loaded in this session
- If you catch yourself reading a reference "just in case", STOP — you are violating this protocol

**Trigger → Reference mapping**:
1. Detect mode from command arguments (see table above)
2. Load ONLY the matching reference — do NOT preload all references
3. **Entering Core Loop** (after all pre-flight passes): load `references/parallel-mode.md`
4. **`--sequential`** (entering sequential execution): load `references/sequential-mode.md`
5. **`--evaluate`** (entering evaluation): load `references/evaluation-mode.md`
6. **`--pause`**: load `references/pause-continue.md`
7. **`--continue`**: load `references/pause-continue.md`
8. **Spawning workers** (Step 5, first spawn only): load `references/worker-prompts.md`
9. **Need exact log format** (first log write only): load `references/log-templates.md`
10. **`cortex_available = true`** (first cortex call only): load `references/cortex-integration.md`
11. **Session startup, state format, or error handling**: load `references/session-lifecycle.md`



All mode-specific details are in the matching reference file — see Load-on-Demand Protocol above.

When `--evaluate <model-id>` is passed: runs benchmark tasks from `benchmark-suite/` in isolated worktrees. Does NOT process the task registry. Results stored in `evaluations/<date>-<model>/`. Supports `--compare`, `--role`, and A/B modes. Exits after Step E10 — does NOT enter the Core Loop.

---

## MCP Requirement (MANDATORY — HARD FAIL)

**BEFORE ANYTHING ELSE**, verify that the MCP `spawn_worker` tool exists and is callable:

1. Call MCP `list_workers` (with `status_filter: 'running'`, `compact: true`).
2. **IF the tool exists and returns a response** (even an empty list): MCP is available. Continue.
3. **IF the tool does NOT exist, times out, or returns an error**: **STOP IMMEDIATELY.**
   - Display: `"FATAL: nitro-cortex MCP is not configured or not running. The Supervisor REQUIRES the nitro-cortex MCP server to spawn and manage worker sessions. Without it, tasks cannot be processed. Configure nitro-cortex in .mcp.json (run: npx nitro-fueled init --cortex-path <path>) and restart."`
   - **Do NOT fall back to the Agent tool, sub-agents, or any other mechanism.**
   - **Do NOT attempt to process tasks inline.**
   - **EXIT.**

The Supervisor MUST use MCP `spawn_worker` to create separate terminal sessions with fresh context windows. Using the Agent tool (sub-agents) defeats the entire architecture — sub-agents share the parent's context, have no isolation, and break the Build Worker / Review Worker separation. This is not a suggestion — it is a hard requirement.

### nitro-cortex Availability Check

Detection runs at **Step 2**: call `get_tasks()`. Calling `get_tasks()` is the authoritative
detection method because it tests actual DB functionality, not just tool list presence.

**Default behavior** (allowFileFallback not set, or set to false):
If `get_tasks()` fails, **STOP IMMEDIATELY** and display:
`"FATAL: nitro-cortex DB unavailable. The Supervisor requires nitro-cortex to be operational. Set \"allowFileFallback\": true in .nitro-fueled/config.json to enable degraded file-based mode, then restart."`

**With `"allowFileFallback": true`** (opt-in degraded mode, set in `.nitro-fueled/config.json`):
If `get_tasks()` fails, set `cortex_available = false` and proceed with file-based fallback
paths documented in `references/parallel-mode.md`. This degrades task coordination
but allows the Supervisor to run without the cortex DB.

`cortex_available` is a session flag — it is NOT re-checked per loop iteration.

> **Bootstrap note**: On first run against a new project, call `sync_tasks_from_files()`
> once to import existing task-tracking files into the nitro-cortex DB before calling
> `get_tasks()`. This only needs to run once (safe to re-run — upsert). After the initial
> sync, all subsequent state changes go through the MCP tools and the DB stays current.
>
> **Startup reconciliation**: On every startup when `cortex_available = true`, also call
> `reconcile_status_files()` immediately after `sync_tasks_from_files()`. This fixes any
> status drift from the previous session (file wins). This is best-effort — if it fails
> or the tool is unavailable, log a warning and proceed. Do not abort startup.

---

## Session Lifecycle

> **Load reference**: Read `references/session-lifecycle.md` for session directory structure, startup sequence, active-sessions.md format, stale archive check, and concurrent session guard.

---

## Core Loop

> **Load reference**: Read `references/parallel-mode.md` for all 8 steps of the Core Loop.

The Core Loop runs in parallel mode (all-tasks, limited, single-task). Steps:
1. Read State (recovery check, compaction)
2. Read Registry (cortex or file-based)
3. Build Dependency Graph + plan check + file-scope overlap detection
4. Order Task Queue (review queue before build queue)
5. Spawn Workers (JIT quality gate, worker type selection, MCP spawn)
6. Monitor Workers (health checks, subscribe_worker events, stuck detection)
7. Handle Completions (state transitions, re-evaluate queue)
8. Stop / Loop (analytics, session archive, bookkeeping)

---

## Worker Prompt Templates

> **Load reference**: Read `references/worker-prompts.md` for all worker prompt templates (Build, Retry Build, Review Lead, Test Lead, Fix Worker, Cleanup Worker, Completion Worker, Evaluation Build Worker) and the Worker-to-Agent Mapping table.

---

## State & Log Formats, Error Handling

> **Load reference**: Read `references/session-lifecycle.md` for state.md format (with example tables), log.md format, and all error handling rules (worker failure, MCP unreachable, malformed data, dependency cycles).


## MCP Tool Quick Reference

| Tool | When | Context Cost |
|------|------|-------------|
| `spawn_worker(prompt, working_directory, label, model?, provider?)` | Step 5 | ~6 lines |
| `list_workers(status_filter?, compact: true)` | Step 1, recovery | ~1 line/worker |
| `get_worker_activity(worker_id)` | Step 6 (default) | ~5 lines |
| `get_worker_stats(worker_id)` | Step 6 (escalation only) | ~15 lines |
| `subscribe_worker(worker_id, conditions)` | Step 5f | ~3 lines |
| `get_pending_events()` | Step 6 | varies |
| `kill_worker(worker_id, reason?)` | Step 6/7 | ~4 lines |

Always use `compact: true` on `list_workers`. Default to `get_worker_activity` for monitoring — only escalate to `get_worker_stats` when health is unclear.

---


## Reference Index

| Reference | Load When | Content |
|-----------|-----------|---------|
| [references/parallel-mode.md](references/parallel-mode.md) | Default parallel/all-tasks/limited/single-task mode | Core Loop Steps 1-8, health checks, MCP spawning, analytics |
| [references/sequential-mode.md](references/sequential-mode.md) | `--sequential` flag | Inline orchestration flow, no MCP workers |
| [references/evaluation-mode.md](references/evaluation-mode.md) | `--evaluate` flag | Benchmark flow E1-E10, A/B mode, role testing |
| [references/pause-continue.md](references/pause-continue.md) | `--pause` or `--continue` | Pause/resume logic, session restoration |
| [references/log-templates.md](references/log-templates.md) | Need exact log row format | All ~60 event types with pipe-table format |
| [references/worker-prompts.md](references/worker-prompts.md) | Spawning workers (Step 5) | All worker prompt templates + Worker-to-Agent Mapping |
| [references/session-lifecycle.md](references/session-lifecycle.md) | Session startup, state format, errors | Session dir, active-sessions, stale archive, state.md/log.md format, error handling |
| [references/cortex-integration.md](references/cortex-integration.md) | cortex_available = true paths | Summary of cortex DB overrides; full inline in parallel-mode.md |

**Loading protocol**: Always loaded (this SKILL.md). Load on demand: references above. Never preload all references at once.

---

## Key Principles

1. **You are the Supervisor** -- spawn, monitor, loop
2. **Workers invoke /orchestrate** -- you never re-implement agent logic
3. **Per-task `status` files are the source of truth** for task state — registry.md is a generated artifact for metadata and enumeration only
4. **`{SESSION_DIR}state.md` and `{SESSION_DIR}log.md` are your private memory** across compactions
5. **Workers write their own `status` file** as their final action -- you monitor state transitions by reading `status` files, not causing them
6. **Prefer get_worker_activity over get_worker_stats** for context efficiency
7. **Never spawn duplicate workers** -- check both registry (IN_PROGRESS/IN_REVIEW) and state (active workers), and verify worker_type matches expected worker for current state
8. **A completed task triggers immediate re-evaluation** of the dependency graph
9. **Graceful degradation** -- one failure never crashes the loop
10. **Zero project assumptions** -- works in any Nitro-Fueled project
11. **Spawn the right worker type** -- Build Worker for CREATED/IN_PROGRESS, Review Worker for IMPLEMENTED/IN_REVIEW
12. **Review Workers take priority** -- finishing tasks is more valuable than starting new ones
