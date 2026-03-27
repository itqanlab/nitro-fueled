# Code Logic Review — TASK_2026_032

## Review Summary

| Metric              | Value                |
| ------------------- | -------------------- |
| Overall Score       | 6/10                 |
| Assessment          | NEEDS_REVISION       |
| Blocking Issues     | 2                    |
| Serious Issues      | 4                    |
| Major Issues        | 3                    |
| Minor Issues        | 3                    |
| Failure Modes Found | 9                    |

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

Step 7h sub-step 3 runs `git log --grep="TASK_X"` to enumerate files modified. This looks at the entire project history, not just commits made during this worker's session. A task that was partially implemented in a prior session will have its old commits show up here — the worker log will list files from months ago alongside files from the current run. The file count fed into analytics will be inflated with no indication it is wrong. There is no timestamp bound on the git query.

Step 8c sub-step 1 parses worker log files by counting lines starting with `- ` in the Files Modified section. If a file path happens to begin with `- ` as part of a note (e.g., `- No committed files detected.`) the count picks up that line as one file. This is a silent miscounting.

Step 8c sub-step 6 runs a git command to count review lesson files updated. The `--since` flag requires the session start datetime in a format git understands (ISO 8601 or a git-recognized string). The session start is stored in `state.md` as a human-readable timestamp whose exact format is never defined in the spec. If the stored format does not match what git expects, the command silently returns 0 instead of erroring.

### 2. What user action causes unexpected behavior?

Running `/auto-pilot` immediately after a previous session on the same tasks causes Step 7h to write inflated files-modified lists. The git log grep has no session-scope boundary — it returns all commits for that task ever, not just those made by the current worker. A user running the same task twice (retry scenario) gets a combined file list from both runs.

A user examining `analytics.md` after a session that had Cleanup Workers will find no Cleanup Worker entries in the Per-Task Breakdown (the table only has Build Cost / Review Cost columns) even though Cleanup Workers may have their own worker log files and cost. The cost of salvage operations disappears from the analytics.

### 3. What data makes this produce wrong results?

A task that went through multiple retries will have multiple Build Worker log files. Step 8c sub-step 3 says "find its Build Worker log (if any)" implying a single log per task per type. With retries, there can be two or three Build Worker logs for the same task. The spec does not say which one to use (the last one? sum them? take the latest?). This leaves cost and duration for retried tasks undefined, and different implementations of this agent will produce different results.

If `get_worker_stats` returns partial data (e.g., tokens populated but cost is null/missing rather than absent), sub-step 1 says to set values to `"unknown"` only if "the call fails or worker_id is unavailable." A call that succeeds with a null cost field is not a failure — but the value is unusable. The cost aggregation in Step 8c will then silently treat a null as a non-unknown value and may produce a nonsensical sum or a parse error.

A Cleanup Worker that completes after the Worker Recovery Protocol in Step 7e: Step 7h fires for every worker completion "successful or failed." A Cleanup Worker completing is a worker completion event. The spec does not explicitly say whether 7h should run for Cleanup Workers. The worker log template shows `Worker Type: Build | Review | Cleanup` which implies it should, but the log event format at line 126 shows `WORKER LOG — TASK_X ({Build|Review})` which excludes Cleanup. This ambiguity means an agent implementing this spec may or may not write Cleanup Worker logs, and the analytics will be inconsistent between runs.

### 4. What happens when dependencies fail?

If `get_worker_stats` is called after a worker has exited and the MCP server has already freed the worker record, the call may return a not-found error rather than the final stats. Step 7h correctly says to fall back to `"unknown"` in that case, but the timing window is real — the spec calls `get_worker_stats` at Step 7h which runs after state transition is confirmed in 7d/7e, meaning the worker process has already stopped. MCP server implementations that clean up worker records quickly will produce all-unknown stats regularly. There is no guidance to call `get_worker_stats` earlier (at the moment of state transition detection) when the worker is more likely to still be registered.

If `{SESSION_DIR}worker-logs/` does not exist and `mkdir -p` fails (permissions), Step 7h sub-step 0 will fail. Step 7h sub-step 8 says "if any sub-step fails, log WORKER LOG FAILED." But the directory creation is sub-step 0, before any logging to the session log is attempted. There is no guidance on whether the WORKER LOG FAILED event can still be written if the very first sub-step fails. In practice the log.md write would still succeed (it is a different file), but the spec does not make this clear.

