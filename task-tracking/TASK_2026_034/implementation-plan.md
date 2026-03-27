# Implementation Plan — TASK_2026_034
# Session-Scoped State Directories with Unified Event Log

## Codebase Investigation Summary

### Files Analyzed

- `.claude/skills/auto-pilot/SKILL.md` (lines 1-969) — supervisor startup, state file, session log, all step logic
- `.claude/skills/orchestration/SKILL.md` (lines 1-300) — orchestration phases, phase detection table
- `task-tracking/orchestrator-state.md` — existing single-file state (to be relocated)
- `task-tracking/orchestrator-history.md` — append-only history (unchanged)

### Current State Observations

**Evidence: auto-pilot/SKILL.md:163-169** — Concurrent Session Guard reads/writes a single
`orchestrator-state.md`. Both sessions would clobber each other.

**Evidence: auto-pilot/SKILL.md:177** — Step 1 reads `task-tracking/orchestrator-state.md` (root path).

**Evidence: auto-pilot/SKILL.md:347-348, 404, 477** — Steps 5f, 6e, 8 write
`orchestrator-state.md` (root path). Three separate write points all need updating.

**Evidence: auto-pilot/SKILL.md:82-123** — Session Log section appends timestamped entries
to `orchestrator-state.md` with only a `Timestamp` and `Event` column. No `Source` column exists.

**Evidence: auto-pilot/SKILL.md:801-803** — `orchestrator-state.md Format` section documents
the file at `task-tracking/orchestrator-state.md` root path.

**Evidence: auto-pilot/SKILL.md:861-877** — Session Log example table has two columns only:
`| Timestamp | Event |`. No Source column.

**Evidence: orchestration/SKILL.md:1-300** — No logging to any state or log file. Phase
transitions produce no persistent audit trail.

**Evidence: auto-pilot/SKILL.md:483-515** — Step 8b appends to `orchestrator-history.md`,
copies the Session Log from `orchestrator-state.md` (this path is also affected).

---

## Architecture Design

### Design Philosophy

Replace the single `task-tracking/orchestrator-state.md` with per-session directories under
`task-tracking/sessions/SESSION_{timestamp}/`. Each session gets its own isolated `state.md`
and a unified `log.md`. A shared `active-sessions.md` at the root provides a live registry of
running sessions, solving the concurrent-session collision problem. The orchestration skill
adds log writes at phase transitions using the same `log.md` format with source `orchestrate`.

The `orchestrator-history.md` and its append-only contract are completely unchanged.

### Session Directory Naming Convention

```
SESSION_{YYYY-MM-DD}_{HH-MM}
```

Example: `SESSION_2026-03-24_22-00`

Timestamp is captured at startup (wall clock, local time). If two sessions start in the
same minute, the second one reads the existing directory — they should not collide because
the orchestration skill reuses a session directory if it starts within an existing minute
(see Session Lifecycle rules below).

---

## Component Specifications

### Component 1: Session Directory Lifecycle (auto-pilot)

**Purpose**: Create the session directory on startup, register in `active-sessions.md`,
deregister on stop. Replaces the old single-file creation.

**New section to ADD in auto-pilot/SKILL.md** — insert immediately before "## Concurrent Session Guard"
(currently at line 159):

---

