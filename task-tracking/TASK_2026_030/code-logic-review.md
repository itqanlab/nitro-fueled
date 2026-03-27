# Code Logic Review — TASK_2026_030

## Review Summary

| Field | Value |
|-------|-------|
| Reviewer | code-logic-reviewer |
| Task | TASK_2026_030 |
| Overall Score | 6/10 |
| Assessment | PASS WITH NOTES |
| Critical Issues | 0 |
| Serious Issues | 1 |
| Moderate Issues | 2 |
| Minor Issues | 1 |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

The `git log --since="{spawn_time}"` command in Step 7h (worker log generation) now receives a value like `2026-03-24 10:00:00 +0200` stored in state.md. Git accepts this format and handles it correctly (verified). However, the `{session_start_datetime}` placeholder used in Step 8c's `git log --since` for counting new review lessons is described as "Use the Session Started timestamp from `{SESSION_DIR}state.md`." That field is now `YYYY-MM-DD HH:MM:SS +ZZZZ` — git accepts this, so no silent failure here.

The one place where silent failure can occur is `completion_timestamp` (Step 7d line 573). This field is recorded in `{SESSION_DIR}state.md` completed tasks table, and the state.md format template shows it as `YYYY-MM-DD HH:MM:SS +ZZZZ` (line 1141). The variable name is mentioned in prose only without format instruction — the developer writing the implementation has to infer it must match. This is an implicit gap, not a failure mode, but it means an inattentive implementer could write bare UTC here.

### 2. What user action causes unexpected behavior?

No user-triggered action causes a specific failure from the timestamp changes alone. The changes are instructions to the LLM acting as Supervisor — they can be misread or partially followed, but this is not a logic flaw in the instructions themselves.

### 3. What data makes this produce wrong results?

The `git log --since` behavior with a timezone-offset-bearing timestamp has a subtle edge: git interprets the timestamp relative to the timezone given, which is the correct and desired behavior. However, the comment on line 613 still says "ISO-format spawn timestamp" — ISO 8601 commonly implies UTC (`T` separator, `Z` suffix) or explicitly includes offset. The actual format being stored is `YYYY-MM-DD HH:MM:SS +ZZZZ` (with a space separator, not `T`). Git handles this fine, but the word "ISO-format" in the prose is now a minor mismatch with what is actually stored.

### 4. What happens when dependencies fail?

Not applicable to this documentation-only change. No runtime dependencies are introduced or removed.

### 5. What's missing that the requirements didn't mention?

The task acceptance criterion "Worker log filenames use local time with offset" is not addressed. The worker-logs directory uses `{label}.md` as filenames (e.g., `TASK_2026_003-FEATURE-BUILD.md`), which are not timestamps at all. The original BUG-5/ENH-8 complaint referenced `.worker-logs/` files using ISO UTC format (`T18-05-39-178Z`) in their *names*. The current SKILL.md writes worker logs to `{SESSION_DIR}worker-logs/{label}.md` — label-based, not timestamp-based. There is no timestamp in the filename at all. This is a **different design** from what the task described, but it is the correct design (label-based names are unambiguous). The acceptance criterion is de facto satisfied by absence (no UTC timestamp in filenames), but the task's framing does not match the reality, which means the criterion cannot truly be ticked off without a note explaining why the concern no longer applies.

---

## Findings

### [SERIOUS] `active-sessions.md` Started column uses bare `{HH:MM}` with no date or timezone

**Location**: Lines 240, 241, 254, 257 of SKILL.md

The `active-sessions.md` row format specifies `| {HH:MM} |` for the `Started` column, with no date and no timezone offset. The example shows `22:00` and `22:05`. This file is a live registry used by the Concurrent Session Guard (Step 263–273) to detect a running auto-pilot session and warn the user. It is also used for compaction recovery to identify the correct session row (line 303).

The Concurrent Session Guard reads this file and matches on source `auto-pilot` — it does not parse the `Started` column at all, so the guard logic is unaffected. However, the compaction recovery logic at line 303 says "Find the row matching source `auto-pilot` and the startup timestamp that matches when this session began." If the `Started` column is only `HH:MM`, a supervisor running for more than a day (or any case where startup time is ambiguous) could match the wrong row. The `SESSION_ID` column already encodes `YYYY-MM-DD_HH-MM-SS`, so an implementer would likely use that for matching — but the instructions say "matching...the startup timestamp," which points at the `Started` column.

The broader issue: this file was not updated by this task to include timezone offset in the `Started` column, even though the General Note on line 176 states "All datetime fields written inside session files must include the local timezone offset." The `active-sessions.md` format shows `{HH:MM}` — no date, no offset. It is inconsistent with the directive just added.

**Recommendation**: Update the `active-sessions.md` row format to use `{HH:MM+ZZZZ}` (matching the orchestrator-history.md header convention) or `{YYYY-MM-DD HH:MM:SS +ZZZZ}`. Also clarify that compaction recovery should match on `SESSION_ID`, not on `Started`.

---

### [MODERATE] `analytics.md` datetime placeholders have no format guidance

**Location**: Lines 788–789 of SKILL.md

The analytics.md template uses `{current_datetime}`, `{session_start_time}`, and `{session_stop_time}` as placeholders with no format guidance inline. The Step 8c prose says "Use the Session Started timestamp from `{SESSION_DIR}state.md`" for one of these, which is now `YYYY-MM-DD HH:MM:SS +ZZZZ` — correct. However, `{current_datetime}` (Generated field) and `{session_stop_time}` have no format note. An implementer could write these in any format.

The Session Lifecycle note on line 203 and the worker log blockquote on line 641 provide format guidance at their respective points, but Step 8c has no equivalent reminder. A reader implementing Step 8c without reading the whole file would have no indication that `{current_datetime}` should include timezone offset.