If the session is stopped via compaction limit or MCP unreachable, Step 8c still runs ("on every session stop — normal, compaction limit, MCP unreachable, or manual"). In the MCP unreachable case, list_workers and get_worker_stats would also be unavailable, so any worker that was still active at the time of the forced stop will have no worker log at all — Step 7h would not have fired for them because they never reached a completion state. Step 8c will then aggregate from incomplete worker log data with no indication that active workers were dropped. The analytics will show their costs as missing without a note explaining why.

### 5. What's missing that the requirements didn't mention?

The task description says `session-analytics.md` should be generated in `task-tracking/`. The implementation writes it to `{SESSION_DIR}analytics.md` (inside the session directory). This is a naming and location divergence from the acceptance criteria. A user looking for the analytics file at `task-tracking/session-analytics.md` will not find it.

The acceptance criterion "Review worker logs include initial review score" is not met. Step 7h collects Review Verdicts (PASS/FAIL/etc.) but not a numeric score. The task.md description says "initial score before fixes" — this is a numerical review score (e.g., 7.4/10) that reviewers embed in their review files. The spec only extracts the `**Verdict**:` line, not any score metric. This is a gap.

There is no de-duplication of Cleanup Worker costs from task-level cost totals. If a Cleanup Worker runs for TASK_X and 8c adds a Build Worker cost + Cleanup Worker cost under TASK_X, the per-task total in the breakdown will be higher than the "real" development cost. The analytics would be more useful if Cleanup Workers were broken out separately.

---

## Failure Mode Analysis

### Failure Mode 1: Unbounded git history inflates files-modified lists

- **Trigger**: Any task that was touched in a prior session. Step 7h runs `git log --grep="TASK_X"` with no `--since` or commit range bound.
- **Symptoms**: Worker log shows files from months-old commits. analytics.md shows a total files changed count larger than actual session output.
- **Impact**: Analytics data is misleading. Efficiency metrics (tokens per file, cost per task) are based on wrong denominators.
- **Current Handling**: No bound. No note that this is cumulative.
- **Recommendation**: Bound the git query to the worker's spawn time: `git log --since="{spawn_time}" --grep="TASK_X"`. Alternatively, use `git log {spawn_commit}..HEAD --grep="TASK_X"` where spawn_commit is captured at worker spawn time.

### Failure Mode 2: Cleanup Workers excluded from log events but included in log format

- **Trigger**: A Cleanup Worker completes after the Worker Recovery Protocol fires.
- **Symptoms**: The WORKER LOG session event format is `TASK_X ({Build|Review})` — Cleanup is absent. The worker log template header says `Build | Review | Cleanup`. These are contradictory. An agent will produce either a malformed log event (adding Cleanup anyway) or skip writing the Cleanup Worker log.
- **Impact**: Cleanup costs are invisible in analytics. Steps 7h and 8c produce inconsistent data for sessions with recovery operations.
- **Current Handling**: Unresolved contradiction between line 126 (event format) and the template at line 622 (Worker Type field).
- **Recommendation**: Decide explicitly: either Cleanup Workers get a log entry (add `Cleanup` to the event format at line 126) or they do not (remove `Cleanup` from the template Worker Type options). Document the decision explicitly.

### Failure Mode 3: Multiple Build/Review Worker logs per task break Step 8c aggregation

- **Trigger**: Any task that was retried. Step 5b spawns a new Build Worker for TASK_X if retry_count <= retry_limit. Step 7h writes a log file per worker. Two Build Worker log files for the same task exist.
- **Symptoms**: Step 8c sub-step 3 says "Find its Build Worker log (if any)" — singular. With multiple logs, the implementation picks one arbitrarily (likely alphabetically first or last). Cost, duration, and tokens for retried tasks are systematically wrong.
- **Impact**: Analytics misrepresent the actual cost of tasks that required retries. Retry costs are either double-counted or dropped.
- **Current Handling**: Not addressed. The spec assumes one Build Worker and one Review Worker per task.
- **Recommendation**: Define an explicit aggregation rule: either sum all Build Worker logs for a task, or use the latest one. Also add a column to the Per-Task Breakdown to show retry worker costs separately.

