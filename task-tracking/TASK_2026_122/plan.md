# Implementation Plan — TASK_2026_122
# nitro-cortex Skill Integration (Part 3 of 3)

---

## Overview

This task migrates two large skill files and CLI init to use the `nitro-cortex` MCP server
tools instead of reading/writing markdown files for task state, session coordination, and
worker management. The payoff is that agents stop loading large files into context and
instead query exactly what they need via MCP tool calls.

**Core theme**: Every change is additive with a graceful file-based fallback. The skills
remain fully functional when nitro-cortex is absent. `nitro-cortex` calls are a first-
preference fast path; the original file-based logic is the fallback path.

**Evidence basis**:
- nitro-cortex tool schemas verified: `packages/mcp-cortex/src/index.ts:35-221`
- auto-pilot Step 2-7 located: `.claude/skills/auto-pilot/SKILL.md:1369-1900`
- Step 3d (cross-session exclusion) located: `SKILL.md:1487-1507`
- orchestration IN_PROGRESS write: worker prompt template `SKILL.md:2199-2201`
- orchestration IMPLEMENTED write: worker prompt template `SKILL.md:2213-2214`
- CLI MCP configure: `apps/cli/src/utils/mcp-configure.ts:44-87`
- CLI MCP entry builder: `apps/cli/src/utils/mcp-setup-guide.ts:43-53`
- No `apps/cli/scaffold/.claude/settings.json` exists yet — must be created

---

## Files to Modify

| File | Action |
|------|--------|
| `.claude/skills/auto-pilot/SKILL.md` (~3270 lines) | MODIFY — targeted section replacements |
| `.claude/skills/orchestration/SKILL.md` (769 lines) | MODIFY — targeted section additions |
| `apps/cli/src/utils/mcp-setup-guide.ts` | MODIFY — add nitro-cortex entry builder |
| `apps/cli/src/utils/mcp-configure.ts` | MODIFY — add nitro-cortex configure function |
| `apps/cli/src/commands/init.ts` | MODIFY — add nitro-cortex to init flow |
| `apps/cli/scaffold/.claude/settings.json` | CREATE — nitro-cortex server config |

---

## Implementation Steps

The steps below are ordered to minimize risk. Steps 1-5 edit the auto-pilot SKILL.md.
Step 6 edits orchestration SKILL.md. Steps 7-9 cover CLI changes.

---

### Step 1 — auto-pilot SKILL.md: Replace Step 2 (Read Registry)

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `### Step 2: Read Registry` (lines 1369-1376)

**Current text** (verbatim section to replace):

```
### Step 2: Read Registry

1. Read `task-tracking/registry.md`.
2. Parse every row: extract **Task ID**, **Status** (registry column — used only as fallback if status file is missing), **Type**, **Description**, **Priority**, **Dependencies** (do NOT rely on the registry Status column as the live state for routing decisions).
3. For each Task ID parsed from the registry, validate the Task ID matches `TASK_\d{4}_\d{3}` before constructing any file path. If the value does not match, skip the row and log warning: `"[warn] Skipping malformed Task ID: {raw_id}"`. For valid Task IDs, read `task-tracking/TASK_YYYY_NNN/status` to get the current state (trim all whitespace). If the `status` file is missing, fall back to registry column 2 and log warning: `"[warn] TASK_YYYY_NNN: status file missing, reading state from registry.md"`.
4. If a row is missing Priority or Dependencies columns (legacy registry format):
   - Treat Priority as `P2-Medium` and Dependencies as empty.
   - Log warning: `"[warn] TASK_YYYY_NNN: registry row missing Priority/Dependencies — treating as P2-Medium, no deps"`
```

**Replacement text**:

```
### Step 2: Read Registry

**Preferred path (nitro-cortex available):**

1. Call MCP `get_tasks()` (no filters). Returns a structured list of all tasks with fields:
   task_id, status, type, description, priority, dependencies.
2. Use the returned list as the authoritative task roster. No file reads needed.
3. For each task: validate task_id matches `TASK_\d{4}_\d{3}`. Discard and log if malformed.
4. If any row is missing priority or dependencies fields: treat as `P2-Medium` / empty deps.
   Log warning: `"[warn] TASK_YYYY_NNN: get_tasks() row missing Priority/Dependencies — treating as P2-Medium, no deps"`

**Fallback path (nitro-cortex unavailable — file-based):**

If `get_tasks()` is not in the MCP tool list, or returns an error, fall back to:

1. Read `task-tracking/registry.md`.
2. Parse every row: extract **Task ID**, **Status** (registry column — used only as fallback if status file is missing), **Type**, **Description**, **Priority**, **Dependencies** (do NOT rely on the registry Status column as the live state for routing decisions).
3. For each Task ID parsed from the registry, validate the Task ID matches `TASK_\d{4}_\d{3}` before constructing any file path. If the value does not match, skip the row and log warning: `"[warn] Skipping malformed Task ID: {raw_id}"`. For valid Task IDs, read `task-tracking/TASK_YYYY_NNN/status` to get the current state (trim all whitespace). If the `status` file is missing, fall back to registry column 2 and log warning: `"[warn] TASK_YYYY_NNN: status file missing, reading state from registry.md"`.
4. If a row is missing Priority or Dependencies columns (legacy registry format):
   - Treat Priority as `P2-Medium` and Dependencies as empty.
   - Log warning: `"[warn] TASK_YYYY_NNN: registry row missing Priority/Dependencies — treating as P2-Medium, no deps"`

**Cortex availability detection** (once per session, cached):
Call `get_tasks()` at Step 2. If it succeeds, set session flag `cortex_available = true` and
cache the result. If it fails (tool not found or error), set `cortex_available = false` and
fall back. Do not re-check per loop — the flag persists for the session.
```

