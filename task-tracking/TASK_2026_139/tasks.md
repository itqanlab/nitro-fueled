# Development Tasks - TASK_2026_139

**Total Tasks**: 10 | **Batches**: 2 | **Status**: 1/2 complete

---

## Plan Validation Summary

**Validation Status**: PASSED

### Assumptions Verified

- All six target files exist under `.claude/skills/auto-pilot/` — confirmed
- `cortex-integration.md` has no entries for Steps 8b, 8d, or event logging — confirmed (safe insertion points)
- `log-templates.md` ends at the Cortex rows (line 77-78) — confirmed (safe append point)
- `SKILL.md` Configuration table ends before "Note on stuck detection" — confirmed insertion point
- `parallel-mode.md` and `sequential-mode.md` exist — confirmed; Step 8 sections exist and can receive insertions
- `worker-prompts.md` exists — confirmed; handoff note insertion points are identifiable
- All five changes are ADDITIVE only — no deletions or replacements of existing content
- `log_event`, `query_events`, `read_handoff`, `end_session` are valid cortex tools — confirmed in context.md MCP Tool Reference

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| parallel-mode.md is a long file — wrong insertion point could misplace content | MED | Developer must read the file section-by-section and confirm step anchors before inserting |
| Changes 1 and 2 both touch Step 8b — ordering matters | MED | Task 1.3 (Change 1 Step 8b sub-steps) must complete before Task 1.4 (Change 2 Step 8b cortex note) |
| Change 3 `escalate_to_user` note references Change 1 NEED_INPUT signal — both must be present | LOW | Both in same batch; Change 1 event table includes NEED_INPUT row already |

---

## Batch 1: Core Event Logging + Config Changes COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 6 | **Dependencies**: None

### Task 1.1: Add `escalate_to_user` to SKILL.md Configuration table COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`
**Spec Reference**: plan.md Change 3, Location 3a

**Quality Requirements**:

- New table row inserted after the "Sequential mode" row
- Exact text: `| Escalate to user    | false       | --escalate       | When true: supervisor checks for NEED_INPUT signals from workers at phase boundaries (after each TASK_STATE_CHANGE event). Requires cortex_available = true. When false (default): workers fail autonomously, supervisor retries or blocks. |`
- Block note inserted after the existing "Note on stuck detection" block:
  ```
  > **Note on `escalate_to_user`**: This option requires `cortex_available = true` — it
  > depends on `query_events` to poll for NEED_INPUT signals. If `cortex_available = false`
  > at session start, `escalate_to_user` is automatically forced to `false` and a warning
  > is logged: `"ESCALATE disabled — cortex unavailable"`. Workers always fail autonomously
  > on the file-based path.
  ```
- No other content in SKILL.md is modified

**Implementation Details**:

- Location: Configuration section, table row after `| Sequential mode     | false       | --sequential     | ... |`
- Second location: After the `> **Note on stuck detection**` block, before the next `---` separator

---

### Task 1.2: Add new cortex log rows to log-templates.md (Changes 1, 3, 5) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/log-templates.md`
**Spec Reference**: plan.md Change 1 Location 1f, Change 3 Location 3c, Change 5 Location 5b

**Quality Requirements**:

- Append all new rows to the bottom of the existing pipe-table (after the last existing row)
- Change 1 rows (2 rows):
  ```
  | log_event call failed         | `\| {HH:MM:SS} \| auto-pilot \| CORTEX LOG FAILED — {event_type}: {error[:100]} \|` |
  | Session log rendered from DB  | `\| {HH:MM:SS} \| auto-pilot \| LOG RENDERED — {N} events from cortex, {M} already in log.md \|` |
  ```
  Note: `log_event call succeeded` is silent (no log row needed)
- Change 3 rows (3 rows):
  ```
  | Escalate disabled (cortex off) | `\| {HH:MM:SS} \| auto-pilot \| ESCALATE DISABLED — cortex unavailable, escalate_to_user forced false \|` |
  | NEED_INPUT received             | `\| {HH:MM:SS} \| auto-pilot \| NEED INPUT — TASK_X: pausing loop for user response \|` |
  | Input provided                  | `\| {HH:MM:SS} \| auto-pilot \| INPUT PROVIDED — TASK_X: resuming loop \|` |
  ```
