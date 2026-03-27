# Code Logic Review — TASK_2026_034

## Summary

The core architecture of this change is sound: session-scoped directories, a unified append-only
`log.md`, and an `active-sessions.md` registry solve all three stated problems. The happy path
for both `auto-pilot` and `orchestration` skills is complete. However, there are **5 blocking
issues** that would cause incorrect behavior at runtime: stale `orchestrator-state.md` references
scattered throughout the auto-pilot skill, a missing "Active Sessions File" section that is
referenced but never defined, an incorrect concurrent session guard ordering, a compaction
recovery gap that cannot self-heal without the session directory path, and an orchestration
skill that never removes its `active-sessions.md` row on error paths.

The implementation is not production-ready as written. It requires revision before approval.

---

## Acceptance Criteria Check

| Criterion | Status | Notes |
|-----------|--------|-------|
| Supervisor creates `sessions/{SESSION_ID}/` on startup | PASS | Session Directory section (line 163-221) is complete and correct |
| `state.md` written inside session directory, not at root | PARTIAL | Session Lifecycle and Step 5f/6e/8 updated, but 6 stale bare `orchestrator-state.md` references remain (see BLOCKING-1) |
| `log.md` exists in session directory with unified event format | PASS | Format defined in both Session Log section and log.md Format sub-section |
| Auto-pilot appends to `log.md` with source `auto-pilot` | PASS | All event rows use `auto-pilot` source column |
| Orchestration skill appends to `log.md` with source `orchestrate` | PASS | Session Logging section is complete, correct format |
| `active-sessions.md` lists running sessions, updated on start/stop | PARTIAL | Format and write rules are defined in implementation-plan but the "Active Sessions File" section was never added to auto-pilot/SKILL.md; startup step 5 references a section that does not exist (see BLOCKING-2) |
| Two supervisors can run concurrently without clobbering each other | PARTIAL | Logic is correct once running, but guard ordering is wrong (see BLOCKING-3) |
| Previous sessions preserved and browsable under `sessions/` | PASS | Per-session directories are never deleted |
| `orchestrator-history.md` still works as append-only index | PASS | Step 8b updated to read from `{SESSION_DIR}log.md` |
| Old `orchestrator-state.md` at root no longer created | FAIL | 6 bare references still instruct the supervisor to write to `orchestrator-state.md` (see BLOCKING-1) |

---

## Findings

### BLOCKING

---

#### BLOCKING-1: Six stale `orchestrator-state.md` references remain in auto-pilot/SKILL.md

The implementation updated the primary write points (Steps 5f, 6e, 8) and added the Session
Directory section's alias rule ("Every reference to `orchestrator-state.md` in this skill means
`{SESSION_DIR}state.md`"). However, six specific locations were NOT updated and contain bare
`orchestrator-state.md` strings that will cause a supervisor following the instructions to write
to the old root path instead of the session directory:

**Line 64** — Configuration section:
> "Write the active configuration into `orchestrator-state.md`."

This fires on startup before `SESSION_DIR` is even established, so the alias rule cannot save it.
The supervisor would write config to the root path, then immediately begin writing state to the
session directory, leaving a stale root file.

**Line 351** — Step 3c File Scope Overlap Detection:
> "Record serialized tasks in orchestrator-state.md under a new `## Serialized Reviews` table"

**Line 371** — Step 4 Serialization check:
> "check the `## Serialized Reviews` table in orchestrator-state.md"

**Line 404** — Step 5d (on successful spawn):
> "Record in `orchestrator-state.md` active workers table"

**Line 1004** — Error Handling > MCP Unreachable:
> "Write current state to `orchestrator-state.md`."

**Line 1020** — Error Handling > Unexpected Error:
> "Write current state to `orchestrator-state.md` **FIRST**"