**Why**: Eliminates reading registry.md + per-task status files. A single `get_tasks()` call
returns all fields. The fallback preserves backward compatibility.
Evidence: `packages/mcp-cortex/src/index.ts:35-43` (get_tasks schema)

---

### Step 2 — auto-pilot SKILL.md: Replace Step 3 (Build Dependency Graph) — cortex path

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `### Step 3: Build Dependency Graph` (lines 1386-1443)

The dependency graph logic is extensive and must be preserved in the fallback path.
The change adds a fast path before the existing content.

**Insertion point**: Immediately before the existing `### Step 3: Build Dependency Graph`
heading, add the following block. Do not replace the existing Step 3 content —
prepend this subsection:

```
### Step 3: Build Dependency Graph

**Preferred path (cortex_available = true):**

Use the task list returned by `get_tasks()` in Step 2 — it already contains each task's
`dependencies` array. Perform dependency validation and classification using that data
directly (no additional file reads). Apply the same READY_FOR_BUILD / BLOCKING / etc.
classification rules using the `dependencies` field from the get_tasks response.

**For blocked/cycle writes**: If a task must be written as BLOCKED (missing dep, cancelled
dep, or cycle detection), write both:
- `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))` (cortex DB)
- `task-tracking/TASK_YYYY_NNN/status` file write (for subscriber watchers and fallback)

**Fallback path (cortex_available = false):**

Use the file-based parsing below (original logic — unchanged).

---
```

Then leave the existing `### Step 3` content intact underneath (the full classification
table, dependency validation, orphan detection, etc.). The developer adds the fast path
header above it and the fallback label before the existing content.

**Why**: `get_tasks()` already returns dependencies as a structured field. Parsing is
identical — just use the returned data structure instead of parsing registry.md text.
Evidence: `packages/mcp-cortex/src/index.ts:35-43` (get_tasks returns dependency data)

---

### Step 3 — auto-pilot SKILL.md: Remove Step 3d (Cross-Session Task Exclusion)

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `### Step 3d: Cross-Session Task Exclusion` (lines 1487-1507)

**Remove the entire section** from:
```
### Step 3d: Cross-Session Task Exclusion

Before building the task queue, identify tasks already claimed by other concurrent supervisor sessions to prevent double-spawning.
```
down to and including the closing `> **Staleness tolerance**: ...` paragraph (line 1507),
including the blank line separating it from Step 4.

**Replace with**:

```
### Step 3d: Cross-Session Task Exclusion

**With cortex_available = true**: Step 3d is REMOVED. `claim_task()` is atomic at the
database level — a transaction prevents two sessions from claiming the same task
simultaneously. Cross-session exclusion is handled by the DB, not by file polling.

**With cortex_available = false (fallback)**: Re-read `task-tracking/active-sessions.md`.
For each other auto-pilot session's `state.md`, extract the Active Workers and Task Queue
tables and build `foreign_claimed_set`. Exclude those task IDs from both queues in Step 4.
(Original Step 3d logic applies verbatim.)
```

**Why**: `claim_task()` is an atomic DB transaction (see
`packages/mcp-cortex/src/index.ts:45-51`). The race condition that Step 3d guards against
is impossible when using `claim_task()` because the DB enforces mutual exclusion.

Also: remove the `Cross-session skip` log row from the Session Log table (line 139):
```
| Cross-session skip | `\| {HH:MM:SS} \| auto-pilot \| CROSS-SESSION SKIP — TASK_X: claimed by {OTHER_SESSION_ID} \|` |
```
Add a replacement row:
```
| Claim rejected (cortex) | `\| {HH:MM:SS} \| auto-pilot \| CLAIM REJECTED — TASK_X: already claimed by another session \|` |
```

**Why**: The new log event reflects the `claim_task()` response `{ok: false, claimed_by:...}`
rather than a file-based check. The original cross-session skip log no longer fires on
the cortex path.

---

### Step 4 — auto-pilot SKILL.md: Replace Step 4 (Order Task Queue)

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `### Step 4: Order Task Queue` (lines 1510-1526)

**Current text** to replace:

```
### Step 4: Order Task Queue

1. Build two queues, both sorted by Priority (P0 > P1 > P2 > P3) then Task ID (lower NNN first):
   - **Review Queue**: READY_FOR_REVIEW tasks (need Review Worker), **excluding** any Task ID in `foreign_claimed_set`
   - **Build Queue**: READY_FOR_BUILD tasks (need Build Worker), **excluding** any Task ID in `foreign_claimed_set`

2. Calculate available spawn slots:
   ```
   slots = concurrency_limit - count(active workers from state)
   ```

3. Select tasks: first from **Review Queue**, then from **Build Queue**, until slots filled. Review Workers take priority over Build Workers (finishing tasks is more valuable than starting new ones).

**Serialization check**: Before selecting tasks from Review Queue, check the `## Serialized Reviews` table in `{SESSION_DIR}state.md`. If a task is in that table, SKIP it for this spawn cycle (it will be handled in a serial pass after current parallel reviews complete).


