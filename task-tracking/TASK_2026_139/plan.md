# Implementation Plan — TASK_2026_139
# Supervisor DB Migration — remaining five pieces

## Scope

This plan covers only the five missing pieces from context.md. All other cortex DB paths
(Steps 1-7a/c/d/e, Step 3d removal, Step 2 registry, Step 4 queue, Step 5e-pre claim,
Step 5h state persist, Step 6 mcp_empty_count) are already documented in the reference files.

All changes are **documentation only** — .md skill/reference files that describe how the
supervisor behaves. No TypeScript, no unit tests.

---

## Change 1: Event logging via `log_event` + log.md render at session end

### What

Every supervisor log entry currently appends a row to `{SESSION_DIR}log.md` (file I/O on
every event). The cortex path calls `log_event()` in addition — making events queryable.
At session end, log.md is rendered from `query_events()` for the human audit trail.

### Affected file

`/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`

### Change type

**Additive** — insert new cortex sub-paths alongside the existing file-based logging
instructions. The file-based `log.md` append is kept as the primary human-readable format;
`log_event` is an additional parallel call.

### Location 1a — after the "Session Log" prose in SKILL.md

No change needed to SKILL.md for this; the log format description stays. The cortex note
belongs in `parallel-mode.md` where actual event-writing steps live, and in
`cortex-integration.md` as a new summary entry.

### Location 1b — `parallel-mode.md`, within "## Core Loop" after the existing log-append
instructions throughout Steps 1-7

Insert a single block **once** at the top of the Core Loop section (before Step 1) as a
standing rule, so it applies to every log entry without repeating it in each step:

**Insert after the existing Step 8d section** (end of the Core Loop), add a new subsection:

```
### Event Logging — Cortex Path

**Applies when `cortex_available = true`.**

Every time the supervisor would append a row to `{SESSION_DIR}log.md`, ALSO call:

  log_event(
    session_id = {session_id},
    task_id    = {task_id if event is task-scoped, else omit},
    source     = "auto-pilot",
    event_type = {EVENT_TYPE},    -- see table below
    data       = {structured payload, see table below}
  )

This call is best-effort — if it fails, log the failure inline in log.md and continue.
Never block on a log_event failure.

**Event type mapping** (log row → event_type → data):

| Log row contains            | event_type             | data keys                              |
|-----------------------------|------------------------|----------------------------------------|
| SUPERVISOR STARTED          | SUPERVISOR_START       | tasks_total, tasks_unblocked, concurrency |
| SPAWNED {worker_id}         | WORKER_SPAWN           | worker_id, worker_type, label          |
| STATE TRANSITIONED          | TASK_STATE_CHANGE      | old_state, new_state                   |
| NO TRANSITION               | WORKER_NO_TRANSITION   | expected_state, current_state, retry_n |
| RETRY                       | WORKER_RETRY           | attempt, retry_limit                   |
| BLOCKED — exceeded retries  | TASK_BLOCKED           | reason="max_retries"                   |
| BLOCKED — dependency cycle  | TASK_BLOCKED           | reason="cycle", with_task_id           |
| BLOCKED — cancelled dep     | TASK_BLOCKED           | reason="cancelled_dep", dep_task_id    |
| BLOCKED — missing dep       | TASK_BLOCKED           | reason="missing_dep", dep_task_id      |
| SUPERVISOR STOPPED          | SUPERVISOR_COMPLETE    | completed, failed, blocked             |
| CLAIM REJECTED              | CLAIM_REJECTED         | claimed_by (session id)                |
| Any other event             | SUPERVISOR_EVENT       | message (the log row Event column text)|

**NEED_INPUT signal** (escalate_to_user path only — see Change 3): a worker emits
`log_event(event_type='NEED_INPUT', data={question})`. The supervisor checks for this
at phase boundaries (see Change 3 for details).
```

### Location 1c — `parallel-mode.md`, Step 8b (Append to Session History)

After the existing step 2 (append session block to orchestrator-history.md), insert a
cortex sub-step **before** step 3 (Quality line computation):

```
**2b. Cortex path (cortex_available = true):**

Call:
  log_event(
    session_id = {session_id},
    source     = "auto-pilot",
    event_type = "SUPERVISOR_COMPLETE",
    data       = { completed: N, failed: N, blocked: N,
                   total_cost_usd: X.XX, stop_reason: "..." }
  )

This is best-effort — failure does not block Step 8b.
```

### Location 1d — `parallel-mode.md`, Step 8b, step 1 (the file-append step)