The alias rule at line 198 says "Every reference to `orchestrator-state.md` in this skill means
`{SESSION_DIR}state.md`" which is an attempt to cover these cases retroactively. However, that
alias rule is buried in the Session Directory section and is easily missed by a supervisor reading
the step-level instructions in isolation. More critically, the alias cannot apply at line 64
because `SESSION_DIR` does not yet exist at that point in startup. A supervisor that reads the
Configuration section, sees `orchestrator-state.md`, and writes to `task-tracking/orchestrator-state.md`
will produce the old root file — precisely what the acceptance criteria say MUST NOT happen.

**Also in Key Principles (line 1037)**:
> "4. **orchestrator-state.md is your private memory** across compactions"

This principle still names the old file, inconsistent with the split into `state.md` + `log.md`.

**Impact**: The old root `orchestrator-state.md` will be created on every session start and on
every MCP failure. Two concurrent supervisors will both write to the same root file, clobbering
each other's configuration — the exact failure mode this task was designed to fix.

**Fix**: Update all six locations to use `{SESSION_DIR}state.md`. Update Key Principles item 4
to reference `{SESSION_DIR}state.md`. Remove or narrow the alias rule (it is a crutch that
fails on startup order and is too easy to overlook).

---

#### BLOCKING-2: "Active Sessions File" section referenced but never defined in auto-pilot/SKILL.md

Session Lifecycle startup step 5 (line 196) reads:
> "Register in `task-tracking/active-sessions.md` (append row — **see Active Sessions File section**)."

There is no "Active Sessions File" section anywhere in `auto-pilot/SKILL.md`. The format,
write rules, and column definitions for `active-sessions.md` were specified only in the
implementation plan (Component 8), but Component 8 was documented as a new file to create
(`task-tracking/active-sessions.md`) — not as a section to add to `auto-pilot/SKILL.md`.

A supervisor following these instructions reaches step 5 and has no definition of what to append:
what columns exist, what format the table uses, or what values to write. Without this definition,
the supervisor will either invent a format (causing inconsistency between sessions) or halt.

The orchestration skill has the same gap: its Session Directory Setup step 5 (line 224-225) also
says "Register in `task-tracking/active-sessions.md` (append row with source `orchestrate`,
Tasks `1`, path `{SESSION_DIR}`)." The orchestration skill provides slightly more inline detail
(source, Tasks count, path) but not the full table format.

**Impact**: Both skills will produce `active-sessions.md` rows with no agreed format. The
Concurrent Session Guard (which reads `active-sessions.md` to check for running sessions) may
fail to find or parse the row, defeating the concurrent session detection entirely.

**Fix**: Add an "## Active Sessions File" section to `auto-pilot/SKILL.md` that contains the
table format and write rules (the content from implementation-plan Component 8). Update both
skills' step 5 to reference this section by its exact heading name.

---

#### BLOCKING-3: Concurrent Session Guard runs after Session Directory creation — wrong order

The implementation plan specified the guard order as:
> "after MCP validation passes, before entering the loop"

And Session Directory creation was intended to come after the guard check. But the skill as
written places the sections in this order:

1. MCP Requirement (lines 147-161) — validates MCP
2. Session Directory (lines 163-221) — creates directory, registers in active-sessions.md, logs STARTED
3. Concurrent Session Guard (lines 211-223) — reads active-sessions.md

This means the supervisor **creates its session directory and registers in `active-sessions.md`
BEFORE checking whether another supervisor is already running**. The guard will always find at
least one row (its own newly written row) when it reads `active-sessions.md`, and with two
concurrent supervisors both starting simultaneously, both will have already registered before
either reads the guard check.

Additionally, the STARTED log entry is appended to `log.md` in Session Lifecycle step 4, before
the guard runs. If the guard aborts (user declines to continue), the session directory and log
entry persist with no matching STOPPED entry — creating a permanently stale `active-sessions.md`
row that will trigger false-positive warnings on every future startup.

**Impact**: The concurrent session guard is structurally bypassed by its own startup ordering.
Two supervisors starting simultaneously will both proceed regardless of the guard check.

