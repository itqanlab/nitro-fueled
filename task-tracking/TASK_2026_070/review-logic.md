# Code Logic Review — TASK_2026_070

## Score: 6/10

## Review Summary

| Metric              | Value                        |
| ------------------- | ---------------------------- |
| Overall Score       | 6/10                         |
| Assessment          | NEEDS_REVISION               |
| Critical Issues     | 2                            |
| Serious Issues      | 2                            |
| Moderate Issues     | 3                            |
| Failure Modes Found | 7                            |

## The 5 Paranoid Questions

### 1. How does this fail silently?

The Step 8b commit note embeds a contradiction: the git add block inside Step 8b already
includes `analytics.md`, but the note below it says "run this commit AFTER Step 8c completes."
If an agent executes Step 8b as written (git add analytics.md, then commit), it will commit an
empty or missing analytics.md silently, because 8c hasn't run yet. The note asks the agent to
defer the commit, but the git add commands are written in the Step 8b block. The agent will follow
the written commands and not the prose note below them.

### 2. What user action causes unexpected behavior?

Starting two auto-pilot sessions rapidly in sequence. The stale archive check reads
`active-sessions.md` — a file that is now `.gitignore`d and therefore not tracked by
`git status --short`. The algorithm relies on `active-sessions.md` existing on disk from a
runtime write, not from git. If the previous session crashed before it could remove its row from
`active-sessions.md`, the stale session appears "live" and its artifacts are skipped — the exact
failure mode this check is meant to recover from.

### 3. What data makes this produce wrong results?

`git status --short` for a new session directory with untracked files reports the directory at
the `??` level: `?? task-tracking/sessions/SESSION_2026-03-27_10-20-12/`. The algorithm says
"for each uncommitted file under task-tracking/sessions/{SESSION_ID}/", implying it extracts
`SESSION_ID` from a file path like `.../SESSION_ID/log.md`. But an untracked directory is
reported as a single `??` entry at the directory level, not per-file. The SESSION_ID extraction
step will see the directory entry and extract correctly, but subsequent git add commands
(`git add .../log.md`, `git add .../analytics.md`) will silently no-op if those specific files
were never written (e.g., session crashed before log.md was flushed).

### 4. What happens when dependencies fail?

If `git status --short` fails entirely (git lock file, detached HEAD, corrupt repo), the algorithm
reaches Step 9 (best-effort, print warning and continue). That is correct. However, the session
log entries for the stale archive check are written in Step 4 of the Startup Sequence (after the
Session Directory is created), not at the time the check runs (Step 0). If the session crashes
between Step 0 and Step 4, the stale archive actions are performed but never logged — a silent
divergence between what happened and what was recorded.

### 5. What's missing that the requirements didn't mention?

The orchestration SKILL.md fallback entry hardcodes `| interactive | TASK_[ID] | Review |` as the
worker type. The Completion Phase is run by both Completion Workers and Fix Workers (and interactive
sessions). The hardcoded "Review" type is wrong for a Completion Worker running after a Build
Worker. The task specification describes the entry as "a single row in the Workers Spawned table"
but the fallback minimal entry uses a different table structure with no `Session` heading anchor
— it will be a floating table appended to the end of the file, disconnected from any session block.

---

## Critical Issues

### Issue 1: Step 8b commit block includes analytics.md before 8c writes it

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 1016–1022
- **Scenario**: Agent executes Step 8b. The written commands include
  `git add "task-tracking/sessions/{SESSION_ID}/analytics.md"` immediately followed by a
  `git commit`. analytics.md is not yet written — Step 8c writes it. A prose note below the
  commands says to run this "after Step 8c completes" and calls it "Step 8d in practice," but
  the git add + git commit block is written as part of Step 8b, not Step 8d.