### Failure Mode 4: `get_worker_stats` called after worker has likely been freed

- **Trigger**: Normal worker completion. Step 7h fires after state transition is confirmed, which happens after the worker has already exited.
- **Symptoms**: MCP returns not-found or error; stats fallback to `"unknown"` for most or all workers in fast-cleanup MCP environments.
- **Impact**: Analytics show unknown cost/tokens for all workers despite the session completing successfully.
- **Current Handling**: Fallback to `"unknown"` is correct for the file, but the timing of the call is suboptimal.
- **Recommendation**: Call `get_worker_stats` at the earliest possible point when the worker's health transitions to `finished` in Step 6, and cache the result. Use the cached stats in Step 7h rather than making a post-mortem call.

### Failure Mode 5: "initial review score" acceptance criterion is not implemented

- **Trigger**: Any review session.
- **Symptoms**: Worker logs contain only the verdict (PASS/FAIL) — not the numeric score from the review report. Task.md AC2 requires "initial review score."
- **Impact**: The acceptance criterion is not met. The analytics Review Quality section shows only counts by verdict, not score distributions.
- **Current Handling**: Not implemented. The grep pattern searches for `**Verdict**:` but review files also contain score lines (e.g., `Overall Score: 7.4/10`).
- **Recommendation**: Add a sub-step to extract the numeric score from review files. Search for patterns like `Overall Score:` or `Score: X/10` and store it alongside the verdict.

### Failure Mode 6: analytics.md location diverges from task.md requirement

- **Trigger**: Every session stop.
- **Symptoms**: analytics.md is written to `{SESSION_DIR}analytics.md`. The task.md description says "generate a `session-analytics.md` in `task-tracking/`."
- **Impact**: One acceptance criterion ("session-analytics.md generated at supervisor stop") tests for a file in a location that this implementation does not produce.
- **Current Handling**: The session directory table (line 191) documents `analytics.md` inside `{SESSION_DIR}` as the intended behavior. The task requirement says `task-tracking/`. These are in direct conflict.
- **Recommendation**: Clarify the canonical output path. If the intent is to place it inside the session directory, the task.md acceptance criterion needs updating. If the intent is a top-level `task-tracking/session-analytics.md`, Step 8c needs to write there instead (or in addition).

---

## Critical Issues

### Issue 1: "Initial review score" not captured — AC2 unmet

- **File**: `/Volumes/SanDiskSSD/mine/nitro-fueled/.claude/skills/auto-pilot/SKILL.md`, Step 7h sub-step 5
- **Scenario**: After a Review Worker completes, 7h collects `**Verdict**:` from review files. But no numeric score is extracted.
- **Impact**: Acceptance criterion 2 ("Review worker logs include initial review score") is not implemented. Users cannot see score trends across sessions.
- **Evidence**: Sub-step 5 searches for `**Verdict**:` only. No search pattern for a score.
- **Fix**: Add extraction of a score line (e.g., `| Overall Score |` from the Review Summary table) per review file. Store as a new column in the Review Verdicts table.

### Issue 2: Output file location contradicts task requirement

- **File**: Step 8c sub-step 8
- **Scenario**: Step 8c writes `{SESSION_DIR}analytics.md`. The task.md description specifies `task-tracking/session-analytics.md`.
- **Impact**: If the acceptance criterion is tested by looking for `task-tracking/session-analytics.md`, the test fails. The file exists but at an undocumented location.
- **Evidence**: task.md line 27: "generate a `session-analytics.md` in `task-tracking/`". SKILL.md line 191 and 766: `{SESSION_DIR}analytics.md`.
- **Fix**: Either reconcile the task.md description with the implementation (note that session-scoped analytics live in the session dir) or add a symlink/copy step. Either way, one of the two documents must change so they agree.

---

## Serious Issues

### Issue 3: Cleanup Worker handling is ambiguous and contradictory

- **File**: SKILL.md line 126 (log event format) vs line 622 (worker log template Worker Type field)
- **Scenario**: A Cleanup Worker completes. Does Step 7h fire? The template says Worker Type can be "Cleanup." The log event format excludes Cleanup from the `{Build|Review}` interpolation.
- **Impact**: Agents reading this spec produce different behavior. Analytics either include or exclude Cleanup costs with no deterministic rule.
- **Fix**: Add a definitive sentence to Step 7h opener: "Write a worker log for Build and Review Workers. Cleanup Worker log writing is optional — if written, use the same format but omit Phase Timeline; log the event as `WORKER LOG — TASK_X (Cleanup): {duration}m, ${cost_usd}`." Update line 126 to add `|Cleanup` to the event format.