**Fix**: Move the Concurrent Session Guard to execute after MCP validation but BEFORE Session
Directory creation. Only create the session directory and register in `active-sessions.md` after
the guard has passed (or the user has confirmed `--force`). If the guard aborts, nothing is
written.

---

#### BLOCKING-4: Compaction recovery cannot re-derive SESSION_DIR without reading state.md first — bootstrap gap

The Compaction Recovery Note (line 248) states:
> "After a compaction, `SESSION_DIR` must be re-derived from the session timestamp stored in
> `state.md` (`Session Started` field). The supervisor re-reads `{SESSION_DIR}state.md` and
> restores `SESSION_DIR` from the stored path before continuing."

This is circular: to read `{SESSION_DIR}state.md`, you must already know `SESSION_DIR`. The
actual field that resolves this is `Session Directory` added to `state.md` (line 868):
> `**Session Directory**: task-tracking/sessions/SESSION_2026-03-24_22-00/`

But the compaction recovery note does not tell the supervisor how to find `state.md` without
knowing `SESSION_DIR` first. After a compaction, the supervisor's in-memory `SESSION_DIR`
variable is lost. The recovery path must be:

1. Scan `task-tracking/sessions/` for directories matching `SESSION_{YYYY-MM-DD}_{HH-MM}`
2. Find the one matching the current session's start time (or the most recently modified)
3. Read its `state.md` to restore full context

OR alternatively:
1. Read `task-tracking/active-sessions.md` (path is known, no session variable needed)
2. Find this session's row (matching the supervisor's startup timestamp)
3. Extract the `Path` column to derive `SESSION_DIR`
4. Read `{SESSION_DIR}state.md`

Neither recovery path is documented. The note says "restore `SESSION_DIR` from the stored path"
but does not explain how to find the file that contains the stored path.

**Impact**: After a compaction, the supervisor cannot locate its state file and will treat itself
as a fresh start (ELSE branch of Step 1), losing all active worker tracking, retry counts, and
the task queue. Any in-flight workers become invisible to the supervisor — it will spawn
duplicates on the next iteration.

**Fix**: Add an explicit compaction bootstrap procedure that explains how to locate `state.md`
when `SESSION_DIR` is not in memory. The simplest correct path: read `active-sessions.md`,
match this session's row, extract Path column.

---

#### BLOCKING-5: Orchestration skill never removes its `active-sessions.md` row on error/abort paths

The Session Logging section in `orchestration/SKILL.md` specifies cleanup only on a single path
(line 229-233):
> "On finish (after Completion Phase bookkeeping commit):
> 1. Append final entry...
> 2. Remove this session's row from `task-tracking/active-sessions.md`."

There is no cleanup instruction for:

- **Orchestration failure** mid-workflow (e.g., PM agent fails, architect rejects, developer gets blocked)
- **User abandons** the orchestration session mid-flight (closes terminal, SIGINT)
- **Build Worker / Review Worker** orchestration sessions — the note on line 254-258 says each worker creates its own session directory, but worker prompts do not include cleanup instructions, and workers are killed by the supervisor without warning. A killed worker will never reach the "On finish" path.

Since workers are spawned by the supervisor and can be killed at any time (stuck detection, user
intervention, MCP disconnection), their `active-sessions.md` rows will accumulate permanently
with no cleanup mechanism.

**Impact**: `active-sessions.md` becomes permanently polluted with stale worker rows. The
auto-pilot Concurrent Session Guard reads this file to detect running supervisors. If worker rows
(source: `orchestrate`) pile up, the file grows unbounded and the guard must filter by source
`auto-pilot` (which it currently does) — so the guard itself is not directly broken. However,
the file becomes misleading and unreadable for humans monitoring concurrent sessions.

More critically: if any future guard logic or tooling checks for ANY running session (not just
`auto-pilot` sessions), stale `orchestrate` rows will produce false positives.

**Fix**: Worker prompts should include a cleanup step for `active-sessions.md` in their exit
gates. Alternatively, document explicitly that worker-created rows are expected to be stale and
that `active-sessions.md` cleanup for `orchestrate` rows is deferred to session restart or a
manual cleanup command.