Modify step 1 to add the cortex log.md render path. After the existing "Read
task-tracking/orchestrator-history.md" instruction, insert:

```
**If cortex_available = true** (render log.md before appending history):

Before computing the Quality line, call:
  query_events(session_id={session_id})

Use the returned events to verify log.md is complete. If any returned events are NOT
already present as rows in `{SESSION_DIR}log.md` (matched by event_type and timestamp),
append the missing rows using the log-templates.md format. This ensures the human-readable
audit trail is authoritative.

The file-based `{SESSION_DIR}log.md` is still the primary audit trail — DB events are
additive. This render step only fills gaps (e.g., events missed during compaction).
```

### Location 1e — `cortex-integration.md`

Add a new section at the bottom of the file:

```
### Event Logging (all steps)

- **cortex path**: Alongside every `{SESSION_DIR}log.md` append, call
  `log_event(session_id, task_id?, source="auto-pilot", event_type, data?)`.
  Best-effort — failure never blocks the supervisor.
- **At session end**: call `query_events(session_id)` to render missing rows back into
  log.md before archiving (Step 8b sub-step 2b).
- **Event type mapping**: defined in `references/parallel-mode.md` under
  `### Event Logging — Cortex Path`.
- **fallback path**: log.md file append only (current behavior, unchanged).
```

### Location 1f — `log-templates.md`

Add the following rows to the event table (these are the log.md rows that correspond to
the new cortex-path events, for completeness):

```
| log_event call succeeded      | (no log row — silent)                            |
| log_event call failed         | `| {HH:MM:SS} | auto-pilot | CORTEX LOG FAILED — {event_type}: {error[:100]} |` |
| Session log rendered from DB  | `| {HH:MM:SS} | auto-pilot | LOG RENDERED — {N} events from cortex, {M} already in log.md |` |
```

---

## Change 2: `orchestrator-history.md` replaced by `query_events`

### What

Currently Step 8b appends a full session block to `task-tracking/orchestrator-history.md`.
On the cortex path, the session summary is stored as a `SUPERVISOR_COMPLETE` event
(already covered by Change 1, step 2b). Analytics queries use `query_events` instead of
reading the file. The file-based path is kept as a fallback.

### Affected file

`/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`

### Change type

**Additive** — add a cortex conditional block inside Step 8b. The existing file-append
logic stays; the cortex path is an additional parallel write.

### Location — `parallel-mode.md`, Step 8b, step 1–4

Wrap the existing file-append logic in a conditional block and add a cortex note:

```
**Cortex path (cortex_available = true):**

The `SUPERVISOR_COMPLETE` event logged in step 2b (Change 1) serves as the queryable
session summary. Analytics queries use:
  query_events(event_type='SUPERVISOR_COMPLETE')     -- list all session summaries
  query_events(session_id=X, event_type='TASK_STATE_CHANGE')  -- per-session transitions

The orchestrator-history.md file-append (steps 1-4 below) still runs on the cortex path
as the human-readable fallback. Do NOT skip it.

**Fallback path (cortex_available = false):** Steps 1-4 only (original behavior unchanged).
```

### Location — `cortex-integration.md`

Add a new section:

```
### Step 8b: Session History

- **cortex path**: `SUPERVISOR_COMPLETE` event (logged in Change 1 step 2b) replaces the
  queryable analytics function of `orchestrator-history.md`. The file is still written
  as the human-readable record.
- **Analytics queries** (for future tooling): use `query_events(event_type='SUPERVISOR_COMPLETE')`
  to list sessions; `query_events(event_type='TASK_STATE_CHANGE')` for per-task transitions.
- **fallback path**: File append only (original Step 8b logic).
```

---

## Change 3: `escalate_to_user` config option

### What

New config flag. Default `false`. When `true`, workers can signal `NEED_INPUT` via
`log_event`; the supervisor checks for this at phase boundaries and surfaces it to the
user.

### Affected files

1. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md` — add to Configuration table
2. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md` — add signal check at phase boundary

### Change type

**Additive** in both files.

### Location 3a — `SKILL.md`, section "## Configuration", the configuration table

Add a new row to the table (insert after the "Sequential mode" row):

```
| Escalate to user    | false       | --escalate       | When true: supervisor checks for NEED_INPUT signals from workers at phase boundaries (after each TASK_STATE_CHANGE event). Requires cortex_available = true. When false (default): workers fail autonomously, supervisor retries or blocks. |
```

Also add a note below the table (after the existing "Note on stuck detection" block):

```
> **Note on `escalate_to_user`**: This option requires `cortex_available = true` — it
> depends on `query_events` to poll for NEED_INPUT signals. If `cortex_available = false`
> at session start, `escalate_to_user` is automatically forced to `false` and a warning
> is logged: `"ESCALATE disabled — cortex unavailable"`. Workers always fail autonomously
> on the file-based path.
```

### Location 3b — `parallel-mode.md`, Step 7f (after-completion handler)

After the existing step 4 ("Go to Step 4"), insert a new sub-step **7f-escalate**:

```
**7f-escalate. NEED_INPUT signal check (runs only when escalate_to_user = true AND cortex_available = true):**