```markdown
## Session Directory

On startup, the supervisor creates a session-scoped directory for all state and log output.

**Directory path**: `task-tracking/sessions/SESSION_{YYYY-MM-DD}_{HH-MM}/`

Timestamp is the wall-clock start time (local time, zero-padded). Example:
`task-tracking/sessions/SESSION_2026-03-24_22-00/`

### Files inside the session directory

| File | Written by | Purpose |
|------|-----------|---------|
| `state.md` | auto-pilot | Live supervisor state (workers, queues, config). Full overwrite on every update. |
| `log.md` | auto-pilot + orchestration skill | Unified event log. Append-only. All orchestration paths write here. |
| `analytics.md` | TASK_032 (future) | Post-session analytics. Not created by this task. |
| `worker-logs/` | (future) | Per-worker log files. Not created by this task. |

### Session Lifecycle

**On startup**:

1. Compute `SESSION_ID = SESSION_{YYYY-MM-DD}_{HH-MM}` using current timestamp.
2. Create directory `task-tracking/sessions/{SESSION_ID}/` (mkdir, no-op if exists).
3. Create `task-tracking/sessions/{SESSION_ID}/log.md` with header if it does not already exist:
   ```markdown
   # Session Log — {SESSION_ID}

   | Timestamp | Source | Event |
   |-----------|--------|-------|
   ```
4. Append first log entry to `log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STARTED — {N} tasks, {N} unblocked, concurrency {N} |`
5. Register in `task-tracking/active-sessions.md` (append row — see Active Sessions File section).
6. Store `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/` as the working path for all
   subsequent state and log writes. Every reference to `orchestrator-state.md` in this skill
   means `{SESSION_DIR}state.md`.

**On stop** (normal completion, compaction limit, MCP unreachable, manual):

1. Write final `{SESSION_DIR}state.md` with `Loop Status: STOPPED`.
2. Append final log entry to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | auto-pilot | SUPERVISOR STOPPED — {completed} completed, {failed} failed, {blocked} blocked |`
3. Remove this session's row from `task-tracking/active-sessions.md`.
4. Proceed to Step 8b (append to `orchestrator-history.md`) as before.
```

---

### Component 2: Updated Concurrent Session Guard (auto-pilot)

**Purpose**: Check `active-sessions.md` instead of reading a single `orchestrator-state.md`.
Multiple sessions can coexist; the guard now warns if any session is already RUNNING rather
than blocking on a single file.

**Modify existing section** "## Concurrent Session Guard" (currently lines 159-169 in
auto-pilot/SKILL.md). Replace the entire section with:

---

```markdown
## Concurrent Session Guard

On startup, **after MCP validation passes, before entering the loop**:

1. Read `task-tracking/active-sessions.md` (if it exists).
2. If any row with Source `auto-pilot` is present:
   - Log: `"WARNING: Another supervisor session may still be running: {SESSION_ID}"`
   - Ask the user to confirm with `--force` flag, or abort.
   - If `--force` provided, continue (the existing session row will remain until it cleans
     up; this session will run concurrently at its own `SESSION_DIR`).
3. Proceed to Session Directory startup (create dir, register in active-sessions.md).
```

---

### Component 3: Updated Step 1 — Read State (auto-pilot)

**Purpose**: Read state from `{SESSION_DIR}state.md` instead of root `orchestrator-state.md`.
The change is purely a path substitution.

**Modify existing section** "### Step 1: Read State (Recovery Check)" (currently lines 175-198
in auto-pilot/SKILL.md). Change the two path references:

- Line 177: `task-tracking/orchestrator-state.md` → `{SESSION_DIR}state.md`
- Line 196: `no state file` branch text is still accurate — on a fresh startup there is no
  `state.md` in the new session directory, so this branch fires correctly for new sessions.

Also add one sentence after the existing reconciliation logic (end of the `IF` branch):

> **Compaction recovery note**: After a compaction, `SESSION_DIR` must be re-derived from the
> session timestamp stored in `state.md` (`Session Started` field). The supervisor re-reads
> `{SESSION_DIR}state.md` and restores `SESSION_DIR` from the stored path before continuing.

The `## Compaction Count` field in `state.md` already provides the compaction survival anchor.
The `Session Started` timestamp in `state.md` uniquely identifies the session directory.

---

### Component 4: Updated Step 5f, 6e, 8 — Write State (auto-pilot)

**Purpose**: All three state-write points use `{SESSION_DIR}state.md` instead of root path.

**Modify three existing lines** in auto-pilot/SKILL.md:

**Step 5f** (currently line 356):
- Old text: `Write \`orchestrator-state.md\` after **each** successful spawn`
- New text: `Write \`{SESSION_DIR}state.md\` after **each** successful spawn`

**Step 6e** (currently line 404):
- Old text: `Write \`orchestrator-state.md\` after monitoring pass.`
- New text: `Write \`{SESSION_DIR}state.md\` after monitoring pass. Also append the health
  events from this pass to \`{SESSION_DIR}log.md\`.`

**Step 8** termination table (currently line 477):
- Old text: `Write final \`orchestrator-state.md\` with \`loop_status: STOPPED\``
- New text: `Write final \`{SESSION_DIR}state.md\` with \`loop_status: STOPPED\``

---

### Component 5: Updated Session Log Section (auto-pilot)