**Recommendation**: Add a format note to Step 8c similar to the one at line 641: "All datetime fields must use local time with timezone offset (`YYYY-MM-DD HH:MM:SS +ZZZZ`)."

---

### [MODERATE] `completion_timestamp` in Step 7d has no format instruction

**Location**: Line 573 of SKILL.md

Step 7d records `task_id, completion_timestamp` into the Completed Tasks table in state.md. The state.md format template (line 1141) shows the correct format `2026-03-24 10:45:00 +0200`. However, Step 7d itself gives no format instruction — it simply says "Record: task_id, completion_timestamp." There is no cross-reference to the state.md format section or the Session Lifecycle note.

An implementer following only Step 7d in isolation would not know what format to use for `completion_timestamp`. The Session Lifecycle note at line 203 only applies explicitly to "state.md or worker logs," so it partially covers this, but the connection is indirect.

**Recommendation**: Either inline a format reminder in Step 7d, or add a parenthetical: `completion_timestamp` (format: `YYYY-MM-DD HH:MM:SS +ZZZZ`).

---

### [MINOR] Word "ISO-format" in Step 7h sub-step 3 is now misleading

**Location**: Line 613 of SKILL.md

The instruction says: "Replace... `{spawn_time}` with the **ISO-format** spawn timestamp from state.md." The actual format stored is `YYYY-MM-DD HH:MM:SS +ZZZZ` (space separator, no `T`, no `Z` suffix). Strict ISO 8601 extended format would be `2026-03-24T10:00:00+02:00`. What is stored is git's native datetime format, not pure ISO 8601.

This is a documentation accuracy issue, not a functional problem — git accepts the stored format for `--since`. However, a developer may try to "normalize" to strict ISO 8601 if they see "ISO-format," which would change the format.

**Recommendation**: Replace "ISO-format" with "the exact spawn timestamp" or "local time with timezone offset" to match the vocabulary used everywhere else in the updated file.

---

## Acceptance Criteria Check

| Criterion | Status | Notes |
|-----------|--------|-------|
| All orchestrator-state.md timestamps include timezone offset | COMPLETE | `Last Updated`, `Session Started` (lines 1110–1111) and Active Workers `Spawn Time`, Completed Tasks `Completed At` examples all show `+0200`. |
| All orchestrator-history.md timestamps include timezone offset | COMPLETE | Session header now uses `HH:MM+ZZZZ — HH:MM+ZZZZ` (line 711). |
| Worker log filenames use local time with offset (or at least match orchestrator state) | NOT APPLICABLE | Worker logs use label-based filenames (`{label}.md`), not timestamp-based. The UTC timestamp filename concern from BUG-5 does not apply to this design. The criterion is satisfied by design, but the task.md framing is stale. |
| Auto-pilot skill instructions specify the timestamp format to use | COMPLETE | Session Lifecycle step 1 (line 203), Session Directory general note (line 176), and worker log metadata blockquote (line 641) all specify `YYYY-MM-DD HH:MM:SS +ZZZZ`. |
| Timestamps are consistent with git log output when compared side-by-side | COMPLETE | `date '+%Y-%m-%d %H:%M:%S %z'` on macOS produces `+0200` format (no colon), matching git's default output. |

---

## `date` Command Verification

`date '+%Y-%m-%d %H:%M:%S %z'` on macOS (darwin) produces: `2026-03-27 07:06:10 +0200`

- `%z` gives `+0200` (no colon). This is the POSIX format.
- Git's `--since` accepts this format. Verified by running `git log --since="2026-03-24 10:00:00 +0200"` against this repository — it returned results without error.
- No format mismatch between `date %z` output and git log format.

---

## Gap Analysis: Affected Locations from task.md

| Location | Addressed | Notes |
|----------|-----------|-------|
| `orchestrator-state.md` — Session Started, Last Updated, Session Log timestamps | YES | state.md template updated. Log timestamps remain `{HH:MM:SS}` (time only, no date) — this is correct by design for log rows. |
| `orchestrator-history.md` — Session header, Event Log timestamps | PARTIAL | Session header updated to `HH:MM+ZZZZ`. Event Log copies from `{SESSION_DIR}log.md` which uses `{HH:MM:SS}` — this is acceptable since log rows have always been time-only. |
| `.worker-logs/` — log file names use ISO UTC format | NOT APPLICABLE | SKILL.md uses label-based filenames, not timestamp-based. This concern predates the current design. |
| Worker spawn/kill messages in auto-pilot SKILL.md | YES | All log row formats use `{HH:MM:SS}` (no date, no timezone) — this is intentional for the log event table which already has the session date in its header. Spawn time stored in state.md Active Workers table now includes `+0200`. |

---

## Verdict

**PASS WITH NOTES**

The core concern — bare timestamps in `orchestrator-state.md` lacking timezone offset — is correctly fixed. The `date` command is accurate on macOS, git accepts the format, and the two most-used datetime fields (state.md, worker log metadata) have clear format guidance.

Three format-guidance gaps remain: `active-sessions.md` Started column is inconsistent with the "all datetime fields must include timezone offset" directive (serious), and two implicit datetime placeholders in Step 7d and Step 8c lack inline format reminders (moderate). None of these are blockers — the general directive at line 176 covers them in principle, and the examples in state.md format show the correct output. An attentive implementer following the full document will produce correct output.

The "ISO-format" wording in Step 7h is a minor documentation accuracy issue with no functional impact.

**Top Risk**: The `active-sessions.md` `Started` column remains `{HH:MM}` with no timezone. If this file is ever used for cross-timezone debugging or programmatic matching, the ambiguity will surface. For current use (human-readable display + simple string matching on SESSION_ID), the risk is low.
