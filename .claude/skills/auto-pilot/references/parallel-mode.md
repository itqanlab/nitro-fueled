# Parallel Mode — Core Loop — auto-pilot

## Pre-Flight Exit Gate

**MANDATORY**: After all pre-flight checks (Steps 1-4) complete, the supervisor's VERY NEXT action MUST be one of:

1. **Call `spawn_worker`** — if actionable tasks exist and slots are available (enter Step 5 immediately)
2. **Log "all tasks blocked"** — if no actionable tasks remain because all are BLOCKED
3. **Log "--limit reached"** — if the task limit (`--limit N`) has been reached

**NO further reads, analysis, or investigation are permitted between pre-flight completion and the first spawn.** Specifically:

- Do NOT read additional reference files
- Do NOT check for "newer" or "recently created" tasks
- Do NOT investigate the codebase
- Do NOT summarize the pre-flight findings in a table
- Do NOT re-read the registry or any task files

If you find yourself doing anything other than (a), (b), or (c) after pre-flight completes, STOP — you are violating the pre-flight exit gate. The pre-flight phase is a strict 3-step check (reconstruct state → read queue → build dependency view → select candidates), not a planning or research phase. Any activity beyond these steps before the first `spawn_worker` call is a stall.

## Context Budget Principle

When `cortex_available = true`, the supervisor must behave as a thin event loop:

1. Query the DB for the current task roster with `get_tasks()`.
2. Query the DB for active workers with `list_workers(compact: true)`.
3. Spawn new workers only through MCP tool calls.
4. Detect completion from `get_pending_events()`.
5. Persist loop state in the DB with `update_session()`.

The supervisor must **not** read `registry.md`, `task.md`, or task `status` files inside the monitoring loop when the DB is available. It must also **not** append to `log.md` or rewrite `state.md` inside the loop. Those file writes are context leaks.

`state.md` is a debug artifact written once at session start (configuration snapshot) and optionally once at session end or pause. `log.md` is rendered from DB events or skipped if `log_event()` is unavailable. Neither file is part of the steady-state loop.

When `cortex_available = false`, the legacy file-based fallback still applies. That fallback is intentionally more expensive and may compact sooner.

## Core Loop

### Step 1: Reconstruct Session State

**Preferred path (`cortex_available = true`):**

1. Call `list_workers(status_filter: 'running', compact: true)`.
2. Call `get_tasks()`.
3. If a persisted supervisor session exists, call `get_session(session_id)` and restore only lightweight loop fields from the DB: retry counters, claimed task IDs, serialized review set, and config.
4. Treat the DB responses as the complete current truth for this tick.
5. Do **not** read `state.md`, `active-sessions.md`, `registry.md`, or any task folder file on this path.

**Compaction survival (`cortex_available = true`):**

1. After compaction, immediately call `list_workers(compact: true)`.
2. Then call `get_tasks()`.
3. If needed, call `get_session(session_id)` to restore retry counters and session metadata.
4. Resume the loop from those DB results.
5. Do **not** attempt recovery by reading `state.md`.

**Fallback path (`cortex_available = false`):**

1. Read `{SESSION_DIR}state.md` if it exists.
2. Reconcile against `list_workers()`.
3. Continue using file-based task metadata and status reads in the later steps.

### Step 2: Read Task Queue

**Preferred path (`cortex_available = true`):**

1. Call `get_tasks(status=['CREATED', 'IMPLEMENTED', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETE', 'CANCELLED'])`.
2. Validate each `task_id` against `^TASK_\d{4}_\d{3}$` before using it for any routing decision.
3. Use only structured DB fields for queueing: `task_id`, `status`, `type`, `priority`, `dependencies`, `model`, `provider`, `preferred_tier`, `testing`, and retry-related metadata if present.
4. Cache the task roster in the session DB with `update_session()` if the implementation needs a persisted copy for compaction recovery.
5. Do **not** read `registry.md`.
6. Do **not** read task `status` files.
7. Do **not** read `task.md` at this stage.

**Fallback path (`cortex_available = false`):**

1. Read `task-tracking/registry.md`.
2. Read task `status` files as the live state source.
3. Cache the parsed fallback roster in `{SESSION_DIR}state.md`.

### Step 3: Build Dependency View

**Preferred path (`cortex_available = true`):**