### Issue 4: Multi-retry per-task aggregation rule undefined

- **File**: SKILL.md, Step 8c sub-step 3
- **Scenario**: A task is retried once. Two Build Worker log files exist. Step 8c says "find its Build Worker log (if any)" — undefined behavior when multiple exist.
- **Impact**: Cost, duration, and token data for retried tasks are deterministically wrong because the aggregation rule is missing.
- **Fix**: State explicitly: "If multiple Build (or Review) Worker logs exist for the same task, sum their Cost and Duration values and use the latest Total Tokens reading. Record the count in a new Retry Workers column."

### Issue 5: Unbounded git history pollutes files-modified counts

- **File**: SKILL.md, Step 7h sub-step 3
- **Scenario**: Task was previously implemented in an older session. Step 7h runs `git log --grep="TASK_X"` and picks up all commits across the project's lifetime.
- **Impact**: Files Modified lists are wrong. All efficiency metrics derived from file counts are unreliable.
- **Fix**: Bound the query with `--since="{spawn_time_iso}"` using the spawn time stored in state.md, or narrow to a commit range. Document the exact format expected for spawn_time in state.md to make the interpolation reliable.

### Issue 6: `get_worker_stats` timing window — stats likely unavailable

- **File**: SKILL.md, Step 7h sub-step 1
- **Scenario**: Step 7h fires after state transition confirmed in 7d/7e. The worker process has already exited. MCP may have freed the worker record.
- **Impact**: All worker stats default to `"unknown"`. Analytics shows no cost or token data for any worker.
- **Fix**: Call `get_worker_stats` immediately when health transitions to `finished` in Step 6 (monitoring loop) and cache the result. Pass the cached stats to Step 7h. Add a note to sub-step 1 that if stats are cached, use the cache and skip the MCP call.

---

## Major Issues

### Issue 7: Null/missing cost field not handled (partial stats response)

- **File**: SKILL.md, Step 7h sub-step 1
- **Scenario**: `get_worker_stats` returns a response (call succeeds) but `cost.total_usd` is null or absent.
- **Impact**: The fallback to `"unknown"` does not trigger (call did not fail). The cost value written to the log is null. Step 8c tries to sum it and produces a parse error or silent zero.
- **Fix**: Extend the fallback condition to: "If the call fails, worker_id is unavailable, **or any field is null/missing**, set that field to `"unknown"`."

### Issue 8: Session start timestamp format for git `--since` is undefined

- **File**: SKILL.md, Step 8c sub-step 6
- **Scenario**: The git command uses `--since="{session_start_datetime}"`. The format of session_start_datetime stored in state.md is never defined in the spec.
- **Impact**: If state.md writes the timestamp in a format like `2026-03-27 14:30:00` (with a space), git may or may not accept it. If the format is wrong, the command returns 0 lessons detected silently.
- **Fix**: Define the canonical timestamp format for state.md Session Started field (recommend ISO 8601: `2026-03-27T14:30:00`). Reference that format explicitly in sub-step 6.

### Issue 9: Files Modified line-counting regex picks up the "No committed files" line

- **File**: SKILL.md, Step 8c sub-step 1
- **Scenario**: Worker log Files Modified section contains `No committed files detected.` (no bullet prefix). This is fine. But if a note or comment starts with `- ` for any other reason, it would be counted. More immediately: if the fallback text ever changes to a bulleted form, the count breaks.
- **Impact**: Total files changed in analytics is silently wrong.
- **Fix**: Add a note to sub-step 1: "Count only lines in the Files Modified section that start with `- ` AND do not equal the literal string `- No committed files detected.`". Better: use a unique sentinel like `(none)` instead of a list item.

---

## Minor Issues

### Minor 1: "Lessons Generated" metric counts files, not lesson entries

