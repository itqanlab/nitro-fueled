# Cortex Integration — auto-pilot

## Overview

This is a summary reference for nitro-cortex integration points within the auto-pilot skill. The full inline details remain in `references/parallel-mode.md` (Steps 1-8).

Load this file when `cortex_available = true` to understand which DB paths apply at each step. The file-based fallback path (when `cortex_available = false`) is documented inline in `parallel-mode.md` alongside each cortex path.

## Cortex DB Paths by Step

### Step 2: Read Registry

- **Detection**: Call `get_tasks()` at Step 2. If it succeeds, set session flag `cortex_available = true` and cache the result. If it fails, set `cortex_available = false` and fall back to file-based registry.
- **cortex path**: `get_tasks()` returns structured list — task_id, status, type, description, priority, dependencies. No file reads needed.
- **fallback path**: Read `task-tracking/registry.md` + per-task `status` files.

### Step 3: Build Dependency Graph — BLOCKED writes

- **cortex path**: When writing BLOCKED (missing dep, cancelled dep, or cycle detection), write BOTH:
  - `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))` — cortex DB
  - `task-tracking/TASK_YYYY_NNN/status` file write — for subscriber watchers and fallback

### Step 3d: Cross-Session Task Exclusion

- **cortex path**: Step 3d is REMOVED. `claim_task()` is atomic at the DB level — a transaction prevents two sessions from claiming the same task simultaneously. Cross-session exclusion is handled by the DB, not by file polling.
- **fallback path**: Re-read `task-tracking/active-sessions.md`, extract foreign_claimed_set from other sessions' state.md files.

### Step 4: Order Task Queue

- **cortex path**: Call `get_next_wave(session_id, slots)`. Returns up to `slots` tasks atomically claimed for this session, sorted by Priority then Task ID, dependency-resolved, excluding already-claimed tasks. These tasks are already claimed — no separate `claim_task()` call needed.
- **fallback path**: Build Review Queue + Build Queue manually from classified tasks, excluding foreign_claimed_set.

### Step 5: Claim Task Before Spawning

- **cortex path**: Before calling `spawn_worker`, call `claim_task(task_id, session_id)`.
  - If `get_next_wave()` was used in Step 4, tasks are already claimed — skip this step.
  - If `claim_task()` returns `{ok: false, claimed_by: ...}`: log CLAIM REJECTED and skip this task.
  - If `claim_task()` returns `{ok: true}`: proceed to `spawn_worker`.
- **fallback path**: Sub-step skipped entirely.

### Step 5h: Persist State After Spawn

- **cortex path**: Call `update_session(session_id, fields=JSON.stringify({loop_status: "running", ...active_workers_summary}))` to persist structured state in the DB. Also write `{SESSION_DIR}state.md` as snapshot.
- **fallback path**: Write `{SESSION_DIR}state.md` only.

### Step 6: Monitor — MCP Empty Grace Period

- **cortex path**: Read `mcp_empty_count` from `get_session(session_id)` (fields.mcp_empty_count). Update via `update_session()`.
- **fallback path**: Read/write `{SESSION_DIR}state.md`.

### Step 6: Event-Driven / Polling Mode — Write Session State

- **cortex path**: Call `update_session()` with current active_workers summary. Also write `{SESSION_DIR}state.md` as snapshot.
- **fallback path**: Write `{SESSION_DIR}state.md` only.

### Step 7a: Read Current Task State

- **cortex path**: For single-task completion checks, call `get_task_context(task_id)` (preferred) or use the cached task roster from Step 2. Do **not** call `get_tasks(status: "COMPLETE")` for verification. If a broad `get_tasks()` read is needed for reconciliation, pass a small `limit` to avoid oversized responses.
- **fallback path**: Read `task-tracking/TASK_YYYY_NNN/status` file only.

### Step 7c: Suspicious Transition — BLOCKED write

- **cortex path**: Also call `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))` to sync DB state.
- **fallback path**: Write `task-tracking/TASK_YYYY_NNN/status` file only.

### Step 7d: State Transitioned (IMPLEMENTED or COMPLETE)

- **cortex path**: Call `release_task(task_id, "IMPLEMENTED")` or `release_task(task_id, "COMPLETE")` to release the claim and update DB status atomically. If `release_task` fails, log "RELEASE FAILED" and continue — status file is authoritative.
- **fallback path**: Status file write by worker is the final state signal.

### Step 7e: State Did NOT Transition — BLOCKED write

- **cortex path**: Also call `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))` to sync DB state.
- **fallback path**: Write `task-tracking/TASK_YYYY_NNN/status` file only.

### Step 1: Compaction Recovery

- **cortex path**: Call `get_session(session_id)` to restore full session state: active workers, completed tasks, failed tasks, retry counters, config, mcp_empty_count. Set `SESSION_DIR` from session_id — no file read needed.
- **fallback path**: Read `task-tracking/active-sessions.md`, find session row, read `{SESSION_DIR}state.md`.

## Bootstrap Note

On first run against a new project, call `sync_tasks_from_files()` once to import existing task-tracking files into the nitro-cortex DB before calling `get_tasks()`. This only needs to run once (safe to re-run — upsert). After the initial sync, all subsequent state changes go through the MCP tools and the DB stays current.

## Event Logging

- **cortex path**: For every log event, call `log_event(session_id, task_id?, source="auto-pilot", event_type, data)` (best-effort, fire-and-forget) in addition to appending to `{SESSION_DIR}log.md`. See **Event Logging — Cortex Path** section in `parallel-mode.md` for the full event_type mapping table.
- **cortex path (session end)**: Call `query_events(session_id=SESSION_ID)` to render `{SESSION_DIR}log.md` from DB before calling `end_session()`. Preserves audit trail across compaction events.
- **fallback path**: Write only to `{SESSION_DIR}log.md`. Skip all `log_event` calls.

## Session History (orchestrator-history.md)

- **cortex path**: Call `log_event(event_type="SUPERVISOR_COMPLETE", data={completed, failed, blocked, duration_minutes})` instead of appending to `task-tracking/orchestrator-history.md`. The file-based append is preserved as the fallback and for human readability — both paths run.
- **Analytics query**: Use `query_events(event_type="SUPERVISOR_COMPLETE")` instead of reading `orchestrator-history.md`.
- **fallback path**: Append to `task-tracking/orchestrator-history.md` only.

## Worker Handoff Injection

- **cortex path**: Before spawning a Review Worker, call `read_handoff(task_id)` to retrieve the structured handoff record. Inject a `## Handoff Data (injected by Supervisor from nitro-cortex DB)` block into the Review Lead prompt. See **Step 5c-handoff** in `parallel-mode.md` for the full injection format.
- **fallback path**: Worker reads `task-tracking/TASK_YYYY_NNN/handoff.md` file directly (Step 1 of Review Lead prompt — unchanged).

## Session Teardown

- **cortex path**: At session end, call `end_session(session_id=SESSION_ID, summary="...")` after all file cleanup. Best-effort, non-blocking.
- **fallback path**: File cleanup only (`active-sessions.md` row removal, `log.md` final entry).