4. If `slots <= 0`, skip to **Step 6** (monitoring).
```

**Replacement text**:

```
### Step 4: Order Task Queue

**Preferred path (cortex_available = true):**

1. Calculate available spawn slots:
   ```
   slots = concurrency_limit - count(active workers from state)
   ```
2. If `slots <= 0`, skip to **Step 6** (monitoring).
3. Call `get_next_wave(session_id, slots)`.
   - Returns up to `slots` tasks atomically claimed for this session: sorted by Priority
     (P0 > P1 > P2 > P3) then Task ID, dependency-resolved, excluding already-claimed tasks.
   - These tasks are already claimed atomically — no separate `claim_task()` call needed
     (get_next_wave claims them internally).
4. Log each returned task as selected.
5. Proceed to Step 5 using the returned task list.

**Serialization check (cortex path)**: Serialized Reviews still apply. Before sending tasks
to Step 5, apply the `## Serialized Reviews` table check from `{SESSION_DIR}state.md` (or
`get_session()` if session state is being read from DB). Skip serialized tasks for this cycle.

**Fallback path (cortex_available = false):**

1. Build two queues, both sorted by Priority (P0 > P1 > P2 > P3) then Task ID (lower NNN first):
   - **Review Queue**: READY_FOR_REVIEW tasks (need Review Worker), **excluding** any Task ID in `foreign_claimed_set`
   - **Build Queue**: READY_FOR_BUILD tasks (need Build Worker), **excluding** any Task ID in `foreign_claimed_set`

2. Calculate available spawn slots:
   ```
   slots = concurrency_limit - count(active workers from state)
   ```

3. Select tasks: first from **Review Queue**, then from **Build Queue**, until slots filled. Review Workers take priority over Build Workers (finishing tasks is more valuable than starting new ones).

**Serialization check**: Before selecting tasks from Review Queue, check the `## Serialized Reviews` table in `{SESSION_DIR}state.md`. If a task is in that table, SKIP it for this spawn cycle.

4. If `slots <= 0`, skip to **Step 6** (monitoring).
```

**Why**: `get_next_wave()` replaces Steps 2-4 logic. It atomically claims and returns the
right tasks, eliminating manual queue construction, foreign_claimed_set filtering, and
manual claim_task calls.
Evidence: `packages/mcp-cortex/src/index.ts:77-83` (get_next_wave schema)

---

### Step 5 — auto-pilot SKILL.md: Add claim_task before spawn + update state.md writes

**File**: `.claude/skills/auto-pilot/SKILL.md`

#### 5a: Add claim_task guard in Step 5e (spawn)

**Section**: Step 5e — `**5e. Call MCP `spawn_worker`:**` (line 1629)

**Immediately before** the `**5e. Call MCP `spawn_worker`:**` paragraph, insert:

```
**5e-pre. Claim task before spawning (cortex_available = true only):**

Before calling `spawn_worker`, call `claim_task(task_id, session_id)`.
- If `get_next_wave()` was used in Step 4, tasks are already claimed — skip this step
  (get_next_wave claims atomically).
- If the fallback path was used (cortex_available = false, tasks queued manually in Step 4):
  This sub-step is skipped entirely.
- If `claim_task()` returns `{ok: false, claimed_by: ...}`: log
  `| {HH:MM:SS} | auto-pilot | CLAIM REJECTED — TASK_X: already claimed by another session |`
  Skip this task and continue to the next.
- If `claim_task()` returns `{ok: true}`: proceed to `spawn_worker`.
```

#### 5b: Replace state.md write in Step 5h with update_session

**Section**: `**5h. Write `{SESSION_DIR}state.md`**` (line 1698)

**Current text**:
```
**5h. Write `{SESSION_DIR}state.md`** after **each** successful spawn (not after all spawns). This prevents orphaned workers if the session compacts mid-spawn sequence.
```

**Replacement text**:
```
**5h. Persist state after each successful spawn** (not after all spawns). This prevents
orphaned workers if the session compacts mid-spawn sequence.

**With cortex_available = true:**
1. Call `update_session(session_id, fields=JSON.stringify({loop_status: "running", ...active_workers_summary}))` to persist structured state in the DB. This survives compaction — after compaction, `get_session()` restores the supervisor's active worker list.
2. Also write `{SESSION_DIR}state.md` (unchanged format) as a human-readable snapshot and fallback for the Continue mode and Stale Archive Check.

**With cortex_available = false:**
Write `{SESSION_DIR}state.md` only (original behavior).
```

**Why**: State in the DB via `update_session()` survives compaction. The
`get_session()` call in Step 6 and Step 1 (recovery) can restore state without needing
to read state.md.
Evidence: `packages/mcp-cortex/src/index.ts:107-121` (update_session/get_session)

---

### Step 6 — auto-pilot SKILL.md: Replace Step 6 state read with get_session

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: Step 6 — `### Step 6: Monitor Active Workers` (lines 1700-1802)

The monitoring logic itself (get_worker_activity, get_worker_stats, stuck detection) is
already MCP-based and does not change. The change is to how the supervisor reads its own
session state between loop cycles.

**Find the Step 6 MCP Empty Grace Period Re-Check section** (line 1706):
```
#### Step 6 — MCP Empty Grace Period Re-Check (both modes)

**If `mcp_empty_count > 0` in `{SESSION_DIR}state.md`:**
```