1. Build the dependency graph directly from the `dependencies` arrays returned by `get_tasks()`.
2. Treat dependency fields as opaque data.
3. Validate every dependency token against `^TASK_\d{4}_\d{3}$`.
4. Classify tasks using DB state only:
   - `READY_FOR_BUILD`: `CREATED` and all dependencies `COMPLETE`
   - `BUILDING`: `IN_PROGRESS`
   - `READY_FOR_REVIEW`: `IMPLEMENTED` and all dependencies `COMPLETE`
   - `REVIEWING`: `IN_REVIEW`
   - `BLOCKED`: `BLOCKED`
   - `COMPLETE`: `COMPLETE`
   - `CANCELLED`: `CANCELLED`
5. If a dependency is missing, cancelled, or cyclic, call `update_task(task_id, fields=JSON.stringify({status: 'BLOCKED'}))`.
6. If `log_event()` is available, record the reason there. If it is unavailable, skip the log write. Do **not** append to `log.md`.
7. Do **not** read `task.md`, `registry.md`, or task `status` files on this path.

**Fallback path (`cortex_available = false`):**

1. Use the cached fallback status map from `{SESSION_DIR}state.md`.
2. Update the fallback status map after any blocking decision.

### Step 4: Select Spawn Candidates

**Preferred path (`cortex_available = true`):**

1. Call `list_workers(session_id=SESSION_ID, status_filter: 'running', compact: true)` and derive `slots = concurrency_limit - running_workers_in_this_session`.
   Never compute `slots` from global active workers across all sessions.
2. If `slots <= 0`, skip to Step 6.
3. Partition candidates from the Step 3 classifications into two sets:
   - `build_candidates`: tasks in `READY_FOR_BUILD` state (CREATED, deps satisfied), ordered by priority (P0 > P1 > P2 > P3), then by task ID ascending.
   - `review_candidates`: tasks in `READY_FOR_REVIEW` state (IMPLEMENTED, deps satisfied), ordered by priority, then by task ID ascending.
4. **Apply the configured priority strategy** (default: `build-first`) to allocate slots:

   **`build-first` (default)**:
   - Fill slots starting with `build_candidates`.
   - Any remaining slots go to `review_candidates`.
   - Guarantee: at least 1 slot goes to builds when `build_candidates` is non-empty.

   **`review-first`**:
   - Fill slots starting with `review_candidates`.
   - Any remaining slots go to `build_candidates`.
   - Guarantee: at least 1 slot goes to reviews when `review_candidates` is non-empty.

   **`balanced`**:
   - Reserve ≥1 slot for builds and ≥1 slot for reviews (when both candidate sets are non-empty).
   - With `slots = 1` and both sets non-empty: allocate to builds.
   - With `slots ≥ 2`: first slot to builds, second to reviews, remaining alternate starting with builds.
   - When only one candidate set is non-empty, all slots go to that set.

5. If `get_next_wave(session_id, slots)` exists, use it as the atomic selector/claimer.
6. Otherwise, use the `get_tasks()` result plus `claim_task(task_id, SESSION_ID)` before each spawn.
7. Treat `claim_task(task_id, SESSION_ID)` as the cross-session deduplication guard. If another session already claimed the task, skip it and select the next candidate.
   This claim step is what prevents duplicate assignment when multiple supervisor sessions run concurrently.
8. Apply any serialized-review exclusions from session DB state.
9. Do **not** read `state.md` to calculate the live queue on this path.

**Fallback path (`cortex_available = false`):**

1. Order the cached fallback queue in `{SESSION_DIR}state.md`.
2. Apply the same priority strategy as the preferred path, partitioning into build and review candidates and allocating slots accordingly.

### Step 5: Spawn Workers

**Preferred path (`cortex_available = true`):**

1. For each selected task, read its metadata from the DB (`get_task_context(task_id)` or equivalent task row fields). The DB is the source for spawn-time metadata.
2. Do not open `task.md` on this path.
3. Validate structured routing fields before use: type, priority, complexity, provider, model, preferred tier, testing mode, and retry limits.
4. Resolve provider/model from DB fields plus the routing config.
5. Claim the task atomically if Step 4 did not already claim it.
6. Call `spawn_worker(...)`.
7. On success, persist active-worker state to the DB with `update_session()`.
8. If `subscribe_worker()` is available, register completion conditions immediately.
9. If `log_event()` is available, emit the spawn event there. Otherwise skip the log write.
10. Do **not** write `state.md` after each spawn.
11. Do **not** append to `log.md` after each spawn.

**Fallback path (`cortex_available = false`):**

