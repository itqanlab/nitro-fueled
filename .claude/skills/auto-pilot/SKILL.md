---
name: supervisor
description: >
  Supervisor loop for Nitro-Fueled orchestration.
  Use when: Running batch task execution, processing a task backlog,
  or spawning parallel workers for multiple tasks.
  Reads the task registry and task folders, builds a dependency graph,
  spawns Build Workers and Review Workers via MCP session-orchestrator,
  monitors health and state transitions, and loops.
  Invoked via /auto-pilot command.
---

# Supervisor Skill

Autonomous loop that processes the task backlog by spawning, monitoring, and managing **Build Workers** and **Review Workers** via MCP session-orchestrator.

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
3. **Spawn appropriate worker type** based on task state (Build Worker for CREATED/IN_PROGRESS, Review Worker for IMPLEMENTED/IN_REVIEW)
4. **Monitor worker health** on a configurable interval
5. **Handle completions**: check if state transitioned, decide next action
6. **Handle failures**: if state didn't transition, respawn same worker type (counts as retry)
7. **Persist state** to `{SESSION_DIR}state.md` for compaction survival
8. **Loop** until the backlog is drained, all remaining tasks are blocked, or `--limit` is reached

### What You Never Do

- **Write code or implement tasks** -- workers do that
- **Modify the orchestration skill** -- it is used as-is by workers
- **Re-implement agent sequencing** -- the orchestration skill handles PM, Architect, Dev, QA
- **Update the registry** -- workers update their own registry states
- **Verify code quality** -- reviewers do that in the Review Worker session
- **Handle task artifacts directly** -- workers handle all task artifacts (completion-report.md, review files, etc.)

---

## Configuration