- **Impact**: An agent following the written commands commits analytics.md before it exists,
  meaning either the commit is missing analytics.md entirely (if the file doesn't exist yet)
  or commits a blank/partial file (if the session crashed mid-8c). After 8c completes, analytics.md
  is on disk but never staged. It becomes a stale artifact recoverable only by the next session's
  pre-flight check — the very problem this task aims to fix.
- **Evidence**: Step 8b block at line ~1016 adds analytics.md then immediately commits.
  The note at line ~1022 says "Treat this as 'Step 8d' in practice — run it last."
  These two instructions directly contradict each other. The commands win over the note.
- **Fix**: Move the git add + git commit block out of Step 8b entirely. Add a new explicit
  Step 8d section after Step 8c that contains the commit commands. Remove the inline note.
  Step 8b should only write orchestrator-history.md and end. Step 8d runs after 8c and commits
  everything.

### Issue 2: Stale session detection relies on crash-susceptible active-sessions.md

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 296–298
- **Scenario**: The stale archive check is specifically designed to recover from crashed sessions.
  But the liveness check (Step 4–5) reads `active-sessions.md` to determine if a session is live.
  A session that crashed before removing its own row from `active-sessions.md` (step 3 of Session
  Lifecycle "On stop") will still appear in `active-sessions.md`. This means the check will
  classify a crashed (ended) session as "live" and skip archiving it — the exact case that needs
  recovery.
- **Impact**: The pre-flight check silently does nothing for crash-recovered sessions where the
  row was not cleaned up. The stale artifacts remain uncommitted indefinitely. The task's primary
  goal (crash recovery) fails precisely when it matters most.
- **Evidence**: Session Lifecycle "On stop" step 3 says "Remove this session's row from
  active-sessions.md" — if the session crashed, this removal never happened, leaving a stale row
  that the pre-flight check treats as proof of liveness.
- **Fix**: The stale archive check should apply a staleness heuristic beyond just "row present".
  Options: check if the SESSION_ID's log.md has a `SUPERVISOR STOPPED` entry; or check if the
  SESSION_ID directory has a state.md with `Loop Status: STOPPED`; or cross-reference the
  session's start time from the row against a reasonable maximum session duration.

---

## Serious Issues

### Issue 3: git status --short reports untracked directories, not files

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 292–305 (Algorithm steps 1–6)
- **Scenario**: When a session directory has never had any files committed, `git status --short`
  reports `?? task-tracking/sessions/SESSION_ID/` (the directory), not individual files within it.
  The algorithm says "for each uncommitted file under task-tracking/sessions/{SESSION_ID}/" as if
  per-file lines are returned. For brand-new session dirs, there are no per-file lines.
- **Impact**: The SESSION_ID extraction from the directory-level `??` entry will work, but the
  subsequent selective `git add .../log.md`, `git add .../analytics.md` may silently no-op if
  those files were never created (session that created the directory but crashed before writing
  log.md). The commit then either fails with "nothing to commit" (handled by best-effort) or
  produces an incomplete archive. More importantly, if the agent expects per-file entries and
  finds only a directory entry, its SESSION_ID extraction regex may not match correctly depending
  on implementation.
- **Fix**: Document that `??` entries may be at directory level. The algorithm should handle both
  forms: `?? task-tracking/sessions/SESSION_ID/` (directory) and
  ` M task-tracking/sessions/SESSION_ID/log.md` (modified file). Show the extraction pattern for
  both cases explicitly.

### Issue 4: Orchestration SKILL.md fallback entry has wrong worker type

- **File**: `.claude/skills/orchestration/SKILL.md` line ~458
- **Scenario**: When no open session block exists in orchestrator-history.md, the fallback entry
  hardcodes `| interactive | TASK_[ID] | Review | COMPLETE | unknown | unknown |`. The Completion
  Phase runs for any completed task, not just Review workers.
- **Impact**: Build Workers that run the Completion Phase will write a row saying their type is
  "Review." This pollutes the Workers Spawned table with incorrect worker type data, corrupting
  analytics that aggregate by worker type. The quality metric computation in Step 8b reads these
  rows to count Review Workers.
- **Fix**: Use `{worker_type}` placeholder in the fallback entry, or use `Completion` as the
  type (separate from Build/Review), or instruct the worker to write its actual type from context.

---

## Moderate Issues

### Issue 5: Session log entries are written before they can be — timing gap

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 316–325 (Session Log Entries section)
- **Scenario**: The stale archive check runs at Step 0 (before Session Directory creation at
  Step 3). The session log entries for the check are written "After the Session Directory is
  created (Step 3)." If the session fails between Step 0 and Step 3 (e.g., MCP validation fails
  at Step 1 and the session aborts), the stale archive actions occurred but were never logged.
- **Impact**: Low probability but a systematic blind spot. Every other event in the log is written
  synchronously with the action. Only the stale archive check has a deferred log write. This
  violates the log's reliability contract and will mislead post-mortem debugging.
- **Fix**: Consider printing to console as the actions happen (already implemented via Print
  statements) and note that the session log entries are written at Step 4 retroactively. Or add
  a note that if the session aborts before Step 4, the actions can be inferred from console output
  only.

### Issue 6: auto-pilot.md step renumbering is partial