**Replace** the two references to `{SESSION_DIR}state.md` in this sub-section header and
body with dual-path logic:

```
#### Step 6 — MCP Empty Grace Period Re-Check (both modes)

**If `mcp_empty_count > 0`** (from session state):

- **With cortex_available = true**: read `mcp_empty_count` from the result of
  `get_session(session_id)` (fields.mcp_empty_count). Update via `update_session()`.
- **With cortex_available = false**: read/write `{SESSION_DIR}state.md` (original).
```

**Also update** the inline reference to `{SESSION_DIR}state.md` in polling mode Step 6e
(line 1802):

```
**6e.** (Polling mode only) Write session state after monitoring pass.
- **With cortex_available = true**: call `update_session(session_id, fields=JSON.stringify({active_workers: [...], mcp_empty_count: N}))`. Also write `{SESSION_DIR}state.md` as a snapshot.
- **With cortex_available = false**: write `{SESSION_DIR}state.md` only.
Also append the health events from this pass to `{SESSION_DIR}log.md`.
```

**Also update** the event-driven mode Step 4 write (line 1736):

```
4. **Write session state** after processing events and completing stuck checks.
   - **With cortex_available = true**: call `update_session()` with current active_workers
     summary. Also write `{SESSION_DIR}state.md` as snapshot.
   - **With cortex_available = false**: write `{SESSION_DIR}state.md` only.
```

**Why**: Supervisors persisting state to the DB via `update_session()` means the session
context survives a compaction. After compaction, `get_session(session_id)` returns active
workers, counters, and config — no file read needed.
Evidence: `packages/mcp-cortex/src/index.ts:100-121` (get_session/update_session)

---

### Step 7 — auto-pilot SKILL.md: Replace Step 7 completion (read + write)

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `### Step 7: Handle Completions` (lines 1804-1900)

#### 7a: Replace state read in 7a (currently reads status file)

**Find**:
```
**7a. Read current task state:** Read `task-tracking/TASK_YYYY_NNN/status` for the task (trim whitespace). If the `status` file is missing, fall back to reading the registry row for this task and log a warning.
```

**Replace with**:
```
**7a. Read current task state:**

- **With cortex_available = true**: Call `get_tasks(status=undefined)` filtered by task_id,
  OR use the cached task list from Step 2's `get_tasks()` result — find the row whose
  task_id matches. Use the `status` field from that row as the current state.
  As a belt-and-suspenders check, also read `task-tracking/TASK_YYYY_NNN/status` file.
  If both are present and differ, the file takes precedence (workers write the file as their
  last action; DB is updated concurrently by update_task but the file is authoritative for
  final state detection in this version).
- **With cortex_available = false**: Read `task-tracking/TASK_YYYY_NNN/status` (trim
  whitespace). If the file is missing, fall back to reading the registry row and log a warning.
```

#### 7b: Add update_task call for BLOCKED writes

**Find all three locations** in Step 7 where `BLOCKED` is written to the status file:
1. Line 1796: `Write \`BLOCKED\` to \`task-tracking/TASK_YYYY_NNN/status\``  (retry limit exceeded in two-strike detection)
2. Line 1893: `Write \`BLOCKED\` to \`task-tracking/TASK_YYYY_NNN/status\`` (retry limit exceeded in 7e)
3. In Step 3 dependency validation (lines 1405-1413): `Write \`BLOCKED\` to \`task-tracking/TASK_YYYY_NNN/status\`` for missing dep, cancelled dep, and cycle detection

For each location, add a cortex-path companion after the file write:

```
- Write `BLOCKED` to `task-tracking/TASK_YYYY_NNN/status` (file write — required for watchers)
- With cortex_available = true: also call `update_task(task_id, fields=JSON.stringify({status: "BLOCKED"}))` to sync DB state
```

#### 7c: Replace release_task call in completion handling

**Find Step 7d** — the "IF state transitioned to expected end state" section (line 1825).

After every validated state transition (IMPLEMENTED, COMPLETE), add release_task:

After the existing log entry for each terminal transition, add:

```
- **With cortex_available = true**: call `release_task(task_id, new_status)` where
  `new_status` matches the confirmed new state (e.g., "IMPLEMENTED" or "COMPLETE").
  This releases the claim and updates the DB atomically.
  If `release_task` fails: log `"RELEASE FAILED — TASK_X: {error}"` and continue.
  The status file is the authoritative state — a DB sync failure is non-fatal.
```

**Why**: `release_task()` clears the claim and sets the final status in the DB, making the
task visible to future `get_next_wave()` calls in subsequent loop iterations.
Evidence: `packages/mcp-cortex/src/index.ts:53-59` (release_task schema)

---

### Step 8 — auto-pilot SKILL.md: Replace state.md compaction recovery with get_session

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `**Compaction recovery bootstrap**:` (lines 1354-1362)

**Find**:
```
**Compaction recovery bootstrap**: After a compaction, `SESSION_DIR` is lost from memory.
To recover:
1. Read `task-tracking/active-sessions.md`
2. Find the row matching source `auto-pilot` and the startup timestamp that matches when this session began
3. Extract the `Path` column — this is `SESSION_DIR`
4. Read `{SESSION_DIR}state.md` to restore full supervisor state
5. Reset `mcp_empty_count` to 0 (a fresh `list_workers` call will determine current MCP state — do not carry over a stale count from before the compaction). If `mcp_empty_count` is missing from the restored state, treat it as 0.

If `active-sessions.md` is missing or the row is not found, scan `task-tracking/sessions/` for directories matching `SESSION_{YYYY-MM-DD}_{HH-MM-SS}` and select the most recently created one.
```