- Change 5 rows (2 rows):
  ```
  | end_session called successfully | `\| {HH:MM:SS} \| auto-pilot \| SESSION ENDED — cortex session record closed \|` |
  | end_session failed              | `\| {HH:MM:SS} \| auto-pilot \| SESSION END FAILED — cortex end_session error: {error[:100]} \|` |
  ```
- All rows use the same pipe-table format as existing entries; escaped pipes inside backtick cells use `\|`

---

### Task 1.3: Add Event Logging cortex section to parallel-mode.md (Change 1) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md Change 1, Locations 1b, 1c, 1d

**Quality Requirements**:

Three insertions within parallel-mode.md:

**Insertion A — after the existing Step 8d section (end of Core Loop), add a new subsection:**

```markdown
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

**Insertion B — Step 8b, after step 1 "Read task-tracking/orchestrator-history.md" instruction, insert cortex render sub-step:**

```markdown
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

**Insertion C — Step 8b, before step 3 "Quality line computation", insert SUPERVISOR_COMPLETE event call:**

```markdown
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

**Validation Notes**:

- Insertion A must go at the very end of the Core Loop section, not mid-document
- Insertions B and C are both within Step 8b — B goes inside step 1 (file-read sub-step), C goes between the existing step 2 and step 3

---

### Task 1.4: Add orchestrator-history replacement cortex note to parallel-mode.md (Change 2) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md Change 2, Location "parallel-mode.md Step 8b steps 1-4"

**Quality Requirements**:

- Insert the following block at the top of Step 8b (before the existing steps 1-4), as a conditional note:

```markdown
**Cortex path (cortex_available = true):**

The `SUPERVISOR_COMPLETE` event logged in step 2b (Change 1) serves as the queryable
session summary. Analytics queries use:
  query_events(event_type='SUPERVISOR_COMPLETE')     -- list all session summaries
  query_events(session_id=X, event_type='TASK_STATE_CHANGE')  -- per-session transitions

The orchestrator-history.md file-append (steps 1-4 below) still runs on the cortex path
as the human-readable fallback. Do NOT skip it.

**Fallback path (cortex_available = false):** Steps 1-4 only (original behavior unchanged).
```

**Validation Notes**:

- This change must be inserted AFTER Task 1.3 insertions are in place (both touch Step 8b)
- Do not remove or modify any existing Step 8b file-append logic

---

### Task 1.5: Add `escalate_to_user` signal check to parallel-mode.md Step 7f (Change 3) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md Change 3, Location 3b

**Quality Requirements**:

- Locate Step 7f in parallel-mode.md (the after-completion handler)
- After the existing "Go to Step 4" instruction (last item in Step 7f steps 1-3 or 1-4), insert the new `7f-escalate` sub-step:

```markdown
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

---

### Task 1.6: Add `end_session()` teardown to parallel-mode.md Step 8d (Change 5) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
**Spec Reference**: plan.md Change 5, Location 5a

**Quality Requirements**:

- Locate Step 8d (Commit Session Artifacts) in parallel-mode.md
- After existing step 2 (git add + git commit), insert a new step **2b**:

```markdown
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

---

**Batch 1 Verification**:

- All files exist at their paths and contain the inserted content
- No existing content was removed or altered
- nitro-code-logic-reviewer approved

---

## Batch 2: Handoff Injection + Sequential + Cortex Integration Docs COMPLETE

**Developer**: nitro-systems-developer
**Tasks**: 4 | **Dependencies**: Batch 1 complete (cortex-integration.md sections reference Batch 1 content)

### Task 2.1: Add handoff injection to parallel-mode.md Step 5c and worker-prompts.md (Change 4) COMPLETE

**Files**:
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/parallel-mode.md`
- `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/worker-prompts.md`

**Spec Reference**: plan.md Change 4, Locations 4a and 4b

**Quality Requirements**:

**In parallel-mode.md, Step 5c — after the prompt template selection table, insert sub-step 5c-handoff:**

```markdown
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

**In worker-prompts.md — add the following note to both the First-Run Review Lead Prompt and the Retry Review Lead Prompt, after the existing step 1 (write IN_REVIEW status):**

```markdown
## Handoff Context (injected when cortex available)

