# Cortex Integration — auto-pilot

## Overview

This is a summary reference for nitro-cortex integration points within the auto-pilot skill. The full inline details remain in `references/parallel-mode.md` (Steps 1-8).

Load this file when the cortex DB is available to understand which paths apply at each step. The DB is the only path — there is no file-based fallback.

## Cortex DB Paths by Step

### Step 2: Read Registry

- **Detection**: Call `get_tasks()` at Step 2. If it succeeds, cache the result. If it fails, **FATAL exit** — no fallback.
- **DB path**: `get_tasks()` returns structured list — task_id, status, type, description, priority, dependencies. No file reads needed.

### Step 3: Build Dependency Graph — BLOCKED writes

- **DB path**: When writing BLOCKED (missing dep, cancelled dep, or cycle detection), call:
  - `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))` — cortex DB

### Step 3d: Cross-Session Task Exclusion

- **DB path**: `claim_task()` is atomic at the DB level — a transaction prevents two sessions from claiming the same task simultaneously. Cross-session exclusion is handled by the DB.

### Step 4: Order Task Queue

- **DB path**: Call `get_next_wave(session_id, slots)`. Returns up to `slots` tasks atomically claimed for this session, sorted by Priority then Task ID, dependency-resolved, excluding already-claimed tasks. These tasks are already claimed — no separate `claim_task()` call needed.

### Step 5: Claim Task Before Spawning

- **DB path**: Before calling `spawn_worker`, call `claim_task(task_id, session_id)`.
  - If `get_next_wave()` was used in Step 4, tasks are already claimed — skip this step.
  - If `claim_task()` returns `{ok: false, claimed_by: ...}`: log CLAIM REJECTED and skip this task.
  - If `claim_task()` returns `{ok: true}`: proceed to `spawn_worker`.

### Step 5h: Persist State After Spawn

- **DB path**: Call `update_session(session_id, fields=JSON.stringify({loop_status: "running", ...active_workers_summary}))` to persist structured state in the DB. Also write `{SESSION_DIR}state.md` as snapshot.

### Step 6: Monitor — MCP Empty Grace Period

- **DB path**: Read `mcp_empty_count` from `get_session(session_id)` (fields.mcp_empty_count). Update via `update_session()`.

### Step 6: Event-Driven / Polling Mode — Write Session State

- **DB path**: Call `update_session()` with current active_workers summary. Also write `{SESSION_DIR}state.md` as snapshot.

### Step 7a: Read Current Task State

- **DB path**: For single-task completion checks, call `get_task_context(task_id)` (preferred) or use the cached task roster from Step 2. Do **not** call `get_tasks(status: "COMPLETE")` for verification. If a broad `get_tasks()` read is needed for reconciliation, pass a small `limit` to avoid oversized responses.

### Step 7c: Suspicious Transition — BLOCKED write

- **DB path**: Call `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))`.

### Step 7d: State Transitioned (IMPLEMENTED or COMPLETE)

- **DB path**: Call `release_task(task_id, "IMPLEMENTED")` or `release_task(task_id, "COMPLETE")` to release the claim and update DB status atomically. If `release_task` fails, log "RELEASE FAILED" and continue.

### Step 7e: State Did NOT Transition — BLOCKED write

- **DB path**: Call `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))`.

### Step 1: Compaction Recovery

- **DB path**: Call `get_session(session_id)` to restore full session state: active workers, completed tasks, failed tasks, retry counters, config, mcp_empty_count. Set `SESSION_DIR` from session_id — no file read needed.

## Event Logging

- **DB path**: For every log event, call `log_event(session_id, task_id?, source="auto-pilot", event_type, data)` (best-effort, fire-and-forget) in addition to appending to `{SESSION_DIR}log.md`. See **Event Logging — Cortex Path** section in `parallel-mode.md` for the full event_type mapping table.
- **DB path (session end)**: Call `query_events(session_id=SESSION_ID)` to render `{SESSION_DIR}log.md` from DB before calling `end_session()`. Preserves audit trail across compaction events.

## Session History (orchestrator-history.md)

- **DB path**: Call `log_event(event_type="SUPERVISOR_COMPLETE", data={completed, failed, blocked, duration_minutes})` in addition to appending to `task-tracking/orchestrator-history.md`. Both paths run for human readability.
- **Analytics query**: Use `query_events(event_type="SUPERVISOR_COMPLETE")` instead of reading `orchestrator-history.md`.

## Worker Handoff Injection

- **DB path**: Before spawning a Review Worker, call `read_handoff(task_id)` to retrieve the structured handoff record. Inject a `## Handoff Data (injected by Supervisor from nitro-cortex DB)` block into the Review Lead prompt. See **Step 5c-handoff** in `parallel-mode.md` for the full injection format.

## Session Teardown

- **DB path**: At session end, call `end_session(session_id=SESSION_ID, summary="...")` after all file cleanup. Best-effort, non-blocking.
