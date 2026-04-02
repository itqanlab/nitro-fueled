# Session Lifecycle — auto-pilot

## Session Directory

On startup, after MCP validation, Concurrent Session Guard, and the stale archive check complete, the supervisor creates a session-scoped directory for optional state and log output.

**Directory path**: `task-tracking/sessions/{SESSION_ID}/`

`SESSION_ID` is the canonical nitro-cortex DB session ID returned by `create_session()`. Example:
`task-tracking/sessions/SESSION_2026-03-24T22-00-00/`

All datetime fields written inside session files must use local time with timezone offset: `YYYY-MM-DD HH:MM:SS +ZZZZ` (e.g., `2026-03-24 10:00:00 +0200`). To generate: `date '+%Y-%m-%d %H:%M:%S %z'`

### Startup Sequence

The supervisor startup follows this exact order:

1. **MCP validation** (see ## MCP Requirement in SKILL.md) — HARD FAIL if MCP unavailable
2. **Concurrent Session Guard** (see below) — warns/aborts if another supervisor is running
3. **Stale Session Archive Check** (see below) — stage artifacts from ended sessions, never auto-commit
3a. **Flush zombie sessions** — call `close_stale_sessions({ ttl_minutes: 5 })` before creating the new session. This marks any previously crashed supervisor sessions (no heartbeat for 5+ minutes) as `stopped` so the dashboard does not show ghost "running" sessions. Best-effort: if the call fails or the tool is unavailable, log a warning and continue.
4. **Create session in nitro-cortex DB** — call `create_session(source='auto-pilot', task_count=N, config=JSON)` and treat the returned `session_id` as canonical for the rest of the run
5. **Session Directory creation** — create `task-tracking/sessions/{session_id}/`, create log.md, register in active-sessions.md
6. **Log stale archive results** — after Session Directory is created, append stale archive check log entries
7. **Enter Core Loop**

Every per-session artifact and MCP call must reuse that exact DB `session_id`. Do not create a separate timestamp-based fallback ID and do not rename session directories after startup.

### Files inside the session directory

| File | Written by | Purpose |
|------|-----------|---------|
| `state.md` | auto-pilot | Optional debug snapshot. Written at startup and optionally at pause/stop, not on every loop tick. |
| `log.md` | auto-pilot + orchestration skill | Optional rendered event log. On the DB-backed path, loop events are emitted through MCP and materialized later. |
| `analytics.md` | auto-pilot | Post-session analytics generated at supervisor stop (Step 8c). |
| `worker-logs/` | auto-pilot | Per-worker log files written at each worker completion (Step 7h). |

### Session Lifecycle

**On startup**:

0. (Run after Startup Sequence steps 1-3 complete — see those sections for prerequisites.)
1. **Capture timestamp ONCE**: Run `date '+%Y-%m-%d %H:%M:%S %z'` in a single Bash call. Store the result as `SESSION_DATETIME` and derive `SESSION_TIME = {HH:MM:SS}` from it for log timestamps. Reuse these variables for ALL subsequent writes — do NOT call `date` again.
2. **Create session in the DB before writing files**: Call `create_session(source='auto-pilot', task_count=N, config=JSON.stringify({...startup_config, session_started_at: SESSION_DATETIME}))`.
3. **Use the returned ID everywhere**: Store the returned `session_id` as `SESSION_ID`. Do not generate a local timestamp-based fallback ID when `create_session()` succeeds.
4. Create directory `task-tracking/sessions/{SESSION_ID}/` (mkdir, no-op if exists).
5. Create `task-tracking/sessions/{SESSION_ID}/log.md` with header if it does not already exist:
   ```markdown
   # Session Log — {SESSION_ID}

   | Timestamp | Source | Event |
   |-----------|--------|-------|
   ```
6. Append first log entry to `log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STARTED — {N} tasks, {N} unblocked, concurrency {N} |`
7. Register in `task-tracking/active-sessions.md` (append row — see ## Active Sessions File section below).
8. Store `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/` as the working path for all
   subsequent state and log writes.

The `active-sessions.md` row, session directory name, and any later `list_workers(session_id=...)` calls must all use the same `SESSION_ID` value returned by `create_session()`.

> After Session Directory creation and before entering the Core Loop, call:
> 1. `release_orphaned_claims()` — auto-release tasks claimed by dead/missing sessions or expired TTL
>
> This call is best-effort. On failure: log a warning and continue. Do not abort.
>
> Steady-state loop persistence lives in the DB via `update_session()`. `state.md` is not rewritten during monitoring.

**On stop** (normal completion, compaction limit, MCP unreachable, manual):

1. Optionally write final `{SESSION_DIR}state.md` with `Loop Status: STOPPED`.
2. Append final log entry to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STOPPED — {completed} completed, {failed} failed, {blocked} blocked |`
3. Remove this session's row from `task-tracking/active-sessions.md`.
4. **Render log.md from events (when cortex available)**: When `cortex_available = true`, at session end, call `query_events(session_id=SESSION_ID)` and render the results as a pipe-table to `{SESSION_DIR}log.md`. This ensures log.md is a complete DB-derived artifact. If `query_events` fails, keep any existing file as-is or skip writing it. This is best-effort.
5. Proceed to Step 8b (append to `orchestrator-history.md`), then Step 8c (generate analytics.md), then Step 8d (optional staging/cleanup bookkeeping only — never auto-commit).

---

## Active Sessions File

`task-tracking/active-sessions.md` is a live registry of currently running sessions.
Every session (auto-pilot or orchestrate) appends a row on startup and removes it on stop.

### Format

```markdown
# Active Sessions

| Session | Source | Started | Tasks | Path |
|---------|--------|---------|-------|------|
| SESSION_2026-03-24T22-00-00 | auto-pilot | 22:00 | 14 | task-tracking/sessions/SESSION_2026-03-24T22-00-00/ |
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

Runs at supervisor startup **after MCP validation and Concurrent Session Guard, before Session Directory creation** (Step 3 of Startup Sequence). Detects and stages session artifacts from ended sessions that were not committed due to a crash or kill.

### Algorithm

1. Run: `git status --short task-tracking/sessions/ task-tracking/orchestrator-history.md`
2. Parse output lines:
   - Lines starting with `?? task-tracking/sessions/{SESSION_ID}/` (untracked directory): record SESSION_ID from the path.
   - Lines starting with `M `, ` M`, or `??` for a specific file path: record the file and its parent SESSION_ID (if under sessions/).
   - Lines for `task-tracking/orchestrator-history.md`: record for separate handling in step 7.
3. Filter: skip any line whose path includes `state.md` or `active-sessions.md` — these are runtime files and must never be committed. Validate extracted SESSION_IDs against pattern `SESSION_[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}` for auto-pilot sessions and `SESSION_[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}` for orchestration worker sessions — discard any that do not match either form.
4. Read `task-tracking/active-sessions.md` (if missing, treat as empty — all sessions are ended).
5. For each uncommitted file under `task-tracking/sessions/{SESSION_ID}/`:
   - Check active-sessions.md for the session row.
   - If the row has **Source `auto-pilot`**: additionally verify the session is still reachable via MCP `list_workers` (call `list_workers(status_filter: 'running', compact: true)` and check if any worker belongs to this session). If MCP confirms running workers exist for this session → skip (live session). If MCP shows no running workers but the row exists → it is a crashed supervisor; treat as ended (stage its artifacts).
    - If the row has **Source `orchestrate`** (Build/Review Worker): these rows are always stale (workers can be killed at any time per the design). Stage their artifacts.
   - If the session has **no row** in active-sessions.md → treat as ended. Stage its artifacts.
   > **Fallback when MCP is unavailable**: If `list_workers` fails, do NOT stage `auto-pilot` source sessions (too risky). Log: `STALE ARCHIVE WARNING — MCP unavailable, skipping live-session verification for {SESSION_ID}`. Still stage `orchestrate`-source sessions (always safe).
5b. **Clean stale rows from active-sessions.md**: For each session determined to be ended (step 5), remove its row from `task-tracking/active-sessions.md`. Read the file, remove matching rows, write back. This ensures crashed sessions do not leave ghost entries that confuse the Concurrent Session Guard.
6. **For each ended session with uncommitted artifacts** — **stage only, do NOT commit**:
   ```
   git add task-tracking/sessions/{SESSION_ID}/log.md
   git add task-tracking/sessions/{SESSION_ID}/analytics.md
   git add "task-tracking/sessions/{SESSION_ID}/worker-logs/" (only if directory exists)
   ```
   Print: `STALE ARCHIVE — staged {SESSION_ID} (awaiting user commit)`
   Collect all staged SESSION_IDs into `stale_staged[]` for the Pre-Flight Report.
7. **If `orchestrator-history.md` has uncommitted changes** and no active session is currently writing it:
   ```
   git add task-tracking/orchestrator-history.md
   ```
   Print: `STALE ARCHIVE — staged stale orchestrator-history.md (awaiting user commit)`
8. If no stale artifacts found: Print `STALE ARCHIVE — no stale session artifacts found`
9. **Do NOT run `git commit`**. The stale archive check stages files only. The actual commit happens later:
   - If `stale_staged[]` is non-empty, the Pre-Flight Report (Step 4g) displays:
     `"Stale session artifacts staged: {list of SESSION_IDs}. These will be committed when you next run /commit or git commit."`
   - The supervisor proceeds regardless — staged files do not block startup.
   - **Rationale**: Git commits require explicit user instruction. The supervisor must not commit autonomously.
10. All git staging operations here are **best-effort**: if staging fails (lock, permissions), print a warning and continue. A failure here must NEVER prevent the supervisor from starting.

### Session Log Entries

After the Session Directory is created (Step 4 of Startup Sequence), append one log entry per action taken during the stale archive check:

| Event | Log Row |
|-------|---------|
| Staged stale session | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE — staged {SESSION_ID} for later user commit \|` |
| Staged stale history | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE — staged stale orchestrator-history.md for later user commit \|` |
| No stale artifacts | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE — no stale session artifacts found \|` |
| Git error (non-fatal) | `\| {HH:MM:SS} \| auto-pilot \| STALE ARCHIVE WARNING — git error: {reason[:200]} \|` |
| Zombie flush | `\| {HH:MM:SS} \| auto-pilot \| ZOMBIE FLUSH — {N} stale sessions closed \|` |

---

## Concurrent Session Guard

On startup, **after MCP validation passes, before Session Directory creation, before entering the loop**:

1. Read `task-tracking/active-sessions.md` (if it exists).
2. If any row with Source `auto-pilot` is present:
   - Log: `"INFO: Another supervisor session is running: {SESSION_ID} — concurrent mode enabled (DB task claiming active)"`
   - Continue without prompting. Concurrent sessions are safe on the DB-backed path because task claiming and worker ownership come from MCP/DB state, preventing double-spawning without reading other sessions' `state.md` files.
   - **Only abort** if `--no-concurrent` flag is passed. In that case, display: `"ABORT: Another supervisor is running ({SESSION_ID}). Pass --force to override or wait for it to finish."` and exit.
3. Proceed to Session Directory startup (create dir, register in active-sessions.md).

> **Concurrency is safe by design**: Each session operates on its own `SESSION_DIR`, writes to separate worker IDs, and relies on DB-backed task claiming for cross-session exclusion. Multiple supervisors can process different tasks in parallel without conflict on the DB-backed path.

---

## state.md Format

Written to `{SESSION_DIR}state.md` (e.g., `task-tracking/sessions/SESSION_2026-03-24T22-00-00/state.md`) only when the supervisor chooses to materialize a debug snapshot at startup, pause, stop, or error time. It is helpful after compaction, but it is not the primary recovery source on the DB-backed path.

```markdown
# Orchestrator State

**Loop Status**: PENDING | RUNNING | STOPPED | PAUSED | ABORTED
**Last Updated**: YYYY-MM-DD HH:MM:SS +ZZZZ
**Session Started**: YYYY-MM-DD HH:MM:SS +ZZZZ
**Session Directory**: task-tracking/sessions/SESSION_2026-03-24T22-00-00/

## Configuration

| Parameter              | Value      |
|------------------------|------------|
| Concurrency Limit      | 3          |
| Monitoring Interval    | 5 minutes  |
| Retry Limit            | 2          |
| MCP Empty Threshold    | 2          |
| Wave Spawn Failures    | 0          |
| Session Start Epoch    | 1711288800 |

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
# Session Log — SESSION_2026-03-24T22-00-00

| Timestamp | Source | Event |
|-----------|--------|-------|
| 10:00:00 | auto-pilot | SUPERVISOR STARTED — 6 tasks, 3 unblocked, concurrency 3 |
| 10:00:05 | auto-pilot | SPAWNED abc-123 for TASK_2026_003 (Build: FEATURE) |
| 10:05:00 | orchestrate | PM phase complete for TASK_2026_010 |
```

**Key design properties**:

- **Snapshot, not live loop memory**: `state.md` is a materialized debug snapshot, not the steady-state source of truth on the DB-backed path.
- **Standard markdown**: All tables use standard markdown syntax, parseable by any agent after compaction.
- **Retry persistence**: Retry counters should persist in the DB session record; `state.md` may mirror them for debugging.
- **Split state/log**: `state.md` is an optional structured snapshot. `log.md` is an optional rendered event stream. Keep them separate.

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

### Session Stuck Prevention (PENDING / No-Progress Guards)

Sessions must never stay in a non-terminal state indefinitely. The following guards apply:

**PENDING timeout**: If `loop_status` remains `PENDING` (no worker has ever been spawned) for more than **5 minutes** from session start:
- Log: `"PENDING TIMEOUT — session stuck in PENDING for 5+ minutes. No workers spawned. Stopping."`
- Write state to `{SESSION_DIR}state.md` and/or `update_session()`.
- Set `loop_status: STOPPED`.
- EXIT.

**Wave failure circuit breaker**: If **3 consecutive spawn waves** produce zero workers:
- Log: `"WAVE FAILURE — 3 consecutive waves with zero spawns. Systemic issue. Stopping."`
- Write state, set `loop_status: STOPPED`, EXIT.
- This catches DB errors (FK failures, constraint mismatches), provider outages, and config issues that would otherwise cause the session to loop forever.

**No-progress guard**: If the session is in `RUNNING` state but **no task has changed state** (no COMPLETE, FAILED, or BLOCKED transitions) for **30 minutes** AND no active workers exist:
- Log: `"NO PROGRESS — 30 minutes with no state transitions and no active workers. Stopping."`
- Write state, set `loop_status: STOPPED`, EXIT.

**Spawn result validation**: After every `spawn_worker` call, check the response:
- If `ok: false` with `reason: session_not_found` — the session was lost from the DB. STOP immediately.
- If `ok: false` with `reason: task_not_found` — log the error and skip this task; investigate the DB state before retrying.
- If `ok: true` — proceed normally. Increment successful spawn counter.
- These checks prevent silent failures where spawn appears to succeed but no worker was created.