- **File**: `.claude/commands/auto-pilot.md` (diff lines ~45–65)
- **Scenario**: Steps 3a–3c were renumbered to 3b–3d when 3a was repurposed as the stale archive
  check. But the step content of old 3a (now 3b) still begins "Verify `task-tracking/registry.md`
  exists" with no step letter prefix in the prose. Future contributors reading the file will not
  know that 3b was formerly 3a.
- **Impact**: Minor maintenance confusion. Not a runtime failure.
- **Fix**: Minor; low urgency.

### Issue 7: orchestrator-history.md recovery in stale check may create duplicate entries

- **File**: `.claude/skills/auto-pilot/SKILL.md` lines 307–312 (Algorithm step 7)
- **Scenario**: Step 7 commits `orchestrator-history.md` if it has uncommitted changes and "no
  active session is currently writing it." But the check for "no active session currently writing
  it" is not defined. The algorithm defines active sessions as "appears in active-sessions.md,"
  but the Completion Worker appends to orchestrator-history.md as part of its commit — it does
  not register in active-sessions.md as a session. A Completion Worker that is mid-write when the
  stale archive check runs (a concurrent scenario, unlikely but possible) would have its partial
  writes committed mid-operation.
- **Impact**: Low probability in practice since the stale archive check runs at startup before
  any workers are spawned. But the "currently writing" condition is undefined and cannot actually
  be evaluated by the algorithm as specified.
- **Fix**: Clarify that "no active session currently writing it" means simply "no session in
  active-sessions.md has source=auto-pilot" — the pre-flight check only runs before any workers
  are spawned, so the risk is structural rather than real. Add this clarification inline.

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| .gitignore updated for state.md and active-sessions.md | COMPLETE | None |
| Completion Worker and Fix Worker prompts updated to stage orchestrator-history.md | PARTIAL | Only orchestration SKILL.md updated; no separate Fix Worker prompt update visible in diff |
| Supervisor Step 8b runs git add + git commit for session artifacts | PARTIAL | Commit block contradicts itself — analytics.md staged before 8c writes it |
| Commit failure at Step 8b is non-fatal | COMPLETE | Logged and continued |
| Pre-flight stale archive check runs before MCP validation | COMPLETE | Step 0 in Startup Sequence |
| Stale session artifacts from ended sessions committed | PARTIAL | Crash-stale sessions (row still in active-sessions.md) are skipped |
| Active sessions never touched by stale archive check | COMPLETE | Filter by active-sessions.md presence |
| Pre-flight log entries written for each action | PARTIAL | Written at Step 4, not at time of action; deferred logging gap |

### Implicit Requirements NOT Addressed

1. **Fix Worker coverage**: The task says "Completion Worker and Fix Worker prompts updated."
   The diff only shows orchestration SKILL.md (which covers both generically), but it is not
   clear whether the Fix Worker has a separate prompt file that also needed updating. No diff
   touching a separate Fix Worker file is present.
2. **Crash mid-active-sessions.md cleanup**: The primary crash scenario (crashed supervisor
   whose row remains in active-sessions.md) is not recoverable by the stale archive algorithm
   as written.

---

## Failure Mode Analysis

### Failure Mode 1: Crash-stale row blocks recovery

- **Trigger**: Supervisor crashes after writing analytics.md (Step 8c) but before removing its
  row from active-sessions.md (Session Lifecycle "On stop" step 3).
- **Symptoms**: Pre-flight stale archive check on next startup reads active-sessions.md, finds
  the crashed session's row, treats it as live, and skips committing its artifacts.
- **Impact**: Session artifacts (log.md, analytics.md, worker-logs/) remain uncommitted
  indefinitely. The task's stated primary recovery goal is not achieved.
- **Current Handling**: Not handled. The check has no staleness heuristic.
- **Recommendation**: Cross-check session row liveness against the session's state.md
  Loop Status field or the presence of a SUPERVISOR STOPPED log entry.

### Failure Mode 2: analytics.md committed before being written

- **Trigger**: Agent executes Step 8b as written, reaches the git add block, runs
  `git add analytics.md` before 8c has run.
- **Symptoms**: Commit succeeds but analytics.md is absent or incomplete. No error raised.
- **Impact**: Session analytics permanently missing from git history. The file may exist on
  disk later (after 8c) but will appear as a modified unstaged file picked up only by the next
  pre-flight check.
- **Current Handling**: A prose note says to run the commit after 8c, but the code block
  contradicts it.
- **Recommendation**: Separate the commit into an explicit Step 8d, placed after the Step 8c
  section in the document.

### Failure Mode 3: git status reports directory, algorithm expects file paths