After completing the incremental dependency re-evaluation (steps 1-3 above), before
going to Step 4:

1. Call `query_events(session_id={session_id}, event_type='NEED_INPUT')`.
2. If any unacknowledged NEED_INPUT events are returned:
   a. Pause the supervisor loop (do NOT spawn new workers this iteration).
   b. Display each question to the user:
      ```
      [NEED INPUT — TASK_X] {data.question}
      ```
   c. Wait for user response (blocking — this is intentional, escalation mode is opted-in).
   d. After user responds: call `log_event(session_id, source="auto-pilot",
      event_type='INPUT_PROVIDED', data={answer, task_id})` to acknowledge.
   e. Resume the loop (go to Step 4).
3. If no NEED_INPUT events: proceed to Step 4 immediately.

**Security note**: The `data.question` field is displayed verbatim. It is sourced from a
worker's `log_event` call, not from task.md or any untrusted free-text field. Display only
the `question` key — do not render any other data payload keys.
```

### Location 3c — `log-templates.md`

Add new log rows:

```
| Escalate disabled (cortex off) | `| {HH:MM:SS} | auto-pilot | ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false |` |
| NEED_INPUT received             | `| {HH:MM:SS} | auto-pilot | NEED INPUT — TASK_X: pausing loop for user response |` |
| Input provided                  | `| {HH:MM:SS} | auto-pilot | INPUT PROVIDED — TASK_X: resuming loop |` |
```

---

## Change 4: Worker handoff injection from DB into Review Worker prompt

### What

When spawning a Review Worker, the supervisor calls `read_handoff(task_id)` (if
`cortex_available = true`) and injects the structured handoff data directly into the
worker prompt. Fallback: worker reads handoff.md file (current behavior).

### Affected files

1. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md` — add to Step 5c (Generate Worker Prompt)
2. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/worker-prompts.md` — add injected handoff section to First-Run Review Lead Prompt and Retry Review Lead Prompt
3. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/cortex-integration.md` — add Step 5c entry

### Change type

**Additive** in all three files.

### Location 4a — `parallel-mode.md`, Step 5c (Generate Worker Prompt)

After the prompt template selection table, insert a new sub-step **5c-handoff**:

```
**5c-handoff. Inject handoff data for Review Workers (cortex_available = true only):**

Before finalizing the Review Worker prompt, call `read_handoff(task_id)`.

If `read_handoff` succeeds and returns a non-empty record:
  Append the following block to the generated prompt (after the template body, before
  the Commit Metadata section):

  ```
  ## Handoff Data (injected by Supervisor from nitro-cortex DB)

  Files Changed:
  {handoff.files_changed — one file per line}

  Commits:
  {handoff.commits — one commit per line: <hash>: <message>}

  Decisions:
  {handoff.decisions}

  Known Risks:
  {handoff.known_risks}
  ```

  The Review Worker does NOT need to read handoff.md from the file system — this data
  is already loaded.

If `read_handoff` fails or returns empty: do NOT modify the prompt. The worker will fall
back to reading `task-tracking/TASK_YYYY_NNN/handoff.md` as usual.

This call is best-effort — failure never blocks the spawn.
```

### Location 4b — `worker-prompts.md`, First-Run Review Lead Prompt

After the existing step 1 (write IN_REVIEW status), add a note:

```
## Handoff Context (injected when cortex available)

If the Supervisor injected a `## Handoff Data` section above (before this Commit Metadata
block), use it instead of reading `task-tracking/TASK_YYYY_NNN/handoff.md` from disk.
The injected data is authoritative and pre-verified by the Supervisor. If no injected
section is present, read handoff.md from disk as usual.
```

Insert this note in the same location in the **Retry Review Lead Prompt** as well.

### Location 4c — `cortex-integration.md`

Add a new section:

```
### Step 5c: Review Worker Prompt — Handoff Injection