**Purpose**: The existing "## Session Log" section describes appending to `orchestrator-state.md`.
It must be updated to append to `{SESSION_DIR}log.md` with the new three-column format.

**Modify existing section** "## Session Log" (currently lines 82-123 in auto-pilot/SKILL.md).
Replace the opening paragraph and table header:

Old:
```markdown
The supervisor MUST maintain a session log in `orchestrator-state.md` under a `## Session Log`
section. Every significant event gets a timestamped entry. This is how you (and the user) know
what happened during the session.

**Events to log** (append one line per event):

| Event | Log Format |
|-------|-----------|
| Loop started | `[HH:MM:SS] SUPERVISOR STARTED — ...` |
```

New:
```markdown
The supervisor MUST append every significant event to `{SESSION_DIR}log.md`. This file uses a
three-column format shared with the orchestration skill. Every significant event gets a
timestamped row.

**Append one row per event** (do NOT use the `[HH:MM:SS]` bracket format — use the pipe-table row):

| Event | Log Row |
|-------|---------|
| Loop started | `\| {HH:MM:SS} \| auto-pilot \| SUPERVISOR STARTED — {N} tasks, {N} unblocked, concurrency {N} \|` |
```

The event list (Worker spawned, Worker healthy, State transitioned, etc.) keeps all the same
entries. Only the format changes from `[HH:MM:SS] EVENT` to a pipe-table row with the
`auto-pilot` source column inserted.

**Also update** the closing note (currently line 123):
- Old: `The log is part of \`orchestrator-state.md\` and survives compactions. Keep the last 100 entries max (trim older entries on write).`
- New: `The log lives at \`{SESSION_DIR}log.md\` and is **append-only** — never trim or overwrite it. The \`state.md\` file (in the same directory) is still fully overwritten on each update and holds the structured worker/queue tables. After compaction, restore context from \`state.md\`; the full event history lives in \`log.md\`.`

---

### Component 6: Updated orchestrator-state.md Format Section (auto-pilot)

**Purpose**: The format doc currently says the file lives at
`task-tracking/orchestrator-state.md`. Update to reflect new session-scoped location.
The `## Session Log` table inside `state.md` is removed — log entries move to `log.md`.

**Modify existing section** "## orchestrator-state.md Format" (currently lines 801-887
in auto-pilot/SKILL.md):

1. Update the opening line (line 803):
   - Old: `Written to \`task-tracking/orchestrator-state.md\`.`
   - New: `Written to \`{SESSION_DIR}state.md\` (e.g., \`task-tracking/sessions/SESSION_2026-03-24_22-00/state.md\`).`

2. Add one field to the file header block — add `Session Directory` after `Session Started`:
   ```markdown
   **Session Directory**: task-tracking/sessions/SESSION_2026-03-24_22-00/
   ```

3. Remove the `## Session Log` table from the `state.md` format example (lines 861-877).
   Log entries now live in `log.md`, not in `state.md`. The `state.md` ends after
   `**Compaction Count**: 0`.

4. Add a new sub-section immediately after the state.md format block:

```markdown
### log.md Format

Written to `{SESSION_DIR}log.md`. Append-only — never overwrite. Created on session startup
with the header row, then one row appended per event.

```markdown
# Session Log — SESSION_2026-03-24_22-00

| Timestamp | Source | Event |
|-----------|--------|-------|
| 10:00:00 | auto-pilot | SUPERVISOR STARTED — 6 tasks, 3 unblocked, concurrency 3 |
| 10:00:05 | auto-pilot | SPAWNED abc-123 for TASK_2026_003 (Build: FEATURE) |
| 10:05:00 | orchestrate | PM phase complete for TASK_2026_010 |
| 10:10:00 | auto-pilot | HEALTH CHECK — TASK_2026_003: healthy |
| 10:15:00 | orchestrate | Architect phase complete for TASK_2026_010 |
| 10:20:00 | auto-pilot | STATE TRANSITIONED — TASK_2026_003: IN_PROGRESS -> IMPLEMENTED |
```
```

5. Update the "Key design properties" note (lines 881-886):
   - Add: `**Split state/log**: \`state.md\` is fully overwritten on each update (structured tables). \`log.md\` is append-only (human-readable event stream). Keep them separate.`
   - Remove the old compaction note about the Session Log surviving compactions (it was in `state.md`; it now survives in the always-growing `log.md`).

