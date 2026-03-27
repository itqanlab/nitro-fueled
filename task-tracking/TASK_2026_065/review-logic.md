# Code Logic Review — TASK_2026_065

## Review Summary

| Field | Value |
|-------|-------|
| Overall Score | 6/10 |
| Acceptance Criteria Met | 3/4 |
| Issues Found | 5 |

## Verdict

PASS WITH NOTES

---

## Findings

### 1. Duration override logic is ambiguous — Step 2 still computes from spawn_time regardless (MAJOR)

**File**: `.claude/skills/auto-pilot/SKILL.md`
**Location**: Step 7h, sub-steps 1 and 2

**Problem**: Step 7h.1 says: "extract the `Duration` row value and use it in Step 2 instead of computing from spawn_time". Step 7h.2 then unconditionally says: "`duration_minutes = round((current_time - spawn_time) / 60)`". An LLM orchestrator executing these instructions in order will compute duration from spawn_time in Step 2 regardless, because Step 2 has no conditional branch. The cross-reference from Step 1 ("use it in Step 2") relies on the executor remembering an earlier instruction and overriding a later, unconditional one. In practice this override is likely to be ignored.

**Fix**: Step 7h.2 should be written as a conditional: "If `session-analytics.md` provided a Duration value in Step 1, use that. Otherwise compute: `duration_minutes = round((current_time - spawn_time) / 60)`."

---

### 2. "Manual stop" exit path is described in the task but not explicitly covered in SKILL.md (MAJOR)

**File**: `.claude/skills/orchestration/SKILL.md`
**Location**: `## Session Analytics` — "When to Write" section

**Problem**: The task description says: "The file is written on every exit path: success, failure, stuck kill, and **manual stop**." The `## Session Analytics` section lists three paths: success, failure, stuck/kill. Manual stop is not listed. There is no instruction covering what happens when the user cancels or interrupts the session mid-orchestration (e.g., Ctrl+C or session timeout without a stuck kill). This is also the most common non-success exit in practice and the one most likely to produce an incomplete analytics file.

**Fix**: Add a fourth bullet to "When to Write": "**Manual stop**: Write before exiting when the user or system interrupts the session without a stuck/kill signal."

---

### 3. "Include session-analytics.md in the bookkeeping commit" is documented in tasks.md but not in SKILL.md (MINOR)

**File**: `.claude/skills/orchestration/SKILL.md`
**Location**: `## Session Analytics` — "When to Write", success path bullet; `## Completion Phase` — Step 4 Final Commit

**Problem**: The `## Session Analytics` success-path bullet correctly says: "include `session-analytics.md` in that commit." However, the `## Completion Phase` Step 4 Final Commit section says: "Commit all bookkeeping changes with message: `docs: add TASK_[ID] completion bookkeeping`" without explicitly naming `session-analytics.md` in the list of files. The task spec (tasks.md Task 1.1, last rule) explicitly required: "Also add a reference to session-analytics.md in the Completion Phase section (step 4 Final Commit)." This reference was not added to the Completion Phase section itself, only to the `## Session Analytics` section. An orchestrator executing the Completion Phase and not reading Session Analytics first will miss the file.

**Fix**: Add `session-analytics.md` to the Completion Phase Step 4 Final Commit guidance so it is listed alongside `completion-report.md` and `status`.

---

### 4. Outcome field can be written before the actual outcome is known on the success path (MINOR)

**File**: `.claude/skills/orchestration/SKILL.md`
**Location**: `## Session Analytics` — Field Derivation table, Outcome row

**Problem**: The Outcome derivation says: "`COMPLETE` (after Completion Phase)". On the success path the file is written "immediately after the Completion Phase bookkeeping commit" — which is correct. However, the Session Analytics section is generic and applies to all exit paths. On failure and stuck paths the Outcome is straightforward (`FAILED`, `STUCK`). On the success path, `IMPLEMENTED` vs `COMPLETE` is a meaningful distinction (Build Worker stopped after dev vs full pipeline). There is no guidance about which value to write for a Build Worker stopping after implementation in Supervisor mode (the Build Worker scope note says it stops after dev). A Build Worker following these instructions could write `COMPLETE` (after its own exit) even though the correct outcome would be `IMPLEMENTED`.