**Replace with**:
```
**Compaction recovery bootstrap**: After a compaction, `SESSION_DIR` and session state are
lost from the supervisor's context window.

**Preferred path (cortex_available = true):**

1. The supervisor knows its `session_id` (it was set at startup and written into the first
   log entry before any compaction risk). After compaction, `session_id` appears in
   `task-tracking/active-sessions.md` and in `{SESSION_DIR}log.md`.
2. Call `get_session(session_id)` to restore full session state: active workers, completed
   tasks, failed tasks, retry counters, config, mcp_empty_count.
3. Set `SESSION_DIR = task-tracking/sessions/{session_id}/` (derived from session_id — no
   file read needed).
4. Reset `mcp_empty_count` to 0 (a fresh `list_workers` call will determine current MCP
   state). If `mcp_empty_count` is in the session record, honor it only if > 0 would be
   confirmed by `list_workers`.

**Fallback path (cortex_available = false):**

1. Read `task-tracking/active-sessions.md`
2. Find the row matching source `auto-pilot` and the startup timestamp
3. Extract the `Path` column — this is `SESSION_DIR`
4. Read `{SESSION_DIR}state.md` to restore full supervisor state
5. Reset `mcp_empty_count` to 0.

If `active-sessions.md` is missing or the row is not found, scan `task-tracking/sessions/`
for directories matching `SESSION_{YYYY-MM-DD}_{HH-MM-SS}` and select the most recently
created one.
```

**Why**: The DB-backed session state via `get_session()` survives compaction because it
lives outside the context window. After compaction, `get_session(session_id)` restores
everything — no state.md read needed.
Evidence: `packages/mcp-cortex/src/index.ts:100-105` (get_session schema)

---

### Step 9 — auto-pilot SKILL.md: Add cortex availability check to MCP Requirement section

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Section**: `## MCP Requirement (MANDATORY — HARD FAIL)` (line 1132)

After the existing MCP Requirement text, append:

```
### nitro-cortex Availability Check (optional — soft check)

After MCP validation passes (spawn_worker confirmed available), check if nitro-cortex
tools are available:

1. Inspect the MCP tool list for `get_tasks`.
2. If present: set `cortex_available = true`. Log:
   `| {HH:MM:SS} | auto-pilot | CORTEX AVAILABLE — using nitro-cortex for task state |`
3. If absent: set `cortex_available = false`. Log:
   `| {HH:MM:SS} | auto-pilot | CORTEX UNAVAILABLE — falling back to file-based state |`

This is a **soft check** — the supervisor proceeds either way. cortex_available is a
session flag that controls which code path is used in Steps 2-7. It is NOT re-checked
per loop iteration.

> **Bootstrap note**: On first run against a new project, call `sync_tasks_from_files()`
> once to import existing task-tracking files into the nitro-cortex DB before calling
> `get_tasks()`. This only needs to run once (safe to re-run — upsert). After the initial
> sync, all subsequent state changes go through the MCP tools and the DB stays current.
```

Also add these two log row entries to the Session Log table:

```
| Cortex available | `\| {HH:MM:SS} \| auto-pilot \| CORTEX AVAILABLE — using nitro-cortex for task state \|` |
| Cortex unavailable | `\| {HH:MM:SS} \| auto-pilot \| CORTEX UNAVAILABLE — falling back to file-based state \|` |
```

---

### Step 10 — orchestration SKILL.md: Add update_task for IN_PROGRESS and IMPLEMENTED

**File**: `.claude/skills/orchestration/SKILL.md`

#### 10a: Build Worker Prompt — IN_PROGRESS write

**Section**: `### First-Run Build Worker Prompt` in auto-pilot SKILL.md (line 2199)

The IN_PROGRESS write lives in the Build Worker prompt template, NOT in orchestration
SKILL.md directly. The orchestration skill instructs the worker to write the status file.

**Locate** (in auto-pilot SKILL.md, line 2199-2201):
```
1. FIRST: Write task-tracking/TASK_YYYY_NNN/status with the single word
   IN_PROGRESS (no trailing newline). This signals the Supervisor that work has begun.
   Then call MCP emit_event(worker_id="{worker_id}", label="IN_PROGRESS", data={"task_id":"TASK_YYYY_NNN"}).
```

**Replace with**:
```
1. FIRST: Write task-tracking/TASK_YYYY_NNN/status with the single word
   IN_PROGRESS (no trailing newline). This signals the Supervisor that work has begun.
   Then call MCP emit_event(worker_id="{worker_id}", label="IN_PROGRESS", data={"task_id":"TASK_YYYY_NNN"}).
   If the nitro-cortex MCP server is available (get_tasks tool is in the tool list):
   also call update_task("TASK_YYYY_NNN", fields=JSON.stringify({status: "IN_PROGRESS"})).
   This is best-effort — if it fails, continue. The status file is the authoritative signal.
```

#### 10b: Build Worker Prompt — IMPLEMENTED write