| Parameter           | Default     | Override Flag    | Description                                          |
|---------------------|-------------|------------------|------------------------------------------------------|
| Concurrency limit   | 3           | --concurrency N  | Maximum simultaneous workers                         |
| Monitoring interval | 5 minutes   | --interval Nm    | Time between health checks                           |
| Retry limit         | 2           | --retries N      | Maximum retry attempts for a failed task. Maximum allowed value: 5. Values above 5 are clamped to 5. |
| Task limit          | 0 (unlimited) | --limit N      | Stop gracefully after N tasks reach a terminal state (COMPLETE/FAILED/BLOCKED). 0 = process entire backlog. **Sequential mode**: cap the task queue to N tasks at startup (different semantic — see ## Sequential Mode). |
| Sequential mode     | false       | --sequential     | Process tasks inline in same session instead of spawning MCP workers. No concurrency, no health checks, no polling overhead. |
| MCP retry backoff   | 30 seconds  | (not overridable)| Wait time between MCP retry attempts                 |

> **Note on stuck detection**: Stuck detection is server-side -- the MCP session-orchestrator determines the `stuck` health state based on worker inactivity (hardcoded at 120 seconds). The supervisor does not configure this threshold; it reacts to the `stuck` health state via two-strike detection.

When the loop starts, merge command-line overrides with these defaults. Write the active configuration into `{SESSION_DIR}state.md`. Written as part of Session Lifecycle startup (after Session Directory is created).

> **Concurrency and Review+Test phase**: Spawning a Review Lead + Test Lead for one task consumes 2 concurrency slots (one per worker). A task in the review/test phase uses 2 of the available slots. Example: `concurrency_limit=3`, one task reaches IMPLEMENTED → spawn both workers (2 slots used) → 1 slot remains for a Build Worker.
>
> If `concurrency_limit == 1`: spawn Review Lead first (higher priority — it owns state
> transitions). Note: with concurrency_limit == 1, the Test Lead will likely never execute —
> once Review Lead sets the registry to COMPLETE, the Supervisor closes the task before
> a slot opens for the Test Lead. Users with concurrency_limit == 1 should accept that
> test coverage may be skipped for tasks that complete in a single review cycle.

---

## Registry Write Safety

Workers write their state update to `task-tracking/TASK_YYYY_NNN/status` as their LAST action before exiting. Each worker writes only to its own task folder — no cross-task conflicts, no re-read-before-write needed. The race condition described here no longer applies.

The registry (`task-tracking/registry.md`) is a generated artifact regenerated by `nitro-fueled status` or `/project-status`. Workers and the Supervisor do NOT write to registry.md for state updates. The Supervisor reads registry.md for task metadata (IDs, Type, Description) and reads per-task `status` files for current state.

---

## Session Log

The supervisor MUST append every significant event to `{SESSION_DIR}log.md` using the pipe-table format (see `references/log-templates.md`).

> **Load full template list**: Read `references/log-templates.md` for all event types and their exact log row formats.

The log lives at `{SESSION_DIR}log.md` and is **append-only** — never trim or overwrite it. The `state.md` file holds structured worker/queue tables (fully overwritten on each update). After compaction, restore context from `state.md`; the full event history lives in `log.md`.

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

1. Detect mode from command arguments (see table above)
2. Load ONLY the matching reference — do NOT preload all references
3. **Parallel/All-tasks/Limited/Single-task mode** (default): load `references/parallel-mode.md`
4. **`--sequential`**: load `references/sequential-mode.md`
5. **`--evaluate`**: load `references/evaluation-mode.md`
6. **`--pause`**: load `references/pause-continue.md`
7. **`--continue`**: load `references/pause-continue.md`
8. **Spawning workers** (Step 5): load `references/worker-prompts.md`
9. **Need exact log format**: load `references/log-templates.md`
10. **`cortex_available = true`**: load `references/cortex-integration.md` for DB-specific path summary (full inline details in `references/parallel-mode.md`)

---

## Pause Mode

> **Load reference**: Read `references/pause-continue.md` for the full Pause Mode flow.

When `--pause` is passed: sets `pause_requested = true`. At the END of each monitoring cycle, if true: write `Loop Status: PAUSED` to state.md, remove from active-sessions, display pause summary, and exit without running Step 8.

---

## Continue Mode

> **Load reference**: Read `references/pause-continue.md` for the full Continue Mode flow.

When `--continue [SESSION_ID]` is passed: locate the paused session's state.md, restore all state, re-register in active-sessions, and enter the Core Loop. Skips pre-flight and session-directory creation — reuses existing SESSION_DIR.

---

## Sequential Mode

> **Load reference**: Read `references/sequential-mode.md` for the full sequential mode flow.

When `--sequential` is passed: process tasks inline in the same session — no MCP workers spawned. Reads registry once, builds dependency graph, invokes orchestration skill via Agent tool for each task. Supports `--limit N` and single-task mode.

---

## Evaluation Mode

> **Load reference**: Read `references/evaluation-mode.md` for the full evaluation flow (Steps E1-E10).

When `--evaluate <model-id>` is passed: runs benchmark tasks from `benchmark-suite/` in isolated worktrees. Does NOT process the task registry. Results stored in `evaluations/<date>-<model>/`. Supports `--compare`, `--role`, and A/B modes. Exits after Step E10 — does NOT enter the Core Loop.

---

## MCP Requirement (MANDATORY — HARD FAIL)

**BEFORE ANYTHING ELSE**, verify that the MCP `spawn_worker` tool exists and is callable:

1. Call MCP `list_workers` (with no filters).
2. **IF the tool exists and returns a response** (even an empty list): MCP is available. Continue.
3. **IF the tool does NOT exist, times out, or returns an error**: **STOP IMMEDIATELY.**
   - Display: `"FATAL: MCP session-orchestrator is not configured or not running. The Supervisor REQUIRES the MCP session-orchestrator to spawn separate worker sessions. Without it, tasks cannot be processed. Please configure the MCP server in .claude/settings.json and restart."`
   - **Do NOT fall back to the Agent tool, sub-agents, or any other mechanism.**
   - **Do NOT attempt to process tasks inline.**
   - **EXIT.**

The Supervisor MUST use MCP `spawn_worker` to create separate terminal sessions with fresh context windows. Using the Agent tool (sub-agents) defeats the entire architecture — sub-agents share the parent's context, have no isolation, and break the Build Worker / Review Worker separation. This is not a suggestion — it is a hard requirement.

### nitro-cortex Availability Check (optional — soft check)

Detection runs at **Step 2** — see Step 2 for the `get_tasks()` soft-check and
`cortex_available` flag logic. Calling `get_tasks()` is the authoritative detection
method because it tests actual functionality, not just tool list presence.

This is a **soft check** — the supervisor proceeds either way. `cortex_available` is a
session flag that controls which code path is used in Steps 2-7. It is NOT re-checked
per loop iteration.

> **Bootstrap note**: On first run against a new project, call `sync_tasks_from_files()`
> once to import existing task-tracking files into the nitro-cortex DB before calling
> `get_tasks()`. This only needs to run once (safe to re-run — upsert). After the initial
> sync, all subsequent state changes go through the MCP tools and the DB stays current.

---

## Session Directory

On startup (after MCP validation passes and Concurrent Session Guard passes), the supervisor creates a session-scoped directory for all state and log output.

**Directory path**: `task-tracking/sessions/SESSION_{YYYY-MM-DD}_{HH-MM-SS}/`

Timestamp is the wall-clock start time (local time, zero-padded, including seconds). Example:
`task-tracking/sessions/SESSION_2026-03-24_22-00-00/`

All datetime fields written inside session files must use local time with timezone offset: `YYYY-MM-DD HH:MM:SS +ZZZZ` (e.g., `2026-03-24 10:00:00 +0200`). To generate: `date '+%Y-%m-%d %H:%M:%S %z'`

### Startup Sequence

The supervisor startup follows this exact order:

0. **Stale Session Archive Check** (see ## Stale Session Archive Check) — commit artifacts from ended sessions
1. **MCP validation** (see ## MCP Requirement) — HARD FAIL if MCP unavailable
2. **Concurrent Session Guard** (see ## Concurrent Session Guard) — warns/aborts if another supervisor is running
3. **Session Directory creation** — create dir, create log.md, register in active-sessions.md
4. **Log stale archive results** — after Session Directory is created, append stale archive check log entries
5. **Step 1: Read State** — check for existing state.md in session dir (compaction recovery)
6. **Enter Core Loop**

### Files inside the session directory

| File | Written by | Purpose |
|------|-----------|---------|
| `state.md` | auto-pilot | Live supervisor state (workers, queues, config). Full overwrite on every update. |
| `log.md` | auto-pilot + orchestration skill | Unified event log. Append-only. All orchestration paths write here. |
| `analytics.md` | auto-pilot | Post-session analytics generated at supervisor stop (Step 8c). |
| `worker-logs/` | auto-pilot | Per-worker log files written at each worker completion (Step 7h). |

### Session Lifecycle

**On startup**:

0. (Run after MCP validation and Concurrent Session Guard — see those sections for prerequisites.)
1. Compute `SESSION_ID = SESSION_{YYYY-MM-DD}_{HH-MM-SS}` using current timestamp.
   When writing datetime values to state.md or worker logs, use local time with timezone offset (`YYYY-MM-DD HH:MM:SS +ZZZZ`). To generate: `date '+%Y-%m-%d %H:%M:%S %z'`
2. Create directory `task-tracking/sessions/{SESSION_ID}/` (mkdir, no-op if exists).
3. Create `task-tracking/sessions/{SESSION_ID}/log.md` with header if it does not already exist:
   ```markdown
   # Session Log — {SESSION_ID}

   | Timestamp | Source | Event |
   |-----------|--------|-------|
   ```
4. Append first log entry to `log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STARTED — {N} tasks, {N} unblocked, concurrency {N} |`
5. Register in `task-tracking/active-sessions.md` (append row — see ## Active Sessions File section below).
6. Store `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/` as the working path for all
   subsequent state and log writes.

**On stop** (normal completion, compaction limit, MCP unreachable, manual):

1. Write final `{SESSION_DIR}state.md` with `Loop Status: STOPPED`.
2. Append final log entry to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STOPPED — {completed} completed, {failed} failed, {blocked} blocked |`
3. Remove this session's row from `task-tracking/active-sessions.md`.
4. Proceed to Step 8b (append to `orchestrator-history.md`), then Step 8c (generate analytics.md), then Step 8d (commit all session artifacts).

---

## Active Sessions File

`task-tracking/active-sessions.md` is a live registry of currently running sessions.
Every session (auto-pilot or orchestrate) appends a row on startup and removes it on stop.

### Format

```markdown
# Active Sessions

| Session | Source | Started | Tasks | Path |
|---------|--------|---------|-------|------|
| SESSION_2026-03-24_22-00-00 | auto-pilot | 22:00 | 14 | task-tracking/sessions/SESSION_2026-03-24_22-00-00/ |
| SESSION_2026-03-24_22-05-00 | orchestrate | 22:05 | 1 | task-tracking/sessions/SESSION_2026-03-24_22-05-00/ |
```

### Write Rules

- **On session start** (after Concurrent Session Guard passes): read the file, append one row, write back. If the file does not exist, create it with the header and first row.
- **On session stop** (normal, compaction limit, MCP unreachable, manual): read the file, remove the row whose `Session` matches this session's `SESSION_ID`, write back.
- **On crash/kill**: the row is left as stale. Stale rows from source `orchestrate` (Build/Review Workers) are expected and acceptable — workers can be killed at any time. The Concurrent Session Guard filters by source `auto-pilot` only, so stale `orchestrate` rows do not cause false positives.
- If writing fails (permissions), log a warning and continue — the file is advisory.

### Row Format

Auto-pilot row:
`| {SESSION_ID} | auto-pilot | {HH:MM} | {N tasks at startup} | task-tracking/sessions/{SESSION_ID}/ |`

Orchestration skill row:
`| {SESSION_ID} | orchestrate | {HH:MM} | 1 | task-tracking/sessions/{SESSION_ID}/ |`

> The `Started` column uses `HH:MM` (display-only; the authoritative timestamp is the SESSION_ID itself). Full datetime with timezone offset is not required here.

The `Tasks` column is static (set at startup, not updated as tasks complete). It represents the initial task count for the session, not live progress.

---

## Stale Session Archive Check

Runs at supervisor startup **before MCP validation** (Step 0 of Startup Sequence). Detects and commits session artifacts from ended sessions that were not committed due to a crash or kill.

### Algorithm

1. Run: `git status --short task-tracking/sessions/ task-tracking/orchestrator-history.md`
2. Parse output lines:
   - Lines starting with `?? task-tracking/sessions/{SESSION_ID}/` (untracked directory): record SESSION_ID from the path.
   - Lines starting with `M `, ` M`, or `??` for a specific file path: record the file and its parent SESSION_ID (if under sessions/).
   - Lines for `task-tracking/orchestrator-history.md`: record for separate handling in step 7.
3. Filter: skip any line whose path includes `state.md` or `active-sessions.md` — these are runtime files and must never be committed. Validate extracted SESSION_IDs against pattern `SESSION_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}` — discard any that do not match.
4. Read `task-tracking/active-sessions.md` (if missing, treat as empty — all sessions are ended).
5. For each uncommitted file under `task-tracking/sessions/{SESSION_ID}/`:
   - Check active-sessions.md for the session row.
   - If the row has **Source `auto-pilot`**: additionally verify the session is still reachable via MCP `list_workers` (call `list_workers(status_filter: 'all')` and check if any worker belongs to this session). If MCP confirms workers exist for this session → skip (live session). If MCP shows no workers but the row exists → it is a crashed supervisor; treat as ended (commit its artifacts).
   - If the row has **Source `orchestrate`** (Build/Review Worker): these rows are always stale (workers can be killed at any time per the design). Commit their artifacts.
   - If the session has **no row** in active-sessions.md → treat as ended. Commit its artifacts.
   > **Fallback when MCP is unavailable**: If `list_workers` fails, do NOT commit `auto-pilot` source sessions (too risky). Log: `STALE ARCHIVE WARNING — MCP unavailable, skipping live-session verification for {SESSION_ID}`. Still commit `orchestrate`-source sessions (always safe).
6. **For each ended session with uncommitted artifacts**:
   ```
   git add task-tracking/sessions/{SESSION_ID}/log.md
   git add task-tracking/sessions/{SESSION_ID}/analytics.md
   git add "task-tracking/sessions/{SESSION_ID}/worker-logs/" (only if directory exists)
   git commit -m "chore(session): archive {SESSION_ID} — recovered from previous session"
   ```
   Print: `STALE ARCHIVE — archived {SESSION_ID}`
7. **If `orchestrator-history.md` has uncommitted changes** and no active session is currently writing it:
   ```
   git add task-tracking/orchestrator-history.md
   git commit -m "chore(session): commit stale orchestrator-history.md"
   ```
   Print: `STALE ARCHIVE — committed stale orchestrator-history.md`
8. If no stale artifacts found: Print `STALE ARCHIVE — no stale session artifacts found`
9. All git operations here are **best-effort**: if a commit fails (nothing to commit, lock, permissions), print a warning and continue. A failure here must NEVER prevent the supervisor from starting.

### Session Log Entries

After the Session Directory is created (Step 3 of Startup Sequence), append one log entry per action taken during the stale archive check:

| Event | Log Row |
|-------|---------|
| Archived stale session | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE — archived {SESSION_ID} \|` |
| Committed stale history | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE — committed stale orchestrator-history.md \|` |
| No stale artifacts | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE — no stale session artifacts found \|` |
| Git error (non-fatal) | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE WARNING — git error: {reason[:200]} \|` |

---

## Concurrent Session Guard

On startup, **after MCP validation passes, before Session Directory creation, before entering the loop**:

1. Read `task-tracking/active-sessions.md` (if it exists).
2. If any row with Source `auto-pilot` is present:
   - Log: `"INFO: Another supervisor session is running: {SESSION_ID} — concurrent mode enabled (cross-session task exclusion active)"`
   - Continue without prompting. Concurrent sessions are safe: Step 3d reads each other's `state.md` on every loop cycle and excludes their claimed tasks from the spawn queue, preventing double-spawning.
   - **Only abort** if `--no-concurrent` flag is passed. In that case, display: `"ABORT: Another supervisor is running ({SESSION_ID}). Pass --force to override or wait for it to finish."` and exit.
3. Proceed to Session Directory startup (create dir, register in active-sessions.md).

> **Concurrency is safe by design**: Each session operates on its own `SESSION_DIR`, writes to separate worker IDs, and Step 3d provides cross-session task exclusion. Multiple supervisors can process different tasks in parallel without conflict.

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

## state.md Format

Written to `{SESSION_DIR}state.md` (e.g., `task-tracking/sessions/SESSION_2026-03-24_22-00-00/state.md`). Must be parseable after compaction -- uses clear section headers and markdown tables.

```markdown
# Orchestrator State

**Loop Status**: RUNNING | STOPPED
**Last Updated**: YYYY-MM-DD HH:MM:SS +ZZZZ
**Session Started**: YYYY-MM-DD HH:MM:SS +ZZZZ
**Session Directory**: task-tracking/sessions/SESSION_2026-03-24_22-00-00/

## Configuration

| Parameter           | Value      |
|---------------------|------------|
| Concurrency Limit   | 3          |
| Monitoring Interval | 5 minutes  |
| Retry Limit         | 2          |
| MCP Empty Threshold | 2          |

## Active Workers

| Worker ID | Task ID       | Worker Type | Label                        | Status  | Spawn Time          | Last Health | Stuck Count | Compaction Count | Expected End State |
|-----------|---------------|-------------|------------------------------|---------|---------------------|-------------|-------------|------------------|-------------------|
| abc-123   | TASK_2026_003 | Build            | TASK_2026_003-FEATURE-BUILD    | running | 2026-03-24 10:00:00 +0200 | healthy     | 0           | 0                | IMPLEMENTED        |
| def-456   | TASK_2026_004 | ReviewLead       | TASK_2026_004-BUGFIX-REVIEW    | running | 2026-03-24 10:05:00 +0200 | healthy     | 0           | 0                | REVIEW_DONE        |
| ghi-789   | TASK_2026_004 | TestLead         | TASK_2026_004-BUGFIX-TEST      | running | 2026-03-24 10:05:00 +0200 | healthy     | 0           | 0                | TEST_DONE          |
| jkl-012   | TASK_2026_005 | FixWorker        | TASK_2026_005-FEATURE-FIX      | running | 2026-03-24 10:10:00 +0200 | healthy     | 0           | 0                | COMPLETE           |
| mno-345   | TASK_2026_006 | CompletionWorker | TASK_2026_006-FEATURE-COMPLETE | running | 2026-03-24 10:10:00 +0200 | healthy     | 0           | 0                | COMPLETE           |


## Serialized Reviews

| Task ID | Reason |
|---------|---------|
| TASK_2026_001 | Overlaps with TASK_2026_002 on index.html |
| TASK_2026_002 | Overlaps with TASK_2026_001 on index.html |

## Completed Tasks

| Task ID       | Completed At         |
|---------------|----------------------|
| TASK_2026_001 | 2026-03-24 10:45:00 +0200  |

## Failed Tasks

| Task ID       | Reason                    | Retry Count |
|---------------|---------------------------|-------------|
| TASK_2026_005 | No state transition (x2)  | 2           |

## Task Queue (Next Actionable)

| Task ID       | Priority    | Type    | Worker Type |
|---------------|-------------|---------|-------------|
| TASK_2026_007 | P1-High     | FEATURE | Review      |
| TASK_2026_004 | P1-High     | FEATURE | Build       |
| TASK_2026_006 | P2-Medium   | BUGFIX  | Build       |

## Retry Tracker

| Task ID       | Retry Count |
|---------------|-------------|
| TASK_2026_005 | 2           |

## Runtime Counters

| Counter          | Value |
|------------------|-------|
| MCP Empty Count  | 0     |
```

### log.md Format

Written to `{SESSION_DIR}log.md`. Append-only — never overwrite. Created on session startup with the header row, then one row appended per event.

```markdown
# Session Log — SESSION_2026-03-24_22-00-00

| Timestamp | Source | Event |
|-----------|--------|-------|
| 10:00:00 | auto-pilot | SUPERVISOR STARTED — 6 tasks, 3 unblocked, concurrency 3 |
| 10:00:05 | auto-pilot | SPAWNED abc-123 for TASK_2026_003 (Build: FEATURE) |
| 10:05:00 | orchestrate | PM phase complete for TASK_2026_010 |
| 10:10:00 | auto-pilot | HEALTH CHECK — TASK_2026_003: healthy |
| 10:15:00 | orchestrate | Architect phase complete for TASK_2026_010 |
| 10:20:00 | auto-pilot | STATE TRANSITIONED — TASK_2026_003: IN_PROGRESS -> IMPLEMENTED |
```

**Key design properties**:

- **Atomic overwrite**: Full file overwrite on every update -- no appending. Prevents partial state corruption.
- **Standard markdown**: All tables use standard markdown syntax, parseable by any agent after compaction.
- **Retry persistence**: Retry Tracker persists across loop iterations and compactions -- not just for active workers.
- **Task Queue is informational**: Recalculated each loop iteration, but useful for context recovery after compaction.
- **Split state/log**: `state.md` is fully overwritten on each update (structured tables). `log.md` is append-only (human-readable event stream). Keep them separate.

---

## MCP Tool Usage Reference

| Tool                  | Used In       | Purpose                                               |
|-----------------------|---------------|-------------------------------------------------------|
| `spawn_worker`        | Step 5        | Launch a new worker session for a task                |
| `subscribe_worker`    | Step 5f-ii    | Register file-system completion conditions (event-driven) |
| `get_pending_events`  | Step 6        | Drain completion events queue (30s poll, event-driven) |
| `list_workers`        | Step 1        | Reconcile state after compaction/recovery              |
| `get_worker_activity` | Step 6        | Routine monitoring (compact, context-efficient)        |
| `get_worker_stats`    | Step 6        | Detailed check when stuck/finished suspected           |
| `kill_worker`         | Step 6, 7     | Terminate stuck or post-completion workers             |

### MCP Tool Signatures

```
spawn_worker(prompt: string, working_directory: string, label: string, model?: string, provider?: string, allowed_tools?: string[])
  // provider: omit if `claude` — that is the MCP default; listing it explicitly is also accepted
  -> { worker_id: string, pid: number, session_id: string, iterm_tab: string }

subscribe_worker(worker_id: string, conditions: WatchCondition[])
  -> { subscribed: boolean, watched_paths: string[] }
  // working_directory is taken from the worker's registry entry — not a parameter

emit_event(worker_id: string, label: string, data?: Record<string, unknown>)
  -> { ok: boolean, worker_id: string, label: string }
  // Called by workers (orchestration skill) to push phase-transition events to the supervisor queue.
  // The supervisor never calls emit_event — only workers do.

get_pending_events()
  -> { events: Array<WatchEvent | EmittedEvent> }
  // WatchEvent shape:    { worker_id, event_label, triggered_at, condition }
  // EmittedEvent shape:  { worker_id, event_label, emitted_at, data?, source: 'emit_event' }
  // Returns merged events from both file-watcher (subscribe_worker) and emit_event sources.
  // Distinguish by checking source field: present and 'emit_event' for emitted events, absent for watch events.

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
- **NEVER** call `get_worker_stats` on every worker every interval -- this wastes supervisor context.

---

## Error Handling

### Worker Failure

A single worker failure **NEVER** stops the loop. Log the failure, update the task status (leave at current state for retry, or BLOCKED if retries exhausted), and continue with remaining tasks.

### MCP Unreachable

If an MCP call fails, apply scoped retry logic:

**Per-worker MCP failure** (e.g., `get_worker_activity` or `get_worker_stats` for a specific worker):
1. Retry up to **3 times** with **30-second backoff**.
2. If still failing: log warning, skip that worker for this monitoring pass, continue with remaining workers.
3. The worker will be checked again on the next monitoring interval.

**Global MCP failure** (e.g., `list_workers` during reconciliation, or ALL worker checks fail in the same pass):
1. Retry up to **3 times** with **30-second backoff**.
2. If still failing:
   - Write current state to `{SESSION_DIR}state.md`.
   - Log: `"MCP session-orchestrator unreachable after 3 retries. Supervisor paused. State saved. Resolve MCP connection and re-run /auto-pilot to resume."`
   - **STOP** the loop (graceful pause -- do not crash).

### Malformed Task Data

If `task.md` is missing, unparseable, or has invalid fields:

- Skip that task.
- Log a warning with the task ID and reason.
- Continue with other tasks.

### Unexpected Error

On any unexpected error:

1. Write current state to `{SESSION_DIR}state.md` **FIRST** (state preservation is top priority).
2. Then surface the error with context.
3. State is preserved for recovery on next `/auto-pilot` invocation.

### Dependency Cycle

- Write `BLOCKED` to `task-tracking/TASK_YYYY_NNN/status` for all tasks in the cycle.
- Log the cycle chain (e.g., `"Dependency cycle: TASK_A -> TASK_B -> TASK_A"`).
- Continue processing non-cyclic tasks.

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