---

### SERIOUS

---

#### SERIOUS-1: Step 8b Event Log in history drops Source column — inconsistency not flagged

The implementation plan (Component 7) specifies that `orchestrator-history.md` should drop the
`Source` column from copied log entries, using only `| Time | Event |`. The actual implementation
in the skill (lines 564-568) shows:

```markdown
### Event Log

| Time | Event |
|------|-------|
{copy full event table from {SESSION_DIR}log.md}
```

The source `log.md` uses three columns `| Timestamp | Source | Event |`. The instruction to
"copy full event table" without specifying that the Source column must be stripped will cause a
supervisor to copy the table verbatim — producing a three-column table under a two-column header.
The resulting markdown is technically broken (mismatched column counts).

**Impact**: Malformed history file. Markdown table parsers will either reject the table or produce
garbled output. Agents reading `orchestrator-history.md` after compaction may misparse events.

**Fix**: Change the instruction to explicitly state "copy the Timestamp and Event columns only
(omit the Source column)" and provide an example row showing the transformation.

---

#### SERIOUS-2: Session Lifecycle startup order logs STARTED before MCP validation passes

The Session Lifecycle "On startup" steps (lines 183-199) place the SUPERVISOR STARTED log append
at step 4, which comes before the MCP Requirement check. But the MCP Requirement section
(lines 147-161) states it must run "BEFORE ANYTHING ELSE" and is a hard-stop failure condition.

The startup sequence as written:
1. MCP validation (lines 147-161) — HARD FAIL if MCP missing
2. Session Directory creation (lines 183-207)
   - Step 4: append SUPERVISOR STARTED log entry
3. Concurrent Session Guard

If MCP validation is truly first (as labeled), the STARTED log entry at step 4 is fine — the
session directory would not exist yet if MCP failed. However, the Concurrent Session Guard (Step 3
in the guard section) contradicts this because it runs after Session Directory creation but
"before entering the loop." The ordering instructions across sections are inconsistent and a
supervisor following them linearly will produce different startup sequences depending on which
section they read first.

**Impact**: Ambiguous startup sequence. Different supervisors (or the same supervisor across
different compaction recovery paths) may execute startup steps in different orders.

**Fix**: Add a single, numbered startup sequence at the top of the skill (or in the Session
Directory section) that defines the exact order: (1) MCP validation, (2) Concurrent Session Guard,
(3) Session Directory creation and registration, (4) Step 1 read state / recovery.

---

#### SERIOUS-3: `active-sessions.md` "Tasks" column has no update mechanism after workers are spawned

The `active-sessions.md` format (from implementation-plan Component 8) includes a `Tasks` column:
> "For auto-pilot, the count of tasks being processed this session."

But the auto-pilot skill has no instruction to update this count as tasks are completed, blocked,
or added during the session. The count is written once on startup and never revised. For a
10-task backlog, the `active-sessions.md` row will show `Tasks: 10` whether 0 or 9 tasks have
completed. This is misleading for humans using `active-sessions.md` to monitor progress.

**Impact**: The column provides no live monitoring value. It actively misleads by showing initial
count regardless of progress. In a long session, the row becomes stale within the first loop
iteration.

**Fix**: Either remove the `Tasks` column from `active-sessions.md` (it cannot be kept current
without a write on every state transition), or change it to a static "started with N tasks" label
that makes the static nature explicit.

---

### MINOR

---

#### MINOR-1: `log.md` header created before MCP validation in Session Lifecycle

Session Lifecycle startup step 3 creates `log.md` with a header, and step 4 appends
`SUPERVISOR STARTED`. This happens after MCP validation (correct per section ordering), but the
first log event written is `SUPERVISOR STARTED` — which could be misleading if a future failure
between STARTED and the first loop iteration leaves the log in an incomplete state.