Step 8c sub-step 6 counts unique file paths under `.claude/review-lessons/` that were modified since session start. This is "lesson files updated" (correct for the metric label in the output template), but the task description says "lessons generated count" — implying individual lesson entries, not files. Since multiple lessons can be appended to one file in one session, the count undershoots. The metric label in the output template ("Review Lesson Files Updated This Session") is more accurate than the task description. This is a low-risk discrepancy but worth noting.

### Minor 2: WORKER LOG FAILED log format has no Cleanup type in event table

Line 126 in the log event table defines WORKER LOG as `{Build|Review}`. Line 127 defines WORKER LOG FAILED as `TASK_X: {reason}` with no worker type. If Cleanup Workers do write logs, a Cleanup log failure would not be distinguishable from a Build or Review log failure in the session log. Minor observability gap.

### Minor 3: Phase Timeline section for Review and Cleanup Workers

Step 7h sub-step 4 says "Get phase timestamps (Build Workers only)." The worker log template has `## Phase Timeline (Build Workers)` with a note to omit it for non-Build workers. The template heading itself says "Build Workers" and the omit instruction is clear. This is fine, but the omit instruction is embedded in a comment (`{Omit rows...}`) that is part of the template body — agents writing this section must remember not to output the comment literally. A separate "If Review Worker: omit Phase Timeline section entirely" note in sub-step 4 would be clearer.

---

## Data Flow Analysis

```
[Worker exits / MCP reports health=finished]
         |
         v
[Step 6: Monitor health] <-- TIMING GAP: get_worker_stats should be called HERE
         |                   before worker record may be freed
         v
[Step 7: Handle completions]
  7b. Determine state transition
  7c. Validate state transition
  7d/7e. Process success or failure
         |
         v
[Step 7h: Write worker log]
  sub-step 1: get_worker_stats(worker_id) <-- RISK: worker may already be freed
  sub-step 2: compute duration from state.md spawn_time
  sub-step 3: git log --grep="TASK_X" <-- RISK: no time bound; picks up all history
  sub-step 4: read log.md for phase events (Build only)
  sub-step 5: read review files for verdicts (Review only) <-- MISSING: no score extraction
  sub-step 6: write {SESSION_DIR}worker-logs/{label}.md
  sub-step 7: log WORKER LOG event (excludes Cleanup type) <-- GAP: Cleanup ambiguous
  sub-step 8: on failure, log WORKER LOG FAILED and continue
         |
         v
[Step 8: Termination check]
[Step 8b: Write orchestrator-history.md]
         |
         v
[Step 8c: Generate Session Analytics]
  1. List all files in {SESSION_DIR}worker-logs/  <-- NOTE: Cleanup Worker logs included/excluded?
     Parse each for: task, type, duration, cost, tokens, files count, verdicts
  2. Compute totals                               <-- RISK: multiple Build logs per task = undefined behavior
  3. Per-task breakdown                           <-- RISK: singular "find its Build Worker log"
  4. Retry stats from state.md Retry Tracker
  5. Review quality verdicts (no scores)          <-- MISSING: scores not tracked
  6. git log --since= for lessons                 <-- RISK: timestamp format undefined
  7. Efficiency metrics
  8. Write {SESSION_DIR}analytics.md              <-- DISCREPANCY: task says task-tracking/session-analytics.md
  9. Log ANALYTICS event
  10. On failure, log ANALYTICS FAILED and continue
```

Gap points:
1. Stats retrieval timing (step 7h sub-step 1) — worker likely freed before call
2. Git query unbounded in time (step 7h sub-step 3)
3. Missing numeric score extraction (step 7h sub-step 5)
4. Multi-worker-per-task aggregation undefined (step 8c sub-step 3)
5. Output file location mismatch vs acceptance criteria

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|---|---|---|
| AC1: Worker logs include phase timestamps, token count, cost, files modified, duration | PARTIAL | Phase timestamps via log.md grep (OK). Tokens/cost via get_worker_stats (timing risk). Files modified via unbounded git log (accuracy risk). Duration OK. |
| AC2: Review worker logs include initial review score | MISSING | Only verdict extracted. Numeric score not captured. |
| AC3: session-analytics.md generated at supervisor stop | PARTIAL | File is generated but at `{SESSION_DIR}analytics.md`, not `task-tracking/session-analytics.md`. Location and name differ from the requirement. |
| AC4: Analytics include total and per-task cost/duration/token breakdown | PARTIAL | Total metrics present. Per-task breakdown undefined for retried tasks. |
| AC5: Analytics include failure/retry stats | COMPLETE | Retry Tracker read from state.md. Stats computed and written. |
| AC6: Analytics include review scores summary | PARTIAL | Review Quality section shows verdict counts. No numeric scores because AC2 is unmet. |