1. Read the minimal metadata slice from `task.md`.
2. Persist active-worker state in `{SESSION_DIR}state.md`.

### Step 6: Monitor Workers
**Preferred path (`cortex_available = true`):**

1. Sleep for the configured interval (`sleep 30` for event-driven mode, or polling interval when event subscriptions are unavailable).
2. Call `update_heartbeat(session_id)` to record that this session is alive.
3. Call `get_pending_events()` and handle every returned event in the same tick.
4. Call `list_workers(compact: true)` to refresh the active-worker set.
5. For workers with no completion event, call `get_worker_activity(worker_id)` only when a health check is due.
6. Escalate to `get_worker_stats(worker_id)` only for unclear or degraded health.
7. Persist changed worker-health counters with `update_session()`.
8. If `log_event()` is available, emit health warnings there.
9. Do **not** append heartbeat rows to `log.md`.
10. Do **not** rewrite `state.md`.
11. Do **not** poll task `status` files for completion.

**Two-strike stuck detection:**

1. First `stuck` signal: increment strike count in the DB session record.
2. Second consecutive `stuck` signal: `kill_worker()`, increment retry count, and either retry or mark the task `BLOCKED` via `update_task()`.
3. Preserve counters across MCP restarts and compactions by storing them in the DB session record.

**Fallback path (`cortex_available = false`):**

1. Continue to use `{SESSION_DIR}state.md` plus file-based completion checks.

### Step 7: Handle Completions

**Preferred path (`cortex_available = true`):**

1. Treat `get_pending_events()` as the primary completion signal.
2. For a Build Worker completion, accept the event as the authoritative signal that the task reached `IMPLEMENTED`.
3. For a Review/Fix completion, accept the event as the authoritative signal that the task reached `COMPLETE`.
4. If the loop is reconciling a worker without an event, call `get_task_context(task_id)` for single-task status checks. Avoid `get_tasks(status: "COMPLETE")`; if `get_tasks()` is needed for broader reconciliation, always provide a bounded `limit`.
5. Release or update the task through MCP (`release_task()` / `update_task()`) as required by the implementation.
6. Update the session DB record with completed/failed worker bookkeeping.
7. Re-evaluate only the affected dependents using the latest `get_tasks()` data; do not do file-based downstream checks.
8. If `log_event()` is available, record the completion event there.
9. Do **not** read task `status` files.
10. Do **not** read `registry.md`.
11. Do **not** append completion rows to `log.md` from inside the loop.

**Fallback path (`cortex_available = false`):**

1. Read the task `status` file to confirm transition.
2. Update the fallback status map in `{SESSION_DIR}state.md`.

### Step 8: Stop or Continue

**Preferred path (`cortex_available = true`):**

1. Re-query `get_tasks()` and `list_workers(compact: true)`.
2. If actionable tasks remain and slots are available, go to Step 4.
3. If no actionable tasks remain but workers are still active, go to Step 6.
4. If no actionable tasks remain and no workers are active, stop the loop.
5. On stop, optionally render a final debug `state.md` snapshot and/or materialize `log.md` from DB events.
6. If `query_events(session_id)` exists, use it to render `log.md` at session end.
7. If `query_events()` or `log_event()` is unavailable, it is acceptable to leave `log.md` absent.
8. Session history and analytics are end-of-session bookkeeping steps, not loop-body writes.

**Fallback path (`cortex_available = false`):**

1. Write final `{SESSION_DIR}state.md` and append the final `log.md` rows.
2. Run the existing session-history and analytics bookkeeping.

## Hard Constraints

When `cortex_available = true`, the supervisor loop must obey all of these rules:

1. Never read `registry.md`.
2. Never read task `status` files.
3. Never read `task.md` inside the loop.
4. Never rewrite `state.md` inside the loop.
5. Never append to `log.md` inside the loop.
6. Use `get_tasks()` and `get_pending_events()` for task-state decisions.
7. Use `list_workers(compact: true)` and worker health MCP tools for worker-state decisions.
8. Treat DB re-query as the only compaction-recovery path.

## Session Artifacts

The DB-first supervisor still produces file artifacts, but only outside the steady-state loop:

1. `state.md`: optional debug snapshot at session start, pause, or stop.
2. `log.md`: optional end-of-session rendering from DB events.
3. `analytics.md`: end-of-session summary.
4. `worker-logs/`: optional completion artifacts written outside the monitoring tick.