- **Trigger**: Stale session directory contains files that have never been tracked by git.
- **Symptoms**: Agent extracts SESSION_ID from directory-level `??` entry, then runs
  `git add .../log.md` — file may not exist if crash was early. Commit produces "nothing to
  commit." Session is logged as archived but nothing was actually committed.
- **Impact**: Silent false positive — system reports successful archive but nothing was committed.
- **Current Handling**: Best-effort catches commit failure, but prints success for the git add.
- **Recommendation**: Document the directory-vs-file `git status` behavior and add a note
  that the git add commands are best-effort themselves.

### Failure Mode 4: Deferred log write lost on early abort

- **Trigger**: Stale archive check succeeds (Step 0), then MCP validation fails (Step 1),
  session aborts without creating Session Directory (Step 3 never runs).
- **Symptoms**: Stale sessions were committed to git but no log entry records this.
  The user sees the commit in git history but the supervisor session log is silent.
- **Impact**: Low severity but debugging confusion.
- **Current Handling**: Not handled; Print statements to console still execute, so the
  information is not fully lost.
- **Recommendation**: Acceptable given best-effort framing. Add a comment that console output
  is the only record if the session aborts before Step 3.

### Failure Mode 5: Wrong worker type in orchestrator-history.md fallback

- **Trigger**: Completion Phase runs in a session with no open `## Session` block in
  orchestrator-history.md (file is empty or only has prior session blocks).
- **Symptoms**: Fallback minimal entry is appended with hardcoded `| Review |` worker type
  regardless of actual worker role.
- **Impact**: Quality metrics computed from orchestrator-history.md (avg review score, worker
  type breakdown) are corrupted for this entry.
- **Current Handling**: None — the hardcoded value is always written.
- **Recommendation**: Replace `Review` with `{worker_type}` or `Completion`.

### Failure Mode 6: "active session writing orchestrator-history.md" check is unverifiable

- **Trigger**: Algorithm step 7 requires checking if an active session is writing
  orchestrator-history.md before committing it.
- **Symptoms**: The check cannot be implemented as specified — no session registers
  "currently writing orchestrator-history.md" anywhere.
- **Impact**: The condition is always vacuously true (no session registers this fact), so
  step 7 always commits. In practice harmless at startup, but the spec is misleading.
- **Current Handling**: Undefined condition — agent must guess at interpretation.
- **Recommendation**: Remove the unverifiable condition and replace with: "commit if the file
  has uncommitted changes; this check runs only at startup before any workers are spawned,
  so concurrent writes cannot occur."

### Failure Mode 7: Stale orchestrate (worker) rows can cause false positive archiving

- **Trigger**: A Build/Review Worker (source=orchestrate) crashed mid-session, leaving its row
  in active-sessions.md. At next startup, the stale archive check reads active-sessions.md and
  looks for the SESSION_ID. The worker's SESSION_ID is in active-sessions.md (source=orchestrate).
  The algorithm checks "if SESSION_ID appears as a row" — it does — so it skips the session.
- **Symptoms**: Worker session artifacts from a crashed Build/Review Worker are never committed.
- **Impact**: Stale worker session logs remain uncommitted.
- **Current Handling**: The Concurrent Session Guard (a separate step) already documents that
  stale orchestrate rows are acceptable and ignored. But the stale archive check does not
  apply the same source=auto-pilot filter.
- **Recommendation**: The stale archive check should only skip sessions whose active-sessions.md
  row has source=auto-pilot. Sessions with source=orchestrate should be treated as ended
  (safe to archive) regardless of whether their row is still present.

---

## Verdict

**Recommendation**: REVISE
**Confidence**: HIGH
**Top Risk**: Step 8b commit block contradicts its own prose note — analytics.md is staged before
Step 8c writes it. This is the highest-confidence defect: a written command sequence overrides
a prose note placed below it. The commit will silently omit or include a partial analytics.md.

## What Robust Implementation Would Include

- An explicit Step 8d section (separate from Step 8b) placed after Step 8c in the document,
  containing the git add + commit commands for session artifacts.
- A staleness heuristic in the stale archive check: cross-reference the session's state.md
  Loop Status or log.md for a SUPERVISOR STOPPED entry to distinguish crashed sessions from
  truly live ones.
- A clarification that `git status --short` returns directory-level entries for fully untracked
  dirs, and that the git add commands are themselves best-effort.
- The source=orchestrate filter in the liveness check (mirror the Concurrent Session Guard logic).
- A corrected worker type in the orchestration SKILL.md fallback entry (`{worker_type}` not
  hardcoded `Review`).