### Implicit Requirements NOT Addressed

1. Cleanup Workers are a third worker type the system spawns, but their costs and durations are not clearly tracked through the analytics pipeline. A session with heavy recovery will have invisible Cleanup costs.
2. Sessions that stop mid-flight (MCP unreachable, compaction) produce analytics with incomplete worker log coverage. The analytics file should include a note explaining why data is incomplete (active workers at stop time are missing from worker-logs/).
3. The analytics file has no indication of which specific tasks remain BLOCKED or IN_PROGRESS at session stop. Users must separately consult registry.md to understand the state of incomplete work.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| get_worker_stats fails entirely | YES | Fallback to "unknown" | Timing gap means this may be the common case, not the edge case |
| get_worker_stats returns partial data (null cost) | NO | Fallback not triggered on partial success | Silent null in aggregation |
| Worker killed in Step 6 (not Step 7 completion) | YES | "use final_stats from kill_worker response" | Good |
| worker-logs/ dir does not exist | YES | mkdir -p in sub-step 0 | Dir creation failure path unclear |
| No worker logs at session stop | PARTIAL | Empty list, totals would be zero | No note that session had active workers when stopped |
| Multiple Build Worker logs for same task | NO | Undefined behavior | Per-task aggregation is ambiguous |
| Cleanup Worker completion triggers 7h | AMBIGUOUS | Template includes it; log event excludes it | Contradiction between two parts of the spec |
| Phase timeline missing from log.md | YES | "write 'No phase transitions recorded.'" | OK |
| Review file verdict not found | YES | Omit row | OK |
| Review file score not found | NO | Not attempted | AC2 unmet |
| Git command fails | YES | Empty list, note "No committed files detected." | OK |
| Analytics file already exists | YES | "overwrite if it exists" | OK |
| session_start_datetime format mismatch for git --since | NO | Format not specified | Silent 0 count |

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Mitigation |
|---|---|---|---|
| get_worker_stats after worker exit | HIGH | All stats "unknown" in analytics | Call at health=finished in Step 6 |
| git log with unbounded history | MEDIUM | Inflated files counts; wrong efficiency metrics | Add --since= bound |
| git log --since with unspecified timestamp format | MEDIUM | 0 lessons detected silently | Specify ISO 8601 format in state.md |
| Cleanup Worker log coverage | MEDIUM | Cleanup costs invisible | Resolve the ambiguity explicitly |
| Per-task aggregation with retries | MEDIUM | Wrong cost/duration for retried tasks | Define aggregation rule |

---

## Verdict

**Recommendation**: REVISE

**Confidence**: HIGH

**Top Risk**: `get_worker_stats` is called after the worker has already exited and may have been freed from the MCP server. In a fast-cleanup environment this is not an edge case — it is the normal case. The majority of worker log entries would show `"unknown"` for all token and cost fields, making the analytics feature produce no useful data in practice. This timing issue should be fixed before the feature can be relied upon.

**Second risk**: Two acceptance criteria are unmet (AC2: initial review score; AC3: file location). These are not corner cases — they are the primary deliverables of the feature.

---

## What Robust Implementation Would Include

- `get_worker_stats` called at the moment of health-status change in Step 6, result cached, passed to Step 7h. No post-mortem MCP calls.
- Git query scoped to `--since={spawn_time_iso}` with spawn_time stored in ISO 8601 format in state.md at worker spawn time.
- Explicit numeric score extraction from review files alongside verdict.
- Explicit per-task aggregation rule for retried tasks (sum or latest).
- Explicit Cleanup Worker handling: either in-scope with a log event format entry, or explicitly out-of-scope with a note.
- analytics.md location reconciled with task.md (or task.md updated to reflect session-scoped output).
- A session coverage note in analytics.md when the session stopped before all workers completed (explains why some tasks have no worker log entries).
- Canonical timestamp format defined in state.md spec and referenced by every sub-step that reads or interpolates it.