**Locate** (in auto-pilot SKILL.md, line 2213-2214):
```
   c. Write task-tracking/TASK_YYYY_NNN/status with the single word IMPLEMENTED (no trailing newline). This is the FINAL action before exit.
   d. Commit the status file: `docs: mark TASK_YYYY_NNN IMPLEMENTED`
```

**Replace with**:
```
   c. Write task-tracking/TASK_YYYY_NNN/status with the single word IMPLEMENTED (no trailing
      newline). This is the FINAL action before exit.
      If the nitro-cortex MCP server is available:
      also call update_task("TASK_YYYY_NNN", fields=JSON.stringify({status: "IMPLEMENTED"})).
      Best-effort — if it fails, continue. The status file is authoritative.
   d. Commit the status file: `docs: mark TASK_YYYY_NNN IMPLEMENTED`
```

Do the same replacement in **Retry Build Worker Prompt** (line 2274 onwards) where the
identical IN_PROGRESS and IMPLEMENTED instructions appear.

#### 10c: Orchestration SKILL.md — Phase Event Emission table

**File**: `.claude/skills/orchestration/SKILL.md`
**Section**: `### Phase Event Emission (Supervisor Telemetry)` (lines 366-391)

After the existing emit table:
```
| `status` written as `IN_PROGRESS` | `IN_PROGRESS` | `{ "task_id": "TASK_XXX" }` |
...
| `status` written as `IMPLEMENTED` | `IMPLEMENTED` | `{ "task_id": "TASK_XXX" }` |
```

**Add a new note immediately after the table**:
```
**nitro-cortex companion writes** (Supervisor mode only, best-effort):
After writing the status file for IN_PROGRESS and IMPLEMENTED transitions, if the
nitro-cortex `update_task` tool is available:
- Call `update_task(task_id, fields=JSON.stringify({status: "IN_PROGRESS"}))` after the
  IN_PROGRESS file write.
- Call `update_task(task_id, fields=JSON.stringify({status: "IMPLEMENTED"}))` after the
  IMPLEMENTED file write.
These calls are fire-and-forget. If the tool is unavailable or returns an error, log a
warning and continue. Never let update_task failure interrupt orchestration.
```

#### 10d: Orchestration SKILL.md — Session setup: add update_session

**Section**: `### Session Directory Setup (run once, on skill entry)` (lines 322-337)

After step 5 (Register in active-sessions.md), add:

```
6a. **nitro-cortex session registration (Supervisor mode only, best-effort)**:
    If running as a Build Worker (WORKER_ID: line present in prompt) AND nitro-cortex
    `update_session` tool is available:
    - The session_id was created by the Supervisor via `create_session()` before spawning
      this worker. The session already exists in the DB.
    - Call `update_session(session_id, fields=JSON.stringify({loop_status: "running"}))` to
      confirm this worker's session is active.
    - If unavailable or error: log warning and continue.
```

---

### Step 11 — CLI: Add nitro-cortex entry builder to mcp-setup-guide.ts

**File**: `apps/cli/src/utils/mcp-setup-guide.ts`

After the existing `buildMcpConfigEntry(serverPath)` function (line 43-53), add:

```typescript
export function buildNitroCortexConfigEntry(serverPath: string): Record<string, unknown> {
  return {
    mcpServers: {
      'nitro-cortex': {
        type: 'stdio',
        command: 'node',
        args: [resolve(serverPath, 'dist', 'index.js')],
      },
    },
  };
}
```

**Why**: Parallel to `buildMcpConfigEntry` — same pattern for the new server.
Evidence: `apps/cli/src/utils/mcp-setup-guide.ts:43-53` (existing builder pattern)

---

### Step 12 — CLI: Add configureMcp support for nitro-cortex in mcp-configure.ts

**File**: `apps/cli/src/utils/mcp-configure.ts`

Add import at top:
```typescript
import { buildMcpConfigEntry, buildNitroCortexConfigEntry } from './mcp-setup-guide.js';
```
(Replace existing import that only imports `buildMcpConfigEntry`.)

After the existing `configureMcp` function (line 44-87), add:

```typescript
export async function configureNitroCortex(
  cwd: string,
  serverPath: string,
  location: 'project' | 'global'
): Promise<boolean> {
  const expandedPath = expandTilde(serverPath);
  const resolvedServerPath = resolve(expandedPath);

  if (!existsSync(resolvedServerPath)) {
    console.error(`Error: Directory not found: ${resolvedServerPath}`);
    return false;
  }

  let realPath: string;
  try {
    realPath = realpathSync(resolvedServerPath);
  } catch {
    console.error(`Error: Could not resolve path: ${resolvedServerPath}`);
    return false;
  }

  const entryPoint = resolve(realPath, 'dist', 'index.js');
  if (!existsSync(entryPoint)) {
    console.error(`Error: nitro-cortex entry point not found at ${entryPoint}`);
    console.error('Make sure nitro-cortex is built (npm run build).');
    return false;
  }

  const mcpEntry = buildNitroCortexConfigEntry(realPath);

  const targetPath = location === 'project'
    ? resolve(cwd, '.mcp.json')
    : resolve(homedir(), '.claude.json');

  const success = mergeJsonFile(targetPath, mcpEntry);
  if (success) {
    console.log(`  MCP nitro-cortex configured in ${targetPath}`);
  }
  return success;
}
```