**Fix**: Add a note to the Outcome field derivation clarifying: "Build Workers (Supervisor mode) write `IMPLEMENTED`; full-pipeline sessions write `COMPLETE` after the Completion Phase."

---

### 5. Files Modified git command is duplicated with slightly different derivation context — potential confusion (MINOR)

**File**: `.claude/skills/orchestration/SKILL.md`
**Location**: `## Session Analytics` — Field Derivation table, Files Modified row

**Problem**: The Files Modified derivation in the orchestration SKILL.md uses `--since="{start_time}"` where `{start_time}` is the session start time. Step 7h.3 in auto-pilot SKILL.md uses `--since="{spawn_time}"` where `{spawn_time}` is from state.md. These are semantically equivalent but sourced differently. When session-analytics.md is the fallback, the Supervisor is reading the pre-computed Files Modified from session-analytics.md — except it is NOT reading Files Modified from session-analytics.md (Step 7h.1 only reads Duration and Outcome). The Supervisor re-runs its own git command to derive Files Modified independently. This means session-analytics.md's Files Modified count is never used by the Supervisor worker-log writer; only Duration and Outcome are. This is fine in isolation, but the analytics file format contains a Files Modified field that has no consumer besides human readers. Not a bug, but worth noting to avoid confusion about what the fallback actually covers.

No fix required — document the scope clearly. The fallback extracts only Duration and Outcome; Files Modified in session-analytics.md is informational only.

---

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| After any `/orchestrate` run, `task-tracking/TASK_YYYY_NNN/session-analytics.md` exists | PASS — Section Analytics section instructs write on all paths |
| File contains Outcome, Start Time, End Time, Duration, and Phases Completed | PASS — All five fields are present in the defined format |
| File is written on all exit paths: success, failure, and stuck/killed | PARTIAL — Manual stop path is absent from the "When to Write" list (Finding 2) |
| Supervisor Step 7h reads session-analytics.md as fallback — Duration and Outcome in worker-log instead of "unknown" | PARTIAL — Fallback logic exists but the Duration override in Step 2 is not conditional, making it likely to be ignored in practice (Finding 1) |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The Duration override (Finding 1) fails silently: Step 7h.1 extracts Duration from session-analytics.md, but Step 7h.2 overwrites it unconditionally with a computed value. The worker log will contain the computed duration, not the session-analytics value, with no error or warning. The Supervisor will not know the override was lost.

### 2. What user action causes unexpected behavior?

A user who manually cancels an `/orchestrate` run (Ctrl+C, session timeout, or workspace close) does not trigger the manual stop write path because it is not defined. The task folder will have no session-analytics.md. The Supervisor fallback will then fall through to `"unknown"` for both Duration and Outcome — defeating the purpose of the feature.

### 3. What data makes this produce wrong results?

A Build Worker operating in Supervisor mode writes session-analytics.md with `Outcome = COMPLETE` (following the Outcome field derivation literally), but the correct value for a Build Worker is `IMPLEMENTED`. The Supervisor's worker-log will then record `COMPLETE` for a task that is actually only `IMPLEMENTED`, corrupting the audit trail.

### 4. What happens when dependencies fail?

If the `date` command fails (unusual but possible in restricted environments), Start Time and End Time cannot be derived, which means Duration cannot be computed. There is no fallback for this case; the instruction says to run `date '+%Y-%m-%d %H:%M:%S %z'` but does not say what to write if that command fails. The Session Logging section has the same dependency and no fallback either, but that is pre-existing. Recommendation: write `"unknown"` for all time fields if date fails.

### 5. What's missing that the requirements didn't mention?

The requirements do not address the case where session-analytics.md already exists from a prior Build Worker run when a Review Worker (or Completion Worker) runs the same task. The Completion Worker will overwrite the file with its own analytics, losing the Build Worker's data. If the intent is to capture per-worker analytics, this is a data loss scenario. If the intent is one file per task representing the final state, the overwrite is correct — but this is not documented.