A PRE-FLIGHT PASSED/FAILED event is defined in the Session Log event table (lines 90-93) but
the Session Lifecycle startup sequence does not include an instruction to write the PRE-FLIGHT
events before SUPERVISOR STARTED. The `auto-pilot.md` command likely handles pre-flight before
invoking the skill, so these events may never be written.

**Impact**: Minimal — pre-flight events may be missing from session logs in some invocation
paths. The log will show SUPERVISOR STARTED without any preceding PRE-FLIGHT entry.

---

#### MINOR-2: Session ID timestamp collision when two supervisors start in the same minute

The session naming convention is `SESSION_{YYYY-MM-DD}_{HH-MM}` — minute-level precision. If two
supervisors start within the same minute, they produce the same `SESSION_ID` and the same
directory path. The Session Directory startup step 2 says "mkdir, no-op if exists" — so the
second supervisor would silently reuse the first supervisor's directory, writing to the same
`log.md` and potentially the same `state.md`.

The implementation plan acknowledges this for the orchestration skill ("the second one reads the
existing directory") but not for auto-pilot. For two auto-pilot supervisors, this would merge
their logs and clobber each other's state files — exactly the problem this task was meant to fix,
reproduced in a narrow timing window.

**Impact**: Low probability, high impact if it occurs. Two supervisors within the same minute
will corrupt each other's state.

**Fix**: Add seconds to the `SESSION_ID` format: `SESSION_{YYYY-MM-DD}_{HH-MM-SS}`. This reduces
the collision window from 60 seconds to 1 second, which is sufficient for practical use.

---

#### MINOR-3: History file size limit (500 lines, trim oldest 10) is unaffected by log.md migration

Step 8b line 572:
> "Keep the file under control: if it exceeds 500 lines, trim the oldest sessions (keep the
> most recent 10)."

With the session log now being a full three-column event table copied into each history entry,
individual session blocks will be substantially larger than before (each event is a full pipe-table
row rather than a bracketed one-liner). The 500-line threshold will be reached much faster,
causing aggressive trimming of history. The threshold should be reconsidered with the new format.

---

#### MINOR-4: Orchestration skill creates a new session directory for each worker — fragment risk

The orchestration skill's note on Build/Review Workers (lines 254-258) correctly states that
each worker creates its own session directory. This means a 10-task session with auto-pilot
spawning 10 Build Workers and 10 Review Workers will create 20+ session directories plus the
supervisor's own directory. The `sessions/` folder grows linearly with worker count.

There is no retention policy for old session directories. The `orchestrator-history.md` has a
trim rule, but the actual session directories on disk accumulate indefinitely.

**Impact**: Disk accumulation. Non-blocking for correctness but will become a maintenance issue
at scale.

---

## Review Summary Table

| Category | Score | Notes |
|----------|-------|-------|
| Correctness | 4/10 | 5 blocking issues; stale root file creation, broken guard ordering, compaction gap, unclean orphan rows |
| Completeness | 5/10 | Active Sessions File section missing; Step 8b copy instruction ambiguous; STARTED fires before guard |
| Edge Cases | 4/10 | Minute-level SESSION_ID collision, worker session cleanup gap, Tasks column staleness |
| Overall | 4/10 | Architecture is right; execution has too many gaps to run correctly |

---

## Verdict

**NEEDS REVISION**

The design is correct and the happy path is implemented. All five blocking issues are
fixable without architectural changes — they are path reference errors, ordering errors,
and missing section definitions. The two most critical fixes are:

1. Replace all bare `orchestrator-state.md` references with `{SESSION_DIR}state.md` (or
   remove the ambiguous alias rule and use explicit paths everywhere).
2. Add the "Active Sessions File" section to `auto-pilot/SKILL.md` with the full format
   and write rules.
3. Move the Concurrent Session Guard before Session Directory creation.
4. Add a compaction bootstrap path that explains how to locate `state.md` without
   `SESSION_DIR` in memory.
5. Add cleanup instructions for `active-sessions.md` on orchestration error/abort paths
   (or document the intentional stale-row behavior).