Note: `mergeJsonFile` and `expandTilde` are module-private helpers already defined in the
file. `configureNitroCortex` uses the same pattern as `configureMcp` — no duplication.
Evidence: `apps/cli/src/utils/mcp-configure.ts:13-42` (mergeJsonFile helper)

---

### Step 13 — CLI: Update init.ts to configure nitro-cortex

**File**: `apps/cli/src/commands/init.ts`

#### 13a: Add nitro-cortex MCP flag

In the `InitFlags` interface (line 21-27), add:
```typescript
'cortex-path': string | undefined;
'skip-cortex': boolean;
```

In the `flags` static definition (lines 361-368), add:
```typescript
'cortex-path': Flags.string({ description: 'Path to nitro-cortex server (packages/mcp-cortex in this repo)' }),
'skip-cortex': Flags.boolean({ description: 'Skip nitro-cortex MCP configuration', default: false }),
```

#### 13b: Add handleNitroCortexConfig function

After `handleMcpConfig` (line 231-266), add:

```typescript
async function handleNitroCortexConfig(cwd: string, opts: InitFlags): Promise<void> {
  if (opts['skip-cortex']) {
    console.log('MCP nitro-cortex: skipped (--skip-cortex)');
    return;
  }

  // Check if already configured
  // (detect by checking .mcp.json or ~/.claude.json for 'nitro-cortex' key)
  const projectMcp = resolve(cwd, '.mcp.json');
  if (existsSync(projectMcp)) {
    try {
      const cfg = JSON.parse(readFileSync(projectMcp, 'utf-8')) as Record<string, unknown>;
      const servers = (cfg['mcpServers'] ?? {}) as Record<string, unknown>;
      if ('nitro-cortex' in servers) {
        console.log('MCP nitro-cortex: already configured');
        return;
      }
    } catch {
      // parse error — fall through to configure
    }
  }

  let serverPath = opts['cortex-path'];
  if (serverPath === undefined) {
    serverPath = await prompt('Path to nitro-cortex directory (or press Enter to skip): ');
    if (serverPath === '') {
      console.log('Skipping nitro-cortex configuration. Configure manually later.');
      return;
    }
  }

  const locationAnswer = opts.yes
    ? 'project'
    : await prompt('Configure nitro-cortex globally or per-project? (global/project) [project]: ');
  const location: 'project' | 'global' = locationAnswer === 'global' ? 'global' : 'project';

  const success = await configureNitroCortex(cwd, serverPath, location);
  if (!success) {
    console.error('nitro-cortex configuration failed. You can configure it manually later.');
  }
}
```

Also add `import { readFileSync } from 'node:fs';` to the fs import (line 1) and
add `import { configureNitroCortex } from '../utils/mcp-configure.js';` to the imports.

#### 13c: Call handleNitroCortexConfig in the run() method

In `run()`, after `await handleMcpConfig(cwd, opts);` (line 490), add:

```typescript
// Step 10b: nitro-cortex configuration
await handleNitroCortexConfig(cwd, opts);
```

---

### Step 14 — Create apps/cli/scaffold/.claude/settings.json

**File**: `apps/cli/scaffold/.claude/settings.json`
**Action**: CREATE

This file is copied into every new project by `scaffoldFiles()` (init.ts line 74-124
copies `.claude/` subdirectories). It pre-configures the Claude Code harness to trust
nitro-cortex MCP permissions.

**Content**:
```json
{
  "mcpServers": {
    "nitro-cortex": {
      "type": "stdio",
      "command": "node",
      "args": ["{{NITRO_CORTEX_PATH}}/dist/index.js"]
    }
  },
  "permissions": {
    "allow": [
      "mcp__nitro-cortex__get_tasks",
      "mcp__nitro-cortex__claim_task",
      "mcp__nitro-cortex__release_task",
      "mcp__nitro-cortex__update_task",
      "mcp__nitro-cortex__get_next_wave",
      "mcp__nitro-cortex__sync_tasks_from_files",
      "mcp__nitro-cortex__create_session",
      "mcp__nitro-cortex__get_session",
      "mcp__nitro-cortex__update_session",
      "mcp__nitro-cortex__list_sessions",
      "mcp__nitro-cortex__end_session",
      "mcp__nitro-cortex__spawn_worker",
      "mcp__nitro-cortex__list_workers",
      "mcp__nitro-cortex__get_worker_stats",
      "mcp__nitro-cortex__get_worker_activity",
      "mcp__nitro-cortex__kill_worker",
      "mcp__nitro-cortex__subscribe_worker",
      "mcp__nitro-cortex__get_pending_events"
    ]
  }
}
```

**Note for developer**: The `args` path uses a placeholder `{{NITRO_CORTEX_PATH}}` that
the user or the init CLI replaces at project setup time. The permissions block pre-authorizes
all nitro-cortex tools so agents are not interrupted by permission prompts during autonomous
runs. If a project does not use nitro-cortex, this file is harmless (the server is simply
absent from the MCP runtime).

---

## Backward Compatibility

All nitro-cortex calls are additive and guarded by `cortex_available`. The file-based
fallback remains intact for setups without nitro-cortex:

| Scenario | Behavior |
|----------|----------|
| nitro-cortex not configured | `cortex_available = false`, full file-based operation |
| nitro-cortex configured but DB empty | `sync_tasks_from_files()` called once at bootstrap |
| nitro-cortex partially available | Graceful per-tool fallback where possible |
| nitro-cortex returns error mid-session | Log warning, continue with file-based path |