- **cortex path**: Before spawning a Review Worker, call `read_handoff(task_id)`. If it
  returns a non-empty record, inject the structured handoff fields into the prompt body
  (files_changed, commits, decisions, known_risks). The Review Worker skips reading
  handoff.md from disk.
- **fallback path**: Review Worker reads `task-tracking/TASK_YYYY_NNN/handoff.md` directly
  (current behavior, unchanged).
- **Best-effort**: a `read_handoff` failure does not block the spawn.
```

---

## Change 5: Session teardown via `end_session()`

### What

At session end, call `end_session(session_id)` to formally close the session record in
the DB. Before ending, ensure log.md is rendered from `query_events()` (already covered
by Change 1 step 1d). Fallback: file-based session teardown only (current behavior).

### Affected files

1. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md` — add to Step 8d (Commit Session Artifacts)
2. `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/cortex-integration.md` — add Step 8d entry

### Change type

**Additive** in both files.

### Location 5a — `parallel-mode.md`, Step 8d (Commit Session Artifacts)

After existing step 2 (git add + git commit), insert a new step **2b**:

```
**2b. Cortex teardown (cortex_available = true only):**

After the git commit (step 2), call:
  end_session(
    session_id = {session_id},
    summary    = "{tasks_completed} completed, {failed} failed, {blocked} blocked — {stop_reason}"
  )

If `end_session` fails: log
  `| {HH:MM:SS} | auto-pilot | SESSION END FAILED — cortex end_session error: {error[:100]} |`
  and continue. Never block session stop on this call.

This call runs AFTER the git commit so that all session artifacts (log.md, analytics.md,
worker-logs/) are committed before the session record is closed in the DB.
```

### Location 5b — `log-templates.md`

Add new log rows:

```
| end_session called successfully | `| {HH:MM:SS} | auto-pilot | SESSION ENDED — cortex session record closed |` |
| end_session failed              | `| {HH:MM:SS} | auto-pilot | SESSION END FAILED — cortex end_session error: {error[:100]} |` |
```

### Location 5c — `cortex-integration.md`

Add a new section:

```
### Step 8d: Session Teardown

- **cortex path**: After the git commit in Step 8d, call `end_session(session_id, summary)`.
  Best-effort — failure is logged and ignored.
- **Log render**: Before Step 8d, Step 8b already renders missing log.md rows from
  `query_events(session_id)` (see Event Logging section above). This ensures log.md is
  complete before the git commit.
- **fallback path**: No `end_session` call. Session record in DB stays open until
  a future `get_session()` or manual cleanup. File-based teardown unchanged.
```

---

## Sequential mode coverage

### Affected file

`/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/sequential-mode.md`

### Change type

**Additive** — add cortex notes to the session teardown section only.

### Location — `sequential-mode.md`, step 7 (Session teardown)

After the existing "Remove session row from task-tracking/active-sessions.md" line,
insert:

```
**Cortex path (cortex_available = true):**

- At SEQUENTIAL STOPPED: call `log_event(session_id, source="auto-pilot",
  event_type='SUPERVISOR_COMPLETE', data={completed, failed, blocked, mode='sequential'})`.
- After the git commit: call `end_session(session_id, summary=...)`.
  Both calls are best-effort — failure is logged and ignored.
```

This aligns sequential mode teardown with parallel mode (Changes 1 and 5) without
duplicating the full parallel-mode cortex detail.

---

## Files Affected Summary

| File | Change | Type |
|------|--------|------|
| `.claude/skills/auto-pilot/references/parallel-mode.md` | Changes 1, 2, 3, 4, 5 | MODIFY |
| `.claude/skills/auto-pilot/references/cortex-integration.md` | Changes 1, 2, 4, 5 | MODIFY |
| `.claude/skills/auto-pilot/references/log-templates.md` | Changes 1, 3, 5 | MODIFY |
| `.claude/skills/auto-pilot/references/worker-prompts.md` | Change 4 | MODIFY |
| `.claude/skills/auto-pilot/SKILL.md` | Change 3 | MODIFY |
| `.claude/skills/auto-pilot/references/sequential-mode.md` | Sequential teardown | MODIFY |

No files are created or deleted.

---

## Developer Type Recommendation

**Recommended Developer**: nitro-systems-developer
**Rationale**: All changes are documentation of orchestration behavior in .md skill files.
No TypeScript, no tests, no build system involved.

## Complexity Assessment

**Complexity**: Medium
**Estimated Effort**: 2-3 hours

The changes are surgical but span six files and require careful placement within
long documents. The logic is straightforward but must be inserted at precise locations
without disturbing existing content or breaking the load-on-demand reading order.
