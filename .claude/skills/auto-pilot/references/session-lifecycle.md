# Session Lifecycle — auto-pilot

## Session Directory

On startup (after MCP validation passes and Concurrent Session Guard passes), the supervisor creates a session-scoped directory for all state and log output.

**Directory path**: `task-tracking/sessions/SESSION_{YYYY-MM-DD}_{HH-MM-SS}/`

Timestamp is the wall-clock start time (local time, zero-padded, including seconds). Example:
`task-tracking/sessions/SESSION_2026-03-24_22-00-00/`

All datetime fields written inside session files must use local time with timezone offset: `YYYY-MM-DD HH:MM:SS +ZZZZ` (e.g., `2026-03-24 10:00:00 +0200`). To generate: `date '+%Y-%m-%d %H:%M:%S %z'`

### Startup Sequence

The supervisor startup follows this exact order:

0. **Stale Session Archive Check** (see below) — commit artifacts from ended sessions
1. **MCP validation** (see ## MCP Requirement in SKILL.md) — HARD FAIL if MCP unavailable
2. **Concurrent Session Guard** (see below) — warns/aborts if another supervisor is running
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

> **When `cortex_available = true`**: After reading state and before entering the Core Loop, call:
> 1. `sync_tasks_from_files()` — full task metadata import (bootstrap; safe to re-run)
> 2. `reconcile_status_files()` — status-only drift fix (runs every startup; file wins)
>
> Both calls are best-effort. On failure: log a warning and continue. Do not abort.

**On stop** (normal completion, compaction limit, MCP unreachable, manual):

1. Write final `{SESSION_DIR}state.md` with `Loop Status: STOPPED`.
2. Append final log entry to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STOPPED — {completed} completed, {failed} failed, {blocked} blocked |`
3. Remove this session's row from `task-tracking/active-sessions.md`.
4. **Render log.md from events (when cortex available)**: When `cortex_available = true`, at session end, call `query_events(session_id=SESSION_ID)` and render the results as a pipe-table to `{SESSION_DIR}log.md` (overwriting the incremental appends). This ensures log.md is a complete, queryable-derived artifact. If `query_events` fails, keep the incrementally-written log.md as-is. This is best-effort.
5. Proceed to Step 8b (append to `orchestrator-history.md`), then Step 8c (generate analytics.md), then Step 8d (commit all session artifacts).

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

> The `Started` column uses `HH:MM` (display-only; the authoritative timestamp is the SESSION_ID itself).

The `Tasks` column is static (set at startup, not updated as tasks complete).

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
   - If the row has **Source `auto-pilot`**: additionally verify the session is still reachable via MCP `list_workers` (call `list_workers(status_filter: 'all', compact: true)` and check if any worker belongs to this session). If MCP confirms workers exist for this session → skip (live session). If MCP shows no workers but the row exists → it is a crashed supervisor; treat as ended (commit its artifacts).
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

## Serialized Reviews

| Task ID | Reason |
|---------|---------|
| TASK_2026_001 | Overlaps with TASK_2026_002 on index.html |

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
```

**Key design properties**:

- **Atomic overwrite**: Full file overwrite on every update -- no appending. Prevents partial state corruption.
- **Standard markdown**: All tables use standard markdown syntax, parseable by any agent after compaction.
- **Retry persistence**: Retry Tracker persists across loop iterations and compactions -- not just for active workers.
- **Split state/log**: `state.md` is fully overwritten on each update (structured tables). `log.md` is append-only (human-readable event stream). Keep them separate.

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
   - Log: `"MCP nitro-cortex unreachable after 3 retries. Supervisor paused. State saved. Resolve MCP connection and re-run /auto-pilot to resume."`
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