---

### Component 7: Step 8b — Append to Session History (auto-pilot)

**Purpose**: Step 8b copies the Session Log from `orchestrator-state.md`. Update to read
from `{SESSION_DIR}log.md` instead.

**Modify existing section** "### Step 8b: Append to Session History" (lines 481-515):

- The instruction at line 511 reads: `{copy full Session Log from orchestrator-state.md}`
- Change to: `{copy full event table from {SESSION_DIR}log.md}`

The `## Event Log` block in the history entry should omit the `Source` column since the
history is already scoped to one session. Format in history:

```markdown
### Event Log

| Time | Event |
|------|-------|
| 10:00:00 | SUPERVISOR STARTED — 6 tasks, 3 unblocked, concurrency 3 |
```

(Drop the `Source` column — it adds noise in the history where source is already implied.)

---

### Component 8: Active Sessions File Format (new file)

**Purpose**: Live registry of currently RUNNING sessions. Written by auto-pilot on startup
(append row) and cleaned on stop (remove row). Also written by orchestration skill when it
creates a session.

**New file**: `task-tracking/active-sessions.md`

Format:

```markdown
# Active Sessions

| Session | Source | Started | Tasks | Path |
|---------|--------|---------|-------|------|
| SESSION_2026-03-24_22-00 | auto-pilot | 22:00 | 14 | task-tracking/sessions/SESSION_2026-03-24_22-00/ |
| SESSION_2026-03-24_22-05 | orchestrate | 22:05 | 1 | task-tracking/sessions/SESSION_2026-03-24_22-05/ |
```

**Write rules**:

- On session start: read the file, append the row, write back.
- On session stop: read the file, remove the matching `Session` row, write back.
- If the file does not exist on first startup, create it with the header and first row.
- The `Tasks` column: for auto-pilot, the count of tasks being processed this session.
  For orchestrate, always `1` (single-task workflow).
- This file is NOT append-only — it reflects live state only. Completed sessions are removed.

**Error handling**: If writing `active-sessions.md` fails (permissions, lock), log a warning
and continue. The guard is advisory — it does not gate progress.

---

### Component 9: Session Logging in Orchestration Skill (orchestration/SKILL.md)

**Purpose**: The orchestration skill currently writes nothing to any session-level log.
Add a Session Logging section that creates/reuses a session directory and appends phase
transition events to `log.md` with source `orchestrate`.

**New section to ADD** in orchestration/SKILL.md — insert immediately before "## Error Handling"
(currently around line 207):

---

```markdown
## Session Logging

The orchestration skill MUST maintain a session-scoped event log so that direct `/orchestrate`
invocations are visible in the same audit trail as auto-pilot-spawned workers.

### Session Directory Setup (run once, on skill entry)

1. Compute `SESSION_ID = SESSION_{YYYY-MM-DD}_{HH-MM}` using the current wall-clock time.
2. Set `SESSION_DIR = task-tracking/sessions/{SESSION_ID}/`.
3. Create `{SESSION_DIR}` if it does not exist (mkdir, no-op if exists).
4. Create `{SESSION_DIR}log.md` with header if it does not already exist:
   ```markdown
   # Session Log — {SESSION_ID}

   | Timestamp | Source | Event |
   |-----------|--------|-------|
   ```
5. Register in `task-tracking/active-sessions.md` (append row with source `orchestrate`,
   Tasks `1`, path `{SESSION_DIR}`).
6. Append startup entry to `{SESSION_DIR}log.md`:
   `| {HH:MM:SS} | orchestrate | STARTED TASK_{ID} ({task_type}) |`

On finish (after Completion Phase bookkeeping commit):

1. Append final entry:
   `| {HH:MM:SS} | orchestrate | FINISHED TASK_{ID} — {COMPLETE | FAILED} |`
2. Remove this session's row from `task-tracking/active-sessions.md`.

### Phase Transition Log Entries

Append one row to `{SESSION_DIR}log.md` after each phase completes. Use the exact formats
below.

| Phase | Log Row |
|-------|---------|
| PM complete | `\| {HH:MM:SS} \| orchestrate \| PM phase complete for TASK_{ID} \|` |
| Architect complete | `\| {HH:MM:SS} \| orchestrate \| Architect phase complete for TASK_{ID} \|` |
| Team-Leader batch assigned | `\| {HH:MM:SS} \| orchestrate \| Batch {N} assigned for TASK_{ID} \|` |
| Dev batch complete | `\| {HH:MM:SS} \| orchestrate \| Batch {N} complete for TASK_{ID} \|` |
| All batches complete | `\| {HH:MM:SS} \| orchestrate \| All dev batches complete for TASK_{ID} \|` |
| QA started | `\| {HH:MM:SS} \| orchestrate \| QA started for TASK_{ID} \|` |
| QA complete | `\| {HH:MM:SS} \| orchestrate \| QA complete for TASK_{ID} \|` |
| Completion phase done | `\| {HH:MM:SS} \| orchestrate \| Completion phase done for TASK_{ID} — COMPLETE \|` |

**Log writes are best-effort**: If a write fails, log a warning to the user and continue.
Never let log failure interrupt orchestration.

**In Build Worker / Review Worker sessions** (spawned by auto-pilot): The worker runs
`/orchestrate TASK_X` which invokes this skill. The skill will create a new `SESSION_ID`
for the worker's own session. This is intentional — each worker gets its own session
directory and log. The auto-pilot session's log tracks spawning/monitoring; the worker's
own log tracks phase-level progress.
```