If the Supervisor injected a `## Handoff Data` section above (before this Commit Metadata
block), use it instead of reading `task-tracking/TASK_YYYY_NNN/handoff.md` from disk.
The injected data is authoritative and pre-verified by the Supervisor. If no injected
section is present, read handoff.md from disk as usual.
```

**Validation Notes**:

- The note must appear in BOTH the First-Run and Retry prompts — do not skip one
- Do not alter the existing prompt step numbering or structure

---

### Task 2.2: Add sequential mode cortex teardown (Change 5 sequential coverage) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/sequential-mode.md`
**Spec Reference**: plan.md "Sequential mode coverage", step 7

**Quality Requirements**:

- Locate step 7 (Session teardown) in sequential-mode.md
- After the existing "Remove session row from task-tracking/active-sessions.md" line, insert:

```markdown
**Cortex path (cortex_available = true):**

- At SEQUENTIAL STOPPED: call `log_event(session_id, source="auto-pilot",
  event_type='SUPERVISOR_COMPLETE', data={completed, failed, blocked, mode='sequential'})`.
- After the git commit: call `end_session(session_id, summary=...)`.
  Both calls are best-effort — failure is logged and ignored.
```

---

### Task 2.3: Add all cortex-integration.md sections (Changes 1, 2, 4, 5) COMPLETE

**File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/references/cortex-integration.md`
**Spec Reference**: plan.md Change 1 Location 1e, Change 2 Location cortex-integration.md, Change 4 Location 4c, Change 5 Location 5c

**Quality Requirements**:

Append four new sections to the bottom of cortex-integration.md (after the Bootstrap Note). Order: Event Logging, Step 8b Session History, Step 5c Handoff Injection, Step 8d Session Teardown.

**Section A — Event Logging (all steps):**

```markdown
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

**Section B — Step 8b Session History:**

```markdown
### Step 8b: Session History

- **cortex path**: `SUPERVISOR_COMPLETE` event (logged in Change 1 step 2b) replaces the
  queryable analytics function of `orchestrator-history.md`. The file is still written
  as the human-readable record.
- **Analytics queries** (for future tooling): use `query_events(event_type='SUPERVISOR_COMPLETE')`
  to list sessions; `query_events(event_type='TASK_STATE_CHANGE')` for per-task transitions.
- **fallback path**: File append only (original Step 8b logic).
```

**Section C — Step 5c Handoff Injection:**

```markdown
### Step 5c: Review Worker Prompt — Handoff Injection

- **cortex path**: Before spawning a Review Worker, call `read_handoff(task_id)`. If it
  returns a non-empty record, inject the structured handoff fields into the prompt body
  (files_changed, commits, decisions, known_risks). The Review Worker skips reading
  handoff.md from disk.
- **fallback path**: Review Worker reads `task-tracking/TASK_YYYY_NNN/handoff.md` directly
  (current behavior, unchanged).
- **Best-effort**: a `read_handoff` failure does not block the spawn.
```

**Section D — Step 8d Session Teardown:**

```markdown
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

### Task 2.4: Self-review — verify all insertions are coherent and no existing content was disturbed COMPLETE

**Files**: All six modified files
**Spec Reference**: plan.md Files Affected Summary

**Quality Requirements**:

- Read each of the six files and confirm:
  1. All inserted sections are present at the correct locations
  2. No adjacent existing content was accidentally deleted or corrupted
  3. Markdown formatting is consistent (headers, pipe tables, code fences match surrounding style)
  4. All six files listed in plan.md Files Affected Summary have been touched:
     - `.claude/skills/auto-pilot/references/parallel-mode.md`
     - `.claude/skills/auto-pilot/references/cortex-integration.md`
     - `.claude/skills/auto-pilot/references/log-templates.md`
     - `.claude/skills/auto-pilot/references/worker-prompts.md`
     - `.claude/skills/auto-pilot/SKILL.md`
     - `.claude/skills/auto-pilot/references/sequential-mode.md`
- Report any inconsistency found and fix it before returning

---

**Batch 2 Verification**:

- All files exist and contain inserted content
- nitro-code-logic-reviewer approved
- Task 2.4 self-review passed (no corrupted adjacent content)