**Status files continue to be written** in all cases. The status file is still the
authoritative signal for `subscribe_worker` watchers and for the Review Lead / Build
Worker exit gates. The DB is a supplementary fast path.

---

## Risk Areas

### Risk 1: Large file edits (auto-pilot SKILL.md is ~3270 lines)
The developer MUST use targeted `Edit` tool calls with precise old_string/new_string pairs,
not full rewrites. Read the exact text of each section before editing. After each edit,
verify the surrounding context is intact.

**Mitigation**: Each Step above specifies the exact text to find and the replacement. Test
each edit individually.

### Risk 2: TASK_2026_107 and TASK_2026_112 conflict
Both tasks touch auto-pilot SKILL.md. This task should run in Wave 3, after both complete.
If running sequentially after 107/112, the developer must read the current state of SKILL.md
(not assume it matches the snapshot used during architecture) before applying each edit.

**Mitigation**: Each edit is a precise string replacement. If the surrounding context has
changed, the developer reads the new context and adjusts the old_string to match. The
semantic intent of each change is documented in this plan regardless of surrounding text.

### Risk 3: get_next_wave atomicity assumption
If `get_next_wave()` is called and `claim_task()` is also called in 5e-pre for the fallback
path, there is a risk of double-claiming. The plan guards against this: `claim_task()` in
5e-pre is explicitly skipped when `get_next_wave()` was used in Step 4.

**Mitigation**: The cortex path decision point is made once per task (in Step 4), and the
skip condition in 5e-pre explicitly covers this case.

### Risk 4: Status file remains authoritative for watchers
The `subscribe_worker` conditions watch status files on disk. If workers only call
`update_task()` and skip the file write, watchers will not fire. The plan preserves all
file writes and adds `update_task()` as a companion — never a replacement.

**Mitigation**: Every status write in worker prompts and supervisor steps retains the file
write. `update_task()` is always `also call` — never `instead call`.

### Risk 5: settings.json path placeholder
The `{{NITRO_CORTEX_PATH}}` placeholder in scaffold settings.json will not work as-is —
it is a template token that the init CLI must replace at configure time or the user must
edit manually.

**Mitigation**: Document clearly in the settings.json that the path must be replaced. The
init step (Step 13) adds interactive prompting for the cortex path. Alternatively, the
permissions block without the mcpServers block could be the scaffold value, with mcpServers
written dynamically by init. The developer should decide which approach is cleaner during
implementation and update accordingly.

---

## Acceptance Criteria Mapping

| Acceptance Criterion | Satisfied By |
|----------------------|--------------|
| Auto-pilot core loop makes zero direct `registry.md` or `status` file reads for task state | Step 1 (Step 2 → get_tasks) + Step 2 (Step 3 → deps from get_tasks response) |
| `get_next_wave()` replaces Steps 2–4 of the supervisor loop | Step 4 (Step 4 replacement) |
| Step 3d removed from SKILL.md — cross-session safety handled by `claim_task()` atomicity | Step 3 (Step 3d replacement) |
| Supervisor state survives compaction via `get_session()` — no `state.md` read needed | Step 5b (update_session after spawn) + Step 6 (get_session for monitoring state) + Step 8 (get_session compaction recovery) |
| Build Workers write status transitions via `update_task()` not file writes | Step 10a (IN_PROGRESS) + Step 10b (IMPLEMENTED) — note: file writes are retained, update_task is added as companion |
| CLI `init` configures nitro-cortex in the generated `.claude/settings.json` | Step 13 (init.ts) + Step 14 (scaffold settings.json) |
| End-to-end auto-pilot session runs cleanly using nitro-cortex tools | Verified when all above steps are complete and a test run is performed |

---

## Developer Handoff

**Recommended Developer**: nitro-systems-developer (orchestration skill editing + TypeScript CLI)
**Complexity**: Complex — large file edits, additive pattern with dual-path logic
**Estimated Effort**: 4-6 hours

### Editing Order (safe sequence)

1. Read SKILL.md Step 2 section fresh → apply Step 1 of this plan
2. Read SKILL.md Step 3 section fresh → apply Step 2 of this plan
3. Read SKILL.md Step 3d section fresh → apply Step 3 of this plan
4. Read SKILL.md Step 4 section fresh → apply Step 4 of this plan
5. Read SKILL.md Step 5e area fresh → apply Step 5a of this plan
6. Read SKILL.md Step 5h line fresh → apply Step 5b of this plan
7. Read SKILL.md Step 6 areas fresh → apply Step 6 of this plan
8. Read SKILL.md Step 7a fresh → apply Step 7a of this plan
9. Read SKILL.md BLOCKED write locations → apply Step 7b
10. Read SKILL.md Step 7d fresh → apply Step 7c
11. Read SKILL.md compaction bootstrap section → apply Step 8
12. Read SKILL.md MCP Requirement section → apply Step 9
13. Read orchestration SKILL.md Phase Event Emission → apply Step 10
14. Read mcp-setup-guide.ts → apply Step 11
15. Read mcp-configure.ts → apply Step 12
16. Read init.ts → apply Step 13
17. Create settings.json → apply Step 14

**Critical rule**: Always read the current text of a section before editing it. The file
may have changed since this plan was written (TASK_2026_107/112 may have run).