---

## Migration

### What Changes

| Item | Change |
|------|--------|
| `task-tracking/orchestrator-state.md` | No longer created. Existing file left in place (will be stale). |
| `task-tracking/sessions/` | New directory. Created automatically on first session startup. |
| `task-tracking/active-sessions.md` | New file. Created on first session startup. |
| `task-tracking/orchestrator-history.md` | Unchanged. Step 8b still appends to it. |

### Existing orchestrator-state.md

The existing `task-tracking/orchestrator-state.md` will remain on disk after this change is
deployed — it is simply no longer read or written. It can be deleted manually after verifying
the new session directories work correctly. No code deletes it automatically to avoid data
loss during the transition period.

### No Backward Compatibility Layer

There is no fallback to the old root `orchestrator-state.md`. Once deployed:

- auto-pilot reads ONLY from `{SESSION_DIR}state.md`
- orchestration writes ONLY to `{SESSION_DIR}log.md`
- The concurrent session guard reads ONLY `active-sessions.md`

---

## Files Affected

**MODIFY**:
- `.claude/skills/auto-pilot/SKILL.md`
- `.claude/skills/orchestration/SKILL.md`

**CREATE**:
- `task-tracking/active-sessions.md` (initial file, created programmatically on first run —
  but the format should be documented; optionally pre-create as an empty file with just the
  header to avoid the cold-start race)

**DELETE** (deferred, manual, after verification):
- `task-tracking/orchestrator-state.md`

---

## Quality Requirements

- Two auto-pilot supervisor sessions running concurrently MUST write to different `state.md`
  files and never interfere.
- `log.md` in a session directory MUST be append-only. No truncation, no full overwrite.
- `state.md` in a session directory MUST be fully overwritten on every update (existing
  "atomic overwrite" contract preserved, just at a new path).
- `active-sessions.md` rows MUST be removed on clean session stop. On crash recovery, stale
  rows are acceptable (they will be cleaned up on next successful session).
- The orchestration skill's log writes MUST NOT block or fail orchestration — best-effort only.
- `orchestrator-history.md` format is entirely unchanged.

---

## Team-Leader Handoff

### Developer Type Recommendation

**Recommended Developer**: backend-developer (markdown/text content changes — no code)

### Complexity Assessment

**Complexity**: MEDIUM
**Estimated Effort**: 2-3 hours

The changes touch two large markdown skill files with precise section-level edits. The logic
is straightforward (path substitution + new append-log operations) but the edit surface is
wide — 8 distinct sections across two files.

### Architecture Delivery Checklist

- [x] All components specified with evidence (file:line citations above)
- [x] All patterns verified from codebase (path patterns, table formats, log event formats)
- [x] No hallucinated APIs — only file I/O and existing markdown formatting
- [x] Quality requirements defined
- [x] Migration path defined (no backward compat layer)
- [x] Files affected list complete
- [x] Developer type recommended
- [x] Complexity assessed
- [x] No step-by-step implementation (team-leader's job)
